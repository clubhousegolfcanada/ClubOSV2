import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { 
  UserRequest, 
  ProcessedRequest, 
  RequestRoute, 
  HistoryEntry,
  SystemConfig,
  BotRoute 
} from '@/types/request';

export type UserRole = 'admin' | 'operator' | 'support';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  token?: string;
}

// Request slice
interface RequestSlice {
  currentRequest: Partial<UserRequest> | null;
  isSubmitting: boolean;
  lastResponse: ProcessedRequest | null;
  error: string | null;
  
  // Actions
  setCurrentRequest: (request: Partial<UserRequest>) => void;
  clearCurrentRequest: () => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setLastResponse: (response: ProcessedRequest | null) => void;
  setError: (error: string | null) => void;
  resetRequestState: () => void;
}

// History slice
interface HistorySlice {
  entries: HistoryEntry[];
  isLoading: boolean;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  filter: {
    status?: string;
    botRoute?: string;
    dateRange?: { start: Date; end: Date };
  };
  
  // Actions
  addHistoryEntry: (entry: HistoryEntry) => void;
  setHistoryEntries: (entries: HistoryEntry[]) => void;
  setHistoryLoading: (isLoading: boolean) => void;
  setHistoryFilter: (filter: Partial<HistorySlice['filter']>) => void;
  clearHistoryFilter: () => void;
  setHistoryPagination: (page: number, pageSize?: number) => void;
}

// Settings slice
interface SettingsSlice {
  config: SystemConfig;
  preferences: {
    defaultRoute: RequestRoute;
    autoSubmit: boolean;
    soundEnabled: boolean;
    compactMode: boolean;
  };
  
  // Actions
  updateConfig: (config: Partial<SystemConfig>) => void;
  updatePreferences: (prefs: Partial<SettingsSlice['preferences']>) => void;
  resetSettings: () => void;
}

// Analytics slice
interface AnalyticsSlice {
  stats: {
    totalRequests: number;
    successRate: number;
    avgResponseTime: number;
    routeDistribution: Record<BotRoute, number>;
    peakHour: number;
  };
  isLoading: boolean;
  period: '1h' | '24h' | '7d' | '30d';
  
  // Actions
  setStats: (stats: Partial<AnalyticsSlice['stats']>) => void;
  setAnalyticsPeriod: (period: AnalyticsSlice['period']) => void;
  setAnalyticsLoading: (isLoading: boolean) => void;
}

// Auth slice
interface AuthSlice {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (user: AuthUser, token: string) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  setAuthLoading: (isLoading: boolean) => void;
}

