import { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import { hasMinimumRole } from '@/utils/roleUtils';

export function useRemoteActionsBar() {
  const { user } = useAuthState();
  
  // Initialize with the expected value to prevent layout shift
  // Operators and admins will have the bar, support and below won't
  const hasPermission = user && hasMinimumRole(user.role, 'operator');
  const [isVisible, setIsVisible] = useState(hasPermission || false);
  const [height, setHeight] = useState(hasPermission ? 48 : 0);
  
  useEffect(() => {
    // Update if permission changes (e.g., after login)
    const newHasPermission = user && hasMinimumRole(user.role, 'operator');
    setIsVisible(newHasPermission || false);
    setHeight(newHasPermission ? 48 : 0); // 48px = 3rem
  }, [user]);
  
  return {
    isVisible,
    height,
    className: isVisible ? 'pb-12' : ''
  };
}