import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import Navigation from '@/components/Navigation';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import BookingCalendar from '@/components/booking/calendar/BookingCalendar';
import BookingCalendarCompact from '@/components/booking/calendar/BookingCalendarCompact';
import Head from 'next/head';
import { Calendar, MapPin, Clock, Info, ExternalLink, TrendingUp, Users, DollarSign, AlertCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';
import { format } from 'date-fns';

// Stats card component for operators
const StatCard = ({ title, value, icon: Icon, trend }: any) => (
  <div className="card p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-[var(--text-secondary)]">{title}</p>
        <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{value}</p>
        {trend && (
          <p className="text-xs text-[var(--status-success)] mt-1">
            <TrendingUp className="inline w-3 h-3" /> {trend}
          </p>
        )}
      </div>
      {Icon && <Icon className="w-8 h-8 text-[var(--text-muted)]" />}
    </div>
  </div>
);

export default function Bookings() {
  const router = useRouter();
  const { user } = useAuthState();
  const { notify } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [showLegacySystem, setShowLegacySystem] = useState(false);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [stats, setStats] = useState({
    todayCount: 0,
    todayRevenue: 0,
    occupancy: 0,
    pendingCount: 0
  });

  // Role-based checks
  const isCustomer = user?.role === 'customer';
  const isOperator = user?.role === 'operator';
  const isAdmin = user?.role === 'admin';
  const isSupport = user?.role === 'support';
  const isStaff = isAdmin || isOperator || isSupport;

  useEffect(() => {
    // Check authentication
    if (!user) {
      router.push('/login');
    } else {
      setLoading(false);
      if (isStaff) {
        loadStats();
      }
    }
  }, [user, router]);

  const loadStats = async () => {
    try {
      const response = await http.get('/bookings/stats', {
        params: {
          date: format(new Date(), 'yyyy-MM-dd')
        }
      });
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load booking stats:', error);
    }
  };

  const handleBookingSuccess = (booking: any) => {
    notify('success', `Booking confirmed! ID: ${booking.id}`);
    if (isStaff) {
      loadStats(); // Refresh stats for staff
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Determine which calendar component to use based on role and screen size
  const shouldUseCompactCalendar = isCustomer || (typeof window !== 'undefined' && window.innerWidth < 768);
  const CalendarComponent = shouldUseCompactCalendar ? BookingCalendarCompact : BookingCalendar;

  // Role-based calendar props
  const calendarProps = {
    onBookingCreate: handleBookingSuccess,
    showColorLegend: true,
    allowAdminBlock: isAdmin,
    showAllBookings: isStaff, // Staff see all bookings
    showCustomerInfo: isStaff, // Display customer details
    allowTierOverride: isAdmin, // Admin can change tiers
    editAnyBooking: isStaff && !isSupport, // Edit any booking (not support)
    showAnalytics: isStaff, // Show analytics panel
  };

  return (
    <>
      <Head>
        <title>{isStaff ? 'Booking Management' : 'Book a Simulator'} - ClubOS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

      <div className={`min-h-screen bg-[var(--bg-primary)] ${isCustomer ? 'customer-app' : ''}`}>
        {/* Use appropriate navigation based on role */}
        {isCustomer ? <CustomerNavigation /> : <Navigation />}

        <main className={isCustomer ? 'pb-24 lg:pb-8 lg:pt-14' : 'pt-16'}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Header with toggle - enhanced for operators */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                  {isStaff ? 'Booking Management' : 'Book a Simulator'}
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {isStaff
                    ? `Managing bookings across all Clubhouse 24/7 locations`
                    : 'Reserve your tee time at any Clubhouse 24/7 location'}
                </p>
              </div>
              <div className="flex gap-2">
                {/* View toggle for staff */}
                {isStaff && !showLegacySystem && (
                  <div className="flex gap-1 bg-[var(--bg-secondary)] rounded-lg p-1">
                    <Button
                      variant={view === 'calendar' ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setView('calendar')}
                    >
                      <Calendar className="w-4 h-4 mr-1" />
                      Calendar
                    </Button>
                    <Button
                      variant={view === 'list' ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => setView('list')}
                      disabled // List view to be implemented
                    >
                      List
                    </Button>
                  </div>
                )}

                {/* Legacy system toggle */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowLegacySystem(!showLegacySystem)}
                  className="self-start sm:self-center"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  {showLegacySystem ? 'Use ClubOS' : 'Use Legacy Skedda'}
                </Button>
              </div>
            </div>

            {/* Stats dashboard for staff */}
            {isStaff && !showLegacySystem && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  title="Today's Bookings"
                  value={stats.todayCount}
                  icon={Calendar}
                />
                <StatCard
                  title="Today's Revenue"
                  value={`$${stats.todayRevenue.toFixed(2)}`}
                  icon={DollarSign}
                  trend="+12% from yesterday"
                />
                <StatCard
                  title="Occupancy Rate"
                  value={`${stats.occupancy}%`}
                  icon={Users}
                />
                <StatCard
                  title="Pending Actions"
                  value={stats.pendingCount}
                  icon={AlertCircle}
                />
              </div>
            )}

            {showLegacySystem ? (
              /* Legacy Skedda System - Same for all users */
              <div className="h-full">
                <iframe
                  src="https://clubhouse247golf.skedda.com/booking"
                  title="Clubhouse Golf Booking System"
                  className="w-full rounded-lg"
                  style={{
                    height: 'calc(100vh - 200px)',
                    border: 'none',
                    minHeight: '600px'
                  }}
                  allow="payment; fullscreen; camera; microphone; geolocation"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-popups-to-escape-sandbox allow-top-navigation"
                />
              </div>
            ) : view === 'calendar' ? (
              /* ClubOS Booking System - Role-based calendar */
              <div className="space-y-4">
                {/* Quick actions for staff */}
                {isStaff && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Button variant="primary" size="sm">
                      Create Booking
                    </Button>
                    <Button variant="secondary" size="sm">
                      Search Customer
                    </Button>
                    {isAdmin && (
                      <>
                        <Button variant="secondary" size="sm">
                          Block Time
                        </Button>
                        <Button variant="secondary" size="sm">
                          Bulk Actions
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Calendar Component - Adjusts based on role */}
                <CalendarComponent {...calendarProps} />
              </div>
            ) : (
              /* List view - To be implemented */
              <div className="card p-8 text-center">
                <p className="text-[var(--text-secondary)]">List view coming soon...</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}