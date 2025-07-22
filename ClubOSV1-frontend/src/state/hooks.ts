import { useState, useCallback, useEffect } from 'react';
import { useAuthState, useSettingsState } from '@/state/useStore';
import { submitRequest as apiSubmitRequest } from '@/api/apiClient';
import axios from 'axios';
import type { UserRequest } from '@/types/request';

type HistoryEntry = {
  id: string;
  timestamp: string;
  request: string;
  response: string;
  route?: string;
  confidence?: number;
  status: 'completed' | 'failed' | 'processing';
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Hook for request submission
export const useRequestSubmission = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { addToHistory } = useAuthState();
  const { incrementUsageCount } = useSettingsState();

  const submitRequest = useCallback(async (request: UserRequest) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await apiSubmitRequest(request);
      setLastResponse(response);
      
      // Add to history
      const historyEntry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        request: request.requestDescription,
        response: response.llmResponse?.response || 'Request processed',
        route: response.botRoute,
        confidence: response.llmResponse?.confidence,
        status: response.status || 'completed'
      };
      
      addToHistory(historyEntry);
      incrementUsageCount();
      
      return response;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to process request';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [addToHistory, incrementUsageCount]);

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
  const { notifications, addNotification, removeNotification, clearNotifications } = useAuthState();

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
  const { preferences, setPreferences } = useSettingsState();

  const trackToolUsage = useCallback((toolName: string) => {
    const usage = preferences.toolUsage || {};
    const current = usage[toolName] || { count: 0, lastUsed: null };
    
    setPreferences({
      ...preferences,
      toolUsage: {
        ...usage,
        [toolName]: {
          count: current.count + 1,
          lastUsed: new Date().toISOString()
        }
      }
    });
  }, [preferences, setPreferences]);

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
