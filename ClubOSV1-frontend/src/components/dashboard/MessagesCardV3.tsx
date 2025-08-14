'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { MessageSquare, Clock, Send, Phone, User, Sparkles } from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Conversation {
  id: string;
  phoneNumber: string;
  customerName: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
}

interface AiSuggestion {
  text: string;
  confidence: number;
}

export default function MessagesCardV3() {
  const router = useRouter();
  const { user } = useAuthState();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [aiSuggestions, setAiSuggestions] = useState<{ [key: string]: AiSuggestion }>({});
  const [loadingAi, setLoadingAi] = useState<{ [key: string]: boolean }>({});
  const [sending, setSending] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
    // Poll every 10 seconds for new messages
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token || !user || !['admin', 'operator', 'support'].includes(user.role)) {
        setIsLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/messages/conversations?limit=3`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const convs = response.data.data.map((conv: any) => {
          const lastMsg = conv.lastMessage || conv.messages?.[0];
          return {
            id: conv.id,
            phoneNumber: conv.phone_number,
            customerName: conv.customer_name || 'Unknown',
            lastMessage: lastMsg?.body || lastMsg?.text || 'No messages',
            timestamp: lastMsg?.createdAt || conv.updated_at,
            unreadCount: conv.unread_count || 0
          };
        });
        setConversations(convs);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpand = (convId: string) => {
    if (expandedId === convId) {
      setExpandedId(null);
      // Clear AI suggestion when collapsing
      setAiSuggestions(prev => {
        const newSuggestions = { ...prev };
        delete newSuggestions[convId];
        return newSuggestions;
      });
      return;
    }

    setExpandedId(convId);
    // Don't auto-fetch AI suggestion anymore
  };
  
  const fetchAiSuggestion = async (convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    
    setLoadingAi({ ...loadingAi, [convId]: true });
    
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/messages/conversations/${conv.phoneNumber}/suggest-response`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && response.data.data) {
        const suggestion = response.data.data;
        setAiSuggestions({
          ...aiSuggestions,
          [convId]: {
            text: suggestion.suggestedText || 'I\'ll check on that and get back to you shortly.',
            confidence: Math.round((suggestion.confidence || 0.6) * 100)
          }
        });
      }
    } catch (error: any) {
      console.error('Failed to get AI suggestion:', error);
      // Only show error if it's not a 404 (no conversation)
      if (error.response?.status !== 404) {
        const fallbackMessage = 'I\'ll check on that and get back to you shortly.';
        setAiSuggestions({
          ...aiSuggestions,
          [convId]: {
            text: fallbackMessage,
            confidence: 30
          }
        });
      }
    } finally {
      setLoadingAi({ ...loadingAi, [convId]: false });
    }
  };

  const handleSend = async (conv: Conversation) => {
    const message = replyText[conv.id]?.trim();
    if (!message) return;

    setSending({ ...sending, [conv.id]: true });
    
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.post(
        `${API_URL}/messages/send`,
        {
          to: conv.phoneNumber,
          text: message
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Message sent');
      setReplyText({ ...replyText, [conv.id]: '' });
      setExpandedId(null);
      
      // Update conversation
      setConversations(prev => prev.map(c => 
        c.id === conv.id ? { ...c, unreadCount: 0 } : c
      ));
    } catch (error) {
      console.error('Failed to send message:', error);
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

  if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ fontFamily: 'Poppins, -apple-system, sans-serif' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900" style={{ fontWeight: 600 }}>
          Messages
        </h3>
        <button
          onClick={() => router.push('/messages')}
          className="text-sm text-gray-500 hover:text-gray-700"
          style={{ fontWeight: 400 }}
        >
          View all
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto"></div>
        </div>
      ) : conversations.length === 0 ? (
        <div className="p-8 text-center">
          <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No recent messages</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {conversations.map(conv => {
            const isExpanded = expandedId === conv.id;
            const suggestion = aiSuggestions[conv.id];
            const isLoadingAi = loadingAi[conv.id];
            const isSending = sending[conv.id];
            const reply = replyText[conv.id] || '';

            return (
              <div key={conv.id} className="transition-all duration-200">
                {/* Message Row */}
                <div
                  onClick={() => handleExpand(conv.id)}
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900" style={{ fontWeight: 500 }}>
                            {conv.customerName}
                          </p>
                          <p className="text-sm text-gray-600 truncate mt-0.5" style={{ fontWeight: 400 }}>
                            {conv.lastMessage}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(conv.timestamp)}
                            </span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {conv.phoneNumber}
                            </span>
                          </div>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Reply Section - Compact */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-3">
                    {/* AI Suggestion Button or Result */}
                    {!suggestion && !isLoadingAi ? (
                      <button
                        onClick={() => fetchAiSuggestion(conv.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1 mb-2 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        <Sparkles className="w-3 h-3 text-blue-500" />
                        Get AI Suggestion
                      </button>
                    ) : isLoadingAi ? (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                        <span className="text-xs text-gray-500">Getting AI suggestion...</span>
                      </div>
                    ) : suggestion && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500" style={{ fontWeight: 400 }}>
                              AI suggestion
                            </span>
                            <span className="text-xs text-gray-400" style={{ fontWeight: 400 }}>
                              {Math.round(suggestion.confidence)}%
                            </span>
                            {suggestion.confidence < 50 && (
                              <span className="text-xs text-orange-600" style={{ fontWeight: 400 }}>
                                • Review recommended
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 italic mb-2" style={{ fontWeight: 400 }}>
                          "{suggestion.text}"
                        </div>
                      </div>
                    )}

                    {/* Reply Input with inline actions - More compact */}
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
                        className="w-full pl-3 pr-36 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        style={{ fontWeight: 400 }}
                      />
                      <div className="absolute right-1 top-1 flex items-center gap-1">
                        {suggestion && (
                          <button
                            onClick={() => setReplyText({ ...replyText, [conv.id]: suggestion.text })}
                            className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            Use
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(null);
                            setReplyText({ ...replyText, [conv.id]: '' });
                          }}
                          className="px-2 py-0.5 text-gray-400 text-xs hover:text-gray-600 transition-colors"
                          style={{ fontWeight: 400 }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSend(conv)}
                          disabled={!reply.trim() || isSending}
                          className="p-0.5 text-blue-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSending ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                          ) : (
                            <Send className="w-3 h-3" />
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
  );
}