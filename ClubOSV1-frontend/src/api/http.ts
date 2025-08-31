import axios from 'axios';
import { resolveApi } from '@/utils/resolveApi';

export const http = axios.create({
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

http.interceptors.request.use(cfg => {
  if (cfg.url && !/^https?:\/\//i.test(cfg.url)) {
    if (cfg.url.startsWith('/api/')) {
      throw new Error(`Do not include '/api' in request path: '${cfg.url}'`);
    }
    cfg.url = resolveApi(cfg.url);
  }
  
  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('clubos_token');
    if (token && cfg.headers) {
      cfg.headers.Authorization = `Bearer ${token}`;
    }
  }
  
  return cfg;
});