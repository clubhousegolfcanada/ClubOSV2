import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Clock, MapPin, Filter, Users, ChevronLeft, ChevronRight, Grid3X3, List, CalendarX, Plus } from 'lucide-react';
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
import UnifiedBookingCard from '../unified/UnifiedBookingCard';
import BoxInfoModal from '../BoxInfoModal';
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

const BookingCalendarV2: React.FC<BookingCalendarProps> = ({
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
  const isStaff = user?.role === 'operator' || user?.role === 'support' || isAdmin;

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
  const [showUnifiedBooking, setShowUnifiedBooking] = useState(false);
  const [unifiedBookingMode, setUnifiedBookingMode] = useState<'booking' | 'block' | 'maintenance' | 'event' | 'class'>('booking');

  // Modal states
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [showBoxInfoModal, setShowBoxInfoModal] = useState(false);
  const [bookingFormData, setBookingFormData] = useState<any>(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load bookings when date or location changes
  useEffect(() => {
    if (selectedLocationId) {
      loadBookings();
    }
  }, [selectedDate, selectedLocationId, viewMode]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load locations
      const locationsRes = await http.get('/bookings/locations');
      const loadedLocations = locationsRes.data.data || [];
      setLocations(loadedLocations);

      // Set first location if not specified
      if (!selectedLocationId && loadedLocations.length > 0) {
        setSelectedLocationId(loadedLocations[0].id);
      }

      // Load booking config
      const config = await BookingConfigService.getConfig();
      setConfig(config);
      const customerTiers = await BookingConfigService.getCustomerTiers();
      setCustomerTiers(customerTiers);

    } catch (error) {
      logger.error('Failed to load initial data', error);
      notify('error', 'Failed to load calendar data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      const startDate = viewMode === 'week'
        ? startOfWeek(selectedDate, { weekStartsOn: 0 })
        : startOfDay(selectedDate);

      const endDate = viewMode === 'week'
        ? endOfWeek(selectedDate, { weekStartsOn: 0 })
        : addDays(startOfDay(selectedDate), 1);

      // Load spaces for location
      const spacesRes = await http.get(`/bookings/spaces`, {
        params: { locationId: selectedLocationId }
      });
      setSpaces(spacesRes.data.data || []);

      // Load bookings
      const bookingsRes = await http.get('/bookings', {
        params: {
          locationId: selectedLocationId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      // Add tier colors to bookings
      const bookingsWithColors = (bookingsRes.data.data || []).map((booking: Booking) => {
        const tier = customerTiers.find(t => t.id === booking.customerTierId);
        return {
          ...booking,
          tierColor: tier?.color,
          tierName: tier?.name
        };
      });

      setBookings(bookingsWithColors);
    } catch (error) {
      logger.error('Failed to load bookings', error);
      notify('error', 'Failed to load bookings. Please try again.');
    }
  };

  const handleTimeSlotClick = useCallback((startAt: Date, endAt: Date, spaceId?: string, spaceName?: string) => {
    if (!config) {
      notify('error', 'Booking configuration not loaded');
      return;
    }

    // Find current user's tier
    let currentUserTier = customerTiers[0]; // Default to first tier
    if (user) {
      // TODO: Get actual user tier from profile
      currentUserTier = customerTiers.find(t => t.id === 'member') || customerTiers[0];
    }

    // Validate booking time
    const validation = TimeValidationService.validateBooking(
      startAt,
      endAt,
      currentUserTier.id as any
    );

    if (!validation.isValid) {
      notify('error', validation.error || 'Invalid booking time');
      return;
    }

    // For external callback (parent component handling)
    if (onBookingCreate) {
      onBookingCreate({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        locationId: selectedLocationId,
        spaceIds: spaceId ? [spaceId] : [],
        customerTierId: currentUserTier.id
      });
    } else {
      // Open unified booking card with prefilled data
      setBookingFormData({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        spaceId,
        spaceName: spaceName || spaces.find(s => s.id === spaceId)?.name || '',
        locationId: selectedLocationId,
        customerTier: currentUserTier
      });
      setUnifiedBookingMode('booking');
      setShowUnifiedBooking(true);
    }
  }, [config, selectedLocationId, spaces, notify, customerTiers, onBookingCreate]);

  const handleBookingSuccess = (booking: any) => {
    // Reload bookings to show the new one
    loadBookings();
    setShowUnifiedBooking(false);
    notify('success', `${booking.isAdminBlock ? 'Time blocked' : 'Booking created'} successfully`);
  };

  const handlePrevious = () => {
    const days = viewMode === 'week' ? 7 : 1;
    setSelectedDate(prev => addDays(prev, -days));
  };

  const handleNext = () => {
    const days = viewMode === 'week' ? 7 : 1;
    setSelectedDate(prev => addDays(prev, days));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleBookingClick = (booking: Booking) => {
    if (onBookingSelect) {
      onBookingSelect(booking);
    } else {
      // Handle internally if needed
      logger.info('Booking selected', booking);
    }
  };

  const handleSpaceClick = (space: Space) => {
    setSelectedSpace(space);
    setShowBoxInfoModal(true);
  };

  // Computed values
  const filteredSpaces = useMemo(() => {
    return spaces.filter(space => space.isActive);
  }, [spaces]);

  const selectedLocation = useMemo(() => {
    return locations.find(l => l.id === selectedLocationId);
  }, [locations, selectedLocationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left side - Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevious}
              className="p-1"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNext}
              className="p-1"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold ml-2">
              {viewMode === 'week'
                ? `Week of ${format(startOfWeek(selectedDate), 'MMM d, yyyy')}`
                : format(selectedDate, 'EEEE, MMMM d, yyyy')
              }
            </h2>
          </div>

          {/* Right side - Controls */}
          <div className="flex items-center gap-2">
            {/* Location selector */}
            {locations.length > 1 && (
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {locations.map(location => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            )}

            {/* View mode toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'day'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                onClick={() => setViewMode('day')}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'week'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                onClick={() => setViewMode('week')}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Admin/Staff controls */}
            {isStaff && (
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setUnifiedBookingMode('booking');
                    setShowUnifiedBooking(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  New Booking
                </Button>
                {isAdmin && allowAdminBlock && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setUnifiedBookingMode('block');
                      setShowUnifiedBooking(true);
                    }}
                  >
                    Block Time
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="flex items-center gap-4">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Filters coming soon...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden">
        {filteredSpaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <CalendarX className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Simulators Available
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
              {selectedLocation
                ? `No active simulators found at ${selectedLocation.name}. Please contact an administrator.`
                : 'Please select a location to view available simulators.'
              }
            </p>
          </div>
        ) : viewMode === 'day' ? (
          <DayGrid
            date={selectedDate}
            spaces={filteredSpaces}
            bookings={bookings}
            onTimeSlotClick={handleTimeSlotClick}
            onBookingClick={handleBookingClick}
            onSpaceClick={handleSpaceClick}
            config={config}
          />
        ) : (
          <WeekGrid
            weekStart={startOfWeek(selectedDate, { weekStartsOn: 0 })}
            spaces={filteredSpaces}
            bookings={bookings}
            onTimeSlotClick={handleTimeSlotClick}
            onBookingClick={handleBookingClick}
            onSpaceClick={handleSpaceClick}
            config={config}
          />
        )}
      </div>

      {/* Color Legend */}
      {showColorLegend && customerTiers.length > 0 && (
        <ColorLegend tiers={customerTiers} />
      )}

      {/* Modals */}
      <BoxInfoModal
        box={selectedSpace as any}
        isOpen={showBoxInfoModal}
        onClose={() => setShowBoxInfoModal(false)}
      />

      {/* Unified Booking Card Modal */}
      {showUnifiedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl">
            <UnifiedBookingCard
              initialStartTime={bookingFormData?.startAt ? new Date(bookingFormData.startAt) : undefined}
              initialEndTime={bookingFormData?.endAt ? new Date(bookingFormData.endAt) : undefined}
              initialSpaceId={bookingFormData?.spaceId}
              initialSpaceName={bookingFormData?.spaceName}
              initialLocationId={bookingFormData?.locationId || selectedLocationId}
              onSuccess={handleBookingSuccess}
              onCancel={() => setShowUnifiedBooking(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingCalendarV2;