import React, { useState, useEffect } from 'react';
import { 
  Settings, Shield, Clock, Brain, AlertTriangle, 
  BarChart, Zap, Info, Save, RotateCcw 
} from 'lucide-react';
import apiClient from '@/api/http';
import logger from '@/services/logger';

interface SystemSettings {
  // Confidence Controls
  autoExecuteThreshold: number;  // 0.85 default
  suggestOnlyThreshold: number;  // 0.60 default
  
  // Response Timing
  enableHumanDelay: boolean;
  minDelaySeconds: number;  // 3
  maxDelaySeconds: number;  // 8
  showTypingIndicator: boolean;
  
  // Business Context
  businessHoursMode: boolean;
  includeLocationContext: boolean;
  rememberPreviousMessages: boolean;
  
  // Safety Controls
  blacklistTopics: string[];
  escalationKeywords: string[];
  requireApprovalForNew: boolean;
  approvalThreshold: number;  // First N uses
  
  // Learning Settings
  minExamplesRequired: number;  // 5
  operatorOverrideWeight: number;  // 2.0x
  enableSeasonalAdjustments: boolean;
  
  // Enhancement Options
  autoIncludeLinks: boolean;
  addContactOptions: boolean;
  enableFollowUpQuestions: boolean;
}

export const PatternsSystemControls: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    autoExecuteThreshold: 0.85,
    suggestOnlyThreshold: 0.60,
    enableHumanDelay: true,
    minDelaySeconds: 3,
    maxDelaySeconds: 8,
    showTypingIndicator: true,
    businessHoursMode: true,
    includeLocationContext: true,
    rememberPreviousMessages: false,
    blacklistTopics: ['medical', 'legal', 'refund', 'complaint', 'injury'],
    escalationKeywords: ['angry', 'lawyer', 'sue', 'emergency', 'urgent'],
    requireApprovalForNew: true,
    approvalThreshold: 10,
    minExamplesRequired: 5,
    operatorOverrideWeight: 2.0,
    enableSeasonalAdjustments: false,
    autoIncludeLinks: true,
    addContactOptions: true,
    enableFollowUpQuestions: false
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // TODO: Replace with actual API call
      // const response = await apiClient.get('/patterns/system-settings');
      // setSettings(response.data);
    } catch (error) {
      logger.error('Failed to fetch system settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // TODO: Save to backend
      // await apiClient.put('/patterns/system-settings', settings);
      setHasChanges(false);
      logger.info('System settings saved');
    } catch (error) {
      logger.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({
      autoExecuteThreshold: 0.85,
      suggestOnlyThreshold: 0.60,
      enableHumanDelay: true,
      minDelaySeconds: 3,
      maxDelaySeconds: 8,
      showTypingIndicator: true,
      businessHoursMode: true,
      includeLocationContext: true,
      rememberPreviousMessages: false,
      blacklistTopics: ['medical', 'legal', 'refund', 'complaint', 'injury'],
      escalationKeywords: ['angry', 'lawyer', 'sue', 'emergency', 'urgent'],
      requireApprovalForNew: true,
      approvalThreshold: 10,
      minExamplesRequired: 5,
      operatorOverrideWeight: 2.0,
      enableSeasonalAdjustments: false,
      autoIncludeLinks: true,
      addContactOptions: true,
      enableFollowUpQuestions: false
    });
    setHasChanges(true);
  };

  const updateSetting = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">System Controls</h2>
              <p className="text-sm text-gray-600">Configure how the pattern learning system operates</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                hasChanges 
                  ? 'bg-primary text-white hover:opacity-90' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Safety Controls - Top Priority */}
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">Safety Controls</h3>
          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Critical</span>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Require Approval for New Patterns</span>
                <p className="text-xs text-gray-500">First {settings.approvalThreshold} uses need operator approval</p>
              </div>
              <input
                type="checkbox"
                checked={settings.requireApprovalForNew}
                onChange={(e) => updateSetting('requireApprovalForNew', e.target.checked)}
                className="h-5 w-5 text-primary rounded"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Blacklisted Topics (Never Auto-Respond)
            </label>
            <div className="flex flex-wrap gap-2">
              {settings.blacklistTopics.map((topic, idx) => (
                <span key={idx} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm">
                  {topic}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Escalation Keywords (Alert Operator)
            </label>
            <div className="flex flex-wrap gap-2">
              {settings.escalationKeywords.map((keyword, idx) => (
                <span key={idx} className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-sm">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confidence Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900">Confidence Controls</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auto-Execute Threshold: {Math.round(settings.autoExecuteThreshold * 100)}%
            </label>
            <input
              type="range"
              min="70"
              max="100"
              value={settings.autoExecuteThreshold * 100}
              onChange={(e) => updateSetting('autoExecuteThreshold', parseInt(e.target.value) / 100)}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Only auto-send responses above this confidence</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Suggest-Only Threshold: {Math.round(settings.suggestOnlyThreshold * 100)}%
            </label>
            <input
              type="range"
              min="40"
              max="80"
              value={settings.suggestOnlyThreshold * 100}
              onChange={(e) => updateSetting('suggestOnlyThreshold', parseInt(e.target.value) / 100)}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Show suggestions to operator between this and auto-execute threshold</p>
          </div>
        </div>
      </div>

      {/* Response Timing */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900">Response Timing</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Enable Human-like Delay</span>
                <p className="text-xs text-gray-500">Wait {settings.minDelaySeconds}-{settings.maxDelaySeconds} seconds before responding</p>
              </div>
              <input
                type="checkbox"
                checked={settings.enableHumanDelay}
                onChange={(e) => updateSetting('enableHumanDelay', e.target.checked)}
                className="h-5 w-5 text-primary rounded"
              />
            </label>
          </div>

          <div>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Show Typing Indicator</span>
                <p className="text-xs text-gray-500">Display "typing..." during delay</p>
              </div>
              <input
                type="checkbox"
                checked={settings.showTypingIndicator}
                onChange={(e) => updateSetting('showTypingIndicator', e.target.checked)}
                className="h-5 w-5 text-primary rounded"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Business Context */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900">Context & Enhancement</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Business Hours Mode</span>
                <p className="text-xs text-gray-500">Different responses for after-hours</p>
              </div>
              <input
                type="checkbox"
                checked={settings.businessHoursMode}
                onChange={(e) => updateSetting('businessHoursMode', e.target.checked)}
                className="h-5 w-5 text-primary rounded"
              />
            </label>
          </div>

          <div>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Include Location Context</span>
                <p className="text-xs text-gray-500">Mention which location in responses</p>
              </div>
              <input
                type="checkbox"
                checked={settings.includeLocationContext}
                onChange={(e) => updateSetting('includeLocationContext', e.target.checked)}
                className="h-5 w-5 text-primary rounded"
              />
            </label>
          </div>

          <div>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Auto-Include Helpful Links</span>
                <p className="text-xs text-gray-500">Add booking link, hours page, etc.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoIncludeLinks}
                onChange={(e) => updateSetting('autoIncludeLinks', e.target.checked)}
                className="h-5 w-5 text-primary rounded"
              />
            </label>
          </div>

          <div>
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">Add Contact Options</span>
                <p className="text-xs text-gray-500">Include "Or call us at..." for urgent issues</p>
              </div>
              <input
                type="checkbox"
                checked={settings.addContactOptions}
                onChange={(e) => updateSetting('addContactOptions', e.target.checked)}
                className="h-5 w-5 text-primary rounded"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Learning Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900">Learning Settings</h3>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Examples Required: {settings.minExamplesRequired}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.minExamplesRequired}
              onChange={(e) => updateSetting('minExamplesRequired', parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Similar Q&As needed before creating pattern</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Operator Override Weight: {settings.operatorOverrideWeight}x
            </label>
            <input
              type="range"
              min="10"
              max="30"
              value={settings.operatorOverrideWeight * 10}
              onChange={(e) => updateSetting('operatorOverrideWeight', parseInt(e.target.value) / 10)}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">How much to weight operator corrections</p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Impact of Settings</p>
            <p className="text-sm text-blue-700 mt-1">
              With current settings, approximately 80% of messages will be auto-handled, 
              saving operators an estimated 2-3 hours per day. Higher confidence thresholds 
              mean fewer mistakes but more manual work.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};