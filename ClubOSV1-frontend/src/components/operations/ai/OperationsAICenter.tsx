import React, { useState, useEffect } from 'react';
import { API_URL } from '@/utils/apiUrl';
import { useAuthState } from '@/state/useStore';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Brain, MessageSquare, Sparkles, Settings, RefreshCw, Download, BarChart3, Clock, AlertCircle, Check, X, ChevronRight, ChevronDown, Edit, Save, Trash2 } from 'lucide-react';
import { KnowledgeRouterPanel } from '@/components/admin/KnowledgeRouterPanel';
import { AIFeatureCard } from '@/components/AIFeatureCard';
import { FeedbackResponse } from '@/components/FeedbackResponse';
import { OpenPhoneConversations } from '@/components/OpenPhoneConversations';


interface AIFeature {
  id: string;
  feature_key: string;
  feature_name: string;
  description: string;
  category: string;
  enabled: boolean;
  config: any;
  allow_follow_up?: boolean;
  stats?: {
    total_uses: number;
    successful_uses: number;
    last_used?: string;
  };
}

interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export const OperationsAICenter: React.FC = () => {
  const [aiFeatures, setAIFeatures] = useState<AIFeature[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<any>({ total_documents: 0, unique_assistants: 0 });
  const [feedback, setFeedback] = useState<any[]>([]);
  const [openPhoneConversations, setOpenPhoneConversations] = useState<any[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    automations: true,
    knowledge: true,
    prompts: false
  });
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    content: '',
    category: 'general'
  });
  
  const { user } = useAuthState();
  const token = user?.token || localStorage.getItem('clubos_token');

  useEffect(() => {
    if (token) {
      fetchAIFeatures();
      fetchSystemMetrics();
      fetchFeedback();
      fetchOpenPhoneConversations();
      fetchPromptTemplates();
    }
  }, [token]);

  const fetchAIFeatures = async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${API_URL}/ai-automations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAIFeatures(response.data || []);
    } catch (error: any) {
      console.error('Error fetching AI features:', error);
      if (error.response?.status !== 401) {
        // Only show error if not auth issue
        // toast.error('Failed to load AI features');
      }
      setAIFeatures([]);
    }
  };

  const fetchSystemMetrics = async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${API_URL}/knowledge/metrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemMetrics(response.data || { total_documents: 0, unique_assistants: 0 });
    } catch (error) {
      console.error('Error fetching system metrics:', error);
      setSystemMetrics({ total_documents: 0, unique_assistants: 0 });
    }
  };

  const fetchFeedback = async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${API_URL}/llm/feedback`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeedback(response.data?.filter((f: any) => !f.helpful) || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      setFeedback([]);
    }
  };

  const fetchOpenPhoneConversations = async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${API_URL}/openphone/recent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOpenPhoneConversations(response.data || []);
    } catch (error) {
      console.error('Error fetching OpenPhone conversations:', error);
      setOpenPhoneConversations([]);
    }
  };

  const fetchPromptTemplates = async () => {
    try {
      const response = await axios.get(`${API_URL}/prompts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPromptTemplates(response.data.data || []);
    } catch (error) {
      console.error('Error fetching prompt templates:', error);
    }
  };

  const handleToggleFeature = async (featureKey: string, newValue: boolean) => {
    try {
      await axios.put(
        `${API_URL}/ai-automations/${featureKey}/toggle`,
        { is_active: newValue },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      fetchAIFeatures();
      toast.success(`Feature ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling feature:', error);
      toast.error('Failed to toggle feature');
    }
  };

  const handleSavePrompt = async (promptId: string) => {
    try {
      await axios.put(
        `${API_URL}/prompts/${promptId}`,
        { content: editedPrompt },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setEditingPrompt(null);
      fetchPromptTemplates();
      toast.success('Prompt updated successfully');
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast.error('Failed to save prompt');
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt template?')) return;
    
    try {
      await axios.delete(`${API_URL}/prompts/${promptId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPromptTemplates();
      toast.success('Prompt deleted successfully');
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
    }
  };

  const handleAddPrompt = async () => {
    if (!newPrompt.name || !newPrompt.content) {
      toast.error('Please fill in all fields');
      return;
    }
    
    try {
      await axios.post(
        `${API_URL}/prompts`,
        newPrompt,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setShowAddPrompt(false);
      setNewPrompt({ name: '', content: '', category: 'general' });
      fetchPromptTemplates();
      toast.success('Prompt template created successfully');
    } catch (error) {
      console.error('Error creating prompt:', error);
      toast.error('Failed to create prompt');
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const categories = ['all', ...Array.from(new Set(aiFeatures.map(f => f.category)))];

  const filteredFeatures = activeCategory === 'all' 
    ? aiFeatures 
    : aiFeatures.filter(f => f.category === activeCategory);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content - 2/3 width */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* AI Automations Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div 
            className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
            onClick={() => toggleSection('automations')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-gray-900">AI Automations</h2>
                <span className="text-sm text-gray-500">
                  ({aiFeatures.filter(f => f.enabled).length}/{aiFeatures.length} active)
                </span>
              </div>
              {expandedSections.automations ? 
                <ChevronDown className="h-5 w-5 text-gray-500" /> : 
                <ChevronRight className="h-5 w-5 text-gray-500" />
              }
            </div>
          </div>
          
          {expandedSections.automations && (
            <div className="p-6">
              {/* Category Filters */}
              <div className="flex flex-wrap gap-2 mb-4">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      activeCategory === category
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category === 'all' ? 'All' : category}
                  </button>
                ))}
              </div>
              
              {/* Feature Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFeatures.map((feature) => (
                  <AIFeatureCard
                    key={feature.id}
                    feature={feature}
                    onToggle={() => handleToggleFeature(feature.feature_key, !feature.enabled)}
                    onUpdate={fetchAIFeatures}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Knowledge Management Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div 
            className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
            onClick={() => toggleSection('knowledge')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-gray-900">Knowledge Management</h2>
                <span className="text-sm text-gray-500">
                  ({systemMetrics.total_documents} documents)
                </span>
              </div>
              {expandedSections.knowledge ? 
                <ChevronDown className="h-5 w-5 text-gray-500" /> : 
                <ChevronRight className="h-5 w-5 text-gray-500" />
              }
            </div>
          </div>
          
          {expandedSections.knowledge && (
            <div className="p-6">
              <KnowledgeRouterPanel />
              
              {/* Feedback Section */}
              {feedback.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Not Helpful Feedback</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {feedback.slice(0, 5).map((item, index) => (
                      <FeedbackResponse key={index} {...item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prompt Templates Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div 
            className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
            onClick={() => toggleSection('prompts')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-gray-900">Prompt Templates</h2>
                <span className="text-sm text-gray-500">
                  ({promptTemplates.length} templates)
                </span>
              </div>
              {expandedSections.prompts ? 
                <ChevronDown className="h-5 w-5 text-gray-500" /> : 
                <ChevronRight className="h-5 w-5 text-gray-500" />
              }
            </div>
          </div>
          
          {expandedSections.prompts && (
            <div className="p-6">
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setShowAddPrompt(true)}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                >
                  Add Template
                </button>
              </div>
              
              <div className="space-y-3">
                {promptTemplates.map((prompt) => (
                  <div key={prompt.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">{prompt.name}</h4>
                        <span className="text-xs text-gray-500">{prompt.category}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {editingPrompt === prompt.id ? (
                          <>
                            <button
                              onClick={() => handleSavePrompt(prompt.id)}
                              className="p-1 text-green-600 hover:text-green-700"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingPrompt(null)}
                              className="p-1 text-gray-600 hover:text-gray-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingPrompt(prompt.id);
                                setEditedPrompt(prompt.content);
                              }}
                              className="p-1 text-gray-600 hover:text-gray-700"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePrompt(prompt.id)}
                              className="p-1 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingPrompt === prompt.id ? (
                      <textarea
                        value={editedPrompt}
                        onChange={(e) => setEditedPrompt(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        rows={4}
                      />
                    ) : (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{prompt.content}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar - 1/3 width */}
      <div className="space-y-6">
        
        {/* System Metrics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-gray-900">System Metrics</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Documents</span>
                <span className="font-semibold">{systemMetrics.total_documents}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Active Assistants</span>
                <span className="font-semibold">{systemMetrics.unique_assistants || 4}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">AI Responses Today</span>
                <span className="font-semibold">
                  {aiFeatures.reduce((sum, f) => sum + (f.stats?.total_uses || 0), 0)}
                </span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Success Rate</span>
                <span className="font-semibold">
                  {aiFeatures.length > 0 
                    ? Math.round((aiFeatures.reduce((sum, f) => sum + (f.stats?.successful_uses || 0), 0) / 
                        aiFeatures.reduce((sum, f) => sum + (f.stats?.total_uses || 0), 1)) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                fetchAIFeatures();
                fetchSystemMetrics();
              }}
              className="w-full px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>

        {/* Recent Messages */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-gray-900">Recent Messages</h3>
            </div>
            <button
              onClick={fetchOpenPhoneConversations}
              className="p-1 text-gray-600 hover:text-gray-700"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {openPhoneConversations.length > 0 ? (
              openPhoneConversations.slice(0, 10).map((conv, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-medium text-gray-900">
                      {conv.customer_name || conv.phone_number}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(conv.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-600 line-clamp-2">{conv.initial_message}</p>
                  {conv.assistant_type && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                      {conv.assistant_type}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No recent messages</p>
            )}
          </div>
        </div>

        {/* Knowledge Export */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Download className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-gray-900">Export Tools</h3>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={() => {
                // Export knowledge functionality
                toast.success('Knowledge export started');
              }}
              className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Export Knowledge Base
            </button>
            <button
              onClick={() => {
                // Export AI metrics
                toast.success('Metrics export started');
              }}
              className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Export AI Metrics
            </button>
          </div>
        </div>
      </div>

      {/* Add Prompt Modal */}
      {showAddPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Prompt Template</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newPrompt.name}
                  onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newPrompt.category}
                  onChange={(e) => setNewPrompt({ ...newPrompt, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="general">General</option>
                  <option value="support">Support</option>
                  <option value="booking">Booking</option>
                  <option value="technical">Technical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={newPrompt.content}
                  onChange={(e) => setNewPrompt({ ...newPrompt, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={6}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddPrompt(false);
                  setNewPrompt({ name: '', content: '', category: 'general' });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPrompt}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};