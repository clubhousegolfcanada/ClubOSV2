import { useEffect } from 'react';
import { useAuthState, useStore } from '@/state/useStore';
import { tokenManager } from '@/utils/tokenManager';
import { useRouter } from 'next/router';

/**
 * Hook to handle app visibility changes (background/foreground)
 * Ensures proper auth state when app comes back from background
 */
export function useAppVisibility() {
  const router = useRouter();
  const { user, setUser, isAuthenticated } = useAuthState();
  const { setViewMode } = useStore();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
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
                
                // Ensure correct view mode for customers
                if (parsedUser.role === 'customer') {
                  setViewMode('customer');
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
      }
    };

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for focus events (sometimes more reliable on mobile)
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isAuthenticated, user, setUser, setViewMode, router]);
}