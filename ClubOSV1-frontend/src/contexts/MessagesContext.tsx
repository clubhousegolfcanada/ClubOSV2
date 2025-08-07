import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { useNotifications } from '@/state/hooks';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface MessagesContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  markConversationAsRead: (phoneNumber: string) => Promise<void>;
  isRefreshing: boolean;
}

const MessagesContext = createContext<MessagesContextType>({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
  markConversationAsRead: async () => {},
  isRefreshing: false
});

export const useMessages = () => useContext(MessagesContext);

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthState();
  const { notify } = useNotifications();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const previousUnreadCount = useRef(0);
  const isFirstLoad = useRef(true);

  const refreshUnreadCount = useCallback(async () => {
    if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
      setUnreadCount(0);
      return;
    }

    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) {
        setUnreadCount(0);
        return;
      }

      const response = await axios.get(`${API_URL}/messages/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const newUnreadCount = response.data.data.totalUnread;
        setUnreadCount(newUnreadCount);

        // Only show notification if:
        // 1. Not on messages page
        // 2. Count increased
        // 3. Not the first load
        if (
          router.pathname !== '/messages' &&
          newUnreadCount > previousUnreadCount.current &&
          !isFirstLoad.current
        ) {
          const newMessages = newUnreadCount - previousUnreadCount.current;
          notify(
            'info',
            `You have ${newMessages} new message${newMessages > 1 ? 's' : ''}`
          );
        }

        previousUnreadCount.current = newUnreadCount;
        isFirstLoad.current = false;
      }
    } catch (error) {
      console.error('Failed to check unread messages:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [user, notify, router.pathname]);

  const markConversationAsRead = useCallback(async (phoneNumber: string) => {
    if (!user || !phoneNumber) return;

    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) return;

      await axios.put(
        `${API_URL}/messages/conversations/${phoneNumber}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Immediately refresh the unread count
      await refreshUnreadCount();
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
  }, [user, refreshUnreadCount]);

  // Initial load and periodic refresh
  useEffect(() => {
    if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
      return;
    }

    // Check immediately
    refreshUnreadCount();

    // Check every 60 seconds (reduced frequency to prevent rate limiting)
    const interval = setInterval(refreshUnreadCount, 60000);

    return () => clearInterval(interval);
  }, [user, refreshUnreadCount]);

  // Refresh when returning to messages page
  useEffect(() => {
    if (router.pathname === '/messages') {
      refreshUnreadCount();
    }
  }, [router.pathname, refreshUnreadCount]);

  return (
    <MessagesContext.Provider 
      value={{ 
        unreadCount, 
        refreshUnreadCount,
        markConversationAsRead,
        isRefreshing 
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
};