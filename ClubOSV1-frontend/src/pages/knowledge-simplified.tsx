import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAuthState } from '@/state/useStore';
import toast from 'react-hot-toast';
import axios from 'axios';
import { 
  AlertCircle, 
  RefreshCw, 
  Brain, 
  Plus,
  Search,
  Upload,
  Trash2,
  Edit2,
  Check,
  X,
  FileText,
  TrendingUp
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface KnowledgeEntry {
  key: string;
  value: any;
  metadata?: {
    category?: string;
    confidence?: number;
    usage_count?: number;
    last_used?: string;
  };
  created_at?: string;
  updated_at?: string;
}

const KnowledgeSimplified: React.FC = () => {
  const { user } = useAuthState();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [analytics, setAnalytics] = useState<any>(null);

  // Check admin access
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-[var(--text-muted)]" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-[var(--text-secondary)]">You need admin privileges to access the Knowledge Center.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchKnowledge();
    fetchAnalytics();
  }, []);

  const fetchKnowledge = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/knowledge-store`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setEntries(response.data.entries || []);
      }
    } catch (error) {
      console.error('Failed to fetch knowledge:', error);
      toast.error('Failed to load knowledge entries');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/knowledge-store/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setAnalytics(response.data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !newValue.trim()) {
      toast.error('Please enter both topic and knowledge');
      return;
    }

    try {
      const token = localStorage.getItem('clubos_token');
      
      // Auto-generate a key from the topic/question
      const autoKey = newKey.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
      
      // Structure the value for optimal search indexing
      // The search_vector indexes: title, content, problem, solution fields
      const structuredValue = {
        title: newKey,  // Original topic/question for search
        content: newValue,  // Main knowledge content
        // Add problem/solution if it seems like a Q&A
        ...(newKey.includes('?') || newKey.toLowerCase().includes('how') ? {
          problem: newKey,
          solution: newValue
        } : {}),
        // Store original format
        type: newKey.includes('?') ? 'faq' : 'knowledge',
        searchTerms: [
          ...newKey.toLowerCase().split(' '),
          ...newValue.toLowerCase().split(' ').slice(0, 10) // First 10 words for search
        ].filter((term, index, self) => term.length > 2 && self.indexOf(term) === index)
      };
      
      const response = await axios.post(
        `${API_URL}/knowledge-store`,
        { 
          key: autoKey,
          value: structuredValue,
          metadata: {
            category: newKey.includes('?') ? 'faq' : 'general',
            confidence: 1.0,
            source: 'manual_entry'
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('Knowledge added successfully');
        setNewKey('');
        setNewValue('');
        fetchKnowledge();
      }
    } catch (error) {
      console.error('Failed to add knowledge:', error);
      toast.error('Failed to add knowledge');
    }
  };

  const handleUpdate = async (key: string) => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.put(
        `${API_URL}/knowledge-store/${key}`,
        { value: editValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('Knowledge updated');
        setEditingKey(null);
        fetchKnowledge();
      }
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Are you sure you want to delete this knowledge?')) return;
    
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.delete(`${API_URL}/knowledge-store/${key}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Knowledge deleted');
      fetchKnowledge();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/knowledge-store/upload`,
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );
      
      if (response.data.success) {
        toast.success(`Uploaded ${response.data.entriesCreated} knowledge entries`);
        fetchKnowledge();
      }
    } catch (error) {
      toast.error('Failed to upload file');
    }
  };

  const filteredEntries = entries.filter(entry => 
    entry.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    JSON.stringify(entry.value).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Head>
        <title>Knowledge Store - ClubOS</title>
        <meta name="description" content="Manage AI knowledge base" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Brain className="w-8 h-8" />
              Knowledge Store
            </h1>
            <p className="text-[var(--text-secondary)]">
              Manage what the AI knows. Add answers to common questions to reduce API costs.
            </p>
          </div>

          {/* Analytics Summary */}
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="text-2xl font-bold">{analytics.stats?.total_entries || 0}</div>
                <div className="text-sm text-[var(--text-secondary)]">Total Entries</div>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="text-2xl font-bold">{analytics.stats?.verified_count || 0}</div>
                <div className="text-sm text-[var(--text-secondary)]">Verified</div>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="text-2xl font-bold">
                  {analytics.stats?.avg_confidence ? 
                    `${(analytics.stats.avg_confidence * 100).toFixed(0)}%` : '0%'}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">Avg Confidence</div>
              </div>
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <div className="text-2xl font-bold">{analytics.stats?.total_usage || 0}</div>
                <div className="text-sm text-[var(--text-secondary)]">Total Uses</div>
              </div>
            </div>
          )}

          {/* Add New Knowledge */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Add Knowledge</h3>
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="Topic or Question: e.g., 'Gift cards' or 'How do I buy a gift card?'"
                  className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Can be a topic, category, question, or any identifier
                </p>
              </div>
              <div>
                <textarea
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Knowledge: Facts, procedures, URLs, or any information the AI should know.

Examples:
• Gift cards available at www.clubhouse247golf.com/giftcard/purchase
• Bedford location has 10 bays, Dartmouth has 8 bays
• Trackman units auto-restart every night at 3am
• Members get 20% off food and beverages
• The new Titleist Pro V1x balls arrived last week"
                  className="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg resize-y min-h-[120px]"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Any information that might be useful - the AI will search and find relevant parts
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={handleAdd}
                  className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Knowledge
                </button>
                <label className="px-6 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-secondary)] cursor-pointer flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Upload File
                  <input
                    type="file"
                    accept=".txt,.json,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search knowledge..."
                className="w-full pl-10 pr-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg"
              />
            </div>
          </div>

          {/* Knowledge List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="ml-2">Loading knowledge...</span>
            </div>
          ) : filteredEntries.length > 0 ? (
            <div className="space-y-4">
              {filteredEntries.map((entry) => (
                <div key={entry.key} className="bg-[var(--bg-secondary)] rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-[var(--accent)] mb-1">
                        {/* Display the title or key */}
                        {typeof entry.value === 'object' && entry.value.title ? 
                          entry.value.title : 
                          entry.key.replace(/_/g, ' ')}
                      </div>
                      {editingKey === entry.key ? (
                        <div className="flex gap-2 mt-2">
                          <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 p-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded"
                            rows={3}
                          />
                          <button
                            onClick={() => handleUpdate(entry.key)}
                            className="p-2 text-green-500 hover:bg-green-500/10 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingKey(null)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-[var(--text-primary)]">
                          {/* Display the content intelligently */}
                          {typeof entry.value === 'object' ? (
                            entry.value.content || entry.value.solution || 
                            entry.value.answer || entry.value.text ||
                            JSON.stringify(entry.value, null, 2)
                          ) : (
                            entry.value
                          )}
                        </div>
                      )}
                      {entry.metadata && (
                        <div className="flex gap-4 mt-2 text-xs text-[var(--text-muted)]">
                          {entry.metadata.confidence && (
                            <span>Confidence: {(entry.metadata.confidence * 100).toFixed(0)}%</span>
                          )}
                          {entry.metadata.usage_count !== undefined && (
                            <span>Used: {entry.metadata.usage_count} times</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => {
                          setEditingKey(entry.key);
                          setEditValue(typeof entry.value === 'object' ? 
                            JSON.stringify(entry.value, null, 2) : 
                            entry.value);
                        }}
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.key)}
                        className="p-2 text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Knowledge Found</h3>
              <p className="text-[var(--text-secondary)]">
                Start by adding some common questions and answers above.
              </p>
              <div className="mt-6 text-left max-w-lg mx-auto">
                <p className="text-sm text-[var(--text-secondary)] mb-2">Example Knowledge to Add:</p>
                <div className="text-sm text-[var(--text-muted)] space-y-3">
                  <div>
                    <div className="font-medium">Q&A Format:</div>
                    <div className="ml-2">Q: "How to buy gift cards?" → A: "www.clubhouse247golf.com/giftcard/purchase"</div>
                  </div>
                  <div>
                    <div className="font-medium">General Knowledge:</div>
                    <div className="ml-2">Topic: "Facilities" → "Bedford: 10 bays, Dartmouth: 8 bays, Stratford: 6 bays"</div>
                  </div>
                  <div>
                    <div className="font-medium">Procedures:</div>
                    <div className="ml-2">Topic: "Daily maintenance" → "Check all bays at opening, test trackman units, verify TVs"</div>
                  </div>
                  <div>
                    <div className="font-medium">Current Info:</div>
                    <div className="ml-2">Topic: "Promotions" → "Happy hour 3-5pm weekdays, 20% off simulator time"</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default KnowledgeSimplified;