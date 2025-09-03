import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { 
  MessageCircle, Send, Search, Phone, Clock, User, Bell, BellOff, 
  Sparkles, Check, X, Edit2, ChevronLeft, RefreshCw, MapPin,
  CheckCircle, Lock, BotIcon, ChevronDown, ChevronUp
} from 'lucide-react';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useMessages } from '@/contexts/MessagesContext';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';


interface Message {
  id: string;
  text?: string;
  body?: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  createdAt: string;
  status?: string;
  type?: 'conversation_separator';
  timeSinceLastMessage?: number;
  hasReply?: boolean;
}

interface Conversation {
  id: string;
  phone_number: string;
  customer_name: string;
  messages: Message[];
  unread_count: number;
  updated_at: string;
  lastMessage?: Message;
  total_conversations?: number;
  first_contact?: string;
  last_contact?: string;
  location?: string;
  bay?: string;
  isMuted?: boolean;
}

export default function MessagesRedesigned() {
  const { user } = useAuthState();
  const router = useRouter();
  
  // SECURITY: Block customer role from accessing messages
  useEffect(() => {
    if (user) {
      if (user.role === 'customer') {
        router.push('/customer/');
        return;
      }
      // Only allow operator roles
      if (!['admin', 'operator', 'support'].includes(user.role)) {
        router.push('/login');
        return;
      }
    }
  }, [user, router]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [backoffDelay, setBackoffDelay] = useState(0);
  const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
  const [isClient, setIsClient] = useState(false);
  const [showAiSuggestion, setShowAiSuggestion] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState(false);
  const [editedSuggestionText, setEditedSuggestionText] = useState('');
  const [fullMessageHistory, setFullMessageHistory] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const { markConversationAsRead } = useMessages();
  const [assistMode, setAssistMode] = useState<'manual' | 'ai'>('manual');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [customReply, setCustomReply] = useState('');
  const [showCustomReply, setShowCustomReply] = useState(false);

  // Check auth
  useEffect(() => {
    if (user && !['admin', 'operator', 'support'].includes(user.role)) {
      router.push('/');
    }
  }, [user, router]);

  // Set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load conversations
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    loadConversations();
    
    interval = setInterval(() => {
      if (!isRateLimited) {
        loadConversations(false);
      }
    }, 15000);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRateLimited]);

  const loadConversations = async (showRefreshIndicator = false) => {
    if (isRateLimited) return;
    
    if (showRefreshIndicator) setRefreshing(true);
    
    try {
      const token = tokenManager.getToken();
      if (!token) {
        toast.error('Please log in again');
        router.push('/login');
        return;
      }

      const response = await http.get(`messages/conversations`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: { limit: 100 }
      });
      
      if (response.data.success) {
        const sortedConversations = response.data.data.sort((a: any, b: any) => {
          return new Date(b.updated_at || b.created_at).getTime() - 
                 new Date(a.updated_at || a.created_at).getTime();
        });
        
        // Mock location/bay data for demo
        const enhancedConversations = sortedConversations.map((conv: Conversation) => ({
          ...conv,
          location: ['Maple Grove', 'Minnetonka', 'Eden Prairie'][Math.floor(Math.random() * 3)],
          bay: ['Bay 1', 'Bay 2', 'Bay 3', 'Bay 4'][Math.floor(Math.random() * 4)],
          isMuted: Math.random() > 0.8
        }));
        
        setConversations(enhancedConversations);
        
        if (!selectedConversation && enhancedConversations.length > 0 && !loading) {
          selectConversation(enhancedConversations[0]);
        }
      }
    } catch (error: any) {
      logger.error('Failed to load conversations:', error);
      if (error.response?.status === 429) {
        setIsRateLimited(true);
        setTimeout(() => setIsRateLimited(false), 30000);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setMessages([]);
    setFullMessageHistory([]);
    setHasMoreMessages(false);
    
    if (conversation.phone_number) {
      try {
        const token = tokenManager.getToken();
        if (token) {
          const historyResponse = await http.get(
            `messages/conversations/${conversation.phone_number}/full-history`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          if (historyResponse.data.success) {
            const { messages, total_conversations, first_contact, last_contact } = historyResponse.data.data;
            
            setSelectedConversation({
              ...conversation,
              total_conversations,
              first_contact,
              last_contact
            });
            
            const INITIAL_MESSAGE_COUNT = 30;
            const recentMessages = messages.length > INITIAL_MESSAGE_COUNT 
              ? messages.slice(-INITIAL_MESSAGE_COUNT) 
              : messages;
            
            // Add hasReply flag to messages for demo
            const enhancedMessages = recentMessages.map((msg: Message) => ({
              ...msg,
              hasReply: msg.direction === 'inbound' && Math.random() > 0.5
            }));
            
            setMessages(enhancedMessages);
            setFullMessageHistory(messages);
            setHasMoreMessages(messages.length > INITIAL_MESSAGE_COUNT);
            
            await markConversationAsRead(conversation.phone_number);
            
            setConversations(prev => prev.map(c => 
              c.id === conversation.id ? { ...c, unread_count: 0 } : c
            ));
            
            setTimeout(() => scrollToBottom('instant'), 50);
          }
        }
      } catch (error) {
        logger.error('Error fetching conversation history:', error);
        toast.error('Failed to load conversation history');
      }
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !selectedConversation.phone_number || sending) {
      return;
    }
    
    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');
    
    try {
      const token = tokenManager.getToken();
      if (!token) {
        toast.error('Session expired. Please log in again.');
        router.push('/login');
        return;
      }
      
      const response = await http.post(
        `messages/send`,
        {
          to: selectedConversation.phone_number,
          text: messageText
        },
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      if (response.data.success) {
        const sentMessage: Message = {
          id: response.data.data.id,
          text: messageText,
          from: response.data.data.from || '',
          to: selectedConversation.phone_number,
          direction: 'outbound',
          createdAt: new Date().toISOString(),
          status: 'sent'
        };
        
        setMessages(prev => [...prev, sentMessage]);
        setTimeout(scrollToBottom, 100);
        setTimeout(() => loadConversations(), 1000);
      }
    } catch (error: any) {
      logger.error('Failed to send message:', error);
      setNewMessage(messageText);
      toast.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getAiSuggestion = async () => {
    if (!selectedConversation || loadingSuggestion) return;
    
    setLoadingSuggestion(true);
    try {
      const token = tokenManager.getToken();
      if (!token) {
        toast.error('Please log in again');
        return;
      }
      
      const response = await http.post(
        `messages/conversations/${selectedConversation.phone_number}/suggest-response`,
        {},
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      if (response.data.success) {
        setAiSuggestion(response.data.data);
        setShowAiSuggestion(true);
        setShowCustomReply(false);
        toast.success('AI suggestion generated');
      }
    } catch (error: any) {
      logger.error('Failed to get AI suggestion:', error);
      toast.error(error.response?.data?.error || 'Failed to generate suggestion');
    } finally {
      setLoadingSuggestion(false);
    }
  };
  
  const sendAiSuggestion = async (suggestionId: string, editedText?: string) => {
    setSending(true);
    try {
      const token = tokenManager.getToken();
      if (!token) {
        toast.error('Please log in again');
        return;
      }
      
      const finalText = customReply || editedText || aiSuggestion?.suggestedText || '';
      
      const response = await http.post(
        `messages/suggestions/${suggestionId}/approve-and-send`,
        { editedText: finalText },
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      if (response.data.success) {
        toast.success('Message sent successfully');
        setShowAiSuggestion(false);
        setAiSuggestion(null);
        setEditingSuggestion(false);
        setCustomReply('');
        setShowCustomReply(false);
        
        const sentMessage: Message = {
          id: response.data.data.messageId || Date.now().toString(),
          text: finalText,
          from: '',
          to: selectedConversation?.phone_number || '',
          direction: 'outbound',
          createdAt: new Date().toISOString(),
          status: 'sent'
        };
        
        setMessages(prev => [...prev, sentMessage]);
        setTimeout(scrollToBottom, 100);
        setTimeout(() => loadConversations(), 1000);
      }
    } catch (error: any) {
      logger.error('Failed to send AI suggestion:', error);
      toast.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const toggleMessageExpand = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const filteredConversations = conversations.filter(c => {
    if (!c) return false;
    if (!searchTerm) return true;
    const phoneMatch = c.phone_number && c.phone_number.includes(searchTerm);
    const nameMatch = c.customer_name && c.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    return phoneMatch || nameMatch;
  });

  if (!user || !['admin', 'operator', 'support'].includes(user.role)) {
    return null;
  }

  return (
    <>
      <Head>
        <title>ClubOS - Messages</title>
        <meta name="description" content="Customer messaging interface" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Poppins', -apple-system, sans-serif" }}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900" style={{ fontWeight: 700 }}>
                  Messages
                </h1>
                <p className="text-sm text-gray-500 mt-1" style={{ fontWeight: 400 }}>
                  Customer conversations powered by AI
                </p>
              </div>
              
              {/* Mode Toggle */}
              <div className="flex items-center gap-4">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setAssistMode('manual')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      assistMode === 'manual' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    Manual
                  </button>
                  <button
                    onClick={() => setAssistMode('ai')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                      assistMode === 'ai' 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    <BotIcon className="w-4 h-4" />
                    AI Assist
                  </button>
                </div>
                
                {/* Notifications */}
                {isClient && isSupported && (
                  <button
                    onClick={() => isSubscribed ? unsubscribe() : subscribe()}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {isSubscribed ? (
                      <Bell className="w-5 h-5 text-gray-700" />
                    ) : (
                      <BellOff className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex h-[calc(100vh-120px)]">
            {/* Conversations List */}
            <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
              {/* Search */}
              <div className="p-4 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{ fontWeight: 400 }}
                  />
                </div>
              </div>

              {/* Conversation Items */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-gray-400" />
                    <p className="text-sm text-gray-500">Loading...</p>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">No conversations</p>
                  </div>
                ) : (
                  filteredConversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      className={`p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                        selectedConversation?.id === conv.id 
                          ? 'bg-blue-50 border-l-4 border-blue-500' 
                          : 'border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 truncate" style={{ fontWeight: 600 }}>
                              {conv.customer_name || 'Unknown'}
                            </span>
                            {conv.unread_count > 0 && (
                              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full" style={{ fontWeight: 500 }}>
                                {conv.unread_count}
                              </span>
                            )}
                            {conv.lastMessage?.hasReply && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                          
                          {/* Location/Bay badges */}
                          {(conv.location || conv.bay) && (
                            <div className="flex items-center gap-2 mt-1">
                              {conv.location && (
                                <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full" style={{ fontWeight: 500 }}>
                                  <MapPin className="w-3 h-3" />
                                  {conv.location}
                                </span>
                              )}
                              {conv.bay && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full" style={{ fontWeight: 500 }}>
                                  {conv.bay}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs text-gray-500" style={{ fontWeight: 400 }}>
                            {isClient && conv.updated_at ? formatTimeAgo(conv.updated_at) : ''}
                          </span>
                          {conv.isMuted ? (
                            <BellOff className="w-4 h-4 text-gray-400" />
                          ) : (
                            <Bell className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                      
                      {conv.lastMessage && (conv.lastMessage.text || conv.lastMessage.body) && (
                        <p className="text-sm text-gray-600 truncate mt-1" style={{ fontWeight: 400 }}>
                          {conv.lastMessage.direction === 'outbound' && 
                            <span className="text-gray-500">You: </span>
                          }
                          {conv.lastMessage.text || conv.lastMessage.body}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 flex flex-col bg-gray-50">
              {selectedConversation ? (
                <>
                  {/* Conversation Header */}
                  <div className="bg-white border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900" style={{ fontWeight: 600 }}>
                          {selectedConversation.customer_name || 'Unknown'}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm text-gray-500" style={{ fontWeight: 400 }}>
                            {selectedConversation.phone_number}
                          </span>
                          {selectedConversation.total_conversations && selectedConversation.total_conversations > 1 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full" style={{ fontWeight: 500 }}>
                              {selectedConversation.total_conversations} conversations
                            </span>
                          )}
                        </div>
                      </div>
                      <a
                        href={`tel:${selectedConversation.phone_number}`}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        <Phone className="w-5 h-5 text-gray-700" />
                      </a>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-4">
                      {messages.map((message, index) => {
                        const isExpanded = expandedMessages.has(message.id);
                        const isLongMessage = (message.text || message.body || '').length > 200;
                        
                        if (message.type === 'conversation_separator') {
                          return (
                            <div key={message.id || `sep-${index}`} className="flex items-center gap-3 py-4">
                              <div className="flex-1 h-px bg-gray-200" />
                              <span className="text-xs text-gray-500 px-3 py-1 bg-white rounded-full" style={{ fontWeight: 500 }}>
                                New conversation • {message.timeSinceLastMessage}m later
                              </span>
                              <div className="flex-1 h-px bg-gray-200" />
                            </div>
                          );
                        }
                        
                        return (
                          <div
                            key={message.id || index}
                            className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'} 
                              animate-in slide-in-from-bottom-2 duration-300`}
                          >
                            <div className={`max-w-2xl ${
                              message.direction === 'outbound'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white'
                            } rounded-2xl shadow-sm px-5 py-3 relative group`}>
                              <div className="flex items-start justify-between gap-3">
                                <p className={`text-sm ${isExpanded ? '' : 'line-clamp-3'}`} style={{ fontWeight: 400 }}>
                                  {message.text || message.body || ''}
                                </p>
                                {isLongMessage && (
                                  <button
                                    onClick={() => toggleMessageExpand(message.id)}
                                    className={`flex-shrink-0 p-1 rounded transition-colors ${
                                      message.direction === 'outbound' 
                                        ? 'hover:bg-blue-600' 
                                        : 'hover:bg-gray-100'
                                    }`}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </div>
                              
                              <div className="flex items-center justify-between mt-2">
                                <span className={`text-xs ${
                                  message.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'
                                }`} style={{ fontWeight: 400 }}>
                                  {isClient && message.createdAt ? formatTimeAgo(message.createdAt) : ''}
                                </span>
                                {message.hasReply && (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div ref={messagesEndRef} />
                  </div>

                  {/* AI Suggestion Area */}
                  {assistMode === 'ai' && showAiSuggestion && aiSuggestion && (
                    <div className="border-t border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 p-4">
                      <div className="max-w-3xl mx-auto">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                              <BotIcon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900" style={{ fontWeight: 500 }}>
                                AI Suggestion
                              </span>
                              <span className={`ml-2 text-xs ${
                                aiSuggestion.confidence < 0.5 
                                  ? 'text-yellow-600 font-semibold' 
                                  : 'text-gray-500'
                              }`} style={{ fontWeight: aiSuggestion.confidence < 0.5 ? 600 : 400 }}>
                                {Math.round(aiSuggestion.confidence * 100)}% confidence
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setShowAiSuggestion(false);
                              setAiSuggestion(null);
                              setShowCustomReply(false);
                              setCustomReply('');
                            }}
                            className="p-1 hover:bg-white/50 rounded transition-colors"
                          >
                            <X className="w-5 h-5 text-gray-500" />
                          </button>
                        </div>
                        
                        {/* AI Suggestion Text */}
                        <div className="bg-white rounded-lg p-4 mb-3 shadow-sm">
                          {editingSuggestion ? (
                            <textarea
                              value={editedSuggestionText}
                              onChange={(e) => setEditedSuggestionText(e.target.value)}
                              className="w-full p-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={3}
                              style={{ fontWeight: 400 }}
                            />
                          ) : (
                            <p className="text-sm text-gray-800" style={{ fontWeight: 400 }}>
                              {aiSuggestion.suggestedText}
                            </p>
                          )}
                        </div>
                        
                        {/* Custom Reply Field */}
                        {showCustomReply && (
                          <div className="mb-3">
                            <label className="block text-xs text-gray-600 mb-1" style={{ fontWeight: 500 }}>
                              Or write your own reply:
                            </label>
                            <textarea
                              value={customReply}
                              onChange={(e) => setCustomReply(e.target.value)}
                              placeholder="Type your custom message..."
                              className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={2}
                              style={{ fontWeight: 400 }}
                            />
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              if (editingSuggestion) {
                                await sendAiSuggestion(aiSuggestion.id, editedSuggestionText);
                              } else {
                                await sendAiSuggestion(aiSuggestion.id);
                              }
                            }}
                            disabled={sending || (showCustomReply && !customReply.trim())}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            {sending ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            Send
                          </button>
                          
                          <button
                            onClick={() => {
                              if (editingSuggestion) {
                                setEditingSuggestion(false);
                                setEditedSuggestionText('');
                              } else {
                                setEditingSuggestion(true);
                                setEditedSuggestionText(aiSuggestion.suggestedText);
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Edit2 className="w-4 h-4" />
                            {editingSuggestion ? 'Cancel' : 'Edit'}
                          </button>
                          
                          {!showCustomReply && (
                            <button
                              onClick={() => setShowCustomReply(true)}
                              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              <MessageCircle className="w-4 h-4" />
                              Custom Reply
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Message Input */}
                  <div className="border-t border-gray-200 bg-white p-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (assistMode === 'ai' && !showAiSuggestion) {
                          getAiSuggestion();
                        } else {
                          sendMessage();
                        }
                      }}
                      className="flex gap-3"
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={assistMode === 'ai' ? "Type a message to get AI suggestion..." : "Type a message..."}
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={sending}
                        style={{ fontWeight: 400 }}
                      />
                      
                      {assistMode === 'ai' && (
                        <button
                          type="button"
                          onClick={getAiSuggestion}
                          disabled={loadingSuggestion || !selectedConversation || messages.length === 0}
                          className="px-4 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-colors flex items-center gap-2"
                          style={{ fontWeight: 500 }}
                        >
                          <Sparkles className="w-5 h-5" />
                          Suggest
                        </button>
                      )}
                      
                      <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
                        style={{ fontWeight: 500 }}
                      >
                        <Send className="w-5 h-5" />
                        Send
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg text-gray-500" style={{ fontWeight: 400 }}>
                      Select a conversation to start messaging
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}