'use client';

import React, { useEffect, useState } from 'react';
import { API_URL } from '@/utils/apiUrl';
import { useRouter } from 'next/router';
import axios from 'axios';
import { 
  MessageSquare, Clock, ArrowRight, ChevronDown, ChevronUp, 
  Send, Sparkles, ExternalLink, RefreshCw, Phone, User
} from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import { useMessages } from '@/contexts/MessagesContext';
import toast from 'react-hot-toast';


interface RecentConversation {
  id: string;
  phoneNumber: string;
  customerName: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  conversationId?: string;
}

interface ExpandedConversation {
  conversationId: string;
  isLoading: boolean;
  replyText: string;
  aiSuggestion: string;
  confidence: number;
}

export const MessagesCardEnhanced: React.FC = () => {
  const router = useRouter();
  const { user } = useAuthState();
  const { unreadCount } = useMessages();
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [expandedConv, setExpandedConv] = useState<ExpandedConversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    const fetchRecentConversations = async () => {
      try {
        const token = localStorage.getItem('clubos_token');
        if (!token || !user || !['admin', 'operator', 'support'].includes(user.role)) {
          setIsLoading(false);
          return;
        }

        const response = await axios.get(`${API_URL}/api/messages/conversations?limit=3`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success && response.data.data) {
          const conversations = response.data.data.map((conv: any) => {
            const lastMsg = conv.lastMessage || conv.messages?.[conv.messages.length - 1];
            return {
              id: conv.id,
              phoneNumber: conv.phone_number,
              customerName: conv.customer_name || conv.phone_number,
              lastMessage: lastMsg?.body || 'No messages',
              timestamp: lastMsg?.createdAt || conv.updated_at,
              unreadCount: conv.unread_count || 0,
              conversationId: conv.conversation_id || conv.id
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
    const interval = setInterval(fetchRecentConversations, 120000);
    return () => clearInterval(interval);
  }, [user]);

  const toggleExpand = async (conv: RecentConversation) => {
    // If clicking the same conversation, collapse it
    if (expandedConv?.conversationId === conv.conversationId) {
      setExpandedConv(null);
      return;
    }

    // Expand and fetch AI suggestion
    setExpandedConv({
      conversationId: conv.conversationId || conv.id,
      isLoading: true,
      replyText: '',
      aiSuggestion: '',
      confidence: 0
    });

    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/api/llm/suggest-response`,
        {
          conversationId: conv.conversationId,
          context: conv.lastMessage
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setExpandedConv({
          conversationId: conv.conversationId || conv.id,
          isLoading: false,
          replyText: response.data.suggestion || '',
          aiSuggestion: response.data.suggestion || '',
          confidence: response.data.confidence || 75
        });
      }
    } catch (error) {
      console.error('Error fetching AI suggestion:', error);
      setExpandedConv({
        conversationId: conv.conversationId || conv.id,
        isLoading: false,
        replyText: '',
        aiSuggestion: 'I can help you with that. Let me check and get back to you shortly.',
        confidence: 60
      });
    }
  };

  const sendReply = async (conv: RecentConversation) => {
    if (!expandedConv || !expandedConv.replyText.trim()) return;

    setSendingReply(true);
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.post(
        `${API_URL}/api/messages/send`,
        {
          to: conv.phoneNumber,
          content: expandedConv.replyText,
          conversationId: conv.conversationId,
          isAiGenerated: expandedConv.replyText === expandedConv.aiSuggestion
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success('Reply sent successfully');
      
      // Update conversation to show as replied
      setConversations(prev => prev.map(c => 
        c.id === conv.id 
          ? { ...c, unreadCount: 0 }
          : c
      ));

      // Collapse the expanded conversation
      setExpandedConv(null);
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
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

  const truncateMessage = (message: string, maxLength: number = 60) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-50';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
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
            {conversations.map((conv) => {
              const isExpanded = expandedConv?.conversationId === conv.conversationId;
              
              return (
                <div
                  key={conv.phoneNumber}
                  className={`border border-[var(--border)] rounded-lg transition-all ${
                    isExpanded ? 'shadow-md' : ''
                  }`}
                >
                  {/* Message Header - Always Visible */}
                  <div
                    onClick={() => toggleExpand(conv)}
                    className="w-full text-left p-3 bg-[var(--bg-secondary)] rounded-t-lg hover:bg-[var(--bg-tertiary)] transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-[var(--text-muted)]" />
                          <span className="font-medium text-sm text-[var(--text-primary)]">
                            {conv.customerName}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-medium bg-[var(--accent)] text-white rounded-full">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-1 ml-6">
                          {truncateMessage(conv.lastMessage)}
                        </p>
                        <div className="flex items-center gap-3 mt-1 ml-6">
                          <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimestamp(conv.timestamp)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <Phone className="w-3 h-3" />
                            <span>{conv.phoneNumber}</span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-2 flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/messages?phone=${encodeURIComponent(conv.phoneNumber)}`);
                          }}
                          className="p-1 hover:bg-[var(--bg-primary)] rounded transition-colors"
                          title="View full conversation"
                        >
                          <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && expandedConv && (
                    <div className="border-t border-[var(--border)] p-3 bg-[var(--bg-primary)] rounded-b-lg">
                      {expandedConv.isLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <RefreshCw className="w-5 h-5 animate-spin text-[var(--accent)] mr-2" />
                          <span className="text-sm text-[var(--text-muted)]">Generating AI response...</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* AI Suggestion */}
                          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                                <span className="text-xs font-medium">AI Suggestion</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${getConfidenceColor(expandedConv.confidence)}`}>
                                  {expandedConv.confidence}%
                                </span>
                              </div>
                              <button
                                onClick={() => setExpandedConv({
                                  ...expandedConv,
                                  replyText: expandedConv.aiSuggestion
                                })}
                                className="text-xs px-2 py-1 bg-[var(--accent)] text-white rounded hover:opacity-90 transition-opacity"
                              >
                                Use
                              </button>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {expandedConv.aiSuggestion}
                            </p>
                          </div>

                          {/* Reply Input */}
                          <div>
                            <textarea
                              value={expandedConv.replyText}
                              onChange={(e) => setExpandedConv({
                                ...expandedConv,
                                replyText: e.target.value
                              })}
                              placeholder="Type your reply or use the AI suggestion..."
                              className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                              rows={2}
                            />
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => setExpandedConv(null)}
                              className="px-3 py-1.5 text-xs border border-[var(--border)] rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => sendReply(conv)}
                              disabled={!expandedConv.replyText.trim() || sendingReply}
                              className="px-3 py-1.5 bg-[var(--accent)] text-white text-xs rounded hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {sendingReply ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Send className="w-3 h-3" />
                                  Send
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
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
};