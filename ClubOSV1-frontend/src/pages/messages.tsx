import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { MessageCircle, Send, Search, Phone, Clock, ArrowLeft, Bell, BellOff, Sparkles, Check, X, Edit2, ChevronLeft, RefreshCw, ExternalLink, Plus, Monitor, Calendar } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useRemoteActionsBar } from '@/hooks/useRemoteActionsBar';
import { useMessages } from '@/contexts/MessagesContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
}

interface Conversation {
  id: string;
  phone_number: string;
  customer_name: string;
  messages: Message[];
  unread_count: number;
  updated_at: string;
  lastMessage?: Message;
  _debug_invalid_phone?: boolean;
  total_conversations?: number;
  first_contact?: string;
  last_contact?: string;
  location?: string;
  bay?: string;
}

export default function Messages() {
  const { user } = useAuthState();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const desktopMessagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [backoffDelay, setBackoffDelay] = useState(0);
  const { isSupported, permission, isSubscribed, isLoading: notificationLoading, subscribe, unsubscribe } = usePushNotifications();
  const [isClient, setIsClient] = useState(false);
  const [showAiSuggestion, setShowAiSuggestion] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState(false);
  const [editedSuggestionText, setEditedSuggestionText] = useState('');
  // Removed pull-to-refresh states for better native feel
  const [isInIframe, setIsInIframe] = useState(false);
  const [fullMessageHistory, setFullMessageHistory] = useState<Message[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const remoteActionsBar = useRemoteActionsBar();
  const { markConversationAsRead, refreshUnreadCount } = useMessages();

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

  // Check if we're in an iframe
  useEffect(() => {
    try {
      setIsInIframe(window !== window.parent);
    } catch (e) {
      setIsInIframe(false);
    }
  }, []);

  // Load conversations and handle refresh
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let isTabVisible = true;
    
    // Initial load
    loadConversations();
    
    // Setup refresh interval with visibility check
    const startRefresh = () => {
      // Clear any existing interval first
      if (interval) {
        clearInterval(interval);
      }
      
      // Set up auto-refresh every 15 seconds (increased from 5s to reduce rate limit issues)
      interval = setInterval(() => {
        // Only refresh if tab is visible and not rate limited
        if (isTabVisible && !isRateLimited) {
          loadConversations(false);
        }
      }, 15000);
      setRefreshInterval(interval);
    };
    
    // Handle visibility changes
    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      console.log('Tab visibility changed:', isTabVisible ? 'visible' : "hidden");
      
      if (isTabVisible && !isRateLimited) {
        // Reload when tab becomes visible
        loadConversations(false);
      }
    };
    
    // Start refresh
    startRefresh();
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRateLimited]); // Re-run when rate limit status changes

  // Handle phone query parameter from URL
  useEffect(() => {
    if (router.query.phone && conversations.length > 0) {
      const phoneToSelect = router.query.phone as string;
      const normalizePhone = (phone: string) => phone ? phone.replace(/\D/g, '') : '';
      const normalizedPhoneToSelect = normalizePhone(phoneToSelect);
      
      // Find the conversation with matching phone number
      const conversationToSelect = conversations.find(conv => 
        normalizePhone(conv.phone_number) === normalizedPhoneToSelect
      );
      
      if (conversationToSelect && (!selectedConversation || selectedConversation.phone_number !== conversationToSelect.phone_number)) {
        // Use selectConversation to properly load full history and mark as read
        selectConversation(conversationToSelect);
        
        // Clear the query parameter to avoid re-selecting on refresh
        router.replace('/messages', undefined, { shallow: true });
      }
    }
  }, [router.query.phone, conversations]);

  // Track previous message count for new message detection
  const prevMessageCountRef = useRef(messages.length);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      // Check if new messages were added (not just initial load)
      const isNewMessage = messages.length > prevMessageCountRef.current;
      
      // Use timeout to ensure DOM is updated
      setTimeout(() => {
        if (isNewMessage) {
          scrollToBottom('smooth');
        } else {
          scrollToBottom('instant');
        }
      }, 50);
      
      // Update the ref for next comparison
      prevMessageCountRef.current = messages.length;
    }
  }, [messages]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
      // Also scroll desktop container if it exists
      if (desktopMessagesContainerRef.current) {
        if (behavior === 'smooth') {
          desktopMessagesContainerRef.current.scrollTo({
            top: desktopMessagesContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        } else {
          desktopMessagesContainerRef.current.scrollTop = desktopMessagesContainerRef.current.scrollHeight;
        }
      }
      // For mobile, also scroll the messages container
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        if (behavior === 'smooth') {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
        } else {
          container.scrollTop = container.scrollHeight;
        }
      }
    });
  };

  const loadConversations = async (showRefreshIndicator = false) => {
    // Skip if rate limited
    if (isRateLimited) {
      console.log('Skipping refresh - rate limited');
      return;
    }
    
    if (showRefreshIndicator) {
      setRefreshing(true);
    }
    
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) {
        console.error('No auth token found');
        toast.error('Please log in again');
        router.push('/login');
        return;
      }

      const response = await axios.get(`${API_URL}/messages/conversations`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: { limit: 100 }
      });
      
      if (response.data.success) {
        console.log('Loaded conversations:', response.data.data);
        const sortedConversations = response.data.data.sort((a: any, b: any) => {
          return new Date(b.updated_at || b.created_at).getTime() - 
                 new Date(a.updated_at || a.created_at).getTime();
        });
        setConversations(sortedConversations);
        
        // Auto-select first conversation if none selected
        if (!selectedConversation && sortedConversations.length > 0) {
          const firstConversation = sortedConversations[0];
          // Use selectConversation to fetch full history
          selectConversation(firstConversation);
          console.log('Auto-selected first conversation:', firstConversation.customer_name);
        }
        
        // Update selected conversation if it exists
        else if (selectedConversation) {
          // Normalize phone numbers for comparison (remove any formatting)
          const normalizePhone = (phone: string) => phone ? phone.replace(/\D/g, '') : '';
          const selectedPhone = normalizePhone(selectedConversation.phone_number);
          
          const updated = response.data.data.find((c: Conversation) => 
            normalizePhone(c.phone_number) === selectedPhone
          );
          
          if (updated) {
            const updatedMessages = Array.isArray(updated.messages) ? updated.messages : [];
            const currentMessageCount = messages.length;
            const updatedMessageCount = updatedMessages.length;
            
            // Always update the conversation and messages to ensure we have the latest data
            setSelectedConversation(updated);
            
            // Deduplicate messages by ID to prevent duplicates
            const uniqueMessages = updatedMessages.reduce((acc: Message[], msg: Message) => {
              if (!acc.find(m => m.id === msg.id)) {
                acc.push(msg);
              }
              return acc;
            }, []);
            
            setMessages(uniqueMessages);
            
            // Check if there are new messages by comparing counts and checking the last message
            if (updatedMessageCount > currentMessageCount) {
              const newMessagesCount = updatedMessageCount - currentMessageCount;
              const lastMessage = updatedMessages[updatedMessages.length - 1];
              
              // Show notification for new inbound messages
              if (lastMessage && lastMessage.direction === 'inbound') {
                toast.success(`New message from ${updated.customer_name || 'customer'}`, {
                  duration: 3000,
                  icon: '💬'
                });
              }
              
              // Scroll to bottom to show new messages
              setTimeout(() => {
                scrollToBottom('smooth');
              }, 100);
              
              console.log(`Updated conversation with ${newMessagesCount} new message(s)`);
            }
          } else {
            console.warn('Could not find updated conversation for phone:', selectedConversation.phone_number);
          }
        }
      } else {
        console.error('API returned success: false', response.data);
        toast.error(response.data.error || 'Failed to load conversations');
      }
    } catch (error: any) {
      console.error('Failed to load conversations:', error);
      
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        router.push('/login');
      } else if (error.response?.status === 404) {
        toast.error('Messages API not found. Please check backend deployment.');
      } else if (error.response?.status === 429) {
        // Rate limited - implement exponential backoff
        setIsRateLimited(true);
        const delay = Math.min((backoffDelay || 5000) * 2, 60000); // Max 1 minute
        setBackoffDelay(delay);
        
        console.log(`Rate limited. Backing off for ${delay/1000} seconds`);
        
        // Don't show toast for auto-refresh rate limits
        if (showRefreshIndicator) {
          toast.error(`Too many requests. Retrying in ${Math.round(delay/1000)} seconds`);
        }
        
        // Reset after backoff period
        setTimeout(() => {
          setIsRateLimited(false);
          setBackoffDelay(0);
        }, delay);
      } else {
        toast.error(error.response?.data?.error || 'Failed to load conversations');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setMessages([]); // Clear messages while loading
    setFullMessageHistory([]); // Clear full history
    setHasMoreMessages(false); // Reset load more state
    
    // Focus input field after selecting conversation (desktop only)
    setTimeout(() => {
      const desktopInput = document.querySelector('.md\\:block input[placeholder="Type a message..."]') as HTMLInputElement;
      if (desktopInput && window.innerWidth >= 768) {
        desktopInput.focus();
      }
    }, 100);
    
    // Fetch conversation history
    if (conversation.phone_number) {
      try {
        const token = localStorage.getItem('clubos_token');
        if (token) {
          // Fetch complete history for this phone number
          const historyResponse = await axios.get(
            `${API_URL}/messages/conversations/${conversation.phone_number}/full-history`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          
          if (historyResponse.data.success) {
            const { messages, total_conversations, first_contact, last_contact } = historyResponse.data.data;
            
            // Update selected conversation with full history info
            setSelectedConversation({
              ...conversation,
              total_conversations,
              first_contact,
              last_contact
            });
            
            // For better UX, only show recent messages initially (last 30-50 messages)
            // This prevents long scroll animations on conversations with extensive history
            const INITIAL_MESSAGE_COUNT = 30;
            const recentMessages = messages.length > INITIAL_MESSAGE_COUNT 
              ? messages.slice(-INITIAL_MESSAGE_COUNT) 
              : messages;
            
            // Set recent messages only
            setMessages(recentMessages);
            
            // Store full history and track if there are more messages
            setFullMessageHistory(messages);
            setHasMoreMessages(messages.length > INITIAL_MESSAGE_COUNT);
            
            // Mark as read using shared context
            await markConversationAsRead(conversation.phone_number);
            
            // Update local state
            setConversations(prev => prev.map(c => 
              c.id === conversation.id ? { ...c, unread_count: 0 } : c
            ));
            
            // Instantly jump to bottom (no animation for initial load)
            setTimeout(() => {
              scrollToBottom('instant');
            }, 50);
          }
        }
      } catch (error) {
        console.error('Error fetching conversation history:', error);
        toast.error('Failed to load conversation history');
        
        // Fallback to local messages if API fails
        const conversationMessages = Array.isArray(conversation.messages) ? conversation.messages : [];
        const uniqueMessages = conversationMessages.reduce((acc: Message[], msg: Message) => {
          if (!acc.find(m => m.id === msg.id)) {
            acc.push(msg);
          }
          return acc;
        }, []);
        setMessages(uniqueMessages);
      }
    }
  };

  const loadMoreMessages = () => {
    if (!hasMoreMessages || loadingMoreMessages) return;
    
    setLoadingMoreMessages(true);
    
    // Calculate how many messages to load
    const currentMessageCount = messages.length;
    const LOAD_MORE_COUNT = 20;
    const totalAvailable = fullMessageHistory.length;
    const remainingCount = totalAvailable - currentMessageCount;
    const toLoadCount = Math.min(LOAD_MORE_COUNT, remainingCount);
    
    // Get the older messages
    const startIndex = totalAvailable - currentMessageCount - toLoadCount;
    const endIndex = totalAvailable - currentMessageCount;
    const olderMessages = fullMessageHistory.slice(startIndex, endIndex);
    
    // Prepend older messages to current messages
    setMessages([...olderMessages, ...messages]);
    
    // Check if there are still more messages
    setHasMoreMessages(startIndex > 0);
    setLoadingMoreMessages(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !selectedConversation.phone_number || sending) {
      if (!selectedConversation?.phone_number) {
        toast.error('Cannot send message: No phone number available');
      }
      return;
    }
    
    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX
    
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) {
        toast.error('Session expired. Please log in again.');
        router.push('/login');
        return;
      }
      
      const response = await axios.post(
        `${API_URL}/messages/send`,
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
        // Add message to local state
        const sentMessage: Message = {
          id: response.data.data.id,
          text: messageText,
          from: response.data.data.from || '',
          to: selectedConversation.phone_number,
          direction: 'outbound',
          createdAt: new Date().toISOString(),
          status: 'sent'
        };
        
        // Add message to local state only once
        setMessages(prev => [...prev, sentMessage]);
        
        // Scroll to bottom after sending
        setTimeout(scrollToBottom, 100);
        
        // Delay refresh to allow backend to process
        setTimeout(() => {
          loadConversations();
        }, 1000);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setNewMessage(messageText); // Restore message on error
      
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to send message';
      
      toast.error(errorMessage);
      
      if (error.response?.status === 401) {
        toast.error('Session expired. Please log in again.');
        router.push('/login');
      }
    } finally {
      setSending(false);
    }
  };

  const getAiSuggestion = async () => {
    if (!selectedConversation || loadingSuggestion) return;
    
    setLoadingSuggestion(true);
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) {
        toast.error('Please log in again');
        return;
      }
      
      const response = await axios.post(
        `${API_URL}/messages/conversations/${selectedConversation.phone_number}/suggest-response`,
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
        toast.success('AI suggestion generated');
      }
    } catch (error: any) {
      console.error('Failed to get AI suggestion:', error);
      toast.error(error.response?.data?.error || 'Failed to generate suggestion');
    } finally {
      setLoadingSuggestion(false);
    }
  };
  
  const sendAiSuggestion = async (suggestionId: string, editedText?: string) => {
    setSending(true);
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) {
        toast.error('Please log in again');
        return;
      }
      
      const response = await axios.post(
        `${API_URL}/messages/suggestions/${suggestionId}/approve-and-send`,
        { editedText },
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
        
        // Add the sent message to local state immediately
        const sentText = editedText || aiSuggestion?.suggestedText || '';
        const sentMessage: Message = {
          id: response.data.data.messageId || Date.now().toString(),
          text: sentText,
          from: '', // Will be filled by backend
          to: selectedConversation?.phone_number || '',
          direction: 'outbound',
          createdAt: new Date().toISOString(),
          status: 'sent'
        };
        
        // Add message to local state only once
        setMessages(prev => [...prev, sentMessage]);
        
        // Scroll to bottom
        setTimeout(scrollToBottom, 100);
        
        // Delay refresh to allow backend to process
        setTimeout(() => {
          loadConversations();
        }, 1000);
      }
    } catch (error: any) {
      console.error('Failed to send AI suggestion:', error);
      toast.error(error.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Removed pull-to-refresh handlers for better native feel

  const formatMessageDate = (date: string) => {
    const messageDate = new Date(date);
    
    if (isToday(messageDate)) {
      return format(messageDate, 'h:mm a');
    } else if (isYesterday(messageDate)) {
      return `Yesterday ${format(messageDate, 'h:mm a')}`;
    } else {
      return format(messageDate, 'MMM d, h:mm a');
    }
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
        <meta name="description" content="OpenPhone SMS messaging interface" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </Head>

      <div className={`min-h-screen bg-[var(--bg-primary)] transition-all duration-300 ${remoteActionsBar.className}`}>
        {/* Desktop Layout - Standard ClubOS design */}
        <div className="hidden md:block">
          <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
            {/* Header Section */}
            <div className="mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
                    Messages
                  </h1>
                  <p className="text-[var(--text-secondary)] text-sm font-light">
                    Send and receive SMS messages with customers via OpenPhone
                  </p>
                </div>
                
                {/* Push Notification Toggle */}
                <div className="flex items-center gap-2">
                  {!isClient ? (
                    // Server-side placeholder to prevent hydration mismatch
                    <div className="px-4 py-2 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)]">
                      <span className="text-sm text-[var(--text-muted)]">Loading...</span>
                    </div>
                  ) : isInIframe && !isSubscribed ? (
                    // In iframe - show pop-out button for notifications
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/messages`;
                        const newWindow = window.open(url, 'clubos-messages', 'width=1200,height=800,toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes');
                        
                        if (newWindow) {
                          toast('Opening ClubOS in a new window to enable notifications', {
                            duration: 5000,
                            icon: '🔔'
                          });
                        } else {
                          toast.error('Please allow pop-ups to enable notifications');
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/90 transition-colors"
                      title="Open in new window for notifications"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="text-sm">Enable Notifications</span>
                    </button>
                  ) : !isSupported ? null : notificationLoading ? (
                    <div className="px-4 py-2 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)]">
                      <span className="text-sm text-[var(--text-muted)]">Loading...</span>
                    </div>
                  ) : isSubscribed ? (
                    <button
                      onClick={unsubscribe}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      title="Disable push notifications"
                    >
                      <Bell className="w-4 h-4" />
                      <span className="text-sm">Notifications On</span>
                    </button>
                  ) : (
                    <button
                      onClick={subscribe}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-muted)] rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      title="Enable push notifications"
                    >
                      <BellOff className="w-4 h-4" />
                      <span className="text-sm">Notifications Off</span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Quick Actions Bar - Desktop */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => router.push('/tickets?create=true')}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors text-sm"
                  title="Create new ticket"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Ticket</span>
                </button>
                
                <button
                  onClick={() => window.open('https://clubhouse247golf.skedda.com/booking', '_blank')}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors text-sm"
                  title="Check booking site"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Bookings</span>
                </button>
                
                <button
                  onClick={() => {
                    // Check if on mobile device
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    
                    if (isMobile) {
                      // On mobile, try to open the Splashtop app
                      // Using a hidden iframe method which is more reliable
                      // Use simple URL scheme for all mobile platforms
                      // st-business:// is the correct scheme for Splashtop Business app
                      window.location.href = 'st-business://com.splashtop.business';
                      
                      // Fallback: After a short delay, if user is still here, open web version
                      setTimeout(() => {
                        // Check if page is still visible (app didn't open)
                        if (!document.hidden) {
                          window.location.href = 'https://my.splashtop.com/computers';
                        }
                      }, 2500);
                    } else {
                      // On desktop, open web interface
                      window.open('https://my.splashtop.com/computers', '_blank');
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg border border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors text-sm"
                  title="Remote control simulators"
                >
                  <Monitor className="w-4 h-4" />
                  <span>Control</span>
                </button>
              </div>
            </div>

            {/* Messages Interface */}
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] overflow-hidden">
              <div className={`grid grid-cols-3 transition-all duration-300 ${remoteActionsBar.isVisible ? 'h-[calc(100vh-290px)]' : 'h-[calc(100vh-240px)]'}`}>
                
                {/* Conversations List */}
                <div className="border-r border-[var(--border-secondary)] overflow-y-auto">
                  {/* Search */}
                  <div className="p-4 border-b border-[var(--border-secondary)]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        placeholder="Search by name or number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  {/* Conversation Items */}
                  <div className="divide-y divide-[var(--border-secondary)]">
                    {loading ? (
                      <div className="p-4 text-center text-[var(--text-muted)]">
                        Loading conversations...
                      </div>
                    ) : filteredConversations.length === 0 ? (
                      <div className="p-4 text-center text-[var(--text-muted)]">
                        No conversations found
                      </div>
                    ) : (
                      filteredConversations.map(conv => (
                        <div
                          key={conv.id}
                          onClick={() => selectConversation(conv)}
                          className={`p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-all duration-200 ease-out transform hover:translate-x-1 ${
                            selectedConversation?.id === conv.id ? 'bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)]' : 'border-l-4 border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-0.5 border border-gray-300 rounded text-xs font-medium text-gray-600">
                                {conv.bay ? `B${conv.bay}` : conv.location ? conv.location.substring(0, 3).toUpperCase() : 'GEN'}
                              </div>
                              <span className="font-medium text-sm">
                                {conv.customer_name || 'Unknown'}
                              </span>
                              {conv._debug_invalid_phone && (
                                <span className="text-xs text-red-500">[Invalid]</span>
                              )}
                            </div>
                            {conv.unread_count > 0 && (
                              <span className="bg-[var(--accent)] text-white text-xs px-2 py-0.5 rounded-full">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                          {conv.phone_number && (
                            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-2">
                              <Phone className="w-3 h-3" />
                              <span>{conv.phone_number}</span>
                            </div>
                          )}
                          {conv.lastMessage && (conv.lastMessage.text || conv.lastMessage.body) && (
                            <p className="text-xs text-[var(--text-secondary)] truncate">
                              {conv.lastMessage.direction === 'outbound' && 'You: '}
                              {conv.lastMessage.text || conv.lastMessage.body}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                            <span className="text-xs text-[var(--text-muted)]">
                              {!isClient ? 'Recently' : conv.updated_at ? formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true }) : 'Recently'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Messages Area */}
                <div className="col-span-2 flex flex-col h-full overflow-hidden">
                  {selectedConversation ? (
                    <>
                      {/* Conversation Header */}
                      <div className="p-4 border-b border-[var(--border-secondary)]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="px-3 py-1.5 border border-gray-300 rounded-lg">
                              <span className="text-sm font-medium text-gray-600">
                                {selectedConversation.bay ? `Bay ${selectedConversation.bay}` : selectedConversation.location ? selectedConversation.location : 'General'}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold">{selectedConversation.customer_name || 'Unknown'}</h3>
                              <p className="text-sm text-[var(--text-muted)]">
                                {selectedConversation.phone_number || 'No phone number'}
                                {selectedConversation.total_conversations && selectedConversation.total_conversations > 1 && (
                                  <span className="ml-2 text-xs bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">
                                    {selectedConversation.total_conversations} conversations
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${selectedConversation.phone_number}`}
                              className="p-2 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                              title="Call customer"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Messages */}
                      <div ref={desktopMessagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col">
                        {/* Load More Messages Button */}
                        {hasMoreMessages && (
                          <div className="text-center mb-4">
                            <button
                              onClick={loadMoreMessages}
                              disabled={loadingMoreMessages}
                              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors inline-flex items-center gap-2"
                            >
                              {loadingMoreMessages ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <Clock className="w-4 h-4" />
                                  Load earlier messages
                                </>
                              )}
                            </button>
                          </div>
                        )}
                        
                        {/* Spacer to push messages to bottom when few messages */}
                        <div className="flex-1 min-h-0" />
                        <div className="space-y-4">
                        {messages && messages.length > 0 ? messages.map((message, index) => {
                          // Handle conversation separators
                          if (message.type === 'conversation_separator') {
                            return (
                              <div key={message.id || `separator-${index}`} className="flex items-center gap-3 py-4">
                                <div className="flex-1 h-px bg-[var(--bg-tertiary)]" />
                                <div className="text-xs text-[var(--text-muted)] px-3 py-1 bg-[var(--bg-secondary)] rounded-full">
                                  New conversation • {message.timeSinceLastMessage} min later
                                </div>
                                <div className="flex-1 h-px bg-[var(--bg-tertiary)]" />
                              </div>
                            );
                          }
                          
                          // Regular message rendering
                          return (
                            <div
                              key={message.id || index}
                              className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[70%] ${
                                message.direction === 'outbound'
                                  ? 'bg-[var(--accent)] text-white'
                                  : 'bg-[var(--bg-tertiary)]'
                              } rounded-lg px-4 py-2`}>
                                <p className="text-sm">{message.text || message.body || ''}</p>
                                <p className={`text-xs mt-1 ${
                                  message.direction === 'outbound' ? 'text-white/70' : 'text-[var(--text-muted)]'
                                }`}>
                                  {isClient && message.createdAt ? format(new Date(message.createdAt), 'h:mm a') : ''}
                                </p>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="text-center text-[var(--text-muted)] py-8">
                            <p>No messages yet. Send a message to start the conversation.</p>
                          </div>
                        )}
                        </div>
                        <div ref={messagesEndRef} />
                      </div>

                      {/* AI Suggestion */}
                      {showAiSuggestion && aiSuggestion && (
                        <div className="p-4 border-t border-[var(--border-secondary)] bg-[var(--bg-tertiary)]">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className={`w-4 h-4 ${aiSuggestion.confidence < 0.5 ? 'text-yellow-500' : 'text-[var(--accent)]'}`} />
                              <span className="text-sm font-medium">AI Suggestion</span>
                              <span className={`text-xs ${aiSuggestion.confidence < 0.5 ? 'text-yellow-600 font-semibold' : 'text-[var(--text-muted)]'}`}>
                                ({Math.round(aiSuggestion.confidence * 100)}% confidence)
                              </span>
                              {aiSuggestion.confidence < 0.5 && (
                                <span className="text-xs text-yellow-600 font-medium">
                                  - Human review recommended
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setShowAiSuggestion(false);
                                setAiSuggestion(null);
                              }}
                              className="p-1 hover:bg-[var(--bg-secondary)] rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {editingSuggestion ? (
                            <textarea
                              value={editedSuggestionText}
                              onChange={(e) => setEditedSuggestionText(e.target.value)}
                              className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm mb-2"
                              rows={3}
                            />
                          ) : (
                            <p className="text-sm mb-2">{aiSuggestion.suggestedText}</p>
                          )}
                          
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                if (editingSuggestion) {
                                  await sendAiSuggestion(aiSuggestion.id, editedSuggestionText);
                                } else {
                                  await sendAiSuggestion(aiSuggestion.id);
                                }
                              }}
                              className="flex items-center gap-2 px-3 py-1 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 text-sm"
                              disabled={sending}
                            >
                              <Check className="w-3 h-3" />
                              Send
                            </button>
                            
                            <button
                              onClick={() => {
                                setEditingSuggestion(!editingSuggestion);
                                if (!editingSuggestion) {
                                  setEditedSuggestionText(aiSuggestion.suggestedText);
                                }
                              }}
                              className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-primary)] text-sm"
                            >
                              <Edit2 className="w-3 h-3" />
                              {editingSuggestion ? 'Cancel Edit' : 'Edit'}
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Message Input */}
                      <div className="p-4 border-t border-[var(--border-secondary)]">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            sendMessage();
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg"
                            disabled={sending}
                          />
                          <button
                            type="button"
                            onClick={getAiSuggestion}
                            disabled={loadingSuggestion || !selectedConversation || messages.length === 0}
                            className="px-3 py-2 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50 transition-colors flex items-center gap-2"
                            title="Get AI suggestion"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>AI</span>
                          </button>
                          
                          <button
                            type="submit"
                            disabled={!newMessage.trim() || sending}
                            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            <span>Send</span>
                          </button>
                        </form>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Select a conversation to start messaging</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Layout - Standard messaging app layout */}
        <div className={`md:hidden flex flex-col bg-[var(--bg-primary)] transition-all duration-300 ${remoteActionsBar.isVisible ? 'h-[calc(100vh-48px)]' : 'h-screen'}`}>
          {/* Header - Fixed at top */}
          <div className="flex-shrink-0 bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-[var(--text-primary)]">Messages</h1>
                
                {/* Push Notification Toggle */}
                {isClient && isSupported && (
                  <button
                    onClick={() => {
                      // If in iframe and not subscribed, open in new window
                      if (isInIframe && !isSubscribed) {
                        const url = `${window.location.origin}/messages`;
                        const newWindow = window.open(url, 'clubos-messages', 'width=1200,height=800,toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes');
                        
                        if (newWindow) {
                          toast('Opening ClubOS in a new window to enable notifications', {
                            duration: 5000,
                            icon: '🔔'
                          });
                        } else {
                          toast.error('Please allow pop-ups to enable notifications');
                        }
                      } else {
                        // Normal toggle
                        isSubscribed ? unsubscribe() : subscribe();
                      }
                    }}
                    className="p-2 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
                    disabled={notificationLoading}
                    title={isInIframe && !isSubscribed ? "Open in new window for notifications" : (isSubscribed ? "Disable notifications" : "Enable notifications")}
                  >
                    {notificationLoading ? (
                      <RefreshCw className="w-5 h-5 text-[var(--text-muted)] animate-spin" />
                    ) : isSubscribed ? (
                      <Bell className="w-5 h-5 text-[var(--accent)]" />
                    ) : isInIframe ? (
                      <ExternalLink className="w-5 h-5 text-[var(--text-muted)]" />
                    ) : (
                      <BellOff className="w-5 h-5 text-[var(--text-muted)]" />
                    )}
                  </button>
                )}
              </div>
              
              {/* Quick Actions Bar - Mobile */}
              <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                <button
                  onClick={() => router.push('/tickets?create=true')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-secondary)] rounded-lg border border-[var(--border-primary)] whitespace-nowrap text-sm"
                  title="Create new ticket"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ticket</span>
                </button>
                
                <button
                  onClick={() => window.open('https://clubhouse247golf.skedda.com/booking', '_blank')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-secondary)] rounded-lg border border-[var(--border-primary)] whitespace-nowrap text-sm"
                  title="Check booking site"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Bookings</span>
                </button>
                
                <button
                  onClick={() => {
                    // Check if on mobile device
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    
                    if (isMobile) {
                      // On mobile, try to open the Splashtop app
                      // Using a hidden iframe method which is more reliable
                      // Use simple URL scheme for all mobile platforms
                      // st-business:// is the correct scheme for Splashtop Business app
                      window.location.href = 'st-business://com.splashtop.business';
                      
                      // Fallback: After a short delay, if user is still here, open web version
                      setTimeout(() => {
                        // Check if page is still visible (app didn't open)
                        if (!document.hidden) {
                          window.location.href = 'https://my.splashtop.com/computers';
                        }
                      }, 2500);
                    } else {
                      // On desktop, open web interface
                      window.open('https://my.splashtop.com/computers', '_blank');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-secondary)] rounded-lg border border-[var(--border-primary)] whitespace-nowrap text-sm"
                  title="Remote control simulators"
                >
                  <Monitor className="w-4 h-4" />
                  <span>Control</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area - Flex container */}
          <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
            {/* Conversations List - Mobile optimized */}
            <div className={`${selectedConversation ? 'hidden' : 'flex'} flex-col w-full`}>
              {/* Search */}
              <div className="flex-shrink-0 p-3 border-b border-[var(--border-secondary)]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-full text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Conversation List */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto"
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: 'env(safe-area-inset-bottom, 20px)'
                }}
              >
                {/* Removed pull to refresh for better native feel */}

                {/* Conversations */}
                {loading && !refreshing ? (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                    Loading conversations...
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No conversations found</p>
                  </div>
                ) : (
                  <>
                    {filteredConversations.map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => selectConversation(conv)}
                        className={`p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] active:bg-[var(--bg-tertiary)] transition-all duration-200 ease-out ${
                          selectedConversation?.id === conv.id ? 'bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)]' : 'border-l-4 border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[var(--text-primary)] truncate">
                                {conv.customer_name || 'Unknown'}
                              </span>
                              {conv.unread_count > 0 && (
                                <span className="bg-[var(--accent)] text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                                  {conv.unread_count}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-muted)] truncate">
                              {conv.phone_number}
                            </p>
                          </div>
                          <span className="text-xs text-[var(--text-muted)] ml-2 flex-shrink-0">
                            {isClient && conv.updated_at ? formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true }) : ''}
                          </span>
                        </div>
                        {conv.lastMessage && (conv.lastMessage.text || conv.lastMessage.body) && (
                          <p className="text-sm text-[var(--text-secondary)] truncate">
                            {conv.lastMessage.direction === 'outbound' && <span className="text-[var(--text-muted)]">You: </span>}
                            {conv.lastMessage.text || conv.lastMessage.body}
                          </p>
                        )}
                      </div>
                    ))}
                    {/* Spacer to ensure last item is visible */}
                    <div className="h-20" />
                  </>
                )}
              </div>
            </div>

            {/* Messages Area - Mobile optimized */}
            <div className={`${selectedConversation ? 'flex' : 'hidden'} flex-col flex-1 bg-[var(--bg-primary)]`}>
              {selectedConversation && (
                <>
                  {/* Conversation Header - Mobile optimized */}
                  <div className="flex-shrink-0 bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={() => setSelectedConversation(null)}
                          className="p-1 -ml-1 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div className="px-2 py-0.5 border border-gray-300 rounded text-xs font-medium text-gray-600 mr-2">
                          {selectedConversation.bay ? `B${selectedConversation.bay}` : selectedConversation.location ? selectedConversation.location.substring(0, 3).toUpperCase() : 'GEN'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-[var(--text-primary)] truncate">
                            {selectedConversation.customer_name || 'Unknown'}
                          </h3>
                          <p className="text-xs text-[var(--text-muted)]">
                            {selectedConversation.phone_number}
                            {selectedConversation.total_conversations && selectedConversation.total_conversations > 1 && (
                              <span className="ml-1 bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[10px]">
                                {selectedConversation.total_conversations} chats
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <a
                        href={`tel:${selectedConversation.phone_number}`}
                        className="p-2 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
                        title="Call customer"
                      >
                        <Phone className="w-5 h-5 text-[var(--accent)]" />
                      </a>
                    </div>
                  </div>

                  {/* Messages - Mobile optimized with better spacing */}
                  <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    {/* Load More Messages Button - Mobile */}
                    {hasMoreMessages && (
                      <div className="text-center mb-3">
                        <button
                          onClick={loadMoreMessages}
                          disabled={loadingMoreMessages}
                          className="px-3 py-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-full inline-flex items-center gap-2 active:scale-95 transition-transform"
                        >
                          {loadingMoreMessages ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              Load earlier messages
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* Spacer to push messages to bottom when few messages */}
                    <div className="flex-1 min-h-0" />
                    {messages && messages.length > 0 ? (
                      <div className="space-y-3">
                        {messages.map((message, index) => {
                          // Handle conversation separators
                          if (message.type === 'conversation_separator') {
                            return (
                              <div key={message.id || `separator-${index}`} className="flex items-center gap-2 py-3">
                                <div className="flex-1 h-px bg-[var(--bg-tertiary)]" />
                                <div className="text-xs text-[var(--text-muted)] px-2 py-1 bg-[var(--bg-primary)] rounded-full whitespace-nowrap">
                                  New chat • {message.timeSinceLastMessage}m later
                                </div>
                                <div className="flex-1 h-px bg-[var(--bg-tertiary)]" />
                              </div>
                            );
                          }
                          
                          // Regular message rendering
                          return (
                            <div
                              key={message.id || index}
                              className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[85%] ${
                                message.direction === 'outbound'
                                  ? 'bg-[var(--accent)] text-white rounded-2xl rounded-br-sm'
                                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-2xl rounded-bl-sm'
                              } px-4 py-2 shadow-sm`}>
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {message.text || message.body || ''}
                                </p>
                                <p className={`text-xs mt-1 ${
                                  message.direction === 'outbound' ? 'text-white/70' : 'text-[var(--text-muted)]'
                                }`}>
                                  {isClient && message.createdAt ? formatMessageDate(message.createdAt) : ''}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-center text-[var(--text-muted)] px-8">
                        <div>
                          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p className="text-sm">No messages yet</p>
                          <p className="text-xs mt-1">Send a message to start the conversation</p>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* AI Suggestion - Mobile optimized */}
                  {showAiSuggestion && aiSuggestion && (
                    <div className="flex-shrink-0 border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className={`w-4 h-4 ${aiSuggestion.confidence < 0.5 ? 'text-yellow-500' : 'text-[var(--accent)]'}`} />
                          <span className="text-sm font-medium">AI Suggestion</span>
                          <span className={`text-xs ${aiSuggestion.confidence < 0.5 ? 'text-yellow-600 font-semibold' : 'text-[var(--text-muted)]'}`}>
                            {Math.round(aiSuggestion.confidence * 100)}%
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setShowAiSuggestion(false);
                            setAiSuggestion(null);
                          }}
                          className="p-1 -mr-1 rounded-full hover:bg-[var(--bg-tertiary)]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {editingSuggestion ? (
                        <textarea
                          value={editedSuggestionText}
                          onChange={(e) => setEditedSuggestionText(e.target.value)}
                          className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm mb-3 resize-none focus:outline-none focus:border-[var(--accent)]"
                          rows={3}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm mb-3 p-3 bg-[var(--bg-primary)] rounded-lg">
                          {aiSuggestion.suggestedText}
                        </p>
                      )}
                      
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            if (editingSuggestion) {
                              await sendAiSuggestion(aiSuggestion.id, editedSuggestionText);
                            } else {
                              await sendAiSuggestion(aiSuggestion.id);
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--accent)] text-white rounded-lg font-medium text-sm active:scale-95 transition-transform"
                          disabled={sending}
                        >
                          <Check className="w-4 h-4" />
                          Send
                        </button>
                        
                        <button
                          onClick={() => {
                            setEditingSuggestion(!editingSuggestion);
                            if (!editingSuggestion) {
                              setEditedSuggestionText(aiSuggestion.suggestedText);
                            }
                          }}
                          className="px-4 py-2.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg font-medium text-sm active:scale-95 transition-transform"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Message Input - Mobile optimized */}
                  <div className="flex-shrink-0 border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3 transition-all duration-300" style={{ paddingBottom: remoteActionsBar.isVisible ? 'calc(3rem + env(safe-area-inset-bottom))' : 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendMessage();
                      }}
                      className="flex gap-2 items-end"
                    >
                      <button
                        type="button"
                        onClick={getAiSuggestion}
                        disabled={loadingSuggestion || !selectedConversation || messages.length === 0}
                        className="p-2.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-full active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
                        title="Get AI suggestion"
                      >
                        <Sparkles className="w-5 h-5" />
                      </button>
                      
                      <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-full text-base focus:outline-none focus:border-[var(--accent)]"
                        disabled={sending}
                        style={{ fontSize: '16px' }} // Prevents zoom on iOS
                      />
                      
                      <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="p-3 bg-[var(--accent)] text-white rounded-full disabled:opacity-50"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}