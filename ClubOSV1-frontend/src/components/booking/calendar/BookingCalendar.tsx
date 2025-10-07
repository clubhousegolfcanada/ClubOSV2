import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Clock, MapPin, Filter, Users, ChevronLeft, ChevronRight, Grid3X3, List } from 'lucide-react';
import { format, startOfDay, addDays, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';
import { BookingConfigService, CustomerTier, BookingConfig } from '@/services/booking/bookingConfig';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DayGrid from './DayGrid';
import WeekGrid from './WeekGrid';
import ColorLegend from './ColorLegend';
import AdminBlockOff from './AdminBlockOff';
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

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load bookings when date or location changes
  useEffect(() => {
    if (config && locations.length > 0) {
      loadBookings();
    }
  }, [selectedDate, selectedLocationId, viewMode]);

  // Load spaces when location changes
  useEffect(() => {
    if (selectedLocationId && selectedLocationId !== 'all' && locations.length > 0) {
      loadSpaces();
    }
  }, [selectedLocationId, locations]);

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
      let locationToLoad = selectedLocationId;
      if (!locationToLoad && loadedLocations.length > 0) {
        locationToLoad = loadedLocations[0].id;
        setSelectedLocationId(locationToLoad);
      }

      // Load spaces for the selected location
      if (locationToLoad && locationToLoad !== 'all') {
        const spacesData = await http.get('/bookings/spaces', {
          params: { locationId: locationToLoad }
        });
        setSpaces(spacesData.data.data || []);
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
      if (selectedLocationId && selectedLocationId !== 'all') {
        const spacesData = await http.get('/bookings/spaces', {
          params: { locationId: selectedLocationId }
        });
        setSpaces(spacesData.data.data || []);
      } else {
        setSpaces([]);
      }
    } catch (error) {
      logger.error('Failed to load spaces:', error);
      notify('error', 'Failed to load spaces');
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
            locationId: selectedLocationId !== 'all' ? selectedLocationId : undefined
          }
        })
      );

      const results = await Promise.all(bookingPromises);
      const allBookings = results.flatMap(r => r.data.data || []);

      // Add tier colors to bookings
      const bookingsWithColors = allBookings.map(booking => ({
        ...booking,
        tierColor: customerTiers.find(t => t.id === booking.customerTierId)?.color || '#6B7280'
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

  // Booking handlers
  const handleBookingCreate = useCallback((startTime: Date, endTime: Date, spaceId?: string) => {
    if (!config) return;

    // Validate duration
    const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
    if (!BookingConfigService.isValidDuration(durationMinutes)) {
      notify('error', `Invalid duration. Minimum ${config.minDuration} minutes, then ${config.incrementAfterFirst}-minute increments.`);
      return;
    }

    // Create booking object
    const newBooking: Partial<Booking> = {
      locationId: selectedLocationId !== 'all' ? selectedLocationId : undefined,
      spaceIds: spaceId ? [spaceId] : [],
      startAt: startTime.toISOString(),
      endAt: endTime.toISOString(),
      status: 'pending'
    };

    if (onBookingCreate) {
      onBookingCreate(newBooking);
    }
  }, [config, selectedLocationId, notify, onBookingCreate]);

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
    if (selectedLocationId === 'all') {
      return bookings;
    }
    return bookings.filter(b => b.locationId === selectedLocationId);
  }, [bookings, selectedLocationId]);

  // Get spaces for selected location
  const filteredSpaces = useMemo(() => {
    if (selectedLocationId === 'all') {
      return spaces;
    }
    return spaces.filter(s => s.locationId === selectedLocationId);
  }, [spaces, selectedLocationId]);

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
              <span>{!selectedLocationId ? 'Select Location' : selectedLocationId === 'all' ? 'All Locations' : locations.find(l => l.id === selectedLocationId)?.name || 'Select Location'}</span>
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
              <button
                onClick={() => {
                  setSelectedLocationId('all');
                  setShowFilters(false);
                }}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  selectedLocationId === 'all'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                All Locations
              </button>
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
          />
        ) : (
          <WeekGrid
            startDate={startOfWeek(selectedDate)}
            bookings={filteredBookings}
            spaces={filteredSpaces}
            config={config!}
            onBookingCreate={handleBookingCreate}
            onBookingSelect={onBookingSelect}
          />
        )}
      </div>
    </div>
  );
};

export default BookingCalendar;