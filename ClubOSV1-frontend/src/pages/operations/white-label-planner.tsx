import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navigation from '../../components/Navigation';
import LoadingSpinner from '../../components/LoadingSpinner';
import { CheckCircle, XCircle, Package, Palette, FileText, Link, Download, RefreshCw, Settings, AlertCircle } from 'lucide-react';

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
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/white-label-planner/inventory`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch inventory');

      const data = await response.json();
      setInventory(data);
      
      // Auto-select transferable items
      const autoSelected = {
        features: new Set(data.features.filter((f: Feature) => f.is_transferable).map((f: Feature) => f.id)),
        branding: new Set(),
        sops: new Set(),
        integrations: new Set(data.integrations.filter((i: Integration) => i.is_required).map((i: Integration) => i.id))
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
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/white-label-planner/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to analyze system');

      const data = await response.json();
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
      const token = localStorage.getItem('token');
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/white-label-planner/configurations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) throw new Error('Failed to save configuration');

      const saved = await response.json();
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
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/white-label-planner/blueprint/${configId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to generate blueprint');

      const blueprint = await response.json();
      
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
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Feature Inventory</h3>
        <div className="text-sm text-gray-600">
          {selectedItems.features.size} of {inventory.features.length} selected
        </div>
      </div>
      
      {Object.entries(groupBy(inventory.features, 'category')).map(([category, features]) => (
        <div key={category} className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-800 mb-3">{category}</h4>
          <div className="space-y-2">
            {(features as Feature[]).map(feature => (
              <div key={feature.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={selectedItems.features.has(feature.id)}
                  onChange={() => toggleSelection('features', feature.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{feature.feature_name}</span>
                    {feature.is_clubos_specific && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">ClubOS Specific</span>
                    )}
                    {feature.is_transferable && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Transferable</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                  {feature.dependencies.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
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
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Branding Items</h3>
        <div className="text-sm text-gray-600">
          {inventory.branding.length} items found
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="space-y-3">
          {inventory.branding.map(item => (
            <div key={item.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded">
              <input
                type="checkbox"
                checked={selectedItems.branding.has(item.id)}
                onChange={() => toggleSelection('branding', item.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium capitalize">{item.type}</span>
                  {item.is_hardcoded && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">Hardcoded</span>
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
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Standard Operating Procedures</h3>
        <div className="text-sm text-gray-600">
          {inventory.sops.length} SOPs found
        </div>
      </div>

      {Object.entries(groupBy(inventory.sops, 'type')).map(([type, sops]) => (
        <div key={type} className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-800 mb-3 capitalize">{type}</h4>
          <div className="space-y-2">
            {(sops as SOPItem[]).map(sop => (
              <div key={sop.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={selectedItems.sops.has(sop.id)}
                  onChange={() => toggleSelection('sops', sop.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{sop.name}</span>
                    {sop.is_replaceable && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Replaceable</span>
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
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Third-Party Integrations</h3>
        <div className="text-sm text-gray-600">
          {selectedItems.integrations.size} of {inventory.integrations.length} selected
        </div>
      </div>

      {Object.entries(groupBy(inventory.integrations, 'type')).map(([type, integrations]) => (
        <div key={type} className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-semibold text-gray-800 mb-3 capitalize">{type}</h4>
          <div className="space-y-2">
            {(integrations as Integration[]).map(integration => (
              <div key={integration.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                <input
                  type="checkbox"
                  checked={selectedItems.integrations.has(integration.id)}
                  onChange={() => toggleSelection('integrations', integration.id)}
                  disabled={integration.is_required}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{integration.service_name}</span>
                    {integration.is_required && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">Required</span>
                    )}
                    {integration.is_client_specific && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">Client Specific</span>
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
      <h3 className="text-lg font-semibold mb-4">Configuration Builder</h3>
      
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Configuration Name
            </label>
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g., Golf Simulator Management System"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={configDescription}
              onChange={(e) => setConfigDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
              placeholder="Describe the target client and their requirements..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="bg-gray-50 p-4 rounded">
              <h4 className="font-semibold mb-2">Selected Components</h4>
              <ul className="space-y-1 text-sm">
                <li>Features: {selectedItems.features.size}</li>
                <li>Branding Items: {selectedItems.branding.size}</li>
                <li>SOPs to Replace: {selectedItems.sops.size}</li>
                <li>Integrations: {selectedItems.integrations.size}</li>
              </ul>
            </div>

            <div className="bg-gray-50 p-4 rounded">
              <h4 className="font-semibold mb-2">Excluded Components</h4>
              <ul className="space-y-1 text-sm">
                <li>Features: {inventory.features.length - selectedItems.features.size}</li>
                <li>ClubOS-Specific: {inventory.features.filter(f => f.is_clubos_specific).length}</li>
                <li>Client-Specific Integrations: {inventory.integrations.filter(i => i.is_client_specific).length}</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={saveConfiguration}
              disabled={!configName}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              <Download className="w-4 h-4 inline mr-2" />
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation userRole="admin" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">White Label Planner</h1>
              <p className="mt-2 text-gray-600">
                Analyze ClubOS and plan white label implementations
              </p>
            </div>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 inline mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 inline mr-2" />
                  Run System Analysis
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h3 className="font-semibold text-yellow-800">Planning Mode Only</h3>
              <p className="text-sm text-yellow-700 mt-1">
                This tool analyzes the current system and helps plan white label implementations. 
                It does not modify any code or create the actual white label system.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'features', label: 'Feature Inventory', icon: Package },
                { id: 'branding', label: 'Branding', icon: Palette },
                { id: 'sops', label: 'SOPs', icon: FileText },
                { id: 'integrations', label: 'Integrations', icon: Link },
                { id: 'configuration', label: 'Configuration', icon: Settings }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'features' && renderFeatures()}
            {activeTab === 'branding' && renderBranding()}
            {activeTab === 'sops' && renderSOPs()}
            {activeTab === 'integrations' && renderIntegrations()}
            {activeTab === 'configuration' && renderConfiguration()}
          </div>
        </div>
      </div>
    </div>
  );
}