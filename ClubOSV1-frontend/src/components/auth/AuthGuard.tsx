import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children, fallback }) => {
  const router = useRouter();
  const { isAuthenticated, user, setUser } = useAuthState();

  useEffect(() => {
    // Only run on initial mount
    if (typeof window === 'undefined') return;
    
    // Check if user is stored in localStorage (for page refresh)
    const storedUser = localStorage.getItem('clubos_user');
    const storedToken = localStorage.getItem('clubos_token');
    
    if (storedUser && storedToken && !user) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser({ ...parsedUser, token: storedToken });
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('clubos_user');
        localStorage.removeItem('clubos_token');
        router.push('/login');
      }
    } else if (!isAuthenticated && !storedUser && !storedToken) {
      // Only redirect if there's truly no auth data
      const timer = setTimeout(() => {
        if (!isAuthenticated) {
          router.push('/login');
        }
      }, 100); // Small delay to allow state to sync
      
      return () => clearTimeout(timer);
    }
  }, []); // Remove dependencies to prevent re-running

  if (!isAuthenticated) {
    return <>{fallback || <div>Loading...</div>}</>;
  }

  return <>{children}</>;
};

export default AuthGuard;
