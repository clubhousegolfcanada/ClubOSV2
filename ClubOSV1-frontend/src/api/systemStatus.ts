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
      const response = await apiClient.get('/system-status/all');
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      // Return mock data for now
      return getMockStatus();
    }
  },

  // Get status for specific location
  getLocationStatus: async (location: string): Promise<LocationStatus | null> => {
    try {
      const response = await apiClient.get(`/system-status/${location}`);
      return response.data.data;
    } catch (error) {
      console.error(`Failed to fetch status for ${location}:`, error);
      return getMockLocationStatus(location);
    }
  },

  // Get bay occupancy
  getBayOccupancy: async (location: string, bayNumber: number): Promise<BayStatus | null> => {
    try {
      const response = await apiClient.get(`/system-status/${location}/bay/${bayNumber}`);
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
    bays: Array.from({ length: location === 'Dartmouth' ? 4 : location === 'Bayers Lake' ? 4 : location === 'Stratford' ? 3 : 2 }, (_, i) => ({
      location,
      bayNumber: i + 1,
      isOnline: Math.random() > 0.1, // 90% online
      isOccupied: Math.random() > 0.4, // 60% occupied
      bookingInfo: Math.random() > 0.4 ? {
        customerName: `Customer ${Math.floor(Math.random() * 100)}`,
        startTime: new Date(now.getTime() - Math.random() * 3600000).toISOString(),
        endTime: new Date(now.getTime() + Math.random() * 3600000).toISOString()
      } : undefined,
      lastSeen: new Date(now.getTime() - Math.random() * 300000).toISOString(),
      hasIssue: Math.random() > 0.9, // 10% have issues
      issueType: Math.random() > 0.5 ? 'frozen' : 'black-screen'
    })),
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