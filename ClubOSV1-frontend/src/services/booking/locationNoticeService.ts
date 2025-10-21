import logger from '@/services/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Location {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  isVisible: boolean;
  isActive: boolean;
  activeNotices: number;
  availableSpaces: number;
  minBookingHours?: number;
  maxAdvanceDays?: number;
  depositAmount?: number;
}

interface LocationNotice {
  id: string;
  locationId: string;
  title?: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  isActive: boolean;
  showOnBookingPage: boolean;
  showInConfirmations: boolean;
  showUntil?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateNoticeData {
  title?: string;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
  showOnBookingPage?: boolean;
  showInConfirmations?: boolean;
  showUntil?: string;
}

interface UpdateNoticeData {
  title?: string;
  message?: string;
  severity?: 'info' | 'warning' | 'critical';
  is_active?: boolean;
  show_on_booking_page?: boolean;
  show_in_confirmations?: boolean;
  show_until?: string | null;
}

interface LocationConfig {
  locationId: string;
  locationName: string;
  minDurationMinutes: number;
  incrementMinutes: number;
  minAdvanceNoticeHours: number;
  allowCrossMidnight: boolean;
  allowRecurring: boolean;
  maxRecurringWeeks: number;
  freeRescheduleCount: number;
  rescheduleFee: number;
  maxChangesAllowed: number;
  flagAfterChanges: number;
  enableUpsellPrompts: boolean;
  upsellTriggerPercent: number;
  upsellMinutesBeforeEnd: number;
  sessionsForFreeHour: number;
  autoUpgradeAfterBookings: number;
}

interface BookingSpace {
  id: string;
  locationId: string;
  name: string;
  type: string;
  capacity: number;
  features: any[];
  isPremium: boolean;
  premiumRateMultiplier: number;
  isActive: boolean;
  isBookable: boolean;
  displayOrder: number;
  colorHex?: string;
}

class LocationNoticeService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  // Get all locations
  async getLocations(): Promise<Location[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/booking/locations`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      logger.error('Error fetching locations:', error);
      throw error;
    }
  }

  // Get notices for a specific location
  async getLocationNotices(locationId: string, includeExpired = false): Promise<LocationNotice[]> {
    try {
      const params = new URLSearchParams();
      if (includeExpired) {
        params.append('includeExpired', 'true');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/booking/locations/${locationId}/notices?${params}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch notices');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      logger.error('Error fetching notices:', error);
      throw error;
    }
  }

  // Create a new notice
  async createNotice(locationId: string, noticeData: CreateNoticeData): Promise<LocationNotice> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/booking/locations/${locationId}/notices`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(noticeData)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create notice');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      logger.error('Error creating notice:', error);
      throw error;
    }
  }

  // Update a notice
  async updateNotice(locationId: string, noticeId: string, updates: UpdateNoticeData): Promise<LocationNotice> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/booking/locations/${locationId}/notices/${noticeId}`,
        {
          method: 'PATCH',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(updates)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update notice');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      logger.error('Error updating notice:', error);
      throw error;
    }
  }

  // Delete a notice
  async deleteNotice(noticeId: string): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/booking/notices/${noticeId}`,
        {
          method: 'DELETE',
          headers: this.getAuthHeaders()
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete notice');
      }
    } catch (error) {
      logger.error('Error deleting notice:', error);
      throw error;
    }
  }

  // Toggle location visibility
  async toggleLocationVisibility(locationId: string, isVisible: boolean): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/booking/locations/${locationId}/visibility`,
        {
          method: 'PATCH',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ isVisible })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update visibility');
      }
    } catch (error) {
      logger.error('Error updating visibility:', error);
      throw error;
    }
  }

  // Get location configuration
  async getLocationConfig(locationId: string): Promise<LocationConfig> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/booking/locations/${locationId}/config`,
        {
          headers: this.getAuthHeaders()
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch configuration');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      logger.error('Error fetching config:', error);
      throw error;
    }
  }

  // Get spaces for a location
  async getLocationSpaces(locationId: string, includeInactive = false): Promise<BookingSpace[]> {
    try {
      const params = new URLSearchParams();
      if (includeInactive) {
        params.append('includeInactive', 'true');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/booking/locations/${locationId}/spaces?${params}`,
        {
          headers: this.getAuthHeaders()
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch spaces');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      logger.error('Error fetching spaces:', error);
      throw error;
    }
  }

  // Get all active notices across all locations (for admin dashboard)
  async getAllActiveNotices(): Promise<{ [locationId: string]: LocationNotice[] }> {
    try {
      const locations = await this.getLocations();
      const noticesByLocation: { [locationId: string]: LocationNotice[] } = {};

      await Promise.all(
        locations.map(async (location) => {
          if (location.activeNotices > 0) {
            const notices = await this.getLocationNotices(location.id);
            if (notices.length > 0) {
              noticesByLocation[location.id] = notices;
            }
          }
        })
      );

      return noticesByLocation;
    } catch (error) {
      logger.error('Error fetching all notices:', error);
      throw error;
    }
  }
}

export const locationNoticeService = new LocationNoticeService();