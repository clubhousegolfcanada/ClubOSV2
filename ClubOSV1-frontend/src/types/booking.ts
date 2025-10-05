/**
 * Booking System Type Definitions
 * Part 5: Multi-Simulator Booking Support
 */

// Location types
export interface BookingLocation {
  id: string;
  name: string;
  city: string;
  address?: string;
  timezone: string;
  isActive: boolean;
  maxSimulators: number;
  operatingHours: {
    open: string; // "06:00"
    close: string; // "22:00"
  };
}

// Space/Simulator types
export interface Space {
  id: string;
  locationId: string;
  spaceNumber: number;
  name: string;
  type: 'simulator' | 'room' | 'court';
  features: string[]; // ["TrackMan", "Foresight", "GCQuad"]
  isActive: boolean;
  maintenanceNotes?: string;
  lastMaintenance?: string;
}

// Customer tier types
export type CustomerTier = 'new' | 'member' | 'promo' | 'frequent';

export interface CustomerTierConfig {
  id: CustomerTier;
  name: string;
  color: string; // Hex color for calendar display
  hourlyRate: number;
  discountPercent?: number;
  maxAdvanceDays: number;
  allowRecurring: boolean;
  requireDeposit: boolean;
  autoUpgradeAfter?: number; // Number of bookings
}

// Booking types
export type BookingType = 'standard' | 'group' | 'full_location';
export type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';
export type BookingSource = 'clubos' | 'skedda' | 'admin' | 'api';

export interface BookingV2 {
  id: string;
  locationId: string;
  userId: string;

  // Multi-simulator fields
  spaceIds: string[]; // Array of space IDs
  primarySpaceId: string; // Main space for display

  // Time fields
  startAt: string; // ISO timestamp
  endAt: string; // ISO timestamp
  durationMinutes: number;

  // Booking details
  bookingType: BookingType;
  groupSize: number;
  status: BookingStatus;
  customerTier: CustomerTier;

  // Change tracking
  changeCount: number;
  originalBookingId?: string;
  flaggedForChanges: boolean;

  // Preferences
  isFavoriteSetup: boolean;
  notes?: string;
  adminNotes?: string;

  // Pricing
  baseRate?: number;
  totalAmount?: number;
  depositPaid?: number;

  // Metadata
  source: BookingSource;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Booking space junction (for group bookings)
export interface BookingSpace {
  id: string;
  bookingId: string;
  spaceId: string;
  isPrimary: boolean;
  participantName?: string;
  participantEmail?: string;
}

// Availability types
export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  reason?: string; // If not available
}

export interface SpaceAvailability {
  spaceId: string;
  spaceName: string;
  spaceNumber: number;
  isAvailable: boolean;
  nextAvailable?: string; // Next available time
}

export interface AvailabilityMatrix {
  locationId: string;
  date: string;
  spaces: SpaceAvailability[];
  timeSlots: TimeSlot[];
  matrix: boolean[][]; // [spaceIndex][timeSlotIndex]
}

// Request/Response types
export interface CreateBookingRequest {
  locationId: string;
  spaceIds: string[];
  startAt: string;
  endAt: string;
  bookingType?: BookingType;
  groupSize?: number;
  notes?: string;
  participantDetails?: Array<{
    spaceId: string;
    name?: string;
    email?: string;
  }>;
}

export interface UpdateBookingRequest {
  spaceIds?: string[];
  startAt?: string;
  endAt?: string;
  notes?: string;
  adminNotes?: string;
}

export interface CheckAvailabilityRequest {
  locationId: string;
  spaceIds?: string[]; // Optional - check specific spaces
  startAt: string;
  endAt: string;
}

export interface CheckAvailabilityResponse {
  available: boolean;
  conflicts?: Array<{
    spaceId: string;
    spaceName: string;
    conflictingBooking: {
      id: string;
      startAt: string;
      endAt: string;
    };
  }>;
  suggestions?: Array<{
    startAt: string;
    endAt: string;
    spaceIds: string[];
  }>;
}

// Multi-selector component props
export interface MultiSimulatorSelectorProps {
  locationId: string;
  availableSpaces: Space[];
  selectedSpaceIds: string[];
  onSpaceToggle: (spaceId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  date: string;
  startTime: string;
  endTime: string;
  showAvailability?: boolean;
  maxSelectable?: number;
}

// Group booking coordinator props
export interface GroupBookingCoordinatorProps {
  locationId: string;
  groupSize: number;
  participants: Array<{
    name?: string;
    email?: string;
    preferredSpaceId?: string;
  }>;
  onParticipantUpdate: (index: number, participant: any) => void;
  onAutoAssign: () => void;
  suggestedAssignments?: Map<number, string>; // participant index -> spaceId
}

// Favorite simulator props
export interface FavoriteSimulatorProps {
  userId: string;
  locationId: string;
  currentFavorites: string[];
  onToggleFavorite: (spaceId: string) => void;
  onQuickBook: (spaceIds: string[]) => void;
  showQuickActions?: boolean;
}

// Availability matrix props
export interface AvailabilityMatrixProps {
  locationId: string;
  date: string;
  spaces: Space[];
  timeSlots: TimeSlot[];
  onCellClick: (spaceId: string, timeSlot: TimeSlot) => void;
  onDragSelect?: (startCell: [string, TimeSlot], endCell: [string, TimeSlot]) => void;
  selectedCells?: Set<string>; // Set of "spaceId:startTime" strings
  bookings?: BookingV2[];
  showLegend?: boolean;
  interactive?: boolean;
}

// Customer preferences
export interface BookingPreferences {
  defaultDuration: number; // minutes
  preferredTimes: ('morning' | 'afternoon' | 'evening')[];
  autoRebook: boolean;
  favoriteSpaceIds: {
    [locationId: string]: string[];
  };
  reminderSettings: {
    enabled: boolean;
    minutesBefore: number;
  };
}

// Upsell types
export interface UpsellPrompt {
  bookingId: string;
  promptType: 'extend' | 'rebook' | 'upgrade';
  discount?: number;
  message: string;
  expiresAt: string;
}

// Export utility types
export type BookingMap = Map<string, BookingV2>;
export type SpaceMap = Map<string, Space>;
export type LocationMap = Map<string, BookingLocation>;