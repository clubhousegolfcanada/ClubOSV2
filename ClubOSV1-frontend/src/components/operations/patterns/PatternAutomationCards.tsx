import React, { useState, useEffect } from 'react';
import { Settings, Zap, Brain, TrendingUp, Clock, Edit2, Trash2, Plus } from 'lucide-react';
import apiClient from '@/api/http';
import logger from '@/services/logger';

interface PatternAutomation {
  id: number;
  pattern_type: string;
  trigger_text: string;
  response_template: string;
  trigger_keywords: string[];
  confidence_score: number;
  is_active: boolean;
  auto_executable: boolean;
  execution_count: number;
  success_count: number;
  last_used?: string;
  automation_name?: string;
  automation_description?: string;
  automation_icon?: string;
  automation_category?: string;
}

export const PatternAutomationCards: React.FC = () => {
  const [automations, setAutomations] = useState<PatternAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [editedResponse, setEditedResponse] = useState('');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchAutomations();
    fetchStats();
  }, []);

  const fetchAutomations = async () => {
    try {
      const response = await apiClient.get('/patterns');
      const patterns = response.data.patterns || response.data;
      
      // Format patterns as automations
      const formattedAutomations = Array.isArray(patterns) 
        ? patterns.map(formatPatternAsAutomation)
        : [];
      
      setAutomations(formattedAutomations);
    } catch (error) {
      logger.error('Failed to fetch automations:', error);
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/patterns/stats');
      setStats(response.data);
    } catch (error) {
      logger.error('Failed to fetch stats:', error);
    }
  };

  const formatPatternAsAutomation = (pattern: any): PatternAutomation => {
    // Auto-generate name if not set
    const name = pattern.automation_name || generateAutomationName(pattern);
    const description = pattern.automation_description || generateDescription(pattern);
    
    return {
      ...pattern,
      automation_name: name,
      automation_description: description,
      automation_icon: pattern.automation_icon || getIconForType(pattern.pattern_type),
      automation_category: pattern.automation_category || getCategoryForType(pattern.pattern_type)
    };
  };

  const generateAutomationName = (pattern: any): string => {
    const typeNames: Record<string, string> = {
      'gift_cards': 'Gift Card Inquiries',
      'hours': 'Hours & Location Info',
      'booking': 'Booking Assistance',
      'tech_issue': 'Technical Support',
      'membership': 'Membership Questions',
      'pricing': 'Pricing Information',
      'faq': 'Frequently Asked Questions',
      'access': 'Access & Door Issues',
      'general': 'General Inquiries'
    };
    
    return typeNames[pattern.pattern_type] || 
           pattern.trigger_text?.substring(0, 30) + '...' || 
           'Unnamed Automation';
  };

  const generateDescription = (pattern: any): string => {
    if (!pattern.trigger_text) return 'Automated response pattern';
    return `Automatically respond when customers ask: "${pattern.trigger_text.substring(0, 60)}${pattern.trigger_text.length > 60 ? '...' : ''}"`;
  };

  const getIconForType = (type: string): string => {
    const icons: Record<string, string> = {
      'gift_cards': '🎁',
      'hours': '🕐',
      'booking': '📅',
      'tech_issue': '🔧',
      'membership': '💳',
      'pricing': '💰',
      'faq': '❓',
      'access': '🚪',
      'general': '💬'
    };
    return icons[type] || '💬';
  };

  const getCategoryForType = (type: string): string => {
    const categories: Record<string, string> = {
      'gift_cards': 'customer_service',
      'hours': 'customer_service',
      'booking': 'customer_service',
      'tech_issue': 'technical',
      'membership': 'customer_service',
      'pricing': 'customer_service',
      'faq': 'customer_service',
      'access': 'technical',
      'general': 'customer_service'
    };
    return categories[type] || 'customer_service';
  };

  const toggleAutomation = async (id: number, currentState: boolean) => {
    try {
      await apiClient.put(`/patterns/${id}`, {
        is_active: !currentState
      });
      
      // Update local state
      setAutomations(prev => prev.map(a => 
        a.id === id ? { ...a, is_active: !currentState } : a
      ));
      
      // Refresh stats
      fetchStats();
    } catch (error) {
      logger.error('Failed to toggle automation:', error);
      alert('Failed to toggle automation. Please try again.');
    }
  };

  const saveEditedResponse = async (id: number) => {
    try {
      await apiClient.put(`/patterns/${id}`, {
        response_template: editedResponse
      });
      
      // Update local state
      setAutomations(prev => prev.map(a => 
        a.id === id ? { ...a, response_template: editedResponse } : a
      ));
      
      setEditingCard(null);
      setEditedResponse('');
    } catch (error) {
      logger.error('Failed to save response:', error);
      alert('Failed to save response. Please try again.');
    }
  };

  const deletePattern = async (id: number) => {
    if (!confirm('Are you sure you want to delete this automation? This cannot be undone.')) {
      return;
    }
    
    try {
      await apiClient.delete(`/patterns/${id}`);
      
      // Remove from local state
      setAutomations(prev => prev.filter(a => a.id !== id));
      setExpandedCard(null);
      
      // Refresh stats
      fetchStats();
    } catch (error) {
      logger.error('Failed to delete pattern:', error);
      alert('Failed to delete automation. Please try again.');
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.85) return 'text-green-600 bg-green-50';
    if (confidence >= 0.70) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getSuccessRate = (automation: PatternAutomation): number => {
    if (automation.execution_count === 0) return 0;
    return Math.round((automation.success_count / automation.execution_count) * 100);
  };

  const formatTimeAgo = (date: string): string => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Group automations by category
  const groupedAutomations = automations.reduce((acc, automation) => {
    const category = automation.automation_category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(automation);
    return acc;
  }, {} as Record<string, PatternAutomation[]>);

  const categoryTitles: Record<string, string> = {
    'customer_service': 'Customer Service',
    'technical': 'Technical Support',
    'booking': 'Booking & Reservations',
    'other': 'Other Automations'
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
      {/* Header with stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            AI Automations
            <span className="text-sm text-gray-500 font-normal">
              ({automations.filter(a => a.is_active).length}/{automations.length} active)
            </span>
          </h2>
        </div>
        
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {automations.length}
              </div>
              <div className="text-sm text-gray-500">Learned Patterns</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {automations.filter(a => a.is_active).length}
              </div>
              <div className="text-sm text-gray-500">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {automations.reduce((sum, a) => sum + a.execution_count, 0)}
              </div>
              <div className="text-sm text-gray-500">Total Uses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.patterns?.avgConfidence ? 
                  `${Math.round(stats.patterns.avgConfidence * 100)}%` : '0%'}
              </div>
              <div className="text-sm text-gray-500">Avg Confidence</div>
            </div>
          </div>
        )}
      </div>

      {/* Info box */}
      {automations.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Brain className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-blue-900">Pattern Learning Active</h3>
              <p className="text-sm text-blue-700 mt-1">
                The system is now learning from operator responses. When you respond to customer messages, 
                patterns will automatically be created and appear here as toggleable automations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Automation cards by category */}
      {Object.entries(groupedAutomations).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            {categoryTitles[category] || category}
          </h3>
          
          <div className="space-y-3">
            {items.map(automation => (
              <div
                key={automation.id}
                className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Title and status */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{automation.automation_icon}</span>
                        <h4 className="font-medium text-gray-900">
                          {automation.automation_name}
                        </h4>
                        {automation.confidence_score >= 0.85 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      
                      {/* Description */}
                      <p className="text-sm text-gray-600 mb-3">
                        {automation.automation_description}
                      </p>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className={`px-2 py-1 rounded ${getConfidenceColor(automation.confidence_score)}`}>
                          {Math.round(automation.confidence_score * 100)}% confident
                        </span>
                        {automation.execution_count > 0 && (
                          <>
                            <span>✨ Used {automation.execution_count} times</span>
                            <span>📊 {getSuccessRate(automation)}% success</span>
                          </>
                        )}
                        {automation.last_used && (
                          <span>🕐 {formatTimeAgo(automation.last_used)}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Controls */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => setExpandedCard(
                          expandedCard === automation.id ? null : automation.id
                        )}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                      
                      <button
                        onClick={() => toggleAutomation(automation.id, automation.is_active)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          automation.is_active ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                        title={automation.is_active ? 'Click to disable' : 'Click to enable'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            automation.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  
                  {/* Expanded details */}
                  {expandedCard === automation.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            When customer says:
                          </p>
                          <p className="text-sm text-gray-700 bg-blue-50 p-2 rounded italic">
                            "{automation.trigger_text}"
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            AI responds with:
                          </p>
                          {editingCard === automation.id ? (
                            <div className="space-y-2">
                              <textarea
                                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                                rows={4}
                                value={editedResponse}
                                onChange={(e) => setEditedResponse(e.target.value)}
                                placeholder="Enter response template..."
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveEditedResponse(automation.id)}
                                  className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingCard(null);
                                    setEditedResponse('');
                                  }}
                                  className="px-3 py-1.5 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm text-gray-700 bg-green-50 p-2 rounded whitespace-pre-wrap">
                                {automation.response_template}
                              </p>
                              <div className="flex justify-between mt-2">
                                <button
                                  onClick={() => {
                                    setEditingCard(automation.id);
                                    setEditedResponse(automation.response_template);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                  <Edit2 className="h-3 w-3" />
                                  Edit Response
                                </button>
                                <button
                                  onClick={() => deletePattern(automation.id)}
                                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {automation.trigger_keywords && automation.trigger_keywords.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">
                              Trigger keywords:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {automation.trigger_keywords.map((keyword, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded"
                                >
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {automations.length === 0 && (
        <div className="text-center py-12">
          <Brain className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No patterns learned yet.</p>
          <p className="text-sm text-gray-400 mt-1">
            Patterns will appear here as the system learns from operator responses.
          </p>
        </div>
      )}
    </div>
  );
};