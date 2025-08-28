import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, className = '' }) => {
  return (
    <div className={`bg-gradient-to-r from-[#0B3D3A] to-[#084a45] text-white ${className}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && (
          <p className="text-xs text-white/80 mt-1">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

export default PageHeader;