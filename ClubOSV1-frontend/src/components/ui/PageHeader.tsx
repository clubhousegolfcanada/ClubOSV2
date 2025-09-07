import React from 'react';
import { LucideIcon, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import Button from './Button';
import { useRouter } from 'next/router';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    variant?: 'primary' | 'secondary' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  breadcrumb?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  showBackButton?: boolean;
  badge?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  action,
  secondaryAction,
  breadcrumb,
  showBackButton,
  badge,
  className,
  compact = false,
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (breadcrumb?.onClick) {
      breadcrumb.onClick();
    } else if (breadcrumb?.href) {
      router.push(breadcrumb.href);
    } else {
      router.back();
    }
  };

  return (
    <div
      className={clsx(
        'bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]',
        compact ? 'p-4' : 'p-6',
        className
      )}
    >
      {/* Breadcrumb or Back Button */}
      {(showBackButton || breadcrumb) && (
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          {breadcrumb?.label || 'Back'}
        </button>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          {/* Icon */}
          {Icon && (
            <div className="flex-shrink-0">
              <div className="p-2 bg-[var(--accent)]/10 rounded-lg">
                <Icon className="w-5 h-5 text-[var(--accent)]" />
              </div>
            </div>
          )}

          {/* Title and Subtitle */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className={clsx(
                'font-bold text-[var(--text-primary)]',
                compact ? 'text-xl' : 'text-2xl md:text-3xl'
              )}>
                {title}
              </h1>
              {badge}
            </div>
            
            {subtitle && (
              <p className={clsx(
                'text-[var(--text-secondary)] mt-1',
                compact ? 'text-sm' : 'text-base'
              )}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {(action || secondaryAction) && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {secondaryAction && (
              <Button
                variant="outline"
                size={compact ? 'sm' : 'md'}
                onClick={secondaryAction.onClick}
                icon={secondaryAction.icon}
              >
                {secondaryAction.label}
              </Button>
            )}
            
            {action && (
              <Button
                variant={action.variant || 'primary'}
                size={compact ? 'sm' : 'md'}
                onClick={action.onClick}
                icon={action.icon}
              >
                {action.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;