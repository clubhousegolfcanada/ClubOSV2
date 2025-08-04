import React, { useState, useEffect } from 'react';
import { MessageCircle, User, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SlackReply {
  reply_id: string;
  thread_ts: string;
  reply_user_name: string;
  reply_user_id: string;
  reply_text: string;
  reply_timestamp: string;
  reply_created_at: string;
  
  // Original message context
  original_message_id: string;
  original_user_id: string;
  original_request_id: string;
  slack_channel: string;
  request_description: string;
  location: string;
  route: string;
  original_created_at: string;
}

interface SlackConversation {
  id: string;
  user_id: string;
  request_id: string;
  slack_thread_ts: string;
  slack_channel: string;
  original_message: string;
  request_description: string;
  location: string;
  route: string;
  created_at: string;
  reply_count: number;
  last_reply_at: string | null;
}

interface Props {
  threadTs?: string;
  className?: string;
}

export const SlackConversation: React.FC<Props> = ({ threadTs, className }) => {
  const [conversations, setConversations] = useState<SlackConversation[]>([]);
  const [replies, setReplies] = useState<SlackReply[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(threadTs || null);
  const [loading, setLoading] = useState(false);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch conversations
  const fetchConversations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_URL}/slack/conversations`);
      if (response.data.success) {
        setConversations(response.data.data.conversations);
        setLastRefresh(new Date());
      } else {
        setError('Failed to fetch conversations');
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError('Unable to load Slack conversations');
    } finally {
      setLoading(false);
    }
  };

  // Fetch replies for a specific thread
  const fetchReplies = async (threadTs: string) => {
    setRepliesLoading(true);
    
    try {
      const response = await axios.get(`${API_URL}/slack/replies/${threadTs}`);
      if (response.data.success) {
        setReplies(response.data.data.replies);
      } else {
        setReplies([]);
      }
    } catch (err) {
      console.error('Error fetching replies:', err);
      setReplies([]);
    } finally {
      setRepliesLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, []);

  // Load replies when thread is selected
  useEffect(() => {
    if (selectedThread) {
      fetchReplies(selectedThread);
    }
  }, [selectedThread]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
      if (selectedThread) {
        fetchReplies(selectedThread);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedThread]);

  const formatTimestamp = (timestamp: string) => {
    if (typeof window === 'undefined') return '';
    return new Date(timestamp).toLocaleString();
  };

  const formatTimeAgo = (timestamp: string) => {
    if (typeof window === 'undefined') return '';
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  const selectedConversation = conversations.find(c => c.slack_thread_ts === selectedThread);

  return (
    <div className={`slack-conversation-panel ${className || ''}`}>
      <style jsx>{`
        .slack-conversation-panel {
          background: var(--bg-secondary);
          border: 1px solid var(--border-primary);
          border-radius: 8px;
          overflow: hidden;
        }
        .conversation-header {
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-secondary);
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: between;
        }
        .conversation-list {
          max-height: 300px;
          overflow-y: auto;
        }
        .conversation-item {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-secondary);
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .conversation-item:hover {
          background: var(--bg-tertiary);
        }
        .conversation-item.selected {
          background: var(--accent);
          color: var(--bg-primary);
        }
        .replies-section {
          max-height: 400px;
          overflow-y: auto;
          padding: 16px;
        }
        .reply-item {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-secondary);
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 8px;
        }
        .reply-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
        .reply-text {
          color: var(--text-primary);
          line-height: 1.5;
        }
        .loading-spinner {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .error-message {
          color: var(--status-error);
          padding: 16px;
          text-align: center;
        }
        .empty-state {
          text-align: center;
          padding: 24px;
          color: var(--text-secondary);
        }
      `}</style>

      {/* Header */}
      <div className="conversation-header">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          <h3 className="font-semibold">Slack Conversations</h3>
          <span className="text-sm text-[var(--text-secondary)]">
            ({conversations.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">
            Last updated: {formatTimeAgo(lastRefresh.toISOString())}
          </span>
          <button
            onClick={fetchConversations}
            disabled={loading}
            className="p-1 hover:bg-[var(--bg-primary)] rounded transition-colors"
            title="Refresh conversations"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button 
            onClick={fetchConversations}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="loading-spinner">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading conversations...</span>
        </div>
      )}

      {/* Conversations List */}
      {!loading && !error && conversations.length > 0 && (
        <div className="conversation-list">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-item ${selectedThread === conversation.slack_thread_ts ? 'selected' : ''}`}
              onClick={() => setSelectedThread(conversation.slack_thread_ts)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="font-medium text-sm truncate">
                    {conversation.request_description}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {conversation.location && (
                      <span>📍 {conversation.location} • </span>
                    )}
                    <span>{formatTimeAgo(conversation.created_at)}</span>
                  </p>
                </div>
                <div className="text-right ml-2">
                  {conversation.reply_count > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-[var(--accent)] text-[var(--bg-primary)]">
                      {conversation.reply_count} reply{conversation.reply_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span className="px-2 py-1 bg-[var(--bg-primary)] rounded text-xs">
                  {conversation.route}
                </span>
                <span>{conversation.slack_channel}</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && conversations.length === 0 && (
        <div className="empty-state">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)]" />
          <p>No Slack conversations found</p>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Send a message with Smart Assist OFF to create a conversation
          </p>
        </div>
      )}

      {/* Selected Thread Replies */}
      {selectedThread && selectedConversation && (
        <div className="border-t border-[var(--border-secondary)]">
          <div className="px-4 py-3 bg-[var(--bg-tertiary)] border-b border-[var(--border-secondary)]">
            <h4 className="font-medium text-sm">Thread Replies</h4>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Original: {selectedConversation.request_description}
            </p>
          </div>

          {repliesLoading && (
            <div className="loading-spinner">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="ml-2">Loading replies...</span>
            </div>
          )}

          {!repliesLoading && (
            <div className="replies-section">
              {replies.length > 0 ? (
                replies.map((reply) => (
                  <div key={reply.reply_id} className="reply-item">
                    <div className="reply-header">
                      <User className="w-4 h-4" />
                      <span className="font-medium">
                        {reply.reply_user_name || 'Slack User'}
                      </span>
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(reply.reply_timestamp)}</span>
                    </div>
                    <div className="reply-text">
                      {reply.reply_text}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
                  <p className="text-sm">No replies yet</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Staff can reply in the Slack thread
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};