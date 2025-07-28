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
  const [clearExisting, setClearExisting] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  const [originalEntry, setOriginalEntry] = useState('');

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
      emergency: 'text-red-600 bg-red-500/10',
      booking: 'text-green-600 bg-green-500/10',
      tech: 'text-blue-600 bg-blue-500/10',
      brand: 'text-purple-600 bg-purple-500/10',
      general: 'text-gray-600 bg-gray-500/10'
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

  const previewEntry = async () => {
    if (!manualEntry.trim()) {
      toast.error('Please enter some knowledge to preview');
      return;
    }

    try {
      setProcessing(true);
      const token = localStorage.getItem('clubos_token');
      
      // Store original entry for restore if cancelled
      setOriginalEntry(manualEntry);
      
      // For test mode, only process first 500 characters
      const entryToProcess = testMode ? manualEntry.substring(0, 500) + '\n\n[TEST MODE - Only first 500 characters processed]' : manualEntry;
      
      const response = await axios.post(
        `${API_URL}/knowledge/preview-entry`,
        { entry: entryToProcess },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const preview = response.data.data;
      setPreviewData(preview);
      
      // Set default selected categories
      const defaultSelection: Record<string, boolean> = {
        emergency: false,
        booking: false,
        tech: false,
        brand: false
      };
      
      if (preview.primaryCategory) {
        defaultSelection[preview.primaryCategory] = true;
      }
      
      // Also select other possible categories if suggested
      if (preview.possibleCategories) {
        preview.possibleCategories.forEach((cat: string) => {
          if (['emergency', 'booking', 'tech', 'brand'].includes(cat)) {
            defaultSelection[cat] = cat === preview.primaryCategory;
          }
        });
      }
      
      setSelectedCategories(defaultSelection);
      setShowPreview(true);
      
      // Clear the text area to save space since content is now in preview
      setManualEntry('');
      
    } catch (error) {
      console.error('Failed to preview entry:', error);
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Failed to preview knowledge. Check console for details.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const confirmImport = async () => {
    if (!previewData?.sections) {
      toast.error('No preview data available');
      return;
    }

    const selectedCats = Object.keys(selectedCategories).filter(k => selectedCategories[k]);
    if (selectedCats.length === 0) {
      toast.error('Please select at least one assistant category');
      return;
    }

    try {
      setConfirming(true);
      const token = localStorage.getItem('clubos_token');
      
      const response = await axios.post(
        `${API_URL}/knowledge/confirm-entry`,
        { 
          sections: previewData.sections,
          selectedCategories: selectedCategories,
          clearExisting: clearExisting && !testMode
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const result = response.data.data;
      const testPrefix = testMode ? 'TEST: ' : '';
      const clearSuffix = clearExisting && !testMode ? ' (replaced existing)' : '';
      const multiSuffix = selectedCats.length > 1 ? ` across ${selectedCats.length} assistants` : '';
      
      toast.success(
        `${testPrefix}Import complete: ${result.imported} sections imported${multiSuffix}${clearSuffix}`,
        { duration: 6000 }
      );
      
      // Reset form and replace text area with processed content summary
      const processedSummary = `// Import completed: ${result.imported} sections imported${multiSuffix}${clearSuffix}\n// Original content processed and categorized\n\n${previewData.sections.map((section: any, index: number) => 
        `Section ${index + 1}${section.title ? `: ${section.title}` : ''}\n${section.content}\n`
      ).join('\n')}`;
      
      setManualEntry(processedSummary);
      setPreviewData(null);
      setShowPreview(false);
      setClearExisting(false);
      setTestMode(false);
      setSelectedCategories({});
      
      // Refresh stats or switch to review tab
      if (activeTab === 'stats') {
        fetchStats();
      } else {
        setActiveTab('review');
      }
      
    } catch (error) {
      console.error('Failed to confirm import:', error);
      
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Failed to confirm import. Check console for details.');
      }
    } finally {
      setConfirming(false);
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
      
      // For test mode, only process first 500 characters
      const entryToProcess = testMode ? manualEntry.substring(0, 500) + '\n\n[TEST MODE - Only first 500 characters processed]' : manualEntry;
      
      const response = await axios.post(
        `${API_URL}/knowledge/manual-entry`,
        { 
          entry: entryToProcess,
          clearExisting: clearExisting && !testMode // Don't clear in test mode
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Check if this was a bulk import
      if (response.data.data.imported !== undefined) {
        const { imported, assistant, summary } = response.data.data;
        const testPrefix = testMode ? 'TEST: ' : '';
        const clearSuffix = clearExisting && !testMode ? ' (replaced existing)' : '';
        toast.success(
          `${testPrefix}Bulk import complete: ${imported} sections imported into ${assistant} assistant${clearSuffix}`,
          { duration: 6000 }
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
    <div className="space-y-4">
      {/* Segmented Pill Navigation */}
      <div className="inline-flex items-center p-1 bg-[var(--bg-secondary)] rounded-lg">
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'stats'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('extract')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'extract'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Extract
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'review'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Review
        </button>
        <button
          onClick={() => setActiveTab('add')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTab === 'add'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Import
        </button>
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
              {/* Compact Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Total</p>
                  <p className="text-xl font-semibold">{stats.overview.total_extracted}</p>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Applied</p>
                  <p className="text-xl font-semibold text-green-500">{stats.overview.applied_count}</p>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Pending</p>
                  <p className="text-xl font-semibold text-yellow-500">{stats.overview.pending_count}</p>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Confidence</p>
                  <p className="text-xl font-semibold">
                    {(stats.overview.avg_confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Sources</p>
                  <p className="text-xl font-semibold">{stats.overview.unique_sources}</p>
                </div>
              </div>

              {/* Category Breakdown - Compact */}
              <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3">By Category</h3>
                <div className="space-y-2">
                  {stats.byCategory.map(cat => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getCategoryColor(cat.category)}`}>
                          {cat.category}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {cat.count}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {(cat.avg_confidence * 100).toFixed(0)}%
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
          {/* OpenPhone Connection Status - Compact */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Phone className="w-4 h-4" />
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
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)]">Import Historical Data</p>
              <div className="flex gap-2">
                <button
                  onClick={() => importHistoricalConversations(7)}
                  disabled={importing || !openPhoneConnected}
                  className="px-3 py-1.5 text-xs bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  {importing ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Cloud className="w-3 h-3" />
                  )}
                  Last 7 Days
                </button>
                <button
                  onClick={() => importHistoricalConversations(30)}
                  disabled={importing || !openPhoneConnected}
                  className="px-3 py-1.5 text-xs bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Cloud className="w-3 h-3" />
                  Last 30 Days
                </button>
              </div>
            </div>
          </div>
          
          {/* Extract Knowledge - Compact */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2">Extract Knowledge</h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Process conversations to extract reusable knowledge
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
            <h3 className="text-lg font-semibold mb-4">Import to SOP System</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Import OpenAI assistant documents or knowledge directly into the SOP system. 
              Content will be automatically categorized into the correct assistant (emergency, booking, tech, brand) 
              and used immediately by the routing system.
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
              
              {/* Import Options */}
              <div className="space-y-3 p-4 bg-[var(--bg-tertiary)] rounded-lg">
                <h4 className="font-medium text-sm">Import Options</h4>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                    className="rounded"
                    disabled={processing}
                  />
                  <span className="text-sm">Test Mode (first 500 chars only)</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearExisting}
                    onChange={(e) => setClearExisting(e.target.checked)}
                    className="rounded"
                    disabled={processing || testMode}
                  />
                  <span className="text-sm">Replace existing content for this assistant</span>
                </label>
                
                {clearExisting && !testMode && (
                  <div className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded">
                    ⚠️ This will delete all existing content for the detected assistant category
                  </div>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={previewEntry}
                  disabled={processing || !manualEntry.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Preview Import
                    </>
                  )}
                </button>
                
                <button
                  onClick={processManualEntry}
                  disabled={processing || !manualEntry.trim()}
                  className="px-6 py-3 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Direct Import (old way)
                </button>
                
                <button
                  onClick={() => {
                    setManualEntry('');
                    setClearExisting(false);
                    setTestMode(false);
                  }}
                  disabled={processing}
                  className="px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-lg disabled:opacity-50"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Preview Section */}
            {showPreview && previewData && (
              <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-green-400">Import Preview</h4>
                  <button
                    onClick={() => {
                      setShowPreview(false);
                      setPreviewData(null);
                      setSelectedCategories({});
                      // Restore original content
                      setManualEntry(originalEntry);
                      setOriginalEntry('');
                    }}
                    className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  >
                    Close Preview
                  </button>
                </div>

                {/* Category Selection */}
                <div className="mb-4">
                  <h5 className="text-sm font-medium mb-2">Target Assistant Categories:</h5>
                  <div className="flex flex-wrap gap-2">
                    {['emergency', 'booking', 'tech', 'brand'].map(category => (
                      <label key={category} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCategories[category] || false}
                          onChange={(e) => setSelectedCategories({
                            ...selectedCategories,
                            [category]: e.target.checked
                          })}
                          className="rounded"
                        />
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(category)}`}>
                          {category}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Preview Content */}
                <div className="space-y-4">
                  <div>
                    <h5 className="text-sm font-medium mb-2">Detected Primary Category:</h5>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(previewData.primaryCategory || 'general')}`}>
                      {previewData.primaryCategory || 'None detected'}
                    </span>
                  </div>

                  {previewData.sections && previewData.sections.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium mb-2">Parsed Sections ({previewData.sections.length}):</h5>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {previewData.sections.map((section: any, index: number) => (
                          <div key={index} className="bg-[var(--bg-secondary)] rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-[var(--text-muted)]">
                                Section {index + 1}
                              </span>
                              {section.category && (
                                <span className={`px-2 py-0.5 rounded-full text-xs ${getCategoryColor(section.category)}`}>
                                  {section.category}
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {section.title && (
                                <div>
                                  <span className="text-xs text-[var(--text-muted)]">Title:</span>
                                  <input
                                    type="text"
                                    value={section.title}
                                    onChange={(e) => {
                                      const newSections = [...previewData.sections];
                                      newSections[index] = { ...section, title: e.target.value };
                                      setPreviewData({ ...previewData, sections: newSections });
                                    }}
                                    className="w-full mt-1 px-2 py-1 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded"
                                  />
                                </div>
                              )}
                              <div>
                                <span className="text-xs text-[var(--text-muted)]">Content:</span>
                                <textarea
                                  value={section.content}
                                  onChange={(e) => {
                                    const newSections = [...previewData.sections];
                                    newSections[index] = { ...section, content: e.target.value };
                                    setPreviewData({ ...previewData, sections: newSections });
                                  }}
                                  className="w-full mt-1 px-2 py-1 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded min-h-[60px] resize-y"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confirm Import Button */}
                  <div className="flex gap-3 pt-4 border-t border-[var(--border-primary)]">
                    <button
                      onClick={confirmImport}
                      disabled={confirming || Object.values(selectedCategories).every(v => !v)}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {confirming ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Confirm Import
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowPreview(false);
                        setPreviewData(null);
                        setSelectedCategories({});
                        // Restore original content
                        setManualEntry(originalEntry);
                        setOriginalEntry('');
                      }}
                      disabled={confirming}
                      className="px-4 py-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
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