import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Navigation from '@/components/Navigation';
import Notifications from '@/components/Notifications';
import AuthGuard from '@/components/auth/AuthGuard';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useAuthState } from '@/state/useStore';
import { useKioskRedirect } from '@/hooks/useKioskRedirect';
import { tokenManager } from '@/utils/tokenManager';
import { SessionExpiryWarning } from '@/components/SessionExpiryWarning';
import { useMessageNotifications } from '@/hooks/useMessageNotifications';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/register', '/forgot-password'];

interface AppContentProps {
  Component: AppProps['Component'];
  pageProps: AppProps['pageProps'];
}

function AppContent({ Component, pageProps }: AppContentProps) {
  const router = useRouter();
  const { setUser, isAuthenticated } = useAuthState();
  const isPublicRoute = publicRoutes.includes(router.pathname);
  const [authInitialized, setAuthInitialized] = useState(false);
  
  // Use kiosk redirect hook
  useKioskRedirect();
  
  // Use message notifications hook
  const { unreadCount } = useMessageNotifications();

  useEffect(() => {
    // Register service worker for push notifications
    if ('serviceWorker' in navigator && isAuthenticated) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
    
    // PWA fullscreen support
    if ('standalone' in window.navigator || window.matchMedia('(display-mode: standalone)').matches) {
      // App is running in standalone mode
      document.documentElement.classList.add('pwa-standalone');
    }
    
    // iOS PWA viewport fix
    if (navigator.userAgent.match(/iPhone|iPad|iPod/)) {
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Skip auth restoration on login page
    if (router.pathname === '/login') {
      setAuthInitialized(true);
      return;
    }
    
    // Initialize auth state from localStorage
    const storedUser = localStorage.getItem('clubos_user');
    const storedToken = localStorage.getItem('clubos_token');
    
    if (storedUser && storedToken && !isAuthenticated) {
      try {
        // Check if token is expired before restoring
        if (!tokenManager.isTokenExpired(storedToken)) {
          const user = JSON.parse(storedUser);
          setUser({ ...user, token: storedToken });
        } else {
          // Clear expired token silently (no redirect from here)
          localStorage.removeItem('clubos_user');
          localStorage.removeItem('clubos_token');
        }
      } catch (error) {
        console.error('Failed to restore auth state:', error);
        localStorage.removeItem('clubos_user');
        localStorage.removeItem('clubos_token');
      }
    }
    setAuthInitialized(true);
  }, [setUser, isAuthenticated, router.pathname]);

  useEffect(() => {
    // Start token monitoring when authenticated (but not on login page)
    if (isAuthenticated && router.pathname !== '/login') {
      tokenManager.startTokenMonitoring();
      tokenManager.setupAxiosInterceptor();
    }
    
    // Cleanup on unmount or when user logs out
    return () => {
      tokenManager.stopTokenMonitoring();
    };
  }, [isAuthenticated, router.pathname]);

  useEffect(() => {
    // Hide HubSpot navigation on mobile when embedded
    if (typeof window !== 'undefined' && window !== window.parent) {
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // Send message to parent to hide navigation
        window.parent.postMessage({ 
          type: 'clubos-hide-nav',
          action: 'hide'
        }, '*');
        
        // Also try to hide HubSpot nav directly if we have access
        try {
          const parentDoc = window.parent.document;
          const hubspotNav = parentDoc.querySelector('.header-container') as HTMLElement;
          const mobileNav = parentDoc.querySelector('.mobile-nav') as HTMLElement;
          const headerWrapper = parentDoc.querySelector('.header__container') as HTMLElement;
          
          if (hubspotNav) hubspotNav.style.display = 'none';
          if (mobileNav) mobileNav.style.display = 'none';
          if (headerWrapper) headerWrapper.style.display = 'none';
        } catch (e) {
          // Cross-origin restrictions, rely on postMessage
          console.log('ClubOS: Using postMessage for nav control');
        }
      }
    }
    
    // Cleanup function to restore nav when unmounting
    return () => {
      if (typeof window !== 'undefined' && window !== window.parent) {
        window.parent.postMessage({ 
          type: 'clubos-hide-nav',
          action: 'show'
        }, '*');
      }
    };
  }, []);

  // Use state for client-side values to prevent hydration mismatch
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [showNavigation, setShowNavigation] = useState(false);
  
  useEffect(() => {
    // Check if embedded after mount
    setIsEmbedded(window !== window.parent);
  }, []);
  
  useEffect(() => {
    // Update navigation visibility after mount
    setShowNavigation(isEmbedded || (!isPublicRoute && isAuthenticated));
  }, [isEmbedded, isPublicRoute, isAuthenticated]);

  return (
    <>
      {showNavigation && <Navigation unreadMessages={unreadCount} />}
      {isPublicRoute ? (
        <Component {...pageProps} />
      ) : (
        <AuthGuard>
          <Component {...pageProps} />
        </AuthGuard>
      )}
      <Notifications />
      {isAuthenticated && <SessionExpiryWarning />}
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
