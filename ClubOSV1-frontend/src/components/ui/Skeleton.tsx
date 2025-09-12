import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'title' | 'button' | 'card' | 'avatar' | 'custom';
  width?: string | number;
  height?: string | number;
  count?: number;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  count = 1,
  animate = true,
}) => {
  const baseClass = animate ? 'skeleton' : 'bg-[var(--bg-secondary)]';
  
  const variants = {
    text: 'skeleton-text',
    title: 'skeleton-title',
    button: 'skeleton-button',
    card: 'skeleton-card',
    avatar: 'w-12 h-12 rounded-full',
    custom: '',
  };
  
  const style: React.CSSProperties = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };
  
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`${baseClass} ${variants[variant]} ${className}`}
          style={style}
          aria-hidden="true"
        />
      ))}
    </>
  );
};

// Specific skeleton components for common use cases
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-[var(--bg-secondary)] rounded-lg p-4 ${className}`}>
    <Skeleton variant="avatar" className="mb-3" />
    <Skeleton variant="title" className="mb-2" />
    <Skeleton variant="text" count={3} />
    <div className="flex gap-2 mt-4">
      <Skeleton variant="button" />
      <Skeleton variant="button" />
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; className?: string }> = ({ 
  rows = 5, 
  className = '' 
}) => (
  <div className={`bg-[var(--bg-secondary)] rounded-lg overflow-hidden ${className}`}>
    <div className="p-4 border-b border-[var(--border-secondary)]">
      <Skeleton variant="title" width="30%" />
    </div>
    <div className="divide-y divide-[var(--border-secondary)]">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="p-4 flex items-center gap-4">
          <Skeleton variant="avatar" />
          <div className="flex-1">
            <Skeleton variant="text" width="60%" className="mb-2" />
            <Skeleton variant="text" width="40%" />
          </div>
          <Skeleton variant="button" width="80px" />
        </div>
      ))}
    </div>
  </div>
);

export const SkeletonMessage: React.FC<{ 
  direction?: 'inbound' | 'outbound';
  className?: string 
}> = ({ 
  direction = 'inbound', 
  className = '' 
}) => (
  <div className={`flex ${direction === 'outbound' ? 'justify-end' : 'justify-start'} ${className}`}>
    <div className={`max-w-[70%] ${
      direction === 'outbound' 
        ? 'bg-[var(--accent)]/20' 
        : 'bg-[var(--bg-tertiary)]'
    } rounded-lg p-4`}>
      <Skeleton variant="text" width="200px" count={2} />
      <Skeleton variant="text" width="100px" className="mt-2" />
    </div>
  </div>
);

export const SkeletonForm: React.FC<{ fields?: number; className?: string }> = ({ 
  fields = 3, 
  className = '' 
}) => (
  <div className={`space-y-4 ${className}`}>
    {Array.from({ length: fields }).map((_, index) => (
      <div key={index}>
        <Skeleton variant="text" width="30%" className="mb-2" />
        <Skeleton height={48} className="rounded-lg" />
      </div>
    ))}
    <div className="flex gap-2 mt-6">
      <Skeleton variant="button" width="100px" />
      <Skeleton variant="button" width="100px" />
    </div>
  </div>
);

export default Skeleton;