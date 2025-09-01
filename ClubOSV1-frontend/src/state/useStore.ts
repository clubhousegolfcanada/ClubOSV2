import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RequestRoute } from '@/types/request';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/utils/iframeStorage';
import { tokenManager } from '@/utils/tokenManager';

// Export UserRole type
export type UserRole = 'admin' | 'operator' | 'support' | 'kiosk' | 'customer';
export type ViewMode = 'operator' | 'customer';

// User type for user management
export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
  updatedAt: string;
};

// Define the missing types locally
type ProcessedRequest = {
  id: string;
  userId: string;
  requestDescription: string;
  location?: string;
  routePreference?: RequestRoute;
  smartAssistEnabled: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  sessionId: string;
  timestamp: string;
  botRoute?: string;
  llmResponse?: {
    response: string;
    confidence?: number;
    suggestedActions?: string[];
    extractedInfo?: any;
  };
  processingTime?: number;
};

type SystemConfig = {
  llmProvider: 'openai' | 'anthropic' | 'local';
  llmModel: string;
  maxTokens: number;
  temperature: number;
  confidenceThreshold: number;
  rateLimitEnabled: boolean;
  rateLimitWindow: number;
  rateLimitMaxRequests: number;
};

// Types
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'support' | 'kiosk' | 'customer';
  phone?: string;
  token?: string;
  created_at?: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: AuthUser, token: string) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  setAuthLoading: (isLoading: boolean) => void;
}

interface SettingsState {
  config: SystemConfig;
  preferences: {
    defaultRoute: RequestRoute;
    autoSubmit: boolean;
    soundEnabled: boolean;
    compactMode: boolean;
  };
  updateConfig: (config: SystemConfig) => void;
  updatePreferences: (prefs: Partial<SettingsState['preferences']>) => void;
  resetSettings: () => void;
}

interface AppState {
  users: User[];
  setUsers: (users: User[]) => void;
  requests: ProcessedRequest[];
  addRequest: (request: ProcessedRequest) => void;
  updateRequest: (id: string, updates: Partial<ProcessedRequest>) => void;
  clearRequests: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

// Default values
const defaultConfig: SystemConfig = {
  llmProvider: 'openai',
  llmModel: 'gpt-4-turbo-preview',
  maxTokens: 1000,
  temperature: 0.7,
  confidenceThreshold: 0.7,
  rateLimitEnabled: true,
  rateLimitWindow: 60000,
  rateLimitMaxRequests: 100
};

const defaultPreferences = {
  defaultRoute: 'Auto' as RequestRoute,
  autoSubmit: false,
  soundEnabled: true,
  compactMode: false
};

// Auth Store
export const useAuthState = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false, // Default to false to prevent stuck loading states
      login: (user, token) => {
        // Clear only auth-related data, not everything
        tokenManager.clearToken();
        removeStorageItem('clubos_user');
        removeStorageItem('clubos_view_mode');
        
        // Set new auth data using iframe-safe storage
        tokenManager.setToken(token);
        setStorageItem('clubos_user', JSON.stringify(user));
        
        // CRITICAL: Set axios default header for all requests
        // Auth header now handled by http client
        
        // Set view mode based on user role
        const viewMode = user.role === 'customer' ? 'customer' : 'operator';
        setStorageItem('clubos_view_mode', viewMode);
        
        // Store login timestamp for grace period
        sessionStorage.setItem('clubos_login_timestamp', Date.now().toString());
        
        set({ 
          user: { ...user, token }, 
          isAuthenticated: true,
          isLoading: false 
        });
      },
      setUser: (user) => {
        // If user is provided but no token, try to get from storage
        if (user && !user.token && typeof window !== 'undefined') {
          const token = tokenManager.getToken();
          if (token) {
            user.token = token;
            // Set axios header when restoring user
            // Auth header now handled by http client
          }
        } else if (user?.token) {
          // Auth header now handled automatically by http client
        }
        set({ user, isAuthenticated: !!user });
      },
      logout: async () => {
        // First, try to invalidate token on server
        if (typeof window !== 'undefined') {
          const token = tokenManager.getToken();
          if (token) {
            try {
              // Call server logout endpoint to invalidate token
              // Using dynamic import to avoid circular dependency
              const { http } = await import('@/api/http');
              await http.post('auth/logout', {}, { 
                timeout: 5000 // 5 second timeout for logout
              });
            } catch (error) {
              // Log error but continue with client-side cleanup
              // Logout should not fail even if server is unreachable
              console.error('Server logout failed:', error);
            }
          }
          
          // Clear axios authorization header
          // Auth header cleanup now handled by http client
          
          // Clear all localStorage items
          tokenManager.clearToken();
          localStorage.removeItem('clubos_user');
          localStorage.removeItem('clubos_view_mode');
          
          // Clear any other auth-related items
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('clubos_') || key.includes('auth'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          
          // Clear session storage as well
          sessionStorage.clear();
        }
        
        // Complete state reset - clear auth state completely
        set({ 
          user: null, 
          isAuthenticated: false, 
          isLoading: false 
        });
        
        // Also reset app state that might contain user-specific data
        const state = useStore.getState();
        state.clearRequests?.();
        state.setViewMode?.('operator'); // Reset to default view mode
        
        // Small delay to ensure state is cleared before navigation
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            // Import router dynamically to avoid SSR issues
            import('next/router').then(({ default: router }) => {
              router.push('/login');
            });
          }
        }, 100);
      },
      setAuthLoading: (isLoading) => set({ isLoading })
    }),
    {
      name: 'clubos-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      // On rehydration, restore the token from storage
      onRehydrateStorage: () => (state) => {
        if (state && state.user && typeof window !== 'undefined') {
          const token = tokenManager.getToken();
          if (token) {
            state.user.token = token;
            // Set axios header on rehydration
            // Auth header now handled by http client
          }
        }
      }
    }
  )
);

// App Store
export const useStore = create<AppState>((set) => ({
  users: [],
  setUsers: (users) => set({ users }),
  requests: [],
  addRequest: (request) => set((state) => ({ 
    requests: [...state.requests, request] 
  })),
  updateRequest: (id, updates) => set((state) => ({
    requests: state.requests.map((req) => 
      req.id === id ? { ...req, ...updates } : req
    )
  })),
  clearRequests: () => set({ requests: [] }),
  viewMode: (typeof window !== 'undefined' && localStorage.getItem('clubos_view_mode') as ViewMode) || 'operator',
  setViewMode: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('clubos_view_mode', mode);
    }
    set({ viewMode: mode });
  }
}));

// Settings Store
export const useSettingsState = create<SettingsState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      preferences: defaultPreferences,
      updateConfig: (config) => set({ config }),
      updatePreferences: (prefs) => set((state) => ({
        preferences: { ...state.preferences, ...prefs }
      })),
      resetSettings: () => set({ 
        config: defaultConfig, 
        preferences: defaultPreferences 
      })
    }),
    {
      name: 'clubos-settings'
    }
  )
);
