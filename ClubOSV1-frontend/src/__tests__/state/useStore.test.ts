import { renderHook, act } from '@testing-library/react';
import { useAuthState, useSettingsState } from '@/state/useStore';

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useAuthState', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset the store state
    const { result } = renderHook(() => useAuthState());
    act(() => {
      result.current.logout();
    });
  });

  it('initializes with null user', () => {
    const { result } = renderHook(() => useAuthState());
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logs in a user', () => {
    const { result } = renderHook(() => useAuthState());
    const testUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin' as const,
    };
    const token = 'test-token';

    act(() => {
      result.current.login(testUser, token);
    });

    expect(result.current.user).toEqual({ ...testUser, token });
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorageMock.getItem('clubos_token')).toBe(token);
  });

  it('logs out a user', () => {
    const { result } = renderHook(() => useAuthState());
    const testUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin' as const,
    };

    // First login
    act(() => {
      result.current.login(testUser, 'test-token');
    });

    // Then logout
    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorageMock.getItem('clubos_token')).toBeNull();
  });

  it('sets loading state', () => {
    const { result } = renderHook(() => useAuthState());

    act(() => {
      result.current.setAuthLoading(true);
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.setAuthLoading(false);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('persists user data across hook instances', () => {
    const { result: result1 } = renderHook(() => useAuthState());
    const testUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'operator' as const,
    };

    act(() => {
      result1.current.login(testUser, 'test-token');
    });

    // Create a new hook instance
    const { result: result2 } = renderHook(() => useAuthState());

    expect(result2.current.user).toEqual({ ...testUser, token: 'test-token' });
    expect(result2.current.isAuthenticated).toBe(true);
  });
});

describe('useSettingsState', () => {
  it('has default configuration', () => {
    const { result } = renderHook(() => useSettingsState());

    expect(result.current.config).toEqual({
      llmProvider: 'openai',
      llmModel: 'gpt-4',
      maxTokens: 1000,
      temperature: 0.7,
      confidenceThreshold: 0.8,
      rateLimitEnabled: true,
      rateLimitWindow: 60000,
      rateLimitMaxRequests: 10,
    });
  });

  it('has default preferences', () => {
    const { result } = renderHook(() => useSettingsState());

    expect(result.current.preferences).toEqual({
      defaultRoute: 'smart-routing',
      autoSubmit: false,
      soundEnabled: true,
      compactMode: false,
    });
  });

  it('updates configuration', () => {
    const { result } = renderHook(() => useSettingsState());
    const newConfig = {
      llmProvider: 'anthropic' as const,
      llmModel: 'claude-2',
      maxTokens: 2000,
      temperature: 0.5,
      confidenceThreshold: 0.9,
      rateLimitEnabled: false,
      rateLimitWindow: 30000,
      rateLimitMaxRequests: 5,
    };

    act(() => {
      result.current.updateConfig(newConfig);
    });

    expect(result.current.config).toEqual(newConfig);
  });

  it('updates preferences partially', () => {
    const { result } = renderHook(() => useSettingsState());

    act(() => {
      result.current.updatePreferences({
        autoSubmit: true,
        compactMode: true,
      });
    });

    expect(result.current.preferences).toEqual({
      defaultRoute: 'smart-routing',
      autoSubmit: true,
      soundEnabled: true,
      compactMode: true,
    });
  });
});