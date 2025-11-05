'use client';

import React, { useState } from 'react';
import logger from '@/services/logger';
import { 
  MessageCircle, Send, User, Clock, Phone, 
  ChevronDown, ChevronUp, Sparkles, X, Edit2,
  BellOff, Bell, MapPin
} from 'lucide-react';

interface MessageCardProps {
  conversation: any;
  onReply: (message: string) => void;
  onGetAiSuggestion: () => Promise<any>;
}

export default function MessageCard({ conversation, onReply, onGetAiSuggestion }: MessageCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [useAiMode, setUseAiMode] = useState(false);

  const handleGetAiSuggestion = async () => {
    setLoadingAi(true);
    try {
      const suggestion = await onGetAiSuggestion();
      setAiSuggestion(suggestion);
    } catch (error) {
      logger.error('Failed to get AI suggestion:', error);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSend = () => {
    const messageToSend = aiSuggestion && useAiMode ? aiSuggestion.suggestedText : replyText;
    if (messageToSend?.trim()) {
      onReply(messageToSend);
      setReplyText('');
      setAiSuggestion(null);
      setIsExpanded(false);
      setUseAiMode(false);
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] shadow-sm hover:shadow-md transition-all duration-200">
      {/* Header - Always visible */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-[var(--text-secondary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'Poppins', fontWeight: 600 }}>
                  {conversation.customer_name || 'Unknown'}
                </h3>
                {conversation.unread_count > 0 && (
                  <span className="bg-[var(--accent)] text-white text-xs px-2 py-0.5 rounded-full">
                    {conversation.unread_count}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--text-secondary)] truncate" style={{ fontFamily: 'Poppins', fontWeight: 400 }}>
                {conversation.lastMessage?.text || conversation.lastMessage?.body || 'No messages'}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(conversation.updated_at)}
                </span>
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {conversation.phone_number}
                </span>
                {conversation.location && (
                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {conversation.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-[var(--text-secondary)]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-[var(--border-primary)]">
          {/* AI Suggestion Area */}
          {aiSuggestion && (
            <div className="p-4 bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)]">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium text-[var(--text-primary)]" style={{ fontFamily: 'Poppins', fontWeight: 500 }}>
                    AI Suggestion
                  </span>
                  <span className="text-xs text-yellow-600 font-semibold">
                    {Math.round(aiSuggestion.confidence * 100)}%
                  </span>
                </div>
                <button
                  onClick={() => setAiSuggestion(null)}
                  className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
                >
                  <X className="w-4 h-4 text-[var(--text-secondary)]" />
                </button>
              </div>
              <p className="text-sm text-[var(--text-primary)] mb-3" style={{ fontFamily: 'Poppins', fontWeight: 400 }}>
                {aiSuggestion.suggestedText}
              </p>
              <button
                onClick={() => {
                  setUseAiMode(true);
                  setReplyText(aiSuggestion.suggestedText);
                }}
                className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
                style={{ fontFamily: 'Poppins', fontWeight: 500 }}
              >
                Use
              </button>
            </div>
          )}

          {/* Reply Input Area */}
          <div className="p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSend();
                  }
                }}
                placeholder={aiSuggestion ? "Type your reply or use the AI suggestion..." : "Type your reply..."}
                className="flex-1 px-4 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                style={{ fontFamily: 'Poppins', fontWeight: 400 }}
              />
              {!aiSuggestion && (
                <button
                  onClick={handleGetAiSuggestion}
                  disabled={loadingAi}
                  className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-2 text-sm"
                  style={{ fontFamily: 'Poppins', fontWeight: 500 }}
                >
                  <Sparkles className="w-4 h-4" />
                  {loadingAi ? 'Loading...' : 'AI'}
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!replyText.trim() && (!aiSuggestion || !useAiMode)}
                className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
                style={{ fontFamily: 'Poppins', fontWeight: 500 }}
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
            
            {/* Cancel button */}
            <button
              onClick={() => {
                setIsExpanded(false);
                setReplyText('');
                setAiSuggestion(null);
                setUseAiMode(false);
              }}
              className="mt-3 px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              style={{ fontFamily: 'Poppins', fontWeight: 400 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}