import { useEffect, useState } from 'react';
import logger from '@/services/logger';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import BookingCalendar from '@/components/booking/calendar/BookingCalendar';
import BookingCalendarCompact from '@/components/booking/calendar/BookingCalendarCompact';
import BookingListView from '@/components/booking/BookingListView';
import TieredBookingForm from '@/components/booking/forms/TieredBookingForm';
import UnifiedBookingCard from '@/components/booking/unified/UnifiedBookingCard';
import AdminBlockOff from '@/components/booking/calendar/AdminBlockOff';
import Head from 'next/head';
import { Calendar, ExternalLink, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CustomerSearchModal from '@/components/booking/CustomerSearchModal';
import { useNotifications } from '@/state/hooks';

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
  const [refreshKey, setRefreshKey] = useState(0); // For calendar refresh without page reload
  const [locationSpaces, setLocationSpaces] = useState<any[]>([]); // Store fetched spaces

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
      // Fetch spaces for the default location when admin
      if (isAdmin) {
        fetchSpacesForLocation();
      }
    }
  }, [user, router]);

  // Fetch spaces when admin opens block modal
  const fetchSpacesForLocation = async (locationId?: string) => {
    try {
      const { http } = await import('@/api/http');
      const response = await http.get('/bookings/spaces', {
        params: { locationId: locationId || '1' } // Default to location 1
      });
      setLocationSpaces(response.data.data || []);
    } catch (error) {
      logger.error('Failed to fetch spaces', error);
      // Fallback to some default spaces if fetch fails
      setLocationSpaces([
        { id: '1', name: 'Simulator 1', locationId: '1', displayOrder: 1, isActive: true },
        { id: '2', name: 'Simulator 2', locationId: '1', displayOrder: 2, isActive: true },
      ]);
    }
  };

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
        <main className={isCustomer ? 'pb-24 lg:pb-8 lg:pt-14' : 'pt-4'}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            {/* View and toggle controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
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
                      }}
                    >
                      Create Booking
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowCustomerSearch(true);
                      }}
                    >
                      Search Customer
                    </Button>
                    {isAdmin && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            await fetchSpacesForLocation(); // Fetch fresh spaces
                            setShowAdminBlock(true);
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
                notify('success', `Booking created successfully! ID: ${result.id || 'New'}`);
                setShowCreateBooking(false);
                setSelectedTimeSlot({}); // Clear selection after success
                // Refresh the calendar without page reload
                setRefreshKey(prev => prev + 1);
              }}
              onCancel={() => {
                setShowCreateBooking(false);
                setSelectedTimeSlot({}); // Clear selection on cancel
              }}
              defaultMode={isAdmin ? 'booking' : 'booking'}
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

      {showAdminBlock && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
          <div className="max-w-2xl w-full mx-4">
            <AdminBlockOff
              initialStartTime={selectedTimeSlot.startTime}
              initialEndTime={selectedTimeSlot.endTime}
              initialSpaceId={selectedTimeSlot.spaceId}
              spaces={locationSpaces.length > 0 ? locationSpaces : [
                { id: '1', name: 'Simulator 1', locationId: '1', displayOrder: 1, isActive: true },
                { id: '2', name: 'Simulator 2', locationId: '1', displayOrder: 2, isActive: true },
              ]} // Use fetched spaces or minimal fallback
              onBlock={async (blockData) => {
                // Block will be created via API in AdminBlockOff component
                notify('success', `Time slots blocked: ${blockData.reason}`);
                setShowAdminBlock(false);
                setSelectedTimeSlot({}); // Clear selection after block
                // Refresh calendar without page reload
                setRefreshKey(prev => prev + 1);
              }}
              onCancel={() => {
                setShowAdminBlock(false);
                setSelectedTimeSlot({}); // Clear selection on cancel
              }}
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