import React, { useState, useEffect } from 'react';
import { Package, Palette, FileText, Link, Settings, Plus, Save, Download, Trash2, Check, X, Filter, AlertCircle, Search, RefreshCw, Code, GitBranch } from 'lucide-react';
import { http } from '@/api/http';
import { SimpleThemeConfig } from './SimpleThemeConfig';

interface Feature {
  id: string;
  name: string;
  category: string;
  is_transferable: boolean;
  notes: string;
}

interface BrandingItem {
  id: string;
  element_type: string;
  current_value: string;
  is_customizable: boolean;
  notes: string;
}

interface SOP {
  id: string;
  name: string;
  category: string;
  is_industry_specific: boolean;
  notes: string;
}

interface Integration {
  id: string;
  name: string;
  type: string;
  is_required: boolean;
  notes: string;
}

export const WhiteLabelPlanner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'scanner' | 'features' | 'branding' | 'sops' | 'integrations' | 'configuration'>('scanner');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states for manual input
  const [newFeature, setNewFeature] = useState<Partial<Feature>>({});
  const [newBranding, setNewBranding] = useState<Partial<BrandingItem>>({});
  const [newSOP, setNewSOP] = useState<Partial<SOP>>({});
  const [newIntegration, setNewIntegration] = useState<Partial<Integration>>({});

  // Data states
  const [features, setFeatures] = useState<Feature[]>([]);
  const [branding, setBranding] = useState<BrandingItem[]>([]);
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  // Filter states
  const [featureFilter, setFeatureFilter] = useState<string>('all');
  const [sopFilter, setSopFilter] = useState<string>('all');
  const [integrationFilter, setIntegrationFilter] = useState<string>('all');

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

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data } = await http.get('/white-label-planner/inventory');
      setFeatures(data.features || []);
      setBranding(data.branding || []);
      setSOPs(data.sops || []);
      setIntegrations(data.integrations || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFeature = async () => {
    if (!newFeature.name || !newFeature.category) return;

    setSaving(true);
    try {
      const { data } = await http.post('/white-label-planner/inventory/feature', newFeature);
      setFeatures([...features, data]);
      setNewFeature({});
    } catch (error) {
      console.error('Error adding feature:', error);
    } finally {
      setSaving(false);
    }
  };

  const addBranding = async () => {
    if (!newBranding.element_type || !newBranding.current_value) return;

    setSaving(true);
    try {
      const { data } = await http.post('/white-label-planner/inventory/branding', newBranding);
      setBranding([...branding, data]);
      setNewBranding({});
    } catch (error) {
      console.error('Error adding branding:', error);
    } finally {
      setSaving(false);
    }
  };

  const addSOP = async () => {
    if (!newSOP.name || !newSOP.category) return;

    setSaving(true);
    try {
      const { data } = await http.post('/white-label-planner/inventory/sop', newSOP);
      setSOPs([...sops, data]);
      setNewSOP({});
    } catch (error) {
      console.error('Error adding SOP:', error);
    } finally {
      setSaving(false);
    }
  };

  const addIntegration = async () => {
    if (!newIntegration.name || !newIntegration.type) return;

    setSaving(true);
    try {
      const { data } = await http.post('/white-label-planner/inventory/integration', newIntegration);
      setIntegrations([...integrations, data]);
      setNewIntegration({});
    } catch (error) {
      console.error('Error adding integration:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (type: string, id: string) => {
    try {
      await http.delete(`/white-label-planner/inventory/${type}/${id}`);

      switch(type) {
        case 'feature':
          setFeatures(features.filter(f => f.id !== id));
          break;
        case 'branding':
          setBranding(branding.filter(b => b.id !== id));
          break;
        case 'sop':
          setSOPs(sops.filter(s => s.id !== id));
          break;
        case 'integration':
          setIntegrations(integrations.filter(i => i.id !== id));
          break;
      }
    } catch (error) {
      console.error('Error deleting item:', error);
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

  const generateBlueprint = async () => {
    setSaving(true);
    try {
      const config = {
        name: `White Label Config ${new Date().toISOString()}`,
        features: Array.from(selectedItems.features),
        branding: Array.from(selectedItems.branding),
        sops: Array.from(selectedItems.sops),
        integrations: Array.from(selectedItems.integrations)
      };

      const { data } = await http.post('/white-label-planner/configurations', config);

      // Download the blueprint
      const blueprint = await http.get(`/white-label-planner/blueprint/${data.id}`);
      const blob = new Blob([JSON.stringify(blueprint.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `white-label-blueprint-${data.id}.json`;
      a.click();
    } catch (error) {
      console.error('Error generating blueprint:', error);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'scanner', label: 'Auto-Discovery', icon: Search },
    { id: 'features', label: 'Feature Inventory', icon: Package },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'sops', label: 'SOPs', icon: FileText },
    { id: 'integrations', label: 'Integrations', icon: Link },
    { id: 'configuration', label: 'Configuration', icon: Settings }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6 border border-[var(--border-primary)]">
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">White Label Planning Tool</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Complete inventory of ClubOS features, branding elements, SOPs, and integrations.
          Analyze platform capabilities for white-label transformation.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-2 rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Scanner Tab */}
      {activeTab === 'scanner' && (
        <ScannerTab />
      )}

      {/* Features Tab */}
      {activeTab === 'features' && (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
          {/* Summary Stats */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-[var(--text-secondary)]">Loading inventory...</div>
            </div>
          ) : (
          <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--border-primary)]">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{features.length}</div>
              <div className="text-xs text-[var(--text-secondary)]">Total Features</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-2xl font-bold text-green-900">{features.filter(f => f.is_transferable).length}</div>
              <div className="text-xs text-green-700">Transferable</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-900">{features.filter(f => !f.is_transferable).length}</div>
              <div className="text-xs text-yellow-700">Golf-Specific</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-2xl font-bold text-blue-900">{features.filter(f => f.category === 'Core').length}</div>
              <div className="text-xs text-blue-700">Core Features</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <div className="text-2xl font-bold text-purple-900">{features.filter(f => f.category === 'AI').length}</div>
              <div className="text-xs text-purple-700">AI Features</div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setFeatureFilter('all')}
              className={`px-4 py-2 rounded-lg ${featureFilter === 'all' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:opacity-80'}`}
            >
              All ({features.length})
            </button>
            <button
              onClick={() => setFeatureFilter('Core')}
              className={`px-4 py-2 rounded-lg ${featureFilter === 'Core' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:opacity-80'}`}
            >
              Core ({features.filter(f => f.category === 'Core').length})
            </button>
            <button
              onClick={() => setFeatureFilter('Golf-Specific')}
              className={`px-4 py-2 rounded-lg ${featureFilter === 'Golf-Specific' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:opacity-80'}`}
            >
              Golf-Specific ({features.filter(f => f.category === 'Golf-Specific').length})
            </button>
            <button
              onClick={() => setFeatureFilter('Customer')}
              className={`px-4 py-2 rounded-lg ${featureFilter === 'Customer' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:opacity-80'}`}
            >
              Customer ({features.filter(f => f.category === 'Customer').length})
            </button>
            <button
              onClick={() => setFeatureFilter('Operations')}
              className={`px-4 py-2 rounded-lg ${featureFilter === 'Operations' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:opacity-80'}`}
            >
              Operations ({features.filter(f => f.category === 'Operations').length})
            </button>
            <button
              onClick={() => setFeatureFilter('Analytics')}
              className={`px-4 py-2 rounded-lg ${featureFilter === 'Analytics' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:opacity-80'}`}
            >
              Analytics ({features.filter(f => f.category === 'Analytics').length})
            </button>
            <button
              onClick={() => setFeatureFilter('AI')}
              className={`px-4 py-2 rounded-lg ${featureFilter === 'AI' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:opacity-80'}`}
            >
              AI ({features.filter(f => f.category === 'AI').length})
            </button>
            <button
              onClick={() => setFeatureFilter('transferable')}
              className={`px-4 py-2 rounded-lg ${featureFilter === 'transferable' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
            >
              Transferable Only ({features.filter(f => f.is_transferable).length})
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Add Feature</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Feature Name"
                className="px-3 py-2 border rounded-lg"
                value={newFeature.name || ''}
                onChange={(e) => setNewFeature({...newFeature, name: e.target.value})}
              />
              <select
                className="px-3 py-2 border rounded-lg"
                value={newFeature.category || ''}
                onChange={(e) => setNewFeature({...newFeature, category: e.target.value})}
              >
                <option value="">Select Category</option>
                <option value="Core">Core</option>
                <option value="Golf-Specific">Golf-Specific</option>
                <option value="Customer">Customer</option>
                <option value="Operations">Operations</option>
                <option value="Analytics">Analytics</option>
                <option value="AI">AI</option>
              </select>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newFeature.is_transferable || false}
                  onChange={(e) => setNewFeature({...newFeature, is_transferable: e.target.checked})}
                />
                <span>Transferable</span>
              </label>
              <button
                onClick={addFeature}
                disabled={saving || !newFeature.name || !newFeature.category}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {features
              .filter(feature => {
                if (featureFilter === 'all') return true;
                if (featureFilter === 'transferable') return feature.is_transferable;
                return feature.category === featureFilter;
              })
              .map((feature) => (
              <div key={feature.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-[var(--bg-tertiary)]">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.features.has(feature.id)}
                    onChange={() => toggleSelection('features', feature.id)}
                  />
                  <div>
                    <div className="font-medium">{feature.name}</div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        feature.category === 'Core' ? 'bg-blue-100 text-blue-800' :
                        feature.category === 'Golf-Specific' ? 'bg-yellow-100 text-yellow-800' :
                        feature.category === 'Customer' ? 'bg-purple-100 text-purple-800' :
                        feature.category === 'Operations' ? 'bg-gray-100 text-gray-800' :
                        feature.category === 'AI' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {feature.category}
                      </span>
                      <span className="ml-2">
                        {feature.is_transferable ?
                          <span className="text-green-600">✓ Transferable</span> :
                          <span className="text-yellow-600">⚡ Golf-Specific</span>
                        }
                      </span>
                    </div>
                    {feature.notes && (
                      <div className="text-xs text-[var(--text-secondary)] mt-1">{feature.notes}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteItem('feature', feature.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      )}

      {/* Branding Tab */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          {/* Theme Color Configuration */}
          <SimpleThemeConfig />

          {/* Branding Elements */}
          <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--color-border)]">
                <div className="text-2xl font-bold text-[var(--text-primary)]">{branding.length}</div>
                <div className="text-xs text-[var(--text-secondary)]">Total Elements</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="text-2xl font-bold text-green-900">{branding.filter(b => b.is_customizable).length}</div>
                <div className="text-xs text-green-700">Customizable</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-2xl font-bold text-gray-900">{branding.filter(b => !b.is_customizable).length}</div>
                <div className="text-xs text-gray-600">Fixed</div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4">Add Branding Element</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Element Type"
                className="px-3 py-2 border rounded-lg"
                value={newBranding.element_type || ''}
                onChange={(e) => setNewBranding({...newBranding, element_type: e.target.value})}
              />
              <input
                type="text"
                placeholder="Current Value"
                className="px-3 py-2 border rounded-lg"
                value={newBranding.current_value || ''}
                onChange={(e) => setNewBranding({...newBranding, current_value: e.target.value})}
              />
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newBranding.is_customizable || false}
                  onChange={(e) => setNewBranding({...newBranding, is_customizable: e.target.checked})}
                />
                <span>Customizable</span>
              </label>
              <button
                onClick={addBranding}
                disabled={saving || !newBranding.element_type || !newBranding.current_value}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {branding.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-[var(--bg-tertiary)]">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.branding.has(item.id)}
                    onChange={() => toggleSelection('branding', item.id)}
                  />
                  <div>
                    <div className="font-medium">{item.element_type}</div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{item.current_value}</span>
                      <span className="ml-2">
                        {item.is_customizable ?
                          <span className="text-green-600">✓ Customizable</span> :
                          <span className="text-gray-500">• Fixed</span>
                        }
                      </span>
                    </div>
                    {item.notes && (
                      <div className="text-xs text-[var(--text-secondary)] mt-1">{item.notes}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteItem('branding', item.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}

      {/* SOPs Tab */}
      {activeTab === 'sops' && (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--color-border)]">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{sops.length}</div>
              <div className="text-xs text-[var(--text-secondary)]">Total SOPs</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-2xl font-bold text-green-900">{sops.filter(s => !s.is_industry_specific).length}</div>
              <div className="text-xs text-green-700">Generic</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-900">{sops.filter(s => s.is_industry_specific).length}</div>
              <div className="text-xs text-yellow-700">Golf-Specific</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-2xl font-bold text-blue-900">{new Set(sops.map(s => s.category)).size}</div>
              <div className="text-xs text-blue-700">Categories</div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setSopFilter('all')}
              className={`px-4 py-2 rounded-lg ${sopFilter === 'all' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:opacity-80'}`}
            >
              All ({sops.length})
            </button>
            <button
              onClick={() => setSopFilter('generic')}
              className={`px-4 py-2 rounded-lg ${sopFilter === 'generic' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
            >
              Generic ({sops.filter(s => !s.is_industry_specific).length})
            </button>
            <button
              onClick={() => setSopFilter('golf')}
              className={`px-4 py-2 rounded-lg ${sopFilter === 'golf' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}
            >
              Golf-Specific ({sops.filter(s => s.is_industry_specific).length})
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Add SOP</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="SOP Name"
                className="px-3 py-2 border rounded-lg"
                value={newSOP.name || ''}
                onChange={(e) => setNewSOP({...newSOP, name: e.target.value})}
              />
              <select
                className="px-3 py-2 border rounded-lg"
                value={newSOP.category || ''}
                onChange={(e) => setNewSOP({...newSOP, category: e.target.value})}
              >
                <option value="">Select Category</option>
                <option value="Customer Service">Customer Service</option>
                <option value="Technical">Technical</option>
                <option value="Operations">Operations</option>
                <option value="Safety">Safety</option>
              </select>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newSOP.is_industry_specific || false}
                  onChange={(e) => setNewSOP({...newSOP, is_industry_specific: e.target.checked})}
                />
                <span>Golf-Specific</span>
              </label>
              <button
                onClick={addSOP}
                disabled={saving || !newSOP.name || !newSOP.category}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {sops
              .filter(sop => {
                if (sopFilter === 'all') return true;
                if (sopFilter === 'generic') return !sop.is_industry_specific;
                if (sopFilter === 'golf') return sop.is_industry_specific;
                return true;
              })
              .map((sop) => (
              <div key={sop.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-[var(--bg-tertiary)]">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.sops.has(sop.id)}
                    onChange={() => toggleSelection('sops', sop.id)}
                  />
                  <div>
                    <div className="font-medium">{sop.name}</div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        sop.category === 'Operations' ? 'bg-blue-100 text-blue-800' :
                        sop.category === 'Customer Service' ? 'bg-purple-100 text-purple-800' :
                        sop.category === 'Technical' ? 'bg-indigo-100 text-indigo-800' :
                        sop.category === 'Safety' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {sop.category}
                      </span>
                      <span className="ml-2">
                        {sop.is_industry_specific ?
                          <span className="text-yellow-600">⚡ Golf-Specific</span> :
                          <span className="text-green-600">✓ Generic</span>
                        }
                      </span>
                    </div>
                    {sop.notes && (
                      <div className="text-xs text-[var(--text-secondary)] mt-1">{sop.notes}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteItem('sop', sop.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 border border-[var(--color-border)]">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{integrations.length}</div>
              <div className="text-xs text-[var(--text-secondary)]">Total Integrations</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
              <div className="text-2xl font-bold text-red-900">{integrations.filter(i => i.is_required).length}</div>
              <div className="text-xs text-red-700">Required</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-2xl font-bold text-green-900">{integrations.filter(i => !i.is_required).length}</div>
              <div className="text-xs text-green-700">Optional</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-2xl font-bold text-blue-900">{new Set(integrations.map(i => i.type)).size}</div>
              <div className="text-xs text-blue-700">Categories</div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setIntegrationFilter('all')}
              className={`px-4 py-2 rounded-lg ${integrationFilter === 'all' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:opacity-80'}`}
            >
              All ({integrations.length})
            </button>
            <button
              onClick={() => setIntegrationFilter('required')}
              className={`px-4 py-2 rounded-lg ${integrationFilter === 'required' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
            >
              Required ({integrations.filter(i => i.is_required).length})
            </button>
            <button
              onClick={() => setIntegrationFilter('optional')}
              className={`px-4 py-2 rounded-lg ${integrationFilter === 'optional' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
            >
              Optional ({integrations.filter(i => !i.is_required).length})
            </button>
            <button
              onClick={() => setIntegrationFilter('Golf-Specific')}
              className={`px-4 py-2 rounded-lg ${integrationFilter === 'Golf-Specific' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}
            >
              Golf-Specific ({integrations.filter(i => i.type === 'Golf-Specific').length})
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Add Integration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Integration Name"
                className="px-3 py-2 border rounded-lg"
                value={newIntegration.name || ''}
                onChange={(e) => setNewIntegration({...newIntegration, name: e.target.value})}
              />
              <select
                className="px-3 py-2 border rounded-lg"
                value={newIntegration.type || ''}
                onChange={(e) => setNewIntegration({...newIntegration, type: e.target.value})}
              >
                <option value="">Select Type</option>
                <option value="Communication">Communication</option>
                <option value="Payment">Payment</option>
                <option value="Analytics">Analytics</option>
                <option value="AI">AI</option>
                <option value="Database">Database</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Golf-Specific">Golf-Specific</option>
              </select>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newIntegration.is_required || false}
                  onChange={(e) => setNewIntegration({...newIntegration, is_required: e.target.checked})}
                />
                <span>Required</span>
              </label>
              <button
                onClick={addIntegration}
                disabled={saving || !newIntegration.name || !newIntegration.type}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {integrations
              .filter(integration => {
                if (integrationFilter === 'all') return true;
                if (integrationFilter === 'required') return integration.is_required;
                if (integrationFilter === 'optional') return !integration.is_required;
                if (integrationFilter === 'Golf-Specific') return integration.type === 'Golf-Specific';
                return true;
              })
              .map((integration) => (
              <div key={integration.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-[var(--bg-tertiary)]">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.integrations.has(integration.id)}
                    onChange={() => toggleSelection('integrations', integration.id)}
                  />
                  <div>
                    <div className="font-medium">{integration.name}</div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        integration.type === 'Communication' ? 'bg-blue-100 text-blue-800' :
                        integration.type === 'Payment' ? 'bg-green-100 text-green-800' :
                        integration.type === 'AI' ? 'bg-purple-100 text-purple-800' :
                        integration.type === 'Analytics' ? 'bg-indigo-100 text-indigo-800' :
                        integration.type === 'Database' ? 'bg-gray-100 text-gray-800' :
                        integration.type === 'Infrastructure' ? 'bg-orange-100 text-orange-800' :
                        integration.type === 'Golf-Specific' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {integration.type}
                      </span>
                      <span className="ml-2">
                        {integration.is_required ?
                          <span className="text-red-600 font-semibold">• Required</span> :
                          <span className="text-green-600">✓ Optional</span>
                        }
                      </span>
                    </div>
                    {integration.notes && (
                      <div className="text-xs text-[var(--text-secondary)] mt-1">{integration.notes}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteItem('integration', integration.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'configuration' && (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
          <h3 className="text-lg font-semibold mb-4">White Label Configuration Summary</h3>

          {/* Overall Summary */}
          <div className="bg-gradient-to-r from-[var(--accent)] to-green-600 text-white rounded-lg p-6 mb-6">
            <div className="text-2xl font-bold mb-2">Platform Readiness</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-3xl font-bold">{features.length}</div>
                <div className="text-sm opacity-90">Total Features</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{branding.length}</div>
                <div className="text-sm opacity-90">Branding Elements</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{sops.length}</div>
                <div className="text-sm opacity-90">SOPs Documented</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{integrations.length}</div>
                <div className="text-sm opacity-90">Integrations</div>
              </div>
            </div>
          </div>

          {/* Selection Summary */}
          <div className="mb-6">
            <h4 className="text-md font-semibold mb-3">Current Selection</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-2xl font-bold text-blue-900">{selectedItems.features.size}</div>
                <div className="text-xs text-blue-700">Features Selected</div>
                <div className="text-xs text-gray-600 mt-1">
                  {features.length > 0 ? Math.round((selectedItems.features.size / features.length) * 100) : 0}% of total
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="text-2xl font-bold text-purple-900">{selectedItems.branding.size}</div>
                <div className="text-xs text-purple-700">Branding Items</div>
                <div className="text-xs text-gray-600 mt-1">
                  {branding.length > 0 ? Math.round((selectedItems.branding.size / branding.length) * 100) : 0}% of total
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="text-2xl font-bold text-green-900">{selectedItems.sops.size}</div>
                <div className="text-xs text-green-700">SOPs Selected</div>
                <div className="text-xs text-gray-600 mt-1">
                  {sops.length > 0 ? Math.round((selectedItems.sops.size / sops.length) * 100) : 0}% of total
                </div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                <div className="text-2xl font-bold text-orange-900">{selectedItems.integrations.size}</div>
                <div className="text-xs text-orange-700">Integrations</div>
                <div className="text-xs text-gray-600 mt-1">
                  {integrations.length > 0 ? Math.round((selectedItems.integrations.size / integrations.length) * 100) : 0}% of total
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <h5 className="font-semibold mb-2">Transferability Analysis</h5>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Transferable Features:</span>
                  <span className="font-medium">{features.filter(f => f.is_transferable).length} of {features.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Customizable Branding:</span>
                  <span className="font-medium">{branding.filter(b => b.is_customizable).length} of {branding.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Generic SOPs:</span>
                  <span className="font-medium">{sops.filter(s => !s.is_industry_specific).length} of {sops.length}</span>
                </div>
              </div>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
              <h5 className="font-semibold mb-2">Platform Requirements</h5>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Required Integrations:</span>
                  <span className="font-medium">{integrations.filter(i => i.is_required).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Golf-Specific Features:</span>
                  <span className="font-medium">{features.filter(f => !f.is_transferable).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Industry SOPs:</span>
                  <span className="font-medium">{sops.filter(s => s.is_industry_specific).length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <button
              onClick={generateBlueprint}
              disabled={saving || (selectedItems.features.size === 0 && selectedItems.branding.size === 0)}
              className="w-full px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              <Download className="h-5 w-5 inline mr-2" />
              Generate Implementation Blueprint
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Scanner Tab Component
const ScannerTab: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [golfTerms, setGolfTerms] = useState<any[]>([]);
  const [scanResults, setScanResults] = useState<any>(null);
  const [selectedScanType, setSelectedScanType] = useState<'full' | 'golf_terms' | 'dependencies'>('full');

  useEffect(() => {
    fetchScanHistory();
  }, []);

  const fetchScanHistory = async () => {
    try {
      const { data } = await http.get('/white-label-scanner/scans');
      setScanHistory(data.scans || []);
    } catch (error) {
      console.error('Failed to fetch scan history:', error);
    }
  };

  const startScan = async () => {
    setScanning(true);
    try {
      await http.post('/white-label-scanner/scan', {
        scanType: selectedScanType
      });

      // Poll for results
      setTimeout(() => {
        fetchScanHistory();
        fetchGolfTerms();
        setScanning(false);
      }, 5000);
    } catch (error) {
      console.error('Failed to start scan:', error);
      setScanning(false);
    }
  };

  const fetchGolfTerms = async () => {
    try {
      const { data } = await http.get('/white-label-scanner/golf-terms');
      setGolfTerms(data.terms || []);
    } catch (error) {
      console.error('Failed to fetch golf terms:', error);
    }
  };

  const scanTypeOptions = [
    { value: 'full', label: 'Full System Scan', description: 'Complete analysis of all code and features' },
    { value: 'golf_terms', label: 'Golf Terms Only', description: 'Find golf-specific terminology' },
    { value: 'dependencies', label: 'Dependencies Only', description: 'Map feature dependencies and integrations' }
  ];

  return (
    <div className="space-y-6">
      {/* Scan Controls */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Auto-Discovery Scanner</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Automatically scan your codebase to identify golf-specific features, branding elements, and dependencies.
        </p>

        <div className="space-y-4">
          {/* Scan Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scanTypeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedScanType(option.value as any)}
                className={`p-4 rounded-lg border transition-all ${
                  selectedScanType === option.value
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-primary)] hover:border-[var(--accent)]'
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="text-xs mt-1 opacity-80">{option.description}</div>
              </button>
            ))}
          </div>

          {/* Start Scan Button */}
          <button
            onClick={startScan}
            disabled={scanning}
            className="w-full px-6 py-3 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 flex items-center justify-center"
          >
            {scanning ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="h-5 w-5 mr-2" />
                Start {selectedScanType === 'full' ? 'Full' : selectedScanType === 'golf_terms' ? 'Golf Terms' : 'Dependencies'} Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Recent Scans</h3>
          <div className="space-y-2">
            {scanHistory.map((scan) => (
              <div key={scan.id} className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <div>
                  <div className="font-medium text-[var(--text-primary)]">
                    {scan.scan_type === 'full' ? 'Full System Scan' :
                     scan.scan_type === 'golf_terms' ? 'Golf Terms Scan' :
                     'Dependencies Scan'}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {new Date(scan.created_at).toLocaleString()} •
                    {scan.total_files_scanned} files •
                    {scan.duration_ms}ms
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-[var(--accent)]">
                    {scan.golf_specific_found} golf-specific
                  </span>
                  <span className="text-sm text-[var(--text-secondary)]">
                    {scan.transferable_found} transferable
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Golf Terms Found */}
      {golfTerms.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Golf-Specific Terms Found ({golfTerms.length})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {golfTerms.slice(0, 20).map((term, index) => (
              <div key={index} className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-[var(--text-primary)]">
                      "{term.term}" → "{term.replacement_suggestion || 'needs replacement'}"
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      {term.file_path}:{term.line_number}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                      {term.context}
                    </div>
                  </div>
                  {term.is_critical && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                      Critical
                    </span>
                  )}
                </div>
              </div>
            ))}
            {golfTerms.length > 20 && (
              <div className="text-center text-sm text-[var(--text-secondary)] py-2">
                And {golfTerms.length - 20} more terms...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg p-4">
          <div className="text-2xl font-bold">{golfTerms.filter(t => t.is_critical).length}</div>
          <div className="text-sm opacity-90">Critical Terms</div>
        </div>
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg p-4">
          <div className="text-2xl font-bold">{golfTerms.filter(t => t.category === 'ui_label').length}</div>
          <div className="text-sm opacity-90">UI Labels</div>
        </div>
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4">
          <div className="text-2xl font-bold">{golfTerms.filter(t => t.category === 'variable_name').length}</div>
          <div className="text-sm opacity-90">Variable Names</div>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-4">
          <div className="text-2xl font-bold">
            {golfTerms.filter(t => t.replacement_suggestion).length}
          </div>
          <div className="text-sm opacity-90">Have Suggestions</div>
        </div>
      </div>
    </div>
  );
};