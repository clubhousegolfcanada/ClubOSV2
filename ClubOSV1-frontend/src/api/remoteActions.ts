import api from './index';

export interface RemoteActionParams {
  action: string;
  location: string;
  bayNumber?: string;
  systemType?: string;
}

export interface RemoteActionResponse {
  success: boolean;
  message: string;
  jobId: string;
  device: string;
  simulated?: boolean;
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

export interface RecentAction {
  action_type: string;
  location: string;
  device_name: string;
  initiated_by: string;
  status: string;
  created_at: string;
}

export interface RemoteActionStats {
  totalActions: number;
  successRate: number;
  last24h: number;
  mostCommonAction: string;
}

export const remoteActionsAPI = {
  // Execute a remote action
  execute: async (params: RemoteActionParams): Promise<RemoteActionResponse> => {
    const response = await api.post('/remote-actions/execute', params);
    return response.data;
  },

  // Check job status
  getStatus: async (jobId: string): Promise<JobStatus> => {
    const response = await api.get(`/remote-actions/status/${jobId}`);
    return response.data;
  },

  // Get recent actions
  getRecent: async (): Promise<{ actions: RecentAction[] }> => {
    const response = await api.get('/remote-actions/recent');
    return response.data;
  },

  // Get statistics
  getStats: async (): Promise<RemoteActionStats> => {
    const response = await api.get('/remote-actions/stats');
    return response.data;
  }
};
