'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { http } from '@/api/http';
import { MessageSquare, Clock, Send, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import toast from 'react-hot-toast';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';


interface MessageHistory {
  id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  senderName?: string;
  createdAt: string;
  from?: string;
  to?: string;
}

interface Conversation {
  id: string;
  phoneNumber: string;
  customerName: string;
  lastMessage: string;
  lastMessageDirection?: 'inbound' | 'outbound';
  timestamp: string;
  unreadCount: number;
  location?: string;
  bay?: string;
  messageHistory?: MessageHistory[];
}

export default function MessagesCardV3() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthState();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [sending, setSending] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [stopPolling, setStopPolling] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // AbortController for cancelling in-flight requests on unmount
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load saved collapsed state on mount
  useEffect(() => {
    const savedState = localStorage.getItem('messages-collapsed');
    if (savedState === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    // Check role first before doing anything
    if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
      setIsLoading(false);
      setStopPolling(true);
      return;
    }

    if (!isAuthenticated) {
      setStopPolling(true);
      return;
    }

    // Create a new AbortController for this effect
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    fetchConversations();
    // Poll every 10 seconds for new messages, but stop if authentication fails
    const interval = setInterval(() => {
      if (!stopPolling && !abortController.signal.aborted) {
        fetchConversations();
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      // Abort any in-flight requests when component unmounts or deps change
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [user, isAuthenticated, stopPolling]);

  const fetchConversations = async () => {
    try {
      // Check role BEFORE making any API calls
      if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
        setIsLoading(false);
        return;
      }

      const token = tokenManager.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Check if we have an abort signal to use
      const signal = abortControllerRef.current?.signal;

      const response = await http.get(`messages/conversations?limit=3`, {
        signal: signal // Pass the abort signal to the request
      });

      if (response.data.success) {
        // Ensure data is an array before mapping
        const rawData = response.data.data || [];
        const convs = Array.isArray(rawData) ? rawData.map((conv: any) => {
          const lastMsg = conv.lastMessage || conv.messages?.[0];
          return {
            id: conv.id,
            phoneNumber: conv.phone_number,
            customerName: conv.customer_name || 'Unknown',
            lastMessage: lastMsg?.body || lastMsg?.text || 'No messages',
            lastMessageDirection: lastMsg?.direction || conv.last_message_direction,
            timestamp: lastMsg?.createdAt || conv.updated_at,
            unreadCount: conv.unread_count || 0,
            location: conv.location || null,
            bay: conv.bay || null,
            messageHistory: conv.messageHistory || []
          };
        }) : [];

        setConversations(convs);
      }
    } catch (error: any) {
      // Ignore abort errors - these are intentional when component unmounts
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }

      // Stop polling on authentication errors
      if (error?.response?.status === 401) {
        setStopPolling(true);
      }
      logger.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleSend = async (conv: Conversation, customMessage?: string) => {
    const message = customMessage || replyText[conv.id];
    if (!message?.trim()) return;

    setSending({ ...sending, [conv.id]: true });

    try {
      const token = tokenManager.getToken();
      const signal = abortControllerRef.current?.signal;

      await http.post(
        `messages/send`,
        {
          to: conv.phoneNumber,
          text: message.trim(),
          conversationId: conv.id
        },
        {
          signal: signal // Pass the abort signal to the request
        }
      );

      // Clear the reply text
      setReplyText({ ...replyText, [conv.id]: '' });
      
      // Collapse the expanded section
      setExpandedId(null);
      
      toast.success('Message sent!');
      
      // Refresh conversations after a short delay to get server state
      setTimeout(() => {
        fetchConversations();
      }, 1000);
    } catch (error) {
      logger.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending({ ...sending, [conv.id]: false });
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Enhanced timestamp formatting for message history
  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    // Helper to format time
    const formatTimeOnly = (d: Date) => {
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    };

    // Less than 1 hour - show relative time
    if (mins < 60) {
      if (mins < 1) return 'now';
      return `${mins}m ago`;
    }

    // Today - show time only
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return formatTimeOnly(date);
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isYesterday) {
      return `Yesterday ${formatTimeOnly(date)}`;
    }

    // This week - show day and time
    if (days < 7) {
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      return `${dayName} ${formatTimeOnly(date)}`;
    }

    // This year - show month, day, and time
    const isThisYear = date.getFullYear() === now.getFullYear();
    if (isThisYear) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }) + ' ' + formatTimeOnly(date);
    }

    // Older than this year - include year
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' ' + formatTimeOnly(date);
  };

  // Get date separator text if messages span different days
  const getDateSeparator = (currentMsg: MessageHistory, prevMsg: MessageHistory | null) => {
    if (!prevMsg) return null;

    const currentDate = new Date(currentMsg.createdAt);
    const prevDate = new Date(prevMsg.createdAt);

    if (currentDate.toDateString() === prevDate.toDateString()) {
      return null; // Same day, no separator needed
    }

    const now = new Date();
    const isToday = currentDate.toDateString() === now.toDateString();

    if (isToday) {
      return 'Today';
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = currentDate.toDateString() === yesterday.toDateString();

    if (isYesterday) {
      return 'Yesterday';
    }

    // Return formatted date
    return currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: currentDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('messages-collapsed', newState.toString());
  };

  // Calculate total unread count
  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
    return null;
  }

  return (
    <div className="card messages-card-no-hover mt-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border-secondary)]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Messages
          </h3>
          {totalUnread > 0 && isCollapsed && (
            <span className="bg-[var(--status-info)] text-white text-xs px-1.5 py-0.5 rounded-full">
              {totalUnread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/messages')}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
           
          >
            View all
          </button>
          <button
            onClick={toggleCollapse}
            className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
            aria-label={isCollapsed ? 'Expand messages' : 'Collapse messages'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
          </button>
        </div>
      </div>

      {/* Content - Collapsible */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isCollapsed ? 'max-h-0' : 'max-h-[600px]'}`}>
        {isLoading ? (
        <div className="divide-y divide-[var(--border-secondary)]">
          {/* Loading skeletons for 3 conversations */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3 animate-pulse">
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 border border-[var(--border-primary)] rounded-lg bg-[var(--bg-tertiary)]">
                  <div className="w-4 h-3 bg-[var(--bg-secondary)] rounded"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="w-24 h-3 bg-[var(--bg-secondary)] rounded"></div>
                      <div className="w-full h-3 bg-[var(--bg-secondary)] rounded"></div>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-2.5 bg-[var(--bg-secondary)] rounded"></div>
                        <div className="w-20 h-2.5 bg-[var(--bg-secondary)] rounded"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="p-8 text-center">
          <MessageSquare className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">No recent messages</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-secondary)]">
          {conversations.map(conv => {
            const isExpanded = expandedId === conv.id;
            const isSending = sending[conv.id];
            const reply = replyText[conv.id] || '';

            return (
              <div key={conv.id} className="conversation-row transition-all duration-200">
                {/* Message Row with hover effect */}
                <div
                  onClick={() => handleExpand(conv.id)}
                  className="p-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 border border-[var(--border-primary)] rounded-lg bg-[var(--bg-tertiary)]">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {conv.bay ? `B${conv.bay}` : conv.location ? conv.location.substring(0, 3).toUpperCase() : 'GEN'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-[var(--text-primary)] flex items-center gap-2">
                            {conv.customerName}
                            {conv.lastMessageDirection === 'outbound' && (
                              <span className="text-xs px-1 py-0.5 bg-[var(--accent-light)] text-[var(--accent)] rounded">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5 break-words line-clamp-2">
                            {conv.lastMessageDirection === 'outbound' && '↗ '}
                            {conv.lastMessage}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-[var(--text-muted)] flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {formatTime(conv.timestamp)}
                            </span>
                            <span className="text-xs text-[var(--text-muted)] flex items-center gap-0.5">
                              <Phone className="w-2.5 h-2.5" />
                              {conv.phoneNumber}
                            </span>
                          </div>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="bg-[var(--status-info)] text-white text-xs px-1.5 py-0.5 rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Reply Section - Compact */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-secondary)] bg-[var(--bg-tertiary)] p-3 space-y-2">
                    {/* Message History Section */}
                    {conv.messageHistory && conv.messageHistory.length > 0 && (
                      <div className="mb-3">
                        <div className="max-h-[200px] overflow-y-auto space-y-2 p-2 bg-[var(--bg-secondary)] rounded-lg">
                          {conv.messageHistory.map((msg, index) => {
                            const prevMsg = index > 0 ? conv.messageHistory![index - 1] : null;
                            const dateSeparator = getDateSeparator(msg, prevMsg);
                            const isOutbound = msg.direction === 'outbound';

                            return (
                              <div key={msg.id}>
                                {/* Date Separator */}
                                {dateSeparator && (
                                  <div className="flex items-center justify-center my-2">
                                    <div className="flex-1 h-px bg-[var(--border-secondary)]"></div>
                                    <span className="px-2 text-xs text-[var(--text-muted)]">
                                      {dateSeparator}
                                    </span>
                                    <div className="flex-1 h-px bg-[var(--border-secondary)]"></div>
                                  </div>
                                )}

                                {/* Message Bubble */}
                                <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                  <div
                                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                                      isOutbound
                                        ? 'bg-[var(--accent-light)] text-[var(--text-primary)] ml-auto'
                                        : 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                                    }`}
                                  >
                                    <div className="flex items-baseline gap-2 mb-1">
                                      <span className="text-xs font-medium">
                                        {isOutbound ? 'You' : conv.customerName}
                                      </span>
                                      <span className="text-xs text-[var(--text-muted)]">
                                        {formatMessageTime(msg.createdAt)}
                                      </span>
                                    </div>
                                    <p className="text-sm break-words">{msg.body}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Manual Reply Input */}
                    <div className="relative">
                      <input
                        type="text"
                        value={reply}
                        onChange={(e) => setReplyText({ ...replyText, [conv.id]: e.target.value })}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSend(conv);
                          }
                        }}
                        placeholder="Type your reply..."
                        className="w-full pl-3 pr-20 py-1.5 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
                       
                      />
                      <div className="absolute right-1 top-1 flex items-center gap-1">
                        <button
                          onClick={() => handleSend(conv)}
                          disabled={!reply.trim() || isSending}
                          className="px-2 py-0.5 bg-[var(--accent)] text-white text-xs rounded hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                         
                        >
                          {isSending ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                          ) : (
                            'Send'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}