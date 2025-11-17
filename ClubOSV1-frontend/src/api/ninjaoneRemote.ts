import { http } from '@/api/http';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';

export interface RemoteSessionResponse {
  method: 'ninjaone' | 'fallback';
  sessionUrl?: string;
  sessionId?: string;
  deviceName: string;
  message?: string;
  fallbackUrl?: string;
  ninjaConsoleUrl?: string;
  expiresAt?: string;
}

export interface DeviceInfoResponse {
  deviceId: string;
  name: string;
  type: string;
  location: string;
  bayNumber: string;
  configured: boolean;
}

class NinjaOneRemoteAPI {
  private getAuthHeaders() {
    const token = tokenManager.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async createRemoteSession(location: string, bayNumber: string): Promise<RemoteSessionResponse> {
    try {
      const response = await http.post(
        `ninjaone-remote/session`,
        { location, bayNumber }
      );
      
      return response.data.data;
    } catch (error: any) {
      logger.error('Failed to create remote session:', error);
      throw new Error(error.response?.data?.error || 'Failed to create remote session');
    }
  }

  async getDeviceInfo(location: string, bayNumber: string): Promise<DeviceInfoResponse> {
    try {
      const response = await http.get(
        `ninjaone-remote/device-info`,
        {
          params: { location, bayNumber }
        }
      );
      
      return response.data.data;
    } catch (error: any) {
      logger.error('Failed to get device info:', error);
      throw new Error(error.response?.data?.error || 'Failed to get device information');
    }
  }
}

export const ninjaoneRemoteAPI = new NinjaOneRemoteAPI();