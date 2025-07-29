import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Send, 
  RefreshCw, 
  AlertCircle,
  Brain,
  Clock,
  ArrowRight
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RecentUpdate {
  id: string;
  timestamp: string;
  action: string;
  category: string;
  key?: string;
  new_value: string;
  assistant_target: string;
  user_name?: string;
}

export const KnowledgeRouterPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchRecentUpdates();
  }, []);

  const fetchRecentUpdates = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('clubos_token') : null;
      const response = await axios.get(`${API_URL}/knowledge-router/recent-updates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentUpdates(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch recent updates:', error);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim()) {
      toast.error('Please enter a knowledge update');
      return;
    }

    try {
      setProcessing(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('clubos_token') : null;
      
      // Parse and route directly
      const response = await axios.post(
        `${API_URL}/knowledge-router/parse-and-route`,
        { input },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success(response.data.data.message || 'Knowledge updated successfully');
        setInput('');
        fetchRecentUpdates();
      } else {
        toast.error(response.data.error || 'Failed to route knowledge');
      }
    } catch (error) {
      console.error('Knowledge routing error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          toast.error('Authentication required. Please log in again.');
        } else if (error.response?.data?.error) {
          toast.error(error.response.data.error);
        } else {
          toast.error('Failed to connect to server. Please try again.');
        }
      } else {
        toast.error('Failed to process knowledge update');
      }
    } finally {
      setProcessing(false);
    }
  };

  const getAssistantColor = (assistant: string) => {
    const colors: Record<string, string> = {
      emergency: 'text-red-600 bg-red-500/10',
      booking: 'text-green-600 bg-green-500/10',
      tech: 'text-blue-600 bg-blue-500/10',
      brand: 'text-purple-600 bg-purple-500/10'
    };
    return colors[assistant] || 'text-gray-600 bg-gray-500/10';
  };

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--bg-secondary)] rounded-lg p-6 animate-pulse">
          <div className="h-6 bg-gray-300 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Update Assistant Knowledge
        </h3>
        
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Type knowledge updates in plain English. Our AI will understand your intent and update the correct assistant.
        </p>

        <div className="space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Examples:
• The HDMI fix for TrackMan is to restart the system
• Clubhouse Grey color has been updated to #503285  
• Nick Wang opened a new Better Golf location in PEI
• Emergency contact for facilities is now 555-0199"
            className="w-full min-h-[150px] p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg resize-y"
            disabled={processing}
          />

          <div className="flex items-center justify-end">
            <button
              onClick={handleSubmit}
              disabled={processing || !input.trim()}
              className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Update
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Updates */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Knowledge Updates
          </h3>
          <button
            onClick={fetchRecentUpdates}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {recentUpdates.length > 0 ? (
          <div className="space-y-3">
            {recentUpdates.map((update) => (
              <div key={update.id} className="p-3 bg-[var(--bg-primary)] rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getAssistantColor(update.assistant_target)}`}>
                        {update.assistant_target}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {update.action.toUpperCase()}
                      </span>
                      <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                      <span className="text-xs font-medium">
                        {update.category}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {update.new_value.length > 100 
                        ? update.new_value.substring(0, 100) + '...' 
                        : update.new_value}
                    </p>
                  </div>
                  {mounted && (
                    <span className="text-xs text-[var(--text-muted)] whitespace-nowrap ml-4">
                      {new Date(update.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No recent updates</p>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <h4 className="font-medium text-blue-400 mb-2">How it works:</h4>
        <ul className="text-sm text-blue-400 space-y-1 list-disc list-inside">
          <li>Write knowledge updates in plain English</li>
          <li>AI understands whether to add, update, or replace information</li>
          <li>Knowledge is saved to our database first</li>
          <li>Assistants check database before using OpenAI APIs</li>
          <li>All updates are logged with full audit trail</li>
        </ul>
      </div>
    </div>
  );
};