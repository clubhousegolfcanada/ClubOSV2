import React from 'react';
import { useStore, useAuthState } from '../state/useStore';
import { Users, User } from 'lucide-react';
import { useRouter } from 'next/router';

interface ModeToggleProps {
  variant?: 'default' | 'compact';
}

const ModeToggle: React.FC<ModeToggleProps> = ({ variant = 'default' }) => {
  const { viewMode, setViewMode } = useStore();
  const { user } = useAuthState();
  const router = useRouter();

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
    
    // Navigate to the appropriate app
    if (newMode === 'customer') {
      router.push('/customer');
    } else {
      router.push('/');
    }
  };

  // If user is a customer role, they're always in customer mode
  if (user?.role === 'customer') {
    return (
      <div className="flex items-center space-x-2 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-lg">
        <User className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
          Customer
        </span>
      </div>
    );
  }

  // Compact variant for consistent display
  if (variant === 'compact') {
    return (
      <div className="flex items-center bg-[var(--bg-secondary)] rounded-lg p-1">
        <button
          onClick={() => {
            if (isCustomerMode) {
              handleToggle();
            }
          }}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
            !isCustomerMode
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Operator</span>
        </button>
        <button
          onClick={() => {
            if (!isCustomerMode) {
              handleToggle();
            }
          }}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
            isCustomerMode
              ? 'bg-orange-500 text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Customer</span>
        </button>
      </div>
    );
  }

  // Default toggle switch style
  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleToggle}
        className={`
          relative inline-flex items-center h-8 rounded-full w-16 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent)]
          ${isCustomerMode ? 'bg-orange-500' : 'bg-[var(--accent)]'}
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
            <User className="h-6 w-6 p-1 text-orange-500" />
          ) : (
            <Users className="h-6 w-6 p-1 text-[var(--accent)]" />
          )}
        </span>
      </button>
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {isCustomerMode ? 'Customer' : 'Operator'}
      </span>
    </div>
  );
};

export default ModeToggle;