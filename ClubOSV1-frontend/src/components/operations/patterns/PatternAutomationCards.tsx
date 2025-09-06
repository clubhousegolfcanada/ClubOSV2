import React, { useState, useEffect } from 'react';
import { 
  Settings, Zap, Brain, TrendingUp, Clock, Edit2, Trash2, Plus, CheckCircle, AlertCircle,
  Gift, Calendar, Wrench, CreditCard, DollarSign, HelpCircle, DoorOpen, MessageCircle
} from 'lucide-react';
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
  automation_icon?: React.ComponentType<{ className?: string }>;
  automation_category?: string;
}

export const PatternAutomationCards: React.FC = () => {
  const [automations, setAutomations] = useState<PatternAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [editedResponse, setEditedResponse] = useState('');
  const [editedTrigger, setEditedTrigger] = useState('');
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
    const typeConfig = getTypeConfig(pattern.pattern_type);
    
    return {
      ...pattern,
      automation_name: typeConfig.name,
      automation_description: typeConfig.description,
      automation_icon: typeConfig.icon,
      automation_category: typeConfig.category,
      trigger_keywords: pattern.trigger_keywords || extractKeywords(pattern.trigger_text || pattern.pattern_signature)
    };
  };

  const extractKeywords = (text: string): string[] => {
    if (!text) return [];
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for'];
    return words.filter(word => word.length > 3 && !stopWords.includes(word));
  };

  const getTypeConfig = (type: string) => {
    const configs: Record<string, { name: string; description: string; icon: React.ComponentType<{ className?: string }>; category: string }> = {
      'gift_cards': {
        name: 'Gift Card Inquiries',
        description: 'Automatically responds to questions about gift cards and purchases',
        icon: Gift,
        category: 'customer_service'
      },
      'hours': {
        name: 'Hours of Operation',
        description: 'Provides current operating hours when customers ask',
        icon: Clock,
        category: 'customer_service'
      },
      'booking': {
        name: 'Booking Assistance',
        description: 'Helps customers with booking questions and directs them to Skedda',
        icon: Calendar,
        category: 'customer_service'
      },
      'tech_issue': {
        name: 'Technical Support',
        description: 'Responds to simulator and equipment issues',
        icon: Wrench,
        category: 'technical'
      },
      'membership': {
        name: 'Membership Information',
        description: 'Provides details about membership options and benefits',
        icon: CreditCard,
        category: 'customer_service'
      },
      'pricing': {
        name: 'Pricing Questions',
        description: 'Responds with current pricing and package information',
        icon: DollarSign,
        category: 'customer_service'
      },
      'faq': {
        name: 'Frequently Asked Questions',
        description: 'Handles common questions automatically',
        icon: HelpCircle,
        category: 'customer_service'
      },
      'access': {
        name: 'Access Issues',
        description: 'Helps with door access and entry problems',
        icon: DoorOpen,
        category: 'technical'
      },
      'general': {
        name: 'General Inquiry',
        description: 'Handles miscellaneous customer questions',
        icon: MessageCircle,
        category: 'customer_service'
      }
    };
    
    return configs[type] || configs['general'];
  };

  const toggleAutomation = async (id: number, currentState: boolean) => {
    try {
      await apiClient.put(`/patterns/${id}`, {
        is_active: !currentState
      });
      
      setAutomations(prev => prev.map(a => 
        a.id === id ? { ...a, is_active: !currentState } : a
      ));
      
      fetchStats();
    } catch (error) {
      logger.error('Failed to toggle automation:', error);
    }
  };

  const saveEditedPattern = async (id: number) => {
    try {
      // Prepare update object
      const updates: any = {
        response_template: editedResponse
      };
      
      // If trigger was edited, update trigger_examples
      const currentAutomation = automations.find(a => a.id === id);
      if (editedTrigger && editedTrigger !== currentAutomation?.trigger_text) {
        // Send trigger as an array of examples
        updates.trigger_examples = [editedTrigger];
        updates.trigger_text = editedTrigger;
      }
      
      // Use regular patterns endpoint 
      await apiClient.put(`/patterns/${id}`, updates);
      
      setAutomations(prev => prev.map(a => 
        a.id === id ? { 
          ...a, 
          response_template: editedResponse,
          trigger_text: editedTrigger || a.trigger_text 
        } : a
      ));
      
      setEditingCard(null);
      setEditedResponse('');
      setEditedTrigger('');
    } catch (error) {
      logger.error('Failed to save pattern:', error);
    }
  };

  const deletePattern = async (id: number) => {
    if (!confirm('Are you sure you want to delete this automation? This cannot be undone.')) {
      return;
    }
    
    try {
      await apiClient.delete(`/patterns/${id}`);
      setAutomations(prev => prev.filter(a => a.id !== id));
      fetchStats();
    } catch (error) {
      logger.error('Failed to delete pattern:', error);
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.85) return 'text-green-700 bg-green-50';
    if (confidence >= 0.70) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  };

  const getSuccessRate = (automation: PatternAutomation): number => {
    if (automation.execution_count === 0) return 0;
    return Math.round((automation.success_count / automation.execution_count) * 100);
  };

  const formatTimeAgo = (date: string | undefined): string => {
    if (!date) return 'Never used';
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
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
      {/* Info box if no patterns */}
      {automations.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-start">
            <Brain className="h-6 w-6 text-primary mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-base font-medium text-gray-900">Pattern Learning System Active</h3>
              <p className="text-sm text-gray-600 mt-1">
                The system is learning from operator responses. When you respond to customer messages, 
                patterns will automatically be created and appear here as automation cards.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Automation cards in 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {automations.map(automation => (
          <div
            key={automation.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200"
          >
            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  {automation.automation_icon && (
                    <automation.automation_icon className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-base">
                      {automation.automation_name}
                    </h4>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {automation.automation_description}
                    </p>
                  </div>
                </div>
                
                {/* Toggle switch */}
                <button
                  onClick={() => toggleAutomation(automation.id, automation.is_active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    automation.is_active ? 'bg-primary' : 'bg-gray-300'
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

              {/* Stats row */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(automation.confidence_score)}`}>
                  {Math.round(automation.confidence_score * 100)}% confident
                </span>
                {automation.execution_count > 0 && (
                  <>
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {automation.execution_count} uses
                    </span>
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      {getSuccessRate(automation) >= 80 ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-yellow-600" />
                      )}
                      {getSuccessRate(automation)}% success
                    </span>
                  </>
                )}
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(automation.last_used)}
                </span>
              </div>

              {/* Trigger and Response always visible */}
              <div className="space-y-3 border-t pt-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Triggers when customer says:</p>
                  {editingCard === automation.id ? (
                    <textarea
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-primary italic"
                      rows={2}
                      value={editedTrigger}
                      onChange={(e) => setEditedTrigger(e.target.value)}
                      placeholder="Enter trigger phrase..."
                    />
                  ) : (
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded italic">
                      "{automation.trigger_text}"
                    </p>
                  )}
                </div>
                
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">AI responds with:</p>
                  {editingCard === automation.id ? (
                    <div className="space-y-2">
                      <textarea
                        className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-primary"
                        rows={3}
                        value={editedResponse}
                        onChange={(e) => setEditedResponse(e.target.value)}
                        placeholder="Enter response template..."
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEditedPattern(automation.id)}
                          className="px-3 py-1.5 bg-primary text-white rounded text-xs hover:opacity-90 transition-opacity"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => {
                            setEditingCard(null);
                            setEditedResponse('');
                            setEditedTrigger('');
                          }}
                          className="px-3 py-1.5 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 bg-green-50 p-2 rounded whitespace-pre-wrap">
                      {automation.response_template}
                    </p>
                  )}
                </div>

                {/* Action buttons always visible */}
                <div className="flex justify-between pt-2 border-t">
                  <button
                    onClick={() => {
                      setEditingCard(automation.id);
                      setEditedResponse(automation.response_template);
                      setEditedTrigger(automation.trigger_text);
                    }}
                    className="text-sm text-primary hover:opacity-80 flex items-center gap-1 font-medium"
                    disabled={editingCard === automation.id}
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit Pattern
                  </button>
                  <button
                    onClick={() => deletePattern(automation.id)}
                    className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1 font-medium"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};