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
  ChevronDown,
  Filter,
  Search,
  BarChart3,
  History,
  Upload,
  FileText,
  Loader2,
  Radio,
} from 'lucide-react';
import apiClient, { http } from '@/api/http';
import { PatternAutomationCards } from './PatternAutomationCards';
import logger from '@/services/logger';
import { AIFeatureCard } from '@/components/AIFeatureCard';
import { tokenManager } from '@/utils/tokenManager';
import { useAuthState } from '@/state/useStore';

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

// Pattern Item Component to handle expanded state
const PatternItem: React.FC<{ 
  pattern: Pattern; 
  togglePattern: (id: number, isActive: boolean) => void;
  getConfidenceBg: (score: number) => string;
  getConfidenceColor: (score: number) => string;
}> = ({ pattern, togglePattern, getConfidenceBg, getConfidenceColor }) => {
  const [expanded, setExpanded] = useState(false);
  const typeEmoji = {
    booking: '📅',
    tech_issue: '🔧',
    access: '🚪',
    faq: '❓',
    gift_cards: '🎁',
    hours: '🕐',
    general: '💬',
    membership: '💳'
  }[pattern.pattern_type] || '📝';
  
  return (
    <div className="hover:bg-gray-50 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Pattern Header */}
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg">{typeEmoji}</span>
              <span className="text-sm font-medium px-2 py-1 bg-gray-100 rounded capitalize">
                {pattern.pattern_type.replace('_', ' ')}
              </span>
              <span className={`text-xs font-medium px-2 py-1 rounded ${getConfidenceBg(pattern.confidence_score)} ${getConfidenceColor(pattern.confidence_score)}`}>
                {(pattern.confidence_score * 100).toFixed(0)}% confident
              </span>
              {pattern.auto_executable && (
                <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-600 rounded flex items-center">
                  <Zap className="h-3 w-3 mr-1" />
                  Auto
                </span>
              )}
            </div>
            
            {/* Customer Trigger */}
            <div className="mb-2">
              <p className="text-xs font-medium text-gray-500 mb-1">When customer says:</p>
              <p className="text-sm text-gray-900 bg-blue-50 p-2 rounded italic">
                &quot;{pattern.trigger_text.length > 150 
                  ? pattern.trigger_text.substring(0, 150) + '...' 
                  : pattern.trigger_text}&quot;
              </p>
            </div>
            
            {/* Response Template (Show on expand or if short) */}
            {(expanded || pattern.response_template.length < 100) && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 mb-1">AI will suggest:</p>
                <p className="text-sm text-gray-900 bg-green-50 p-2 rounded">
                  {pattern.response_template}
                </p>
              </div>
            )}
            
            {/* Stats */}
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>📊 Used {pattern.execution_count} times</span>
              <span>✅ {pattern.execution_count > 0 
                ? ((pattern.success_count / pattern.execution_count) * 100).toFixed(0)
                : 0}% success</span>
              {pattern.last_used && (
                <span>🕐 Last used: {new Date(pattern.last_used).toLocaleDateString()}</span>
              )}
            </div>
            
            {/* Expand/Collapse Button */}
            {pattern.response_template.length > 100 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-xs text-primary hover:text-primary-hover flex items-center"
              >
                {expanded ? 'Show less' : 'Show full response'}
                <ChevronRight className={`h-3 w-3 ml-1 transform transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
          
          {/* Enable/Disable Toggle */}
          <div className="ml-4 flex flex-col items-center">
            <button
              onClick={() => togglePattern(pattern.id, pattern.is_active)}
              className={`p-2 rounded-lg transition-colors ${
                pattern.is_active 
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
              title={pattern.is_active ? 'Pattern is active - click to disable' : 'Pattern is disabled - click to enable'}
            >
              {pattern.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <span className="text-xs text-gray-500 mt-1">
              {pattern.is_active ? 'Active' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

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

export const OperationsPatternsEnhanced: React.FC = () => {
  const [stats, setStats] = useState<PatternStats | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'automations' | 'overview'>('automations');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [config, setConfig] = useState<any>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [aiFeatures, setAIFeatures] = useState<any[]>([]);
  const [expandedAISection, setExpandedAISection] = useState(true);
  const { user } = useAuthState();
  const token = user?.token || tokenManager.getToken();

  useEffect(() => {
    fetchStats();
    fetchPatterns();
    fetchConfig();
    fetchExecutionHistory();
    if (token) {
      fetchAIFeatures();
    }
  }, [token]);

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
      if (Array.isArray(response.data)) {
        setPatterns(response.data);
      } else if (response.data.patterns) {
        setPatterns(response.data.patterns);
      } else {
        setPatterns([]);
      }
    } catch (error) {
      logger.error('Failed to fetch patterns:', error);
      setPatterns([]);
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

  const fetchExecutionHistory = async () => {
    try {
      const response = await apiClient.get('/patterns/execution-history?limit=20');
      setExecutionHistory(response.data.history || []);
    } catch (error) {
      logger.error('Failed to fetch execution history:', error);
      setExecutionHistory([]);
    }
  };

  const updateConfig = async (key: string, value: any) => {
    try {
      // Log the update attempt for debugging
      logger.info('Updating V3-PLS config:', { key, value });
      
      await apiClient.put('/patterns/config', { [key]: value });
      
      // Fetch updated config to reflect changes
      await fetchConfig();
      await fetchStats();
      
      logger.info('V3-PLS config updated successfully:', { key, value });
    } catch (error) {
      logger.error('Failed to update config:', error);
    }
  };

  const fetchAIFeatures = async () => {
    if (!token) return;
    
    try {
      const response = await http.get('/ai-automations', {});
      setAIFeatures(response.data || []);
    } catch (error: any) {
      logger.error('Error fetching AI features:', error);
      setAIFeatures([]);
    }
  };

  const handleToggleAIFeature = async (featureKey: string, newValue: boolean) => {
    try {
      await http.put(
        `/ai-automations/${featureKey}/toggle`,
        { is_active: newValue },
        {}
      );
      await fetchAIFeatures();
    } catch (error) {
      logger.error('Failed to toggle AI feature:', error);
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
      const result = response.data.result || response.data;
      
      // Show detailed reasoning from GPT-4o
      const reasoning = result.reasoning ? `

🧠 GPT-4o Reasoning:
${result.reasoning.thought_process}

📋 Next Steps:
${result.reasoning.next_steps?.join('\n') || 'None'}

❓ Questions to Ask:
${result.reasoning.questions_to_ask?.join('\n') || 'None'}` : '';
      
      alert(`🎯 Test Result: ${result.action}
📊 Confidence: ${((result.confidence || 0) * 100).toFixed(1)}%
🏷️ Pattern Type: ${result.pattern?.pattern_type || 'None'}
💬 Response: ${result.response?.substring(0, 200) || 'No response generated'}${reasoning}`);
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
            <div className="relative">
              <Brain className="h-8 w-8 text-primary" />
              <span className="absolute -top-1 -right-1 px-1 py-0.5 text-xs bg-purple-600 text-white rounded font-bold">GPT-4o</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">V3-PLS (Pattern Learning System)</h1>
              <p className="text-sm text-gray-500">GPT-4o powered adaptive reasoning with real-time context awareness</p>
            </div>
          </div>
          <button
            onClick={() => { fetchStats(); fetchPatterns(); fetchExecutionHistory(); }}
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

      {/* Simple Navigation Tabs */}
      <div className="flex space-x-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
        <button
          onClick={() => setActiveView('automations')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors ${
            activeView === 'automations' 
              ? 'bg-primary text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center space-x-1">
            <Zap className="h-4 w-4" />
            <span>AI Automations</span>
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
          <div className="flex items-center justify-center space-x-1">
            <BarChart3 className="h-4 w-4" />
            <span>Statistics</span>
          </div>
        </button>
      </div>

      {/* Automations View */}
      {activeView === 'automations' && (
        <PatternAutomationCards />
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
            <p className="text-sm text-gray-600">Total Executions</p>
            <p className="text-xs text-gray-500 mt-1">
              Live Actions: {stats?.executions.live || 0}
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

        {/* GPT-4o Features Card */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-sm border border-purple-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-purple-600 text-white rounded-lg">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">GPT-4o Reasoning Engine</h2>
              <p className="text-sm text-gray-600">Advanced AI capabilities for adaptive responses</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/80 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">🧠 Context-Aware Responses</h3>
              <p className="text-sm text-gray-600">
                Analyzes conversation history and adapts responses based on context
              </p>
            </div>
            <div className="bg-white/80 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">🎯 Multi-Step Planning</h3>
              <p className="text-sm text-gray-600">
                Plans complex resolutions across multiple customer interactions
              </p>
            </div>
            <div className="bg-white/80 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">💡 Intelligent Reasoning</h3>
              <p className="text-sm text-gray-600">
                Provides transparent reasoning for every decision and response
              </p>
            </div>
          </div>
        </div>
        </>
      )}



      {/* Removed config, history, patterns, etc. - keeping only automations and overview */}
      {false && config && (
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

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-Send Patterns</p>
                  <p className="text-sm text-gray-500">Automatically send responses at high confidence</p>
                </div>
                <button
                  onClick={() => updateConfig('auto_send_enabled', !config.auto_send_enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config.auto_send_enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.auto_send_enabled ? 'translate-x-6' : 'translate-x-1'
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
                  Minimum Confidence to Suggest: {(config.min_confidence_to_suggest * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="30"
                  max="90"
                  value={(config.min_confidence_to_suggest || 0.7) * 100}
                  onChange={(e) => updateConfig('min_confidence_to_suggest', parseFloat(e.target.value) / 100)}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Test Message with GPT-4o */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Brain className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold">Test Pattern Matching with GPT-4o</h2>
            </div>
            <div className="space-y-4">
              <textarea
                id="test-message"
                placeholder="Enter a test message to see how GPT-4o would respond..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                rows={3}
              />
              <button
                onClick={() => {
                  const textarea = document.getElementById('test-message') as HTMLTextAreaElement;
                  if (textarea?.value) {
                    testMessage(textarea.value);
                  }
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center space-x-2"
              >
                <Zap className="h-4 w-4" />
                <span>Test with GPT-4o Reasoning</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Automations View */}
      {activeView === 'automations' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div 
              className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedAISection(!expandedAISection)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-gray-900">AI Automations</h2>
                  <span className="text-sm text-gray-500">
                    ({aiFeatures.filter(f => f.enabled).length} active)
                  </span>
                </div>
                {expandedAISection ? 
                  <ChevronDown className="h-5 w-5 text-gray-500" /> : 
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                }
              </div>
            </div>
            
            {expandedAISection && (
              <div className="p-6">
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>AI Automations</strong> use keyword matching to trigger automatic responses. 
                    They work alongside the Pattern Learning System for comprehensive coverage.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiFeatures.map((feature) => (
                    <AIFeatureCard
                      key={feature.id}
                      feature={feature}
                      onToggle={() => handleToggleAIFeature(feature.feature_key, !feature.enabled)}
                      onUpdate={fetchAIFeatures}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Removed import view */}
      {false && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-purple-600 text-white rounded-lg">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Import OpenPhone Conversations</h2>
                <p className="text-sm text-gray-600">Accelerate pattern learning by importing your conversation history</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Paste your OpenPhone CSV data here</p>
                <textarea
                  id="csv-import"
                  placeholder="id,conversationId,body,sentAt,to,from,direction,createdAt
AC1BD1e24,AC3BDd48d8,Thank you,1.9027E+10,+19022345678,+16037891234,incoming,2025-09-02T21:05:34.885Z..."
                  className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Tip: Export your OpenPhone conversations as CSV and paste the entire contents here
                </p>
              </div>

              <div className="flex items-start space-x-4">
                <button
                  id="import-csv-btn"
                  onClick={async () => {
                    const textarea = document.getElementById('csv-import') as HTMLTextAreaElement;
                    const button = document.getElementById('import-csv-btn') as HTMLButtonElement;
                    const resultsDiv = document.getElementById('import-results') as HTMLDivElement;
                    
                    if (!textarea?.value) {
                      alert('Please paste CSV data first');
                      return;
                    }

                    button.disabled = true;
                    button.innerHTML = '<span class="flex items-center"><svg class="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Processing...</span>';
                    
                    try {
                      const response = await apiClient.post('/patterns/import-csv', {
                        csvData: textarea.value
                      });
                      
                      const result = response.data;
                      const duplicatePercentage = result.totalMessages > 0 
                        ? ((result.duplicateMessages / result.totalMessages) * 100).toFixed(1)
                        : 0;
                      
                      resultsDiv.innerHTML = `
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h3 class="font-semibold text-green-800 mb-2">✅ Import Successful!</h3>
                          <ul class="space-y-1 text-sm text-green-700">
                            <li>📊 Total messages: ${result.totalMessages || 0}</li>
                            <li>🔄 Duplicate messages skipped: ${result.duplicateMessages || 0} (${duplicatePercentage}%)</li>
                            <li>✨ New messages processed: ${result.newMessages || 0}</li>
                            <li>🔍 Conversations analyzed: ${result.conversationsAnalyzed || 0}</li>
                            <li>🆕 New patterns created: ${result.newPatterns || 0}</li>
                            <li>📈 Existing patterns enhanced: ${result.enhancedPatterns || 0}</li>
                            <li>🧠 Average confidence: ${((result.avgConfidence || 0) * 100).toFixed(1)}%</li>
                          </ul>
                          ${result.duplicateMessages > 0 ? `
                            <p class="text-xs text-yellow-600 mt-3 p-2 bg-yellow-50 rounded">
                              ⚠️ ${result.duplicateMessages} messages were already imported previously and were skipped to prevent duplicates.
                            </p>
                          ` : ''}
                          <p class="text-xs text-green-600 mt-3">
                            Import Job ID: ${result.importJobId || 'N/A'}
                          </p>
                        </div>
                      `;
                      
                      // Refresh patterns list
                      await fetchPatterns();
                      await fetchStats();
                      
                      // Clear the textarea after successful import
                      setTimeout(() => {
                        textarea.value = '';
                      }, 3000);
                      
                    } catch (error: any) {
                      resultsDiv.innerHTML = `
                        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                          <h3 class="font-semibold text-red-800 mb-2">❌ Import Failed</h3>
                          <p class="text-sm text-red-700">${error.response?.data?.error || error.message || 'Unknown error occurred'}</p>
                        </div>
                      `;
                    } finally {
                      button.disabled = false;
                      button.innerHTML = '<span class="flex items-center"><svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>Import CSV</span>';
                    }
                  }}
                  className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </button>
                
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 mb-2">How it works:</h3>
                  <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    <li>GPT-4o analyzes each conversation</li>
                    <li>Extracts patterns from operator responses</li>
                    <li>Groups similar messages automatically</li>
                    <li>Creates reusable response templates</li>
                    <li>Sets initial confidence based on consistency</li>
                  </ol>
                </div>
              </div>

              <div id="import-results"></div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">📝 Expected CSV Format</h3>
                <p className="text-sm text-blue-800 mb-3">Your OpenPhone export should have these columns:</p>
                <code className="block bg-white p-3 rounded text-xs">
                  id, conversationId, body, sentAt, to, from, direction, createdAt
                </code>
                <p className="text-xs text-blue-700 mt-2">
                  The system will automatically identify customer messages (incoming) and operator responses (outgoing),
                  then use GPT-4o to extract patterns and create templates with dynamic variables.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};