import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import { MessageSquare, Phone, Bell, Building2, Wifi, Shield, RefreshCw, Check, X, AlertCircle, TestTube, Zap, Monitor, Edit2, Power, Save } from 'lucide-react';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';



interface IntegrationConfig {
  service: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  config?: any;
}


export const OperationsIntegrations: React.FC = () => {

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
  
  // NinjaOne Management State
  const [ninjaoneScripts, setNinjaoneScripts] = useState<any[]>([]);
  const [ninjaoneDevices, setNinjaoneDevices] = useState<any[]>([]);
  const [editingScript, setEditingScript] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [showNinjaOneManagement, setShowNinjaOneManagement] = useState(false);
  
  const { user } = useAuthState();
  const token = user?.token || tokenManager.getToken();

  useEffect(() => {
    fetchConfigurations();
    if (showNinjaOneManagement) {
      fetchNinjaOneData();
    }
  }, [showNinjaOneManagement]);


  const fetchConfigurations = async () => {
    if (!token) return;
    
    try {
      // Fetch Slack config
      const slackResponse = await http.get(
        `integrations/slack/config`,

      );
      if (slackResponse.data.success) {
        setSlackConfig(prev => ({ ...prev, ...slackResponse.data.data }));
      }
      
      // Fetch OpenPhone config
      const openphoneResponse = await http.get(
        `integrations/openphone/config`,

      );
      if (openphoneResponse.data.success) {
        setOpenPhoneConfig(prev => ({ ...prev, ...openphoneResponse.data.data }));
      }
      
      // Check HubSpot connection status
      try {
        const hubspotResponse = await http.get(
          `system-status/hubspot`,

        );
        if (hubspotResponse.data) {
          setIntegrations(prev => prev.map(i => 
            i.service === 'HubSpot' 
              ? { ...i, status: hubspotResponse.data.connected ? 'connected' : 'disconnected' }
              : i
          ));
        }
      } catch (error) {
        logger.debug('HubSpot status check failed:', error);
      }
    } catch (error) {
      logger.error('Error fetching configurations:', error);
    }
  };

  const fetchNinjaOneData = async () => {
    if (!token) return;
    
    try {
      // Fetch scripts
      const scriptsResponse = await http.get('ninjaone/scripts');
      if (scriptsResponse.data.success) {
        setNinjaoneScripts(scriptsResponse.data.scripts);
      }
      
      // Fetch devices
      const devicesResponse = await http.get('ninjaone/devices');
      if (devicesResponse.data.success) {
        setNinjaoneDevices(devicesResponse.data.devices);
      }
    } catch (error) {
      logger.error('Failed to fetch NinjaOne data:', error);
    }
  };

  const handleSyncNinjaOne = async (type: 'scripts' | 'devices') => {
    setSyncing(true);
    try {
      const response = await http.post(`ninjaone/sync-${type}`);
      if (response.data.success) {
        toast.success(`${type === 'scripts' ? 'Scripts' : 'Devices'} synced successfully`);
        await fetchNinjaOneData();
      }
    } catch (error) {
      toast.error(`Failed to sync ${type}`);
      logger.error(`Failed to sync ${type}:`, error);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateScript = async () => {
    if (!editingScript) return;
    
    try {
      const response = await http.put(`ninjaone/scripts/${editingScript.id}`, {
        display_name: editingScript.display_name,
        category: editingScript.category,
        icon: editingScript.icon,
        warning_message: editingScript.warning_message,
        is_active: editingScript.is_active
      });
      
      if (response.data.success) {
        toast.success('Script updated successfully');
        setEditingScript(null);
        await fetchNinjaOneData();
      }
    } catch (error) {
      toast.error('Failed to update script');
      logger.error('Failed to update script:', error);
    }
  };


  const handleTestConnection = async (service: string) => {
    setTestingService(service);
    try {
      const response = await http.post(
        `integrations/${service.toLowerCase()}/test`,
        {},

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
      logger.error('Error testing connection:', error);
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

        }
      );
      toast.success('Slack configuration saved');
    } catch (error) {
      logger.error('Error saving Slack config:', error);
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

        }
      );
      toast.success('OpenPhone configuration saved');
    } catch (error) {
      logger.error('Error saving OpenPhone config:', error);
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

        }
      );
      toast.success('Push notification configuration saved');
    } catch (error) {
      logger.error('Error saving Push config:', error);
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
        setShowNinjaOneManagement(!showNinjaOneManagement);
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
            <div className="space-y-2">
              <span className="inline-block w-full text-center px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-lg font-medium">
                Coming Soon
              </span>
              <button
                onClick={() => handleConfigureService('HubSpot')}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Setup Info
              </button>
            </div>
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
            <div className="space-y-2">
              <button
                onClick={() => handleConfigureService('NinjaOne')}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {showNinjaOneManagement ? 'Hide Management' : 'Manage Scripts & Devices'}
              </button>
            </div>
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
            <div className="space-y-2">
              <button
                onClick={() => handleConfigureService('UniFi')}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Setup Info
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* NinjaOne Management Section */}
      {showNinjaOneManagement && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              <span>NinjaOne Script & Device Management</span>
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => handleSyncNinjaOne('scripts')}
                disabled={syncing}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span>Sync Scripts</span>
              </button>
              <button
                onClick={() => handleSyncNinjaOne('devices')}
                disabled={syncing}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span>Sync Devices</span>
              </button>
            </div>
          </div>

          {/* Scripts Table */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Available Scripts</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Script</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Icon</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ninjaoneScripts.map((script) => (
                    <tr key={script.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                        {editingScript?.id === script.id ? (
                          <input
                            type="text"
                            value={editingScript.display_name || editingScript.name}
                            onChange={(e) => setEditingScript({...editingScript, display_name: e.target.value})}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          script.display_name || script.name
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                        {editingScript?.id === script.id ? (
                          <select
                            value={editingScript.category}
                            onChange={(e) => setEditingScript({...editingScript, category: e.target.value})}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="trackman">TrackMan</option>
                            <option value="system">System</option>
                            <option value="music">Music</option>
                            <option value="tv">TV</option>
                            <option value="other">Other</option>
                          </select>
                        ) : (
                          script.category
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                        {editingScript?.id === script.id ? (
                          <input
                            type="text"
                            value={editingScript.icon}
                            onChange={(e) => setEditingScript({...editingScript, icon: e.target.value})}
                            className="px-2 py-1 border border-gray-300 rounded text-sm w-20"
                            placeholder="Icon name"
                          />
                        ) : (
                          <Zap className="h-4 w-4 text-gray-500" />
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {editingScript?.id === script.id ? (
                          <button
                            onClick={() => setEditingScript({...editingScript, is_active: !editingScript.is_active})}
                            className={`px-2 py-1 text-xs rounded ${editingScript.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
                          >
                            {editingScript.is_active ? 'Active' : 'Inactive'}
                          </button>
                        ) : (
                          <span className={`px-2 py-1 text-xs rounded ${script.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {script.is_active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        {editingScript?.id === script.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={handleUpdateScript}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingScript(null)}
                              className="text-gray-600 hover:text-gray-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingScript(script)}
                            className="text-indigo-600 hover:text-indigo-700"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {ninjaoneScripts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                        No scripts found. Click "Sync Scripts" to fetch from NinjaOne.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Devices Table */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Registered Devices</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bay</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ninjaoneDevices.map((device) => (
                    <tr key={device.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{device.location}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{device.bay_number || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{device.device_name}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                        <span className="flex items-center space-x-1">
                          {device.device_type === 'trackman' && <Monitor className="h-4 w-4" />}
                          {device.device_type === 'music' && <span>🎵</span>}
                          {device.device_type === 'tv' && <span>📺</span>}
                          <span>{device.device_type}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded ${device.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {device.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {ninjaoneDevices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                        No devices found. Click "Sync Devices" to fetch from NinjaOne.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};