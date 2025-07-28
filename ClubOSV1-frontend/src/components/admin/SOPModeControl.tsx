import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Brain, 
  Eye, 
  AlertCircle,
  TrendingUp,
  DollarSign
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface SOPStatus {
  module: {
    initialized: boolean;
    documentCount: number;
    assistants: string[];
  };
  config: {
    USE_INTELLIGENT_SOP: boolean;
    SOP_SHADOW_MODE: boolean;
    SOP_CONFIDENCE_THRESHOLD: number;
  };
  metrics: any;
}

interface ShadowStats {
  overall: {
    total_comparisons: number;
    avg_sop_confidence: number;
    avg_sop_time: number;
    avg_assistant_time: number;
    high_confidence_count: number;
    low_confidence_count: number;
  };
}

export const SOPModeControl: React.FC = () => {
  const { user } = useAuthState();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<SOPStatus | null>(null);
  const [shadowStats, setShadowStats] = useState<ShadowStats | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchShadowStats();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/sop-monitoring/sop-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(response.data.data);
    } catch (error) {
      console.error('Failed to fetch SOP status:', error);
    }
  };

  const fetchShadowStats = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/sop-monitoring/shadow-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShadowStats(response.data.data);
    } catch (error) {
      console.error('Failed to fetch shadow stats:', error);
    }
  };

  const toggleMode = async (mode: 'USE_INTELLIGENT_SOP' | 'SOP_SHADOW_MODE') => {
    if (!status) return;
    
    const newValue = !status.config[mode];
    
    // Confirm critical changes
    if (mode === 'USE_INTELLIGENT_SOP' && newValue) {
      const confirmed = window.confirm(
        'Are you sure you want to switch to the SOP module? This will stop using OpenAI Assistants for new requests.'
      );
      if (!confirmed) return;
    }
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      
      // Update system config
      const configKey = mode === 'USE_INTELLIGENT_SOP' ? 'sop_mode_enabled' : 'sop_shadow_mode';
      await axios.put(
        `${API_URL}/system-config/${configKey}`,
        { value: newValue.toString() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`${mode === 'USE_INTELLIGENT_SOP' ? 'SOP Mode' : 'Shadow Mode'} ${newValue ? 'enabled' : 'disabled'}`);
      
      // Refresh status
      await fetchStatus();
      
    } catch (error) {
      console.error('Failed to toggle mode:', error);
      toast.error('Failed to update configuration');
    } finally {
      setIsLoading(false);
    }
  };

  if (!status) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto"></div>
      </div>
    );
  }

  const confidencePercentage = shadowStats?.overall?.avg_sop_confidence 
    ? (shadowStats.overall.avg_sop_confidence * 100).toFixed(1)
    : '0';
    
  const timeImprovement = shadowStats?.overall?.avg_assistant_time && shadowStats?.overall?.avg_sop_time
    ? ((shadowStats.overall.avg_assistant_time - shadowStats.overall.avg_sop_time) / shadowStats.overall.avg_assistant_time * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-4">
      {/* Module Status */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[var(--text-secondary)]">Module Status</span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          status.module.initialized 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-red-500/20 text-red-400'
        }`}>
          {status.module.initialized ? 'Initialized' : 'Not Initialized'}
        </span>
      </div>

        {/* Mode Controls */}
        <div className="space-y-4">
          {/* Shadow Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
              <label className="text-sm font-medium">Shadow Mode</label>
            </div>
            <button
              onClick={() => toggleMode('SOP_SHADOW_MODE')}
              disabled={isLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                status.config.SOP_SHADOW_MODE 
                  ? 'bg-[var(--accent)]' 
                  : 'bg-[var(--bg-tertiary)]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  status.config.SOP_SHADOW_MODE ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* SOP Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[var(--text-secondary)]" />
              <label className="text-sm font-medium">Use SOP Module</label>
            </div>
            <button
              onClick={() => toggleMode('USE_INTELLIGENT_SOP')}
              disabled={isLoading || status.config.SOP_SHADOW_MODE}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                status.config.USE_INTELLIGENT_SOP 
                  ? 'bg-[var(--accent)]' 
                  : 'bg-[var(--bg-tertiary)]'
              } ${
                status.config.SOP_SHADOW_MODE ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={status.config.SOP_SHADOW_MODE ? 'Disable Shadow Mode first' : ''}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  status.config.USE_INTELLIGENT_SOP ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {status.config.SOP_SHADOW_MODE && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-sm text-yellow-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Shadow mode must be disabled before switching to SOP module
              </p>
            </div>
          )}
        </div>

      {/* Module Stats */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[var(--border-secondary)]">
        <div className="text-center">
          <p className="text-lg font-semibold">{status.module.documentCount}</p>
          <p className="text-xs text-[var(--text-muted)]">Documents</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">{status.module.assistants.length}</p>
          <p className="text-xs text-[var(--text-muted)]">Assistants</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">{status.config.SOP_CONFIDENCE_THRESHOLD}</p>
          <p className="text-xs text-[var(--text-muted)]">Min Confidence</p>
        </div>
      </div>

      {/* Shadow Mode Statistics */}
      {shadowStats && shadowStats.overall.total_comparisons > 0 && (
        <div className="pt-4 border-t border-[var(--border-secondary)]">
          <h4 className="text-sm font-semibold mb-3">Shadow Mode Performance</h4>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{shadowStats.overall.total_comparisons}</p>
              <p className="text-sm text-[var(--text-secondary)]">Comparisons</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{confidencePercentage}%</p>
              <p className="text-sm text-[var(--text-secondary)]">Avg Confidence</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{timeImprovement}%</p>
              <p className="text-sm text-[var(--text-secondary)]">Faster</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">
                {shadowStats.overall.high_confidence_count}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">High Confidence</p>
            </div>
          </div>

          {/* Performance Indicators */}
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Average SOP Response Time</span>
              <span className="font-medium">{Math.round(shadowStats.overall.avg_sop_time)}ms</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Average Assistant Response Time</span>
              <span className="font-medium">{Math.round(shadowStats.overall.avg_assistant_time)}ms</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Ready for Production</span>
              <span className={`font-medium ${
                shadowStats.overall.high_confidence_count / shadowStats.overall.total_comparisons > 0.8
                  ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {shadowStats.overall.high_confidence_count / shadowStats.overall.total_comparisons > 0.8 ? 'Yes' : 'Not Yet'}
              </span>
            </div>
          </div>

        </div>
      )}

      {/* Current Status */}
      <div className={`p-3 rounded-lg text-sm ${
        status.config.USE_INTELLIGENT_SOP 
          ? 'bg-green-500/10 border border-green-500/20' 
          : 'bg-blue-500/10 border border-blue-500/20'
      }`}>
        <p className={`font-medium ${
          status.config.USE_INTELLIGENT_SOP ? 'text-green-400' : 'text-blue-400'
        }`}>
          Currently using: {status.config.USE_INTELLIGENT_SOP ? 'SOP Module' : 'OpenAI Assistants'}
          {status.config.SOP_SHADOW_MODE && ' (with Shadow Mode)'}
        </p>
      </div>
    </div>
  );
};