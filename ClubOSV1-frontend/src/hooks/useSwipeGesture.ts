import { useEffect, useRef } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPullStart?: () => void;
  onPullEnd?: (distance: number) => void;
}

interface SwipeOptions {
  threshold?: number; // Minimum distance for swipe (default: 50px)
  velocity?: number; // Minimum velocity for swipe (default: 0.3)
  preventScroll?: boolean; // Prevent default scroll during swipe
  enablePullToRefresh?: boolean; // Enable pull-to-refresh gesture
}

export const useSwipeGesture = (
  elementRef: React.RefObject<HTMLElement>,
  handlers: SwipeHandlers,
  options: SwipeOptions = {}
) => {
  const {
    threshold = 50,
    velocity = 0.3,
    preventScroll = false,
    enablePullToRefresh = false
  } = options;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isPullingRef = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let touchStartY = 0;
    let currentY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
      touchStartY = touch.clientY;

      // Check if we're at the top for pull-to-refresh
      if (enablePullToRefresh && element.scrollTop === 0) {
        isPullingRef.current = true;
        handlers.onPullStart?.();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.touches[0];
      currentY = touch.clientY;

      // Handle pull-to-refresh
      if (isPullingRef.current && currentY > touchStartY) {
        const pullDistance = currentY - touchStartY;
        if (preventScroll && pullDistance > 0) {
          e.preventDefault();
        }
      }

      // Prevent scroll if needed
      if (preventScroll) {
        const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

        // If horizontal movement is greater, prevent vertical scroll
        if (deltaX > deltaY) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;
      const velocityX = Math.abs(deltaX) / deltaTime;
      const velocityY = Math.abs(deltaY) / deltaTime;

      // Handle pull-to-refresh release
      if (isPullingRef.current) {
        const pullDistance = currentY - touchStartY;
        handlers.onPullEnd?.(pullDistance);
        isPullingRef.current = false;
      }

      // Determine if it's a swipe based on distance and velocity
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
      const isVerticalSwipe = Math.abs(deltaY) > Math.abs(deltaX);

      if (isHorizontalSwipe && Math.abs(deltaX) > threshold && velocityX > velocity) {
        if (deltaX > 0) {
          handlers.onSwipeRight?.();
        } else {
          handlers.onSwipeLeft?.();
        }
      } else if (isVerticalSwipe && Math.abs(deltaY) > threshold && velocityY > velocity) {
        if (deltaY > 0) {
          handlers.onSwipeDown?.();
        } else {
          handlers.onSwipeUp?.();
        }
      }

      touchStartRef.current = null;
    };

    const handleTouchCancel = () => {
      touchStartRef.current = null;
      isPullingRef.current = false;
    };

    // Add passive: false to allow preventDefault
    const touchOptions = { passive: !preventScroll };

    element.addEventListener('touchstart', handleTouchStart, touchOptions);
    element.addEventListener('touchmove', handleTouchMove, touchOptions);
    element.addEventListener('touchend', handleTouchEnd, touchOptions);
    element.addEventListener('touchcancel', handleTouchCancel, touchOptions);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [elementRef, handlers, threshold, velocity, preventScroll, enablePullToRefresh]);
};

export default useSwipeGesture;