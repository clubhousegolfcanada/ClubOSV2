import Head from 'next/head';
import RequestForm from '@/components/RequestForm';
import DatabaseExternalTools from '@/components/DatabaseExternalTools';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useDemoMode, useAnalytics } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { hasMinimumRole } from '@/utils/roleUtils';
import { useRouter } from 'next/router';
import axios from 'axios';
import { MiniInsightsPanel } from '@/components/dashboard/MiniInsightsPanel';
import { SuggestedActions } from '@/components/dashboard/SuggestedActions';
import { CommandShortcutBar } from '@/components/dashboard/CommandShortcutBar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface QuickStat {
  label: string;
  value: string;
  change?: string;
  trend: 'up' | 'down' | 'neutral';
  isButton?: boolean;
  onClick?: () => void;
  buttonText?: string;
  statusIndicator?: boolean;
}

export default function Home() {
  const { runDemo } = useDemoMode();
  const { stats, period } = useAnalytics();
  const { user } = useAuthState();
  const router = useRouter();
  const [previousStats, setPreviousStats] = useState<any>(null);
  const [weeklyChecklistCount, setWeeklyChecklistCount] = useState<number>(0);
  const [techTicketsOpen, setTechTicketsOpen] = useState<number>(0);
  const [facilitiesTicketsOpen, setFacilitiesTicketsOpen] = useState<number>(0);
  const [isClient, setIsClient] = useState(false);
  
  // Set client flag
  useEffect(() => {
    setIsClient(true);
    // Mobile redirect to messages disabled - now shows dashboard for all devices
  }, []);
  
  // Fetch previous period stats for comparison - only when authenticated
  useEffect(() => {
    const fetchPreviousPeriod = async () => {
      // Only fetch if user is authenticated and on client
      if (!user || !isClient) {
        setPreviousStats({
          totalRequests: 0,
          averageConfidence: 0,
          totalBookings: 0
        });
        return;
      }
      
      try {
        // For 24h period, get yesterday's data
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const token = localStorage.getItem('clubos_token');
        const response = await axios.get(`${API_URL}/history/stats/overview`, {
          params: { 
            period: '24h',
            endDate: yesterday.toISOString()
          },
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        if (response.data.success && response.data.data) {
          setPreviousStats(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch previous stats:', error);
        // Set empty stats to prevent crash
        setPreviousStats({
          totalRequests: 0,
          averageConfidence: 0,
          totalBookings: 0
        });
      }
    };
    
    fetchPreviousPeriod();
  }, [user, isClient]);
  
  // Fetch weekly checklist submissions
  useEffect(() => {
    const fetchChecklistData = async () => {
      if (!user || !isClient) return;
      
      try {
        const token = localStorage.getItem('clubos_token');
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        const response = await axios.get(`${API_URL}/checklists/submissions`, {
          params: { 
            startDate: startOfWeek.toISOString(),
            limit: 100
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          setWeeklyChecklistCount(response.data.data?.length || 0);
        }
      } catch (error) {
        console.error('Failed to fetch checklist data:', error);
        setWeeklyChecklistCount(0);
      }
    };
    
    fetchChecklistData();
  }, [user, isClient]);
  
  // Fetch ticket stats
  useEffect(() => {
    const fetchTicketStats = async () => {
      if (!user || !isClient) return;
      
      try {
        const token = localStorage.getItem('clubos_token');
        const response = await axios.get(`${API_URL}/tickets/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success && response.data.data) {
          const stats = response.data.data;
          // Get open tickets by category
          const techOpen = stats.byCategory.tech - 
            (stats.byStatus.resolved || 0) - 
            (stats.byStatus.closed || 0);
          const facilitiesOpen = stats.byCategory.facilities - 
            (stats.byStatus.resolved || 0) - 
            (stats.byStatus.closed || 0);
          
          // Actually, let's get the correct open counts
          const tickets = await axios.get(`${API_URL}/tickets?status=open`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (tickets.data.success && tickets.data.data) {
            const openTickets = tickets.data.data;
            setTechTicketsOpen(openTickets.filter((t: any) => t.category === 'tech').length);
            setFacilitiesTicketsOpen(openTickets.filter((t: any) => t.category === 'facilities').length);
          }
        }
      } catch (error) {
        console.error('Failed to fetch ticket stats:', error);
        setTechTicketsOpen(0);
        setFacilitiesTicketsOpen(0);
      }
    };
    
    fetchTicketStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTicketStats, 30000);
    return () => clearInterval(interval);
  }, [user, isClient]);
  
  // Auto-refresh stats every 30 seconds - DISABLED
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     window.location.reload();
  //   }, 30000);
  //   
  //   return () => clearInterval(interval);
  // }, []);

  // Calculate today's requests (with null safety)
  const todayRequests = stats?.totalRequests || 0;
  
  // Calculate change from previous period
  const previousRequests = previousStats?.totalRequests || 0;
  const requestDiff = todayRequests - previousRequests;
  const requestChange = requestDiff > 0 ? `+${requestDiff}` : requestDiff < 0 ? `${requestDiff}` : '0';
  const requestTrend = requestDiff > 0 ? 'up' : requestDiff < 0 ? 'down' : 'neutral';
  
  // Format average response time
  const avgResponseSeconds = stats?.avgResponseTime ? (stats.avgResponseTime / 1000).toFixed(1) : '0.0';
  const prevAvgResponseSeconds = previousStats?.avgResponseTime ? (previousStats.avgResponseTime / 1000).toFixed(1) : '0.0';
  
  // Calculate response time change
  const responseDiff = stats?.avgResponseTime && previousStats?.avgResponseTime 
    ? ((stats.avgResponseTime - previousStats.avgResponseTime) / 1000).toFixed(1)
    : '0.0';
  const responseChange = parseFloat(responseDiff) > 0 ? `+${responseDiff}s` : `${responseDiff}s`;
  const responseTrend = parseFloat(responseDiff) < 0 ? 'down' : parseFloat(responseDiff) > 0 ? 'up' : 'neutral';

  // Only create quickStats after client-side hydration to prevent mismatches
  const quickStats: QuickStat[] = !isClient ? [] : [
    { 
      label: 'Weekly Checklists', 
      value: weeklyChecklistCount.toString(), 
      change: '', 
      trend: 'neutral' as const,
      isButton: true,
      onClick: () => router.push('/checklists'),
      buttonText: 'Go to Checklists'
    },
    { 
      label: 'Requests Today', 
      value: todayRequests.toString(), 
      change: requestChange, 
      trend: requestTrend as any
    },
    { 
      label: 'Tech Tickets', 
      value: techTicketsOpen.toString(), 
      change: '', 
      trend: techTicketsOpen > 5 ? 'down' : 'neutral' as any,
      isButton: true,
      onClick: () => router.push('/tickets?category=tech&status=open'),
      buttonText: 'View Tech Tickets'
    },
    { 
      label: 'Facilities', 
      value: facilitiesTicketsOpen.toString(), 
      change: '', 
      trend: facilitiesTicketsOpen > 5 ? 'down' : 'neutral' as any,
      isButton: true,
      onClick: () => router.push('/tickets?category=facilities&status=open'),
      buttonText: 'View Facilities'
    }
  ];

  return (
    <>
      <Head>
        <title>ClubOS - Golf Simulator Management</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
        <meta name="deploy-version" content="2024-11-26-hydration-fix" />
      </Head>
      
      <main className="min-h-screen bg-[var(--bg-primary)] pb-12">
        <div className="container mx-auto px-4 py-2 md:py-3 lg:py-4">
          {/* Main Content Grid - Optimized for no-scroll */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
            {/* Request Form - Takes up 8 columns on large screens */}
            <div className="lg:col-span-8">
              <RequestForm />
              
              {/* Desktop-only enhancements */}
              <MiniInsightsPanel />
              <SuggestedActions />
            </div>
            
            {/* Sidebar - Contains Quick Stats and External Tools - 4 columns */}
            <div className="lg:col-span-4">
              <DatabaseExternalTools quickStats={quickStats} />
            </div>
          </div>
        </div>
        
        {/* Command Shortcut Bar - Desktop only */}
        <CommandShortcutBar />
      </main>
    </>
  );
}