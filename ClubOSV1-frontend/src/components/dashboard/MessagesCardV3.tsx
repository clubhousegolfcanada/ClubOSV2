'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { http } from '@/api/http';
import { MessageSquare, Clock, Send, Phone, MapPin, Bot, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import toast from 'react-hot-toast';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';


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
}

interface AiSuggestion {
  text: string;
  confidence: number;
  patternId?: number;
  queueId?: number;
  canAutoApprove?: boolean;
}

export default function MessagesCardV3() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthState();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [aiSuggestions, setAiSuggestions] = useState<{ [key: string]: AiSuggestion }>({});
  const [loadingAi, setLoadingAi] = useState<{ [key: string]: boolean }>({});
  const [sending, setSending] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [stopPolling, setStopPolling] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

    fetchConversations();
    // Poll every 10 seconds for new messages, but stop if authentication fails
    const interval = setInterval(() => {
      if (!stopPolling) {
        fetchConversations();
      }
    }, 10000);
    return () => clearInterval(interval);
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

      const response = await http.get(`messages/conversations?limit=3`, {

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
            bay: conv.bay || null
          };
        }) : [];
        
        // Clear AI suggestions for conversations that have new messages
        setConversations(prevConvs => {
          const updatedConvIds = new Set<string>();
          convs.forEach((newConv: Conversation) => {
            const oldConv = prevConvs.find(c => c.id === newConv.id);
            if (oldConv && oldConv.lastMessage !== newConv.lastMessage) {
              updatedConvIds.add(newConv.id);
            }
          });
          
          if (updatedConvIds.size > 0) {
            setAiSuggestions(prev => {
              const newSuggestions = { ...prev };
              updatedConvIds.forEach(id => delete newSuggestions[id]);
              return newSuggestions;
            });
          }
          
          return convs;
        });
      }
    } catch (error: any) {
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

  const fetchAiSuggestion = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    setLoadingAi({ ...loadingAi, [conversationId]: true });

    try {
      const token = tokenManager.getToken();
      // Use V3-PLS pattern suggestions endpoint
      const response = await http.post(
        `patterns/suggest-for-conversation`,
        {
          conversationId,
          customerMessage: conv.lastMessage,
          customerName: conv.customerName,
          phoneNumber: conv.phoneNumber,
          location: conv.location,
          bay: conv.bay
        },
        {

        }
      );

      if (response.data.success && response.data.data?.suggestion) {
        setAiSuggestions({
          ...aiSuggestions,
          [conversationId]: {
            text: response.data.data.suggestion,
            confidence: response.data.data.confidence || 0.8,
            patternId: response.data.data.patternId,
            queueId: response.data.data.queueId,
            canAutoApprove: response.data.data.canAutoApprove
          }
        });
      }
    } catch (error) {
      logger.error('Failed to get AI suggestion:', error);
      toast.error('Failed to get AI suggestion');
    } finally {
      setLoadingAi({ ...loadingAi, [conversationId]: false });
    }
  };

  const handleApproveSuggestion = async (conv: Conversation, suggestion: AiSuggestion) => {
    try {
      // If there's a queueId, mark it as approved
      if (suggestion.queueId) {
        await http.post(`patterns/queue/${suggestion.queueId}/respond`, {
          action: 'accept'
        });
      }
      
      // If there's a patternId, update its confidence
      if (suggestion.patternId) {
        await http.post(`patterns/${suggestion.patternId}/executed`, {
          success: true,
          conversationId: conv.id
        });
      }
      
      // Send the message
      await handleSend(conv, suggestion.text);
      
      // Clear the suggestion
      setAiSuggestions(prev => {
        const newSuggestions = { ...prev };
        delete newSuggestions[conv.id];
        return newSuggestions;
      });
      
      toast.success('Pattern approved and sent');
    } catch (error) {
      logger.error('Failed to approve suggestion:', error);
      toast.error('Failed to approve suggestion');
    }
  };

  const handleRejectSuggestion = async (conv: Conversation, suggestion: AiSuggestion) => {
    try {
      // If there's a queueId, mark it as rejected
      if (suggestion.queueId) {
        await http.post(`patterns/queue/${suggestion.queueId}/respond`, {
          action: 'reject'
        });
      }
      
      // If there's a patternId, decrease its confidence
      if (suggestion.patternId) {
        await http.post(`patterns/${suggestion.patternId}/executed`, {
          success: false,
          conversationId: conv.id
        });
      }
      
      // Clear the suggestion
      setAiSuggestions(prev => {
        const newSuggestions = { ...prev };
        delete newSuggestions[conv.id];
        return newSuggestions;
      });
      
      toast('Suggestion rejected');
    } catch (error) {
      logger.error('Failed to reject suggestion:', error);
    }
  };

  const handleSend = async (conv: Conversation, customMessage?: string) => {
    const message = customMessage || replyText[conv.id];
    if (!message?.trim()) return;

    setSending({ ...sending, [conv.id]: true });

    try {
      const token = tokenManager.getToken();
      await http.post(
        `messages/send`,
        {
          phoneNumber: conv.phoneNumber,
          message: message.trim(),
          conversationId: conv.id
        },
        {

        }
      );

      // Clear the reply text and AI suggestion
      setReplyText({ ...replyText, [conv.id]: '' });
      setAiSuggestions(prev => {
        const newSuggestions = { ...prev };
        delete newSuggestions[conv.id];
        return newSuggestions;
      });
      
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
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--text-muted)] mx-auto"></div>
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
            const suggestion = aiSuggestions[conv.id];
            const isLoadingAi = loadingAi[conv.id];
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
                    {/* AI Suggestion Section - Above input field */}
                    {!suggestion && !isLoadingAi ? (
                      // Show Get AI Suggestion button
                      <button
                        onClick={() => fetchAiSuggestion(conv.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                       
                      >
                        <Bot className="w-3 h-3 text-[var(--status-info)]" />
                        <span className="text-[var(--text-primary)]">Get AI Suggestion</span>
                      </button>
                    ) : isLoadingAi ? (
                      // Loading state
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[var(--text-muted)]"></div>
                        <span className="text-xs text-[var(--text-secondary)]">Getting AI suggestion...</span>
                      </div>
                    ) : suggestion ? (
                      // Show AI Suggestion above input
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between p-2 bg-[var(--accent-light)] border border-[var(--accent)] rounded-lg">
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <Bot className="w-3 h-3 text-[var(--accent)] flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs text-[var(--text-primary)] break-words">
                                {suggestion.text}
                              </p>
                              <p className="text-xs text-[var(--text-secondary)] mt-1">
                                Confidence: {Math.round(suggestion.confidence * 100)}%
                                {suggestion.canAutoApprove && ' • Ready to auto-send'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => handleApproveSuggestion(conv, suggestion)}
                            disabled={isSending}
                            className="px-2 py-0.5 bg-[var(--status-success)] text-white text-xs rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
                           
                            title="Use & Learn (increases confidence)"
                          >
                            Use
                          </button>
                          <button
                            onClick={() => {
                              // Send without learning
                              handleSend(conv, suggestion.text);
                              setAiSuggestions(prev => {
                                const newSuggestions = { ...prev };
                                delete newSuggestions[conv.id];
                                return newSuggestions;
                              });
                            }}
                            disabled={isSending}
                            className="px-2 py-0.5 bg-[var(--accent)] text-white text-xs rounded hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
                           
                            title="Send without learning"
                          >
                            Send
                          </button>
                          <button
                            onClick={() => handleRejectSuggestion(conv, suggestion)}
                            className="p-0.5 text-[var(--text-muted)] hover:text-[var(--status-error)] transition-colors"
                            title="Reject (decreases confidence)"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Manual Reply Input - Always visible */}
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