import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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
    const token = localStorage.getItem('clubos_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async createRemoteSession(location: string, bayNumber: string): Promise<RemoteSessionResponse> {
    try {
      const response = await axios.post(
        `${API_URL}/ninjaone-remote/session`,
        { location, bayNumber },
        { headers: this.getAuthHeaders() }
      );
      
      return response.data.data;
    } catch (error: any) {
      console.error('Failed to create remote session:', error);
      throw new Error(error.response?.data?.error || 'Failed to create remote session');
    }
  }

  async getDeviceInfo(location: string, bayNumber: string): Promise<DeviceInfoResponse> {
    try {
      const response = await axios.get(
        `${API_URL}/ninjaone-remote/device-info`,
        {
          params: { location, bayNumber },
          headers: this.getAuthHeaders()
        }
      );
      
      return response.data.data;
    } catch (error: any) {
      console.error('Failed to get device info:', error);
      throw new Error(error.response?.data?.error || 'Failed to get device information');
    }
  }
}

export const ninjaoneRemoteAPI = new NinjaOneRemoteAPI();