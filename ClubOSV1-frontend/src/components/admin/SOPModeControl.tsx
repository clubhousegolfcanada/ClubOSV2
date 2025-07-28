import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Brain, 
  Eye, 
  AlertCircle,
  TrendingUp,
  DollarSign,
  ChevronRight
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
    <div className="space-y-3">
      {/* Compact Module Status */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Status</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
          status.module.initialized 
            ? 'bg-green-500/10 text-green-500' 
            : 'bg-red-500/10 text-red-500'
        }`}>
          {status.module.initialized ? 'READY' : 'OFFLINE'}
        </span>
      </div>

      {/* Pill Toggle Controls */}
      <div className="space-y-2">
        {/* Shadow Mode */}
        <div className="flex items-center justify-between py-1">
          <span className="text-xs font-medium">Shadow Mode</span>
          <button
            onClick={() => toggleMode('SOP_SHADOW_MODE')}
            disabled={isLoading}
            className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
              status.config.SOP_SHADOW_MODE 
                ? 'bg-[var(--accent)] text-white' 
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            {status.config.SOP_SHADOW_MODE ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Use SOP Module */}
        <div className="flex items-center justify-between py-1">
          <span className="text-xs font-medium">Use SOP Module</span>
          <button
            onClick={() => toggleMode('USE_INTELLIGENT_SOP')}
            disabled={isLoading || status.config.SOP_SHADOW_MODE}
            className={`px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
              status.config.USE_INTELLIGENT_SOP 
                ? 'bg-[var(--accent)] text-white' 
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            } ${
              status.config.SOP_SHADOW_MODE ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={status.config.SOP_SHADOW_MODE ? 'Disable Shadow Mode first' : ''}
          >
            {status.config.USE_INTELLIGENT_SOP ? 'ON' : 'OFF'}
          </button>
        </div>

        {status.config.SOP_SHADOW_MODE && (
          <div className="text-[10px] text-yellow-500 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" />
            Disable shadow mode to switch
          </div>
        )}
      </div>

      {/* Inline Module Metrics */}
      <div className="flex items-center justify-between py-2 border-t border-[var(--border-secondary)] text-[11px]">
        <span className="text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text-secondary)]">{status.module.documentCount}</span> Docs
        </span>
        <span className="text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text-secondary)]">{status.module.assistants.length}</span> Assistants
        </span>
        <span className="text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text-secondary)]">{status.config.SOP_CONFIDENCE_THRESHOLD}</span> Min Conf
        </span>
      </div>

      {/* Shadow Mode Performance - Collapsible */}
      {shadowStats && shadowStats.overall.total_comparisons > 0 && (
        <details className="group">
          <summary className="cursor-pointer py-2 border-t border-[var(--border-secondary)] flex items-center justify-between text-xs font-medium hover:text-[var(--accent)] transition-colors">
            <span>Shadow Mode Performance</span>
            <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
          </summary>
          
          <div className="pt-2 pb-1 space-y-2">
            {/* Compact inline metrics */}
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
              <span>{shadowStats.overall.total_comparisons} Comparisons</span>
              <span className="text-green-500">{confidencePercentage}% Confidence</span>
              <span className="text-blue-500">{timeImprovement}% Faster</span>
              <span className={shadowStats.overall.high_confidence_count / shadowStats.overall.total_comparisons > 0.8 ? 'text-green-500' : 'text-yellow-500'}>
                {shadowStats.overall.high_confidence_count / shadowStats.overall.total_comparisons > 0.8 ? 'Ready' : 'Not Ready'}
              </span>
            </div>
          </div>
        </details>
      )}

      {/* Current Mode - Minimal */}
      <div className="text-[11px] text-center py-1.5 rounded bg-[var(--bg-secondary)]">
        <span className="text-[var(--text-muted)]">Mode: </span>
        <span className={`font-medium ${
          status.config.USE_INTELLIGENT_SOP ? 'text-green-500' : 'text-blue-500'
        }`}>
          {status.config.USE_INTELLIGENT_SOP ? 'SOP' : 'OpenAI'}
          {status.config.SOP_SHADOW_MODE && ' + Shadow'}
        </span>
      </div>
    </div>
  );
};