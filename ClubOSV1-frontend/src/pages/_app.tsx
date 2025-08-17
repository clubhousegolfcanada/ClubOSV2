import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Navigation from '@/components/Navigation';
import Notifications from '@/components/Notifications';
import AuthGuard from '@/components/auth/AuthGuard';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useAuthState, useStore } from '@/state/useStore';
import { useKioskRedirect } from '@/hooks/useKioskRedirect';
import { tokenManager } from '@/utils/tokenManager';
import { SessionExpiryWarning } from '@/components/SessionExpiryWarning';
import { MessagesProvider, useMessages } from '@/contexts/MessagesContext';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { SwipeIndicator } from '@/components/SwipeIndicator';
import RemoteActionsBar from '@/components/RemoteActionsBar';
import { performanceMonitor, updateAnimationDurations } from '@/utils/performanceMonitor';
import { initializeCSRF } from '@/utils/csrf';

// Public routes that don't require authentication
const publicRoutes = ['/login', '/register', '/forgot-password'];

interface AppContentProps {
  Component: AppProps['Component'];
  pageProps: AppProps['pageProps'];
}

function AppContent({ Component, pageProps }: AppContentProps) {
  const router = useRouter();
  const { setUser, isAuthenticated, user } = useAuthState();
  const { viewMode, setViewMode } = useStore(); // Get viewMode and setViewMode from store
  const isPublicRoute = publicRoutes.includes(router.pathname);
  const [authInitialized, setAuthInitialized] = useState(false);
  
  // Use kiosk redirect hook
  useKioskRedirect();
  
  // Use message context for unread count
  const { unreadCount } = useMessages();
  
  // Enable swipe navigation for authenticated users
  useSwipeNavigation({ enabled: isAuthenticated && !isPublicRoute });

  useEffect(() => {
    // Initialize CSRF token
    if (typeof window !== 'undefined' && isAuthenticated) {
      initializeCSRF().catch(console.error);
    }
    
    // Register service worker for PWA and push notifications
    if ('serviceWorker' in navigator && typeof window !== 'undefined') {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
    
    // Initialize performance monitoring and adaptive animations
    if (typeof window !== 'undefined') {
      performanceMonitor.start();
      updateAnimationDurations();
      
      // Update animations on display change (e.g., external monitor)
      if ('matchMedia' in window) {
        const mediaQuery = window.matchMedia('(min-resolution: 2dppx)');
        mediaQuery.addEventListener('change', updateAnimationDurations);
      }
    }
    
    // PWA fullscreen support
    const isStandalone = 'standalone' in window.navigator || 
                        window.matchMedia('(display-mode: standalone)').matches ||
                        window.matchMedia('(display-mode: fullscreen)').matches;
    
    if (isStandalone) {
      console.log('Running in PWA standalone mode');
      document.documentElement.classList.add('pwa-mode');
      
      // Android-specific fixes
      if (/Android/i.test(navigator.userAgent)) {
        document.documentElement.classList.add('pwa-android');
        // Force viewport update for Android
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-visual');
        }
      }
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
          
          // Set correct view mode based on user role
          // Operators and admins should default to operator mode
          if (user.role === 'customer') {
            setViewMode('customer');
          } else if (user.role === 'admin' || user.role === 'operator') {
            // For operators/admins, check if they have a saved preference
            const savedViewMode = localStorage.getItem('clubos_view_mode');
            // Only use saved mode if it's explicitly set to customer
            // Otherwise default to operator mode
            if (savedViewMode === 'customer' && router.pathname.startsWith('/customer')) {
              setViewMode('customer');
            } else {
              setViewMode('operator');
            }
          }
        } else {
          // Clear expired token silently (no redirect from here)
          localStorage.removeItem('clubos_user');
          localStorage.removeItem('clubos_token');
          localStorage.removeItem('clubos_view_mode');
        }
      } catch (error) {
        console.error('Failed to restore auth state:', error);
        localStorage.removeItem('clubos_user');
        localStorage.removeItem('clubos_token');
        localStorage.removeItem('clubos_view_mode');
      }
    }
    setAuthInitialized(true);
  }, [setUser, isAuthenticated, router.pathname, setViewMode]);

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
          {/* Add padding-top for operator pages to account for fixed navbar */}
          <div className={showNavigation && viewMode !== 'customer' ? 'pt-14' : ''}>
            <Component {...pageProps} />
          </div>
          <SwipeIndicator enabled={isAuthenticated} />
          {isAuthenticated && viewMode !== 'customer' && user?.role !== 'customer' && user?.role !== 'kiosk' && <RemoteActionsBar />}
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
      <MessagesProvider>
        <AppContent Component={Component} pageProps={pageProps} />
      </MessagesProvider>
    </ThemeProvider>
  );
}
