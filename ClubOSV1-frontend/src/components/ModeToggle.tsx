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

  const handleModeChange = (mode: 'operator' | 'customer') => {
    if ((mode === 'customer' && isCustomerMode) || (mode === 'operator' && !isCustomerMode)) {
      return; // Already in this mode
    }
    
    setViewMode(mode);
    localStorage.setItem('clubos_view_mode', mode);
    
    // Navigate to the appropriate app
    if (mode === 'customer') {
      router.push('/customer');
    } else {
      router.push('/');
    }
  };

  // If user is a customer role, they're always in customer mode
  if (user?.role === 'customer') {
    return (
      <div className="flex items-center justify-between w-full">
        <span className="text-xs text-[var(--text-muted)]">View Mode</span>
        <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-full">
          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
            Customer Only
          </span>
        </div>
      </div>
    );
  }

  // Three-way toggle style (matching terminal card) for all variants
  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-xs text-[var(--text-muted)]">Mode</span>
      <div className="relative inline-block">
        <div className="flex bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded-full p-0.5">
          <div 
            className={`absolute inset-y-0.5 transition-all duration-200 rounded-full ${
              isCustomerMode ? 'bg-orange-500' : 'bg-[var(--accent)]'
            }`}
            style={{
              width: '50%',
              left: isCustomerMode ? '50%' : '0%'
            }}
          />
          <button
            type="button"
            onClick={() => handleModeChange('operator')}
            className="relative z-10 px-3 py-1 text-xs font-medium transition-colors min-w-[70px]"
          >
            <span className={!isCustomerMode ? 'text-white' : 'text-[var(--text-secondary)]'}>
              Operator
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('customer')}
            className="relative z-10 px-3 py-1 text-xs font-medium transition-colors min-w-[70px]"
          >
            <span className={isCustomerMode ? 'text-white' : 'text-[var(--text-secondary)]'}>
              Customer
            </span>
          </button>
        </div>
      </div>
    </div>
  );

};

export default ModeToggle;