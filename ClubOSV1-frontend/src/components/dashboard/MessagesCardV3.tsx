'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { MessageSquare, Clock, Send, Phone, MapPin, Bot } from 'lucide-react';
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
  location?: string;
  bay?: string;
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
            unreadCount: conv.unread_count || 0,
            location: conv.location || null,
            bay: conv.bay || null
          };
        });
        
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
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpand = (convId: string) => {
    if (expandedId === convId) {
      setExpandedId(null);
      // Don't clear AI suggestion - keep it cached
      return;
    }

    setExpandedId(convId);
    // AI suggestion will persist if it was already fetched
  };
  
  const fetchAiSuggestion = async (convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    
    // If we already have a suggestion cached, don't fetch again
    if (aiSuggestions[convId]) {
      return;
    }
    
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

  const handleSend = async (conv: Conversation, messageOverride?: string) => {
    const message = messageOverride || replyText[conv.id]?.trim();
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
      
      // Clear AI suggestion for this conversation since context has changed
      setAiSuggestions(prev => {
        const newSuggestions = { ...prev };
        delete newSuggestions[conv.id];
        return newSuggestions;
      });
      
      // Update conversation with the new message
      setConversations(prev => prev.map(c => 
        c.id === conv.id 
          ? { 
              ...c, 
              lastMessage: message,
              timestamp: new Date().toISOString(),
              unreadCount: 0 
            } 
          : c
      ));
      
      // Refresh conversations after a short delay to get server state
      setTimeout(() => {
        fetchConversations();
      }, 1000);
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
    <div className="card" style={{ fontFamily: 'Poppins, -apple-system, sans-serif' }}>
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
                    <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 border border-gray-300 rounded-lg">
                      <span className="text-xs font-medium text-gray-600">
                        {conv.bay ? `B${conv.bay}` : conv.location ? conv.location.substring(0, 3).toUpperCase() : 'GEN'}
                      </span>
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
                    {/* AI Suggestion OR Manual Reply Input */}
                    {!suggestion && !isLoadingAi ? (
                      // Show Get AI Suggestion button
                      <button
                        onClick={() => fetchAiSuggestion(conv.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        <Bot className="w-3 h-3 text-blue-500" />
                        Get AI Suggestion
                      </button>
                    ) : isLoadingAi ? (
                      // Loading state
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                        <span className="text-xs text-gray-500">Getting AI suggestion...</span>
                      </div>
                    ) : suggestion ? (
                      // Show AI Suggestion with inline send button
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Bot className="w-3 h-3 text-blue-500" />
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
                        
                        {/* AI Suggestion Text with Action Buttons */}
                        <div className="relative">
                          <div className="pr-20 py-1.5 px-3 bg-white border border-gray-200 rounded-lg">
                            <p className="text-sm text-gray-700" style={{ fontWeight: 400 }}>
                              {suggestion.text}
                            </p>
                          </div>
                          <div className="absolute right-1 top-1 flex items-center gap-1">
                            <button
                              onClick={() => {
                                // Send the AI suggestion directly
                                handleSend(conv, suggestion.text);
                              }}
                              disabled={isSending}
                              className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              {isSending ? (
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                              ) : (
                                'Send'
                              )}
                            </button>
                            <button
                              onClick={() => {
                                // Clear suggestion to show manual input
                                setAiSuggestions(prev => {
                                  const newSuggestions = { ...prev };
                                  delete newSuggestions[conv.id];
                                  return newSuggestions;
                                });
                              }}
                              className="px-2 py-0.5 text-gray-400 text-xs hover:text-gray-600 transition-colors"
                              style={{ fontWeight: 400 }}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* Manual Reply Input - Only show if no suggestion */}
                    {!suggestion && !isLoadingAi && (
                      <div className="relative mt-2">
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
                          className="w-full pl-3 pr-20 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          style={{ fontWeight: 400 }}
                        />
                        <div className="absolute right-1 top-1 flex items-center gap-1">
                          <button
                            onClick={() => handleSend(conv)}
                            disabled={!reply.trim() || isSending}
                            className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            {isSending ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            ) : (
                              'Send'
                            )}
                          </button>
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
  );
}