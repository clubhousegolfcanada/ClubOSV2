import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Activity, 
  Shield, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Settings,
  RefreshCw,
  Download,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Zap,
  ChevronRight,
  Filter,
  Search,
  BarChart3,
  Radio
} from 'lucide-react';
import apiClient from '@/api/http';
import { LivePatternDashboard } from './LivePatternDashboard';
import logger from '@/services/logger';

interface PatternReasoning {
  thought_process: string;
  next_steps: string[];
  questions_to_ask?: string[];
  confidence_explanation: string;
}

interface Pattern {
  id: number;
  pattern_type: string;
  pattern_signature: string;
  trigger_text: string;
  response_template: string;
  confidence_score: number;
  auto_executable: boolean;
  execution_count: number;
  success_count: number;
  is_active: boolean;
  created_at: string;
  last_used?: string;
  last_reasoning?: PatternReasoning;
}

interface ExecutionHistory {
  id: number;
  pattern_id: number;
  conversation_id: string;
  message_text: string;
  execution_mode: string;
  confidence_at_execution: number;
  response_sent?: string;
  gpt4o_reasoning?: PatternReasoning;
  created_at: string;
  execution_status: string;
}

interface PatternStats {
  patterns: {
    total: number;
    avgConfidence: number;
  };
  executions: {
    total: number;
    live: number;
  };
  suggestions: {
    pending: number;
  };
  config: {
    enabled: boolean;
    shadow_mode: boolean;
    min_confidence_to_act: number;
  };
}

