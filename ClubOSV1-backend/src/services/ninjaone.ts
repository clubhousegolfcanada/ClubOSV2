import axios, { AxiosInstance } from 'axios';
import { AppError } from '../middleware/errorHandler';

interface NinjaOneToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface NinjaOneDevice {
  id: string;
  name: string;
  online: boolean;
  lastSeen: string;
}

interface NinjaOneJob {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

class NinjaOneService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: process.env.NINJAONE_BASE_URL || 'https://api.ninjarmm.com',
      timeout: 30000,
    });
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post<NinjaOneToken>(
        `${process.env.NINJAONE_BASE_URL}/ws/oauth/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.NINJAONE_CLIENT_ID || '',
          client_secret: process.env.NINJAONE_CLIENT_SECRET || '',
          scope: 'monitoring management control'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry 5 minutes before actual expiry for safety
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('NinjaOne authentication failed:', error);
      throw new AppError('Failed to authenticate with NinjaOne', 500);
    }
  }

  async executeScript(
    deviceId: string, 
    scriptId: string, 
    parameters?: Record<string, any>
  ): Promise<NinjaOneJob> {
    const token = await this.getAccessToken();
    
    try {
      const response = await this.axiosInstance.post<NinjaOneJob>(
        `/v2/device/${deviceId}/script/${scriptId}/run`,
        { parameters },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Script execution failed:', error);
      throw new AppError('Failed to execute remote action', 500);
    }
  }

  async getJobStatus(jobId: string): Promise<NinjaOneJob> {
    const token = await this.getAccessToken();
    
    try {
      const response = await this.axiosInstance.get<NinjaOneJob>(
        `/v2/job/${jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get job status:', error);
      throw new AppError('Failed to get job status', 500);
    }
  }

  async getDevices(): Promise<NinjaOneDevice[]> {
    const token = await this.getAccessToken();
    
    try {
      const response = await this.axiosInstance.get<NinjaOneDevice[]>(
        '/v2/devices',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get devices:', error);
      throw new AppError('Failed to get devices', 500);
    }
  }

  async getDeviceStatus(deviceId: string): Promise<NinjaOneDevice> {
    const token = await this.getAccessToken();
    
    try {
      const response = await this.axiosInstance.get<NinjaOneDevice>(
        `/v2/device/${deviceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to get device status:', error);
      throw new AppError('Failed to get device status', 500);
    }
  }

  // Helper method to validate device is online before executing
  async validateDeviceOnline(deviceId: string): Promise<boolean> {
    try {
      const device = await this.getDeviceStatus(deviceId);
      return device.online;
    } catch (error) {
      return false;
    }
  }
}

export default new NinjaOneService();
