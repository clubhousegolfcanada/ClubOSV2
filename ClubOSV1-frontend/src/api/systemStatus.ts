import apiClient from './apiClient';

export interface BayStatus {
  location: string;
  bayNumber: number;
  isOnline: boolean;
  isOccupied: boolean;
  bookingInfo?: {
    customerName?: string;
    startTime?: string;
    endTime?: string;
  };
  lastSeen?: string;
  hasIssue?: boolean;
  issueType?: string;
  // NinjaOne detection
  hasNinjaOneAlert?: boolean;
  ninjaOneError?: {
    type: 'trackman_not_running' | 'pc_offline' | 'app_crashed';
    detectedAt: string;
    wasOperatorReset: boolean;
    duringBooking: boolean;
  };
  criticalError?: boolean; // True when error during active booking
}

export interface LocationStatus {
  location: string;
  bays: BayStatus[];
  systemStatus: {
    music: boolean;
    tv: boolean;
    network: boolean;
  };
}

export const systemStatusAPI = {
  // Get status for all locations
  getAllStatus: async (): Promise<LocationStatus[]> => {
    try {
      const response = await apiClient.get('/api/system/status');
      // The /api/system/status endpoint returns system info, not location bay data
      // For now, return mock data since the endpoint doesn't return the expected structure
      console.log('System status response:', response.data.data);
      return getMockStatus();
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      // Return mock data for now
      return getMockStatus();
    }
  },

  // Get status for specific location
  getLocationStatus: async (location: string): Promise<LocationStatus | null> => {
    try {
      const response = await apiClient.get(`/api/system/status/${location}`);
      return response.data.data;
    } catch (error) {
      console.error(`Failed to fetch status for ${location}:`, error);
      return getMockLocationStatus(location);
    }
  },

  // Get bay occupancy
  getBayOccupancy: async (location: string, bayNumber: number): Promise<BayStatus | null> => {
    try {
      const response = await apiClient.get(`/api/system/status/${location}/bay/${bayNumber}`);
      return response.data.data;
    } catch (error) {
      console.error(`Failed to fetch bay status:`, error);
      return null;
    }
  }
};

// Mock data for development
function getMockStatus(): LocationStatus[] {
  const locations = ['Bedford', 'Dartmouth', 'Stratford', 'Bayers Lake'];
  const now = new Date();
  
  return locations.map(location => ({
    location,
    bays: Array.from({ length: location === 'Dartmouth' ? 4 : location === 'Bayers Lake' ? 4 : location === 'Stratford' ? 3 : 2 }, (_, i) => {
      const isOccupied = Math.random() > 0.4;
      const hasNinjaAlert = Math.random() > 0.85; // 15% chance
      const hasIssue = hasNinjaAlert || Math.random() > 0.9;
      
      return {
        location,
        bayNumber: i + 1,
        isOnline: Math.random() > 0.1, // 90% online
        isOccupied,
        bookingInfo: isOccupied ? {
          customerName: `Customer ${Math.floor(Math.random() * 100)}`,
          startTime: new Date(now.getTime() - Math.random() * 3600000).toISOString(),
          endTime: new Date(now.getTime() + Math.random() * 3600000).toISOString()
        } : undefined,
        lastSeen: new Date(now.getTime() - Math.random() * 300000).toISOString(),
        hasIssue,
        issueType: Math.random() > 0.5 ? 'frozen' : 'black-screen',
        hasNinjaOneAlert: hasNinjaAlert,
        ninjaOneError: hasNinjaAlert ? {
          type: Math.random() > 0.6 ? 'trackman_not_running' : Math.random() > 0.3 ? 'pc_offline' : 'app_crashed',
          detectedAt: new Date(now.getTime() - Math.random() * 600000).toISOString(),
          wasOperatorReset: false, // Not an operator reset
          duringBooking: isOccupied // Error during active booking
        } : undefined,
        criticalError: hasNinjaAlert && isOccupied && !false // Critical when error + booking + not operator reset
      };
    }),
    systemStatus: {
      music: Math.random() > 0.05,
      tv: Math.random() > 0.05,
      network: Math.random() > 0.02
    }
  }));
}

function getMockLocationStatus(location: string): LocationStatus {
  const now = new Date();
  const bayCount = location === 'Dartmouth' ? 4 : location === 'Bayers Lake' ? 4 : location === 'Stratford' ? 3 : 2;
  
  return {
    location,
    bays: Array.from({ length: bayCount }, (_, i) => ({
      location,
      bayNumber: i + 1,
      isOnline: Math.random() > 0.1,
      isOccupied: Math.random() > 0.4,
      bookingInfo: Math.random() > 0.4 ? {
        customerName: `Customer ${Math.floor(Math.random() * 100)}`,
        startTime: new Date(now.getTime() - Math.random() * 3600000).toISOString(),
        endTime: new Date(now.getTime() + Math.random() * 3600000).toISOString()
      } : undefined,
      lastSeen: new Date(now.getTime() - Math.random() * 300000).toISOString(),
      hasIssue: Math.random() > 0.9,
      issueType: Math.random() > 0.5 ? 'frozen' : 'black-screen'
    })),
    systemStatus: {
      music: Math.random() > 0.05,
      tv: Math.random() > 0.05,
      network: Math.random() > 0.02
    }
  };
}