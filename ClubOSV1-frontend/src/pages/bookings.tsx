import { useEffect, useState, lazy, Suspense } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import BookingCalendar from '@/components/booking/calendar/BookingCalendar';
import BookingCalendarCompact from '@/components/booking/calendar/BookingCalendarCompact';
import BookingListView from '@/components/booking/BookingListView';
import { Calendar, ExternalLink, X, Plus, Search, Ban, Wrench, List, MapPin, ChevronDown } from 'lucide-react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useNotifications } from '@/state/hooks';
import { BookingMode } from '@/components/booking/unified/UnifiedBookingCard';
import SubNavigation, { SubNavTab, SubNavAction } from '@/components/SubNavigation';
import OperatorLayout from '@/components/OperatorLayout';
import { BookingConfigService } from '@/services/booking/bookingConfig';
import { http } from '@/api/http';

// Lazy load modals for better performance
const UnifiedBookingCard = lazy(() => import('@/components/booking/unified/UnifiedBookingCard'));
const CustomerSearchModal = lazy(() => import('@/components/booking/CustomerSearchModal'));

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

  // Location and tier state for SubNavigation
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [customerTiers, setCustomerTiers] = useState<any[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

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
      // Load locations and tiers for SubNavigation
      loadInitialData();
    }
  }, [user, router]);

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
      console.error('Failed to load booking data:', error);
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
    locationId: selectedLocationId,
    onBookingCreate: handleTimeSlotClick,
    showColorLegend: false, // Now handled in SubNavigation
    allowAdminBlock: isAdmin,
    showAllBookings: isStaff, // Staff see all bookings
    showCustomerInfo: isStaff, // Display customer details
    allowTierOverride: isAdmin, // Admin can change tiers
    editAnyBooking: isStaff && !isSupport, // Edit any booking (not support)
    showAnalytics: isStaff, // Show analytics panel
  };

  // Define tabs for SubNavigation
  const tabs: SubNavTab[] = showLegacySystem ? [] : [
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'list', label: 'List View', icon: List },
  ];

  // Define actions for SubNavigation
  const actions: SubNavAction[] = showLegacySystem ? [] : [
    {
      id: 'create-booking',
      label: 'Create Booking',
      icon: Plus,
      onClick: () => {
        setBookingMode('booking');
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
    ...(isAdmin ? [
      {
        id: 'block',
        label: 'Block',
        icon: Ban,
        onClick: () => {
          setBookingMode('block');
          setShowCreateBooking(true);
        },
        hideOnMobile: true
      },
      {
        id: 'maintenance',
        label: 'Maintenance',
        icon: Wrench,
        onClick: () => {
          setBookingMode('maintenance');
          setShowCreateBooking(true);
        },
        hideOnMobile: true
      }
    ] as SubNavAction[] : [])
  ];

  // Create the top row content with location selector and color legend
  const topRowContent = !showLegacySystem && isStaff ? (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
      {/* Location Selector */}
      <div className="relative">
        <button
          onClick={() => setShowLocationDropdown(!showLocationDropdown)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
        >
          <MapPin className="w-4 h-4 text-gray-600" />
          <span className="font-medium">
            {selectedLocationId ? locations.find(l => l.id === selectedLocationId)?.name || 'Select Location' : 'Select Location'}
          </span>
          <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Location Dropdown */}
        {showLocationDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px]">
            {locations.map(location => (
              <button
                key={location.id}
                onClick={() => {
                  setSelectedLocationId(location.id);
                  setShowLocationDropdown(false);
                  setRefreshKey(prev => prev + 1);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  selectedLocationId === location.id ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : ''
                }`}
              >
                {location.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Color Legend as Inline Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {customerTiers.map(tier => (
          <div
            key={tier.id}
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-full"
          >
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: tier.color }}
            />
            <span className="text-xs font-medium text-gray-700">
              {tier.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

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
              <div className="border-l border-gray-200 pl-2 ml-2">
                <button
                  onClick={() => setShowLegacySystem(!showLegacySystem)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-all text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">{showLegacySystem ? 'Use ClubOS' : 'Use Legacy Skedda'}</span>
                </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn p-4">
          <div className="max-h-[90vh] overflow-y-auto w-full max-w-5xl">
            <Suspense fallback={<LoadingSpinner />}>
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
            </Suspense>
          </div>
        </div>
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