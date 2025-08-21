import { useEffect, useRef } from 'react';
import { useAuthState, useStore } from '@/state/useStore';
import { tokenManager } from '@/utils/tokenManager';
import { useRouter } from 'next/router';

/**
 * Hook to handle app visibility changes (background/foreground)
 * Ensures proper auth state when app comes back from background
 */
export function useAppVisibility() {
  const router = useRouter();
  const { user, setUser, isAuthenticated, setAuthLoading } = useAuthState();
  const { setViewMode } = useStore();
  const lastCheckRef = useRef<number>(0);
  const checkInProgressRef = useRef<boolean>(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Debounce: Only check if at least 1 second has passed since last check
        const now = Date.now();
        if (now - lastCheckRef.current < 1000) {
          return;
        }
        lastCheckRef.current = now;
        
        // Prevent concurrent checks
        if (checkInProgressRef.current) {
          return;
        }
        checkInProgressRef.current = true;
        
        // App is visible again
        console.log('App became visible, checking auth state...');
        
        const storedUser = localStorage.getItem('clubos_user');
        const storedToken = localStorage.getItem('clubos_token');
        
        if (storedUser && storedToken) {
          // Check if token is still valid
          if (!tokenManager.isTokenExpired(storedToken)) {
            // Token is valid, ensure auth state is correct
            if (!isAuthenticated || !user) {
              try {
                const parsedUser = JSON.parse(storedUser);
                setUser({ ...parsedUser, token: storedToken });
                
                // Ensure correct view mode and navigation for customers
                if (parsedUser.role === 'customer') {
                  setViewMode('customer');
                  // If on a non-customer page, redirect to customer dashboard
                  if (!router.pathname.startsWith('/customer') && router.pathname !== '/') {
                    router.push('/customer');
                  }
                }
              } catch (error) {
                console.error('Failed to restore auth on visibility change:', error);
              }
            }
          } else {
            // Token expired while app was in background
            console.log('Token expired while app was in background');
            localStorage.removeItem('clubos_user');
            localStorage.removeItem('clubos_token');
            localStorage.removeItem('clubos_view_mode');
            
            // Only redirect if not already on login page
            if (router.pathname !== '/login') {
              router.push('/login');
            }
          }
        }
        
        // Clear loading state and reset check flag
        setAuthLoading(false);
        checkInProgressRef.current = false;
      }
    };

    // Only listen for visibility change, not focus (to prevent double-firing)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, user, setUser, setViewMode, router, setAuthLoading]);
}