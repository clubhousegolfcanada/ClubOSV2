import Head from 'next/head';
import RequestForm from '@/components/RequestForm';
import DatabaseExternalTools from '@/components/DatabaseExternalTools';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useDemoMode, useAnalytics } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { hasMinimumRole } from '@/utils/roleUtils';
import { enforceOperatorRouteGuard } from '@/utils/customerRouteGuard';
import { useRouter } from 'next/router';
import { http } from '@/api/http';
import { MiniInsightsPanel } from '@/components/dashboard/MiniInsightsPanel';
import { SuggestedActions } from '@/components/dashboard/SuggestedActions';
import { CommandShortcutBar } from '@/components/dashboard/CommandShortcutBar';
import { RecentCustomers } from '@/components/dashboard/RecentCustomers';
import MessagesCardV3 from '@/components/dashboard/MessagesCardV3';
import OccupancyMap from '@/components/dashboard/OccupancyMap';
import { tokenManager } from '@/utils/tokenManager';


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
  const [authError, setAuthError] = useState(false);
  const ticketIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // SECURITY: Enforce operator-only access with whitelist approach
  useEffect(() => {
    // Add small delay to let auth state settle
    const checkAuth = setTimeout(() => {
      enforceOperatorRouteGuard(user, router, ['admin', 'operator', 'support', 'kiosk']);
    }, 100);
    
    return () => clearTimeout(checkAuth);
  }, [user, router]);
  
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
      
      // Check if we just logged in - if so, wait a bit
      const loginTimestamp = sessionStorage.getItem('clubos_login_timestamp');
      if (loginTimestamp && (Date.now() - parseInt(loginTimestamp) < 1000)) {
        // Wait 500ms more if we just logged in
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      try {
        // For 24h period, get yesterday's data
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const token = tokenManager.getToken();
        // Don't make the call if no token
        if (!token) {
          console.log('No token available, skipping stats fetch');
          setPreviousStats({
            totalRequests: 0,
            averageConfidence: 0,
            totalBookings: 0
          });
          return;
        }
        
        const response = await http.get(`history/stats/overview`, {
          params: { 
            period: '24h',
            endDate: yesterday.toISOString()
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success && response.data.data) {
          setPreviousStats(response.data.data);
        }
      } catch (error: any) {
        console.error('Failed to fetch previous stats:', error);
        // Don't log out on 401 if we just logged in
        if (error.response?.status === 401) {
          const loginTimestamp = sessionStorage.getItem('clubos_login_timestamp');
          if (!loginTimestamp || (Date.now() - parseInt(loginTimestamp) > 5000)) {
            console.log('Token appears invalid after grace period');
            setAuthError(true);
          }
        }
        // Set empty stats to prevent crash
        setPreviousStats({
          totalRequests: 0,
          averageConfidence: 0,
          totalBookings: 0
        });
      }
    };
    
    // Delay initial fetch slightly
    const timeoutId = setTimeout(fetchPreviousPeriod, 200);
    
    return () => clearTimeout(timeoutId);
  }, [user, isClient]);
  
  // Fetch weekly checklist submissions
  useEffect(() => {
    const fetchChecklistData = async () => {
      if (!user || !isClient || authError) return;
      
      try {
        const token = tokenManager.getToken();
        if (!token) {
          setWeeklyChecklistCount(0);
          return;
        }
        
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        const response = await http.get(`checklists/submissions`, {
          params: { 
            startDate: startOfWeek.toISOString(),
            limit: 100
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data.success) {
          setWeeklyChecklistCount(response.data.data?.length || 0);
        }
      } catch (error: any) {
        console.error('Failed to fetch checklist data:', error);
        if (error.response?.status === 401) {
          setAuthError(true);
        }
        setWeeklyChecklistCount(0);
      }
    };
    
    if (!authError) {
      fetchChecklistData();
    }
  }, [user, isClient, authError]);
  
  // Fetch ticket stats
  useEffect(() => {
    const fetchTicketStats = async () => {
      if (!user || !isClient || authError) return;
      
      try {
        const token = tokenManager.getToken();
        if (!token) {
          setTechTicketsOpen(0);
          setFacilitiesTicketsOpen(0);
          return;
        }
        
        const response = await http.get(`tickets/stats`, {
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
          const tickets = await http.get(`tickets?status=open`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (tickets.data.success && tickets.data.data) {
            const openTickets = tickets.data.data;
            setTechTicketsOpen(openTickets.filter((t: any) => t.category === 'tech').length);
            setFacilitiesTicketsOpen(openTickets.filter((t: any) => t.category === 'facilities').length);
          }
        }
      } catch (error: any) {
        console.error('Failed to fetch ticket stats:', error);
        if (error.response?.status === 401) {
          setAuthError(true);
          // Clear the interval on auth error
          if (ticketIntervalRef.current) {
            clearInterval(ticketIntervalRef.current);
            ticketIntervalRef.current = null;
          }
        }
        setTechTicketsOpen(0);
        setFacilitiesTicketsOpen(0);
      }
    };
    
    if (!authError) {
      fetchTicketStats();
      // Refresh every 30 seconds only if no auth error
      ticketIntervalRef.current = setInterval(fetchTicketStats, 30000);
    }
    
    return () => {
      if (ticketIntervalRef.current) {
        clearInterval(ticketIntervalRef.current);
        ticketIntervalRef.current = null;
      }
    };
  }, [user, isClient, authError]);
  
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
              
              {/* Messages Card - Desktop only */}
              <MessagesCardV3 />
              
              {/* Mobile-only recent customers */}
              <RecentCustomers />
              
              {/* Desktop-only enhancements */}
              <MiniInsightsPanel />
            </div>
            
            {/* Sidebar - Contains Quick Stats and External Tools - 4 columns */}
            <div className="lg:col-span-4">
              <DatabaseExternalTools quickStats={quickStats} />
              <OccupancyMap compact />
              <SuggestedActions />
            </div>
          </div>
        </div>
        
        {/* Command Shortcut Bar - Desktop only */}
        <CommandShortcutBar />
      </main>
    </>
  );
}