export const OperationsPatterns: React.FC = () => {
  const [stats, setStats] = useState<PatternStats | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'live' | 'overview' | 'patterns' | 'config'>('live');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [config, setConfig] = useState<any>(null);
  const [aiAutomations, setAiAutomations] = useState({
    giftCardInquiries: true,
    llmInitialAnalysis: true,
    trackmanReset: false
  });

  useEffect(() => {
    fetchStats();
    fetchPatterns();
    fetchConfig();
    fetchAiAutomations();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/patterns/stats');
      setStats(response.data);
    } catch (error) {
      logger.error('Failed to fetch pattern stats:', error);
    }
  };

  const fetchPatterns = async () => {
    try {
      const response = await apiClient.get('/patterns');
      // Handle both array and object response formats
      if (Array.isArray(response.data)) {
        setPatterns(response.data);
      } else if (response.data.patterns) {
        setPatterns(response.data.patterns);
      } else {
        setPatterns([]);
      }
    } catch (error) {
      logger.error('Failed to fetch patterns:', error);
      setPatterns([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await apiClient.get('/patterns/config');
      setConfig(response.data);
    } catch (error) {
      logger.error('Failed to fetch config:', error);
    }
  };

  const fetchAiAutomations = async () => {
    try {
      const response = await apiClient.get('/patterns/ai-automations');
      if (response.data) {
        setAiAutomations(response.data);
      }
    } catch (error) {
      logger.error('Failed to fetch AI automations:', error);
    }
  };

  const toggleAiAutomation = async (key: string) => {
    try {
      const newValue = !aiAutomations[key as keyof typeof aiAutomations];
      await apiClient.put('/patterns/ai-automations', { 
        [key]: newValue 
      });
      setAiAutomations(prev => ({
        ...prev,
        [key]: newValue
      }));
    } catch (error) {
      logger.error('Failed to toggle AI automation:', error);
    }
  };

  const updateConfig = async (key: string, value: any) => {
    try {
      await apiClient.put('/patterns/config', { [key]: value });
      await fetchConfig();
      await fetchStats();
    } catch (error) {
      logger.error('Failed to update config:', error);
    }
  };

  const togglePattern = async (patternId: number, isActive: boolean) => {
    try {
      await apiClient.put(`/patterns/${patternId}`, { is_active: !isActive });
      await fetchPatterns();
    } catch (error) {
      logger.error('Failed to toggle pattern:', error);
    }
  };

  const testMessage = async (message: string) => {
    try {
      const response = await apiClient.post('/patterns/test', { message });
      const result = response.data;
      alert(`Test Result: ${result.action}\nConfidence: ${result.confidence || 'N/A'}\nReason: ${result.reason || 'Pattern matched'}`);
    } catch (error) {
      logger.error('Failed to test message:', error);
    }
  };

  const filteredPatterns = patterns.filter(p => {
    if (filterType !== 'all' && p.pattern_type !== filterType) return false;
    if (searchTerm && !p.trigger_text.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.85) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 0.85) return 'bg-green-100';
    if (confidence >= 0.7) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Header with System Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Brain className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">V3-PLS (Pattern Learning System)</h1>
              <p className="text-sm text-gray-500">AI-powered message pattern recognition and automation</p>
            </div>
          </div>
          <button
            onClick={() => { fetchStats(); fetchPatterns(); }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* System Status Bar */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            {stats?.config.enabled ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-gray-400" />
            )}
            <span className="text-sm font-medium">
              System: {stats?.config.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {stats?.config.shadow_mode ? (
              <Eye className="h-5 w-5 text-blue-500" />
            ) : (
              <Zap className="h-5 w-5 text-orange-500" />
            )}
            <span className="text-sm font-medium">
              Mode: {stats?.config.shadow_mode ? 'Shadow (Safe)' : 'Live (Active)'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-purple-500" />
            <span className="text-sm font-medium">
              Confidence Threshold: {((stats?.config.min_confidence_to_act || 0) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
        <button
          onClick={() => setActiveView('live')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors ${
            activeView === 'live' 
              ? 'bg-primary text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center space-x-1">
            <Radio className="h-4 w-4" />
            <span>Live</span>
          </div>
        </button>
        <button
          onClick={() => setActiveView('overview')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors ${
            activeView === 'overview' 
              ? 'bg-primary text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveView('patterns')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors ${
            activeView === 'patterns' 
              ? 'bg-primary text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Patterns ({patterns.length})
        </button>
        <button
          onClick={() => setActiveView('config')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors ${
            activeView === 'config' 
              ? 'bg-primary text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Configuration
        </button>
      </div>

      {/* Live View */}
      {activeView === 'live' && (
        <LivePatternDashboard />
      )}

      {/* Overview View */}
      {activeView === 'overview' && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <Brain className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{stats?.patterns.total || 0}</span>
            </div>
            <p className="text-sm text-gray-600">Active Patterns</p>
            <p className="text-xs text-gray-500 mt-1">
              Avg Confidence: {((stats?.patterns.avgConfidence || 0) * 100).toFixed(1)}%
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{stats?.executions.total || 0}</span>
            </div>
            <p className="text-sm text-gray-600">Executions (7d)</p>
            <p className="text-xs text-gray-500 mt-1">
              Live: {stats?.executions.live || 0}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">{stats?.suggestions.pending || 0}</span>
            </div>
            <p className="text-sm text-gray-600">Pending Review</p>
            <p className="text-xs text-gray-500 mt-1">
              Awaiting approval
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">
                {patterns.filter(p => p.confidence_score >= 0.85).length}
              </span>
            </div>
            <p className="text-sm text-gray-600">High Confidence</p>
            <p className="text-xs text-gray-500 mt-1">
              Ready for automation
            </p>
          </div>
        </div>

        {/* AI Automations Card */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-gray-900">AI Automations</h2>
                <span className="text-sm text-gray-500">
                  ({Object.values(aiAutomations).filter(v => v).length}/3 active)
                </span>
              </div>
              <button
                onClick={() => setActiveView('config')}
                className="text-gray-400 hover:text-gray-600"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {/* Gift Card Inquiries */}
              <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Gift Card Inquiries</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Automatically respond to gift card purchase questions with link to purchase page
                  </p>
                  <span className="inline-block mt-2 text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    customer service
                  </span>
                </div>
                <button 
                  onClick={() => toggleAiAutomation('giftCardInquiries')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    aiAutomations.giftCardInquiries ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    aiAutomations.giftCardInquiries ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* LLM Initial Message Analysis */}
              <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-gray-900">LLM Initial Message Analysis</h3>
                    <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded">
                      RECOMMENDED
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Use AI to understand and respond to all initial customer messages
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    This uses AI to understand ALL initial messages, not just keyword matching
                  </p>
                  <span className="inline-block mt-2 text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    customer service
                  </span>
                </div>
                <button 
                  onClick={() => toggleAiAutomation('llmInitialAnalysis')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    aiAutomations.llmInitialAnalysis ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    aiAutomations.llmInitialAnalysis ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Trackman Reset */}
              <div className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">Trackman Reset</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Automatically reset frozen or unresponsive Trackman units via NinjaOne
                  </p>
                  <span className="inline-block mt-2 text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded">
                    technical
                  </span>
                </div>
                <button 
                  onClick={() => toggleAiAutomation('trackmanReset')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    aiAutomations.trackmanReset ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    aiAutomations.trackmanReset ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Patterns View */}
      {activeView === 'patterns' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Search and Filter */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patterns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Types</option>
                <option value="booking">Booking</option>
                <option value="tech_issue">Tech Issue</option>
                <option value="access">Access</option>
                <option value="faq">FAQ</option>
                <option value="gift_cards">Gift Cards</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          </div>

          {/* Patterns List */}
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {filteredPatterns.map((pattern) => (
              <div key={pattern.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded">
                        {pattern.pattern_type}
                      </span>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getConfidenceBg(pattern.confidence_score)} ${getConfidenceColor(pattern.confidence_score)}`}>
                        {(pattern.confidence_score * 100).toFixed(0)}%
                      </span>
                      {pattern.auto_executable && (
                        <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-600 rounded">
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 font-medium mb-1">
                      {pattern.trigger_text.substring(0, 100)}...
                    </p>
                    <p className="text-xs text-gray-500">
                      Used {pattern.execution_count} times • 
                      Success rate: {pattern.execution_count > 0 
                        ? ((pattern.success_count / pattern.execution_count) * 100).toFixed(0)
                        : 0}%
                    </p>
                  </div>
                  <button
                    onClick={() => togglePattern(pattern.id, pattern.is_active)}
                    className={`ml-4 p-2 rounded-lg transition-colors ${
                      pattern.is_active 
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {pattern.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration View */}
      {activeView === 'config' && config && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">System Configuration</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Pattern Learning</p>
                  <p className="text-sm text-gray-500">Enable the pattern learning system</p>
                </div>
                <button
                  onClick={() => updateConfig('enabled', !config.enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Shadow Mode</p>
                  <p className="text-sm text-gray-500">Log actions without executing (safe mode)</p>
                </div>
                <button
                  onClick={() => updateConfig('shadow_mode', !config.shadow_mode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.shadow_mode ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.shadow_mode ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Minimum Confidence to Act: {(config.min_confidence_to_act * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={config.min_confidence_to_act * 100}
                  onChange={(e) => updateConfig('min_confidence_to_act', parseFloat(e.target.value) / 100)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Minimum Occurrences to Learn: {config.min_occurrences_to_learn}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config.min_occurrences_to_learn}
                  onChange={(e) => updateConfig('min_occurrences_to_learn', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Test Message */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Test Pattern Matching</h2>
            <div className="space-y-4">
              <textarea
                placeholder="Enter a test message to see how the system would respond..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                rows={3}
              />
              <button
                onClick={() => {
                  const textarea = document.querySelector('textarea');
                  if (textarea?.value) {
                    testMessage(textarea.value);
                  }
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                Test Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};