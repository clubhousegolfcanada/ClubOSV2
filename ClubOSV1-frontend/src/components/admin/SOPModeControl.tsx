import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Brain, 
  Eye, 
  ToggleLeft, 
  ToggleRight,
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
    <div className="space-y-6">
      {/* Status Overview */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="w-5 h-5" />
              SOP Module Control
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Switch between OpenAI Assistants and local SOP module
            </p>
          </div>
          
          <div className={`px-3 py-1 rounded-full text-sm ${
            status.module.initialized 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            {status.module.initialized ? 'Initialized' : 'Not Initialized'}
          </div>
        </div>

        {/* Mode Controls */}
        <div className="space-y-4">
          {/* Shadow Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-lg">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-[var(--text-secondary)]" />
              <div>
                <h4 className="font-medium">Shadow Mode</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  Run both systems in parallel for comparison
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleMode('SOP_SHADOW_MODE')}
              disabled={isLoading}
              className="relative"
            >
              {status.config.SOP_SHADOW_MODE ? (
                <ToggleRight className="w-10 h-10 text-[var(--accent)]" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-[var(--text-muted)]" />
              )}
            </button>
          </div>

          {/* SOP Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-lg">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-[var(--text-secondary)]" />
              <div>
                <h4 className="font-medium">Use SOP Module</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  Replace OpenAI Assistants with local SOPs
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleMode('USE_INTELLIGENT_SOP')}
              disabled={isLoading || status.config.SOP_SHADOW_MODE}
              className="relative"
              title={status.config.SOP_SHADOW_MODE ? 'Disable Shadow Mode first' : ''}
            >
              {status.config.USE_INTELLIGENT_SOP ? (
                <ToggleRight className="w-10 h-10 text-[var(--accent)]" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-[var(--text-muted)]" />
              )}
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
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <p className="text-2xl font-bold">{status.module.documentCount}</p>
            <p className="text-sm text-[var(--text-secondary)]">Documents</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{status.module.assistants.length}</p>
            <p className="text-sm text-[var(--text-secondary)]">Assistants</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{status.config.SOP_CONFIDENCE_THRESHOLD}</p>
            <p className="text-sm text-[var(--text-secondary)]">Min Confidence</p>
          </div>
        </div>
      </div>

      {/* Shadow Mode Statistics */}
      {shadowStats && shadowStats.overall.total_comparisons > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Shadow Mode Performance</h3>
          
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
      <div className={`p-4 rounded-lg ${
        status.config.USE_INTELLIGENT_SOP 
          ? 'bg-green-500/10 border border-green-500/20' 
          : 'bg-blue-500/10 border border-blue-500/20'
      }`}>
        <p className={`text-sm font-medium ${
          status.config.USE_INTELLIGENT_SOP ? 'text-green-400' : 'text-blue-400'
        }`}>
          Currently using: {status.config.USE_INTELLIGENT_SOP ? 'SOP Module' : 'OpenAI Assistants'}
          {status.config.SOP_SHADOW_MODE && ' (with Shadow Mode)'}
        </p>
      </div>
    </div>
  );
};