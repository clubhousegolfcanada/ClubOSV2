import { useEffect, useState } from 'react';

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // For iOS devices, use visualViewport API
    if ('visualViewport' in window) {
      const handleViewportChange = () => {
        const viewport = window.visualViewport;
        if (!viewport) return;

        // Calculate keyboard height
        const keyboardHeight = window.innerHeight - viewport.height;
        setKeyboardHeight(keyboardHeight);
        setIsKeyboardVisible(keyboardHeight > 50); // Threshold to detect keyboard

        // Also handle viewport offset (when keyboard pushes viewport up)
        if (keyboardHeight > 0) {
          // Ensure messages are visible when keyboard opens
          requestAnimationFrame(() => {
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement && activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
              activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });
        }
      };

      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);

      // Initial check
      handleViewportChange();

      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
        window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      };
    }

    // Fallback for non-iOS or older browsers
    const handleResize = () => {
      // This is less accurate but works as a fallback
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.clientHeight;
      const heightDiff = documentHeight - windowHeight;
      
      if (heightDiff > 100) {
        setKeyboardHeight(heightDiff);
        setIsKeyboardVisible(true);
      } else {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Also listen for focus/blur events on inputs
    const handleFocus = () => {
      setTimeout(() => {
        setIsKeyboardVisible(true);
      }, 300);
    };

    const handleBlur = () => {
      setTimeout(() => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      }, 100);
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, []);

  return { keyboardHeight, isKeyboardVisible };
}