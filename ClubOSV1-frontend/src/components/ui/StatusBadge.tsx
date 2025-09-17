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

  const colorScheme = getStatusColor(status) as 'success' | 'error' | 'warning' | 'info' | 'gray' | 'default';

  const colorClasses: Record<string, Record<string, string>> = {
    solid: {
      success: 'bg-green-500 text-white',
      error: 'bg-red-500 text-white',
      warning: 'bg-yellow-500 text-white',
      info: 'bg-blue-500 text-white',
      gray: 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]',
      default: 'bg-[var(--accent)] text-white',
    },
    outline: {
      success: 'border border-green-500 text-green-600',
      error: 'border border-red-500 text-red-600',
      warning: 'border border-yellow-500 text-yellow-600',
      info: 'border border-blue-500 text-blue-600',
      gray: 'border border-[var(--border-primary)] text-[var(--text-secondary)]',
      default: 'border border-[var(--accent)] text-[var(--accent)]',
    },
    subtle: {
      success: 'bg-green-500/10 text-green-600 border-green-500/20',
      error: 'bg-red-500/10 text-red-600 border-red-500/20',
      warning: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      info: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      gray: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-secondary)]',
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
        colorClasses[variant]?.[colorScheme] || colorClasses.subtle.default,
        className
      )}
    >
      {dot && (
        <span
          className={clsx(
            'rounded-full',
            dotSizes[size],
            variant === 'solid' 
              ? 'bg-[var(--bg-secondary)]/80' 
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