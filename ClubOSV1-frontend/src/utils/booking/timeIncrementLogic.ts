/**
 * Time increment logic for booking system
 * Enforces 30-minute increments after first hour rule
 */

export interface TimeIncrementConfig {
  minDuration: number;        // Minimum booking duration in minutes (60)
  maxDuration: number;        // Maximum booking duration in minutes (360)
  incrementAfterFirstHour: number; // Increment in minutes after first hour (30)
}

export const DEFAULT_TIME_CONFIG: TimeIncrementConfig = {
  minDuration: 60,
  maxDuration: 360,
  incrementAfterFirstHour: 30
};

/**
 * Validate if a duration follows the increment rules
 */
export function isValidDuration(
  durationMinutes: number,
  config: TimeIncrementConfig = DEFAULT_TIME_CONFIG
): { valid: boolean; error?: string } {
  // Check minimum
  if (durationMinutes < config.minDuration) {
    return {
      valid: false,
      error: `Minimum duration is ${config.minDuration} minutes`
    };
  }

  // Check maximum
  if (durationMinutes > config.maxDuration) {
    return {
      valid: false,
      error: `Maximum duration is ${config.maxDuration / 60} hours`
    };
  }

  // Check increment rules for durations over 1 hour
  if (durationMinutes > 60) {
    const additionalMinutes = durationMinutes - 60;
    if (additionalMinutes % config.incrementAfterFirstHour !== 0) {
      return {
        valid: false,
        error: `After 1 hour, bookings must be in ${config.incrementAfterFirstHour}-minute increments (e.g., 1.5h, 2h, 2.5h)`
      };
    }
  }

  return { valid: true };
}

/**
 * Generate valid duration options based on config
 */
export function generateDurationOptions(
  config: TimeIncrementConfig = DEFAULT_TIME_CONFIG
): number[] {
  const options: number[] = [];

  // Add minimum duration (typically 1 hour)
  options.push(config.minDuration);

  // Add increments after first hour
  let current = config.minDuration + config.incrementAfterFirstHour;
  while (current <= config.maxDuration) {
    options.push(current);
    current += config.incrementAfterFirstHour;
  }

  return options;
}

/**
 * Round a duration to the nearest valid increment
 */
export function roundToValidDuration(
  durationMinutes: number,
  config: TimeIncrementConfig = DEFAULT_TIME_CONFIG,
  roundUp: boolean = false
): number {
  // If less than minimum, return minimum
  if (durationMinutes <= config.minDuration) {
    return config.minDuration;
  }

  // If more than maximum, return maximum
  if (durationMinutes >= config.maxDuration) {
    return config.maxDuration;
  }

  // If exactly 60 minutes, return as-is
  if (durationMinutes === 60) {
    return 60;
  }

  // Calculate how much over 60 minutes
  const additionalMinutes = durationMinutes - 60;
  const increment = config.incrementAfterFirstHour;

  // Round to nearest increment
  const remainder = additionalMinutes % increment;
  if (remainder === 0) {
    return durationMinutes;
  }

  if (roundUp || remainder >= increment / 2) {
    // Round up
    return 60 + additionalMinutes + (increment - remainder);
  } else {
    // Round down
    return 60 + additionalMinutes - remainder;
  }
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins} minute${mins !== 1 ? 's' : ''}`;
  } else if (mins === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    return `${hours}h ${mins}m`;
  }
}

/**
 * Calculate end time based on start time and duration
 */
export function calculateEndTime(startTime: Date, durationMinutes: number): Date {
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);
  return endTime;
}

/**
 * Calculate duration between two times
 */
export function calculateDuration(startTime: Date, endTime: Date): number {
  const diffMs = endTime.getTime() - startTime.getTime();
  return Math.floor(diffMs / (1000 * 60));
}

/**
 * Check if booking crosses midnight
 */
export function crossesMidnight(startTime: Date, endTime: Date): boolean {
  const startDay = startTime.getDate();
  const endDay = endTime.getDate();
  return startDay !== endDay;
}

/**
 * Suggest next valid duration for upselling
 */
export function getUpsellDuration(
  currentDuration: number,
  config: TimeIncrementConfig = DEFAULT_TIME_CONFIG
): number | null {
  const options = generateDurationOptions(config);
  const currentIndex = options.indexOf(currentDuration);

  if (currentIndex === -1 || currentIndex === options.length - 1) {
    return null; // Current duration not found or already at max
  }

  return options[currentIndex + 1];
}

/**
 * Get price for duration based on hourly rate
 */
export function calculatePrice(
  durationMinutes: number,
  hourlyRate: number,
  discountPercent: number = 0
): { basePrice: number; discount: number; finalPrice: number } {
  const hours = durationMinutes / 60;
  const basePrice = hourlyRate * hours;
  const discount = basePrice * (discountPercent / 100);
  const finalPrice = basePrice - discount;

  return {
    basePrice: Math.round(basePrice * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    finalPrice: Math.round(finalPrice * 100) / 100
  };
}

/**
 * Validate time slot availability
 */
export interface TimeSlot {
  start: Date;
  end: Date;
}

export function isSlotAvailable(
  requestedSlot: TimeSlot,
  existingBookings: TimeSlot[]
): boolean {
  for (const booking of existingBookings) {
    // Check for any overlap
    if (
      (requestedSlot.start >= booking.start && requestedSlot.start < booking.end) ||
      (requestedSlot.end > booking.start && requestedSlot.end <= booking.end) ||
      (requestedSlot.start <= booking.start && requestedSlot.end >= booking.end)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Find available slots in a day
 */
export function findAvailableSlots(
  date: Date,
  existingBookings: TimeSlot[],
  config: TimeIncrementConfig = DEFAULT_TIME_CONFIG,
  operatingHours = { start: 6, end: 23 } // 6 AM to 11 PM
): TimeSlot[] {
  const availableSlots: TimeSlot[] = [];
  const validDurations = generateDurationOptions(config);

  // Create date at operating start time
  const dayStart = new Date(date);
  dayStart.setHours(operatingHours.start, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(operatingHours.end, 0, 0, 0);

  // Try each 30-minute start time
  const current = new Date(dayStart);
  while (current < dayEnd) {
    // Try each valid duration from this start time
    for (const duration of validDurations) {
      const slot: TimeSlot = {
        start: new Date(current),
        end: calculateEndTime(current, duration)
      };

      // Check if slot ends within operating hours
      if (slot.end <= dayEnd && isSlotAvailable(slot, existingBookings)) {
        availableSlots.push(slot);
      }
    }

    // Move to next 30-minute increment
    current.setMinutes(current.getMinutes() + 30);
  }

  return availableSlots;
}