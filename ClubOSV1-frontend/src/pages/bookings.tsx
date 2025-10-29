import { useEffect, useState, lazy, Suspense } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import BookingCalendar from '@/components/booking/calendar/BookingCalendar';
import BookingCalendarCompact from '@/components/booking/calendar/BookingCalendarCompact';
import BookingListView from '@/components/booking/BookingListView';
import { Calendar, ExternalLink, X, Plus, Search, Ban, Wrench, List, MapPin, ChevronDown, CalendarDays } from 'lucide-react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useNotifications } from '@/state/hooks';
import logger from '@/utils/logger';
import SubNavigation, { SubNavTab, SubNavAction } from '@/components/SubNavigation';
import OperatorLayout from '@/components/OperatorLayout';
import { BookingConfigService } from '@/services/booking/bookingConfig';
import { http } from '@/api/http';
import ClubOSBookingModal from '@/components/booking/ClubOSBookingModal';

// Lazy load modals for better performance
const CustomerSearchModal = lazy(() => import('@/components/booking/CustomerSearchModal'));

export default function Bookings() {
  const router = useRouter();
  const { user } = useAuthState();
  const { notify } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [showLegacySystem, setShowLegacySystem] = useState(false);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [showCreateBooking, setShowCreateBooking] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // For calendar refresh without page reload

  // Location and tier state for SubNavigation
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [customerTiers, setCustomerTiers] = useState<any[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [calendarViewMode, setCalendarViewMode] = useState<'day' | 'week'>('day');

  // Store selected time slot data for pre-population
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{
    startTime?: Date;
    endTime?: Date;
    spaceId?: string;
    spaceName?: string;
    locationId?: string;
    locationName?: string;
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
      // Load locations and tiers for SubNavigation
      loadInitialData();
    }
  }, [user, router]);

  // Debug: Log when state changes
  useEffect(() => {
    console.log('[State Update] showCreateBooking:', showCreateBooking);
    console.log('[State Update] selectedTimeSlot:', selectedTimeSlot);
    console.log('[State Update] Has keys?:', Object.keys(selectedTimeSlot).length > 0);
  }, [showCreateBooking, selectedTimeSlot]);

  const loadInitialData = async () => {
    try {
      const [tiersData, locationsData] = await Promise.all([
        BookingConfigService.getCustomerTiers(),
        http.get('/bookings/locations')
      ]);

      setCustomerTiers(tiersData);
      const loadedLocations = locationsData.data.data || [];
      setLocations(loadedLocations);

      // Set first location as default if none selected
      if (!selectedLocationId && loadedLocations.length > 0) {
        setSelectedLocationId(loadedLocations[0].id);
      }
    } catch (error) {
      logger.error('Failed to load booking data', error);
    }
  };

  // Handle when a time slot is clicked on the calendar
  const handleTimeSlotClick = (bookingOrStartTime: any, endTime?: Date, spaceId?: string, spaceName?: string) => {
    console.log('[handleTimeSlotClick] Called with:', {
      bookingOrStartTime,
      endTime,
      spaceId,
      spaceName,
      isDate: bookingOrStartTime instanceof Date,
      hasStartTime: bookingOrStartTime?.startTime,
      hasEndTime: bookingOrStartTime?.endTime
    });

    // First check if it's an object with startTime/endTime (from BookingCalendar)
    // This must come before the Date check because BookingCalendar sends an object
    if (bookingOrStartTime && typeof bookingOrStartTime === 'object' && !(bookingOrStartTime instanceof Date)) {
      if (bookingOrStartTime.startTime && bookingOrStartTime.endTime) {
        // Time slot click from BookingCalendar - it sends an object with Date properties
        const timeSlot = {
          startTime: bookingOrStartTime.startTime,
          endTime: bookingOrStartTime.endTime,
          spaceId: bookingOrStartTime.spaceId,
          spaceName: bookingOrStartTime.spaceName,
          locationId: bookingOrStartTime.locationId || selectedLocationId,
          locationName: locations.find(l => l.id === (bookingOrStartTime.locationId || selectedLocationId))?.name
        };
        console.log('[handleTimeSlotClick] Setting time slot (BookingCalendar object):', timeSlot);
        setSelectedTimeSlot(timeSlot);
        setShowCreateBooking(true);
      } else if (bookingOrStartTime.id) {
        // This is an actual booking confirmation
        notify('success', `Booking confirmed! ID: ${bookingOrStartTime.id}`);
      }
    } else if (bookingOrStartTime instanceof Date && endTime) {
      // This is from DayGrid/WeekGrid direct call - time slot click with separate Date parameters
      const timeSlot = {
        startTime: bookingOrStartTime,
        endTime: endTime,
        spaceId: spaceId,
        spaceName: spaceName,
        locationId: selectedLocationId,
        locationName: locations.find(l => l.id === selectedLocationId)?.name
      };
      console.log('[handleTimeSlotClick] Setting time slot (Direct Date params):', timeSlot);
      setSelectedTimeSlot(timeSlot);
      setShowCreateBooking(true);
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
    locationId: selectedLocationId,
    viewMode: calendarViewMode, // Pass view mode from parent
    onBookingCreate: handleTimeSlotClick,
    showColorLegend: false, // Removed entirely
    allowAdminBlock: false, // Handled in SubNavigation now
    showAllBookings: isStaff, // Staff see all bookings
    showCustomerInfo: isStaff, // Display customer details
    allowTierOverride: isAdmin, // Admin can change tiers
    editAnyBooking: isStaff && !isSupport, // Edit any booking (not support)
    showAnalytics: isStaff, // Show analytics panel
  };

  // No tabs needed - using toggle button instead
  const tabs: SubNavTab[] = [];

  // Define actions for SubNavigation
  const actions: SubNavAction[] = showLegacySystem ? [] : [
    // View toggle button - shows opposite of current view
    {
      id: 'toggle-view',
      label: view === 'calendar' ? 'List View' : 'Calendar',
      icon: view === 'calendar' ? List : Calendar,
      onClick: () => setView(view === 'calendar' ? 'list' : 'calendar'),
      variant: 'secondary'
    },
    {
      id: 'create-booking',
      label: 'Create',
      icon: Plus,
      onClick: () => {
        // Open booking modal directly with smart defaults
        setShowCreateBooking(true);
      },
      variant: 'primary',
      hideOnMobile: true
    }
  ];

  // Define secondary actions for SubNavigation
  const secondaryActions: SubNavAction[] = [
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      onClick: () => setShowCustomerSearch(true),
      hideOnMobile: true
    },
  ];

  // Simplified content - location selector and day/week toggle in main nav row
  const topRowContent = null; // Removed - everything in single row now

  // For customers, just render the content directly without operator layout
  if (isCustomer) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] customer-app">
        <main className="pb-24 lg:pb-8 lg:pt-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <CalendarComponent key={refreshKey} {...calendarProps} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <OperatorLayout
      title={isStaff ? 'Booking Management - ClubOS' : 'Book a Simulator - ClubOS'}
      description="Manage facility bookings and reservations"
      padding={showLegacySystem ? 'md' : 'none'} // No padding when using calendar for maximum space
      subNavigation={
        isStaff ? (
          <SubNavigation
            tabs={tabs}
            activeTab={view}
            onTabChange={(tabId) => setView(tabId as 'calendar' | 'list')}
            actions={[...actions, ...secondaryActions]}
            topRowContent={topRowContent}
            compactMode={true} // Use compact mode for more calendar space
            rightContent={
              <div className="flex items-center gap-2">
                {/* Location Selector */}
                {view === 'calendar' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                      className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="font-medium">
                        {locations.find(l => l.id === selectedLocationId)?.name || 'Location'}
                      </span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showLocationDropdown && (
                      <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[150px]">
                        {locations.map(location => (
                          <button
                            key={location.id}
                            onClick={() => {
                              setSelectedLocationId(location.id);
                              setShowLocationDropdown(false);
                              setRefreshKey(prev => prev + 1);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${
                              selectedLocationId === location.id ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : ''
                            }`}
                          >
                            {location.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Day/Week Toggle for Calendar View */}
                {view === 'calendar' && (
                  <div className="flex bg-gray-100 rounded-md p-0.5">
                    <button
                      onClick={() => setCalendarViewMode('day')}
                      className={`px-2 py-1 text-sm rounded transition-colors ${
                        calendarViewMode === 'day'
                          ? 'bg-white text-[var(--accent)] shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => setCalendarViewMode('week')}
                      className={`px-2 py-1 text-sm rounded transition-colors ${
                        calendarViewMode === 'week'
                          ? 'bg-white text-[var(--accent)] shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Week
                    </button>
                  </div>
                )}

                {/* Legacy System Toggle */}
                <div className="border-l border-gray-200 pl-2 ml-1">
                  <button
                    onClick={() => setShowLegacySystem(!showLegacySystem)}
                    className="flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-all text-xs font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{showLegacySystem ? 'ClubOS' : 'Skedda'}</span>
                  </button>
                </div>
              </div>
            }
          />
        ) : null}
    >
      {showLegacySystem ? (
        /* Legacy Skedda System - Full screen for maximum space */
        <iframe
          src="https://clubhouse247golf.skedda.com/booking"
          title="Clubhouse Golf Booking System"
          className="w-full"
          style={{
            height: isStaff ? 'calc(100vh - 120px)' : 'calc(100vh - 64px)', // Account for nav + sub-nav height
            border: 'none',
            minHeight: '600px'
          }}
          allow="payment; fullscreen; camera; microphone; geolocation"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-popups-to-escape-sandbox allow-top-navigation"
        />
      ) : view === 'calendar' ? (
        /* ClubOS Booking System - Maximized calendar space */
        <CalendarComponent key={refreshKey} {...calendarProps} />
      ) : (
        /* List view - Full booking management table */
        <BookingListView />
      )}

      {/* Modals */}
      {showCreateBooking && (
        <ClubOSBookingModal
          isOpen={showCreateBooking}
          onClose={() => {
            setShowCreateBooking(false);
            setSelectedTimeSlot({}); // Clear selection on close
          }}
          bookingData={{
            // Use selected time slot if available, otherwise use smart defaults
            startTime: selectedTimeSlot.startTime || (() => {
              const now = new Date();
              const nextHour = new Date(now);
              nextHour.setHours(now.getHours() + 1, 0, 0, 0);
              return nextHour;
            })(),
            endTime: selectedTimeSlot.endTime || (() => {
              const now = new Date();
              const nextHour = new Date(now);
              nextHour.setHours(now.getHours() + 2, 0, 0, 0); // 1 hour duration default
              return nextHour;
            })(),
            spaceId: selectedTimeSlot.spaceId || '',
            spaceName: selectedTimeSlot.spaceName || 'Box 1',
            locationId: selectedTimeSlot.locationId || selectedLocationId,
            locationName: selectedTimeSlot.locationName || locations.find(l => l.id === selectedLocationId)?.name || 'Bedford'
          }}
          onSuccess={(result) => {
            setShowCreateBooking(false);
            setSelectedTimeSlot({}); // Clear selection after success
            // Refresh the calendar without page reload
            setRefreshKey(prev => prev + 1);
          }}
        />
      )}

      {showCustomerSearch && (
        <Suspense fallback={<LoadingSpinner />}>
          <CustomerSearchModal
          isOpen={showCustomerSearch}
          onClose={() => setShowCustomerSearch(false)}
          onSelectCustomer={(customer) => {
            notify('success', `Selected customer: ${customer.name}`);
            setShowCustomerSearch(false);
            // TODO: Open booking form with customer pre-filled
          }}
        />
        </Suspense>
      )}
    </OperatorLayout>
  );
}