import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useAuthState } from '@/state/useStore';
// Remove the non-existent useAnalytics import
import { 
  Activity, 
  Users, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Calendar,
  DollarSign,
  Target
} from 'lucide-react';

type TimeRange = '24h' | '7d' | '30d' | '90d';

type MetricCard = {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
};

export default function Operations() {
  const { user } = useAuthState();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [selectedMetric, setSelectedMetric] = useState<string>('revenue');

  // Mock data - replace with real API calls
  const metrics: MetricCard[] = [
    {
      title: 'Total Revenue',
      value: '$24,580',
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign
    },
    {
      title: 'Active Sessions',
      value: '156',
      change: '+8.2%',
      trend: 'up',
      icon: Activity
    },
    {
      title: 'Member Count',
      value: '342',
      change: '+3.1%',
      trend: 'up',
      icon: Users
    },
    {
      title: 'Avg Session Time',
      value: '1.8 hrs',
      change: '-5.4%',
      trend: 'down',
      icon: Clock
    }
  ];

  const recentIssues = [
    { id: 1, bay: 'Bay 3', issue: 'Projector alignment needed', status: 'pending', priority: 'medium' },
    { id: 2, bay: 'Bay 7', issue: 'Sound system intermittent', status: 'resolved', priority: 'high' },
    { id: 3, bay: 'Bay 2', issue: 'Mat wear visible', status: 'pending', priority: 'low' },
  ];

  const upcomingBookings = [
    { id: 1, time: '2:00 PM', customer: 'John Smith', bay: 'Bay 4', duration: '2 hrs' },
    { id: 2, time: '4:00 PM', customer: 'Corporate Event', bay: 'Bay 1-3', duration: '3 hrs' },
    { id: 3, time: '7:00 PM', customer: 'League Night', bay: 'All Bays', duration: '4 hrs' },
  ];

  return (
    <>
      <Head>
        <title>ClubOS - Operations Dashboard</title>
        <meta name="description" content="Operations overview and analytics" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
              Operations Dashboard
            </h1>
            <p className="text-[var(--text-secondary)]">
              Real-time facility performance and analytics
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="flex gap-2 mb-6">
            {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  timeRange === range
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {range === '24h' ? 'Last 24 Hours' : `Last ${range}`}
              </button>
            ))}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div 
                  key={metric.title} 
                  className="card hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => setSelectedMetric(metric.title.toLowerCase().replace(' ', '-'))}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                      <Icon className="w-6 h-6 text-[var(--accent)]" />
                    </div>
                    <span className={`text-sm font-medium ${
                      metric.trend === 'up' ? 'text-green-400' : 
                      metric.trend === 'down' ? 'text-red-400' : 
                      'text-gray-400'
                    }`}>
                      {metric.change}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mb-1">{metric.title}</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{metric.value}</p>
                </div>
              );
            })}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Area - 2 columns */}
            <div className="lg:col-span-2 card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Performance Trends</h2>
                <Target className="w-5 h-5 text-[var(--text-secondary)]" />
              </div>
              <div className="h-64 flex items-center justify-center bg-[var(--bg-tertiary)] rounded-lg">
                <p className="text-[var(--text-secondary)]">
                  Chart visualization would go here
                </p>
              </div>
            </div>

            {/* Recent Issues - 1 column */}
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Recent Issues</h2>
                <AlertCircle className="w-5 h-5 text-[var(--status-warning)]" />
              </div>
              <div className="space-y-3">
                {recentIssues.map((issue) => (
                  <div 
                    key={issue.id}
                    className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{issue.bay}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        issue.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        issue.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {issue.priority}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">{issue.issue}</p>
                    <p className={`text-xs mt-1 ${
                      issue.status === 'resolved' ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {issue.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming Bookings */}
          <div className="card mt-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Upcoming Bookings</h2>
              <Calendar className="w-5 h-5 text-[var(--text-secondary)]" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-secondary)]">
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Time</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Customer</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Bay</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingBookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-[var(--border-secondary)] hover:bg-[var(--bg-secondary)]">
                      <td className="py-3 px-4 text-sm">{booking.time}</td>
                      <td className="py-3 px-4 text-sm font-medium">{booking.customer}</td>
                      <td className="py-3 px-4 text-sm">{booking.bay}</td>
                      <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">{booking.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
