import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Clock, Users, MessageSquare, CheckCircle, 
  AlertCircle, Zap, Target, Activity, BarChart3 
} from 'lucide-react';
import apiClient from '@/api/http';
import logger from '@/services/logger';

interface OperatorStats {
  // Response metrics
  totalResponses: number;
  automatedResponses: number;
  manualResponses: number;
  automationRate: number;
  
  // Time savings
  avgResponseTime: {
    automated: number; // seconds
    manual: number; // seconds
  };
  timeSavedToday: number; // minutes
  timeSavedWeek: number; // minutes
  
  // Common topics
  topQuestions: Array<{
    topic: string;
    count: number;
    automated: boolean;
  }>;
  
  // Performance
  customerSatisfaction: {
    automated: number;
    manual: number;
  };
  
  // Operator workload
  peakHours: Array<{
    hour: string;
    messages: number;
    automated: number;
  }>;
  
  // Pattern effectiveness
  patternPerformance: Array<{
    type: string;
    name: string;
    uses: number;
    successRate: number;
  }>;
}

export const OperationsPatternsStatistics: React.FC = () => {
  const [stats, setStats] = useState<OperatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // For now, use mock data until backend is ready
      // TODO: Replace with actual API call
      const mockStats: OperatorStats = {
        totalResponses: 247,
        automatedResponses: 198,
        manualResponses: 49,
        automationRate: 80.2,
        avgResponseTime: {
          automated: 2,
          manual: 180
        },
        timeSavedToday: 87,
        timeSavedWeek: 435,
        topQuestions: [
          { topic: 'Booking a bay', count: 45, automated: true },
          { topic: 'Operating hours', count: 38, automated: true },
          { topic: 'Gift cards', count: 32, automated: true },
          { topic: 'Technical issues', count: 28, automated: false },
          { topic: 'Membership info', count: 24, automated: true }
        ],
        customerSatisfaction: {
          automated: 92,
          manual: 94
        },
        peakHours: [
          { hour: '10am', messages: 12, automated: 10 },
          { hour: '12pm', messages: 28, automated: 22 },
          { hour: '2pm', messages: 18, automated: 15 },
          { hour: '4pm', messages: 35, automated: 28 },
          { hour: '6pm', messages: 42, automated: 34 },
          { hour: '8pm', messages: 38, automated: 30 }
        ],
        patternPerformance: [
          { type: 'booking', name: 'Booking Assistance', uses: 145, successRate: 94 },
          { type: 'hours', name: 'Hours of Operation', uses: 132, successRate: 98 },
          { type: 'gift_cards', name: 'Gift Cards', uses: 89, successRate: 91 },
          { type: 'tech_issue', name: 'Technical Support', uses: 67, successRate: 72 }
        ]
      };
      
      setStats(mockStats);
    } catch (error) {
      logger.error('Failed to fetch operator statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">No statistics available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex space-x-2">
          {(['today', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-md capitalize transition-colors ${
                timeRange === range 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Automation Rate</p>
              <p className="text-2xl font-bold text-primary">{stats.automationRate}%</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.automatedResponses} of {stats.totalResponses} messages
              </p>
            </div>
            <Target className="h-8 w-8 text-primary opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Time Saved</p>
              <p className="text-2xl font-bold text-green-600">
                {timeRange === 'today' ? stats.timeSavedToday : stats.timeSavedWeek} min
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Avg response: {stats.avgResponseTime.automated}s vs {Math.floor(stats.avgResponseTime.manual / 60)}min
              </p>
            </div>
            <Clock className="h-8 w-8 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Messages Handled</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalResponses}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.manualResponses} required operator
              </p>
            </div>
            <MessageSquare className="h-8 w-8 text-gray-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Satisfaction</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.customerSatisfaction.automated}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Automated responses
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Questions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Most Common Questions
          </h3>
          <div className="space-y-3">
            {stats.topQuestions.map((question, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">{question.topic}</span>
                  {question.automated && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      Automated
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-500">{question.count} times</span>
              </div>
            ))}
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Peak Message Times
          </h3>
          <div className="space-y-3">
            {stats.peakHours.map((hour, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 w-16">{hour.hour}</span>
                <div className="flex-1 mx-4">
                  <div className="bg-gray-200 rounded-full h-4 relative">
                    <div 
                      className="bg-primary rounded-full h-4 absolute top-0 left-0"
                      style={{ width: `${(hour.automated / hour.messages) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-500 w-20 text-right">
                  {hour.messages} msgs
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Green shows automated responses
          </p>
        </div>

        {/* Pattern Performance */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Top Performing Patterns
          </h3>
          <div className="space-y-3">
            {stats.patternPerformance.map((pattern, idx) => (
              <div key={idx} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{pattern.name}</span>
                  <span className="text-sm text-gray-500">{pattern.uses} uses</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        pattern.successRate >= 90 ? 'bg-green-500' : 
                        pattern.successRate >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${pattern.successRate}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-12 text-right">
                    {pattern.successRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operator Impact */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Operator Impact
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Messages Automated</p>
                <p className="text-xs text-gray-500">Didn't require operator attention</p>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.automatedResponses}</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Avg Response Time</p>
                <p className="text-xs text-gray-500">For automated messages</p>
              </div>
              <p className="text-2xl font-bold text-blue-600">{stats.avgResponseTime.automated}s</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700">Operator Interventions</p>
                <p className="text-xs text-gray-500">Required manual response</p>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{stats.manualResponses}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Alert */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-gray-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-700">Optimization Tip</p>
            <p className="text-sm text-gray-600 mt-1">
              Technical support questions have the lowest automation rate (72%). 
              Consider adding more patterns for common tech issues to reduce operator workload.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};