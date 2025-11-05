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
      success: 'bg-[var(--status-success)] text-white',
      error: 'bg-[var(--status-error)] text-white',
      warning: 'bg-[var(--status-warning)] text-black',
      info: 'bg-[var(--status-info)] text-white',
      gray: 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]',
      default: 'bg-[var(--accent)] text-white',
    },
    outline: {
      success: 'border border-[var(--status-success)] text-[var(--status-success)]',
      error: 'border border-[var(--status-error)] text-[var(--status-error)]',
      warning: 'border border-[var(--status-warning)] text-[var(--status-warning)]',
      info: 'border border-[var(--status-info)] text-[var(--status-info)]',
      gray: 'border border-[var(--border-primary)] text-[var(--text-secondary)]',
      default: 'border border-[var(--accent)] text-[var(--accent)]',
    },
    subtle: {
      success: 'bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/20',
      error: 'bg-[var(--status-error)]/10 text-[var(--status-error)] border-[var(--status-error)]/20',
      warning: 'bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/20',
      info: 'bg-[var(--status-info)]/10 text-[var(--status-info)] border-[var(--status-info)]/20',
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