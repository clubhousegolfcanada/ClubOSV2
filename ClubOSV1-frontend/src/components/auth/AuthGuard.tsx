import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import { tokenManager } from '@/utils/tokenManager';
import { getStorageItem } from '@/utils/iframeStorage';
import { http } from '@/api/http';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Debug flag - set via environment variable or localStorage
const DEBUG_AUTH = process.env.NODE_ENV === 'development' && 
  (process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true' || 
   (typeof window !== 'undefined' && localStorage.getItem('debug_auth') === 'true'));

const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const router = useRouter();
  const { isAuthenticated, user, setUser, setAuthLoading } = useAuthState();
  const [isChecking, setIsChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const checkTimeoutRef = useRef<NodeJS.Timeout>();
  const hasCheckedRef = useRef(false);
  const isCheckInProgressRef = useRef(false);

  // Secure logging helper
  const secureLog = (message: string, data?: any) => {
    if (!DEBUG_AUTH) return;
    
    // Never log sensitive data
    const sanitized = data ? {
      ...data,
      token: data.token ? '[REDACTED]' : undefined,
      password: data.password ? '[REDACTED]' : undefined,
      email: data.email ? data.email.replace(/(.{2}).*(@.*)/, '$1***$2') : undefined
    } : undefined;
    
    console.log(`[AuthGuard] ${message}`, sanitized || '');
  };

  // Validate token format (basic validation)
  const isValidTokenFormat = (token: string): boolean => {
    if (!token) return false;
    
    // Check for JWT format (header.payload.signature)
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    
    // Check for bearer token format
    const bearerRegex = /^Bearer\s+[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    
    return jwtRegex.test(token) || bearerRegex.test(token);
  };

  // Verify token with backend (optional, for critical operations)
  const verifyTokenWithBackend = async (token: string): Promise<boolean> => {
    try {
      const response = await http.get('auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data?.success === true;
    } catch (error) {
      secureLog('Token verification failed', { error: (error as any)?.message });
      return false;
    }
  };

  useEffect(() => {
    // Only run on initial mount
    if (typeof window === 'undefined') return;
    
    // Prevent re-checking if already checked and authenticated
    if (hasCheckedRef.current && isAuthenticated) {
      secureLog('Skipping auth check - already authenticated');
      setIsChecking(false);
      return;
    }
    
    const checkAuth = async () => {
      // Prevent concurrent checks using ref instead of local variable
      if (isCheckInProgressRef.current) {
        secureLog('Auth check already in progress, skipping');
        return;
      }
      isCheckInProgressRef.current = true;
      
      secureLog('Starting auth check', { 
        pathname: window.location.pathname,
        hasUser: !!user,
        isAuthenticated 
      });
      
      // Set a configurable timeout
      const AUTH_CHECK_TIMEOUT = parseInt(
        process.env.NEXT_PUBLIC_AUTH_TIMEOUT || '5000'
      );
      
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
      
      checkTimeoutRef.current = setTimeout(() => {
        secureLog('Auth check timeout - clearing loading state');
        setIsChecking(false);
        setAuthLoading(false);
        isCheckInProgressRef.current = false;
        setAuthError('Authentication check timed out');
      }, AUTH_CHECK_TIMEOUT);
      
      try {
        // Add small delay to allow state to settle after login
        if (window.location.pathname !== '/login') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Check if user is stored in storage
        const storedUser = getStorageItem('clubos_user');
        const storedToken = tokenManager.getToken();
        
        secureLog('Retrieved stored data', { 
          hasUser: !!storedUser, 
          hasToken: !!storedToken 
        });
        
        if (storedUser && storedToken) {
          // Validate token format
          if (!isValidTokenFormat(storedToken)) {
            secureLog('Invalid token format detected');
            setAuthError('Invalid authentication token');
            tokenManager.clearToken();
            router.push('/login');
            return;
          }
          
          // Check if token is expired
          if (tokenManager.isTokenExpired(storedToken)) {
            secureLog('Token is expired');
            setAuthError('Session has expired');
            tokenManager.clearToken();
            router.push('/login');
            return;
          }
          
          // For critical operations, verify with backend
          // Uncomment if backend supports /auth/verify endpoint
          // const isValid = await verifyTokenWithBackend(storedToken);
          // if (!isValid) {
          //   secureLog('Backend token verification failed');
          //   setAuthError('Authentication verification failed');
          //   tokenManager.clearToken();
          //   router.push('/login');
          //   return;
          // }
          
          if (!user) {
            try {
              const parsedUser = JSON.parse(storedUser);
              // Sanitize user data before setting
              const sanitizedUser = {
                ...parsedUser,
                token: storedToken,
                // Remove any sensitive fields that shouldn't be in state
                password: undefined,
                refreshToken: undefined
              };
              
              secureLog('Setting user from storage', { 
                userId: sanitizedUser.id,
                role: sanitizedUser.role 
              });
              
              setUser(sanitizedUser);
              hasCheckedRef.current = true;
              setAuthError(null);
            } catch (error) {
              secureLog('Failed to parse stored user', { error: (error as any)?.message });
              setAuthError('Failed to restore session');
              
              // Clear corrupted data
              localStorage.removeItem('clubos_user');
              tokenManager.clearToken();
              router.push('/login');
            }
          } else {
            hasCheckedRef.current = true;
            setAuthError(null);
          }
        } else if (!isAuthenticated && window.location.pathname !== '/login') {
          // No stored auth data and not on login page
          secureLog('No auth data found, redirecting to login');
          router.push('/login');
        }
      } catch (error) {
        secureLog('Auth check error', { error: (error as any)?.message });
        setAuthError('Authentication check failed');
        
        // Only redirect to login if not already there
        if (window.location.pathname !== '/login') {
          router.push('/login');
        }
      } finally {
        if (checkTimeoutRef.current) {
          clearTimeout(checkTimeoutRef.current);
        }
        setIsChecking(false);
        setAuthLoading(false);
        isCheckInProgressRef.current = false;
        
        secureLog('Auth check completed', { 
          isAuthenticated,
          hasError: !!authError 
        });
      }
    };

    // Use requestAnimationFrame to avoid race conditions
    const rafId = requestAnimationFrame(() => {
      checkAuth();
    });
    
    // Cleanup
    return () => {
      cancelAnimationFrame(rafId);
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
      isCheckInProgressRef.current = false;
    };
  }, [isAuthenticated, router, user, setUser, setAuthLoading, authError]);

  // Show error state if there's an auth error
  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-4">{authError}</p>
          <button
            onClick={() => {
              setAuthError(null);
              hasCheckedRef.current = false;
              window.location.href = '/login';
            }}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // Show loading state while checking auth
  if (isChecking || !isAuthenticated) {
    return (
      <>
        {fallback || (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Verifying authentication...</p>
            </div>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
};

export default AuthGuard;