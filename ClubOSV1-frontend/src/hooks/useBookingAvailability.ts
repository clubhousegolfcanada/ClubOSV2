import { useState, useEffect, useCallback } from 'react';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';
import logger from '@/services/logger';

export interface AvailabilityData {
  isAvailable: boolean;
  maxAvailableDuration: number; // in minutes
  nextBookingTime: Date | null;
  availableDurations: number[]; // Available duration options in minutes
  conflictingBookings: Array<{
    id: string;
    startAt: Date;
    endAt: Date;
    customerName?: string;
  }>;
  suggestedAlternatives?: Array<{
    startTime: Date;
    endTime: Date;
    duration: number;
  }>;
}

export interface DurationOption {
  duration: number; // in minutes
  label: string;
  price: number;
  available: boolean;
  disabledReason?: string;
}

export interface DurationValidation {
  isValid: boolean;
  maxAllowedDuration: number;
  reason?: string;
  availableOptions: DurationOption[];
}

export interface ConflictCheckResult {
  canBook: boolean;
  conflicts: string[]; // Space IDs with conflicts
  details: Array<{
    spaceId: string;
    available: boolean;
    maxDuration: number;
    nextBooking: Date | null;
  }>;
}

interface UseBookingAvailabilityOptions {
  locationId: string;
  spaceId?: string;
  startTime?: Date;
  autoCheck?: boolean; // Auto-check on mount and when params change
}

export function useBookingAvailability({
  locationId,
  spaceId,
  startTime,
  autoCheck = true
}: UseBookingAvailabilityOptions) {
  const { notify } = useNotifications();

  // State
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [durationOptions, setDurationOptions] = useState<DurationValidation | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(60); // Default 1 hour
  const [error, setError] = useState<string | null>(null);

  /**
   * Check availability for a specific time slot
   */
  const checkAvailability = useCallback(async (
    overrideSpaceId?: string,
    overrideStartTime?: Date
  ): Promise<AvailabilityData | null> => {
    const checkSpaceId = overrideSpaceId || spaceId;
    const checkStartTime = overrideStartTime || startTime;

    if (!locationId || !checkSpaceId || !checkStartTime) {
      logger.warn('Missing required params for availability check');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await http.get('/bookings/availability', {
        params: {
          locationId,
          spaceId: checkSpaceId,
          startTime: checkStartTime.toISOString()
        }
      });

      const data = response.data.data as AvailabilityData;

      // Convert date strings to Date objects
      if (data.nextBookingTime) {
        data.nextBookingTime = new Date(data.nextBookingTime);
      }
      data.conflictingBookings = data.conflictingBookings.map(b => ({
        ...b,
        startAt: new Date(b.startAt),
        endAt: new Date(b.endAt)
      }));
      if (data.suggestedAlternatives) {
        data.suggestedAlternatives = data.suggestedAlternatives.map(alt => ({
          ...alt,
          startTime: new Date(alt.startTime),
          endTime: new Date(alt.endTime)
        }));
      }

      setAvailability(data);

      // Auto-select maximum of 1 hour or available duration
      if (data.isAvailable) {
        setSelectedDuration(Math.min(60, data.maxAvailableDuration));
      }

      return data;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to check availability';
      logger.error('Availability check failed:', err);
      setError(errorMsg);
      notify('error', errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [locationId, spaceId, startTime, notify]);

  /**
   * Get duration options with pricing
   */
  const getDurationOptions = useCallback(async (
    overrideSpaceId?: string,
    overrideStartTime?: Date
  ): Promise<DurationValidation | null> => {
    const checkSpaceId = overrideSpaceId || spaceId;
    const checkStartTime = overrideStartTime || startTime;

    if (!locationId || !checkSpaceId || !checkStartTime) {
      return null;
    }

    setLoading(true);

    try {
      const response = await http.get('/bookings/validate-duration', {
        params: {
          locationId,
          spaceId: checkSpaceId,
          startTime: checkStartTime.toISOString()
        }
      });

      const data = response.data.data as DurationValidation;
      setDurationOptions(data);
      return data;
    } catch (err: any) {
      logger.error('Duration validation failed:', err);
      const errorMsg = err.response?.data?.error || 'Failed to get duration options';
      notify('error', errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [locationId, spaceId, startTime, notify]);

  /**
   * Check conflicts for multiple spaces
   */
  const checkConflicts = useCallback(async (
    spaceIds: string[],
    checkStartTime: Date,
    checkEndTime: Date
  ): Promise<ConflictCheckResult | null> => {
    if (!locationId || spaceIds.length === 0) {
      return null;
    }

    try {
      const response = await http.post('/bookings/check-conflicts', {
        locationId,
        spaceIds,
        startTime: checkStartTime.toISOString(),
        endTime: checkEndTime.toISOString()
      });

      const data = response.data.data as ConflictCheckResult;

      // Convert date strings
      data.details = data.details.map(d => ({
        ...d,
        nextBooking: d.nextBooking ? new Date(d.nextBooking) : null
      }));

      return data;
    } catch (err: any) {
      logger.error('Conflict check failed:', err);
      return null;
    }
  }, [locationId]);

  /**
   * Update selected duration and validate
   */
  const updateDuration = useCallback((newDuration: number) => {
    if (!availability) return;

    if (newDuration > availability.maxAvailableDuration) {
      notify('warning', `Maximum available duration is ${formatDuration(availability.maxAvailableDuration)}`);
      return;
    }

    setSelectedDuration(newDuration);
  }, [availability, notify]);

  /**
   * Format duration for display
   */
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (mins === 0) {
      return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    if (hours === 0) {
      return `${mins} minutes`;
    }
    return `${hours}h ${mins}m`;
  };

  /**
   * Get suggested end time based on selected duration
   */
  const getEndTime = useCallback((): Date | null => {
    if (!startTime || !selectedDuration) return null;

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + selectedDuration);
    return endTime;
  }, [startTime, selectedDuration]);

  /**
   * Check if a specific duration is available
   */
  const isDurationAvailable = useCallback((duration: number): boolean => {
    if (!availability) return false;
    return availability.isAvailable && duration <= availability.maxAvailableDuration;
  }, [availability]);

  // Auto-check availability when params change
  useEffect(() => {
    if (autoCheck && locationId && spaceId && startTime) {
      checkAvailability();
      getDurationOptions();
    }
  }, [locationId, spaceId, startTime, autoCheck]);

  return {
    // State
    loading,
    error,
    availability,
    durationOptions,
    selectedDuration,

    // Actions
    checkAvailability,
    getDurationOptions,
    checkConflicts,
    updateDuration,

    // Helpers
    formatDuration,
    getEndTime,
    isDurationAvailable,

    // Quick checks
    isAvailable: availability?.isAvailable || false,
    maxDuration: availability?.maxAvailableDuration || 0,
    nextBooking: availability?.nextBookingTime || null,
    suggestedTimes: availability?.suggestedAlternatives || []
  };
}