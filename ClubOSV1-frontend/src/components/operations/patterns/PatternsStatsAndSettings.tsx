import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Clock, Users, MessageSquare, CheckCircle, 
  AlertCircle, Zap, Target, Activity, BarChart3,
  Settings, Shield, Brain, Save, RotateCcw, Info,
  MessageCircle, Upload
} from 'lucide-react';
import apiClient from '@/api/http';
import logger from '@/services/logger';
import { CSVImportSection } from './CSVImportSection';

interface OperatorStats {
  totalResponses: number;
  automatedResponses: number;
  manualResponses: number;
  automationRate: number;
  timeSavedToday: number;
  timeSavedWeek: number;
  topQuestions: Array<{
    topic: string;
    count: number;
    automated: boolean;
  }>;
}

interface SafetySettings {
  blacklistTopics: string[];
  escalationKeywords: string[];
  requireApprovalForNew: boolean;
  approvalThreshold: number;
  minExamplesRequired: number;
  operatorOverrideWeight: number;
  enableFallbackResponses: boolean;
  fallbackMessages: {
    booking: string;
    emergency: string;
    techSupport: string;
    brandTone: string;
    general: string;
  };
}

interface PatternLearningConfig {
  enabled: boolean;
  shadowMode: boolean;
  openphoneEnabled: boolean; // OpenPhone automation toggle
  minConfidenceToSuggest: number;
  minConfidenceToAct: number;
  minOccurrencesToLearn: number;
}

