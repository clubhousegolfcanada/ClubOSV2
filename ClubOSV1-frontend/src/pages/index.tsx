import Head from 'next/head';
import RequestForm from '@/components/RequestForm';
import RoleSwitcher from '@/components/RoleSwitcher';
import ExternalTools from '@/components/ExternalTools';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useDemoMode, useAnalytics } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { hasMinimumRole } from '@/utils/roleUtils';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function Home() {
  const { runDemo } = useDemoMode();
  const { stats, period } = useAnalytics();
  const { user } = useAuthState();
  const [previousStats, setPreviousStats] = useState<any>(null);
  
  // Fetch previous period stats for comparison
  useEffect(() => {
    const fetchPreviousPeriod = async () => {
      try {
        // For 24h period, get yesterday's data
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const response = await axios.get(`${API_URL}/history/stats/overview`, {
          params: { 
            period: '24h',
            endDate: yesterday.toISOString()
          }
        });
        
        if (response.data.success) {
          setPreviousStats(response.data.data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch previous stats:', error);
      }
    };
    
    fetchPreviousPeriod();
  }, []);
  
  // Auto-refresh stats every 30 seconds - DISABLED
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     window.location.reload();
  //   }, 30000);
  //   
  //   return () => clearInterval(interval);
  // }, []);

  // Calculate today's requests
  const todayRequests = stats.totalRequests || 0;
  
  // Calculate change from previous period
  const previousRequests = previousStats?.totalRequests || 0;
  const requestDiff = todayRequests - previousRequests;
  const requestChange = requestDiff > 0 ? `+${requestDiff}` : requestDiff < 0 ? `${requestDiff}` : '0';
  const requestTrend = requestDiff > 0 ? 'up' : requestDiff < 0 ? 'down' : 'neutral';
  
  // Format average response time
  const avgResponseSeconds = stats.avgResponseTime ? (stats.avgResponseTime / 1000).toFixed(1) : '0.0';
  const prevAvgResponseSeconds = previousStats?.avgResponseTime ? (previousStats.avgResponseTime / 1000).toFixed(1) : '0.0';
  
  // Calculate response time change
  const responseDiff = stats.avgResponseTime && previousStats?.avgResponseTime 
    ? ((stats.avgResponseTime - previousStats.avgResponseTime) / 1000).toFixed(1)
    : '0.0';
  const responseChange = parseFloat(responseDiff) > 0 ? `+${responseDiff}s` : `${responseDiff}s`;
  const responseTrend = parseFloat(responseDiff) < 0 ? 'down' : parseFloat(responseDiff) > 0 ? 'up' : 'neutral';

  const quickStats = [
    { 
      label: 'Active Bookings', 
      value: 'N/A', 
      change: '', 
      trend: 'neutral' as const 
    },
    { 
      label: 'Requests Today', 
      value: todayRequests.toString(), 
      change: requestChange, 
      trend: requestTrend as any
    },
    { 
      label: 'Avg Response Time', 
      value: `${avgResponseSeconds}s`, 
      change: responseChange, 
      trend: responseTrend as any
    },
    { 
      label: 'System Status', 
      value: 'Operational', 
      trend: 'neutral' as const 
    }
  ];

  return (
    <>
      <Head>
        <title>ClubOS - Golf Simulator Management</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
      </Head>
      
      <main className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-4 py-8">
          {/* Header Section */}
          <header className="flex justify-between items-center mb-12">
            <div>
              <h1 className="logo text-4xl font-semibold mb-2">ClubOS</h1>
              <p className="text-[var(--text-secondary)]">
                Intelligent request routing for golf simulator operations
              </p>
            </div>
            <button
              onClick={runDemo}
              className="btn-demo"
              title="See a live example of equipment troubleshooting"
            >
              Demo
            </button>
          </header>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            {quickStats.map((stat, index) => (
              <div key={index} className="card group hover:border-[var(--accent)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-semibold mt-1">{stat.value}</p>
                  </div>
                  {stat.change && (
                    <div className={`text-sm font-medium ${
                      stat.trend === 'up' ? 'text-[var(--status-success)]' : 
                      stat.trend === 'down' ? 'text-[var(--status-error)]' : 
                      'text-[var(--text-secondary)]'
                    }`}>
                      {stat.change}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Request Form - Takes up 2 columns on large screens */}
            <div className="lg:col-span-2">
              <RequestForm />
            </div>
            
            {/* External Tools - Takes up 1 column on large screens */}
            <div className="lg:col-span-1">
              <ExternalTools />
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Link href="/commands" className="block">
              <div className="card group cursor-pointer">
                <h3 className="text-lg font-semibold mb-2 flex items-center">
                  <span className="mr-2">📋</span> Command Reference
                </h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  Browse all available commands and learn how to use them effectively
                </p>
              </div>
            </Link>
            
            {hasMinimumRole(user?.role, 'operator') && (
              <Link href="/operations" className="block">
                <div className="card group cursor-pointer">
                  <h3 className="text-lg font-semibold mb-2 flex items-center">
                    <span className="mr-2">⚙️</span> Operations Center
                  </h3>
                  <p className="text-[var(--text-secondary)] text-sm">
                    Monitor system health, view analytics, and manage settings
                  </p>
                </div>
              </Link>
            )}
            
            <div className="card group cursor-pointer bg-[var(--accent)] text-white">
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <span className="mr-2">💡</span> Pro Tips
              </h3>
              <p className="text-white/90 text-sm">
                Use natural language • Include location details • Enable Smart Assist for AI routing
              </p>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .logo {
          background: linear-gradient(135deg, var(--accent) 0%, #20a0a0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .btn-demo {
          background: var(--bg-secondary);
          border: 1px solid var(--border-secondary);
          color: var(--text-secondary);
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 500;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .btn-demo:hover {
          border-color: var(--accent);
          color: var(--text-primary);
        }
      `}</style>
    </>
  );
}