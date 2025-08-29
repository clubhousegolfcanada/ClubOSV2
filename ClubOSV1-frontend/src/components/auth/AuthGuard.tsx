import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import { tokenManager } from '@/utils/tokenManager';
import axios from 'axios';
import { getStorageItem } from '@/utils/iframeStorage';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const router = useRouter();
  const { isAuthenticated, user, setUser, setAuthLoading } = useAuthState();
  const [isChecking, setIsChecking] = useState(true);
  const checkTimeoutRef = useRef<NodeJS.Timeout>();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Only run on initial mount
    if (typeof window === 'undefined') return;
    
    // Prevent re-checking if already checked
    if (hasCheckedRef.current && isAuthenticated) {
      setIsChecking(false);
      return;
    }
    
    let isCheckInProgress = false;
    
    const checkAuth = async () => {
      // Prevent concurrent checks
      if (isCheckInProgress) return;
      isCheckInProgress = true;
      
      // Set a timeout to prevent infinite loading
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
      
      checkTimeoutRef.current = setTimeout(() => {
        console.warn('Auth check timeout - clearing loading state');
        setIsChecking(false);
        setAuthLoading(false);
        isCheckInProgress = false;
      }, 5000); // 5 second timeout
      
      try {
        // Add small delay to allow state to settle after login
        if (window.location.pathname !== '/login') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Check if user is stored in storage
        const storedUser = getStorageItem('clubos_user');
        const storedToken = getStorageItem('clubos_token');
        
        if (storedUser && storedToken) {
          // Always trust the stored token - let backend validate
          // CRITICAL: Set axios header
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          if (!user) {
            try {
              const parsedUser = JSON.parse(storedUser);
              setUser({ ...parsedUser, token: storedToken });
              hasCheckedRef.current = true;
            } catch (error) {
              console.error('Failed to parse stored user:', error);
              router.push('/login');
            }
          } else {
            hasCheckedRef.current = true;
          }
        } else if (!isAuthenticated && window.location.pathname !== '/login') {
          // No stored auth data and not on login page
          router.push('/login');
        }
      } finally {
        clearTimeout(checkTimeoutRef.current);
        setIsChecking(false);
        setAuthLoading(false);
        isCheckInProgress = false;
      }
    };

    // Check auth with a small delay to avoid race conditions
    const timeoutId = setTimeout(checkAuth, 50);
    
    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [isAuthenticated]); // Add isAuthenticated as dependency but with hasCheckedRef guard

  if (isChecking || !isAuthenticated) {
    return <>{fallback || <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>}</>;
  }

  return <>{children}</>;
};

export default AuthGuard;
