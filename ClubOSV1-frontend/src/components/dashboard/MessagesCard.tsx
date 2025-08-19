import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { MessageSquare, Clock, ArrowRight } from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import { useMessages } from '@/contexts/MessagesContext';

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Remove /api from the end if it exists
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}

interface RecentConversation {
  phoneNumber: string;
  customerName: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

export const MessagesCard: React.FC = () => {
  const router = useRouter();
  const { user } = useAuthState();
  const { unreadCount } = useMessages();
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecentConversations = async () => {
      try {
        const token = localStorage.getItem('clubos_token');
        if (!token || !user || !['admin', 'operator', 'support'].includes(user.role)) {
          setIsLoading(false);
          return;
        }

        const response = await axios.get(`${API_URL}/api/messages/conversations?limit=2`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success && response.data.data) {
          const conversations = response.data.data.map((conv: any) => {
            const lastMsg = conv.lastMessage || conv.messages?.[conv.messages.length - 1];
            return {
              phoneNumber: conv.phone_number,
              customerName: conv.customer_name || conv.phone_number,
              lastMessage: lastMsg?.body || 'No messages',
              timestamp: lastMsg?.createdAt || conv.updated_at,
              unreadCount: conv.unread_count || 0
            };
          });
          setConversations(conversations);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
        setIsLoading(false);
      }
    };

    fetchRecentConversations();
    // Refresh every 2 minutes to prevent rate limiting (was 60 seconds)
    const interval = setInterval(fetchRecentConversations, 120000);
    return () => clearInterval(interval);
  }, [user]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const truncateMessage = (message: string, maxLength: number = 60) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  // Don't show for users without access
  if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-4">
        <div className="card p-4 animate-pulse">
          <div className="h-5 bg-[var(--bg-tertiary)] rounded w-24 mb-3"></div>
          <div className="space-y-2">
            <div className="h-12 bg-[var(--bg-tertiary)] rounded"></div>
            <div className="h-12 bg-[var(--bg-tertiary)] rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-[var(--text-primary)]">
              Messages
            </h3>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium bg-[var(--accent)] text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={() => router.push('/messages')}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            View all
          </button>
        </div>
        
        {conversations.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-muted)]">No recent conversations</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.phoneNumber}
                onClick={() => router.push(`/messages?phone=${encodeURIComponent(conv.phoneNumber)}`)}
                className="w-full text-left p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-all duration-200 hover:translate-x-1"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[var(--text-primary)]">
                        {conv.customerName}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium bg-[var(--accent)] text-white rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-1 mt-1">
                      {truncateMessage(conv.lastMessage)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] ml-2 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimestamp(conv.timestamp)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};