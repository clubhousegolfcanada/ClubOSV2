import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useMessageNotifications() {
  const { user } = useAuthState();
  const { notify } = useNotifications();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const previousUnreadCount = useRef(0);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
      return;
    }

    const checkUnreadMessages = async () => {
      try {
        const token = localStorage.getItem('clubos_token');
        if (!token) return;

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
      }
    };

    // Check immediately
    checkUnreadMessages();

    // Check every 30 seconds
    const interval = setInterval(checkUnreadMessages, 30000);

    return () => clearInterval(interval);
  }, [user, notify, router.pathname]);

  return { unreadCount };
}