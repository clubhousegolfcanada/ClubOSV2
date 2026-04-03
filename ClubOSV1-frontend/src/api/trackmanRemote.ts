import { get, post, put, del } from './http';

export const trackmanRemoteAPI = {
  getDevices: () => get('/trackman-remote/devices'),
  registerDevice: (data: { hostname: string; display_name: string; location: string; bay_number?: number }) =>
    post('/trackman-remote/devices', data),
  removeDevice: (id: string) => del(`/trackman-remote/devices/${id}`),
  restartAll: () => post('/trackman-remote/restart', { all: true }),
  restartLocation: (location: string) => post('/trackman-remote/restart', { location }),
  restartDevices: (deviceIds: string[]) => post('/trackman-remote/restart', { deviceIds }),
  getHistory: (limit = 50) => get(`/trackman-remote/restart-history?limit=${limit}`),
  getSettings: () => get('/trackman-remote/settings'),
  updateSettings: (data: { enabled: boolean; cron: string; notify_slack: boolean }) =>
    put('/trackman-remote/settings', data),
};
