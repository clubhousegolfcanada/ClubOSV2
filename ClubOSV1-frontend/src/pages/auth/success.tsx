import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState, useStore } from '@/state/useStore';
import toast from 'react-hot-toast';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';

const AuthSuccessPage = () => {
  const router = useRouter();
  const { login } = useAuthState();
  const { setViewMode } = useStore();

  useEffect(() => {
    const handleAuthSuccess = async () => {
      // Get token and user from URL params
      const { token, user: userJson, error, message } = router.query;

      if (error) {
        logger.error('OAuth error:', { error, message });
        toast.error(message as string || 'Authentication failed');
        router.push('/login');
        return;
      }

      if (!token || !userJson) {
        logger.error('Missing token or user data');
        toast.error('Authentication failed - missing data');
        router.push('/login');
        return;
      }

      try {
        // Parse user data
        const user = JSON.parse(userJson as string);

        // Stop any existing token monitoring
        tokenManager.stopTokenMonitoring();

        // Clear any stale auth data
        tokenManager.clearToken();
        localStorage.removeItem('clubos_user');

        // Set login timestamp for grace period
        sessionStorage.setItem('clubos_login_timestamp', Date.now().toString());

        // Login user with Google auth data
        login(user, token as string);

        // Set view mode based on user role
        if (user.role === 'customer') {
          setViewMode('customer');
        } else {
          setViewMode('operator');
        }

        // Show success message
        toast.success(`Welcome, ${user.name}!`);

        // Navigate based on user role
        if (user.role === 'customer') {
          router.push('/customer/');
        } else if (user.role === 'contractor') {
          router.push('/checklists');
        } else {
          router.push('/');
        }
      } catch (error: any) {
        logger.error('Failed to process OAuth success:', error);
        toast.error('Authentication failed - invalid data');
        router.push('/login');
      }
    };

    handleAuthSuccess();
  }, [router, login, setViewMode]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
        <p className="mt-4 text-[var(--text-secondary)]">Signing you in...</p>
      </div>
    </div>
  );
};

export default AuthSuccessPage;