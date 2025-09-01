import { http as api } from './http';

// API client for PC/software remote actions

export interface RemoteActionParams {
  action: 'restart-trackman' | 'restart-browser' | 'reboot-pc' | 'restart-all' | 'restart-music' | 'restart-tv' | 'other' | 'projector-power' | 'projector-input' | 'projector-autosize';
  location: string;
  bayNumber: string;
}

export interface RemoteActionResponse {
  success: boolean;
  message: string;
  jobId: string;
  device: string;
  simulated?: boolean;
  estimatedTime?: string;
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

export interface DeviceStatus {
  bay: string;
  name: string;
  deviceId: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
}

export const remoteActionsAPI = {
  // Execute a remote action (PC/software restart only)
  execute: async (params: RemoteActionParams): Promise<RemoteActionResponse> => {
    const response = await api.post('/remote-actions/execute', params);
    return response.data;
  },

  // Check job status
  getStatus: async (jobId: string): Promise<JobStatus> => {
    const response = await api.get(`/remote-actions/status/${jobId}`);
    return response.data;
  },

  // Get device status for a location
  getDeviceStatus: async (location: string): Promise<{ devices: DeviceStatus[]; demo?: boolean }> => {
    const response = await api.get(`/remote-actions/devices/${location}`);
    return response.data;
  }
};

// Helper functions for the UI
export const actionDescriptions: Record<string, string> = {
  'restart-trackman': 'Restart TrackMan Software',
  'restart-browser': 'Restart Browser Display',
  'reboot-pc': 'Reboot PC (3-5 min downtime)',
  'restart-all': 'Restart All Software'
};

export const actionWarnings: Record<string, string> = {
  'restart-trackman': 'This will close and restart TrackMan. Any active session will be interrupted.',
  'restart-browser': 'This will restart the browser with tournament display.',
  'reboot-pc': '⚠️ This will fully restart the PC. The bay will be unavailable for 3-5 minutes.',
  'restart-all': 'This will restart both TrackMan and the browser. Any active session will be interrupted.'
};

export const getActionIcon = (action: string): string => {
  const icons: Record<string, string> = {
    'restart-trackman': '🏌️',
    'restart-browser': '🌐',
    'reboot-pc': '💻',
    'restart-all': '🔄'
  };
  return icons[action] || '🔧';
};
