import { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import { hasMinimumRole } from '@/utils/roleUtils';

export function useRemoteActionsBar() {
  const { user } = useAuthState();
  const [isVisible, setIsVisible] = useState(false);
  const [height, setHeight] = useState(0);
  
  useEffect(() => {
    // Check if user has permission for remote actions
    const hasPermission = user && hasMinimumRole(user.role, 'operator');
    setIsVisible(hasPermission || false);
    
    // Set height based on visibility
    setHeight(hasPermission ? 48 : 0); // 48px = 3rem
  }, [user]);
  
  return {
    isVisible,
    height,
    className: isVisible ? 'pb-12' : ''
  };
}