// UI slice
interface UISlice {
  sidebarOpen: boolean;
  activeModal: string | null;
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
  }>;
  demoMode: boolean;
  
  // Actions
  toggleSidebar: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  addNotification: (notification: Omit<UISlice['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  setDemoMode: (enabled: boolean) => void;
}

// Combined store type
export interface StoreState extends RequestSlice, HistorySlice, SettingsSlice, AnalyticsSlice, AuthSlice, UISlice {}

// Default values
const defaultConfig: SystemConfig = {
  llmEnabled: true,
  slackFallbackEnabled: true,
  maxRetries: 3,
  requestTimeout: 30000,
  dataRetentionDays: 90,
};

const defaultPreferences = {
  defaultRoute: 'Auto' as RequestRoute,
  autoSubmit: false,
  soundEnabled: true,
  compactMode: false,
};

// Create the store
export const useStore = create<StoreState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Request State
        currentRequest: null,
        isSubmitting: false,
        lastResponse: null,
        error: null,
        
        setCurrentRequest: (request) => set((state) => {
          state.currentRequest = request;
          state.error = null;
        }),
        
        clearCurrentRequest: () => set((state) => {
          state.currentRequest = null;
        }),
        
        setSubmitting: (isSubmitting) => set((state) => {
          state.isSubmitting = isSubmitting;
        }),
        
        setLastResponse: (response) => set((state) => {
          state.lastResponse = response;
          if (response) {
            // Add to history
            const historyEntry: HistoryEntry = {
              id: response.id,
              timestamp: response.timestamp,
              request: {
                id: response.id,
                requestDescription: response.requestDescription,
                location: response.location,
                routePreference: response.routePreference,
                smartAssistEnabled: response.smartAssistEnabled,
                timestamp: response.timestamp,
                status: response.status,
                sessionId: response.sessionId,
              },
              response: response,
              duration: response.processingTime || 0,
            };
            state.entries.unshift(historyEntry);
            if (state.entries.length > 100) {
              state.entries = state.entries.slice(0, 100);
            }
          }
        }),
        
        setError: (error) => set((state) => {
          state.error = error;
          state.isSubmitting = false;
        }),
        
        resetRequestState: () => set((state) => {
          state.currentRequest = null;
          state.isSubmitting = false;
          state.error = null;
        }),
        
        // History State
        entries: [],
        isLoading: false,
        totalCount: 0,
        currentPage: 1,
        pageSize: 20,
        filter: {},
        
        addHistoryEntry: (entry) => set((state) => {
          state.entries.unshift(entry);
          state.totalCount += 1;
        }),
        
        setHistoryEntries: (entries) => set((state) => {
          state.entries = entries;
          state.totalCount = entries.length;
        }),
        
        setHistoryLoading: (isLoading) => set((state) => {
          state.isLoading = isLoading;
        }),
        
        setHistoryFilter: (filter) => set((state) => {
          state.filter = { ...state.filter, ...filter };
          state.currentPage = 1; // Reset to first page on filter change
        }),
        
        clearHistoryFilter: () => set((state) => {
          state.filter = {};
          state.currentPage = 1;
        }),
        
        setHistoryPagination: (page, pageSize) => set((state) => {
          state.currentPage = page;
          if (pageSize) state.pageSize = pageSize;
        }),
        
        // Settings State
        config: defaultConfig,
        preferences: defaultPreferences,
        
        updateConfig: (config) => set((state) => {
          state.config = { ...state.config, ...config };
        }),
        
        updatePreferences: (prefs) => set((state) => {
          state.preferences = { ...state.preferences, ...prefs };
        }),
        
        resetSettings: () => set((state) => {
          state.config = defaultConfig;
          state.preferences = defaultPreferences;
        }),
        
        // Auth State
        user: null,
        isAuthenticated: false,
        isLoading: false,
        
        login: (user, token) => set((state) => {
          const authUser = { ...user, token };
          state.user = authUser;
          state.isAuthenticated = true;
          // Store in localStorage
          localStorage.setItem('clubos_token', token);
          localStorage.setItem('clubos_user', JSON.stringify(authUser));
        }),
        
        setUser: (user) => set((state) => {
          state.user = user;
          state.isAuthenticated = !!user;
          if (user?.token) {
            // Store token in localStorage for API calls
            localStorage.setItem('clubos_token', user.token);
          }
        }),
        
        logout: () => {
          set((state) => {
            state.user = null;
            state.isAuthenticated = false;
            // Clear sensitive data
            state.currentRequest = null;
            state.lastResponse = null;
            state.entries = [];
          });
          // Clear localStorage
          localStorage.removeItem('clubos_token');
          localStorage.removeItem('clubos_user');
          // Redirect to login
          window.location.href = '/login';
        },
        
        setAuthLoading: (isLoading) => set((state) => {
          state.isLoading = isLoading;
        }),
        
        // Analytics State
        stats: {
          totalRequests: 0,
          successRate: 0,
          avgResponseTime: 0,
          routeDistribution: {} as Record<BotRoute, number>,
          peakHour: 0,
        },
        isLoading: false,
        period: '24h',
        
        setStats: (stats) => set((state) => {
          state.stats = { ...state.stats, ...stats };
        }),
        
        setAnalyticsPeriod: (period) => set((state) => {
          state.period = period;
        }),
        
        setAnalyticsLoading: (isLoading) => set((state) => {
          state.isLoading = isLoading;
        }),
        
        // UI State
        sidebarOpen: true,
        activeModal: null,
        notifications: [],
        demoMode: false,
        
        toggleSidebar: () => set((state) => {
          state.sidebarOpen = !state.sidebarOpen;
        }),
        
        openModal: (modalId) => set((state) => {
          state.activeModal = modalId;
        }),
        
        closeModal: () => set((state) => {
          state.activeModal = null;
        }),
        
        addNotification: (notification) => set((state) => {
          const id = Math.random().toString(36).substr(2, 9);
          state.notifications.push({
            ...notification,
            id,
            timestamp: Date.now(),
          });
          
          // Auto-remove after 5 seconds
          setTimeout(() => {
            get().removeNotification(id);
          }, 5000);
        }),
        
        removeNotification: (id) => set((state) => {
          state.notifications = state.notifications.filter(n => n.id !== id);
        }),
        
        clearNotifications: () => set((state) => {
          state.notifications = [];
        }),
        
        setDemoMode: (enabled) => set((state) => {
          state.demoMode = enabled;
        }),
      })),
      {
        name: 'clubos-store',
        partialize: (state) => ({
          preferences: state.preferences,
          config: state.config,
        }),
      }
    ),
    {
      name: 'ClubOS Store',
    }
  )
);

