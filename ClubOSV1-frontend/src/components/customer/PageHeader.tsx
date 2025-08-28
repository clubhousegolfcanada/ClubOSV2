import React, { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle, 
  rightContent,
  className = '' 
}) => {
  return (
    <div className={`bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] px-4 py-3 ${className}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {rightContent && (
            <div className="flex-shrink-0">
              {rightContent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;