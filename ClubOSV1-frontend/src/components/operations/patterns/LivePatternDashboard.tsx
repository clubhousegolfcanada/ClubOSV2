import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  Edit2,
  Clock,
  TrendingUp,
  AlertCircle,
  Send,
  User,
  Phone,
  Bot,
  Activity,
  RefreshCw
} from 'lucide-react';
import apiClient from '@/api/http';
import logger from '@/services/logger';

interface QueuedSuggestion {
  id: number;
  conversationId: string;
  patternId: number;
  phoneNumber: string;
  customerName?: string;
  originalMessage: string;
  suggestedResponse: string;
  confidence: number;
  reasoning?: {
    thought_process: string;
    next_steps: string[];
    confidence_explanation: string;
  };
  patternType: string;
  createdAt: string;
}

interface ActivityItem {
  id: number;
  time: string;
  phone: string;
  customerName?: string;
  message: string;
  pattern: string;
  confidence: number;
  status: 'pending' | 'handled' | 'rejected' | 'auto_handled' | 'queued';
  mode: string;
}

export const LivePatternDashboard: React.FC = () => {
  const [queue, setQueue] = useState<QueuedSuggestion[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editedResponses, setEditedResponses] = useState<{ [key: number]: string }>({});
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch queue and activity
  const fetchData = async () => {
    try {
      const [queueRes, activityRes] = await Promise.all([
        apiClient.get('/patterns/queue'),
        apiClient.get('/patterns/recent-activity')
      ]);
      
      setQueue(queueRes.data.queue || []);
      setActivity(activityRes.data.activity || []);
    } catch (error) {
      logger.error('Failed to fetch pattern data:', error);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000); // Poll every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Handle operator actions
  const handleAction = async (id: number, action: 'accept' | 'modify' | 'reject') => {
    setProcessingId(id);
    try {
      const payload: any = { action };
      
      if (action === 'modify') {
        payload.modifiedResponse = editedResponses[id] || queue.find(q => q.id === id)?.suggestedResponse;
      }
      
      await apiClient.post(`/patterns/queue/${id}/respond`, payload);
      
      // Remove from queue immediately for better UX
      setQueue(prev => prev.filter(q => q.id !== id));
      setEditingId(null);
      setEditedResponses(prev => {
        const newResponses = { ...prev };
        delete newResponses[id];
        return newResponses;
      });
      
      // Refresh data
      await fetchData();
    } catch (error) {
      logger.error('Failed to process suggestion:', error);
      alert('Failed to process suggestion. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  // Format time ago
  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'handled': return 'text-green-600 bg-green-50';
      case 'auto_handled': return 'text-blue-600 bg-blue-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      default: return 'text-[var(--text-secondary)] bg-[var(--bg-tertiary)]';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Activity className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Live Pattern Dashboard</h2>
          {queue.length > 0 && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              {queue.length} pending
            </span>
          )}
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
            autoRefresh 
              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
              : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          <span>{autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}</span>
        </button>
      </div>

      {/* Suggestions Queue */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center">
          <MessageSquare className="h-5 w-5 mr-2 text-primary" />
          Pending Suggestions
        </h3>
        
        {queue.length === 0 ? (
          <div className="bg-[var(--bg-tertiary)] rounded-lg p-8 text-center">
            <Bot className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-[var(--text-secondary)]">No pending suggestions</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">New customer messages will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((suggestion) => (
              <div key={suggestion.id} className="bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-secondary)] shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-[var(--bg-tertiary)] border-b border-[var(--border-secondary)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-[var(--text-secondary)]" />
                        <span className="font-medium text-[var(--text-primary)]">{suggestion.phoneNumber}</span>
                      </div>
                      {suggestion.customerName && (
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4 text-[var(--text-secondary)]" />
                          <span className="text-[var(--text-primary)]">{suggestion.customerName}</span>
                        </div>
                      )}
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                        {suggestion.patternType}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="h-4 w-4 text-[var(--text-secondary)]" />
                        <span className="font-medium">{Math.round(suggestion.confidence * 100)}%</span>
                      </div>
                      <span className="text-sm text-[var(--text-secondary)]">{formatTimeAgo(suggestion.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-4">
                  {/* Customer Message */}
                  <div>
                    <p className="text-sm text-[var(--text-secondary)] mb-1">Customer message:</p>
                    <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                      <p className="text-[var(--text-primary)]">{suggestion.originalMessage}</p>
                    </div>
                  </div>

                  {/* Suggested Response */}
                  <div>
                    <p className="text-sm text-[var(--text-secondary)] mb-1">AI suggestion:</p>
                    {editingId === suggestion.id ? (
                      <textarea
                        value={editedResponses[suggestion.id] || suggestion.suggestedResponse}
                        onChange={(e) => setEditedResponses(prev => ({ ...prev, [suggestion.id]: e.target.value }))}
                        className="w-full p-3 border border-primary rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                        rows={3}
                      />
                    ) : (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-[var(--text-primary)]">{editedResponses[suggestion.id] || suggestion.suggestedResponse}</p>
                      </div>
                    )}
                  </div>

                  {/* GPT Reasoning */}
                  {suggestion.reasoning && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                        View AI reasoning
                      </summary>
                      <div className="mt-2 p-3 bg-[var(--bg-tertiary)] rounded-lg text-xs space-y-2">
                        <p><strong>Thought process:</strong> {suggestion.reasoning.thought_process}</p>
                        {suggestion.reasoning.next_steps?.length > 0 && (
                          <div>
                            <strong>Next steps:</strong>
                            <ul className="list-disc list-inside ml-2">
                              {suggestion.reasoning.next_steps.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p><strong>Confidence:</strong> {suggestion.reasoning.confidence_explanation}</p>
                      </div>
                    </details>
                  )}
                </div>

                {/* Actions */}
                <div className="px-6 py-4 bg-[var(--bg-tertiary)] border-t border-[var(--border-secondary)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {editingId !== suggestion.id ? (
                        <>
                          <button
                            onClick={() => handleAction(suggestion.id, 'accept')}
                            disabled={processingId === suggestion.id}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          >
                            <Send className="h-4 w-4" />
                            <span>Send</span>
                          </button>
                          <button
                            onClick={() => setEditingId(suggestion.id)}
                            disabled={processingId === suggestion.id}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          >
                            <Edit2 className="h-4 w-4" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleAction(suggestion.id, 'reject')}
                            disabled={processingId === suggestion.id}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          >
                            <XCircle className="h-4 w-4" />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleAction(suggestion.id, 'modify')}
                            disabled={processingId === suggestion.id}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          >
                            <Send className="h-4 w-4" />
                            <span>Send Modified</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditedResponses(prev => {
                                const newResponses = { ...prev };
                                delete newResponses[suggestion.id];
                                return newResponses;
                              });
                            }}
                            className="px-4 py-2 bg-[var(--bg-primary)] text-white rounded-lg hover:bg-[var(--bg-hover)]"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                    {processingId === suggestion.id && (
                      <span className="text-sm text-[var(--text-secondary)] flex items-center">
                        <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                        Processing...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-primary" />
          Recent Activity
        </h3>
        
        <div className="bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-secondary)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-tertiary)] border-b border-[var(--border-secondary)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Message</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Pattern</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Confidence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-secondary)]">
                {activity.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                    onClick={() => {
                      // Show details in alert for now (could be a modal later)
                      if (item.status === 'queued' || item.status === 'pending') {
                        alert(`Pattern: ${item.pattern}\nConfidence: ${item.confidence}%\nMessage: ${item.message}\n\nStatus: ${item.status}\n\nThis message is queued for review. Check the Pending Suggestions section above.`);
                      } else {
                        alert(`Pattern: ${item.pattern}\nConfidence: ${item.confidence}%\nMessage: ${item.message}\n\nStatus: ${item.status}`);
                      }
                    }}
                    title="Click for details"
                  >
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                      {formatTimeAgo(item.time)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{item.phone}</p>
                        {item.customerName && (
                          <p className="text-[var(--text-secondary)]">{item.customerName}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)] max-w-xs truncate">
                      {item.message}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded text-xs">
                        {item.pattern}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {item.confidence}%
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};