import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import { tokenManager } from '@/utils/tokenManager';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const router = useRouter();
  const { isAuthenticated, user, setUser } = useAuthState();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Only run on initial mount
    if (typeof window === 'undefined') return;
    
    const checkAuth = () => {
      // Check if user is stored in localStorage (for page refresh or app resume)
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
          setIsChecking(false);
        } else {
          // Token expired, clear and redirect
          localStorage.removeItem('clubos_user');
          localStorage.removeItem('clubos_token');
          localStorage.removeItem('clubos_view_mode');
          setIsChecking(false);
          router.push('/login');
        }
      } else if (!isAuthenticated) {
        // No stored auth data
        setIsChecking(false);
        router.push('/login');
      } else {
        // Already authenticated
        setIsChecking(false);
      }
    };

    // Check auth immediately
    checkAuth();

    // Listen for visibility changes (app coming back from background)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // App is visible again, recheck auth
        checkAuth();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
