import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';

interface SwipeConfig {
  threshold?: number; // Minimum distance for swipe (default: 50px)
  velocity?: number; // Minimum velocity (default: 0.3)
  enabled?: boolean; // Whether swipe is enabled
}

export function useSwipeNavigation(config: SwipeConfig = {}) {
  const router = useRouter();
  const { user } = useAuthState();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isSwiping = useRef(false);

  const {
    threshold = 50,
    velocity = 0.3,
    enabled = true
  } = config;

  // Define navigation order based on user role
  const getNavigationPages = () => {
    if (!user) return [];

    const allPages = [
      { path: '/', name: 'Dashboard' },
      { path: '/messages', name: 'Messages', roles: ['admin', 'operator', 'support'] },
      { path: '/tickets', name: 'Tickets' },
      { path: '/checklists', name: 'Checklists', roles: ['admin', 'operator'] },
      { path: '/operations', name: 'Operations' },
      { path: '/commands', name: 'Commands' },
    ];

    // Filter pages based on user role
    return allPages.filter(page => {
      if (!page.roles) return true;
      return page.roles.includes(user.role);
    });
  };

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const pages = getNavigationPages();
    const currentIndex = pages.findIndex(page => page.path === router.pathname);

    const handleTouchStart = (e: TouchEvent) => {
      // Don't interfere with scrolling or other gestures
      if (e.touches.length !== 1) return;
      
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();
      isSwiping.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const deltaX = e.touches[0].clientX - touchStartX.current;
      const deltaY = e.touches[0].clientY - touchStartY.current;

      // If vertical movement is greater, it's likely scrolling
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        isSwiping.current = false;
        return;
      }

      // If horizontal movement is significant, prevent default scrolling
      if (Math.abs(deltaX) > 10) {
        isSwiping.current = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isSwiping.current) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndTime = Date.now();

      const distance = touchEndX - touchStartX.current;
      const time = touchEndTime - touchStartTime.current;
      const speed = Math.abs(distance) / time;

      // Check if swipe meets threshold and velocity requirements
      if (Math.abs(distance) > threshold && speed > velocity) {
        if (distance > 0 && currentIndex > 0) {
          // Swipe right - go to previous page
          router.push(pages[currentIndex - 1].path);
        } else if (distance < 0 && currentIndex < pages.length - 1) {
          // Swipe left - go to next page
          router.push(pages[currentIndex + 1].path);
        }
      }

      isSwiping.current = false;
    };

    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Cleanup
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, router.pathname, user, threshold, velocity]);

  return {
    currentPage: router.pathname,
    canSwipeLeft: getNavigationPages().findIndex(p => p.path === router.pathname) < getNavigationPages().length - 1,
    canSwipeRight: getNavigationPages().findIndex(p => p.path === router.pathname) > 0
  };
}