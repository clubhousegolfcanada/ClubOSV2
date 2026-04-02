import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { http } from '@/api/http';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { useNotifications } from '@/state/hooks';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';


interface CachedConversation {
  id: string | number;
  phone_number: string;
  customer_name: string;
  updated_at: string;
  unread_count?: number;
  last_message_text?: string;
  last_message_direction?: string;
  last_message_at?: string;
  message_count?: number;
  [key: string]: any;
}

interface MessagesContextType {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  markConversationAsRead: (phoneNumber: string, conversationUnreadCount?: number) => Promise<void>;
  isRefreshing: boolean;
  // Conversation cache — persists across page navigations
  cachedConversations: CachedConversation[];
  setCachedConversations: (convos: CachedConversation[]) => void;
  conversationsCacheTime: number;
}

const MessagesContext = createContext<MessagesContextType>({
  unreadCount: 0,
  refreshUnreadCount: async () => {},
  markConversationAsRead: async () => {},
  isRefreshing: false,
  cachedConversations: [],
  setCachedConversations: () => {},
  conversationsCacheTime: 0
});

export const useMessages = () => useContext(MessagesContext);

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: isAuthLoading } = useAuthState();
  const { notify } = useNotifications();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cachedConversations, setCachedConversationsRaw] = useState<CachedConversation[]>([]);
  const [conversationsCacheTime, setConversationsCacheTime] = useState(0);
  const setCachedConversations = useCallback((convos: CachedConversation[]) => {
    setCachedConversationsRaw(convos);
    setConversationsCacheTime(Date.now());
  }, []);
  const previousUnreadCount = useRef(0);
  const isFirstLoad = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshUnreadCount = useCallback(async (isRetry = false) => {
    // Skip if auth is still loading
    if (isAuthLoading) {
      logger.debug('Skipping unread check - auth still loading');
      return;
    }

    if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
      setUnreadCount(0);
      return;
    }

    setIsRefreshing(true);
    try {
      const token = tokenManager.getToken();

      // Validate token exists
      if (!token) {
        logger.debug('Skipping unread check - no token available');
        setUnreadCount(0);
        return;
      }

      // Check if token is expired
      if (tokenManager.isTokenExpired(token)) {
        logger.debug('Skipping unread check - token is expired');
        setUnreadCount(0);
        return;
      }

      // Pass abort signal to the request if available
      const signal = abortControllerRef.current?.signal;
      const response = await http.get(`messages/unread-count`, {
        signal: signal
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

        // Reset retry count on success
        retryCount.current = 0;
      }
    } catch (error: any) {
      // Ignore abort errors - these are intentional when component unmounts
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }

      // Handle 401 errors with retry logic
      if (error.response?.status === 401 && !isRetry && retryCount.current < 2) {
        logger.debug('Got 401 on unread check in MessagesContext, will retry in 2 seconds');
        retryCount.current++;

        // Retry after a delay to allow auth to settle
        setTimeout(() => {
          refreshUnreadCount(true);
        }, 2000);
      } else {
        logger.error('Failed to check unread messages:', error);

        // Stop polling on persistent 401 errors
        if (error.response?.status === 401 && retryCount.current >= 2) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setUnreadCount(0);
          retryCount.current = 0;
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [user, isAuthLoading, notify, router.pathname]);

  const markConversationAsRead = useCallback(async (phoneNumber: string, conversationUnreadCount?: number) => {
    if (!user || !phoneNumber) return;

    // Immediately decrement the nav badge count so it clears instantly.
    // This is optimistic — the backend call follows. The next poll will reconcile.
    if (conversationUnreadCount && conversationUnreadCount > 0) {
      setUnreadCount(prev => Math.max(0, prev - conversationUnreadCount));
      previousUnreadCount.current = Math.max(0, previousUnreadCount.current - conversationUnreadCount);
    }

    try {
      const token = tokenManager.getToken();
      if (!token) return;

      // Use a dedicated AbortController — not the shared polling one.
      // The shared controller can get cancelled on re-render/unmount,
      // which would silently kill the mark-as-read request.
      await http.put(`messages/conversations/${phoneNumber}/read`, {});

      // Background refresh to get exact server count (non-blocking)
      refreshUnreadCount().catch(() => {});
    } catch (error: any) {
      if (error.name !== 'AbortError' && error.code !== 'ERR_CANCELED') {
        logger.error('Failed to mark conversation as read:', error);
      }
    }
  }, [user, refreshUnreadCount]);

  // Initial load and periodic refresh
  useEffect(() => {
    // Skip if auth is still loading
    if (isAuthLoading) {
      return;
    }

    if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
      return;
    }

    // Create a new AbortController for this effect
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Small delay to ensure auth is settled before first check
    const initialTimer = setTimeout(() => {
      refreshUnreadCount();
    }, 100);

    // Check every 60 seconds (reduced frequency to prevent rate limiting)
    intervalRef.current = setInterval(() => {
      if (!abortController.signal.aborted) {
        refreshUnreadCount();
      }
    }, 60000);

    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Abort any in-flight requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [user, isAuthLoading, refreshUnreadCount]);

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
        isRefreshing,
        cachedConversations,
        setCachedConversations,
        conversationsCacheTime
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
};