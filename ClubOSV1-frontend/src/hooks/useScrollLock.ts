import { useEffect, useRef, useCallback } from 'react';

interface ScrollLockOptions {
  reserveScrollBarGap?: boolean;
  allowTouchMove?: (element: HTMLElement) => boolean;
}

/**
 * Custom hook to lock scrolling on body and containers during interactions
 * Handles iOS Safari quirks and preserves scroll position
 */
export const useScrollLock = (
  isLocked: boolean,
  options: ScrollLockOptions = {}
) => {
  const scrollPosition = useRef<number>(0);
  const previousBodyStyle = useRef<{
    overflow?: string;
    position?: string;
    top?: string;
    width?: string;
    paddingRight?: string;
    touchAction?: string;
  }>({});

  // Prevent touch move events when locked
  const preventTouchMove = useCallback(
    (e: TouchEvent) => {
      const target = e.target as HTMLElement;

      // Allow touch move if the callback says so
      if (options.allowTouchMove && options.allowTouchMove(target)) {
        return;
      }

      // Check if target is scrollable
      const isScrollable = (el: HTMLElement): boolean => {
        const hasScrollableContent = el.scrollHeight > el.clientHeight;
        const overflowYStyle = window.getComputedStyle(el).overflowY;
        const isOverflowHidden = overflowYStyle.indexOf('hidden') !== -1;
        return hasScrollableContent && !isOverflowHidden;
      };

      // Allow scrolling within scrollable elements
      let element: HTMLElement | null = target;
      while (element && element !== document.body) {
        if (isScrollable(element)) {
          return;
        }
        element = element.parentElement;
      }

      // Prevent default touch behavior
      e.preventDefault();
    },
    [options.allowTouchMove]
  );

  const lockScroll = useCallback(() => {
    // Save current scroll position
    scrollPosition.current = window.pageYOffset;

    // Calculate scrollbar width to prevent layout shift
    const scrollBarGap = options.reserveScrollBarGap
      ? window.innerWidth - document.documentElement.clientWidth
      : 0;

    // Save current body styles
    previousBodyStyle.current = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      paddingRight: document.body.style.paddingRight,
      touchAction: document.body.style.touchAction,
    };

    // Apply scroll lock styles
    Object.assign(document.body.style, {
      overflow: 'hidden',
      touchAction: 'none',
      ...(scrollBarGap && {
        paddingRight: `${scrollBarGap}px`,
      }),
    });

    // iOS Safari specific handling
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      Object.assign(document.body.style, {
        position: 'fixed',
        top: `-${scrollPosition.current}px`,
        width: '100%',
      });
    }

    // Add touch move prevention
    document.addEventListener('touchmove', preventTouchMove, { passive: false });

    // Add class for CSS hooks
    document.body.classList.add('scroll-locked');
  }, [options.reserveScrollBarGap, preventTouchMove]);

  const unlockScroll = useCallback(() => {
    // Remove touch move prevention
    document.removeEventListener('touchmove', preventTouchMove);

    // Restore body styles
    Object.assign(document.body.style, previousBodyStyle.current);

    // iOS Safari specific restoration
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && previousBodyStyle.current.position === 'fixed') {
      window.scrollTo(0, scrollPosition.current);
    }

    // Remove class
    document.body.classList.remove('scroll-locked');
  }, [preventTouchMove]);

  useEffect(() => {
    if (isLocked) {
      lockScroll();
    } else {
      unlockScroll();
    }

    // Cleanup on unmount
    return () => {
      if (isLocked) {
        unlockScroll();
      }
    };
  }, [isLocked, lockScroll, unlockScroll]);

  return { lockScroll, unlockScroll };
};

/**
 * Lock scroll on specific container element
 */
export const useContainerScrollLock = (
  containerRef: React.RefObject<HTMLElement>,
  isLocked: boolean
) => {
  const previousStyles = useRef<{
    overflow?: string;
    touchAction?: string;
    userSelect?: string;
    webkitUserSelect?: string;
  }>({});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isLocked) {
      // Save current styles
      previousStyles.current = {
        overflow: container.style.overflow,
        touchAction: container.style.touchAction,
        userSelect: container.style.userSelect,
        webkitUserSelect: container.style.webkitUserSelect,
      };

      // Apply lock styles
      Object.assign(container.style, {
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        webkitUserSelect: 'none',
      });

      // Add class for CSS hooks
      container.classList.add('container-scroll-locked');
    } else {
      // Restore styles
      Object.assign(container.style, previousStyles.current);

      // Remove class
      container.classList.remove('container-scroll-locked');
    }
  }, [containerRef, isLocked]);
};