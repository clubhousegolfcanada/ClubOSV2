import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Shield, Database, Power, Hash, Users, TrendingUp, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, AlertTriangle, RefreshCw, Search, Filter } from 'lucide-react';
import apiClient from '@/api/http';

// ============================================
// TYPES
// ============================================

interface ClubAIConfig {
  enabled: boolean;
  shadowMode: boolean;
  maxMessages: number;
}

interface ClubAIStats {
  conversationsToday: number;
  messagesSent: number;
  escalated: number;
  resolved: number;
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

// ============================================
// COMPONENT
// ============================================

export const OperationsClubAI: React.FC = () => {
  // Config & stats
  const [config, setConfig] = useState<ClubAIConfig>({ enabled: false, shadowMode: true, maxMessages: 5 });
  const [stats, setStats] = useState<ClubAIStats>({ conversationsToday: 0, messagesSent: 0, escalated: 0, resolved: 0 });
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
        apiClient.get('/api/patterns/clubai-config').catch(() => ({ data: { data: config } })),
        apiClient.get('/api/patterns/clubai-stats').catch(() => ({ data: { data: stats } })),
        apiClient.get('/api/patterns/safety-thresholds').catch(() => ({ data: { data: safety } })),
        apiClient.get('/api/patterns/clubai-knowledge-stats').catch(() => ({ data: { data: null } })),
      ]);
      if (configRes.data?.data) setConfig(configRes.data.data);
      if (statsRes.data?.data) setStats(statsRes.data.data);
      if (safetyRes.data?.data) setSafety(prev => ({ ...prev, ...safetyRes.data.data }));
      if (kStatsRes.data?.data) setKnowledgeStats(kStatsRes.data.data);
    } catch { /* defaults fine */ }
    setLoading(false);
  }, []);

  const fetchConversations = useCallback(async () => {
    setConvoLoading(true);
    try {
      const res = await apiClient.get(`/api/patterns/clubai-conversations?filter=${convoFilter}&limit=20`);
      if (res.data?.data) setConversations(res.data.data);
    } catch { /* empty */ }
    setConvoLoading(false);
  }, [convoFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // ============================================
  // ACTIONS
  // ============================================

  const saveConfig = async (updates: Partial<ClubAIConfig>) => {
    setSaving(true);
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    try {
      await apiClient.put('/api/patterns/clubai-config', newConfig);
    } catch { setConfig(config); }
    setSaving(false);
  };

  const saveConfigDebounced = (updates: Partial<ClubAIConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    if (sliderTimeout.current) clearTimeout(sliderTimeout.current);
    sliderTimeout.current = setTimeout(async () => {
      try { await apiClient.put('/api/patterns/clubai-config', newConfig); }
      catch { setConfig(config); }
    }, 500);
  };

  const saveSafety = async (updates: Partial<SafetyThresholds>) => {
    setSaving(true);
    const newSafety = { ...safety, ...updates };
    setSafety(newSafety);
    try {
      await apiClient.put('/api/patterns/safety-thresholds', newSafety);
    } catch { setSafety(safety); }
    setSaving(false);
  };

  const submitFeedback = async (searchLogId: number, quality: 'good' | 'bad') => {
    try {
      await apiClient.post('/api/patterns/clubai-feedback', { searchLogId, quality });
    } catch { /* non-critical */ }
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
          'bg-green-100 text-green-700'
        }`}>
          {!config.enabled ? 'Disabled' : config.shadowMode ? 'Shadow Mode' : 'Live'}
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

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Shadow Mode</p>
              <p className="text-xs text-[var(--text-secondary)]">Log what ClubAI would send without actually sending</p>
            </div>
            <button
              onClick={() => saveConfig({ shadowMode: !config.shadowMode })}
              className={`relative w-11 h-6 rounded-full transition-colors ${config.shadowMode ? 'bg-yellow-500' : 'bg-gray-300'}`}
              disabled={saving}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.shadowMode ? 'translate-x-5' : ''}`} />
            </button>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Conversations', value: stats.conversationsToday, icon: MessageSquare, color: 'text-blue-500' },
          { label: 'Messages Sent', value: stats.messagesSent, icon: Hash, color: 'text-green-500' },
          { label: 'Escalated', value: stats.escalated, icon: Users, color: 'text-orange-500' },
          { label: 'Resolution Rate', value: `${resolutionRate}%`, icon: TrendingUp, color: 'text-green-500' },
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
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            {knowledgeStats.total} total entries with embeddings. ClubAI searches these to find relevant context for each customer message.
          </p>
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
                          </div>
                          <p className="whitespace-pre-wrap">{msg.message_text}</p>
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
