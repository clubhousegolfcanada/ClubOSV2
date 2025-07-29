import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Send, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Brain,
  Clock,
  ArrowRight
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ParsedKnowledge {
  intent: 'add' | 'update' | 'overwrite';
  category: string;
  key?: string;
  value: string;
  target_assistant: string;
}

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
  const [testMode, setTestMode] = useState(false);
  const [recentUpdates, setRecentUpdates] = useState<RecentUpdate[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedKnowledge | null>(null);

  useEffect(() => {
    fetchRecentUpdates();
  }, []);

  const fetchRecentUpdates = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
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
      const token = localStorage.getItem('clubos_token');
      
      if (testMode) {
        // Test parse only
        const response = await axios.post(
          `${API_URL}/knowledge-router/test-parse`,
          { input },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        setParsedData(response.data.data.parsed);
        setShowPreview(true);
        toast.success('Test parse successful!');
      } else {
        // Parse and route
        const response = await axios.post(
          `${API_URL}/knowledge-router/parse-and-route`,
          { input },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data.success) {
          toast.success(response.data.data.message);
          setInput('');
          fetchRecentUpdates();
        } else {
          toast.error(response.data.error || 'Failed to route knowledge');
        }
      }
    } catch (error) {
      console.error('Knowledge routing error:', error);
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        toast.error(error.response.data.error);
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

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Natural Language Knowledge Updates
        </h3>
        
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Simply describe what knowledge you want to add, update, or overwrite. 
          GPT-4o will parse your intent and route it to the correct assistant.
        </p>

        <div className="space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Examples:
• Add HDMI fix to tech checklist
• Update Clubhouse Grey color to #503285
• Nick Wang is opening a Better Golf location in PEI
• Overwrite emergency contact list with new numbers"
            className="w-full min-h-[150px] p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg resize-y"
            disabled={processing}
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
                className="rounded"
                disabled={processing}
              />
              <span className="text-sm text-[var(--text-secondary)]">
                Test Mode (parse only, don't route)
              </span>
            </label>

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
                  {testMode ? 'Test Parse' : 'Send Update'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Section (Test Mode) */}
      {showPreview && parsedData && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <h4 className="font-semibold text-green-400 mb-3">Parse Result</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Intent:</span>
              <span className="font-medium">{parsedData.intent.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Category:</span>
              <span className="font-medium">{parsedData.category}</span>
            </div>
            {parsedData.key && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-muted)]">Key:</span>
                <span className="font-medium">{parsedData.key}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Target:</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getAssistantColor(parsedData.target_assistant)}`}>
                {parsedData.target_assistant}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-[var(--text-muted)]">Value:</span>
              <div className="mt-1 p-2 bg-[var(--bg-primary)] rounded border border-[var(--border-primary)]">
                {parsedData.value}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setShowPreview(false);
              setParsedData(null);
            }}
            className="mt-4 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Close Preview
          </button>
        </div>
      )}

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
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap ml-4">
                    {new Date(update.timestamp).toLocaleString()}
                  </span>
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
          <li>Type natural language descriptions of knowledge updates</li>
          <li>GPT-4o parses your intent and categorizes the knowledge</li>
          <li>Updates are routed to the appropriate OpenAI Assistant</li>
          <li>Audit logs track all changes for compliance</li>
          <li>Critical updates (pricing, SOPs) trigger Slack notifications</li>
        </ul>
      </div>
    </div>
  );
};