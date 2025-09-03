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
  History
} from 'lucide-react';
import apiClient from '@/api/http';

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

export const OperationsPatternsEnhanced: React.FC = () => {
  const [stats, setStats] = useState<PatternStats | null>(null);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'overview' | 'patterns' | 'config' | 'history'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [config, setConfig] = useState<any>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);

  useEffect(() => {
    fetchStats();
    fetchPatterns();
    fetchConfig();
    fetchExecutionHistory();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/patterns/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch pattern stats:', error);
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
      console.error('Failed to fetch patterns:', error);
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
      console.error('Failed to fetch config:', error);
    }
  };

  const fetchExecutionHistory = async () => {
    try {
      const response = await apiClient.get('/patterns/execution-history?limit=20');
      setExecutionHistory(response.data.history || []);
    } catch (error) {
      console.error('Failed to fetch execution history:', error);
      setExecutionHistory([]);
    }
  };

  const updateConfig = async (key: string, value: any) => {
    try {
      await apiClient.put('/patterns/config', { [key]: value });
      await fetchConfig();
      await fetchStats();
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  const togglePattern = async (patternId: number, isActive: boolean) => {
    try {
      await apiClient.put(`/patterns/${patternId}`, { is_active: !isActive });
      await fetchPatterns();
    } catch (error) {
      console.error('Failed to toggle pattern:', error);
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
      console.error('Failed to test message:', error);
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

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
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
        <button
          onClick={() => setActiveView('history')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors ${
            activeView === 'history' 
              ? 'bg-primary text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center space-x-1">
            <History className="h-4 w-4" />
            <span>History ({executionHistory.length})</span>
          </div>
        </button>
      </div>

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

      {/* Execution History View */}
      {activeView === 'history' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Recent Pattern Executions</h2>
            <p className="text-sm text-gray-500">Shows GPT-4o reasoning and outcomes</p>
          </div>
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {executionHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No execution history yet. Pattern matching will appear here once messages are processed.
              </div>
            ) : (
              executionHistory.map((exec) => (
                <div key={exec.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        exec.execution_mode === 'auto' ? 'bg-green-100 text-green-700' :
                        exec.execution_mode === 'suggested' ? 'bg-yellow-100 text-yellow-700' :
                        exec.execution_mode === 'shadow' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {exec.execution_mode}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(exec.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <span className={`text-xs font-medium ${getConfidenceColor(exec.confidence_at_execution)}`}>
                      {(exec.confidence_at_execution * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 mb-2">
                    <strong>Message:</strong> {exec.message_text.substring(0, 100)}...
                  </p>
                  {exec.response_sent && (
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Response:</strong> {exec.response_sent.substring(0, 100)}...
                    </p>
                  )}
                  {exec.gpt4o_reasoning && (
                    <div className="mt-2 p-2 bg-purple-50 rounded-lg">
                      <p className="text-xs font-medium text-purple-700 mb-1">GPT-4o Reasoning:</p>
                      <p className="text-xs text-purple-600">{exec.gpt4o_reasoning.thought_process}</p>
                      {exec.gpt4o_reasoning.next_steps && exec.gpt4o_reasoning.next_steps.length > 0 && (
                        <div className="mt-1">
                          <p className="text-xs font-medium text-purple-700">Next Steps:</p>
                          <ul className="text-xs text-purple-600 list-disc list-inside">
                            {exec.gpt4o_reasoning.next_steps.map((step, i) => (
                              <li key={i}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
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
    </div>
  );
};