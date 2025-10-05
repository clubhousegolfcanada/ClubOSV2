import { useCallback } from 'react';
import { toast } from 'react-hot-toast';

export const useNotifications = () => {
  const showSuccess = useCallback((message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-right',
      style: {
        background: '#10B981',
        color: '#FFFFFF',
        fontWeight: '500',
      },
    });
  }, []);

  const showError = useCallback((message: string) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#EF4444',
        color: '#FFFFFF',
        fontWeight: '500',
      },
    });
  }, []);

  const showInfo = useCallback((message: string) => {
    toast(message, {
      duration: 3000,
      position: 'top-right',
      style: {
        background: '#3B82F6',
        color: '#FFFFFF',
        fontWeight: '500',
      },
    });
  }, []);

  const showWarning = useCallback((message: string) => {
    toast(message, {
      duration: 3500,
      position: 'top-right',
      style: {
        background: '#F59E0B',
        color: '#FFFFFF',
        fontWeight: '500',
      },
      icon: '⚠️',
    });
  }, []);

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning,
  };
};