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
  minConfidenceToSuggest: number;
  minConfidenceToAct: number;
  minOccurrencesToLearn: number;
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
    minConfidenceToSuggest: 0.60,
    minConfidenceToAct: 0.85,
    minOccurrencesToLearn: 1
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
        console.error('Failed to fetch stats:', error);
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
            minConfidenceToSuggest: configResponse.data.min_confidence_to_suggest || 0.60,
            minConfidenceToAct: configResponse.data.min_confidence_to_act || 0.85,
            minOccurrencesToLearn: configResponse.data.min_occurrences_to_learn || 1
          });
        }
      } catch (error) {
        logger.error('Failed to fetch pattern config:', error);
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
        min_confidence_to_suggest: patternConfig.minConfidenceToSuggest,
        min_confidence_to_act: patternConfig.minConfidenceToAct,
        min_occurrences_to_learn: patternConfig.minOccurrencesToLearn
      });
      
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
          minConfidenceToSuggest: configResponse.data.min_confidence_to_suggest || 0.60,
          minConfidenceToAct: configResponse.data.min_confidence_to_act || 0.85,
          minOccurrencesToLearn: configResponse.data.min_occurrences_to_learn || 1
        });
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveSection('stats')}
              className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                activeSection === 'stats'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Automation Rate</p>
                  <p className="text-2xl font-bold text-primary">{stats.automationRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.automatedResponses} of {stats.totalResponses} messages
                  </p>
                </div>
                <Target className="h-8 w-8 text-primary opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Time Saved Today</p>
                  <p className="text-2xl font-bold text-green-600">{stats.timeSavedToday} min</p>
                  <p className="text-xs text-gray-500 mt-1">
                    ~{Math.round(stats.timeSavedToday / 60)} hours of work
                  </p>
                </div>
                <Clock className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Manual Interventions</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.manualResponses}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Required operator response
                  </p>
                </div>
                <Users className="h-8 w-8 text-yellow-600 opacity-20" />
              </div>
            </div>
          </div>

          {/* Top Questions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Most Common Questions Today
            </h3>
            <div className="space-y-3">
              {stats.topQuestions.map((question, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">{question.topic}</span>
                    {question.automated && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        Automated
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">{question.count} times</span>
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
              <h3 className="text-lg font-semibold text-gray-900">Critical Safety Controls</h3>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Required</span>
            </div>

            {/* Blacklisted Topics */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
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
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
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
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm"
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
                  <span className="text-sm font-medium text-gray-700">Require Approval for New Patterns</span>
                  <p className="text-xs text-gray-500">First {settings.approvalThreshold} uses need operator approval</p>
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900">Learning Controls</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <p className="text-xs text-gray-500 mt-1">
                  Need {settings.minExamplesRequired} similar Q&As before creating a pattern
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <p className="text-xs text-gray-500 mt-1">
                  Operator corrections are weighted {settings.operatorOverrideWeight}x more than auto-learned patterns
                </p>
              </div>
            </div>
          </div>

          {/* Fallback Response Settings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Fallback Responses</h3>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">Optional</span>
            </div>

            <div className="mb-4">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">Enable Fallback Responses</span>
                  <p className="text-xs text-gray-500">Send fallback messages when AI cannot process a request</p>
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Booking & Access Fallback</label>
                  <textarea
                    value={settings.fallbackMessages.booking}
                    onChange={(e) => updateSetting('fallbackMessages', {...settings.fallbackMessages, booking: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    rows={2}
                    placeholder="Leave empty to send no fallback..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Emergency Fallback</label>
                  <textarea
                    value={settings.fallbackMessages.emergency}
                    onChange={(e) => updateSetting('fallbackMessages', {...settings.fallbackMessages, emergency: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    rows={2}
                    placeholder="Leave empty to send no fallback..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tech Support Fallback</label>
                  <textarea
                    value={settings.fallbackMessages.techSupport}
                    onChange={(e) => updateSetting('fallbackMessages', {...settings.fallbackMessages, techSupport: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    rows={2}
                    placeholder="Leave empty to send no fallback..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">General Fallback</label>
                  <textarea
                    value={settings.fallbackMessages.general}
                    onChange={(e) => updateSetting('fallbackMessages', {...settings.fallbackMessages, general: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    rows={2}
                    placeholder="Leave empty to send no fallback..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pattern Learning Configuration */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Pattern Learning System</h3>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">Automatic Learning</span>
            </div>

            <div className="space-y-4">
              {/* Enable Pattern Learning */}
              <div>
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Enable Pattern Learning</span>
                    <p className="text-xs text-gray-500">Automatically learn new patterns from operator responses</p>
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
                    <span className="text-sm font-medium text-gray-700">Shadow Mode</span>
                    <p className="text-xs text-gray-500">Log learning opportunities without creating patterns</p>
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

              {/* Confidence Thresholds */}
              <div className="pt-3 border-t space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Confidence Thresholds</h4>
                
                {/* Min Confidence to Suggest */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
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
                  <p className="text-xs text-gray-500 mt-1">
                    Patterns above this threshold will be suggested to operators
                  </p>
                </div>

                {/* Min Confidence to Act */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
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
                  <p className="text-xs text-gray-500 mt-1">
                    Patterns above this threshold can execute automatically
                  </p>
                </div>

                {/* Min Occurrences to Learn */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Minimum Occurrences to Learn
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={patternConfig.minOccurrencesToLearn}
                    onChange={(e) => updatePatternConfig('minOccurrencesToLearn', parseInt(e.target.value))}
                    className="w-24 px-3 py-1 border border-gray-300 rounded-md text-sm"
                    disabled={!patternConfig.enabled}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of similar responses needed before creating a pattern
                  </p>
                </div>
              </div>

              {/* Learning Status */}
              <div className="bg-gray-50 rounded-lg p-3 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-2 w-2 rounded-full ${patternConfig.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="text-sm font-medium text-gray-700">
                    {patternConfig.enabled ? 'Pattern Learning Active' : 'Pattern Learning Disabled'}
                  </span>
                </div>
                <div className="text-xs text-gray-600">
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

          {/* Current Status */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Current Safety Status</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Blacklisted topics:</span>
                <span className="ml-2 font-medium">{settings.blacklistTopics.length} configured</span>
              </div>
              <div>
                <span className="text-gray-600">Escalation triggers:</span>
                <span className="ml-2 font-medium">{settings.escalationKeywords.length} active</span>
              </div>
              <div>
                <span className="text-gray-600">New pattern approval:</span>
                <span className="ml-2 font-medium">{settings.requireApprovalForNew ? 'Required' : 'Disabled'}</span>
              </div>
              <div>
                <span className="text-gray-600">Fallback responses:</span>
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
            fetchStats();
          }}
        />
      )}
    </div>
  );
};