import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfDay, addDays, addMinutes, isSameDay, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { BookingConfigService, CustomerTier, BookingConfig } from '@/services/booking/bookingConfig';
import { TimeValidationService } from '@/services/booking/timeValidationService';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Skeleton from '@/components/ui/Skeleton';
import { CompactCalendarSkeleton } from './CalendarSkeleton';
import WeekGridCompact from './WeekGridCompact';
import DayGrid from './DayGrid';
// ColorLegend and AdminBlockOff removed - handled in parent
import BoxInfoModal from '../BoxInfoModal';
import NewBookingModal from '../NewBookingModal';
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

export interface BookingCalendarCompactProps {
  locationId?: string;
  date?: Date;
  viewMode?: 'day' | 'week'; // Controlled from parent
  onBookingCreate?: (booking: Partial<Booking>) => void;
  onBookingSelect?: (booking: Booking) => void;
}

type ViewMode = 'day' | 'week';

const BookingCalendarCompact: React.FC<BookingCalendarCompactProps> = ({
  locationId: propLocationId,
  date: propDate,
  viewMode: propViewMode = 'day',
  onBookingCreate,
  onBookingSelect
}) => {
  const { notify } = useNotifications();
  const { user } = useAuthState();
  const isAdmin = user?.role === 'admin';

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

  // Debug effect to monitor modal state
  useEffect(() => {
    console.log('🔍 Modal state changed:', {
      showNewBookingModal,
      hasFormData: !!bookingFormData
    });
  }, [showNewBookingModal, bookingFormData]);


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

  const loadInitialData = async () => {
    try {
      setLoading(true);

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

      // Set first location as default if no location is selected
      let locationToLoad: string = selectedLocationId || propLocationId || '';
      if (!locationToLoad && loadedLocations.length > 0) {
        locationToLoad = loadedLocations[0].id;
        setSelectedLocationId(locationToLoad);
      }

      // Load spaces for the selected location
      if (locationToLoad) {
        const spacesData = await http.get('/bookings/spaces', {
          params: { locationId: locationToLoad }
        });
        const loadedSpaces = spacesData.data.data || [];
        setSpaces(loadedSpaces);

        // Load initial bookings
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

  const loadBookings = async () => {
    try {
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


  // Modal handlers
  const handleSpaceClick = (space: Space) => {
    const boxInfo = {
      id: space.id,
      name: space.name,
      location: locations?.find(l => l.id === space.locationId)?.name || '',
      capacity: 4,
      equipment: {
        simulator: 'Trackman iO',
        projector: 'BenQ 936ST',
        tvs: '2x Club Data TVs',
        audio: 'In-wall audio',
        screen: '16\'x10\' impact screen'
      },
      image: undefined
    };
    setSelectedSpace(boxInfo as any);
    setShowBoxInfoModal(true);
  };

  // Booking handlers
  const handleBookingCreate = useCallback((startTime: Date, endTime: Date, spaceId?: string, spaceName?: string) => {
    console.log('🎯 handleBookingCreate called:', {
      startTime,
      endTime,
      spaceId,
      spaceName,
      config: !!config
    });

    if (!config) {
      console.error('❌ No config available');
      return;
    }

    // Get current user's tier
    const currentUserTier = customerTiers.find(t => t.id === 'new') || { id: 'new' } as CustomerTier;
    const tierType = currentUserTier.id as 'new' | 'member' | 'promo' | 'frequent';

    console.log('👤 User tier:', tierType);

    // Validate booking
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

    console.log('✅ Validation result:', validation);

    if (!validation.isValid) {
      console.error('❌ Validation failed:', validation.error);
      notify('error', validation.error || 'Invalid booking time');
      if (validation.suggestion) {
        notify('info', validation.suggestion);
      }
      return;
    }

    // Open booking modal with prefilled data
    const formData = {
      date: startTime,
      startTime,
      endTime,
      spaceId,
      spaceName: spaceName || spaces.find(s => s.id === spaceId)?.name || '',
      locationId: selectedLocationId,
      customerTier: currentUserTier
    };

    console.log('📝 Setting booking form data:', formData);
    setBookingFormData(formData);

    console.log('🔓 Opening modal - setting showNewBookingModal to true');
    setShowNewBookingModal(true);
  }, [config, selectedLocationId, spaces, notify, customerTiers]);

  const handleAdminBlock = useCallback(async (blockData: {
    startAt: Date;
    endAt: Date;
    spaceIds: string[];
    reason: string;
  }) => {
    try {
      const response = await http.post('/bookings', {
        locationId: selectedLocationId,
        spaceIds: blockData.spaceIds,
        startAt: blockData.startAt.toISOString(),
        endAt: blockData.endAt.toISOString(),
        isAdminBlock: true,
        blockReason: blockData.reason
      });

      if (response.data.success) {
        notify('success', 'Admin block created successfully');
        loadBookings();
      }
    } catch (error) {
      logger.error('Failed to create admin block:', error);
      notify('error', 'Failed to create admin block');
    }
  }, [selectedLocationId, notify]);

  // Filter bookings for selected location
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => b.locationId === selectedLocationId);
  }, [bookings, selectedLocationId]);

  // Calculate stats
  const totalBookings = filteredBookings.filter(b => !b.isAdminBlock).length;
  const availableSlots = spaces.length * 34 - totalBookings; // 34 slots per day (6am-11pm, 30min intervals)

  // Loading skeleton with proper animation
  if (loading) {
    return (
      <div className="card">
        <CompactCalendarSkeleton />
      </div>
    );
  }

  return (
    <>
      <div className="card gpu-accelerated">
        {/* Compact date navigation (30px height) */}
        <div className="py-1.5 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevious}
                className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button
                onClick={handleToday}
                className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                  isToday(selectedDate)
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                Today
              </button>
              <button
                onClick={handleNext}
                className="p-1 hover:bg-[var(--bg-hover)] rounded transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            <div className="text-xs font-medium">
              {viewMode === 'week'
                ? `${format(startOfWeek(selectedDate), 'MMM d')} - ${format(endOfWeek(selectedDate), 'MMM d, yyyy')}`
                : format(selectedDate, 'EEEE, MMMM d, yyyy')
              }
            </div>
          </div>
        </div>


        {/* Calendar grid (compact) */}
        <div className="pt-2 smooth-scroll">
          {spaces.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No simulators available"
              description="Select a location to view available booking slots"
              size="sm"
            />
          ) : !config ? (
            // Show loading skeleton while config is loading
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : viewMode === 'day' ? (
            // Use unified DayGrid for all screen sizes
            <DayGrid
              date={selectedDate}
              bookings={filteredBookings}
              spaces={spaces}
              config={config}
              onTimeSlotClick={handleBookingCreate}
              onBookingClick={onBookingSelect}
              onSpaceClick={handleSpaceClick}
            />
          ) : (
            <WeekGridCompact
              startDate={startOfWeek(selectedDate)}
              bookings={filteredBookings}
              spaces={spaces}
              config={config}
              onBookingCreate={handleBookingCreate}
              onBookingSelect={onBookingSelect}
              onSpaceClick={handleSpaceClick}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <BoxInfoModal
        box={selectedSpace as any}
        isOpen={showBoxInfoModal}
        onClose={() => setShowBoxInfoModal(false)}
      />

      <NewBookingModal
        isOpen={showNewBookingModal}
        onClose={() => setShowNewBookingModal(false)}
        prefilledData={bookingFormData}
        onSuccess={(booking) => {
          if (onBookingCreate) {
            onBookingCreate(booking);
          }
          loadBookings();
        }}
      />
    </>
  );
};

export default BookingCalendarCompact;