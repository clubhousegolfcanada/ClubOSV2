import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { MessageSquare, Clock } from 'lucide-react';


interface RecentCustomer {
  phoneNumber: string;
  customerName: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

export const RecentCustomers: React.FC = () => {
  const router = useRouter();
  const [customers, setCustomers] = useState<RecentCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TEMPORARILY DISABLED to prevent duplicate API calls
    // The MessagesCard component already fetches the same data
    // This was causing rate limit exhaustion
    setIsLoading(false);
    setCustomers([]);
    
    /* Original code - re-enable after implementing proper caching
    const fetchRecentCustomers = async () => {
      try {
        const token = localStorage.getItem('clubos_token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await axios.get(`${API_URL}/api/messages/conversations?limit=2`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success && response.data.data) {
          const recentCustomers = response.data.data.map((conv: any) => {
            const lastMsg = conv.lastMessage || conv.messages?.[conv.messages.length - 1];
            return {
              phoneNumber: conv.phone_number,
              customerName: conv.customer_name || conv.phone_number,
              lastMessage: lastMsg?.body || 'No messages',
              timestamp: lastMsg?.createdAt || conv.updated_at,
              unreadCount: conv.unread_count || 0
            };
          });
          setCustomers(recentCustomers);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch recent customers:', error);
        setIsLoading(false);
      }
    };

    fetchRecentCustomers();
    // Refresh every 30 seconds
    const interval = setInterval(fetchRecentCustomers, 30000);
    return () => clearInterval(interval);
    */
  }, []);

  const handleCustomerClick = (phoneNumber: string) => {
    router.push(`/messages?phone=${encodeURIComponent(phoneNumber)}`);
  };

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

  const truncateMessage = (message: string, maxLength: number = 50) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  if (isLoading || customers.length === 0) {
    return null;
  }

  return (
    <div className="sm:hidden mt-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Recent Customers
          </h3>
          <button
            onClick={() => router.push('/messages')}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            View all
          </button>
        </div>
        
        <div className="space-y-3">
          {customers.map((customer, index) => (
            <button
              key={customer.phoneNumber}
              onClick={() => handleCustomerClick(customer.phoneNumber)}
              className="w-full text-left p-3 bg-[var(--bg-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="font-medium text-sm text-[var(--text-primary)]">
                      {customer.customerName}
                    </span>
                    {customer.unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium bg-[var(--accent)] text-white rounded-full">
                        {customer.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                    {truncateMessage(customer.lastMessage)}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] ml-2">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimestamp(customer.timestamp)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};