interface SentimentPattern {
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SafetyThresholds {
  rapidMessageThreshold: number;
  rapidMessageWindowSeconds: number;
  rapidMessageEnabled: boolean;
  aiResponseLimit: number;
  aiResponseLimitEnabled: boolean;
  operatorLockoutHours: number;
  escalationMessage: string;
  negativeSentimentEnabled: boolean;
  negativeSentimentPatterns: SentimentPattern[];
  rapidMessageEscalationText: string;
  aiLimitEscalationText: string;
  sentimentEscalationText: string;
  // Topic-aware lockout settings (v1.25.38)
  topicLockoutEnabled: boolean;
  globalCooldownMinutes: number;
}

export const PatternsStatsAndSettings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'stats' | 'settings' | 'import'>('stats');
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [settings, setSettings] = useState<SafetySettings>({
    blacklistTopics: [],
    escalationKeywords: [],
    requireApprovalForNew: true,
    approvalThreshold: 10,
    minExamplesRequired: 5,
    operatorOverrideWeight: 2.0,
    enableFallbackResponses: false,
    fallbackMessages: {
      booking: '',
      emergency: '',
      techSupport: '',
      brandTone: '',
      general: ''
    }
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [patternConfig, setPatternConfig] = useState<PatternLearningConfig>({
    enabled: false,
    shadowMode: false,
    openphoneEnabled: false, // OpenPhone automation OFF by default
    minConfidenceToSuggest: 0.60,
    minConfidenceToAct: 0.85,
    minOccurrencesToLearn: 1
  });

  // Safety thresholds for escalation control
  const [safetyThresholds, setSafetyThresholds] = useState<SafetyThresholds>({
    rapidMessageThreshold: 3,
    rapidMessageWindowSeconds: 60,
    rapidMessageEnabled: true,
    aiResponseLimit: 3,
    aiResponseLimitEnabled: true,
    operatorLockoutHours: 4,
    escalationMessage: "I see you're still having trouble. Let me connect you with one of our team members who can help you directly. Someone will be with you shortly.\n\n- ClubAI",
    negativeSentimentEnabled: true,
    negativeSentimentPatterns: [],
    rapidMessageEscalationText: "I notice you've sent multiple messages. Let me connect you with a human operator who can better assist you.\n\nOur team will respond shortly.\n\n- ClubAI",
    aiLimitEscalationText: "I understand you need more help than I can provide. I'm connecting you with a human operator who will assist you shortly.\n\nA member of our team will respond as soon as possible.\n\n- ClubAI",
    sentimentEscalationText: "I understand you need more help than I can provide. I'm connecting you with a human operator who will assist you shortly.\n\nA member of our team will respond as soon as possible.\n\n- ClubAI",
    // Topic-aware lockout settings (v1.25.38)
    topicLockoutEnabled: true,
    globalCooldownMinutes: 60
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch real stats from API
      try {
        const statsResponse = await apiClient.get('/api/patterns/stats');
        const data = statsResponse.data;
        
        const transformedStats: OperatorStats = {
          totalResponses: data.stats?.total_executions || 0,
          automatedResponses: data.stats?.total_successes || 0,
          manualResponses: (data.stats?.total_executions || 0) - (data.stats?.total_successes || 0),
          automationRate: data.stats?.avg_success_rate ? Math.round(data.stats.avg_success_rate * 100) : 0,
          timeSavedToday: Math.round((data.stats?.total_successes || 0) * 3),
          timeSavedWeek: Math.round((data.stats?.total_successes || 0) * 3 * 7),
          topQuestions: data.topPatterns?.slice(0, 5).map((p: any) => ({
            topic: p.type || 'General',
            count: p.execution_count || 0,
            automated: p.auto_executable || false
          })) || []
        };
        setStats(transformedStats);
      } catch (error) {
        logger.error('Failed to fetch stats:', error);
        // Set empty stats on error
        setStats({
          totalResponses: 0,
          automatedResponses: 0,
          manualResponses: 0,
          automationRate: 0,
          timeSavedToday: 0,
          timeSavedWeek: 0,
          topQuestions: []
        });
      }

      // Fetch real settings from API
      try {
        const response = await apiClient.get('/patterns/safety-settings');
        if (response.data) {
          // Ensure fallbackMessages exists with proper structure
          const loadedSettings = {
            ...response.data,
            fallbackMessages: response.data.fallbackMessages || {
              booking: '',
              emergency: '',
              techSupport: '',
              brandTone: '',
              general: ''
            }
          };
          setSettings(loadedSettings);
        }
      } catch (error) {
        logger.error('Failed to fetch safety settings:', error);
      }
      
      // Fetch pattern learning config
      try {
        const configResponse = await apiClient.get('/patterns/config');
        if (configResponse.data) {
          setPatternConfig({
            enabled: configResponse.data.enabled || false,
            shadowMode: configResponse.data.shadow_mode || false,
            openphoneEnabled: configResponse.data.openphone_enabled || false,
            minConfidenceToSuggest: configResponse.data.min_confidence_to_suggest || 0.60,
            minConfidenceToAct: configResponse.data.min_confidence_to_act || 0.85,
            minOccurrencesToLearn: configResponse.data.min_occurrences_to_learn || 1
          });
        }
      } catch (error) {
        logger.error('Failed to fetch pattern config:', error);
      }

      // Fetch safety thresholds
      try {
        const thresholdsResponse = await apiClient.get('/patterns/safety-thresholds');
        if (thresholdsResponse.data?.thresholds) {
          setSafetyThresholds(thresholdsResponse.data.thresholds);
        }
      } catch (error) {
        logger.error('Failed to fetch safety thresholds:', error);
      }
    } catch (error) {
      logger.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Save safety settings
      await apiClient.put('/patterns/safety-settings', settings);

      // Save pattern learning config
      await apiClient.put('/patterns/config', {
        enabled: patternConfig.enabled,
        shadow_mode: patternConfig.shadowMode,
        openphone_enabled: patternConfig.openphoneEnabled,
        min_confidence_to_suggest: patternConfig.minConfidenceToSuggest,
        min_confidence_to_act: patternConfig.minConfidenceToAct,
        min_occurrences_to_learn: patternConfig.minOccurrencesToLearn
      });

      // Save safety thresholds
      await apiClient.put('/patterns/safety-thresholds', safetyThresholds);

      setHasChanges(false);

      // Reload settings to confirm they were saved
      const response = await apiClient.get('/patterns/safety-settings');
      if (response.data) {
        // Ensure fallbackMessages exists with proper structure
        const loadedSettings = {
          ...response.data,
          fallbackMessages: response.data.fallbackMessages || {
            booking: '',
            emergency: '',
            techSupport: '',
            brandTone: '',
            general: ''
          }
        };
        setSettings(loadedSettings);
      }

      // Reload pattern config
      const configResponse = await apiClient.get('/patterns/config');
      if (configResponse.data) {
        setPatternConfig({
          enabled: configResponse.data.enabled || false,
          shadowMode: configResponse.data.shadow_mode || false,
          openphoneEnabled: configResponse.data.openphone_enabled || false,
          minConfidenceToSuggest: configResponse.data.min_confidence_to_suggest || 0.60,
          minConfidenceToAct: configResponse.data.min_confidence_to_act || 0.85,
          minOccurrencesToLearn: configResponse.data.min_occurrences_to_learn || 1
        });
      }

      // Reload safety thresholds
      const thresholdsResponse = await apiClient.get('/patterns/safety-thresholds');
      if (thresholdsResponse.data?.thresholds) {
        setSafetyThresholds(thresholdsResponse.data.thresholds);
      }

      // Show success feedback
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      logger.info('Settings saved successfully');
    } catch (error) {
      logger.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof SafetySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const updatePatternConfig = (key: keyof PatternLearningConfig, value: any) => {
    setPatternConfig(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateThreshold = (key: keyof SafetyThresholds, value: any) => {
    setSafetyThresholds(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const updateSentimentPattern = (index: number, field: 'pattern' | 'severity', value: string) => {
    setSafetyThresholds(prev => {
      const newPatterns = [...prev.negativeSentimentPatterns];
      newPatterns[index] = { ...newPatterns[index], [field]: value };
      return { ...prev, negativeSentimentPatterns: newPatterns };
    });
    setHasChanges(true);
  };

  const addSentimentPattern = () => {
    setSafetyThresholds(prev => ({
      ...prev,
      negativeSentimentPatterns: [...prev.negativeSentimentPatterns, { pattern: '', severity: 'medium' }]
    }));
    setHasChanges(true);
  };

  const removeSentimentPattern = (index: number) => {
    setSafetyThresholds(prev => ({
      ...prev,
      negativeSentimentPatterns: prev.negativeSentimentPatterns.filter((_, i) => i !== index)
    }));
    setHasChanges(true);
  };

  const resetSentimentPatterns = async () => {
    try {
      const response = await apiClient.post('/patterns/sentiment-patterns/reset');
      if (response.data?.patterns) {
        setSafetyThresholds(prev => ({
          ...prev,
          negativeSentimentPatterns: response.data.patterns
        }));
        setHasChanges(true);
      }
    } catch (error) {
      logger.error('Failed to reset sentiment patterns:', error);
    }
  };

  const addKeyword = (type: 'blacklist' | 'escalation', keyword: string) => {
    if (!keyword.trim()) return;
    const key = type === 'blacklist' ? 'blacklistTopics' : 'escalationKeywords';
    setSettings(prev => ({
      ...prev,
      [key]: [...prev[key], keyword.toLowerCase().trim()]
    }));
    setHasChanges(true);
  };

  const addBulkKeywords = (type: 'blacklist' | 'escalation', keywords: string) => {
    if (!keywords.trim()) return;
    
    // Parse keywords - support comma, space, or newline separated
    const newKeywords = keywords
      .toLowerCase()
      .split(/[,\s\n]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    const key = type === 'blacklist' ? 'blacklistTopics' : 'escalationKeywords';
    setSettings(prev => {
      const existing = prev[key];
      // Avoid duplicates - use Array.from for better compatibility
      const unique = Array.from(new Set([...existing, ...newKeywords]));
      return {
        ...prev,
        [key]: unique
      };
    });
    setHasChanges(true);
  };

  const addRecommendedKeywords = () => {
    const recommendedBlacklist = [
      'legal', 'lawyer', 'lawsuit', 'refund', 'medical', 
      'injury', 'accident', 'emergency', 'police', 'insurance', 
      'compensation', 'harassment', 'discrimination', 'lawsuit',
      'attorney', 'court', 'sued', 'suing'
    ];
    
    const recommendedEscalation = [
      'angry', 'upset', 'furious', 'manager', 'complaint', 
      'unacceptable', 'terrible', 'worst', 'sue', 'attorney', 
      'emergency', 'urgent', 'immediately', 'disgusting', 'horrible',
      'supervisor', 'corporate', 'lawsuit'
    ];

    setSettings(prev => {
      const uniqueBlacklist = Array.from(new Set([...prev.blacklistTopics, ...recommendedBlacklist]));
      const uniqueEscalation = Array.from(new Set([...prev.escalationKeywords, ...recommendedEscalation]));
      return {
        ...prev,
        blacklistTopics: uniqueBlacklist,
        escalationKeywords: uniqueEscalation
      };
    });
    setHasChanges(true);
  };

  const removeKeyword = (type: 'blacklist' | 'escalation', keyword: string) => {
    const key = type === 'blacklist' ? 'blacklistTopics' : 'escalationKeywords';
    setSettings(prev => ({
      ...prev,
      [key]: prev[key].filter(k => k !== keyword)
    }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <p className="text-sm font-medium text-green-800">Safety settings saved successfully!</p>
        </div>
      )}
      
      {/* Section Toggle */}
      <div className="bg-white rounded-lg shadow-sm border border-[var(--border-secondary)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveSection('stats')}
              className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                activeSection === 'stats'
                  ? 'bg-primary text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Statistics
            </button>
            <button
              onClick={() => setActiveSection('settings')}
              className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                activeSection === 'settings'
                  ? 'bg-primary text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Settings className="h-4 w-4" />
              Safety Settings
            </button>
            <button
              onClick={() => setActiveSection('import')}
              className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                activeSection === 'import'
                  ? 'bg-primary text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Upload className="h-4 w-4" />
              Import
            </button>
          </div>
          {activeSection === 'settings' && (
            <div className="flex items-center gap-3">
              {saveSuccess && (
                <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Saved!
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  hasChanges
                    ? 'bg-primary text-white hover:opacity-90'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed'
                }`}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Statistics Section */}
      {activeSection === 'stats' && stats && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-[var(--border-secondary)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Automation Rate</p>
                  <p className="text-2xl font-bold text-primary">{stats.automationRate}%</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {stats.automatedResponses} of {stats.totalResponses} messages
                  </p>
                </div>
                <Target className="h-8 w-8 text-primary opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-[var(--border-secondary)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Time Saved Today</p>
                  <p className="text-2xl font-bold text-green-600">{stats.timeSavedToday} min</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    ~{Math.round(stats.timeSavedToday / 60)} hours of work
                  </p>
                </div>
                <Clock className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-[var(--border-secondary)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Manual Interventions</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.manualResponses}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Required operator response
                  </p>
                </div>
                <Users className="h-8 w-8 text-yellow-600 opacity-20" />
              </div>
            </div>
          </div>

          {/* Top Questions */}
          <div className="bg-white rounded-lg shadow-sm border border-[var(--border-secondary)] p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Most Common Questions Today
            </h3>
            <div className="space-y-3">
              {stats.topQuestions.map((question, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{question.topic}</span>
                    {question.automated && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        Automated
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">{question.count} times</span>
                </div>
              ))}
            </div>
          </div>

          {/* Impact Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Today's Impact</p>
                <p className="text-sm text-blue-700 mt-1">
                  The V3-PLS system handled {stats.automationRate}% of customer messages automatically, 
                  saving approximately {Math.round(stats.timeSavedToday / 60)} hours of operator time. 
                  Technical issues had the most manual interventions - consider adding more patterns for common tech problems.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Section */}
      {activeSection === 'settings' && (
        <div className="space-y-6">
          {/* Critical Safety Controls */}
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Critical Safety Controls</h3>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Required</span>
            </div>

            {/* Blacklisted Topics */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Blacklisted Topics (Never Auto-Respond)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {settings.blacklistTopics.map((topic, idx) => (
                  <span key={idx} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm flex items-center gap-1">
                    {topic}
                    <button
                      onClick={() => removeKeyword('blacklist', topic)}
                      className="ml-1 hover:text-red-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="space-y-2">
                <textarea
                  placeholder="Paste multiple keywords here (comma, space, or newline separated)..."
                  className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-md text-sm"
                  rows={3}
                  onBlur={(e) => {
                    addBulkKeywords('blacklist', e.target.value);
                    e.target.value = '';
                  }}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Or add single keyword and press Enter..."
                    className="flex-1 px-3 py-1.5 border border-[var(--border-primary)] rounded-md text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addKeyword('blacklist', (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Escalation Keywords */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Escalation Keywords (Alert Operator)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {settings.escalationKeywords.map((keyword, idx) => (
                  <span key={idx} className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-sm flex items-center gap-1">
                    {keyword}
                    <button
                      onClick={() => removeKeyword('escalation', keyword)}
                      className="ml-1 hover:text-yellow-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="space-y-2">
                <textarea
                  placeholder="Paste multiple keywords here (comma, space, or newline separated)..."
                  className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-md text-sm"
                  rows={3}
                  onBlur={(e) => {
                    addBulkKeywords('escalation', e.target.value);
                    e.target.value = '';
                  }}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Or add single keyword and press Enter..."
                    className="flex-1 px-3 py-1.5 border border-[var(--border-primary)] rounded-md text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addKeyword('escalation', (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex justify-center">
              <button
                onClick={addRecommendedKeywords}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Shield className="h-4 w-4" />
                Add All Recommended Safety Keywords
              </button>
            </div>

            {/* Approval Requirements */}
            <div>
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">Require Approval for New Patterns</span>
                  <p className="text-xs text-[var(--text-muted)]">First {settings.approvalThreshold} uses need operator approval</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.requireApprovalForNew}
                  onChange={(e) => updateSetting('requireApprovalForNew', e.target.checked)}
                  className="h-5 w-5 text-primary rounded"
                />
              </label>
            </div>
          </div>

          {/* Learning Controls */}
          <div className="bg-white rounded-lg shadow-sm border border-[var(--border-secondary)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Learning Controls</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Minimum Examples Required: {settings.minExamplesRequired}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={settings.minExamplesRequired}
                  onChange={(e) => updateSetting('minExamplesRequired', parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Need {settings.minExamplesRequired} similar Q&As before creating a pattern
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Operator Override Weight: {settings.operatorOverrideWeight}x
                </label>
                <input
                  type="range"
                  min="10"
                  max="30"
                  value={settings.operatorOverrideWeight * 10}
                  onChange={(e) => updateSetting('operatorOverrideWeight', parseInt(e.target.value) / 10)}
                  className="w-full"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Operator corrections are weighted {settings.operatorOverrideWeight}x more than auto-learned patterns
                </p>
              </div>
            </div>
          </div>

          {/* Fallback Response Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-[var(--border-secondary)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="h-5 w-5 text-[var(--text-secondary)]" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Fallback Responses</h3>
              <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded-full">Optional</span>
            </div>

            <div className="mb-4">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">Enable Fallback Responses</span>
                  <p className="text-xs text-[var(--text-muted)]">Send fallback messages when AI cannot process a request</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableFallbackResponses}
                  onChange={(e) => updateSetting('enableFallbackResponses', e.target.checked)}
                  className="h-5 w-5 text-primary rounded"
                />
              </label>
            </div>

            {settings.enableFallbackResponses && (
              <div className="space-y-3 pt-3 border-t">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Booking & Access Fallback</label>
                  <textarea
                    value={settings.fallbackMessages.booking}
                    onChange={(e) => updateSetting('fallbackMessages', {...settings.fallbackMessages, booking: e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-md text-sm"
                    rows={2}
                    placeholder="Leave empty to send no fallback..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Emergency Fallback</label>
                  <textarea
                    value={settings.fallbackMessages.emergency}
                    onChange={(e) => updateSetting('fallbackMessages', {...settings.fallbackMessages, emergency: e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-md text-sm"
                    rows={2}
                    placeholder="Leave empty to send no fallback..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Tech Support Fallback</label>
                  <textarea
                    value={settings.fallbackMessages.techSupport}
                    onChange={(e) => updateSetting('fallbackMessages', {...settings.fallbackMessages, techSupport: e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-md text-sm"
                    rows={2}
                    placeholder="Leave empty to send no fallback..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">General Fallback</label>
                  <textarea
                    value={settings.fallbackMessages.general}
                    onChange={(e) => updateSetting('fallbackMessages', {...settings.fallbackMessages, general: e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-md text-sm"
                    rows={2}
                    placeholder="Leave empty to send no fallback..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pattern Learning Configuration */}
          <div className="bg-white rounded-lg shadow-sm border border-[var(--border-secondary)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Pattern Learning System</h3>
              <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-xs rounded-full">Automatic Learning</span>
            </div>

            <div className="space-y-4">
              {/* Enable Pattern Learning */}
              <div>
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Enable Pattern Learning</span>
                    <p className="text-xs text-[var(--text-muted)]">Automatically learn new patterns from operator responses</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={patternConfig.enabled}
                    onChange={(e) => updatePatternConfig('enabled', e.target.checked)}
                    className="h-5 w-5 text-primary rounded"
                  />
                </label>
              </div>

              {/* Shadow Mode */}
              <div>
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Shadow Mode</span>
                    <p className="text-xs text-[var(--text-muted)]">Log learning opportunities without creating patterns</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={patternConfig.shadowMode}
                    onChange={(e) => updatePatternConfig('shadowMode', e.target.checked)}
                    className="h-5 w-5 text-primary rounded"
                    disabled={!patternConfig.enabled}
                  />
                </label>
              </div>

              {/* OpenPhone Automation Toggle */}
              <div className="pt-2 border-t border-dashed">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">OpenPhone Automation</span>
                    <p className="text-xs text-[var(--text-muted)]">Allow patterns to auto-respond to OpenPhone messages</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={patternConfig.openphoneEnabled}
                    onChange={(e) => updatePatternConfig('openphoneEnabled', e.target.checked)}
                    className="h-5 w-5 text-primary rounded"
                    disabled={!patternConfig.enabled}
                  />
                </label>
                {!patternConfig.openphoneEnabled && patternConfig.enabled && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <span>⚠️</span> OpenPhone messages will be escalated to operators
                  </p>
                )}
              </div>

              {/* Confidence Thresholds */}
              <div className="pt-3 border-t space-y-3">
                <h4 className="text-sm font-medium text-[var(--text-primary)]">Confidence Thresholds</h4>
                
                {/* Min Confidence to Suggest */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Minimum Confidence to Suggest ({Math.round(patternConfig.minConfidenceToSuggest * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={patternConfig.minConfidenceToSuggest * 100}
                    onChange={(e) => updatePatternConfig('minConfidenceToSuggest', parseInt(e.target.value) / 100)}
                    className="w-full"
                    disabled={!patternConfig.enabled}
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Patterns above this threshold will be suggested to operators
                  </p>
                </div>

                {/* Min Confidence to Act */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Minimum Confidence to Auto-Execute ({Math.round(patternConfig.minConfidenceToAct * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={patternConfig.minConfidenceToAct * 100}
                    onChange={(e) => updatePatternConfig('minConfidenceToAct', parseInt(e.target.value) / 100)}
                    className="w-full"
                    disabled={!patternConfig.enabled}
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Patterns above this threshold can execute automatically
                  </p>
                </div>

                {/* Min Occurrences to Learn */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Minimum Occurrences to Learn
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={patternConfig.minOccurrencesToLearn}
                    onChange={(e) => updatePatternConfig('minOccurrencesToLearn', parseInt(e.target.value))}
                    className="w-24 px-3 py-1 border border-[var(--border-primary)] rounded-md text-sm"
                    disabled={!patternConfig.enabled}
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Number of similar responses needed before creating a pattern
                  </p>
                </div>
              </div>

              {/* Learning Status */}
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-2 w-2 rounded-full ${patternConfig.enabled ? 'bg-green-500 animate-pulse' : 'bg-[var(--bg-secondary)]'}`} />
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {patternConfig.enabled ? 'Pattern Learning Active' : 'Pattern Learning Disabled'}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {patternConfig.enabled && patternConfig.shadowMode && (
                    <p>⚠️ Shadow mode enabled - patterns are logged but not created</p>
                  )}
                  {patternConfig.enabled && !patternConfig.shadowMode && (
                    <p>✅ System is actively learning from operator responses</p>
                  )}
                  {!patternConfig.enabled && (
                    <p>Enable pattern learning to automatically create patterns from operator responses</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Escalation Thresholds */}
          <div className="bg-white rounded-lg shadow-sm border border-[var(--border-secondary)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Escalation Thresholds</h3>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Safety Controls</span>
            </div>

            <div className="space-y-6">
              {/* Rapid Message Detection */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Rapid Message Detection</span>
                    <p className="text-xs text-[var(--text-muted)]">Escalate when customer sends multiple messages quickly</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={safetyThresholds.rapidMessageEnabled}
                    onChange={(e) => updateThreshold('rapidMessageEnabled', e.target.checked)}
                    className="h-5 w-5 text-primary rounded"
                  />
                </div>
                {safetyThresholds.rapidMessageEnabled && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Message Threshold
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="10"
                        value={safetyThresholds.rapidMessageThreshold}
                        onChange={(e) => updateThreshold('rapidMessageThreshold', parseInt(e.target.value))}
                        className="w-full px-3 py-1 border border-[var(--border-primary)] rounded-md text-sm"
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1">Messages needed to trigger</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Time Window (seconds)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="300"
                        value={safetyThresholds.rapidMessageWindowSeconds}
                        onChange={(e) => updateThreshold('rapidMessageWindowSeconds', parseInt(e.target.value))}
                        className="w-full px-3 py-1 border border-[var(--border-primary)] rounded-md text-sm"
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1">Time window for counting</p>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Response Limit */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">AI Response Limit</span>
                    <p className="text-xs text-[var(--text-muted)]">Escalate after AI sends too many responses</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={safetyThresholds.aiResponseLimitEnabled}
                    onChange={(e) => updateThreshold('aiResponseLimitEnabled', e.target.checked)}
                    className="h-5 w-5 text-primary rounded"
                  />
                </div>
                {safetyThresholds.aiResponseLimitEnabled && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Max AI Responses
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={safetyThresholds.aiResponseLimit}
                      onChange={(e) => updateThreshold('aiResponseLimit', parseInt(e.target.value))}
                      className="w-24 px-3 py-1 border border-[var(--border-primary)] rounded-md text-sm"
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-1">Max responses before escalating to human</p>
                  </div>
                )}
              </div>

              {/* Operator Lockout Duration */}
              <div className="border-b pb-4">
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Operator Lockout Duration
                </label>
                <p className="text-xs text-[var(--text-muted)] mb-2">Hours to block AI on the SAME topic after operator responds</p>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={safetyThresholds.operatorLockoutHours}
                  onChange={(e) => updateThreshold('operatorLockoutHours', parseInt(e.target.value))}
                  className="w-24 px-3 py-1 border border-[var(--border-primary)] rounded-md text-sm"
                />
                <span className="ml-2 text-sm text-[var(--text-secondary)]">hours</span>
              </div>

              {/* Topic-Aware Lockouts */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Topic-Aware Lockouts</span>
                    <p className="text-xs text-[var(--text-muted)]">AI can respond to different topics after cooldown</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={safetyThresholds.topicLockoutEnabled}
                    onChange={(e) => updateThreshold('topicLockoutEnabled', e.target.checked)}
                    className="h-5 w-5 text-primary rounded"
                  />
                </div>
                {safetyThresholds.topicLockoutEnabled && (
                  <div className="mt-2 bg-blue-50 rounded-lg p-3">
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Global Cooldown (minutes)
                      </label>
                      <input
                        type="number"
                        min="15"
                        max="180"
                        value={safetyThresholds.globalCooldownMinutes}
                        onChange={(e) => updateThreshold('globalCooldownMinutes', parseInt(e.target.value))}
                        className="w-24 px-3 py-1 border border-[var(--border-primary)] rounded-md text-sm"
                      />
                      <p className="text-xs text-[var(--text-muted)] mt-1">AI waits this long before responding to ANY topic after operator</p>
                    </div>
                    <div className="text-xs text-blue-700 space-y-1">
                      <p><strong>How it works:</strong></p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>Operator responds to booking question → booking topic locked for {safetyThresholds.operatorLockoutHours} hours</li>
                        <li>During first {safetyThresholds.globalCooldownMinutes} minutes: AI won't respond to ANY topic</li>
                        <li>After {safetyThresholds.globalCooldownMinutes} min: AI can respond to different topics (tech support, etc.)</li>
                        <li>Same topic (booking) stays locked for full {safetyThresholds.operatorLockoutHours} hours</li>
                      </ul>
                      <p className="mt-2">Topics: Booking, Tech Support, Access, Gift Cards, Hours, Pricing, Membership</p>
                    </div>
                  </div>
                )}
                {!safetyThresholds.topicLockoutEnabled && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <span>⚠️</span> Legacy mode: AI blocked for ALL topics for {safetyThresholds.operatorLockoutHours} hours
                  </p>
                )}
              </div>

              {/* Negative Sentiment Detection */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Negative Sentiment Detection</span>
                    <p className="text-xs text-[var(--text-muted)]">Escalate when customer shows frustration</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={safetyThresholds.negativeSentimentEnabled}
                    onChange={(e) => updateThreshold('negativeSentimentEnabled', e.target.checked)}
                    className="h-5 w-5 text-primary rounded"
                  />
                </div>
                {safetyThresholds.negativeSentimentEnabled && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">Sentiment Patterns (regex)</span>
                      <div className="flex gap-2">
                        <button
                          onClick={resetSentimentPatterns}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Reset to defaults
                        </button>
                        <button
                          onClick={addSentimentPattern}
                          className="text-xs text-green-600 hover:text-green-800"
                        >
                          + Add pattern
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {safetyThresholds.negativeSentimentPatterns.map((pattern, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={pattern.pattern}
                            onChange={(e) => updateSentimentPattern(index, 'pattern', e.target.value)}
                            placeholder="regex pattern"
                            className="flex-1 px-2 py-1 border border-[var(--border-primary)] rounded text-xs font-mono"
                          />
                          <select
                            value={pattern.severity}
                            onChange={(e) => updateSentimentPattern(index, 'severity', e.target.value)}
                            className="px-2 py-1 border border-[var(--border-primary)] rounded text-xs"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                          <button
                            onClick={() => removeSentimentPattern(index)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {safetyThresholds.negativeSentimentPatterns.length === 0 && (
                        <p className="text-xs text-[var(--text-muted)] italic">No patterns configured. Click "Reset to defaults" to load default patterns.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Escalation Message */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Default Escalation Message
                </label>
                <p className="text-xs text-[var(--text-muted)] mb-2">Message sent when escalating to human operator</p>
                <textarea
                  value={safetyThresholds.escalationMessage}
                  onChange={(e) => updateThreshold('escalationMessage', e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-md text-sm"
                  rows={4}
                  placeholder="Enter escalation message..."
                />
              </div>
            </div>
          </div>

          {/* Current Status */}
          <div className="bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-lg p-4">
            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Current Safety Status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[var(--text-secondary)]">Blacklisted topics:</span>
                <span className="ml-2 font-medium">{settings.blacklistTopics.length} configured</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Escalation triggers:</span>
                <span className="ml-2 font-medium">{settings.escalationKeywords.length} active</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">New pattern approval:</span>
                <span className="ml-2 font-medium">{settings.requireApprovalForNew ? 'Required' : 'Disabled'}</span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Fallback responses:</span>
                <span className="ml-2 font-medium">{settings.enableFallbackResponses ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Section */}
      {activeSection === 'import' && (
        <CSVImportSection 
          onImportComplete={() => {
            // Refresh stats after successful import
            fetchData();
          }}
        />
      )}
    </div>
  );
};