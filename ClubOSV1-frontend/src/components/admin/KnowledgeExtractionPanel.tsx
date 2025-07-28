import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Download,
  Search,
  Filter,
  ChevronRight,
  Brain,
  FileText,
  Activity,
  Phone,
  Cloud,
  PlusCircle,
  Save
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ExtractedKnowledge {
  id: string;
  source_id: string;
  source_type: string;
  category: string;
  problem: string;
  solution: string;
  confidence: number;
  applied_to_sop: boolean;
  sop_file?: string;
  created_at: string;
}

interface ExtractionStats {
  overview: {
    total_extracted: number;
    applied_count: number;
    pending_count: number;
    avg_confidence: number;
    unique_sources: number;
  };
  byCategory: Array<{
    category: string;
    count: number;
    avg_confidence: number;
  }>;
}

export const KnowledgeExtractionPanel: React.FC = () => {
  const { user } = useAuthState();
  const [activeTab, setActiveTab] = useState<'extract' | 'review' | 'stats' | 'add'>('stats');
  const [isLoading, setIsLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [knowledge, setKnowledge] = useState<ExtractedKnowledge[]>([]);
  const [stats, setStats] = useState<ExtractionStats | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedKnowledge, setSelectedKnowledge] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [openPhoneConnected, setOpenPhoneConnected] = useState<boolean | null>(null);
  const [manualEntry, setManualEntry] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (activeTab === 'stats') {
      fetchStats();
    } else if (activeTab === 'review') {
      fetchUnappliedKnowledge();
    } else if (activeTab === 'extract') {
      testOpenPhoneConnection();
    }
  }, [activeTab, selectedCategory]);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/knowledge/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast.error('Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnappliedKnowledge = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('clubos_token');
      const params = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const response = await axios.get(`${API_URL}/knowledge/unapplied${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKnowledge(response.data.data);
    } catch (error) {
      console.error('Failed to fetch knowledge:', error);
      toast.error('Failed to load knowledge items');
    } finally {
      setIsLoading(false);
    }
  };

  const extractKnowledge = async (limit: number = 10) => {
    try {
      setExtracting(true);
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/knowledge/extract`,
        { limit },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const { data } = response.data;
      toast.success(
        `Processed ${data.processed} conversations, extracted ${data.extracted} knowledge items`
      );
      
      // Refresh stats
      if (activeTab === 'stats') {
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to extract knowledge:', error);
      toast.error('Failed to extract knowledge');
    } finally {
      setExtracting(false);
    }
  };

  const applySelectedKnowledge = async () => {
    if (selectedKnowledge.size === 0) {
      toast.error('No knowledge items selected');
      return;
    }

    const category = knowledge.find(k => selectedKnowledge.has(k.id))?.category;
    const sopFile = `sops/${category}/extracted_knowledge.md`;

    try {
      const token = localStorage.getItem('clubos_token');
      await axios.post(
        `${API_URL}/knowledge/apply-batch`,
        {
          knowledgeIds: Array.from(selectedKnowledge),
          sopFile
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Applied ${selectedKnowledge.size} knowledge items to ${sopFile}`);
      setSelectedKnowledge(new Set());
      fetchUnappliedKnowledge();
    } catch (error) {
      console.error('Failed to apply knowledge:', error);
      toast.error('Failed to apply knowledge');
    }
  };

  const toggleKnowledgeSelection = (id: string) => {
    const newSelection = new Set(selectedKnowledge);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedKnowledge(newSelection);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      emergency: 'text-red-500 bg-red-500/10',
      booking: 'text-green-500 bg-green-500/10',
      tech: 'text-blue-500 bg-blue-500/10',
      brand: 'text-purple-500 bg-purple-500/10',
      general: 'text-gray-500 bg-gray-500/10'
    };
    return colors[category] || colors.general;
  };

  const testOpenPhoneConnection = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/openphone/test-connection`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOpenPhoneConnected(response.data.data.connected);
    } catch (error) {
      console.error('Failed to test OpenPhone connection:', error);
      setOpenPhoneConnected(false);
    }
  };

  const importHistoricalConversations = async (daysBack: number = 30) => {
    try {
      setImporting(true);
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/openphone/import-history`,
        { daysBack },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(response.data.message);
      
      // Refresh stats
      if (activeTab === 'stats') {
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to import historical conversations:', error);
      toast.error('Failed to import conversations');
    } finally {
      setImporting(false);
    }
  };

  const processManualEntry = async () => {
    if (!manualEntry.trim()) {
      toast.error('Please enter some knowledge to add');
      return;
    }

    try {
      setProcessing(true);
      const token = localStorage.getItem('clubos_token');
      
      const response = await axios.post(
        `${API_URL}/knowledge/manual-entry`,
        { entry: manualEntry },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Check if this was a bulk import
      if (response.data.data.imported !== undefined) {
        const { imported, summary } = response.data.data;
        toast.success(
          `Bulk import complete: ${imported} items imported`,
          { duration: 5000 }
        );
        if (summary) {
          console.log('Import summary:', summary);
        }
      } else {
        // Single entry
        toast.success('Knowledge processed and added to SOP');
      }
      
      setManualEntry('');
      
      // Refresh stats
      if (activeTab === 'stats') {
        fetchStats();
      } else {
        // Switch to review tab to see imported items
        setActiveTab('review');
      }
    } catch (error) {
      console.error('Failed to process manual entry:', error);
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Failed to process knowledge. Check console for details.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const filteredKnowledge = knowledge.filter(k => 
    searchTerm === '' || 
    k.problem.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.solution.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold">Knowledge Extraction</h2>
          <p className="text-[var(--text-secondary)] mt-1">
            Extract and apply knowledge from OpenPhone conversations
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'stats'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <Activity className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('extract')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'extract'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <Brain className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'review'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'add'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Statistics Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Loading statistics...</p>
            </div>
          ) : stats ? (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="card">
                  <h3 className="text-sm text-[var(--text-secondary)] mb-1">Total Extracted</h3>
                  <p className="text-2xl font-bold">{stats.overview.total_extracted}</p>
                </div>
                <div className="card">
                  <h3 className="text-sm text-[var(--text-secondary)] mb-1">Applied</h3>
                  <p className="text-2xl font-bold text-green-500">{stats.overview.applied_count}</p>
                </div>
                <div className="card">
                  <h3 className="text-sm text-[var(--text-secondary)] mb-1">Pending Review</h3>
                  <p className="text-2xl font-bold text-yellow-500">{stats.overview.pending_count}</p>
                </div>
                <div className="card">
                  <h3 className="text-sm text-[var(--text-secondary)] mb-1">Avg Confidence</h3>
                  <p className="text-2xl font-bold">
                    {(stats.overview.avg_confidence * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="card">
                  <h3 className="text-sm text-[var(--text-secondary)] mb-1">Unique Sources</h3>
                  <p className="text-2xl font-bold">{stats.overview.unique_sources}</p>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Knowledge by Category</h3>
                <div className="space-y-3">
                  {stats.byCategory.map(cat => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm ${getCategoryColor(cat.category)}`}>
                          {cat.category}
                        </span>
                        <span className="text-sm text-[var(--text-secondary)]">
                          {cat.count} items
                        </span>
                      </div>
                      <span className="text-sm">
                        {(cat.avg_confidence * 100).toFixed(1)}% confidence
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No statistics available</p>
            </div>
          )}
        </div>
      )}

      {/* Extract Tab */}
      {activeTab === 'extract' && (
        <div className="space-y-6">
          {/* OpenPhone Connection Status */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Phone className="w-5 h-5" />
                OpenPhone Connection
              </h3>
              {openPhoneConnected !== null && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  openPhoneConnected 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {openPhoneConnected ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Connected
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Not Connected
                    </>
                  )}
                </div>
              )}
            </div>
            
            {!openPhoneConnected && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
                <p className="text-sm text-yellow-400">
                  <strong>Setup Required:</strong> Add OPENPHONE_API_KEY to your environment variables
                </p>
              </div>
            )}
            
            {/* Import Historical Data */}
            <div className="space-y-3">
              <h4 className="font-medium">Import Historical Conversations</h4>
              <p className="text-sm text-[var(--text-secondary)]">
                Import past conversations from OpenPhone to build your knowledge base
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => importHistoricalConversations(7)}
                  disabled={importing || !openPhoneConnected}
                  className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {importing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                  Import Last 7 Days
                </button>
                <button
                  onClick={() => importHistoricalConversations(30)}
                  disabled={importing || !openPhoneConnected}
                  className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  <Cloud className="w-4 h-4" />
                  Import Last 30 Days
                </button>
              </div>
            </div>
          </div>
          
          {/* Extract Knowledge */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Extract Knowledge from Conversations</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Process imported OpenPhone conversations to extract reusable knowledge
            </p>
            
            <div className="space-y-4">
            <button
              onClick={() => extractKnowledge(5)}
              disabled={extracting}
              className="w-full sm:w-auto px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {extracting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  Extract 5 Conversations
                </>
              )}
            </button>
            
            <button
              onClick={() => extractKnowledge(20)}
              disabled={extracting}
              className="w-full sm:w-auto px-6 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Brain className="w-4 h-4" />
              Extract 20 Conversations
            </button>
            
            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-400">
                <strong>Note:</strong> Knowledge extraction uses GPT-4 to analyze conversations. 
                Only high-confidence knowledge (60%+) will be stored for review.
              </p>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Review Tab */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search problems or solutions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg"
                />
              </div>
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg"
            >
              <option value="all">All Categories</option>
              <option value="emergency">Emergency</option>
              <option value="booking">Booking</option>
              <option value="tech">Tech Support</option>
              <option value="brand">Brand</option>
              <option value="general">General</option>
            </select>
            
            <button
              onClick={fetchUnappliedKnowledge}
              className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Selection Actions */}
          {selectedKnowledge.size > 0 && (
            <div className="flex items-center justify-between p-4 bg-[var(--accent)]/10 rounded-lg">
              <span className="text-sm">
                {selectedKnowledge.size} items selected
              </span>
              <button
                onClick={applySelectedKnowledge}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)]"
              >
                Apply to SOPs
              </button>
            </div>
          )}

          {/* Knowledge Items */}
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Loading knowledge items...</p>
            </div>
          ) : filteredKnowledge.length > 0 ? (
            <div className="space-y-4">
              {filteredKnowledge.map(item => (
                <div
                  key={item.id}
                  className={`card cursor-pointer transition-all ${
                    selectedKnowledge.has(item.id) ? 'ring-2 ring-[var(--accent)]' : ''
                  }`}
                  onClick={() => toggleKnowledgeSelection(item.id)}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedKnowledge.has(item.id)}
                      onChange={() => {}}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-full text-sm ${getCategoryColor(item.category)}`}>
                          {item.category}
                        </span>
                        <span className="text-sm text-[var(--text-secondary)]">
                          {(item.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm mb-1">Problem:</h4>
                        <p className="text-sm text-[var(--text-secondary)]">{item.problem}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm mb-1">Solution:</h4>
                        <p className="text-sm text-[var(--text-secondary)]">{item.solution}</p>
                      </div>
                      
                      <div className="text-xs text-[var(--text-muted)]">
                        Extracted {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pending knowledge items to review</p>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                Extract more conversations to see new knowledge
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Tab */}
      {activeTab === 'add' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Add Knowledge Manually</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Enter information you want to add to the SOP knowledge base. 
              The AI will format and categorize it appropriately.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Knowledge Entry / Document Import
                </label>
                <textarea
                  value={manualEntry}
                  onChange={(e) => setManualEntry(e.target.value)}
                  placeholder="Paste content here:
• Single knowledge items (e.g., 'Clubhouse Grey is #503285')
• Markdown documents (.md)
• JSON exports from OpenAI assistants
• Text from .docx files
• Multiple items separated by line breaks"
                  className="w-full min-h-[300px] p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg resize-y font-mono text-sm"
                  disabled={processing}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={processManualEntry}
                  disabled={processing || !manualEntry.trim()}
                  className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Add to Knowledge Base
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => setManualEntry('')}
                  disabled={processing || !manualEntry.trim()}
                  className="px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
            
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-400">
                  <strong>Supported Formats:</strong>
                </p>
                <ul className="text-sm text-blue-400 mt-2 space-y-1 list-disc list-inside">
                  <li><strong>Single Items:</strong> "Clubhouse Grey is #503285"</li>
                  <li><strong>Markdown:</strong> Paste entire .md files with headers and sections</li>
                  <li><strong>JSON:</strong> OpenAI assistant exports or knowledge bases</li>
                  <li><strong>Plain Text:</strong> Copy from .docx or any text source</li>
                  <li><strong>Bulk Import:</strong> Multiple items separated by line breaks</li>
                </ul>
              </div>
              
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-400">
                  <strong>Processing Notes:</strong>
                </p>
                <ul className="text-sm text-yellow-400 mt-2 space-y-1 list-disc list-inside">
                  <li>Large documents will be split into logical sections</li>
                  <li>Headers and structure will be preserved</li>
                  <li>The AI will categorize each piece appropriately</li>
                  <li>Duplicate detection prevents redundant entries</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};