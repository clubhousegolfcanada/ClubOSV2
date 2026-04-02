import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { MessageCircle, Send, Search, Phone, PhoneOff, Clock, ArrowLeft, Bell, BellOff, Sparkles, Check, X, Edit2, ChevronLeft, RefreshCw, ExternalLink, Plus, Monitor, Calendar, Ticket } from 'lucide-react';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useRemoteActionsBar } from '@/hooks/useRemoteActionsBar';
import { useMessages } from '@/contexts/MessagesContext';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';
import OperatorLayout from '@/components/OperatorLayout';
import SubNavigation, { SubNavAction } from '@/components/SubNavigation';


interface Message {
  id: string;
  text?: string;
  body?: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  createdAt: string;
  timestamp?: string;
  status?: string;
  type?: string; // 'conversation_separator' | 'call' | 'call_transcript' | 'call_summary' | 'call_recording' | message event types
  duration?: number;
  transcript?: string;
  summary?: string;
  recording?: string;
  recordingUrl?: string;
  timeSinceLastMessage?: number;
}

interface Conversation {
  id: string;
  phone_number: string;
  customer_name: string;
  messages?: Message[]; // Optional — not included in lightweight list response
  unread_count: number;
  updated_at: string;
  lastMessage?: Message;
  messageHistory?: any[];
  messageCount?: number;
  _debug_invalid_phone?: boolean;
  total_conversations?: number;
  first_contact?: string;
  last_contact?: string;
  location?: string;
  bay?: string;
  clubai_escalated?: boolean;
  customer_sentiment?: string;
  conversation_locked?: boolean;
}

// Helper function to check if two conversations are effectively the same (for UI purposes)
const conversationsEqual = (conv1: Conversation | null, conv2: Conversation | null): boolean => {
  if (!conv1 || !conv2) return conv1 === conv2;

  // Only compare properties that affect UI rendering, not the entire object
  return (
    conv1.id === conv2.id &&
    conv1.phone_number === conv2.phone_number &&
    conv1.customer_name === conv2.customer_name &&
    conv1.unread_count === conv2.unread_count &&
    conv1.updated_at === conv2.updated_at &&
    conv1.clubai_escalated === conv2.clubai_escalated &&
    conv1.customer_sentiment === conv2.customer_sentiment
  );
};

// Memoized conversation item component to prevent unnecessary re-renders
interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  formatDistance: (date: Date) => string;
  isClient: boolean;
}

const ConversationItem = memo<ConversationItemProps>(({
  conversation,
  isSelected,
  onClick,
  formatDistance,
  isClient
}) => {
  const needsAttention = conversation.clubai_escalated || conversation.customer_sentiment === 'escalated' || conversation.customer_sentiment === 'needs_attention';
  return (
  <div
    onClick={onClick}
    className={`p-2.5 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-all duration-200 ease-out transform hover:translate-x-0.5 ${
      needsAttention
        ? 'bg-red-50 dark:bg-red-900/15 border-l-4 border-red-500'
        : isSelected ? 'bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)]' : 'border-l-4 border-transparent'
    }`}
  >
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-1.5 min-w-0">
        <div className={`px-1.5 py-0.5 border rounded text-[10px] font-medium flex-shrink-0 ${
          needsAttention ? 'border-red-400 text-red-600 dark:text-red-400' : 'border-gray-300 text-gray-600'
        }`}>
          {conversation.bay ? `B${conversation.bay}` : conversation.location ? conversation.location.substring(0, 3).toUpperCase() : 'GEN'}
        </div>
        <span className="font-medium text-xs truncate">
          {conversation.customer_name || 'Unknown'}
        </span>
        {needsAttention && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-semibold flex-shrink-0">
            NEEDS HUMAN
          </span>
        )}
      </div>
      {conversation.unread_count > 0 && (
        <span className={`text-white text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1 ${
          needsAttention ? 'bg-red-500' : 'bg-[var(--accent)]'
        }`}>
          {conversation.unread_count}
        </span>
      )}
    </div>
    <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] mt-1">
      <Phone className="w-2.5 h-2.5" />
      <span>{conversation.phone_number}</span>
      <span className="ml-auto">
        {!isClient ? '•' : conversation.updated_at ? formatDistance(new Date(conversation.updated_at)) : '•'}
      </span>
    </div>
    {conversation.lastMessage && (
      <p className="text-[11px] text-[var(--text-secondary)] truncate mt-1 flex items-center gap-1">
        {conversation.lastMessage.type === 'call' || conversation.lastMessage.type === 'call_transcript' || conversation.lastMessage.type === 'call_summary' ? (
          <>
            <PhoneOff className="w-3 h-3 text-purple-500 flex-shrink-0" />
            <span className="text-purple-500 font-medium">
              {conversation.lastMessage.type === 'call_transcript' ? 'Voicemail' : conversation.lastMessage.type === 'call_summary' ? 'Call Summary' : 'Missed Call'}
            </span>
          </>
        ) : (
          <>
            {conversation.lastMessage.direction === 'outbound' && '↗ '}
            {conversation.lastMessage.text || conversation.lastMessage.body || ''}
          </>
        )}
      </p>
    )}
  </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  return conversationsEqual(prevProps.conversation, nextProps.conversation) &&
         prevProps.isSelected === nextProps.isSelected &&
         prevProps.isClient === nextProps.isClient;
});

