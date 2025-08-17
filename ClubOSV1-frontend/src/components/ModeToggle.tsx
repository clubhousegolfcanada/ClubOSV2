import React from 'react';
import { useStore, useAuthState } from '../state/useStore';
import { UserGroupIcon, UserIcon } from '@heroicons/react/24/outline';

const ModeToggle: React.FC = () => {
  const { viewMode, setViewMode } = useStore();
  const { user } = useAuthState();

  // Only show toggle for users who have both customer and operator access
  // Admins and operators can switch to customer view to test
  // Pure customers only see customer view
  const canToggleMode = user?.role === 'admin' || user?.role === 'operator';
  
  if (!canToggleMode && user?.role !== 'customer') {
    return null; // Support and kiosk users don't need this toggle
  }

  const isCustomerMode = viewMode === 'customer';

  const handleToggle = () => {
    const newMode = isCustomerMode ? 'operator' : 'customer';
    setViewMode(newMode);
    
    // Store preference in localStorage
    localStorage.setItem('clubos_view_mode', newMode);
    
    // Optionally reload to refresh the UI completely
    // window.location.reload();
  };

  // If user is a customer role, they're always in customer mode
  if (user?.role === 'customer') {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-lg">
        <UserIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
          Customer View
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleToggle}
        className={`
          relative inline-flex items-center h-8 rounded-full w-16 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-clubhouse-green
          ${isCustomerMode ? 'bg-blue-600' : 'bg-clubhouse-green'}
        `}
        title={`Switch to ${isCustomerMode ? 'Operator' : 'Customer'} View`}
      >
        <span className="sr-only">Toggle view mode</span>
        <span
          className={`
            inline-block h-6 w-6 transform rounded-full bg-white transition-transform
            ${isCustomerMode ? 'translate-x-1' : 'translate-x-9'}
          `}
        >
          {isCustomerMode ? (
            <UserIcon className="h-6 w-6 p-1 text-blue-600" />
          ) : (
            <UserGroupIcon className="h-6 w-6 p-1 text-clubhouse-green" />
          )}
        </span>
      </button>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {isCustomerMode ? 'Customer' : 'Operator'}
      </span>
    </div>
  );
};

export default ModeToggle;