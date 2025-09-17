import React from 'react';
import clsx from 'clsx';

export interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'gray' | 'current';
  className?: string;
  label?: string;
  fullScreen?: boolean;
  centered?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className,
  label,
  fullScreen = false,
  centered = false,
}) => {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  const borderSizes = {
    xs: 'border',
    sm: 'border-2',
    md: 'border-2',
    lg: 'border-2',
    xl: 'border-4',
  };

  const colorClasses = {
    primary: 'border-[var(--accent)]',
    white: 'border-white',
    gray: 'border-[var(--text-muted)]',
    current: 'border-current',
  };

  const spinner = (
    <div
      className={clsx(
        'animate-spin rounded-full',
        sizeClasses[size],
        borderSizes[size],
        'border-b-transparent border-l-transparent',
        colorClasses[color],
        className
      )}
      role="status"
      aria-label={label || 'Loading'}
    >
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]/50 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-3">
          {spinner}
          {label && (
            <p className="text-sm text-[var(--text-secondary)]">{label}</p>
          )}
        </div>
      </div>
    );
  }

  if (centered) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        {spinner}
        {label && (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{label}</p>
        )}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;