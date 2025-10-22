import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import BookingCalendar from '@/components/booking/calendar/BookingCalendar';
import BookingCalendarCompact from '@/components/booking/calendar/BookingCalendarCompact';
import BookingListView from '@/components/booking/BookingListView';
import UnifiedBookingCard from '@/components/booking/unified/UnifiedBookingCard';
import Head from 'next/head';
import { Calendar, ExternalLink, X, Plus, Search, Ban, Wrench, List } from 'lucide-react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CustomerSearchModal from '@/components/booking/CustomerSearchModal';
import { useNotifications } from '@/state/hooks';
import { BookingMode } from '@/components/booking/unified/UnifiedBookingCard';

export default function Bookings() {
  const router = useRouter();
  const { user } = useAuthState();
  const { notify } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [showLegacySystem, setShowLegacySystem] = useState(true);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // For calendar refresh without page reload
  const [bookingMode, setBookingMode] = useState<BookingMode>('booking'); // Track which mode to open

  // Store selected time slot data for pre-population
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{
    startTime?: Date;
    endTime?: Date;
    spaceId?: string;
    spaceName?: string;
  }>({});

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
    }
  }, [user, router]);

  // Handle when a time slot is clicked on the calendar
  const handleTimeSlotClick = (bookingOrStartTime: any, endTime?: Date, spaceId?: string, spaceName?: string) => {
    // Check if this is from DayGrid/WeekGrid (separate params) or BookingCalendar (booking object)
    if (bookingOrStartTime instanceof Date && endTime) {
      // This is from DayGrid/WeekGrid - time slot click with separate parameters
      setSelectedTimeSlot({
        startTime: bookingOrStartTime,
        endTime: endTime,
        spaceId: spaceId,
        spaceName: spaceName
      });
      setBookingMode('booking'); // Default to booking mode when clicking time slot
      setShowCreateBooking(true);
    } else if (bookingOrStartTime && typeof bookingOrStartTime === 'object') {
      // This is from BookingCalendar - booking object
      if (bookingOrStartTime.startTime && bookingOrStartTime.endTime) {
        // Time slot click from calendar
        setSelectedTimeSlot({
          startTime: bookingOrStartTime.startTime,
          endTime: bookingOrStartTime.endTime,
          spaceId: bookingOrStartTime.spaceId,
          spaceName: bookingOrStartTime.spaceName
        });
        setBookingMode('booking'); // Default to booking mode when clicking time slot
        setShowCreateBooking(true);
      } else if (bookingOrStartTime.id) {
        // This is an actual booking confirmation
        notify('success', `Booking confirmed! ID: ${bookingOrStartTime.id}`);
      }
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
    onBookingCreate: handleTimeSlotClick,
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
        {/* Sub Navigation - Operations Style (only for staff) */}
        {isStaff && !showLegacySystem && (
          <div className="bg-white border-b border-gray-200">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="max-w-7xl mx-auto">
                <nav className="flex justify-between items-center">
                  {/* View Tabs */}
                  <div className="flex space-x-1 sm:space-x-4 overflow-x-auto pb-px">
                    <button
                      onClick={() => setView('calendar')}
                      className={`
                        flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                        ${view === 'calendar'
                          ? 'border-[var(--accent)] text-[var(--accent)]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }
                      `}
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Calendar</span>
                    </button>
                    <button
                      onClick={() => setView('list')}
                      className={`
                        flex items-center space-x-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                        ${view === 'list'
                          ? 'border-[var(--accent)] text-[var(--accent)]'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }
                      `}
                    >
                      <List className="w-4 h-4" />
                      <span>List View</span>
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 py-2">
                    <button
                      onClick={() => {
                        setBookingMode('booking');
                        setShowCreateBooking(true);
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-[var(--accent)] text-white rounded-md hover:bg-opacity-90 transition-all text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Create Booking</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowCustomerSearch(true);
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-all text-sm font-medium"
                    >
                      <Search className="w-4 h-4" />
                      <span className="hidden sm:inline">Search</span>
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => {
                            setBookingMode('block');
                            setShowCreateBooking(true);
                          }}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-all text-sm font-medium"
                        >
                          <Ban className="w-4 h-4" />
                          <span className="hidden sm:inline">Block</span>
                        </button>
                        <button
                          onClick={() => {
                            setBookingMode('maintenance');
                            setShowCreateBooking(true);
                          }}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-all text-sm font-medium"
                        >
                          <Wrench className="w-4 h-4" />
                          <span className="hidden sm:inline">Maintenance</span>
                        </button>
                      </>
                    )}
                  </div>
                </nav>
              </div>
            </div>
          </div>
        )}

        <main className={isCustomer ? 'pb-24 lg:pb-8 lg:pt-14' : 'pt-4'}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            {/* Legacy system toggle */}
            <div className="flex justify-end mb-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowLegacySystem(!showLegacySystem)}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                {showLegacySystem ? 'Use ClubOS' : 'Use Legacy Skedda'}
              </Button>
            </div>


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
                {/* Calendar Component - Adjusts based on role */}
                <CalendarComponent key={refreshKey} {...calendarProps} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn p-4">
          <div className="max-h-[90vh] overflow-y-auto w-full max-w-5xl">
            <UnifiedBookingCard
              initialStartTime={selectedTimeSlot.startTime}
              initialEndTime={selectedTimeSlot.endTime}
              initialSpaceId={selectedTimeSlot.spaceId}
              initialSpaceName={selectedTimeSlot.spaceName}
              onSuccess={(result) => {
                const successMessage = bookingMode === 'block'
                  ? `Time blocked successfully!`
                  : bookingMode === 'maintenance'
                  ? `Maintenance scheduled successfully!`
                  : `Booking created successfully! ID: ${result.id || 'New'}`;
                notify('success', successMessage);
                setShowCreateBooking(false);
                setSelectedTimeSlot({}); // Clear selection after success
                setBookingMode('booking'); // Reset to default mode
                // Refresh the calendar without page reload
                setRefreshKey(prev => prev + 1);
              }}
              onCancel={() => {
                setShowCreateBooking(false);
                setSelectedTimeSlot({}); // Clear selection on cancel
                setBookingMode('booking'); // Reset to default mode
              }}
              defaultMode={bookingMode}
              allowModeSwitch={isStaff}
            />
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

    </>
  );
}