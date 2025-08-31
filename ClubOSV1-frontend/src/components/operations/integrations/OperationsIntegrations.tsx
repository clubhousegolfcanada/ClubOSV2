import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import { MessageSquare, Phone, Bell, Building2, Wifi, Shield, CheckSquare, Calendar, Users, ShoppingBag, Settings, RefreshCw, Check, X, AlertCircle, ExternalLink, Key, TestTube, Zap, Brain, Sparkles } from 'lucide-react';
import { KnowledgeRouterPanel } from '@/components/admin/KnowledgeRouterPanel';
import { AIFeatureCard } from '@/components/AIFeatureCard';


interface SystemFeature {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: React.ReactNode;
}

interface IntegrationConfig {
  service: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  config?: any;
}

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

export const OperationsIntegrations: React.FC = () => {
  const [systemFeatures, setSystemFeatures] = useState<SystemFeature[]>([
    {
      key: 'smart_assist',
      name: 'Smart Assist',
      description: 'AI-powered request routing and responses',
      enabled: true,
      icon: <Zap className="h-5 w-5" />
    },
    {
      key: 'bookings',
      name: 'Bookings',
      description: 'Skedda booking system integration',
      enabled: true,
      icon: <Calendar className="h-5 w-5" />
    },
    {
      key: 'tickets',
      name: 'Tickets',
      description: 'Support ticket management system',
      enabled: true,
      icon: <CheckSquare className="h-5 w-5" />
    },
    {
      key: 'customer_kiosk',
      name: 'Customer Kiosk',
      description: 'ClubOS Boy public interface',
      enabled: true,
      icon: <Users className="h-5 w-5" />
    }
  ]);

  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([
    {
      service: 'Slack',
      status: 'connected',
      lastSync: new Date().toISOString()
    },
    {
      service: 'OpenPhone',
      status: 'connected',
      lastSync: new Date().toISOString()
    },
    {
      service: 'Push Notifications',
      status: 'connected',
      lastSync: new Date().toISOString()
    },
    {
      service: 'HubSpot',
      status: 'disconnected'
    },
    {
      service: 'NinjaOne',
      status: 'connected',
      lastSync: new Date().toISOString()
    },
    {
      service: 'UniFi Access',
      status: 'connected',
      lastSync: new Date().toISOString()
    }
  ]);

  const [slackConfig, setSlackConfig] = useState({
    webhook_url: '',
    notifications_enabled: true,
    notify_on_error: true,
    notify_on_ticket: true,
    sendOnLLMSuccess: false,
    sendOnLLMFailure: true,
    sendDirectRequests: false,
    sendUnhelpfulFeedback: true
  });

  const [openPhoneConfig, setOpenPhoneConfig] = useState({
    api_key: '',
    webhook_secret: '',
    default_number: '',
    enabled: true
  });

  const [pushConfig, setPushConfig] = useState({
    vapid_public_key: '',
    enabled: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00'
  });

  const [loading, setLoading] = useState(false);
  const [testingService, setTestingService] = useState<string | null>(null);
  const [aiFeatures, setAIFeatures] = useState<AIFeature[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    services: true,
    ai: false,
    knowledge: false
  });
  
  const { user } = useAuthState();
  const token = user?.token || localStorage.getItem('clubos_token');

  useEffect(() => {
    fetchConfigurations();
    fetchAIFeatures();
  }, []);

  const fetchAIFeatures = async () => {
    if (!token) return;
    
    try {
      const response = await http.get(`ai-automations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Ensure we're getting an array
      const features = Array.isArray(response.data) ? response.data : 
                      (response.data?.features || response.data?.data || []);
      setAIFeatures(features);
    } catch (error: any) {
      console.error('Error fetching AI features:', error);
      setAIFeatures([]);
    }
  };

  const handleToggleAIFeature = async (featureKey: string, enabled: boolean) => {
    try {
      await http.post(
        `ai-automations/${featureKey}/toggle`,
        { enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Feature ${enabled ? 'enabled' : 'disabled'}`);
      fetchAIFeatures();
    } catch (error) {
      console.error('Error toggling AI feature:', error);
      toast.error('Failed to toggle feature');
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const fetchConfigurations = async () => {
    if (!token) return;
    
    try {
      // Fetch Slack config
      const slackResponse = await http.get(
        `integrations/slack/config`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (slackResponse.data.success) {
        setSlackConfig(prev => ({ ...prev, ...slackResponse.data.data }));
      }
      
      // Fetch OpenPhone config
      const openphoneResponse = await http.get(
        `integrations/openphone/config`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (openphoneResponse.data.success) {
        setOpenPhoneConfig(prev => ({ ...prev, ...openphoneResponse.data.data }));
      }
      
      // Fetch system features
      const featuresResponse = await http.get(
        `integrations/features`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (featuresResponse.data.success) {
        // Ensure we're getting an array
        const features = Array.isArray(featuresResponse.data.data) ? 
          featuresResponse.data.data : systemFeatures;
        setSystemFeatures(features);
      }
      
      // Check HubSpot connection status
      try {
        const hubspotResponse = await http.get(
          `system-status/hubspot`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (hubspotResponse.data) {
          setIntegrations(prev => prev.map(i => 
            i.service === 'HubSpot' 
              ? { ...i, status: hubspotResponse.data.connected ? 'connected' : 'disconnected' }
              : i
          ));
        }
      } catch (error) {
        console.log('HubSpot status check failed:', error);
      }
    } catch (error) {
      console.error('Error fetching configurations:', error);
    }
  };

  const handleToggleFeature = async (featureKey: string) => {
    const feature = systemFeatures.find(f => f.key === featureKey);
    if (!feature) return;

    try {
      await http.put(
        `integrations/features/${featureKey}`,
        { enabled: !feature.enabled },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setSystemFeatures(prev => prev.map(f => 
        f.key === featureKey ? { ...f, enabled: !f.enabled } : f
      ));
      
      toast.success(`${feature.name} ${!feature.enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling feature:', error);
      toast.error('Failed to toggle feature');
    }
  };

  const handleTestConnection = async (service: string) => {
    setTestingService(service);
    try {
      const response = await http.post(
        `integrations/${service.toLowerCase()}/test`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success(response.data.message || `${service} connection successful`);
        setIntegrations(prev => prev.map(i => 
          i.service === service ? { ...i, status: 'connected', lastSync: new Date().toISOString() } : i
        ));
      } else {
        toast.error(response.data.message || `${service} connection failed`);
        setIntegrations(prev => prev.map(i => 
          i.service === service ? { ...i, status: 'error' } : i
        ));
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error(`Failed to test ${service} connection`);
      setIntegrations(prev => prev.map(i => 
        i.service === service ? { ...i, status: 'error' } : i
      ));
    } finally {
      setTestingService(null);
    }
  };

  const handleSaveSlackConfig = async () => {
    setLoading(true);
    try {
      await http.put(
        `integrations/slack/config`,
        slackConfig,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Slack configuration saved');
    } catch (error) {
      console.error('Error saving Slack config:', error);
      toast.error('Failed to save Slack configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOpenPhoneConfig = async () => {
    setLoading(true);
    try {
      await http.put(
        `integrations/openphone/config`,
        openPhoneConfig,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('OpenPhone configuration saved');
    } catch (error) {
      console.error('Error saving OpenPhone config:', error);
      toast.error('Failed to save OpenPhone configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePushConfig = async () => {
    setLoading(true);
    try {
      await http.put(
        `integrations/push/config`,
        pushConfig,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success('Push notification configuration saved');
    } catch (error) {
      console.error('Error saving Push config:', error);
      toast.error('Failed to save push notification configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureService = (service: string) => {
    // Show information about how to configure each service
    switch(service) {
      case 'HubSpot':
        toast('HubSpot configuration: Add HUBSPOT_API_KEY to Railway environment variables', {
          icon: 'ℹ️',
          duration: 4000
        });
        break;
      case 'NinjaOne':
        toast('NinjaOne configuration: Add NINJAONE_CLIENT_ID and NINJAONE_CLIENT_SECRET to Railway', {
          icon: 'ℹ️',
          duration: 4000
        });
        break;
      case 'UniFi':
        toast('UniFi configuration: Add DARTMOUTH_ACCESS_TOKEN and BEDFORD_ACCESS_TOKEN to Railway', {
          icon: 'ℹ️',
          duration: 4000
        });
        break;
      default:
        toast(`${service} configuration coming soon`, {
          icon: 'ℹ️',
          duration: 3000
        });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'disconnected':
        return 'text-gray-600 bg-gray-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Check className="h-4 w-4" />;
      case 'disconnected':
        return <X className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Communication Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">Communication</h2>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Slack Card */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Slack</h3>
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(integrations.find(i => i.service === 'Slack')?.status || 'disconnected')}`}>
                    {getStatusIcon(integrations.find(i => i.service === 'Slack')?.status || 'disconnected')}
                    <span>{integrations.find(i => i.service === 'Slack')?.status || 'disconnected'}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleTestConnection('Slack')}
                disabled={testingService === 'Slack'}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {testingService === 'Slack' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                <input
                  type="text"
                  value={slackConfig.webhook_url}
                  onChange={(e) => setSlackConfig(prev => ({ ...prev, webhook_url: e.target.value }))}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Notifications</span>
                <button
                  onClick={() => setSlackConfig(prev => ({ ...prev, notifications_enabled: !prev.notifications_enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    slackConfig.notifications_enabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    slackConfig.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Error Alerts</span>
                <button
                  onClick={() => setSlackConfig(prev => ({ ...prev, notify_on_error: !prev.notify_on_error }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    slackConfig.notify_on_error ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    slackConfig.notify_on_error ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Ticket Notifications</span>
                <button
                  onClick={() => setSlackConfig(prev => ({ ...prev, notify_on_ticket: !prev.notify_on_ticket }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    slackConfig.notify_on_ticket ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    slackConfig.notify_on_ticket ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">LLM Success</span>
                <button
                  onClick={() => setSlackConfig(prev => ({ ...prev, sendOnLLMSuccess: !prev.sendOnLLMSuccess }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    slackConfig.sendOnLLMSuccess ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    slackConfig.sendOnLLMSuccess ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">LLM Failure</span>
                <button
                  onClick={() => setSlackConfig(prev => ({ ...prev, sendOnLLMFailure: !prev.sendOnLLMFailure }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    slackConfig.sendOnLLMFailure ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    slackConfig.sendOnLLMFailure ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Direct Requests</span>
                <button
                  onClick={() => setSlackConfig(prev => ({ ...prev, sendDirectRequests: !prev.sendDirectRequests }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    slackConfig.sendDirectRequests ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    slackConfig.sendDirectRequests ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Unhelpful Feedback</span>
                <button
                  onClick={() => setSlackConfig(prev => ({ ...prev, sendUnhelpfulFeedback: !prev.sendUnhelpfulFeedback }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    slackConfig.sendUnhelpfulFeedback ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    slackConfig.sendUnhelpfulFeedback ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              <button
                onClick={handleSaveSlackConfig}
                disabled={loading}
                className="w-full mt-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>

          {/* OpenPhone Card */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">OpenPhone</h3>
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(integrations.find(i => i.service === 'OpenPhone')?.status || 'disconnected')}`}>
                    {getStatusIcon(integrations.find(i => i.service === 'OpenPhone')?.status || 'disconnected')}
                    <span>{integrations.find(i => i.service === 'OpenPhone')?.status || 'disconnected'}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleTestConnection('OpenPhone')}
                disabled={testingService === 'OpenPhone'}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {testingService === 'OpenPhone' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={openPhoneConfig.api_key}
                  onChange={(e) => setOpenPhoneConfig(prev => ({ ...prev, api_key: e.target.value }))}
                  placeholder="Enter OpenPhone API key"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Number</label>
                <input
                  type="text"
                  value={openPhoneConfig.default_number}
                  onChange={(e) => setOpenPhoneConfig(prev => ({ ...prev, default_number: e.target.value }))}
                  placeholder="+1234567890"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Two-way SMS</span>
                <button
                  onClick={() => setOpenPhoneConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    openPhoneConfig.enabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    openPhoneConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              {integrations.find(i => i.service === 'OpenPhone')?.lastSync && (
                <div className="text-xs text-gray-500">
                  Last sync: {new Date(integrations.find(i => i.service === 'OpenPhone')!.lastSync!).toLocaleTimeString()}
                </div>
              )}
              
              <button
                onClick={handleSaveOpenPhoneConfig}
                disabled={loading}
                className="w-full mt-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                Save Configuration
              </button>
            </div>
          </div>

          {/* Push Notifications Card */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Bell className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Push Notifications</h3>
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(integrations.find(i => i.service === 'Push Notifications')?.status || 'disconnected')}`}>
                    {getStatusIcon(integrations.find(i => i.service === 'Push Notifications')?.status || 'disconnected')}
                    <span>{integrations.find(i => i.service === 'Push Notifications')?.status || 'disconnected'}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleTestConnection('Push Notifications')}
                disabled={testingService === 'Push Notifications'}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {testingService === 'Push Notifications' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Enabled</span>
                <button
                  onClick={() => setPushConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    pushConfig.enabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    pushConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              <div className="text-xs text-gray-500">
                Quiet hours: {pushConfig.quiet_hours_start} - {pushConfig.quiet_hours_end}
              </div>

              <button
                onClick={handleSavePushConfig}
                disabled={loading}
                className="mt-3 w-full px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CRM & Support Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">CRM & Support</h2>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* HubSpot Card */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">HubSpot</h3>
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(integrations.find(i => i.service === 'HubSpot')?.status || 'disconnected')}`}>
                    {getStatusIcon(integrations.find(i => i.service === 'HubSpot')?.status || 'disconnected')}
                    <span>{integrations.find(i => i.service === 'HubSpot')?.status || 'disconnected'}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleTestConnection('HubSpot')}
                disabled={testingService === 'HubSpot'}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {testingService === 'HubSpot' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">Customer data synchronization</p>
            <button
              onClick={() => handleConfigureService('HubSpot')}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Configure
            </button>
          </div>

          {/* NinjaOne Card */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Shield className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">NinjaOne</h3>
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(integrations.find(i => i.service === 'NinjaOne')?.status || 'disconnected')}`}>
                    {getStatusIcon(integrations.find(i => i.service === 'NinjaOne')?.status || 'disconnected')}
                    <span>{integrations.find(i => i.service === 'NinjaOne')?.status || 'disconnected'}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleTestConnection('NinjaOne')}
                disabled={testingService === 'NinjaOne'}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {testingService === 'NinjaOne' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">Remote device management</p>
            <button
              onClick={() => handleConfigureService('NinjaOne')}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Configure
            </button>
          </div>

          {/* UniFi Access Card */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <Wifi className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">UniFi Access</h3>
                  <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(integrations.find(i => i.service === 'UniFi Access')?.status || 'disconnected')}`}>
                    {getStatusIcon(integrations.find(i => i.service === 'UniFi Access')?.status || 'disconnected')}
                    <span>{integrations.find(i => i.service === 'UniFi Access')?.status || 'disconnected'}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleTestConnection('UniFi Access')}
                disabled={testingService === 'UniFi Access'}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {testingService === 'UniFi Access' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">Door access control</p>
            <button
              onClick={() => handleConfigureService('UniFi')}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* System Features Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">System Features</h2>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systemFeatures.map((feature) => (
              <div key={feature.key} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                    {feature.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{feature.name}</h4>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleFeature(feature.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    feature.enabled ? 'bg-primary' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    feature.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* API Keys Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">API Key Management</h2>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-900">Security Notice</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    API keys are encrypted and stored securely. Never share your API keys or commit them to version control.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">OpenAI API Key</span>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Configured</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">GPT-4 and assistant services</p>
              </button>
              
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">Slack Webhook</span>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Configured</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">Team notifications</p>
              </button>
              
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">OpenPhone</span>
                  <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">Configured</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">SMS messaging service</p>
              </button>
              
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">HubSpot</span>
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">Not configured</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">CRM integration</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Automations Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div 
          className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('ai')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">AI Automations</h2>
              <span className="text-sm text-gray-500">
                ({aiFeatures.filter(f => f.enabled).length}/{aiFeatures.length} active)
              </span>
            </div>
            {expandedSections.ai ? 
              <Settings className="h-5 w-5 text-gray-500 animate-spin-slow" /> : 
              <Settings className="h-5 w-5 text-gray-500" />
            }
          </div>
        </div>
        
        {expandedSections.ai && (
          <div className="p-6">
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
            {aiFeatures.length === 0 && (
              <p className="text-gray-500 text-center py-8">No AI features configured</p>
            )}
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
            </div>
            {expandedSections.knowledge ? 
              <Settings className="h-5 w-5 text-gray-500 animate-spin-slow" /> : 
              <Settings className="h-5 w-5 text-gray-500" />
            }
          </div>
        </div>
        
        {expandedSections.knowledge && (
          <div className="p-6">
            <KnowledgeRouterPanel />
          </div>
        )}
      </div>
    </div>
  );
};