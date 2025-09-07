import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { CheckCircle, XCircle, Package, Palette, FileText, Link, Download, RefreshCw, Settings, AlertCircle, Activity } from 'lucide-react';
import { http } from '@/api/http';
import { useAuthState } from '@/state/useStore';

interface Feature {
  id: string;
  category: string;
  feature_name: string;
  description: string;
  is_clubos_specific: boolean;
  is_transferable: boolean;
  dependencies: string[];
  file_locations: string[];
  database_tables: string[];
  api_endpoints: string[];
}

interface BrandingItem {
  id: string;
  type: string;
  location: string;
  current_value: string;
  is_hardcoded: boolean;
  file_path?: string;
  line_number?: number;
  replacement_strategy?: string;
}

interface SOPItem {
  id: string;
  name: string;
  type: string;
  description: string;
  location: any;
  is_replaceable: boolean;
  replacement_template?: string;
  dependencies: string[];
}

interface Integration {
  id: string;
  service_name: string;
  type: string;
  is_required: boolean;
  is_client_specific: boolean;
  configuration: any;
  api_keys_required: string[];
}

export default function WhiteLabelPlanner() {
  const router = useRouter();
  const { user } = useAuthState();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('features');
  const [inventory, setInventory] = useState<{
    features: Feature[];
    branding: BrandingItem[];
    sops: SOPItem[];
    integrations: Integration[];
  }>({
    features: [],
    branding: [],
    sops: [],
    integrations: []
  });
  const [selectedItems, setSelectedItems] = useState<{
    features: Set<string>;
    branding: Set<string>;
    sops: Set<string>;
    integrations: Set<string>;
  }>({
    features: new Set(),
    branding: new Set(),
    sops: new Set(),
    integrations: new Set()
  });
  const [configName, setConfigName] = useState('');
  const [configDescription, setConfigDescription] = useState('');

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/operations');
    } else {
      fetchInventory();
    }
  }, [user, router]);

  const fetchInventory = async () => {
    try {
      const { data } = await http.get('/api/white-label-planner/inventory');
      setInventory(data);
      
      // Auto-select transferable items
      const autoSelected = {
        features: new Set<string>(data.features.filter((f: Feature) => f.is_transferable).map((f: Feature) => f.id)),
        branding: new Set<string>(),
        sops: new Set<string>(),
        integrations: new Set<string>(data.integrations.filter((i: Integration) => i.is_required).map((i: Integration) => i.id))
      };
      setSelectedItems(autoSelected);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const { data } = await http.post('/api/white-label-planner/analyze');
      await fetchInventory(); // Refresh inventory after analysis
      alert(`Analysis complete! Found ${data.summary.total_features} features, ${data.summary.branding_items} branding items, ${data.summary.sops_count} SOPs, and ${data.summary.integrations_count} integrations.`);
    } catch (error) {
      console.error('Error analyzing system:', error);
      alert('Failed to analyze system');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSelection = (category: 'features' | 'branding' | 'sops' | 'integrations', id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev[category]);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { ...prev, [category]: newSet };
    });
  };

  const saveConfiguration = async () => {
    if (!configName) {
      alert('Please enter a configuration name');
      return;
    }

    try {
      const config = {
        name: configName,
        description: configDescription,
        features: Array.from(selectedItems.features),
        branding_items: Array.from(selectedItems.branding),
        sop_replacements: Array.from(selectedItems.sops),
        integrations: Array.from(selectedItems.integrations),
        excluded_features: inventory.features
          .filter(f => !selectedItems.features.has(f.id))
          .map(f => f.id),
        implementation_notes: `Auto-generated configuration for ${configName}`
      };

      const { data: saved } = await http.post('/api/white-label-planner/configurations', config);
      alert('Configuration saved successfully!');
      
      // Generate blueprint
      generateBlueprint(saved.id);
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration');
    }
  };

  const generateBlueprint = async (configId: string) => {
    try {
      const { data: blueprint } = await http.post(`/api/white-label-planner/blueprint/${configId}`);
      
      // Download blueprint as JSON
      const dataStr = JSON.stringify(blueprint, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `${configName.replace(/\s+/g, '-')}-blueprint.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Error generating blueprint:', error);
    }
  };

  const renderFeatures = () => (
    <div className="space-y-4">
      {Object.entries(groupBy(inventory.features, 'category')).map(([category, features]) => (
        <div key={category} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 mb-4">{category}</h4>
          <div className="space-y-2">
            {(features as Feature[]).map(feature => (
              <div key={feature.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={selectedItems.features.has(feature.id)}
                  onChange={() => toggleSelection('features', feature.id)}
                  className="mt-1 h-4 w-4 text-[var(--accent)] rounded border-gray-300 focus:ring-[var(--accent)]"
                />
                <div className="flex-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-medium text-gray-900">{feature.feature_name}</span>
                    {feature.is_clubos_specific && (
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full">ClubOS Specific</span>
                    )}
                    {feature.is_transferable && (
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full">Transferable</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                  {feature.dependencies.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Dependencies: {feature.dependencies.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderBranding = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="space-y-3">
          {inventory.branding.map(item => (
            <div key={item.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={selectedItems.branding.has(item.id)}
                onChange={() => toggleSelection('branding', item.id)}
                className="mt-1 h-4 w-4 text-[var(--accent)] rounded border-gray-300 focus:ring-[var(--accent)]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 capitalize">{item.type}</span>
                  {item.is_hardcoded && (
                    <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded-full">Hardcoded</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">Value: {item.current_value}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Location: {item.file_path || item.location}
                  {item.line_number && ` (Line ${item.line_number})`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSOPs = () => (
    <div className="space-y-4">
      {Object.entries(groupBy(inventory.sops, 'type')).map(([type, sops]) => (
        <div key={type} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 mb-4 capitalize">{type}</h4>
          <div className="space-y-2">
            {(sops as SOPItem[]).map(sop => (
              <div key={sop.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={selectedItems.sops.has(sop.id)}
                  onChange={() => toggleSelection('sops', sop.id)}
                  className="mt-1 h-4 w-4 text-[var(--accent)] rounded border-gray-300 focus:ring-[var(--accent)]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{sop.name}</span>
                    {sop.is_replaceable && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">Replaceable</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{sop.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderIntegrations = () => (
    <div className="space-y-4">
      {Object.entries(groupBy(inventory.integrations, 'type')).map(([type, integrations]) => (
        <div key={type} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-900 mb-4 capitalize">{type}</h4>
          <div className="space-y-2">
            {(integrations as Integration[]).map(integration => (
              <div key={integration.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={selectedItems.integrations.has(integration.id)}
                  onChange={() => toggleSelection('integrations', integration.id)}
                  disabled={integration.is_required}
                  className="mt-1 h-4 w-4 text-[var(--accent)] rounded border-gray-300 focus:ring-[var(--accent)] disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{integration.service_name}</span>
                    {integration.is_required && (
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full">Required</span>
                    )}
                    {integration.is_client_specific && (
                      <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded-full">Client Specific</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    API Keys: {integration.api_keys_required.join(', ') || 'None'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderConfiguration = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Configuration Name
            </label>
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="e.g., Golf Simulator Management System"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={configDescription}
              onChange={(e) => setConfigDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              rows={3}
              placeholder="Describe the target client and their requirements..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">Selected Components</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-gray-600">Features:</span>
                  <span className="font-medium text-gray-900">{selectedItems.features.size}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Branding Items:</span>
                  <span className="font-medium text-gray-900">{selectedItems.branding.size}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">SOPs to Replace:</span>
                  <span className="font-medium text-gray-900">{selectedItems.sops.size}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Integrations:</span>
                  <span className="font-medium text-gray-900">{selectedItems.integrations.size}</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">Excluded Components</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-gray-600">Features:</span>
                  <span className="font-medium text-gray-900">{inventory.features.length - selectedItems.features.size}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">ClubOS-Specific:</span>
                  <span className="font-medium text-gray-900">{inventory.features.filter(f => f.is_clubos_specific).length}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Client Integrations:</span>
                  <span className="font-medium text-gray-900">{inventory.integrations.filter(i => i.is_client_specific).length}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={saveConfiguration}
              disabled={!configName}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Save & Export Blueprint
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const groupBy = (array: any[], key: string) => {
    return array.reduce((result, item) => {
      const group = item[key];
      if (!result[group]) result[group] = [];
      result[group].push(item);
      return result;
    }, {});
  };

  const tabs = [
    { id: 'features', label: 'Feature Inventory', icon: Package },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'sops', label: 'SOPs', icon: FileText },
    { id: 'integrations', label: 'Integrations', icon: Link },
    { id: 'configuration', label: 'Configuration', icon: Settings }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>White Label Planner - ClubOS</title>
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)]">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <Package className="h-6 w-6 text-[var(--accent)]" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">White Label Planner</h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Analyze ClubOS and plan white label implementations
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center space-x-1">
                  <Activity className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Ready</span>
                </div>
                <button
                  onClick={runAnalysis}
                  disabled={analyzing}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:bg-gray-400 transition-colors flex items-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Run System Analysis
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-yellow-800">Planning Mode Only</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  This tool analyzes the current system and helps plan white label implementations. 
                  It does not modify any code or create the actual white label system.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="px-4 sm:px-6 lg:px-8 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{inventory.features.length}</div>
              <div className="text-xs text-gray-600">Total Features</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{inventory.branding.length}</div>
              <div className="text-xs text-gray-600">Branding Items</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{inventory.sops.length}</div>
              <div className="text-xs text-gray-600">SOPs</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{inventory.integrations.length}</div>
              <div className="text-xs text-gray-600">Integrations</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          {activeTab === 'features' && renderFeatures()}
          {activeTab === 'branding' && renderBranding()}
          {activeTab === 'sops' && renderSOPs()}
          {activeTab === 'integrations' && renderIntegrations()}
          {activeTab === 'configuration' && renderConfiguration()}
        </div>
      </div>

      <style jsx global>{`
        :root {
          --bg-primary: #fafafa;
          --bg-secondary: #ffffff;
          --text-primary: #1a1a1a;
          --text-secondary: #666666;
          --text-muted: #999999;
          --border: #e5e5e5;
          --accent: #0B3D3A;
          --accent-hover: #084a45;
          --success: #10b981;
          --warning: #f59e0b;
          --error: #ef4444;
          --info: #3b82f6;
        }
      `}</style>
    </>
  );
}