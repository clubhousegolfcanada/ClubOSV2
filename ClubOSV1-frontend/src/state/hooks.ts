import { useState, useCallback, useEffect } from 'react';
import { useAuthState, useSettingsState } from '@/state/useStore';
import { submitRequest as apiSubmitRequest } from '@/api/apiClient';
import { http } from '@/api/http';
import type { UserRequest } from '@/types/request';
import { tokenManager } from '@/utils/tokenManager';

type HistoryEntry = {
  id: string;
  timestamp: string;
  request: string;
  response: string;
  route?: string;
  confidence?: number;
  status: 'completed' | 'failed' | 'processing';
};


// Hook for request submission
export const useRequestSubmission = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { updatePreferences } = useSettingsState();

  const submitRequest = useCallback(async (request: UserRequest) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await apiSubmitRequest(request);
      setLastResponse(response.data);
      
      // Store the response but don't try to add to history
      // since that method doesn't exist in the store
      
      return response;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to process request';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const resetRequestState = useCallback(() => {
    setLastResponse(null);
    setError(null);
  }, []);

  return {
    isSubmitting,
    lastResponse,
    error,
    submitRequest,
    resetRequestState,
    setLastResponse
  };
};

// Hook for notifications
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);

  const addNotification = useCallback((notification: any) => {
    setNotifications(prev => [...prev, notification]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const notify = useCallback((type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    const notification = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date().toISOString()
    };
    addNotification(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(notification.id);
    }, 5000);
  }, [addNotification, removeNotification]);

  return {
    notifications,
    notify,
    removeNotification,
    clearNotifications
  };
};

// Hook for demo mode
export const useDemoMode = () => {
  const [demoMode, setDemoMode] = useState(false);
  const { notify } = useNotifications();

  const runDemo = useCallback(() => {
    setDemoMode(true);
    notify('info', 'Demo mode activated - showing sample workflow');
    
    setTimeout(() => {
      setDemoMode(false);
      notify('success', 'Demo completed');
    }, 10000);
  }, [notify]);

  return { demoMode, runDemo };
};

// Hook for external tool tracking
export const useExternalTools = () => {
  const { preferences, updatePreferences } = useSettingsState();

  const trackToolUsage = useCallback((toolName: string) => {
    const usage = (preferences as any).toolUsage || {};
    const current = usage[toolName] || { count: 0, lastUsed: null };
    
    updatePreferences({
      ...preferences,
      toolUsage: {
        ...usage,
        [toolName]: {
          count: current.count + 1,
          lastUsed: new Date().toISOString()
        }
      }
    } as any);
  }, [preferences, updatePreferences]);

  return { trackToolUsage };
};

// Hook for keyboard shortcuts
export const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K for quick search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('taskInput')?.focus();
      }
      
      // Ctrl/Cmd + / for help
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        // TODO: Show help modal
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
};

// Hook for analytics
export const useAnalytics = () => {
  const [stats, setStats] = useState({
    totalRequests: 0,
    avgResponseTime: 0,
    activeBookings: 0,
    systemStatus: 'operational'
  });
  const [period, setPeriod] = useState('24h');

  useEffect(() => {
    // Skip on server-side rendering
    if (typeof window === 'undefined') return;
    
    const fetchStats = async () => {
      try {
        const token = tokenManager.getToken();
        if (!token) {
          // No token, keep default values
          return;
        }
        
        const response = await http.get(`history/stats/overview`, {
          params: { period }
        });
        
        if (response.data.success && response.data.data) {
          setStats({
            totalRequests: response.data.data.totalRequests || 0,
            avgResponseTime: response.data.data.averageConfidence || 0,
            activeBookings: response.data.data.totalBookings || 0,
            systemStatus: 'operational'
          });
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        // Keep default values on error
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [period]);

  return { stats, period, setPeriod };
};

// Hook for theme persistence
export const useTheme = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('clubos_theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('clubos_theme', newTheme);
  }, [theme]);

  return { theme, toggleTheme };
};
