import apiClient from './apiClient';

export interface DoorConfig {
  doorId: string;
  name: string;
  type: 'exterior' | 'staff' | 'emergency' | 'interior';
}

export interface DoorStatus {
  doorId: string;
  name: string;
  locked: boolean;
  online: boolean;
  lastActivity?: string;
  battery?: number;
}

export interface UnlockParams {
  location: string;
  doorKey: string;
  duration?: number;
  reason?: string;
}

export interface LockParams {
  location: string;
  doorKey: string;
}

export interface EmergencyParams {
  action: 'unlock_all' | 'lockdown';
  location: string;
}

export interface DoorAccessLog {
  action_type: string;
  door_name: string;
  initiated_by: string;
  duration_seconds?: number;
  reason?: string;
  status: string;
  created_at: string;
}

export const doorAccessAPI = {
  // Unlock a door
  unlock: async (params: UnlockParams) => {
    const response = await apiClient.post('/door-access/unlock', params);
    return response.data;
  },

  // Lock a door
  lock: async (params: LockParams) => {
    const response = await apiClient.post('/door-access/lock', params);
    return response.data;
  },

  // Get door status for a location
  getStatus: async (location: string) => {
    const response = await apiClient.get(`/door-access/status/${location}`);
    return response.data;
  },

  // Emergency actions
  emergency: async (params: EmergencyParams) => {
    const response = await apiClient.post('/door-access/emergency', params);
    return response.data;
  },

  // Get access logs
  getLogs: async (location: string, doorKey?: string, limit: number = 20) => {
    const params = new URLSearchParams();
    if (doorKey) params.append('doorKey', doorKey);
    params.append('limit', limit.toString());
    
    const response = await apiClient.get(`/door-access/logs/${location}?${params}`);
    return response.data;
  },

  // Get available doors for a location
  getDoors: async (location: string) => {
    const response = await apiClient.get(`/door-access/doors/${location}`);
    return response.data;
  }
};