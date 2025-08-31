import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Users, MessageSquare, Bot, Activity, 
  Download, FileText, RefreshCw, ChevronDown, 
  ChevronUp, Send, Clock, Check, X, 
  AlertCircle, Sparkles, User, Phone,
  Mail, Zap
} from 'lucide-react';
import { format } from 'date-fns';

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Remove /api from the end if it exists
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}

interface SystemMetrics {
  totalUsers: number;
  activeTickets: number;
  messagesProcessed: number;
  aiResponseRate: number;
}

interface Message {
  id: string;
  conversationId: string;
  from: string;
  to: string;
  phoneNumber?: string;
  email?: string;
  content: string;
  timestamp: Date;
  status: 'unread' | 'read' | 'replied';
  aiSuggestion?: string;
  confidence?: number;
  customerName?: string;
  context?: {
    previousMessages?: number;
    category?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
  };
}

interface ExpandedConversation {
  conversationId: string;
  isLoading: boolean;
  replyText: string;
  aiSuggestion: string;
  confidence: number;
  history: Message[];
}

export function OperationsDashboardEnhanced() {
  const { user } = useAuthState();
  const router = useRouter();
  const token = user?.token || localStorage.getItem('clubos_token');
  
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 0,
    activeTickets: 0,
    messagesProcessed: 0,
    aiResponseRate: 0
  });
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedConversations, setExpandedConversations] = useState<Map<string, ExpandedConversation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sendingReply, setSendingReply] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [token]);

  const fetchDashboardData = async () => {
    if (!token) return;
    
    try {
      // Fetch metrics
      const [healthResponse, messagesResponse, usersResponse, ticketsResponse, messagesStatsResponse] = await Promise.all([
        axios.get(`${API_URL}/api/health`),
        axios.get(`${API_URL}/api/messages/recent`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { success: false, data: [] } })),
        axios.get(`${API_URL}/api/auth/users`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { success: false, data: [] } })),
        axios.get(`${API_URL}/api/tickets/active-count`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { count: 0 } })),
        axios.get(`${API_URL}/api/messages/stats/today`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { count: 0, aiResponseRate: 0 } }))
      ]);

      // Calculate real metrics
      const users = Array.isArray(usersResponse.data?.data) ? usersResponse.data.data : 
                   Array.isArray(usersResponse.data) ? usersResponse.data : [];
      const userCount = users.length;
      const activeTicketCount = ticketsResponse.data?.count || 0;
      const messagesToday = messagesStatsResponse.data?.count || 0;
      const aiRate = messagesStatsResponse.data?.aiResponseRate || 0;
      
      // Update metrics
      setMetrics({
        totalUsers: userCount,
        activeTickets: activeTicketCount,
        messagesProcessed: messagesToday,
        aiResponseRate: aiRate
      });

      // Process messages
      if (messagesResponse.data.success) {
        const recentMessages = messagesResponse.data.data.map((msg: any) => ({
          id: msg.id,
          conversationId: msg.conversation_id || msg.id,
          from: msg.from_number || msg.from || 'Customer',
          to: msg.to || 'ClubOS',
          phoneNumber: msg.from_number,
          email: msg.email,
          content: msg.body || msg.content,
          timestamp: new Date(msg.created_at),
          status: msg.status || 'unread',
          customerName: msg.customer_name,
          context: {
            previousMessages: msg.message_count || 0,
            category: msg.category,
            sentiment: msg.sentiment || 'neutral'
          }
        }));
        setMessages(recentMessages.slice(0, 5)); // Show latest 5
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleConversation = async (conversationId: string) => {
    const expanded = expandedConversations.get(conversationId);
    
    if (expanded) {
      // Collapse
      const newExpanded = new Map(expandedConversations);
      newExpanded.delete(conversationId);
      setExpandedConversations(newExpanded);
    } else {
      // Expand and fetch details
      const newExpanded = new Map(expandedConversations);
      newExpanded.set(conversationId, {
        conversationId,
        isLoading: true,
        replyText: '',
        aiSuggestion: '',
        confidence: 0,
        history: []
      });
      setExpandedConversations(newExpanded);

      try {
        // Fetch conversation history and AI suggestion
        const [historyResponse, suggestionResponse] = await Promise.all([
          axios.get(`${API_URL}/api/messages/conversation/${conversationId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.post(`${API_URL}/api/llm/suggest-response`, {
            conversationId,
            context: messages.find(m => m.conversationId === conversationId)?.content
          }, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        newExpanded.set(conversationId, {
          conversationId,
          isLoading: false,
          replyText: suggestionResponse.data.suggestion || '',
          aiSuggestion: suggestionResponse.data.suggestion || '',
          confidence: suggestionResponse.data.confidence || 0,
          history: historyResponse.data.data || []
        });
        setExpandedConversations(new Map(newExpanded));
      } catch (error) {
        console.error('Error fetching conversation details:', error);
        newExpanded.set(conversationId, {
          conversationId,
          isLoading: false,
          replyText: '',
          aiSuggestion: 'Unable to generate suggestion. Please type your response.',
          confidence: 0,
          history: []
        });
        setExpandedConversations(new Map(newExpanded));
      }
    }
  };

  const updateReplyText = (conversationId: string, text: string) => {
    const expanded = expandedConversations.get(conversationId);
    if (expanded) {
      const newExpanded = new Map(expandedConversations);
      newExpanded.set(conversationId, { ...expanded, replyText: text });
      setExpandedConversations(newExpanded);
    }
  };

  const sendReply = async (conversationId: string) => {
    const expanded = expandedConversations.get(conversationId);
    const message = messages.find(m => m.conversationId === conversationId);
    if (!expanded || !message || !expanded.replyText.trim()) return;

    setSendingReply(conversationId);
    try {
      await axios.post(`${API_URL}/api/messages/send`, {
        to: message.phoneNumber || message.from,
        content: expanded.replyText,
        conversationId,
        isAiGenerated: expanded.replyText === expanded.aiSuggestion
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Reply sent successfully');
      
      // Update message status
      setMessages(prev => prev.map(m => 
        m.conversationId === conversationId 
          ? { ...m, status: 'replied' as const }
          : m
      ));

      // Collapse the conversation
      toggleConversation(conversationId);
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    } finally {
      setSendingReply(null);
    }
  };

  const useAiSuggestion = (conversationId: string) => {
    const expanded = expandedConversations.get(conversationId);
    if (expanded) {
      updateReplyText(conversationId, expanded.aiSuggestion);
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-500';
      case 'negative':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'replied':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'read':
        return <Check className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-50';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--accent)]" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          className="bg-[var(--bg-secondary)] rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => {
            // Navigate to users tab in operations
            const event = new CustomEvent('operations-tab-change', { detail: 'users' });
            window.dispatchEvent(event);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Total Users</p>
              <p className="text-2xl font-bold mt-1">{metrics.totalUsers}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Click to manage</p>
            </div>
            <Users className="w-8 h-8 text-[var(--accent)]" />
          </div>
        </div>

        <div 
          className="bg-[var(--bg-secondary)] rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/tickets')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Active Tickets</p>
              <p className="text-2xl font-bold mt-1">{metrics.activeTickets}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">View tickets</p>
            </div>
            <FileText className="w-8 h-8 text-[var(--accent)]" />
          </div>
        </div>

        <div 
          className="bg-[var(--bg-secondary)] rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push('/messages')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">Messages Today</p>
              <p className="text-2xl font-bold mt-1">{metrics.messagesProcessed}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">View messages</p>
            </div>
            <MessageSquare className="w-8 h-8 text-[var(--accent)]" />
          </div>
        </div>

        <div 
          className="bg-[var(--bg-secondary)] rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => {
            // Navigate to AI tab in operations
            const event = new CustomEvent('operations-tab-change', { detail: 'ai' });
            window.dispatchEvent(event);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--text-muted)]">AI Response Rate</p>
              <p className="text-2xl font-bold mt-1">{metrics.aiResponseRate}%</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">AI settings</p>
            </div>
            <Bot className="w-8 h-8 text-[var(--accent)]" />
          </div>
        </div>
      </div>

      {/* Enhanced Messages Section */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Messages</h3>
          <button 
            onClick={fetchDashboardData}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        <div className="space-y-3">
          {messages.map((message) => {
            const expanded = expandedConversations.get(message.conversationId);
            const isExpanded = !!expanded;
            
            return (
              <div 
                key={message.id} 
                className={`border border-[var(--border)] rounded-lg transition-all ${
                  isExpanded ? 'shadow-lg' : 'hover:shadow-md'
                }`}
              >
                {/* Message Header - Always Visible */}
                <div 
                  className="p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                  onClick={() => toggleConversation(message.conversationId)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-[var(--bg-primary)] rounded-full">
                        {message.phoneNumber ? (
                          <Phone className="w-4 h-4 text-[var(--accent)]" />
                        ) : (
                          <Mail className="w-4 h-4 text-[var(--accent)]" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            {message.customerName || message.from}
                          </p>
                          {getStatusIcon(message.status)}
                          {message.context?.sentiment && (
                            <span className={`text-xs ${getSentimentColor(message.context.sentiment)}`}>
                              {message.context.sentiment}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                          {message.content}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <p className="text-xs text-[var(--text-muted)]">
                            {format(message.timestamp, 'MMM d, h:mm a')}
                          </p>
                          {message.phoneNumber && (
                            <p className="text-xs text-[var(--text-muted)]">
                              {message.phoneNumber}
                            </p>
                          )}
                          {message.context?.previousMessages && message.context.previousMessages > 0 && (
                            <p className="text-xs text-[var(--text-muted)]">
                              {message.context.previousMessages} previous messages
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="ml-4">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && expanded && (
                  <div className="border-t border-[var(--border)] p-4 bg-[var(--bg-primary)]">
                    {expanded.isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent)]" />
                        <span className="ml-2">Generating AI response...</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* AI Suggestion */}
                        {expanded.aiSuggestion && (
                          <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                                <span className="text-sm font-medium">AI Suggestion</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(expanded.confidence)}`}>
                                  {expanded.confidence}% confident
                                </span>
                              </div>
                              <button
                                onClick={() => useAiSuggestion(message.conversationId)}
                                className="text-xs px-3 py-1 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                              >
                                Use This
                              </button>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)]">
                              {expanded.aiSuggestion}
                            </p>
                          </div>
                        )}

                        {/* Reply Input */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Your Reply</label>
                          <textarea
                            value={expanded.replyText}
                            onChange={(e) => updateReplyText(message.conversationId, e.target.value)}
                            placeholder="Type your response or use the AI suggestion above..."
                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            rows={3}
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleConversation(message.conversationId)}
                              className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => window.location.href = '/messages'}
                              className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              View Full Thread
                            </button>
                          </div>
                          <button
                            onClick={() => sendReply(message.conversationId)}
                            disabled={!expanded.replyText.trim() || sendingReply === message.conversationId}
                            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {sendingReply === message.conversationId ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                Send Reply
                              </>
                            )}
                          </button>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex items-center gap-4 pt-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            <span>AI will auto-reply in 30s if enabled</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            <span>Response time: ~2s</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {messages.length === 0 && (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No recent messages</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="px-4 py-3 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg flex flex-col items-center gap-2 transition-colors">
            <Download className="w-5 h-5 text-[var(--accent)]" />
            <span className="text-sm">Export Data</span>
          </button>
          
          <button className="px-4 py-3 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg flex flex-col items-center gap-2 transition-colors">
            <FileText className="w-5 h-5 text-[var(--accent)]" />
            <span className="text-sm">View Reports</span>
          </button>
          
          <button className="px-4 py-3 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg flex flex-col items-center gap-2 transition-colors">
            <MessageSquare className="w-5 h-5 text-[var(--accent)]" />
            <span className="text-sm">Send Announcement</span>
          </button>
          
          <button 
            onClick={() => fetchDashboardData()}
            className="px-4 py-3 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg flex flex-col items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-[var(--accent)]" />
            <span className="text-sm">Refresh All</span>
          </button>
        </div>
      </div>
    </div>
  );
}