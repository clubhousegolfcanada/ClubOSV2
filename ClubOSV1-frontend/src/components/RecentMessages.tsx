import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Phone, Clock, User, MessageCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RecentMessage {
  id: string;
  phone_number: string;
  conversation_id: string;
  messages: any[];
  created_at: string;
  updated_at: string;
  processed: boolean;
}

export const RecentMessages: React.FC = () => {
  const [messages, setMessages] = useState<RecentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentMessages = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/openphone/recent-conversations?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setMessages(response.data.data);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to fetch recent messages:', err);
      setError('Failed to load recent messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentMessages();
    
    // Set up auto-refresh every 8 seconds
    const interval = setInterval(fetchRecentMessages, 8000);
    
    return () => clearInterval(interval);
  }, []);

  const formatPhoneNumber = (phone: string) => {
    // Format phone number for display
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const number = cleaned.slice(1);
      return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
    }
    return phone;
  };

  const getLastMessage = (messages: any[]) => {
    if (!messages || messages.length === 0) return 'No messages';
    const last = messages[messages.length - 1];
    return last.text || last.body || 'Media message';
  };

  const getMessagePreview = (text: string) => {
    if (text.length > 80) {
      return text.substring(0, 80) + '...';
    }
    return text;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
        <span className="ml-2 text-[var(--text-secondary)]">Loading messages...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-[var(--text-secondary)]">{error}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8">
        <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No Recent Messages</h3>
        <p className="text-[var(--text-secondary)]">
          OpenPhone conversations will appear here as they come in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <div key={message.id} className="bg-[var(--bg-secondary)] rounded-lg p-4 hover:bg-[var(--bg-tertiary)] transition-colors">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="font-medium">{formatPhoneNumber(message.phone_number)}</span>
              {!message.processed && (
                <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">
                  New
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Clock className="w-3 h-3" />
              {new Date(message.updated_at).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
          </div>
          
          <div className="text-sm text-[var(--text-secondary)] mb-2">
            <span className="text-[var(--text-muted)]">Last message:</span> {getMessagePreview(getLastMessage(message.messages))}
          </div>
          
          <div className="flex justify-between items-center text-xs text-[var(--text-muted)]">
            <span>
              {message.messages?.length || 0} message{message.messages?.length !== 1 ? 's' : ''}
            </span>
            <span>
              ID: {message.conversation_id}
            </span>
          </div>
        </div>
      ))}
      
      <div className="text-center py-2">
        <p className="text-xs text-[var(--text-muted)]">
          Updates automatically every 8 seconds
        </p>
      </div>
    </div>
  );
};