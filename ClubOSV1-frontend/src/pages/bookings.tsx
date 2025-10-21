import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import Navigation from '@/components/Navigation';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import BookingCalendar from '@/components/booking/calendar/BookingCalendar';
import BookingCalendarCompact from '@/components/booking/calendar/BookingCalendarCompact';
import BookingListView from '@/components/booking/BookingListView';
import TieredBookingForm from '@/components/booking/forms/TieredBookingForm';
import AdminBlockOff from '@/components/booking/calendar/AdminBlockOff';
import Head from 'next/head';
import { Calendar, MapPin, Clock, Info, ExternalLink, TrendingUp, Users, DollarSign, AlertCircle, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CustomerSearchModal from '@/components/booking/CustomerSearchModal';
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
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showAdminBlock, setShowAdminBlock] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
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
          date: format(new Date(), 'yyyy-MM-dd'),
          locationId: 'all' // Can be filtered by location later
        }
      });
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load booking stats:', error);
      // Show user-friendly error message
      notify('error', 'Unable to load booking statistics. Please refresh the page.');
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
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setShowCreateBooking(true);
                        notify('info', 'Opening booking form...');
                      }}
                    >
                      Create Booking
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowCustomerSearch(true);
                        notify('info', 'Opening customer search...');
                      }}
                    >
                      Search Customer
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setShowAdminBlock(true);
                            notify('info', 'Opening admin block-off tool...');
                          }}
                        >
                          Block Time
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setShowBulkActions(true);
                            notify('info', 'Bulk actions coming soon!');
                          }}
                        >
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
              /* List view - Full booking management table */
              <BookingListView />
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {showCreateBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
          <div className="bg-[var(--bg-primary)] rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-primary)]">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Create New Booking</h2>
              <button
                onClick={() => setShowCreateBooking(false)}
                className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            {/* Modal Body with Booking Form */}
            <div className="flex-1 overflow-y-auto p-6">
              <TieredBookingForm
                onSuccess={(booking) => {
                  notify('success', `Booking created successfully! ID: ${booking.id}`);
                  setShowCreateBooking(false);
                  if (isStaff) {
                    loadStats(); // Refresh stats for staff
                  }
                }}
                onCancel={() => setShowCreateBooking(false)}
              />
            </div>
          </div>
        </div>
      )}

      {showCustomerSearch && (
        <CustomerSearchModal
          isOpen={showCustomerSearch}
          onClose={() => setShowCustomerSearch(false)}
          onSelectCustomer={(customer) => {
            notify('success', `Selected customer: ${customer.name}`);
            setShowCustomerSearch(false);
            // TODO: Open booking form with customer pre-filled
          }}
        />
      )}

      {showAdminBlock && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
          <div className="max-w-2xl w-full mx-4">
            <AdminBlockOff
              spaces={[
                { id: '1', name: 'Simulator 1', locationId: '1', displayOrder: 1, isActive: true },
                { id: '2', name: 'Simulator 2', locationId: '1', displayOrder: 2, isActive: true },
                { id: '3', name: 'Simulator 3', locationId: '1', displayOrder: 3, isActive: true },
                { id: '4', name: 'Simulator 4', locationId: '1', displayOrder: 4, isActive: true },
                { id: '5', name: 'Simulator 5', locationId: '1', displayOrder: 5, isActive: true },
                { id: '6', name: 'Simulator 6', locationId: '1', displayOrder: 6, isActive: true }
              ]} // TODO: Load actual spaces from location
              onBlock={async (blockData) => {
                // Block will be created via API in AdminBlockOff component
                notify('success', `Time slots blocked: ${blockData.reason}`);
                setShowAdminBlock(false);
                if (view === 'calendar') {
                  // Trigger calendar refresh if in calendar view
                  window.location.reload(); // TODO: Implement proper refresh
                }
              }}
              onCancel={() => setShowAdminBlock(false)}
            />
          </div>
        </div>
      )}

      {showBulkActions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--bg-primary)] rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Bulk Actions</h2>
            <p className="text-[var(--text-secondary)] mb-4">
              Bulk booking management features are coming soon!
            </p>
            <ul className="list-disc list-inside text-[var(--text-secondary)] mb-4">
              <li>Cancel multiple bookings</li>
              <li>Reschedule groups</li>
              <li>Send mass notifications</li>
              <li>Export booking data</li>
            </ul>
            <Button onClick={() => setShowBulkActions(false)}>Close</Button>
          </div>
        </div>
      )}
    </>
  );
}