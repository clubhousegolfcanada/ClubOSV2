import apiClient from './apiClient';

export interface UnifiDoor {
  id: string;
  name: string;
  description: string;
  location: string;
  canUnlock: boolean;
}

export interface UnlockParams {
  location: string;
  doorKey: string;
  duration?: number;
}

export interface DoorStatus {
  id: string;
  name: string;
  location: string;
  locked: boolean;
  online: boolean;
  canUnlock: boolean;
}

export const unifiDoorsAPI = {
  // Get all available doors
  getDoors: async (): Promise<{ success: boolean; doors: UnifiDoor[] }> => {
    const response = await apiClient.get('/api/unifi-doors/doors');
    return response.data;
  },

  // Unlock a specific door
  unlock: async (params: UnlockParams): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(
      `/api/unifi-doors/doors/${params.location.toLowerCase()}/${params.doorKey}/unlock`,
      { duration: params.duration || 30 }
    );
    return response.data;
  },

  // Get door status
  getStatus: async (location: string, doorKey: string): Promise<{ success: boolean; status: DoorStatus }> => {
    const response = await apiClient.get(
      `/api/unifi-doors/doors/${location.toLowerCase()}/${doorKey}/status`
    );
    return response.data;
  }
};