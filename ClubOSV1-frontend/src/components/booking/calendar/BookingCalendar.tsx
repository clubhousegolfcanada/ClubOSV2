import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Clock, ChevronLeft, ChevronRight, Grid3X3, List, CalendarX } from 'lucide-react';
import { format, startOfDay, addDays, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import useSwipeGesture from '@/hooks/useSwipeGesture';
import { BookingConfigService, CustomerTier, BookingConfig } from '@/services/booking/bookingConfig';
import { TimeValidationService } from '@/services/booking/timeValidationService';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DayGrid from './DayGrid';
import WeekGrid from './WeekGrid';
import BoxInfoModal from '../BoxInfoModal';
import NewBookingModal from '../NewBookingModal';
import { CalendarSkeleton } from './CalendarSkeleton';
import logger from '@/services/logger';

export interface Booking {
  id: string;
  locationId: string;
  spaceIds: string[];
  userId?: string;
  customerTierId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  startAt: string;
  endAt: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  isAdminBlock: boolean;
  blockReason?: string;
  tierColor?: string;
  tierName?: string;
  spaces?: Array<{ id: string; name: string }>;
}

export interface Space {
  id: string;
  locationId: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface Location {
  id: string;
  name: string;
  city: string;
  isActive: boolean;
}

export interface BookingCalendarProps {
  locationId?: string;
  date?: Date;
  viewMode?: 'day' | 'week'; // Controlled from parent
  onBookingCreate?: (booking: Partial<Booking>) => void;
  onBookingSelect?: (booking: Booking) => void;
}

type ViewMode = 'day' | 'week';

const BookingCalendar: React.FC<BookingCalendarProps> = ({
  locationId: propLocationId,
  date: propDate,
  viewMode: propViewMode = 'day',
  onBookingCreate,
  onBookingSelect
}) => {
  const { notify } = useNotifications();
  const { user } = useAuthState();
  const isAdmin = user?.role === 'admin';
  const calendarRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // State
  const [selectedDate, setSelectedDate] = useState<Date>(propDate || new Date());
  const [selectedLocationId, setSelectedLocationId] = useState<string>(propLocationId || '');
  const viewMode = propViewMode; // Use prop instead of internal state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [customerTiers, setCustomerTiers] = useState<CustomerTier[]>([]);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [showBoxInfoModal, setShowBoxInfoModal] = useState(false);
  const [showNewBookingModal, setShowNewBookingModal] = useState(false);
  const [bookingFormData, setBookingFormData] = useState<any>(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load bookings when date or location changes
  useEffect(() => {
    if (config && locations.length > 0 && selectedLocationId) {
      loadBookings();
    }
  }, [selectedDate, selectedLocationId, viewMode, config, locations]);

  // Load spaces when location changes or locations are first loaded
  useEffect(() => {
    if (selectedLocationId && locations.length > 0) {
      logger.debug('[BookingCalendar] Loading spaces for location:', selectedLocationId);
      loadSpaces();
    }
  }, [selectedLocationId, locations]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      logger.debug('[BookingCalendar] Starting initial data load');

      // Load configuration and tiers
      const [configData, tiersData, locationsData] = await Promise.all([
        BookingConfigService.getConfig(),
        BookingConfigService.getCustomerTiers(),
        http.get('/bookings/locations')
      ]);

      setConfig(configData);
      setCustomerTiers(tiersData);
      const loadedLocations = locationsData.data.data || [];
      setLocations(loadedLocations);

      logger.debug('[BookingCalendar] Loaded locations:', loadedLocations.map((l: any) => ({ id: l.id, name: l.name })));

      // Set first location as default if no location is selected
      let locationToLoad: string = selectedLocationId || propLocationId || '';
      if (!locationToLoad && loadedLocations.length > 0) {
        locationToLoad = loadedLocations[0].id;
        logger.debug('[BookingCalendar] Setting default location:', locationToLoad);
        setSelectedLocationId(locationToLoad);
      }

      // Load spaces for the selected location immediately
      if (locationToLoad) {
        logger.debug('[BookingCalendar] Loading spaces for initial location:', locationToLoad);
        const spacesData = await http.get('/bookings/spaces', {
          params: { locationId: locationToLoad }
        });
        const loadedSpaces = spacesData.data.data || [];
        logger.debug('[BookingCalendar] Loaded spaces:', loadedSpaces.map((s: any) => ({ id: s.id, name: s.name })));
        setSpaces(loadedSpaces);

        // Also load bookings for the initial view
        if (loadedLocations.length > 0) {
          const dates = viewMode === 'week'
            ? getWeekDates(selectedDate)
            : [selectedDate];

          const bookingPromises = dates.map(date =>
            http.get('/bookings/day', {
              params: {
                date: format(date, 'yyyy-MM-dd'),
                locationId: locationToLoad
              }
            })
          );

          const results = await Promise.all(bookingPromises);
          const allBookings = results.flatMap(r => r.data.data || []);
          const bookingsWithColors = allBookings.map((booking: any) => ({
            ...booking,
            tierColor: tiersData.find((t: any) => t.id === booking.customerTierId)?.color || '#6B7280'
          }));
          setBookings(bookingsWithColors);
        }
      }
    } catch (error) {
      logger.error('Failed to load initial data:', error);
      notify('error', 'Failed to load booking data');
    } finally {
      setLoading(false);
    }
  };

  const loadSpaces = async () => {
    try {
      if (selectedLocationId) {
        logger.debug('[BookingCalendar] loadSpaces called for location:', selectedLocationId);
        const spacesData = await http.get('/bookings/spaces', {
          params: { locationId: selectedLocationId }
        });
        const loadedSpaces = spacesData.data.data || [];
        logger.debug(`[BookingCalendar] Spaces loaded: ${loadedSpaces.length} spaces`, { spaces: loadedSpaces.map((s: any) => s.name) });
        setSpaces(loadedSpaces);
      }
    } catch (error) {
      logger.error('Failed to load spaces:', error);
      notify('error', 'Failed to load spaces');
    }
  };

  const loadBookings = async () => {
    try {
      logger.debug(`[BookingCalendar] Loading bookings for date: ${format(selectedDate, 'yyyy-MM-dd')}`, { location: selectedLocationId });
      const dates = viewMode === 'week'
        ? getWeekDates(selectedDate)
        : [selectedDate];

      const bookingPromises = dates.map(date =>
        http.get('/bookings/day', {
          params: {
            date: format(date, 'yyyy-MM-dd'),
            locationId: selectedLocationId
          }
        })
      );

      const results = await Promise.all(bookingPromises);
      const allBookings = results.flatMap(r => r.data.data || []);
      logger.debug(`[BookingCalendar] Loaded bookings: ${allBookings.length} bookings`);

      // Add tier colors to bookings
      const bookingsWithColors = allBookings.map((booking: any) => ({
        ...booking,
        tierColor: customerTiers.find((t: CustomerTier) => t.id === booking.customerTierId)?.color || '#6B7280'
      }));

      setBookings(bookingsWithColors);
    } catch (error) {
      logger.error('Failed to load bookings:', error);
      notify('error', 'Failed to load bookings');
    }
  };

  const getWeekDates = (date: Date): Date[] => {
    const start = startOfWeek(date, { weekStartsOn: 0 }); // Sunday
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(start, i));
    }
    return dates;
  };

  // Navigation handlers
  const handlePrevious = () => {
    const newDate = viewMode === 'week'
      ? addDays(selectedDate, -7)
      : addDays(selectedDate, -1);
    setSelectedDate(newDate);
  };

  const handleNext = () => {
    const newDate = viewMode === 'week'
      ? addDays(selectedDate, 7)
      : addDays(selectedDate, 1);
    setSelectedDate(newDate);
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  // Swipe gesture handlers for mobile navigation
  useSwipeGesture(
    calendarRef,
    {
      onSwipeLeft: handleNext,
      onSwipeRight: handlePrevious,
      onPullEnd: async (distance) => {
        // Pull-to-refresh: reload if pulled > 100px
        if (distance > 100 && !isRefreshing) {
          setIsRefreshing(true);
          await loadBookings();
          setIsRefreshing(false);
          notify('success', 'Calendar refreshed');
        }
      }
    },
    {
      threshold: 50,
      velocity: 0.3,
      preventScroll: true,
      enablePullToRefresh: true
    }
  );

  // Modal handlers
  const handleSpaceClick = (space: Space) => {
    // Get box info from backend or use mock data
    const boxInfo = {
      id: space.id,
      name: space.name,
      location: locations.find(l => l.id === space.locationId)?.name || '',
      capacity: 4,
      equipment: {
        simulator: 'Trackman iO',
        projector: 'BenQ 936ST',
        tvs: '2x Club Data TVs',
        audio: 'In-wall audio',
        screen: '16\'x10\' impact screen'
      },
      image: undefined // Add image URLs when available
    };
    setSelectedSpace(boxInfo as any);
    setShowBoxInfoModal(true);
  };

  // Booking handlers
  const handleBookingCreate = useCallback((startTime: Date, endTime: Date, spaceId?: string, spaceName?: string) => {
    if (!config) return;

    // Get current user's tier (default to 'new' if not logged in)
    const currentUserTier = customerTiers.find(t => t.id === 'new') || { id: 'new' } as CustomerTier;
    const tierType = currentUserTier.id as 'new' | 'member' | 'promo' | 'frequent';

    // Validate booking with time validation service
    const validation = TimeValidationService.validateBooking(
      startTime,
      endTime,
      tierType,
      {
        minDuration: config.minDuration,
        maxDuration: config.maxDuration,
        incrementAfterFirst: config.incrementAfterFirst || 30
      }
    );

    if (!validation.isValid) {
      notify('error', validation.error || 'Invalid booking time');
      if (validation.suggestion) {
        notify('info', validation.suggestion);
      }
      return;
    }

    // Call parent's onBookingCreate callback if provided
    if (onBookingCreate) {
      // Create a partial booking object with the available data
      const partialBooking: Partial<Booking> = {
        startAt: startTime.toISOString(),
        endAt: endTime.toISOString(),
        spaceIds: spaceId ? [spaceId] : [],
        locationId: selectedLocationId,
        status: 'pending'
      };
      // Add extra data as properties for the parent to use
      (partialBooking as any).startTime = startTime;
      (partialBooking as any).endTime = endTime;
      (partialBooking as any).spaceId = spaceId;
      (partialBooking as any).spaceName = spaceName || spaces.find(s => s.id === spaceId)?.name || '';

      onBookingCreate(partialBooking);
    } else {
      // Fall back to internal modal if no parent callback
      setBookingFormData({
        date: startTime,
        startTime,
        endTime,
        spaceId,
        spaceName: spaceName || spaces.find(s => s.id === spaceId)?.name || '',
        locationId: selectedLocationId,
        customerTier: currentUserTier
      });
      setShowNewBookingModal(true);
    }
  }, [config, selectedLocationId, spaces, notify, customerTiers, onBookingCreate]);

  // Admin block handled in parent component now

  // Filter bookings for selected location
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => b.locationId === selectedLocationId);
  }, [bookings, selectedLocationId]);

  // Use the spaces that were loaded for the selected location
  const filteredSpaces = useMemo(() => {
    return spaces; // Spaces are already filtered by location in loadSpaces
  }, [spaces]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="card">
        <CalendarSkeleton variant={viewMode} showHeader={true} />
      </div>
    );
  }

  // Empty state when no location selected
  if (!selectedLocationId || locations.length === 0) {
    return (
      <div className="card">
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <CalendarX className="w-16 h-16 text-[var(--text-muted)] opacity-50 mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            No Location Selected
          </h3>
          <p className="text-sm text-[var(--text-secondary)] text-center max-w-md mb-6">
            Please select a location to view available booking slots and manage reservations.
          </p>
          {locations.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSelectedLocationId(locations[0].id)}
            >
              Select {locations[0].name}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card relative" ref={calendarRef}>
      {/* Pull-to-refresh indicator */}
      {isRefreshing && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-blue-500 text-white text-center py-2 animate-pulse">
          <span className="text-sm">Refreshing...</span>
        </div>
      )}

      {/* Header section removed - all controls in SubNavigation */}

      {/* Date navigation */}
      <div className="py-3 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-[var(--bg-hover)] rounded transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="text-sm font-medium">
            {viewMode === 'week'
              ? `${format(startOfWeek(selectedDate), 'MMM d')} - ${format(endOfWeek(selectedDate), 'MMM d, yyyy')}`
              : format(selectedDate, 'EEEE, MMMM d, yyyy')
            }
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="pt-3">
        {viewMode === 'day' ? (
          <DayGrid
            date={selectedDate}
            bookings={filteredBookings}
            spaces={filteredSpaces}
            config={config}
            onTimeSlotClick={handleBookingCreate}
            onBookingClick={onBookingSelect}
            onSpaceClick={handleSpaceClick}
          />
        ) : (
          <WeekGrid
            weekStart={startOfWeek(selectedDate)}
            bookings={filteredBookings}
            spaces={filteredSpaces}
            config={config}
            onTimeSlotClick={handleBookingCreate}
            onBookingClick={onBookingSelect}
            onSpaceClick={handleSpaceClick}
          />
        )}
      </div>

      {/* Modals */}
      <BoxInfoModal
        box={selectedSpace as any}
        isOpen={showBoxInfoModal}
        onClose={() => setShowBoxInfoModal(false)}
      />

      {/* Only show internal modal if no parent callback provided */}
      {!onBookingCreate && (
        <NewBookingModal
          isOpen={showNewBookingModal}
          onClose={() => setShowNewBookingModal(false)}
          prefilledData={bookingFormData}
          onSuccess={(booking) => {
            // Reload bookings to show the new one
            loadBookings();
          }}
        />
      )}
    </div>
  );
};

export default BookingCalendar;