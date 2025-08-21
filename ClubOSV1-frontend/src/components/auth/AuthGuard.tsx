import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import { tokenManager } from '@/utils/tokenManager';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const router = useRouter();
  const { isAuthenticated, user, setUser, setAuthLoading } = useAuthState();
  const [isChecking, setIsChecking] = useState(true);
  const checkTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Only run on initial mount
    if (typeof window === 'undefined') return;
    
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
        // Check if user is stored in localStorage
        const storedUser = localStorage.getItem('clubos_user');
        const storedToken = localStorage.getItem('clubos_token');
        
        if (storedUser && storedToken) {
          // Check if token is still valid
          if (!tokenManager.isTokenExpired(storedToken)) {
            if (!user) {
              try {
                const parsedUser = JSON.parse(storedUser);
                setUser({ ...parsedUser, token: storedToken });
              } catch (error) {
                console.error('Failed to parse stored user:', error);
                localStorage.removeItem('clubos_user');
                localStorage.removeItem('clubos_token');
                router.push('/login');
              }
            }
          } else {
            // Token expired, clear and redirect
            localStorage.removeItem('clubos_user');
            localStorage.removeItem('clubos_token');
            localStorage.removeItem('clubos_view_mode');
            router.push('/login');
          }
        } else if (!isAuthenticated) {
          // No stored auth data
          router.push('/login');
        }
      } finally {
        clearTimeout(checkTimeoutRef.current);
        setIsChecking(false);
        setAuthLoading(false);
        isCheckInProgress = false;
      }
    };

    // Check auth immediately
    checkAuth();
    
    // Cleanup
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, []); // Remove dependencies to prevent re-running

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
