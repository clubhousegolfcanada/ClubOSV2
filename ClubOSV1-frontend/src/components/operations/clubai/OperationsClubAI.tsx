import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Shield, Database, Power, Hash, Users, TrendingUp, ChevronDown, ChevronUp, RefreshCw, Search, Plus, Send, Check, X, Edit3, Clock, Eye, EyeOff, AlertTriangle, Trash2, BookOpen, Filter } from 'lucide-react';
import apiClient from '@/api/http';

// ============================================
// TYPES
// ============================================

interface ClubAIConfig {
  enabled: boolean;
  shadowMode: boolean;
  approvalMode: boolean;
  maxMessages: number;
}

interface DraftResponse {
  id: number;
  conversation_id: string;
  phone_number: string;
  customer_name: string | null;
  customer_message: string;
  ai_response: string;
  confidence: number;
  escalate: boolean;
  status: string;
  created_at: string;
}

interface ClubAIStats {
  conversationsToday: number;
  messagesSent: number;
  escalated: number;
  resolved: number;
  correctionsToday: number;
  accuracyRate: number;
}

interface SafetyThresholds {
  rapidMessageThreshold: number;
  rapidMessageWindowSeconds: number;
  rapidMessageEnabled: boolean;
  aiResponseLimit: number;
  aiResponseLimitEnabled: boolean;
  operatorLockoutHours: number;
  topicLockoutEnabled: boolean;
  globalCooldownMinutes: number;
  negativeSentimentEnabled: boolean;
}

interface KnowledgeStats {
  total: number;
  conversations: number;
  website: number;
  manual: number;
  withEmbeddings: number;
  avgConfidence: number;
}

interface ConversationMessage {
  sender_type: 'customer' | 'ai' | 'operator' | 'system';
  message_text: string;
  pattern_confidence: number | null;
  created_at: string;
}

interface Escalation {
  id: string;
  phone_number: string;
  customer_name: string | null;
  clubai_escalation_reason: string | null;
  clubai_messages_sent: number;
  updated_at: string;
  messages: ConversationMessage[] | null;
  operator_responded: boolean;
}

interface ClubAIConversation {
  id: string;
  phone_number: string;
  customer_name: string | null;
  clubai_active: boolean;
  clubai_messages_sent: number;
  clubai_escalated: boolean;
  clubai_escalation_reason: string | null;
  updated_at: string;
  messages: ConversationMessage[] | null;
}

interface KnowledgeEntry {
  id: number;
  source_type: 'conversation' | 'website' | 'manual';
  intent: string | null;
  customer_message: string | null;
  team_response: string;
  source_url: string | null;
  page_section: string | null;
  confidence_score: number;
  use_count: number;
  feedback_up: number;
  feedback_down: number;
  is_active: boolean;
  created_at: string;
}

const INTENT_OPTIONS = [
  'general_inquiry', 'sim_frozen', 'pricing', 'door_access', 'booking_change',
  'club_rental', 'wifi', 'side_screens', 'ball_not_registering', 'login_qr_issue',
  'refund_request', 'gift_card', 'food_drink', 'how_long_18', 'tech_support',
];

// ============================================
// COMPONENT
// ============================================

