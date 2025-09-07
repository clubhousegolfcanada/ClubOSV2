import React from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import Button from './Button';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: {
      container: 'p-6',
      icon: 'w-8 h-8',
      title: 'text-base',
      description: 'text-sm',
      spacing: 'gap-3',
    },
    md: {
      container: 'p-8 sm:p-12',
      icon: 'w-12 h-12',
      title: 'text-lg',
      description: 'text-base',
      spacing: 'gap-4',
    },
    lg: {
      container: 'p-12 sm:p-16',
      icon: 'w-16 h-16',
      title: 'text-xl',
      description: 'text-base',
      spacing: 'gap-6',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div
      className={clsx(
        'bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] text-center',
        sizes.container,
        className
      )}
    >
      <div className={clsx('flex flex-col items-center', sizes.spacing)}>
        {Icon && (
          <Icon
            className={clsx(
              sizes.icon,
              'text-[var(--text-muted)]'
            )}
          />
        )}
        
        <div className="space-y-2">
          <h3 className={clsx(
            'font-medium text-[var(--text-primary)]',
            sizes.title
          )}>
            {title}
          </h3>
          
          {description && (
            <p className={clsx(
              'text-[var(--text-secondary)] max-w-md mx-auto',
              sizes.description
            )}>
              {description}
            </p>
          )}
        </div>

        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {action && (
              <Button
                variant={action.variant || 'primary'}
                onClick={action.onClick}
                size={size === 'sm' ? 'sm' : 'md'}
              >
                {action.label}
              </Button>
            )}
            
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium transition-colors"
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyState;