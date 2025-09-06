import React, { useState, useEffect } from 'react';
import { Brain, Activity, TrendingUp, Clock, RefreshCw, BarChart3 } from 'lucide-react';
import apiClient from '@/api/http';
import { PatternAutomationCards } from './PatternAutomationCards';
import { OperationsPatternsStatistics } from './OperationsPatternsStatistics';
import logger from '@/services/logger';
import { tokenManager } from '@/utils/tokenManager';
import { useAuthState } from '@/state/useStore';

interface Stats {
  totalPatterns: number;
  activePatterns: number;
  executionsToday: number;
  executionsThisWeek: number;
  successRate: number;
  avgConfidence: number;
  topPatterns: Array<{
    pattern_type: string;
    execution_count: number;
  }>;
}

export const OperationsPatternsEnhanced: React.FC = () => {
  const { user } = useAuthState();
  const token = user?.token || tokenManager.getToken();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeView, setActiveView] = useState<'patterns' | 'statistics'>('patterns');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/patterns/stats');
      setStats(response.data);
    } catch (error) {
      logger.error('Failed to fetch pattern stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with System Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Brain className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">V3 Pattern Learning System</h1>
              <p className="text-sm text-gray-600">AI-powered message automation that learns from operator responses</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <Activity className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">System Active</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{stats.totalPatterns}</div>
              <div className="text-xs text-gray-600">Total Patterns</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-primary">{stats.activePatterns}</div>
              <div className="text-xs text-gray-600">Active Patterns</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{stats.executionsToday}</div>
              <div className="text-xs text-gray-600">Executions Today</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-primary">{stats.successRate}%</div>
              <div className="text-xs text-gray-600">Success Rate</div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
        <button
          onClick={() => setActiveView('patterns')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors ${
            activeView === 'patterns' 
              ? 'bg-primary text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center space-x-1">
            <Brain className="h-4 w-4" />
            <span>Pattern Automations</span>
          </div>
        </button>
        <button
          onClick={() => setActiveView('statistics')}
          className={`flex-1 px-4 py-2 rounded-md transition-colors ${
            activeView === 'statistics' 
              ? 'bg-primary text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center space-x-1">
            <BarChart3 className="h-4 w-4" />
            <span>Statistics</span>
          </div>
        </button>
      </div>

      {/* Pattern Automations View */}
      {activeView === 'patterns' && (
        <PatternAutomationCards />
      )}

      {/* Statistics View */}
      {activeView === 'statistics' && (
        <OperationsPatternsStatistics />
      )}
    </div>
  );
};