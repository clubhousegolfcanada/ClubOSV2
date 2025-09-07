import React from 'react';
import clsx from 'clsx';

export type StatusType = 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'info' 
  | 'default'
  | 'pending'
  | 'active'
  | 'inactive'
  | 'completed'
  | 'cancelled';

export interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'subtle';
  className?: string;
  dot?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  variant = 'subtle',
  className,
  dot = false,
}) => {
  // Map status to color scheme
  const getStatusColor = (status: string): string => {
    const statusLower = status.toLowerCase();
    
    switch (statusLower) {
      case 'success':
      case 'completed':
      case 'active':
      case 'resolved':
      case 'approved':
        return 'success';
      
      case 'error':
      case 'failed':
      case 'cancelled':
      case 'rejected':
        return 'error';
      
      case 'warning':
      case 'pending':
      case 'review':
        return 'warning';
      
      case 'info':
      case 'processing':
      case 'in_progress':
        return 'info';
      
      case 'inactive':
      case 'disabled':
      case 'archived':
        return 'gray';
      
      default:
        return 'default';
    }
  };

  const colorScheme = getStatusColor(status);

  const colorClasses = {
    solid: {
      success: 'bg-green-500 text-white',
      error: 'bg-red-500 text-white',
      warning: 'bg-yellow-500 text-white',
      info: 'bg-blue-500 text-white',
      gray: 'bg-gray-500 text-white',
      default: 'bg-[var(--accent)] text-white',
    },
    outline: {
      success: 'border border-green-500 text-green-700 dark:text-green-400',
      error: 'border border-red-500 text-red-700 dark:text-red-400',
      warning: 'border border-yellow-500 text-yellow-700 dark:text-yellow-400',
      info: 'border border-blue-500 text-blue-700 dark:text-blue-400',
      gray: 'border border-gray-500 text-gray-700 dark:text-gray-400',
      default: 'border border-[var(--accent)] text-[var(--accent)]',
    },
    subtle: {
      success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
      default: 'bg-[var(--accent)]/10 text-[var(--accent)]',
    },
  };

  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const dotSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  const displayLabel = label || status.replace(/_/g, ' ').toUpperCase();

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        sizeClasses[size],
        colorClasses[variant][colorScheme],
        className
      )}
    >
      {dot && (
        <span
          className={clsx(
            'rounded-full',
            dotSizes[size],
            variant === 'solid' 
              ? 'bg-white/80' 
              : variant === 'outline'
              ? 'bg-current'
              : 'bg-current'
          )}
        />
      )}
      {displayLabel}
    </span>
  );
};

export default StatusBadge;