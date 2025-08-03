import React, { useEffect, useState } from 'react';
import Navigation from '../components/Navigation';
import { useAuth } from '../store/useAuth';
import { Router } from '@reach/router';
import { RouteComponentProps } from '@reach/router';
import axios from 'axios';

interface AutomationFeature {
  id: string;
  feature_key: string;
  feature_name: string;
  description: string;
  category: string;
  enabled: boolean;
  config: any;
  required_permissions: string[];
  stats?: {
    total_uses: number;
    successful_uses: number;
    avg_execution_time: number;
    last_used: string | null;
  };
}

const AIAutomationsPage: React.FC<RouteComponentProps> = () => {
  const { checkPermission } = useAuth();
  const [features, setFeatures] = useState<AutomationFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlyEnabled, setShowOnlyEnabled] = useState(false);

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      const response = await axios.get('/api/ai-automations');
      setFeatures(response.data.features);
    } catch (error) {
      console.error('Failed to load automation features:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (featureKey: string, enabled: boolean) => {
    try {
      await axios.put(`/api/ai-automations/${featureKey}/toggle`, { enabled });
      
      // Update local state
      setFeatures(features.map(f => 
        f.feature_key === featureKey ? { ...f, enabled } : f
      ));
    } catch (error) {
      console.error('Failed to toggle feature:', error);
      alert('Failed to toggle feature. Please try again.');
    }
  };

  const toggleCategory = async (category: string, enabled: boolean) => {
    if (!checkPermission(['admin'])) {
      alert('Only administrators can bulk toggle features');
      return;
    }

    try {
      await axios.post('/api/ai-automations/bulk-toggle', { category, enabled });
      
      // Reload features
      await loadFeatures();
    } catch (error) {
      console.error('Failed to bulk toggle features:', error);
      alert('Failed to bulk toggle features. Please try again.');
    }
  };

  const categories = [
    { value: 'all', label: 'All Features' },
    { value: 'customer_service', label: 'Customer Service' },
    { value: 'technical', label: 'Technical' },
    { value: 'booking', label: 'Booking' }
  ];

  const filteredFeatures = features.filter(f => {
    if (selectedCategory !== 'all' && f.category !== selectedCategory) return false;
    if (showOnlyEnabled && !f.enabled) return false;
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'customer_service':
        return '💬';
      case 'technical':
        return '🔧';
      case 'booking':
        return '📅';
      case 'emergency':
        return '🚨';
      default:
        return '🤖';
    }
  };

  if (!checkPermission(['admin', 'operator'])) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>You need admin or operator permissions to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navigation />
      
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 mt-16">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">AI Automation Settings</h1>
          <p className="text-gray-400">Configure automated AI responses and actions</p>
        </div>

        {/* Filters and Controls */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showOnlyEnabled}
                  onChange={(e) => setShowOnlyEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show only enabled</span>
              </label>

              {checkPermission(['admin']) && selectedCategory !== 'all' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleCategory(selectedCategory, true)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                  >
                    Enable All
                  </button>
                  <button
                    onClick={() => toggleCategory(selectedCategory, false)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                  >
                    Disable All
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Features List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredFeatures.map(feature => (
              <div key={feature.id} className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getCategoryIcon(feature.category)}</span>
                      <h3 className="text-xl font-semibold">{feature.feature_name}</h3>
                      {feature.enabled && (
                        <span className="px-2 py-1 bg-green-600 rounded text-xs font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-400 mb-4">{feature.description}</p>

                    {/* Feature Stats */}
                    {feature.stats && feature.enabled && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        <div className="bg-gray-700 rounded p-3">
                          <div className="text-sm text-gray-400">Total Uses</div>
                          <div className="text-lg font-semibold">{feature.stats.total_uses}</div>
                        </div>
                        <div className="bg-gray-700 rounded p-3">
                          <div className="text-sm text-gray-400">Success Rate</div>
                          <div className="text-lg font-semibold">
                            {feature.stats.total_uses > 0 
                              ? `${Math.round((feature.stats.successful_uses / feature.stats.total_uses) * 100)}%`
                              : 'N/A'}
                          </div>
                        </div>
                        <div className="bg-gray-700 rounded p-3">
                          <div className="text-sm text-gray-400">Avg Time</div>
                          <div className="text-lg font-semibold">
                            {feature.stats.avg_execution_time 
                              ? `${Math.round(feature.stats.avg_execution_time)}ms`
                              : 'N/A'}
                          </div>
                        </div>
                        <div className="bg-gray-700 rounded p-3">
                          <div className="text-sm text-gray-400">Last Used</div>
                          <div className="text-lg font-semibold">
                            {feature.stats.last_used 
                              ? new Date(feature.stats.last_used).toLocaleDateString()
                              : 'Never'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Configuration Details */}
                    {feature.config && Object.keys(feature.config).length > 0 && (
                      <details className="mb-4">
                        <summary className="cursor-pointer text-sm text-blue-400 hover:text-blue-300">
                          View Configuration
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-700 rounded text-xs overflow-x-auto">
                          {JSON.stringify(feature.config, null, 2)}
                        </pre>
                      </details>
                    )}

                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>Required roles:</span>
                      {feature.required_permissions.map(role => (
                        <span key={role} className="px-2 py-1 bg-gray-700 rounded">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="ml-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={feature.enabled}
                        onChange={(e) => toggleFeature(feature.feature_key, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 bg-blue-900 bg-opacity-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-3">How AI Automations Work</h2>
          <ul className="space-y-2 text-sm text-gray-300">
            <li>• When enabled, AI will automatically respond to customer messages matching the configured patterns</li>
            <li>• Some automations require customer confirmation before taking action (e.g., Trackman resets)</li>
            <li>• All automated actions are logged for review and analytics</li>
            <li>• You can disable individual features or entire categories at any time</li>
            <li>• Usage statistics help you understand which automations are most valuable</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AIAutomationsPage;