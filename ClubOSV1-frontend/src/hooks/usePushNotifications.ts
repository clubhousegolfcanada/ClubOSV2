import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const usePushNotifications = () => {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: true,
    error: null
  });

  // Check if push notifications are supported
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setState(prev => ({
        ...prev,
        isLoading: false
      }));
      return;
    }

    const checkSupport = async () => {
      const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      
      if (!isSupported) {
        setState(prev => ({
          ...prev,
          isSupported: false,
          isLoading: false,
          error: 'Push notifications are not supported in this browser'
        }));
        return;
      }

      // Get current permission state
      const currentPermission = Notification.permission;
      console.log('Initial notification permission state:', currentPermission);

      setState(prev => ({
        ...prev,
        isSupported: true,
        permission: currentPermission
      }));

      // Check subscription status
      await checkSubscription();
    };

    checkSupport();
  }, []);

  const checkSubscription = async () => {
    try {
      // Check if we're on client side
      if (typeof window === 'undefined' || !navigator.serviceWorker) {
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      console.log('Current push subscription:', subscription ? 'Found' : 'Not found');
      
      if (subscription) {
        // Verify with backend
        const token = typeof window !== 'undefined' ? localStorage.getItem('clubos_token') : null;
        if (!token) {
          console.log('No auth token found, skipping subscription check');
          return;
        }
        
        const response = await fetch(`${API_URL}/notifications/subscription-status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Backend subscription status:', data);
          setState(prev => ({
            ...prev,
            isSubscribed: data.data?.subscriptions?.length > 0 || false,
            isLoading: false
          }));
        } else {
          console.error('Failed to check subscription status:', response.status);
          setState(prev => ({
            ...prev,
            isSubscribed: false,
            isLoading: false
          }));
        }
      } else {
        setState(prev => ({
          ...prev,
          isSubscribed: false,
          isLoading: false
        }));
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to check subscription status'
      }));
    }
  };

  const requestPermission = useCallback(async () => {
    if (!state.isSupported) {
      toast.error('Push notifications are not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      
      if (permission === 'granted') {
        toast.success('Notification permission granted');
        return true;
      } else if (permission === 'denied') {
        toast.error('Notification permission denied');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  }, [state.isSupported]);

  const subscribe = useCallback(async () => {
    // Check if notifications are supported
    if (!state.isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    // Check current permission state
    const currentPermission = Notification.permission;
    console.log('Current notification permission:', currentPermission);
    
    if (currentPermission === 'denied') {
      toast.error('Notifications are blocked. Please enable them in your browser settings.');
      return false;
    }
    
    if (currentPermission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Register service worker if not already registered
      const registration = await navigator.serviceWorker.register('/sw.js');
      await registration.update();

      // Get VAPID public key from backend
      const vapidResponse = await fetch(`${API_URL}/notifications/vapid-key`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clubos_token')}`
        }
      });

      if (!vapidResponse.ok) {
        throw new Error('Failed to get VAPID key');
      }

      const vapidData = await vapidResponse.json();
      
      if (!vapidData.success || !vapidData.data?.publicKey) {
        throw new Error('No VAPID public key available');
      }
      
      const publicKey = vapidData.data.publicKey;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Send subscription to backend
      const response = await fetch(`${API_URL}/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clubos_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.toJSON().keys?.p256dh || '',
            auth: subscription.toJSON().keys?.auth || ''
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to save subscription: ${error}`);
      }

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false
      }));

      toast.success('Push notifications enabled!');
      return true;
    } catch (error: any) {
      console.error('Error subscribing:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to enable push notifications';
      if (error.message.includes('VAPID')) {
        errorMessage = 'Push notification service not configured. Please contact support.';
      } else if (error.message.includes('subscription')) {
        errorMessage = 'Failed to create notification subscription. Please try again.';
      }
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      toast.error(errorMessage);
      return false;
    }
  }, [state.isSupported, state.permission, requestPermission]);

  const unsubscribe = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      // Notify backend
      const response = await fetch(`${API_URL}/notifications/subscribe`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clubos_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to unsubscribe');
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false
      }));

      toast.success('Push notifications disabled');
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to disable push notifications'
      }));
      toast.error('Failed to disable push notifications');
      return false;
    }
  }, []);

  const updatePreferences = useCallback(async (preferences: {
    newMessages?: boolean;
    ticketUpdates?: boolean;
    systemAlerts?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  }) => {
    try {
      const response = await fetch(`${API_URL}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clubos_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      toast.success('Notification preferences updated');
      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Failed to update preferences');
      return false;
    }
  }, []);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    updatePreferences,
    checkSubscription
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}