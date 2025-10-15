import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Clock, MapPin, Filter, Users, ChevronLeft, ChevronRight, Grid3X3, List } from 'lucide-react';
import { format, startOfDay, addDays, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { BookingConfigService, CustomerTier, BookingConfig } from '@/services/booking/bookingConfig';
import { TimeValidationService } from '@/services/booking/timeValidationService';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DayGrid from './DayGrid';
import WeekGrid from './WeekGrid';
import ColorLegend from './ColorLegend';
import AdminBlockOff from './AdminBlockOff';
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

export interface BookingCalendarProps {
  locationId?: string;
  date?: Date;
  onBookingCreate?: (booking: Partial<Booking>) => void;
  onBookingSelect?: (booking: Booking) => void;
  showColorLegend?: boolean;
  allowAdminBlock?: boolean;
}

type ViewMode = 'day' | 'week';

const BookingCalendar: React.FC<BookingCalendarProps> = ({
  locationId: propLocationId,
  date: propDate,
  onBookingCreate,
  onBookingSelect,
  showColorLegend = true,
  allowAdminBlock = false
}) => {
  const { notify } = useNotifications();
  const { user } = useAuthState();
  const isAdmin = user?.role === 'admin';

  // State
  const [selectedDate, setSelectedDate] = useState<Date>(propDate || new Date());
  const [selectedLocationId, setSelectedLocationId] = useState<string>(propLocationId || '');
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [customerTiers, setCustomerTiers] = useState<CustomerTier[]>([]);
  const [config, setConfig] = useState<BookingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

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
      console.log('[BookingCalendar] Loading spaces for location:', selectedLocationId);
      loadSpaces();
    }
  }, [selectedLocationId, locations]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      console.log('[BookingCalendar] Starting initial data load');

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

      console.log('[BookingCalendar] Loaded locations:', loadedLocations.map((l: any) => ({ id: l.id, name: l.name })));

      // Set first location as default if no location is selected
      let locationToLoad: string = selectedLocationId || propLocationId || '';
      if (!locationToLoad && loadedLocations.length > 0) {
        locationToLoad = loadedLocations[0].id;
        console.log('[BookingCalendar] Setting default location:', locationToLoad);
        setSelectedLocationId(locationToLoad);
      }

      // Load spaces for the selected location immediately
      if (locationToLoad) {
        console.log('[BookingCalendar] Loading spaces for initial location:', locationToLoad);
        const spacesData = await http.get('/bookings/spaces', {
          params: { locationId: locationToLoad }
        });
        const loadedSpaces = spacesData.data.data || [];
        console.log('[BookingCalendar] Loaded spaces:', loadedSpaces.map((s: any) => ({ id: s.id, name: s.name })));
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
        console.log('[BookingCalendar] loadSpaces called for location:', selectedLocationId);
        const spacesData = await http.get('/bookings/spaces', {
          params: { locationId: selectedLocationId }
        });
        const loadedSpaces = spacesData.data.data || [];
        console.log('[BookingCalendar] Spaces loaded:', loadedSpaces.length, 'spaces', loadedSpaces.map((s: any) => s.name));
        setSpaces(loadedSpaces);
      }
    } catch (error) {
      logger.error('Failed to load spaces:', error);
      notify('error', 'Failed to load spaces');
    }
  };

  const loadBookings = async () => {
    try {
      console.log('[BookingCalendar] Loading bookings for date:', format(selectedDate, 'yyyy-MM-dd'), 'location:', selectedLocationId);
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
      console.log('[BookingCalendar] Loaded bookings:', allBookings.length, 'bookings');

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

    // Open booking modal with prefilled data
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
        loadBookings(); // Refresh bookings
        setShowAdminPanel(false);
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

  // Use the spaces that were loaded for the selected location
  const filteredSpaces = useMemo(() => {
    return spaces; // Spaces are already filtered by location in loadSpaces
  }, [spaces]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="border-b border-[var(--border-primary)] pb-3 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold">Booking Calendar</h2>
            {showColorLegend && customerTiers.length > 0 && (
              <ColorLegend tiers={customerTiers} />
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Location filter */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
            >
              <MapPin className="h-4 w-4" />
              <span>{!selectedLocationId ? 'Select Location' : locations.find(l => l.id === selectedLocationId)?.name || 'Select Location'}</span>
              <Filter className="h-3 w-3" />
            </button>

            {/* View mode toggle */}
            <div className="flex bg-[var(--bg-tertiary)] rounded-md p-0.5">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'day'
                    ? 'bg-[var(--bg-primary)] text-[var(--color-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  viewMode === 'week'
                    ? 'bg-[var(--bg-primary)] text-[var(--color-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Week
              </button>
            </div>

            {/* Admin controls */}
            {isAdmin && allowAdminBlock && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAdminPanel(!showAdminPanel)}
              >
                Admin Block
              </Button>
            )}
          </div>
        </div>

        {/* Filters dropdown */}
        {showFilters && (
          <div className="mt-3 p-3 bg-[var(--bg-tertiary)] rounded-md">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {locations.map(location => (
                <button
                  key={location.id}
                  onClick={() => {
                    setSelectedLocationId(location.id);
                    setShowFilters(false);
                  }}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    selectedLocationId === location.id
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {location.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Admin panel */}
        {showAdminPanel && (
          <div className="mt-4">
            <AdminBlockOff
              spaces={filteredSpaces}
              onBlock={handleAdminBlock}
              onCancel={() => setShowAdminPanel(false)}
            />
          </div>
        )}
      </div>

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
            config={config!}
            onBookingCreate={handleBookingCreate}
            onBookingSelect={onBookingSelect}
            onSpaceClick={handleSpaceClick}
          />
        ) : (
          <WeekGrid
            startDate={startOfWeek(selectedDate)}
            bookings={filteredBookings}
            spaces={filteredSpaces}
            config={config!}
            onBookingCreate={handleBookingCreate}
            onBookingSelect={onBookingSelect}
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

      <NewBookingModal
        isOpen={showNewBookingModal}
        onClose={() => setShowNewBookingModal(false)}
        prefilledData={bookingFormData}
        onSuccess={(booking) => {
          if (onBookingCreate) {
            onBookingCreate(booking);
          }
          // Reload bookings to show the new one
          loadBookings();
        }}
      />
    </div>
  );
};

export default BookingCalendar;