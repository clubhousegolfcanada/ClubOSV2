import React, { useState, useEffect } from 'react';
import { Package, Palette, FileText, Link, Settings, Plus, Save, Download, Trash2, Check, X } from 'lucide-react';
import http from '@/api/http';
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
  const [activeTab, setActiveTab] = useState<'features' | 'branding' | 'sops' | 'integrations' | 'configuration'>('features');
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
      const { data } = await http.get('/api/white-label-planner/inventory');
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
      const { data } = await http.post('/api/white-label-planner/inventory/feature', newFeature);
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
      const { data } = await http.post('/api/white-label-planner/inventory/branding', newBranding);
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
      const { data } = await http.post('/api/white-label-planner/inventory/sop', newSOP);
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
      const { data } = await http.post('/api/white-label-planner/inventory/integration', newIntegration);
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
      await http.delete(`/api/white-label-planner/inventory/${type}/${id}`);
      
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
      
      const { data } = await http.post('/api/white-label-planner/configurations', config);
      
      // Download the blueprint
      const blueprint = await http.get(`/api/white-label-planner/blueprint/${data.id}`);
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
    { id: 'features', label: 'Feature Inventory', icon: Package },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'sops', label: 'SOPs', icon: FileText },
    { id: 'integrations', label: 'Integrations', icon: Link },
    { id: 'configuration', label: 'Configuration', icon: Settings }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">White Label Planning Tool</h2>
        <p className="text-sm text-gray-600">
          Document and plan the transformation of ClubOS into a white-label platform. 
          Manually analyze features, branding, SOPs, and integrations to create implementation blueprints.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-2 rounded-md transition-colors ${
              activeTab === tab.id 
                ? 'bg-primary text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Features Tab */}
      {activeTab === 'features' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {features.map((feature) => (
              <div key={feature.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.features.has(feature.id)}
                    onChange={() => toggleSelection('features', feature.id)}
                  />
                  <div>
                    <div className="font-medium">{feature.name}</div>
                    <div className="text-sm text-gray-600">
                      {feature.category} • {feature.is_transferable ? 'Transferable' : 'Golf-Specific'}
                    </div>
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
        </div>
      )}

      {/* Branding Tab */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          {/* Theme Color Configuration */}
          <SimpleThemeConfig />
          
          {/* Branding Elements */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {branding.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.branding.has(item.id)}
                    onChange={() => toggleSelection('branding', item.id)}
                  />
                  <div>
                    <div className="font-medium">{item.element_type}</div>
                    <div className="text-sm text-gray-600">
                      {item.current_value} • {item.is_customizable ? 'Customizable' : 'Fixed'}
                    </div>
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {sops.map((sop) => (
              <div key={sop.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.sops.has(sop.id)}
                    onChange={() => toggleSelection('sops', sop.id)}
                  />
                  <div>
                    <div className="font-medium">{sop.name}</div>
                    <div className="text-sm text-gray-600">
                      {sop.category} • {sop.is_industry_specific ? 'Golf-Specific' : 'Generic'}
                    </div>
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
              >
                <Plus className="h-4 w-4 inline mr-1" />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {integrations.map((integration) => (
              <div key={integration.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.integrations.has(integration.id)}
                    onChange={() => toggleSelection('integrations', integration.id)}
                  />
                  <div>
                    <div className="font-medium">{integration.name}</div>
                    <div className="text-sm text-gray-600">
                      {integration.type} • {integration.is_required ? 'Required' : 'Optional'}
                    </div>
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">White Label Configuration</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{selectedItems.features.size}</div>
              <div className="text-xs text-gray-600">Features Selected</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{selectedItems.branding.size}</div>
              <div className="text-xs text-gray-600">Branding Items</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{selectedItems.sops.size}</div>
              <div className="text-xs text-gray-600">SOPs Selected</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{selectedItems.integrations.size}</div>
              <div className="text-xs text-gray-600">Integrations</div>
            </div>
          </div>

          <div className="border-t pt-6">
            <button
              onClick={generateBlueprint}
              disabled={saving || (selectedItems.features.size === 0 && selectedItems.branding.size === 0)}
              className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
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