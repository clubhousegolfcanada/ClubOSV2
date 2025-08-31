import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Remove /api from the end if it exists
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
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

interface AIFeatureCardProps {
  feature: AIFeature;
  onToggle: (featureKey: string, enabled: boolean) => void;
  onUpdate: () => void;
}

export const AIFeatureCard: React.FC<AIFeatureCardProps> = ({ feature, onToggle, onUpdate }) => {
  const isLLMInitial = feature.feature_key === 'llm_initial_analysis';
  const [isExpanded, setIsExpanded] = useState(false);
  const [responseSource, setResponseSource] = useState(feature.config?.responseSource || 'database');
  const [hardcodedResponse, setHardcodedResponse] = useState(feature.config?.hardcodedResponse || '');
  const [maxResponses, setMaxResponses] = useState(feature.config?.maxResponses || 2);
  const [allowFollowUp, setAllowFollowUp] = useState(feature.allow_follow_up !== false);
  const [isSaving, setIsSaving] = useState(false);
  
  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('clubos_token');
      const updatedConfig = {
        ...feature.config,
        responseSource,
        hardcodedResponse,
        maxResponses
      };
      
      await axios.put(`${API_URL}/ai-automations/${feature.feature_key}/config`, {
        config: updatedConfig,
        allow_follow_up: allowFollowUp
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Configuration saved');
      onUpdate(); // Reload to get updated data
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className={`card hover:shadow-lg transition-shadow duration-200 ${isLLMInitial ? 'border-2 border-[var(--accent)]' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2">
            {feature.feature_name}
            {isLLMInitial && <span className="text-xs px-2 py-1 bg-[var(--accent)] text-white rounded">RECOMMENDED</span>}
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {feature.description}
          </p>
          {isLLMInitial && (
            <p className="text-xs text-[var(--accent)] mt-2">
              ✨ This uses AI to understand ALL initial messages, not just keyword matching
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={feature.enabled}
              onChange={(e) => onToggle(feature.feature_key, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[var(--bg-tertiary)] peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--accent)]"></div>
          </label>
        </div>
      </div>
      
      {/* Stats */}
      {feature.stats && (
        <div className="mt-4 pt-4 border-t border-[var(--border-secondary)]">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">Total Uses:</span>
              <span className="ml-2 font-medium">{feature.stats.total_uses}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Success Rate:</span>
              <span className="ml-2 font-medium">
                {feature.stats.total_uses > 0 
                  ? Math.round((feature.stats.successful_uses / feature.stats.total_uses) * 100) 
                  : 0}%
              </span>
            </div>
          </div>
          {feature.stats.last_used && (
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              Last used: {new Date(feature.stats.last_used).toLocaleString()}
            </div>
          )}
        </div>
      )}
      
      {/* Expanded Configuration */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-[var(--border-secondary)] space-y-4">
          {/* Max Responses */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Max Responses per Conversation
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxResponses}
              onChange={(e) => setMaxResponses(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              e.g., Gift cards: 2 (allows follow-up if customer says thanks)
            </p>
          </div>
          
          {/* Response Source */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Response Source
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="database"
                  checked={responseSource === 'database'}
                  onChange={(e) => setResponseSource(e.target.value)}
                  className="text-[var(--accent)]"
                />
                <span className="text-sm">Use AI Assistant</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="hardcoded"
                  checked={responseSource === 'hardcoded'}
                  onChange={(e) => setResponseSource(e.target.value)}
                  className="text-[var(--accent)]"
                />
                <span className="text-sm">Custom Response</span>
              </label>
            </div>
          </div>
          
          {/* Custom Response */}
          {responseSource === 'hardcoded' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Custom Response
              </label>
              <textarea
                value={hardcodedResponse}
                onChange={(e) => setHardcodedResponse(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] text-sm"
                placeholder="Enter the exact response to send..."
              />
            </div>
          )}
          
          {/* Allow Follow-up */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowFollowUp}
                onChange={(e) => setAllowFollowUp(e.target.checked)}
                className="w-4 h-4 text-[var(--accent)]"
              />
              <span className="text-sm text-[var(--text-secondary)]">
                Allow follow-up responses
              </span>
            </label>
            <p className="mt-1 text-xs text-[var(--text-muted)] ml-6">
              If disabled, only one response will be sent per conversation
            </p>
          </div>
          
          {/* Save Button */}
          <button
            onClick={saveConfig}
            disabled={isSaving}
            className="w-full btn btn-primary"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      )}
      
      {/* Category Badge */}
      <div className="mt-3">
        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
          feature.category === 'customer_service' ? 'bg-blue-100 text-blue-800' :
          feature.category === 'technical' ? 'bg-orange-100 text-orange-800' :
          feature.category === 'booking' ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {feature.category.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
};