export const OperationsClubAI: React.FC = () => {
  // Config & stats
  const [config, setConfig] = useState<ClubAIConfig>({ enabled: false, shadowMode: true, approvalMode: false, maxMessages: 5 });

  // Escalation queue
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [escalationsLoading, setEscalationsLoading] = useState(false);
  const [expandedEscalation, setExpandedEscalation] = useState<string | null>(null);

  // Drafts (approval mode)
  const [drafts, setDrafts] = useState<DraftResponse[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [editingDraft, setEditingDraft] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [stats, setStats] = useState<ClubAIStats>({ conversationsToday: 0, messagesSent: 0, escalated: 0, resolved: 0, correctionsToday: 0, accuracyRate: 100 });
  const [safety, setSafety] = useState<SafetyThresholds>({
    rapidMessageThreshold: 3, rapidMessageWindowSeconds: 60, rapidMessageEnabled: true,
    aiResponseLimit: 3, aiResponseLimitEnabled: true, operatorLockoutHours: 4,
    topicLockoutEnabled: true, globalCooldownMinutes: 60, negativeSentimentEnabled: true
  });
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats | null>(null);

  // Conversations
  const [conversations, setConversations] = useState<ClubAIConversation[]>([]);
  const [convoFilter, setConvoFilter] = useState<'all' | 'today' | 'escalated' | 'active'>('today');
  const [expandedConvo, setExpandedConvo] = useState<string | null>(null);
  const [convoLoading, setConvoLoading] = useState(false);

  // Knowledge management
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newIntent, setNewIntent] = useState('general_inquiry');
  const [addingKnowledge, setAddingKnowledge] = useState(false);
  const [showSmartPaste, setShowSmartPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<Array<{ id: number; question: string; answer: string; intent: string }> | null>(null);
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<Array<{ knowledge_id: number; source_type: string; intent: string; customer_message: string; team_response: string; page_section: string; similarity: number }> | null>(null);
  const [testing, setTesting] = useState(false);
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(false);

  // Knowledge browser
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserEntries, setBrowserEntries] = useState<KnowledgeEntry[]>([]);
  const [browserTotal, setBrowserTotal] = useState(0);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserSourceFilter, setBrowserSourceFilter] = useState<string>('');
  const [browserIntentFilter, setBrowserIntentFilter] = useState<string>('');
  const [browserPage, setBrowserPage] = useState(0);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [editEntryIntent, setEditEntryIntent] = useState('');
  const [editEntryQuestion, setEditEntryQuestion] = useState('');
  const [editEntryAnswer, setEditEntryAnswer] = useState('');
  const [editEntryConfidence, setEditEntryConfidence] = useState(0.95);
  const [savingEntry, setSavingEntry] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [conflictEntries, setConflictEntries] = useState<KnowledgeEntry[] | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Conversation correction
  const [correctingMsg, setCorrectingMsg] = useState<{ convoId: string; msgIndex: number; customerMsg: string; originalResponse: string } | null>(null);
  const [correctionText, setCorrectionText] = useState('');
  const [correctionIntent, setCorrectionIntent] = useState('general_inquiry');
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSafety, setShowSafety] = useState(false);

  // Debounce ref for slider
  const sliderTimeout = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, statsRes, safetyRes, kStatsRes] = await Promise.all([
        apiClient.get('/patterns/clubai-config').catch(() => ({ data: { data: config } })),
        apiClient.get('/patterns/clubai-stats').catch(() => ({ data: { data: stats } })),
        apiClient.get('/patterns/safety-thresholds').catch(() => ({ data: { data: safety } })),
        apiClient.get('/patterns/clubai-knowledge-stats').catch(() => ({ data: { data: null } })),
      ]);
      if (configRes.data?.data) setConfig(configRes.data.data);
      if (statsRes.data?.data) setStats(statsRes.data.data);
      const safetyData = safetyRes.data?.data || safetyRes.data?.thresholds;
      if (safetyData) setSafety(prev => ({ ...prev, ...safetyData }));
      if (kStatsRes.data?.data) setKnowledgeStats(kStatsRes.data.data);
    } catch { /* defaults fine */ }
    setLoading(false);
  }, []);

  const fetchConversations = useCallback(async () => {
    setConvoLoading(true);
    try {
      const res = await apiClient.get(`/patterns/clubai-conversations?filter=${convoFilter}&limit=20`);
      if (res.data?.data) setConversations(res.data.data);
    } catch { /* empty */ }
    setConvoLoading(false);
  }, [convoFilter]);

  const fetchEscalations = useCallback(async () => {
    setEscalationsLoading(true);
    try {
      const res = await apiClient.get('/patterns/clubai-escalations');
      if (res.data?.waiting) setEscalations(res.data.waiting);
    } catch { /* */ }
    setEscalationsLoading(false);
  }, []);

  const resolveEscalation = async (id: string) => {
    try {
      await apiClient.post(`/patterns/clubai-escalations/${id}/resolve`);
      setEscalations(prev => prev.filter(e => e.id !== id));
    } catch { /* */ }
  };

  const fetchDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const res = await apiClient.get('/patterns/clubai-drafts?status=pending');
      if (res.data?.data) setDrafts(res.data.data);
    } catch { /* */ }
    setDraftsLoading(false);
  }, []);

  useEffect(() => { fetchAll(); fetchEscalations(); }, [fetchAll, fetchEscalations]);
  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => { if (config.approvalMode) fetchDrafts(); }, [config.approvalMode, fetchDrafts]);

  // ============================================
  // ACTIONS
  // ============================================

  const saveConfig = async (updates: Partial<ClubAIConfig>) => {
    setSaving(true);
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    try {
      await apiClient.put('/patterns/clubai-config', newConfig);
    } catch { setConfig(config); }
    setSaving(false);
  };

  const saveConfigDebounced = (updates: Partial<ClubAIConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    if (sliderTimeout.current) clearTimeout(sliderTimeout.current);
    sliderTimeout.current = setTimeout(async () => {
      try { await apiClient.put('/patterns/clubai-config', newConfig); }
      catch { setConfig(config); }
    }, 500);
  };

  const saveSafety = async (updates: Partial<SafetyThresholds>) => {
    setSaving(true);
    const newSafety = { ...safety, ...updates };
    setSafety(newSafety);
    try {
      await apiClient.put('/patterns/safety-thresholds', newSafety);
    } catch { setSafety(safety); }
    setSaving(false);
  };

  const parseKnowledge = async () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    setParsedEntries(null);
    try {
      const res = await apiClient.post('/patterns/clubai-knowledge-parse', { rawText: pasteText.trim() });
      if (res.data?.data) {
        setParsedEntries(res.data.data);
        setPasteText('');
        // Refresh stats
        const kRes = await apiClient.get('/patterns/clubai-knowledge-stats').catch(() => ({ data: { data: null } }));
        if (kRes.data?.data) setKnowledgeStats(kRes.data.data);
      }
    } catch { setParsedEntries([]); }
    setParsing(false);
  };

  const addKnowledgeEntry = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    setAddingKnowledge(true);
    try {
      await apiClient.post('/patterns/clubai-knowledge-manual', {
        intent: newIntent,
        customerQuestion: newQuestion.trim(),
        teamResponse: newAnswer.trim(),
      });
      setNewQuestion('');
      setNewAnswer('');
      setShowAddKnowledge(false);
      // Refresh stats
      const kRes = await apiClient.get('/patterns/clubai-knowledge-stats').catch(() => ({ data: { data: null } }));
      if (kRes.data?.data) setKnowledgeStats(kRes.data.data);
    } catch { /* */ }
    setAddingKnowledge(false);
  };

  const approveDraft = async (id: number) => {
    try {
      await apiClient.post(`/patterns/clubai-drafts/${id}/approve`);
      setDrafts(prev => prev.filter(d => d.id !== id));
    } catch { /* */ }
  };

  const rejectDraft = async (id: number) => {
    try {
      await apiClient.post(`/patterns/clubai-drafts/${id}/reject`);
      setDrafts(prev => prev.filter(d => d.id !== id));
    } catch { /* */ }
  };

  const editDraft = async (id: number) => {
    if (!editText.trim()) return;
    try {
      await apiClient.post(`/patterns/clubai-drafts/${id}/edit`, { editedResponse: editText.trim() });
      setDrafts(prev => prev.filter(d => d.id !== id));
      setEditingDraft(null);
      setEditText('');
    } catch { /* */ }
  };

  const runTestSearch = async () => {
    if (!testQuery.trim()) return;
    setTesting(true);
    try {
      const res = await apiClient.post('/patterns/clubai-knowledge-search', { query: testQuery.trim() });
      if (res.data?.data) setTestResults(res.data.data);
    } catch { setTestResults([]); }
    setTesting(false);
  };

  // ============================================
  // KNOWLEDGE BROWSER
  // ============================================

  const BROWSER_PAGE_SIZE = 25;

  const fetchBrowserEntries = useCallback(async (page = 0) => {
    setBrowserLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(BROWSER_PAGE_SIZE),
        offset: String(page * BROWSER_PAGE_SIZE),
      });
      if (browserSourceFilter) params.set('source_type', browserSourceFilter);
      if (browserIntentFilter) params.set('intent', browserIntentFilter);
      const res = await apiClient.get(`/patterns/clubai-knowledge-entries?${params}`);
      if (res.data?.data) {
        setBrowserEntries(res.data.data);
        setBrowserTotal(res.data.total || 0);
      }
    } catch { setBrowserEntries([]); }
    setBrowserLoading(false);
  }, [browserSourceFilter, browserIntentFilter]);

  useEffect(() => {
    if (showBrowser) {
      setBrowserPage(0);
      fetchBrowserEntries(0);
    }
  }, [showBrowser, fetchBrowserEntries]);

  const handleBrowserPageChange = (newPage: number) => {
    setBrowserPage(newPage);
    fetchBrowserEntries(newPage);
  };

  const startEditEntry = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setEditEntryIntent(entry.intent || 'general_inquiry');
    setEditEntryQuestion(entry.customer_message || '');
    setEditEntryAnswer(entry.team_response);
    setEditEntryConfidence(entry.confidence_score);
  };

  const saveEditEntry = async () => {
    if (!editingEntry) return;
    setSavingEntry(true);
    try {
      await apiClient.put(`/patterns/clubai-knowledge/${editingEntry.id}`, {
        intent: editEntryIntent,
        customerQuestion: editEntryQuestion || undefined,
        teamResponse: editEntryAnswer,
        confidenceScore: editEntryConfidence,
      });
      // Refresh the list
      await fetchBrowserEntries(browserPage);
      setEditingEntry(null);
      // Refresh stats too
      const kRes = await apiClient.get('/patterns/clubai-knowledge-stats').catch(() => ({ data: { data: null } }));
      if (kRes.data?.data) setKnowledgeStats(kRes.data.data);
    } catch { /* */ }
    setSavingEntry(false);
  };

  const toggleEntryActive = async (id: number, currentlyActive: boolean) => {
    setTogglingId(id);
    try {
      await apiClient.patch(`/patterns/clubai-knowledge/${id}/toggle`, { active: !currentlyActive });
      setBrowserEntries(prev => prev.map(e =>
        e.id === id ? { ...e, is_active: !currentlyActive } : e
      ));
    } catch { /* */ }
    setTogglingId(null);
  };

  const deleteEntry = async (id: number) => {
    if (!confirm('Permanently delete this entry? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/patterns/clubai-knowledge/${id}`);
      setBrowserEntries(prev => prev.filter(e => e.id !== id));
      setBrowserTotal(prev => prev - 1);
      const kRes = await apiClient.get('/patterns/clubai-knowledge-stats').catch(() => ({ data: { data: null } }));
      if (kRes.data?.data) setKnowledgeStats(kRes.data.data);
    } catch { /* */ }
  };

  const checkConflicts = async (intent: string) => {
    if (!intent) { setConflictEntries(null); return; }
    try {
      const res = await apiClient.get(`/patterns/clubai-knowledge-conflicts?intent=${intent}`);
      if (res.data?.data) setConflictEntries(res.data.data);
    } catch { setConflictEntries(null); }
  };

  // ============================================
  // CONVERSATION CORRECTIONS
  // ============================================

  const startCorrection = (convoId: string, msgIndex: number, messages: ConversationMessage[]) => {
    // Find the AI message and the preceding customer message
    const aiMsg = messages[msgIndex];
    if (!aiMsg || aiMsg.sender_type !== 'ai') return;

    // Walk backwards to find the customer message this AI responded to
    let customerMsg = '';
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].sender_type === 'customer') {
        customerMsg = messages[i].message_text;
        break;
      }
    }

    setCorrectingMsg({ convoId, msgIndex, customerMsg, originalResponse: aiMsg.message_text });
    setCorrectionText(aiMsg.message_text);
    setCorrectionIntent('general_inquiry');
    setCorrectionSuccess(null);
  };

  const saveCorrection = async () => {
    if (!correctingMsg || !correctionText.trim()) return;
    setSavingCorrection(true);
    try {
      const res = await apiClient.post('/patterns/clubai-correct', {
        customerMessage: correctingMsg.customerMsg,
        originalResponse: correctingMsg.originalResponse,
        correctedResponse: correctionText.trim(),
        intent: correctionIntent,
      });
      const data = res.data?.data;
      const corrType = data?.correctionType || 'factual';
      const summary = data?.correctionSummary || '';
      // Build a descriptive success message based on correction type
      const typeLabels: Record<string, string> = {
        factual: 'Factual correction saved to knowledge base',
        completeness: 'Missing info added to knowledge base',
        tone: 'Tone correction saved — ClubAI will adjust its style',
        brevity: 'Brevity correction saved — ClubAI will keep it shorter',
        escalation: 'Escalation correction logged',
      };
      const msg = (typeLabels[corrType] || res.data?.message || 'Correction saved')
        + (summary ? ` (${summary})` : '');
      setCorrectionSuccess(msg);
      setCorrectingMsg(null);
      setCorrectionText('');
      // Refresh knowledge stats and main stats
      const [kRes, sRes] = await Promise.all([
        apiClient.get('/patterns/clubai-knowledge-stats').catch(() => ({ data: { data: null } })),
        apiClient.get('/patterns/clubai-stats').catch(() => ({ data: { data: null } })),
      ]);
      if (kRes.data?.data) setKnowledgeStats(kRes.data.data);
      if (sRes.data?.data) setStats(sRes.data.data);
      // Clear success message after 6 seconds (longer to read the type + summary)
      setTimeout(() => setCorrectionSuccess(null), 6000);
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || 'Failed to save correction — check backend logs';
      setCorrectionSuccess(null);
      setCorrectionError(errMsg);
      setTimeout(() => setCorrectionError(null), 8000);
    }
    setSavingCorrection(false);
  };

  // ============================================
  // HELPERS
  // ============================================

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return d.toLocaleDateString();
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11 && clean[0] === '1') {
      return `(${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-500">Loading ClubAI...</div>
      </div>
    );
  }

  const resolutionRate = stats.conversationsToday > 0
    ? Math.round((stats.resolved / stats.conversationsToday) * 100) : 0;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-[var(--accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">ClubAI</h2>
            <p className="text-sm text-[var(--text-secondary)]">RAG-powered conversational SMS support</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          !config.enabled ? 'bg-gray-100 text-gray-600' :
          config.shadowMode ? 'bg-yellow-100 text-yellow-700' :
          config.approvalMode ? 'bg-blue-100 text-blue-700' :
          'bg-green-100 text-green-700'
        }`}>
          {!config.enabled ? 'Disabled' : config.shadowMode ? 'Shadow Mode' : config.approvalMode ? 'Approval Mode' : 'Live'}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Power className="w-4 h-4" /> Controls
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">ClubAI Enabled</p>
              <p className="text-xs text-[var(--text-secondary)]">Master switch for AI responses</p>
            </div>
            <button
              onClick={() => saveConfig({ enabled: !config.enabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${config.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              disabled={saving}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.enabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Mode selector: Shadow / Approval / Auto */}
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-2">Response Mode</p>
            <div className="flex rounded-lg border border-[var(--border-primary)] overflow-hidden text-xs">
              {([
                { key: 'shadow', label: 'Shadow', desc: 'Log only, don\'t send', color: 'bg-yellow-500' },
                { key: 'approval', label: 'Approval', desc: 'Draft + operator reviews', color: 'bg-blue-500' },
                { key: 'auto', label: 'Auto-Send', desc: 'Send immediately', color: 'bg-green-500' },
              ] as const).map(mode => {
                const isActive =
                  (mode.key === 'shadow' && config.shadowMode && !config.approvalMode) ||
                  (mode.key === 'approval' && config.approvalMode && !config.shadowMode) ||
                  (mode.key === 'auto' && !config.shadowMode && !config.approvalMode);
                return (
                  <button
                    key={mode.key}
                    onClick={() => {
                      if (mode.key === 'shadow') saveConfig({ shadowMode: true, approvalMode: false });
                      else if (mode.key === 'approval') saveConfig({ shadowMode: false, approvalMode: true });
                      else saveConfig({ shadowMode: false, approvalMode: false });
                    }}
                    disabled={saving}
                    className={`flex-1 px-3 py-2 text-center transition-colors ${
                      isActive ? `${mode.color} text-white` : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <p className="font-medium">{mode.label}</p>
                    <p className="text-[10px] opacity-80">{mode.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Max Messages per Conversation</p>
              <p className="text-xs text-[var(--text-secondary)]">Escalate to human after this many AI messages</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range" min="2" max="10"
                value={config.maxMessages}
                onChange={(e) => saveConfigDebounced({ maxMessages: parseInt(e.target.value) })}
                className="w-24" disabled={saving}
              />
              <span className="text-sm font-mono text-[var(--text-primary)] w-6 text-center">{config.maxMessages}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Conversations', value: stats.conversationsToday, icon: MessageSquare, color: 'text-blue-500' },
          { label: 'Messages Sent', value: stats.messagesSent, icon: Hash, color: 'text-green-500' },
          { label: 'Escalated', value: stats.escalated, icon: Users, color: 'text-orange-500' },
          { label: 'Corrections', value: stats.correctionsToday, icon: Edit3, color: 'text-purple-500' },
          { label: 'Accuracy', value: `${stats.accuracyRate}%`, icon: TrendingUp, color: stats.accuracyRate >= 90 ? 'text-green-500' : stats.accuracyRate >= 70 ? 'text-yellow-500' : 'text-red-500' },
          { label: 'Resolution', value: `${resolutionRate}%`, icon: Check, color: 'text-green-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <p className="text-xs text-[var(--text-secondary)]">{label}</p>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Escalation Queue */}
      {escalations.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-500" /> Waiting for Operator
              <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px]">{escalations.length}</span>
            </h3>
            <button onClick={fetchEscalations} className="p-1.5 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors">
              <RefreshCw className={`w-4 h-4 text-orange-500 ${escalationsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="space-y-2">
            {escalations.map(esc => (
              <div key={esc.id} className="rounded-lg border border-orange-200 dark:border-orange-800 bg-[var(--bg-primary)]">
                <button
                  onClick={() => setExpandedEscalation(expandedEscalation === esc.id ? null : esc.id)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {esc.customer_name || formatPhone(esc.phone_number)}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {esc.clubai_escalation_reason || 'ClubAI escalated'} · {formatTime(esc.updated_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); resolveEscalation(esc.id); }}
                      className="px-2 py-1 text-[10px] rounded bg-green-500 text-white hover:bg-green-600"
                    >
                      Mark Resolved
                    </button>
                    {expandedEscalation === esc.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {expandedEscalation === esc.id && esc.messages && (
                  <div className="px-3 pb-3 space-y-2 border-t border-[var(--border-primary)] pt-2">
                    {esc.messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.sender_type === 'customer' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                          msg.sender_type === 'customer'
                            ? 'bg-gray-100 dark:bg-gray-800 text-[var(--text-primary)]'
                            : msg.sender_type === 'ai'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100'
                        }`}>
                          <span className="font-semibold text-[10px] uppercase opacity-60">
                            {msg.sender_type === 'customer' ? 'Customer' : msg.sender_type === 'ai' ? 'ClubAI' : 'Operator'}
                          </span>
                          <p className="whitespace-pre-wrap mt-0.5">{msg.message_text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Draft Review Queue (approval mode) */}
      {config.approvalMode && (
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" /> Pending Drafts
              <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px]">{drafts.length}</span>
            </h3>
            <button onClick={fetchDrafts} className="p-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
              <RefreshCw className={`w-4 h-4 text-blue-500 ${draftsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="space-y-3">
            {drafts.length === 0 && (
              <p className="text-xs text-[var(--text-secondary)] text-center py-4">No pending drafts. When a customer texts, ClubAI will generate a draft here for your review.</p>
            )}
            {drafts.map(draft => (
              <div key={draft.id} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-[var(--text-primary)]">
                      {draft.customer_name || formatPhone(draft.phone_number)}
                    </p>
                    <span className="text-[10px] text-[var(--text-secondary)]">{formatTime(draft.created_at)}</span>
                    {draft.escalate && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">ESCALATION</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {(draft.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>

                {/* Customer message */}
                <div className="bg-gray-100 dark:bg-gray-800 rounded px-3 py-2 mb-2">
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-0.5">Customer</p>
                  <p className="text-xs text-[var(--text-primary)]">{draft.customer_message}</p>
                </div>

                {/* AI draft */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded px-3 py-2 mb-3">
                  <p className="text-[10px] font-semibold text-blue-600 uppercase mb-0.5">ClubAI Draft</p>
                  <p className="text-xs text-[var(--text-primary)]">{draft.ai_response}</p>
                </div>

                {/* Edit mode */}
                {editingDraft === draft.id ? (
                  <div className="space-y-2 mb-3">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full text-xs p-2 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] resize-none"
                      placeholder="Type your edited response..."
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditingDraft(null); setEditText(''); }} className="px-2 py-1 text-xs rounded border border-[var(--border-primary)] text-[var(--text-secondary)]">Cancel</button>
                      <button onClick={() => editDraft(draft.id)} className="px-2 py-1 text-xs rounded bg-blue-500 text-white">Send Edited</button>
                    </div>
                  </div>
                ) : (
                  /* Action buttons */
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveDraft(draft.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                    >
                      <Check className="w-3 h-3" /> Approve & Send
                    </button>
                    <button
                      onClick={() => { setEditingDraft(draft.id); setEditText(draft.ai_response); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => rejectDraft(draft.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Base Stats */}
      {knowledgeStats && (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <Database className="w-4 h-4" /> Knowledge Base
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Past Conversations</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{knowledgeStats.conversations}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Website Pages</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{knowledgeStats.website}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Manual Entries</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{knowledgeStats.manual}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Avg Confidence</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{(knowledgeStats.avgConfidence * 100).toFixed(0)}%</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              onClick={() => { setShowBrowser(!showBrowser); setShowSmartPaste(false); setShowAddKnowledge(false); setShowKnowledgePanel(false); }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showBrowser
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border-primary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
              }`}
            >
              <BookOpen className="w-3 h-3" /> Browse Entries
            </button>
            <button
              onClick={() => { setShowSmartPaste(!showSmartPaste); setShowAddKnowledge(false); setShowBrowser(false); setShowKnowledgePanel(false); }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showSmartPaste
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border-primary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
              }`}
            >
              <Plus className="w-3 h-3" /> Add Knowledge
            </button>
            <button
              onClick={() => { setShowAddKnowledge(!showAddKnowledge); setShowSmartPaste(false); setShowBrowser(false); setShowKnowledgePanel(false); }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showAddKnowledge
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border-primary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
              }`}
            >
              <Edit3 className="w-3 h-3" /> Manual Entry
            </button>
            <button
              onClick={() => { setShowKnowledgePanel(!showKnowledgePanel); setShowSmartPaste(false); setShowAddKnowledge(false); setShowBrowser(false); }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                showKnowledgePanel
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border-primary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'
              }`}
            >
              <Search className="w-3 h-3" /> Test Search
            </button>
          </div>

          {/* Smart Paste — paste any info and AI parses it */}
          {showSmartPaste && (
            <div className="mt-3 p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] space-y-2">
              <p className="text-xs font-medium text-[var(--text-primary)]">Add Knowledge</p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                Paste any information — policy updates, new pricing, instructions, FAQ answers, etc. AI will parse it into Q&A pairs that ClubAI can use to answer customers.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
                placeholder="e.g. 'We now offer a 10-pack of hours for $300. Valid at all locations. Must be used within 6 months.'"
                className="w-full text-xs p-2 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] resize-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowSmartPaste(false); setPasteText(''); setParsedEntries(null); }}
                  className="px-3 py-1.5 text-xs rounded border border-[var(--border-primary)] text-[var(--text-secondary)]">
                  Cancel
                </button>
                <button onClick={parseKnowledge}
                  disabled={parsing || !pasteText.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50">
                  {parsing ? 'Parsing...' : 'Add to Knowledge Base'}
                </button>
              </div>
              {parsedEntries && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs font-medium text-green-600">{parsedEntries.length} entries added:</p>
                  {parsedEntries.map((e, i) => (
                    <div key={i} className="p-2 rounded bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 text-xs">
                      <p className="text-[10px] text-green-600 font-medium">{e.intent}</p>
                      <p className="text-[var(--text-secondary)]">Q: {e.question}</p>
                      <p className="text-[var(--text-primary)]">A: {e.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add Manual Knowledge Entry */}
          {showAddKnowledge && (
            <div className="mt-3 p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] space-y-2">
              <p className="text-xs font-medium text-[var(--text-primary)]">Add Knowledge Entry</p>
              <select
                value={newIntent}
                onChange={(e) => { setNewIntent(e.target.value); checkConflicts(e.target.value); }}
                className="w-full text-xs p-2 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
              >
                {INTENT_OPTIONS.map(i => (
                  <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>
                ))}
              </select>

              {/* Conflict detection */}
              {conflictEntries && conflictEntries.length > 0 && (
                <div className="p-2 rounded border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/10">
                  <p className="text-[10px] font-medium text-yellow-700 dark:text-yellow-400 flex items-center gap-1 mb-1.5">
                    <AlertTriangle className="w-3 h-3" />
                    {conflictEntries.length} existing {newIntent.replace(/_/g, ' ')} entries — review for conflicts
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {conflictEntries.slice(0, 5).map(ce => (
                      <div key={ce.id} className="flex items-start justify-between gap-2 p-1.5 rounded bg-[var(--bg-primary)] text-[10px]">
                        <div className="min-w-0">
                          {ce.customer_message && (
                            <p className="text-[var(--text-secondary)] truncate">Q: {ce.customer_message}</p>
                          )}
                          <p className="text-[var(--text-primary)] truncate">A: {ce.team_response.substring(0, 120)}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`px-1 py-0.5 rounded ${ce.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {ce.is_active ? 'active' : 'inactive'}
                            </span>
                            <span className="text-[var(--text-secondary)]">{ce.source_type} · {(ce.confidence_score * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        {ce.is_active && (
                          <button
                            onClick={() => toggleEntryActive(ce.id, true)}
                            className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
                            title="Deactivate this conflicting entry"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Customer question (e.g. 'How much does it cost?')"
                className="w-full text-xs p-2 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
              />
              <textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="Team response (e.g. 'It's $35/hr standard, $25/hr mornings...')"
                rows={3}
                className="w-full text-xs p-2 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowAddKnowledge(false); setConflictEntries(null); }}
                  className="px-3 py-1.5 text-xs rounded border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  Cancel
                </button>
                <button
                  onClick={addKnowledgeEntry}
                  disabled={addingKnowledge || !newQuestion.trim() || !newAnswer.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" /> {addingKnowledge ? 'Adding...' : 'Add Entry'}
                </button>
              </div>
            </div>
          )}

          {/* Test Search */}
          {showKnowledgePanel && (
            <div className="mt-3 p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] space-y-2">
              <p className="text-xs font-medium text-[var(--text-primary)]">Test RAG Search</p>
              <p className="text-[10px] text-[var(--text-secondary)]">Type a customer message to see what knowledge ClubAI would find</p>
              <div className="flex gap-2">
                <input
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runTestSearch()}
                  placeholder="e.g. 'how much does it cost' or 'screen is frozen'"
                  className="flex-1 text-xs p-2 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                />
                <button
                  onClick={runTestSearch}
                  disabled={testing || !testQuery.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="w-3 h-3" /> {testing ? '...' : 'Search'}
                </button>
              </div>
              {testResults && (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {testResults.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)] py-2 text-center">No matches found</p>
                  ) : (
                    testResults.map((r) => (
                      <div key={r.knowledge_id} className="p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            r.source_type === 'conversation' ? 'bg-blue-100 text-blue-700' :
                            r.source_type === 'website' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {r.source_type}{r.intent ? ` / ${r.intent}` : ''}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            {(r.similarity * 100).toFixed(0)}% match
                          </span>
                        </div>
                        {r.customer_message && (
                          <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">Q: {r.customer_message.substring(0, 100)}</p>
                        )}
                        {r.page_section && (
                          <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">[{r.page_section}]</p>
                        )}
                        <p className="text-xs text-[var(--text-primary)]">{r.team_response.substring(0, 200)}{r.team_response.length > 200 ? '...' : ''}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Knowledge Browser */}
          {showBrowser && (
            <div className="mt-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)]">
              {/* Browser header with filters */}
              <div className="p-3 border-b border-[var(--border-primary)]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    <Filter className="w-3 h-3" /> Browse Knowledge Entries
                    <span className="text-[var(--text-secondary)] font-normal">({browserTotal} total)</span>
                  </p>
                  <button
                    onClick={() => fetchBrowserEntries(browserPage)}
                    className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[var(--text-secondary)] ${browserLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={browserSourceFilter}
                    onChange={(e) => { setBrowserSourceFilter(e.target.value); setBrowserPage(0); }}
                    className="text-xs p-1.5 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  >
                    <option value="">All Sources</option>
                    <option value="conversation">Conversations</option>
                    <option value="website">Website</option>
                    <option value="manual">Manual</option>
                  </select>
                  <select
                    value={browserIntentFilter}
                    onChange={(e) => { setBrowserIntentFilter(e.target.value); setBrowserPage(0); }}
                    className="text-xs p-1.5 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                  >
                    <option value="">All Intents</option>
                    {INTENT_OPTIONS.map(i => (
                      <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Entry list */}
              <div className="divide-y divide-[var(--border-primary)] max-h-[500px] overflow-y-auto">
                {browserLoading ? (
                  <div className="p-6 text-center text-xs text-[var(--text-secondary)]">Loading entries...</div>
                ) : browserEntries.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--text-secondary)]">No entries found</div>
                ) : (
                  browserEntries.map(entry => (
                    <div
                      key={entry.id}
                      className={`p-3 transition-colors ${
                        !entry.is_active ? 'opacity-50 bg-gray-50 dark:bg-gray-900/20' : ''
                      } ${editingEntry?.id === entry.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      {/* Entry in edit mode */}
                      {editingEntry?.id === entry.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-blue-600">Editing Entry #{entry.id}</p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setEditingEntry(null)}
                                className="text-xs px-2 py-1 rounded border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveEditEntry}
                                disabled={savingEntry || !editEntryAnswer.trim()}
                                className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                              >
                                {savingEntry ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                          <select
                            value={editEntryIntent}
                            onChange={(e) => setEditEntryIntent(e.target.value)}
                            className="w-full text-xs p-1.5 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                          >
                            {INTENT_OPTIONS.map(i => (
                              <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          {entry.source_type !== 'website' && (
                            <input
                              value={editEntryQuestion}
                              onChange={(e) => setEditEntryQuestion(e.target.value)}
                              placeholder="Customer question"
                              className="w-full text-xs p-1.5 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                            />
                          )}
                          <textarea
                            value={editEntryAnswer}
                            onChange={(e) => setEditEntryAnswer(e.target.value)}
                            placeholder="Team response / content"
                            rows={3}
                            className="w-full text-xs p-1.5 rounded border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] text-[var(--text-secondary)]">Confidence:</label>
                            <input
                              type="range" min="0" max="1" step="0.05"
                              value={editEntryConfidence}
                              onChange={(e) => setEditEntryConfidence(parseFloat(e.target.value))}
                              className="w-24"
                            />
                            <span className="text-[10px] font-mono text-[var(--text-primary)]">{(editEntryConfidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      ) : (
                        /* Entry in view mode */
                        <>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                entry.source_type === 'conversation' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                entry.source_type === 'website' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              }`}>
                                {entry.source_type}
                              </span>
                              {entry.intent && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)] font-medium">
                                  {entry.intent.replace(/_/g, ' ')}
                                </span>
                              )}
                              {!entry.is_active && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">
                                  INACTIVE
                                </span>
                              )}
                              <span className="text-[10px] text-[var(--text-secondary)]">
                                {(entry.confidence_score * 100).toFixed(0)}% conf
                              </span>
                              {entry.use_count > 0 && (
                                <span className="text-[10px] text-[var(--text-secondary)]">
                                  used {entry.use_count}x
                                </span>
                              )}
                              {(entry.feedback_up > 0 || entry.feedback_down > 0) && (
                                <span className="text-[10px] text-[var(--text-secondary)]">
                                  +{entry.feedback_up} / -{entry.feedback_down}
                                </span>
                              )}
                            </div>
                            {/* Action buttons */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => startEditEntry(entry)}
                                className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                title="Edit entry"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                              </button>
                              <button
                                onClick={() => toggleEntryActive(entry.id, entry.is_active)}
                                disabled={togglingId === entry.id}
                                className={`p-1 rounded transition-colors ${
                                  entry.is_active
                                    ? 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                                    : 'hover:bg-green-100 dark:hover:bg-green-900/30'
                                }`}
                                title={entry.is_active ? 'Deactivate (hide from AI)' : 'Reactivate'}
                              >
                                {entry.is_active
                                  ? <EyeOff className="w-3.5 h-3.5 text-yellow-600" />
                                  : <Eye className="w-3.5 h-3.5 text-green-500" />
                                }
                              </button>
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                title="Delete permanently"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          </div>
                          {entry.customer_message && (
                            <p className="text-[11px] text-[var(--text-secondary)] mb-0.5">
                              <span className="font-medium">Q:</span> {entry.customer_message.substring(0, 150)}{entry.customer_message.length > 150 ? '...' : ''}
                            </p>
                          )}
                          {entry.page_section && (
                            <p className="text-[10px] text-[var(--text-secondary)] mb-0.5">[{entry.page_section}]</p>
                          )}
                          <p className="text-xs text-[var(--text-primary)]">
                            <span className="font-medium">A:</span> {entry.team_response.substring(0, 250)}{entry.team_response.length > 250 ? '...' : ''}
                          </p>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {browserTotal > BROWSER_PAGE_SIZE && (
                <div className="p-3 border-t border-[var(--border-primary)] flex items-center justify-between">
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    Showing {browserPage * BROWSER_PAGE_SIZE + 1}–{Math.min((browserPage + 1) * BROWSER_PAGE_SIZE, browserTotal)} of {browserTotal}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleBrowserPageChange(browserPage - 1)}
                      disabled={browserPage === 0}
                      className="px-2 py-1 text-xs rounded border border-[var(--border-primary)] disabled:opacity-30 hover:bg-[var(--bg-hover)]"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => handleBrowserPageChange(browserPage + 1)}
                      disabled={(browserPage + 1) * BROWSER_PAGE_SIZE >= browserTotal}
                      className="px-2 py-1 text-xs rounded border border-[var(--border-primary)] disabled:opacity-30 hover:bg-[var(--bg-hover)]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Conversation Monitor */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Conversation Monitor
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[var(--border-primary)] overflow-hidden text-xs">
              {(['today', 'all', 'escalated', 'active'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setConvoFilter(f)}
                  className={`px-3 py-1.5 capitalize transition-colors ${
                    convoFilter === f
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={fetchConversations}
              className="p-1.5 rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-[var(--text-secondary)] ${convoLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {conversations.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-secondary)] text-sm">
            {convoLoading ? 'Loading...' : 'No ClubAI conversations found'}
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {conversations.map(convo => (
              <div
                key={convo.id}
                className={`rounded-lg border transition-colors ${
                  convo.clubai_escalated
                    ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-900/10'
                    : 'border-[var(--border-primary)] bg-[var(--bg-primary)]'
                }`}
              >
                {/* Conversation header */}
                <button
                  onClick={() => setExpandedConvo(expandedConvo === convo.id ? null : convo.id)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {convo.customer_name || formatPhone(convo.phone_number)}
                        </p>
                        {convo.clubai_escalated && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
                            ESCALATED
                          </span>
                        )}
                        {convo.clubai_active && !convo.clubai_escalated && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {convo.clubai_messages_sent} AI messages · {formatTime(convo.updated_at)}
                        {convo.clubai_escalation_reason && ` · ${convo.clubai_escalation_reason.substring(0, 60)}`}
                      </p>
                    </div>
                  </div>
                  {expandedConvo === convo.id ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 flex-shrink-0" />}
                </button>

                {/* Expanded: show messages */}
                {expandedConvo === convo.id && convo.messages && (
                  <div className="px-3 pb-3 space-y-2 border-t border-[var(--border-primary)] pt-2">
                    {correctionSuccess && correctingMsg === null && (
                      <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> {correctionSuccess}
                      </div>
                    )}
                    {correctionError && correctingMsg === null && (
                      <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-1.5">
                        <X className="w-3.5 h-3.5" /> {correctionError}
                      </div>
                    )}
                    {convo.messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.sender_type === 'customer' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                          msg.sender_type === 'customer'
                            ? 'bg-gray-100 dark:bg-gray-800 text-[var(--text-primary)]'
                            : msg.sender_type === 'ai'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100'
                        }`}>
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="font-semibold text-[10px] uppercase opacity-60">
                              {msg.sender_type === 'customer' ? 'Customer' : msg.sender_type === 'ai' ? 'ClubAI' : 'Operator'}
                            </span>
                            {msg.pattern_confidence != null && msg.sender_type === 'ai' && (
                              <span className="text-[10px] opacity-50">
                                ({(msg.pattern_confidence * 100).toFixed(0)}% confidence)
                              </span>
                            )}
                            <span className="text-[10px] opacity-40 ml-auto">{formatTime(msg.created_at)}</span>
                            {msg.sender_type === 'ai' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); startCorrection(convo.id, i, convo.messages!); }}
                                className="ml-1 p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                title="Correct this response — saves to knowledge base"
                              >
                                <Edit3 className="w-3 h-3 text-blue-500" />
                              </button>
                            )}
                          </div>

                          {/* Inline correction editor */}
                          {correctingMsg && correctingMsg.convoId === convo.id && correctingMsg.msgIndex === i ? (
                            <div className="mt-1 space-y-1.5">
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                                Correct this response — saves as knowledge with embedding
                              </p>
                              {correctingMsg.customerMsg && (
                                <p className="text-[10px] text-[var(--text-secondary)]">
                                  Customer asked: &quot;{correctingMsg.customerMsg.substring(0, 100)}&quot;
                                </p>
                              )}
                              <select
                                value={correctionIntent}
                                onChange={(e) => setCorrectionIntent(e.target.value)}
                                className="w-full text-[10px] p-1 rounded border border-blue-300 bg-white dark:bg-gray-800 text-[var(--text-primary)]"
                              >
                                {INTENT_OPTIONS.map(opt => (
                                  <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                                ))}
                              </select>
                              <textarea
                                value={correctionText}
                                onChange={(e) => setCorrectionText(e.target.value)}
                                rows={3}
                                className="w-full text-xs p-1.5 rounded border border-blue-300 bg-white dark:bg-gray-800 text-[var(--text-primary)] resize-none"
                                autoFocus
                              />
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={() => { setCorrectingMsg(null); setCorrectionText(''); }}
                                  className="px-2 py-0.5 text-[10px] rounded border border-[var(--border-primary)] text-[var(--text-secondary)]"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={saveCorrection}
                                  disabled={savingCorrection || !correctionText.trim()}
                                  className="px-2 py-0.5 text-[10px] rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                                >
                                  {savingCorrection ? 'Saving...' : 'Save to Knowledge Base'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.message_text}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {convo.messages.length === 0 && (
                      <p className="text-xs text-[var(--text-secondary)] text-center py-2">No messages recorded</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Safety Settings (collapsible) */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
        <button
          onClick={() => setShowSafety(!showSafety)}
          className="w-full flex items-center justify-between p-5"
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Shield className="w-4 h-4" /> Safety Settings
          </h3>
          {showSafety ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showSafety && (
          <div className="px-5 pb-5 space-y-4">
            {[
              { label: 'Rapid Message Escalation', desc: `${safety.rapidMessageThreshold}+ messages in ${safety.rapidMessageWindowSeconds}s triggers escalation`, key: 'rapidMessageEnabled' as const, value: safety.rapidMessageEnabled },
              { label: 'AI Response Limit', desc: `Escalate after ${safety.aiResponseLimit} consecutive AI messages`, key: 'aiResponseLimitEnabled' as const, value: safety.aiResponseLimitEnabled },
              { label: 'Negative Sentiment Detection', desc: 'Escalate when customer seems frustrated', key: 'negativeSentimentEnabled' as const, value: safety.negativeSentimentEnabled },
              { label: 'Topic-Aware Lockout', desc: `AI defers per-topic when operator responds (${safety.operatorLockoutHours}h lockout, ${safety.globalCooldownMinutes}m cooldown)`, key: 'topicLockoutEnabled' as const, value: safety.topicLockoutEnabled },
            ].map(({ label, desc, key, value }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{desc}</p>
                </div>
                <button
                  onClick={() => saveSafety({ [key]: !value })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${value ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