// Helper function to check if messages array has meaningful changes
const messagesHaveChanged = (oldMessages: Message[], newMessages: Message[]): boolean => {
  if (oldMessages.length !== newMessages.length) return true;

  // Check if any message ID or content is different
  return newMessages.some((msg, idx) => {
    const oldMsg = oldMessages[idx];
    return !oldMsg ||
           msg.id !== oldMsg.id ||
           msg.text !== oldMsg.text ||
           msg.body !== oldMsg.body ||
           msg.status !== oldMsg.status;
  });
};

export default function Messages() {
  const { user } = useAuthState();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Use refs to avoid stale closure issues with setInterval
  const selectedConversationRef = useRef<Conversation | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const loadConversationsRef = useRef<(showRefreshIndicator?: boolean) => Promise<void>>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const historyAbortRef = useRef<AbortController | null>(null);
  // Cache: phone -> { messages, updatedAt, fetchedAt } to skip re-fetching unchanged conversations
  const historyCache = useRef<Map<string, { messages: Message[]; meta: any; updatedAt: string; fetchedAt: number }>>(new Map());

  // Keep refs in sync with state
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  
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
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  
  // Track keyboard visibility on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleFocus = () => {
      setKeyboardVisible(true);
      // Ensure input is visible when keyboard appears
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    };
    
    const handleBlur = () => {
      setKeyboardVisible(false);
    };
    
    // Only for mobile
    if (window.innerWidth < 768) {
      document.addEventListener('focusin', handleFocus);
      document.addEventListener('focusout', handleBlur);
      
      return () => {
        document.removeEventListener('focusin', handleFocus);
        document.removeEventListener('focusout', handleBlur);
      };
    }
  }, []);
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
    let isMounted = true;
    let eventSource: EventSource | null = null;

    // Initial load
    if (loadConversationsRef.current) {
      loadConversationsRef.current();
    }

    // Connect to Server-Sent Events for real-time message updates
    const connectSSE = () => {
      const token = tokenManager.getToken();
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      eventSource = new EventSource(`${apiUrl}/api/messages/events?token=${token}`);

      eventSource.addEventListener('new_message', () => {
        if (isTabVisible && isMounted && loadConversationsRef.current) {
          loadConversationsRef.current(false);
        }
      });

      eventSource.addEventListener('conversation_update', () => {
        if (isTabVisible && isMounted && loadConversationsRef.current) {
          loadConversationsRef.current(false);
        }
      });

      eventSource.onerror = () => {
        // SSE disconnected — fallback polling will cover it
        logger.debug('SSE connection error, relying on fallback polling');
      };
    };

    connectSSE();

    // Fallback polling every 30s (SSE handles real-time, this is safety net)
    const FALLBACK_POLL_INTERVAL = 30000;

    const startRefresh = () => {
      if (interval) {
        clearInterval(interval);
      }

      interval = setInterval(() => {
        if (isTabVisible && isMounted && loadConversationsRef.current) {
          loadConversationsRef.current(false);
        }
      }, FALLBACK_POLL_INTERVAL);

      if (isMounted) {
        setRefreshInterval(interval);
      }
    };

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;

      if (isTabVisible && isMounted && loadConversationsRef.current) {
        loadConversationsRef.current(false);
      }
    };

    startRefresh();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
      if (eventSource) {
        eventSource.close();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      abortControllerRef.current?.abort();
      historyAbortRef.current?.abort();
    };
  }, []); // Empty dependencies - we use the ref

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

  // Store loadConversations in ref to avoid stale closures
  const loadConversations = useCallback(async (showRefreshIndicator = false) => {
    // Skip if rate limited
    if (isRateLimited) {
      logger.debug('Skipping refresh - rate limited');
      return;
    }

    if (showRefreshIndicator) {
      setRefreshing(true);
    }

    try {
      const token = tokenManager.getToken();
      if (!token) {
        logger.error('No auth token found');
        toast.error('Please log in again');
        router.push('/login');
        return;
      }

      // Abort any in-flight conversation request before starting new one
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const response = await http.get(`messages/conversations`, {
        params: { limit: 15 },
        signal: abortControllerRef.current.signal
      });

      if (response.data.success) {
        logger.debug('Loaded conversations:', response.data.data);

        // Use functional setState to always have current state
        setConversations(prevConversations => {
          // Sort conversations but maintain stable order for unchanged items
          const sortedConversations = response.data.data.sort((a: any, b: any) => {
            const aTime = new Date(a.updated_at || a.created_at).getTime();
            const bTime = new Date(b.updated_at || b.created_at).getTime();

            // If times are very close (within 1 second), maintain existing order
            if (Math.abs(aTime - bTime) < 1000) {
              // Find their current positions in previous conversations
              const aIndex = prevConversations.findIndex(c => c.id === a.id);
              const bIndex = prevConversations.findIndex(c => c.id === b.id);

              // If both exist, maintain their relative order
              if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
              }
            }

            return bTime - aTime;
          });

          // Check if conversations actually changed to prevent unnecessary re-renders
          // Lightweight comparison — no JSON.stringify, just compare key fields
          const hasChanged = prevConversations.length !== sortedConversations.length ||
            prevConversations.some((prev: Conversation, i: number) => {
              const next = sortedConversations[i];
              return prev.id !== next.id ||
                     prev.updated_at !== next.updated_at ||
                     prev.unread_count !== next.unread_count;
            });

          // Only return new array if actually changed
          if (!hasChanged) {
            return prevConversations;
          }

          return sortedConversations;
        });

        // Use refs for checking conditions to avoid stale closure
        const currentSelectedConversation = selectedConversationRef.current;
        const hadConversationsBefore = conversationsRef.current.length > 0;

        // Don't auto-select first conversation — it triggers a heavy /full-history
        // fetch that adds 5-15s to page load. Let the user click what they want.

        // Update selected conversation if it exists (user already clicked one)
        if (currentSelectedConversation) {
          // Normalize phone numbers for comparison (remove any formatting)
          const normalizePhone = (phone: string) => phone ? phone.replace(/\D/g, '') : '';
          const selectedPhone = normalizePhone(currentSelectedConversation.phone_number);
          
          const updated = response.data.data.find((c: Conversation) => 
            normalizePhone(c.phone_number) === selectedPhone
          );
          
          if (updated) {
            // Update selected conversation metadata (not messages — those come from full-history)
            setSelectedConversation(prevConversation => {
              if (!conversationsEqual(prevConversation, updated)) {
                // Preserve any full-history data already loaded
                return { ...updated, messages: prevConversation?.messages };
              }
              return prevConversation;
            });
          } else {
            logger.warn('Could not find updated conversation for phone:', currentSelectedConversation.phone_number);
          }
        }
      } else {
        logger.error('API returned success: false', response.data);
        toast.error(response.data.error || 'Failed to load conversations');
      }
    } catch (error: any) {
      logger.error('Failed to load conversations:', error);
      
      if (error.response?.status === 401) {
        // Session expiry handled by tokenManager interceptor
      } else if (error.response?.status === 404) {
        toast.error('Messages API not found. Please check backend deployment.');
      } else if (error.response?.status === 429) {
        // Rate limited - implement exponential backoff
        setIsRateLimited(true);
        const delay = Math.min((backoffDelay || 5000) * 2, 60000); // Max 1 minute
        setBackoffDelay(delay);
        
        logger.debug(`Rate limited. Backing off for ${delay/1000} seconds`);
        
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
  }, [isRateLimited, router, messages.length, backoffDelay]);

  // Keep the ref updated with the latest function
  useEffect(() => {
    loadConversationsRef.current = loadConversations;
  }, [loadConversations]);

  const selectConversation = useCallback(async (conversation: Conversation) => {
    // Check if switching to a different conversation
    const isSwitchingConversation = selectedConversation?.phone_number !== conversation.phone_number;

    // Only clear messages if switching to a different conversation
    // Keep existing messages visible during refresh of same conversation
    if (isSwitchingConversation) {
      setMessages([]); // Clear messages only when switching conversations
      setFullMessageHistory([]); // Clear full history
      setHasMoreMessages(false); // Reset load more state
    }

    // Fetch conversation history (with client-side cache)
    if (conversation.phone_number) {
      try {
        const token = tokenManager.getToken();
        if (token) {
          const phone = conversation.phone_number;
          const cached = historyCache.current.get(phone);
          const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 min hard expiry
          const cacheValid = cached
            && cached.updatedAt === conversation.updated_at
            && (Date.now() - cached.fetchedAt) < CACHE_MAX_AGE_MS;

          let fetchedMessages: Message[];
          let meta: any;

          if (cacheValid && cached) {
            // Cache hit -- conversation unchanged since last fetch
            fetchedMessages = cached.messages;
            meta = cached.meta;
          } else {
            // Cache miss -- fetch from server
            historyAbortRef.current?.abort();
            historyAbortRef.current = new AbortController();

            const historyResponse = await http.get(
              `messages/conversations/${phone}/full-history`,
              { signal: historyAbortRef.current.signal }
            );

            if (!historyResponse.data.success) {
              setSelectedConversation(conversation);
              return;
            }

            fetchedMessages = historyResponse.data.data.messages;
            meta = {
              total_conversations: historyResponse.data.data.total_conversations,
              first_contact: historyResponse.data.data.first_contact,
              last_contact: historyResponse.data.data.last_contact,
              hasMore: historyResponse.data.data.hasMore,
            };

            // Store in cache
            historyCache.current.set(phone, {
              messages: fetchedMessages,
              meta,
              updatedAt: conversation.updated_at,
              fetchedAt: Date.now(),
            });
          }

          if (true) {
            const { total_conversations, first_contact, last_contact, hasMore } = meta;

            // Update selected conversation with full history info (single update)
            const conversationWithHistory = {
              ...conversation,
              total_conversations,
              first_contact,
              last_contact
            };

            // Set conversation only once with all data
            setSelectedConversation(conversationWithHistory);

            // Show all returned messages (backend now handles limiting to 100)
            const INITIAL_MESSAGE_COUNT = 30;
            const recentMessages = fetchedMessages.length > INITIAL_MESSAGE_COUNT
              ? fetchedMessages.slice(-INITIAL_MESSAGE_COUNT)
              : fetchedMessages;

            // Update messages smoothly - new data replaces old
            setMessages(recentMessages);

            // Store fetched history and track if there are more messages on server
            setFullMessageHistory(fetchedMessages);
            setHasMoreMessages(fetchedMessages.length > INITIAL_MESSAGE_COUNT || hasMore);

            // Mark as read using shared context — pass unread count for instant badge update
            await markConversationAsRead(conversation.phone_number, conversation.unread_count);

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
        logger.error('Error fetching conversation history:', error);
        toast.error('Failed to load conversation history');

        // Set conversation even on error — keep existing messages if any
        setSelectedConversation(conversation);
      }
    } else {
      // If no phone number, still set the conversation
      setSelectedConversation(conversation);
    }

    // Focus input field after selecting conversation (desktop only)
    // Move this to the end so it happens regardless of API success
    setTimeout(() => {
      const desktopInput = document.querySelector('.md\\:block input[placeholder="Type a message..."]') as HTMLInputElement;
      if (desktopInput && window.innerWidth >= 768) {
        desktopInput.focus();
      }
    }, 100);
  }, [selectedConversation, markConversationAsRead, scrollToBottom]);

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
      const token = tokenManager.getToken();
      if (!token) {
        // Session expiry handled by tokenManager interceptor
        return;
      }
      
      const response = await http.post(
        `messages/send`,
        {
          to: selectedConversation.phone_number,
          text: messageText
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
        
        // Invalidate history cache so next select refetches
        historyCache.current.delete(selectedConversation.phone_number);

        // Scroll to bottom after sending
        setTimeout(scrollToBottom, 100);

        // Delay refresh to allow backend to process
        // Only refresh conversations list, not individual messages (they're already updated locally)
        setTimeout(async () => {
          await loadConversations(false); // Silent refresh, no loading indicator
        }, 1500); // Slightly longer delay to ensure backend has processed
      }
    } catch (error: any) {
      logger.error('Failed to send message:', error);
      setNewMessage(messageText); // Restore message on error
      
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          error.message || 
                          'Failed to send message';
      
      toast.error(errorMessage);
      
      if (error.response?.status === 401) {
        // Session expiry handled by tokenManager interceptor
      }
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
        {}
      );
      
      if (response.data.success) {
        setAiSuggestion(response.data.data);
        setShowAiSuggestion(true);
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
      
      const response = await http.post(
        `messages/suggestions/${suggestionId}/approve-and-send`,
        { editedText }
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

        // Invalidate history cache so next select refetches
        if (selectedConversation?.phone_number) {
          historyCache.current.delete(selectedConversation.phone_number);
        }

        // Scroll to bottom
        setTimeout(scrollToBottom, 100);

        // Delay refresh to allow backend to process
        // Only refresh conversations list, not individual messages (they're already updated locally)
        setTimeout(async () => {
          await loadConversations(false); // Silent refresh, no loading indicator
        }, 1500); // Slightly longer delay to ensure backend has processed
      }
    } catch (error: any) {
      logger.error('Failed to send AI suggestion:', error);
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

  // Define actions for SubNavigation
  const actions: SubNavAction[] = [
    {
      id: 'create-ticket',
      label: 'Create Ticket',
      icon: Ticket,
      onClick: () => router.push('/tickets?create=true'),
      variant: 'primary',
      hideOnMobile: true
    },
    {
      id: 'bookings',
      label: 'Bookings',
      icon: Calendar,
      onClick: () => router.push('/bookings'),
      hideOnMobile: true
    },
    {
      id: 'remote-control',
      label: 'Remote Control',
      icon: Monitor,
      onClick: () => {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = 'st-business://com.splashtop.business';
          setTimeout(() => {
            if (!document.hidden) {
              window.location.href = 'https://my.splashtop.com/computers';
            }
          }, 2500);
        } else {
          window.open('https://my.splashtop.com/computers', '_blank');
        }
      },
      hideOnMobile: true
    }
  ];

  // Notification toggle content for right side
  const notificationToggle = (
    <div className="flex items-center space-x-2">
      {!isClient ? (
        // Server-side placeholder to prevent hydration mismatch
        <span className="text-sm text-gray-500">Loading...</span>
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
          className="flex items-center space-x-1 px-3 py-1.5 bg-[var(--accent)] text-white rounded-md hover:bg-opacity-90 transition-all text-sm font-medium"
          title="Open in new window for notifications"
        >
          <ExternalLink className="w-4 h-4" />
          <span className="hidden sm:inline">Enable Notifications</span>
        </button>
      ) : !isSupported ? null : notificationLoading ? (
        <span className="text-sm text-gray-500">Loading...</span>
      ) : isSubscribed ? (
        <button
          onClick={unsubscribe}
          className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-all text-sm font-medium"
          title="Disable push notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="hidden sm:inline">Notifications On</span>
        </button>
      ) : (
        <button
          onClick={subscribe}
          className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-all text-sm font-medium"
          title="Enable push notifications"
        >
          <BellOff className="w-4 h-4" />
          <span className="hidden sm:inline">Enable Notifications</span>
        </button>
      )}
    </div>
  );

  return (
    <OperatorLayout
      title="Messages - ClubOS"
      description="OpenPhone SMS messaging interface"
      subNavigation={
        <SubNavigation
          actions={actions}
          rightContent={notificationToggle}
        />
      }
    >

        {/* Desktop Layout - Standard ClubOS design */}
        <div className="hidden md:block">
          <div className="container mx-auto px-4 py-4">

            {/* Messages Interface - Better height calculation */}
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] overflow-hidden">
              <div className={`grid grid-cols-3 transition-all duration-300 ${remoteActionsBar.isVisible ? 'h-[calc(100vh-250px)]' : 'h-[calc(100vh-200px)]'}`}>
                
                {/* Conversations List */}
                <div className="border-r border-[var(--border-secondary)] overflow-y-auto">
                  {/* Search - More compact */}
                  <div className="p-3 border-b border-[var(--border-secondary)]">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-xs"
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
                        <ConversationItem
                          key={conv.id}
                          conversation={conv}
                          isSelected={selectedConversation?.id === conv.id}
                          onClick={() => selectConversation(conv)}
                          formatDistance={(date) => formatDistanceToNow(date, { addSuffix: true }).replace(' ago', '')}
                          isClient={isClient}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Messages Area */}
                <div className="col-span-2 flex flex-col h-full overflow-hidden">
                  {selectedConversation ? (
                    <>
                      {/* Conversation Header - More compact */}
                      <div className="p-3 border-b border-[var(--border-secondary)]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="px-2 py-1 border border-gray-300 rounded-lg">
                              <span className="text-xs font-medium text-gray-600">
                                {selectedConversation.bay ? `Bay ${selectedConversation.bay}` : selectedConversation.location ? selectedConversation.location : 'General'}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm">{selectedConversation.customer_name || 'Unknown'}</h3>
                              <p className="text-xs text-[var(--text-muted)]">
                                {selectedConversation.phone_number || 'No phone number'}
                                {selectedConversation.total_conversations && selectedConversation.total_conversations > 1 && (
                                  <span className="ml-2 text-[10px] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-full">
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
                        <div className="space-y-4" style={{ contentVisibility: 'auto' } as React.CSSProperties}>
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
                          
                          // Call/voicemail rendering
                          const isCall = message.type === 'call';
                          const isVoicemail = message.type === 'call_transcript';
                          const isCallSummary = message.type === 'call_summary';
                          const isCallEvent = isCall || isVoicemail || isCallSummary;

                          if (isCallEvent) {
                            const callText = isVoicemail
                              ? (message.transcript || message.text || message.body || '')
                              : isCallSummary
                                ? (message.summary || message.text || message.body || '')
                                : '';
                            const callDuration = message.duration ? `${Math.floor(message.duration / 60)}:${String(message.duration % 60).padStart(2, '0')}` : null;
                            const callTime = message.createdAt || message.timestamp;

                            return (
                              <div key={message.id || index} className="flex justify-center">
                                <div className="max-w-[80%] bg-purple-50 dark:bg-purple-900/15 border border-purple-200 dark:border-purple-800 rounded-lg px-4 py-2.5">
                                  <div className="flex items-center gap-2 mb-1">
                                    <PhoneOff className="w-3.5 h-3.5 text-purple-500" />
                                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                      {isVoicemail ? 'Voicemail Transcript' : isCallSummary ? 'Call Summary' : 'Missed Call'}
                                    </span>
                                    {callDuration && (
                                      <span className="text-[10px] text-purple-400 dark:text-purple-500">{callDuration}</span>
                                    )}
                                  </div>
                                  {callText && (
                                    <p className="text-sm text-[var(--text-primary)] italic">&ldquo;{callText}&rdquo;</p>
                                  )}
                                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                                    {isClient && callTime ? format(new Date(callTime), 'h:mm a') : ''}
                                  </p>
                                </div>
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
                            {sending ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            <span>{sending ? 'Sending...' : 'Send'}</span>
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
        <div
          className="md:hidden flex flex-col bg-[var(--bg-primary)]"
          style={{
            height: remoteActionsBar.isVisible ? 'calc(100dvh - 48px)' : '100dvh',
            transition: 'height 150ms ease-out'
          }}
        >
          {/* Quick Actions and Notifications - Fixed at top */}
          <div className="flex-shrink-0 bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)]">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
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
                        {conv.lastMessage && (
                          <p className="text-sm text-[var(--text-secondary)] truncate flex items-center gap-1">
                            {conv.lastMessage.type === 'call' || conv.lastMessage.type === 'call_transcript' || conv.lastMessage.type === 'call_summary' ? (
                              <>
                                <PhoneOff className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                                <span className="text-purple-500 font-medium">
                                  {conv.lastMessage.type === 'call_transcript' ? 'Voicemail' : conv.lastMessage.type === 'call_summary' ? 'Call Summary' : 'Missed Call'}
                                </span>
                              </>
                            ) : (
                              <>
                                {conv.lastMessage.direction === 'outbound' && <span className="text-[var(--text-muted)]">You: </span>}
                                {conv.lastMessage.text || conv.lastMessage.body || ''}
                              </>
                            )}
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
                  <div 
                    className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 flex flex-col" 
                    style={{ 
                      WebkitOverflowScrolling: 'touch',
                      paddingBottom: 'env(safe-area-inset-bottom, 20px)',
                      overscrollBehavior: 'contain'
                    }}
                  >
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
                      <div className="space-y-3" style={{ contentVisibility: 'auto' } as React.CSSProperties}>
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
                          
                          // Call/voicemail rendering (mobile)
                          const mIsCall = message.type === 'call';
                          const mIsVoicemail = message.type === 'call_transcript';
                          const mIsCallSummary = message.type === 'call_summary';
                          const mIsCallEvent = mIsCall || mIsVoicemail || mIsCallSummary;

                          if (mIsCallEvent) {
                            const mCallText = mIsVoicemail
                              ? (message.transcript || message.text || message.body || '')
                              : mIsCallSummary
                                ? (message.summary || message.text || message.body || '')
                                : '';
                            const mCallDuration = message.duration ? `${Math.floor(message.duration / 60)}:${String(message.duration % 60).padStart(2, '0')}` : null;
                            const mCallTime = message.createdAt || message.timestamp;

                            return (
                              <div key={message.id || index} className="flex justify-center px-1">
                                <div className="max-w-[85%] bg-purple-50 dark:bg-purple-900/15 border border-purple-200 dark:border-purple-800 rounded-2xl px-4 py-2.5">
                                  <div className="flex items-center gap-2 mb-1">
                                    <PhoneOff className="w-3.5 h-3.5 text-purple-500" />
                                    <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                      {mIsVoicemail ? 'Voicemail Transcript' : mIsCallSummary ? 'Call Summary' : 'Missed Call'}
                                    </span>
                                    {mCallDuration && (
                                      <span className="text-[10px] text-purple-400 dark:text-purple-500">{mCallDuration}</span>
                                    )}
                                  </div>
                                  {mCallText && (
                                    <p className="text-sm text-[var(--text-primary)] italic">&ldquo;{mCallText}&rdquo;</p>
                                  )}
                                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                                    {isClient && mCallTime ? formatMessageDate(mCallTime) : ''}
                                  </p>
                                </div>
                              </div>
                            );
                          }

                          // Regular message rendering
                          return (
                            <div
                              key={message.id || index}
                              className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'} px-1`}
                            >
                              <div className={`max-w-[80%] sm:max-w-[85%] ${
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
                  
                  {/* Message Input - Mobile optimized, pb-[76px] clears the fixed bottom nav bar */}
                  <div
                    className="flex-shrink-0 border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3 pb-[76px]"
                  >
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
                        style={{ 
                          fontSize: '16px', // Prevents zoom on iOS
                          WebkitAppearance: 'none', // Ensures consistent appearance
                          touchAction: 'manipulation' // Improves touch responsiveness
                        }}
                        enterKeyHint="send" // Shows 'Send' button on mobile keyboards
                        autoComplete="off" // Prevents unwanted autocomplete
                        autoCorrect="on" // Enables autocorrect for messaging
                        autoCapitalize="sentences" // Auto-capitalizes sentences
                        spellCheck="true" // Enables spell check
                      />
                      
                      <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="p-3 bg-[var(--accent)] text-white rounded-full disabled:opacity-50"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        {sending ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
    </OperatorLayout>
  );
}