import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import { BarChart3, TrendingUp, Users, MessageSquare, Calendar, Download, Filter, RefreshCw, Clock, Activity, DollarSign, FileText, ChevronDown, ChevronRight } from 'lucide-react';


interface AnalyticsData {
  routing: {
    totalRequests: number;
    byRoute: Record<string, number>;
    avgConfidence: number;
    fallbackRate: number;
  };
  ai: {
    totalAutomations: number;
    successRate: number;
    responseTime: number;
    costPerAutomation: number;
    byFeature: Record<string, { count: number; success: number }>;
  };
  usage: {
    activeUsers: number;
    peakHours: number[];
    featureAdoption: Record<string, number>;
    dailyMessages: number[];
  };
}

export const OperationsAnalytics: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    routing: {
      totalRequests: 0,
      byRoute: {},
      avgConfidence: 0,
      fallbackRate: 0
    },
    ai: {
      totalAutomations: 0,
      successRate: 0,
      responseTime: 0,
      costPerAutomation: 0,
      byFeature: {}
    },
    usage: {
      activeUsers: 0,
      peakHours: [],
      featureAdoption: {},
      dailyMessages: []
    }
  });
  
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year'>('week');
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    routing: true,
    ai: true,
    usage: true,
    reports: false
  });
  
  const { user } = useAuthState();
  const token = user?.token || localStorage.getItem('clubos_token');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Analytics endpoints might not exist yet, using mock data
      /*
      const [routingRes, aiRes, usageRes] = await Promise.all([
        http.get(`analytics/routing?range=${dateRange}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        http.get(`analytics/ai?range=${dateRange}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        http.get(`analytics/usage?range=${dateRange}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setAnalyticsData({
        routing: routingRes.data || analyticsData.routing,
        ai: aiRes.data || analyticsData.ai,
        usage: usageRes.data || analyticsData.usage
      });
      */
      console.log('Using mock analytics data');
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Use mock data if API fails
      setAnalyticsData({
        routing: {
          totalRequests: 1247,
          byRoute: {
            'Booking & Access': 523,
            'Tech Support': 312,
            'Emergency': 89,
            'Brand Tone': 323
          },
          avgConfidence: 0.82,
          fallbackRate: 0.12
        },
        ai: {
          totalAutomations: 456,
          successRate: 0.89,
          responseTime: 2.3,
          costPerAutomation: 0.03,
          byFeature: {
            'gift_cards': { count: 123, success: 110 },
            'trackman_reset': { count: 87, success: 82 },
            'hours_info': { count: 246, success: 245 }
          }
        },
        usage: {
          activeUsers: 42,
          peakHours: [9, 10, 14, 15, 16, 17, 18, 19],
          featureAdoption: {
            'Messages': 0.92,
            'AI Automations': 0.78,
            'Tickets': 0.65,
            'Checklists': 0.83
          },
          dailyMessages: [45, 52, 48, 61, 58, 72, 38]
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const exportData = async (format: 'csv' | 'pdf') => {
    try {
      const response = await http.get(
        `analytics/export?format=${format}&range=${dateRange}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const blob = new Blob([response.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      
      toast.success(`${format.toUpperCase()} export downloaded`);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  const formatPercentage = (value: number) => `${Math.round(value * 100)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-semibold text-gray-900">Date Range</span>
            </div>
            <div className="flex space-x-2">
              {(['today', 'week', 'month', 'year'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    dateRange === range
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => fetchAnalytics()}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {loading ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">
              {formatNumber(analyticsData.routing.totalRequests)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900">Total Requests</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatPercentage(1 - analyticsData.routing.fallbackRate)} handled by AI
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">
              {formatPercentage(analyticsData.ai.successRate)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900">Success Rate</p>
          <p className="text-xs text-gray-500 mt-1">AI automation accuracy</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-8 w-8 text-purple-600" />
            <span className="text-2xl font-bold text-gray-900">
              {formatNumber(analyticsData.usage.activeUsers)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900">Active Users</p>
          <p className="text-xs text-gray-500 mt-1">This {dateRange}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-8 w-8 text-orange-600" />
            <span className="text-2xl font-bold text-gray-900">
              {analyticsData.ai.responseTime.toFixed(1)}s
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900">Avg Response Time</p>
          <p className="text-xs text-gray-500 mt-1">AI processing speed</p>
        </div>
      </div>

      {/* Routing Analytics Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div 
          className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('routing')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">Routing Analytics</h2>
            </div>
            {expandedSections.routing ? 
              <ChevronDown className="h-5 w-5 text-gray-500" /> : 
              <ChevronRight className="h-5 w-5 text-gray-500" />
            }
          </div>
        </div>
        
        {expandedSections.routing && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Routes Distribution */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Requests by Route</h3>
                <div className="space-y-3">
                  {Object.entries(analyticsData.routing.byRoute).map(([route, count]) => {
                    const percentage = (count / analyticsData.routing.totalRequests) * 100;
                    return (
                      <div key={route}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700">{route}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confidence & Fallback */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Performance Metrics</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Average Confidence</span>
                      <span className="text-xl font-bold text-gray-900">
                        {formatPercentage(analyticsData.routing.avgConfidence)}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Fallback to Slack</span>
                      <span className="text-xl font-bold text-gray-900">
                        {formatPercentage(analyticsData.routing.fallbackRate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Performance Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div 
          className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('ai')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">AI Performance</h2>
            </div>
            {expandedSections.ai ? 
              <ChevronDown className="h-5 w-5 text-gray-500" /> : 
              <ChevronRight className="h-5 w-5 text-gray-500" />
            }
          </div>
        </div>
        
        {expandedSections.ai && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Feature Performance */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Automation Performance</h3>
                <div className="space-y-3">
                  {Object.entries(analyticsData.ai.byFeature).map(([feature, stats]) => {
                    const successRate = stats.success / stats.count;
                    return (
                      <div key={feature} className="p-3 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          <span className="text-xs text-gray-500">{stats.count} uses</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${successRate > 0.8 ? 'bg-green-500' : successRate > 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${successRate * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{formatPercentage(successRate)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cost Analysis */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost Analysis</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-blue-700">Total Automations</span>
                      <span className="text-xl font-bold text-blue-900">
                        {formatNumber(analyticsData.ai.totalAutomations)}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600">This {dateRange}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-green-700">Cost per Automation</span>
                      <span className="text-xl font-bold text-green-900">
                        ${analyticsData.ai.costPerAutomation.toFixed(3)}
                      </span>
                    </div>
                    <p className="text-xs text-green-600">
                      Total cost: ${(analyticsData.ai.totalAutomations * analyticsData.ai.costPerAutomation).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Usage Reports Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div 
          className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('usage')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">Usage Reports</h2>
            </div>
            {expandedSections.usage ? 
              <ChevronDown className="h-5 w-5 text-gray-500" /> : 
              <ChevronRight className="h-5 w-5 text-gray-500" />
            }
          </div>
        </div>
        
        {expandedSections.usage && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Feature Adoption */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Feature Adoption</h3>
                <div className="space-y-3">
                  {Object.entries(analyticsData.usage.featureAdoption).map(([feature, adoption]) => (
                    <div key={feature} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{feature}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${adoption * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12 text-right">
                          {formatPercentage(adoption)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peak Hours */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Peak Usage Hours</h3>
                <div className="grid grid-cols-12 gap-1">
                  {Array.from({ length: 24 }, (_, i) => {
                    const isPeak = analyticsData.usage.peakHours.includes(i);
                    return (
                      <div 
                        key={i}
                        className={`h-8 rounded ${isPeak ? 'bg-primary' : 'bg-gray-200'}`}
                        title={`${i}:00 - ${i + 1}:00`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-gray-500">12am</span>
                  <span className="text-xs text-gray-500">6am</span>
                  <span className="text-xs text-gray-500">12pm</span>
                  <span className="text-xs text-gray-500">6pm</span>
                  <span className="text-xs text-gray-500">11pm</span>
                </div>
              </div>
            </div>

            {/* Daily Messages Chart */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Daily Message Volume</h3>
              <div className="flex items-end space-x-2 h-32">
                {analyticsData.usage.dailyMessages.map((count, index) => {
                  const height = (count / Math.max(...analyticsData.usage.dailyMessages)) * 100;
                  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-primary rounded-t"
                        style={{ height: `${height}%` }}
                        title={`${count} messages`}
                      />
                      <span className="text-xs text-gray-500 mt-1">
                        {days[index]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Tools Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div 
          className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleSection('reports')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">Export Tools</h2>
            </div>
            {expandedSections.reports ? 
              <ChevronDown className="h-5 w-5 text-gray-500" /> : 
              <ChevronRight className="h-5 w-5 text-gray-500" />
            }
          </div>
        </div>
        
        {expandedSections.reports && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => exportData('csv')}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="font-semibold text-gray-900">Export CSV</p>
                <p className="text-xs text-gray-500 mt-1">Raw data for analysis</p>
              </button>
              
              <button
                onClick={() => exportData('pdf')}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <p className="font-semibold text-gray-900">Generate PDF Report</p>
                <p className="text-xs text-gray-500 mt-1">Formatted report with charts</p>
              </button>
              
              <button
                onClick={() => toast('Schedule reports coming soon', { icon: 'ℹ️' })}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="font-semibold text-gray-900">Schedule Reports</p>
                <p className="text-xs text-gray-500 mt-1">Automated weekly/monthly</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};