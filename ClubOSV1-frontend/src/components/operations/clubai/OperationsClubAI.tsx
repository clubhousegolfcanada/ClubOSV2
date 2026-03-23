import React, { useState, useEffect } from 'react';
import { MessageSquare, Shield, BookOpen, Power, Eye, Hash, AlertTriangle, Clock, Users, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import apiClient from '@/api/http';

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

export const OperationsClubAI: React.FC = () => {
  const [config, setConfig] = useState<ClubAIConfig>({ enabled: false, shadowMode: true, maxMessages: 5 });
  const [stats, setStats] = useState<ClubAIStats>({ conversationsToday: 0, messagesSent: 0, escalated: 0, resolved: 0 });
  const [safety, setSafety] = useState<SafetyThresholds>({
    rapidMessageThreshold: 3, rapidMessageWindowSeconds: 60, rapidMessageEnabled: true,
    aiResponseLimit: 3, aiResponseLimitEnabled: true, operatorLockoutHours: 4,
    topicLockoutEnabled: true, globalCooldownMinutes: 60, negativeSentimentEnabled: true
  });
  const [knowledge, setKnowledge] = useState<{ systemPrompt: string; knowledgeBase: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [configRes, statsRes, safetyRes] = await Promise.all([
        apiClient.get('/api/patterns/clubai-config').catch(() => ({ data: { data: config } })),
        apiClient.get('/api/patterns/clubai-stats').catch(() => ({ data: { data: stats } })),
        apiClient.get('/api/patterns/safety-thresholds').catch(() => ({ data: { data: safety } })),
      ]);
      if (configRes.data?.data) setConfig(configRes.data.data);
      if (statsRes.data?.data) setStats(statsRes.data.data);
      if (safetyRes.data?.data) setSafety(prev => ({ ...prev, ...safetyRes.data.data }));
    } catch (e) { /* defaults are fine */ }
    setLoading(false);
  };

  const fetchKnowledge = async () => {
    if (knowledge) return;
    try {
      const res = await apiClient.get('/api/patterns/clubai-knowledge');
      if (res.data?.data) setKnowledge(res.data.data);
    } catch { setKnowledge({ systemPrompt: 'Failed to load', knowledgeBase: 'Failed to load' }); }
  };

  const saveConfig = async (updates: Partial<ClubAIConfig>) => {
    setSaving(true);
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    try {
      await apiClient.put('/api/patterns/clubai-config', newConfig);
    } catch (e) { /* revert on error */ setConfig(config); }
    setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-500">Loading ClubAI...</div>
      </div>
    );
  }

  const resolutionRate = stats.conversationsToday > 0
    ? Math.round((stats.resolved / stats.conversationsToday) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-[var(--accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">ClubAI</h2>
            <p className="text-sm text-[var(--text-secondary)]">GPT-4o conversational SMS support</p>
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
                type="range"
                min="2"
                max="10"
                value={config.maxMessages}
                onChange={(e) => saveConfig({ maxMessages: parseInt(e.target.value) })}
                className="w-24"
                disabled={saving}
              />
              <span className="text-sm font-mono text-[var(--text-primary)] w-6 text-center">{config.maxMessages}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <p className="text-xs text-[var(--text-secondary)]">Conversations</p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.conversationsToday}</p>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Hash className="w-4 h-4 text-green-500" />
            <p className="text-xs text-[var(--text-secondary)]">Messages Sent</p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.messagesSent}</p>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-orange-500" />
            <p className="text-xs text-[var(--text-secondary)]">Escalated</p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.escalated}</p>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <p className="text-xs text-[var(--text-secondary)]">Resolution Rate</p>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{resolutionRate}%</p>
        </div>
      </div>

      {/* Safety Settings */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Safety Settings
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Rapid Message Escalation</p>
              <p className="text-xs text-[var(--text-secondary)]">{safety.rapidMessageThreshold}+ messages in {safety.rapidMessageWindowSeconds}s triggers escalation</p>
            </div>
            <button
              onClick={() => saveSafety({ rapidMessageEnabled: !safety.rapidMessageEnabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${safety.rapidMessageEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${safety.rapidMessageEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">AI Response Limit</p>
              <p className="text-xs text-[var(--text-secondary)]">Escalate after {safety.aiResponseLimit} consecutive AI messages</p>
            </div>
            <button
              onClick={() => saveSafety({ aiResponseLimitEnabled: !safety.aiResponseLimitEnabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${safety.aiResponseLimitEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${safety.aiResponseLimitEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Negative Sentiment Detection</p>
              <p className="text-xs text-[var(--text-secondary)]">Escalate when customer seems frustrated</p>
            </div>
            <button
              onClick={() => saveSafety({ negativeSentimentEnabled: !safety.negativeSentimentEnabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${safety.negativeSentimentEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${safety.negativeSentimentEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Topic-Aware Lockout</p>
              <p className="text-xs text-[var(--text-secondary)]">AI defers per-topic when operator responds ({safety.operatorLockoutHours}h lockout, {safety.globalCooldownMinutes}m cooldown)</p>
            </div>
            <button
              onClick={() => saveSafety({ topicLockoutEnabled: !safety.topicLockoutEnabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${safety.topicLockoutEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${safety.topicLockoutEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Knowledge Base (read-only, collapsible) */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Knowledge Base
          <span className="text-xs font-normal text-[var(--text-secondary)]">(read-only)</span>
        </h3>

        <button
          onClick={() => { setShowPrompt(!showPrompt); if (!knowledge) fetchKnowledge(); }}
          className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)] mb-2 hover:bg-[var(--bg-hover)] transition-colors"
        >
          <span className="text-sm text-[var(--text-primary)]">System Prompt</span>
          {showPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showPrompt && knowledge && (
          <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-primary)] mb-3 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono">
            {knowledge.systemPrompt}
          </pre>
        )}

        <button
          onClick={() => { setShowKnowledge(!showKnowledge); if (!knowledge) fetchKnowledge(); }}
          className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <span className="text-sm text-[var(--text-primary)]">Knowledge Base</span>
          {showKnowledge ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showKnowledge && knowledge && (
          <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-primary)] mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono">
            {knowledge.knowledgeBase}
          </pre>
        )}

        <p className="text-xs text-[var(--text-secondary)] mt-3">
          To update the knowledge base, edit the files in the codebase and push to deploy.
        </p>
      </div>
    </div>
  );
};