// Selectors (for better performance)
export const useRequestState = () => useStore((state) => ({
  currentRequest: state.currentRequest,
  isSubmitting: state.isSubmitting,
  lastResponse: state.lastResponse,
  error: state.error,
  setCurrentRequest: state.setCurrentRequest,
  clearCurrentRequest: state.clearCurrentRequest,
  setSubmitting: state.setSubmitting,
  setLastResponse: state.setLastResponse,
  setError: state.setError,
  resetRequestState: state.resetRequestState,
}));

export const useHistoryState = () => useStore((state) => ({
  entries: state.entries,
  isLoading: state.isLoading,
  totalCount: state.totalCount,
  currentPage: state.currentPage,
  pageSize: state.pageSize,
  filter: state.filter,
  addHistoryEntry: state.addHistoryEntry,
  setHistoryEntries: state.setHistoryEntries,
  setHistoryLoading: state.setHistoryLoading,
  setHistoryFilter: state.setHistoryFilter,
  clearHistoryFilter: state.clearHistoryFilter,
  setHistoryPagination: state.setHistoryPagination,
}));

export const useSettingsState = () => useStore((state) => ({
  config: state.config,
  preferences: state.preferences,
  updateConfig: state.updateConfig,
  updatePreferences: state.updatePreferences,
  resetSettings: state.resetSettings,
}));

export const useAnalyticsState = () => useStore((state) => ({
  stats: state.stats,
  isLoading: state.isLoading,
  period: state.period,
  setStats: state.setStats,
  setAnalyticsPeriod: state.setAnalyticsPeriod,
  setAnalyticsLoading: state.setAnalyticsLoading,
}));

export const useAuthState = () => useStore((state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  isLoading: state.isLoading,
  login: state.login,
  setUser: state.setUser,
  logout: state.logout,
  setAuthLoading: state.setAuthLoading,
}));

export const useUIState = () => useStore((state) => ({
  sidebarOpen: state.sidebarOpen,
  activeModal: state.activeModal,
  notifications: state.notifications,
  demoMode: state.demoMode,
  toggleSidebar: state.toggleSidebar,
  openModal: state.openModal,
  closeModal: state.closeModal,
  addNotification: state.addNotification,
  removeNotification: state.removeNotification,
  clearNotifications: state.clearNotifications,
  setDemoMode: state.setDemoMode,
}));
