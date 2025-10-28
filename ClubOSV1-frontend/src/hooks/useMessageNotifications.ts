import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';


export function useMessageNotifications() {
  const { user, isLoading: isAuthLoading } = useAuthState();
  const { notify } = useNotifications();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const previousUnreadCount = useRef(0);
  const isFirstLoad = useRef(true);
  const retryCount = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Don't start checking until auth is fully loaded
    if (isAuthLoading) {
      logger.debug('Skipping unread check - auth still loading');
      return;
    }

    // Check if user exists and has the correct role
    if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
      // Set unread count to 0 for non-operator users and return early
      setUnreadCount(0);
      return;
    }

    // Create a new AbortController for this effect
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const checkUnreadMessages = async (isRetry = false) => {
      try {
        const token = tokenManager.getToken();

        // Validate token exists and is not expired
        if (!token) {
          logger.debug('Skipping unread check - no token available');
          return;
        }

        // Check if token is expired
        if (tokenManager.isTokenExpired(token)) {
          logger.debug('Skipping unread check - token is expired');
          return;
        }

        // Pass abort signal to the request
        const response = await http.get(`messages/unread-count`, {
          signal: abortController.signal
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
          logger.debug('Got 401 on unread check, will retry in 2 seconds');
          retryCount.current++;

          // Retry after a delay to allow auth to settle
          setTimeout(() => {
            checkUnreadMessages(true);
          }, 2000);
        } else {
          // Log error but don't notify user for this background check
          logger.error('Failed to check unread messages:', error);

          // Reset retry count after max retries
          if (retryCount.current >= 2) {
            retryCount.current = 0;
          }
        }
      }
    };

    // Add a small initial delay to ensure auth is fully settled
    const initialTimer = setTimeout(() => {
      checkUnreadMessages();
    }, 500); // 500ms delay on first check

    // Check every 30 seconds
    const interval = setInterval(() => {
      if (!abortController.signal.aborted) {
        checkUnreadMessages();
      }
    }, 30000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      // Abort any in-flight requests when hook unmounts or deps change
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [user, isAuthLoading, notify, router.pathname]);

  return { unreadCount };
}