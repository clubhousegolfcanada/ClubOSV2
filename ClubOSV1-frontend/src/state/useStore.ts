import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RequestRoute } from '@/types/request';

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
  role: 'admin' | 'operator' | 'support';
  phone?: string;
  token?: string;
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
      isLoading: true,
      login: (user, token) => {
        localStorage.setItem('clubos_token', token);
        localStorage.setItem('clubos_user', JSON.stringify(user));
        set({ 
          user: { ...user, token }, 
          isAuthenticated: true,
          isLoading: false 
        });
      },
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => {
        localStorage.removeItem('clubos_token');
        localStorage.removeItem('clubos_user');
        set({ user: null, isAuthenticated: false });
      },
      setAuthLoading: (isLoading) => set({ isLoading })
    }),
    {
      name: 'clubos-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated })
    }
  )
);

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
