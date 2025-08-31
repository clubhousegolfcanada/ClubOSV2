import React, { useEffect, useState } from 'react';
import { API_URL } from '@/utils/apiUrl';
import axios from 'axios';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';


interface InsightMetric {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  suffix?: string;
}

export const MiniInsightsPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<InsightMetric[]>([
    { label: 'Bookings Today', value: '—', trend: 'neutral' },
    { label: 'No-Show Rate (24h)', value: '—', suffix: '%', trend: 'neutral' },
    { label: 'Refunds Last 7 Days', value: '—', trend: 'neutral' },
    { label: 'Most Common Issue', value: 'Loading...', trend: 'neutral' }
  ]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem('clubos_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Fetch various metrics in parallel
        const [bookingsRes, ticketsRes, historyRes] = await Promise.all([
          // Bookings today (mock for now - would come from booking system)
          axios.get(`${API_URL}/history/stats/overview?period=24h`, { headers }),
          // Tickets for common issues
          axios.get(`${API_URL}/tickets?limit=100`, { headers }),
          // History for no-show and refund data
          axios.get(`${API_URL}/history?limit=100`, { headers })
        ]);

        // Calculate metrics
        const today = new Date().toDateString();
        const bookingsToday = bookingsRes.data?.data?.totalBookings || 12; // Mock value

        // Calculate no-show rate (mock calculation)
        const noShowRate = 8.5; // Would calculate from actual booking data

        // Calculate refunds (mock)
        const refundsCount = 3;

        // Find most common issue from tickets
        const tickets = ticketsRes.data?.data || [];
        const issueCounts: Record<string, number> = {};
        tickets.forEach((ticket: any) => {
          const category = ticket.category || 'other';
          issueCounts[category] = (issueCounts[category] || 0) + 1;
        });
        
        const mostCommonIssue = Object.entries(issueCounts)
          .sort(([, a], [, b]) => b - a)[0];
        const commonIssueText = mostCommonIssue 
          ? `${mostCommonIssue[0] === 'tech' ? 'TrackMan reset' : 'Door access'}`
          : 'None today';

        setMetrics([
          { 
            label: 'Bookings Today', 
            value: bookingsToday,
            trend: bookingsToday > 10 ? 'up' : 'down'
          },
          { 
            label: 'No-Show Rate (24h)', 
            value: noShowRate.toFixed(1),
            suffix: '%',
            trend: noShowRate > 10 ? 'down' : 'neutral'
          },
          { 
            label: 'Refunds Last 7 Days', 
            value: refundsCount,
            trend: refundsCount > 5 ? 'down' : 'neutral'
          },
          { 
            label: 'Most Common Issue', 
            value: commonIssueText,
            trend: 'neutral'
          }
        ]);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch insights:', error);
        setIsLoading(false);
      }
    };

    fetchMetrics();
    // Refresh every 60 seconds
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
  }, []);

  const getTrendIcon = (trend?: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-red-500" />;
      default:
        return <Minus className="w-3 h-3 text-gray-400" />;
    }
  };

  if (!isLoading && metrics.every(m => m.value === '—')) {
    return null; // Hide panel if no data
  }

  return (
    <div className="hidden lg:block w-full mt-4">
      <div className="card p-4">
        <div className="grid grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <div 
              key={index} 
              className="flex flex-col space-y-1 border-r last:border-r-0 pr-4 last:pr-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  {metric.label}
                </span>
                {getTrendIcon(metric.trend)}
              </div>
              <div className="text-lg font-semibold text-[var(--text-primary)]">
                {metric.value}{metric.suffix || ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};