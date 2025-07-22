import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Navigation from '@/components/Navigation';
import Notifications from '@/components/Notifications';
import AuthGuard from '@/components/auth/AuthGuard';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useAuthState } from '@/state/useStore';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/register', '/forgot-password'];

function AppContent({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { setUser, isAuthenticated } = useAuthState();
  const isPublicRoute = publicRoutes.includes(router.pathname);

  useEffect(() => {
    // Initialize auth state from localStorage
    const storedUser = localStorage.getItem('clubos_user');
    const storedToken = localStorage.getItem('clubos_token');
    
    if (storedUser && storedToken && !isAuthenticated) {
      try {
        const user = JSON.parse(storedUser);
        setUser({ ...user, token: storedToken });
      } catch (error) {
        console.error('Failed to restore auth state:', error);
        localStorage.removeItem('clubos_user');
        localStorage.removeItem('clubos_token');
      }
    }
  }, [setUser, isAuthenticated]);

  // Show navigation only on non-public routes
  const showNavigation = !isPublicRoute && isAuthenticated;

  return (
    <>
      {showNavigation && <Navigation />}
      {isPublicRoute ? (
        <Component {...pageProps} />
      ) : (
        <AuthGuard>
          <Component {...pageProps} />
        </AuthGuard>
      )}
      <Notifications />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-secondary)',
          },
          success: {
            iconTheme: {
              primary: 'var(--status-success)',
              secondary: 'var(--text-primary)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--status-error)',
              secondary: 'var(--text-primary)',
            },
          },
        }}
      />
    </>
  );
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AppContent Component={Component} pageProps={pageProps} />
    </ThemeProvider>
  );
}
