import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

interface CalendarSkeletonProps {
  variant?: 'day' | 'week' | 'month';
  showHeader?: boolean;
}

export const CalendarSkeleton: React.FC<CalendarSkeletonProps> = ({
  variant = 'day',
  showHeader = true
}) => {
  // Generate time slots for skeleton (7am to 10pm = 15 hours * 2 = 30 slots)
  const timeSlots = Array.from({ length: 30 }, (_, i) => i);
  const spaces = variant === 'day' ? 4 : 2; // Fewer spaces for week view

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header skeleton */}
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skeleton width={120} height={32} className="rounded-lg" />
            <Skeleton width={100} height={32} className="rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Skeleton width={80} height={32} className="rounded-lg" />
            <Skeleton width={80} height={32} className="rounded-lg" />
          </div>
        </div>
      )}

      {/* Calendar grid skeleton */}
      <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden bg-[var(--bg-primary)]">
        {/* Space headers */}
        <div className="grid grid-cols-[80px_1fr] border-b border-[var(--border-primary)]">
          <div className="p-2 bg-[var(--bg-secondary)]" />
          <div className="grid" style={{ gridTemplateColumns: `repeat(${spaces}, 1fr)` }}>
            {Array.from({ length: spaces }).map((_, i) => (
              <div key={i} className="p-2 border-l border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <Skeleton width="80%" height={16} />
              </div>
            ))}
          </div>
        </div>

        {/* Time slots with staggered animation */}
        <div className="max-h-[600px] overflow-y-auto">
          {timeSlots.slice(0, variant === 'week' ? 10 : 15).map((_, slotIndex) => (
            <div
              key={slotIndex}
              className="grid grid-cols-[80px_1fr] border-b border-[var(--border-primary)]"
              style={{ animationDelay: `${slotIndex * 20}ms` }}
            >
              {/* Time label */}
              <div className="px-2 py-3 bg-[var(--bg-secondary)] border-r border-[var(--border-primary)]">
                <Skeleton width={50} height={14} />
              </div>

              {/* Space slots */}
              <div className="grid" style={{ gridTemplateColumns: `repeat(${spaces}, 1fr)` }}>
                {Array.from({ length: spaces }).map((_, spaceIndex) => (
                  <div
                    key={spaceIndex}
                    className="min-h-[41px] border-r border-[var(--border-primary)] p-1"
                  >
                    {/* Randomly show some "booked" slots for realism */}
                    {Math.random() > 0.7 && (
                      <Skeleton
                        height={33}
                        className="rounded opacity-60"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const BookingListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--bg-secondary)] rounded-lg p-4 animate-in fade-in"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <Skeleton width="60%" height={20} className="mb-2" />
              <Skeleton width="40%" height={16} />
            </div>
            <Skeleton width={80} height={24} className="rounded-full" />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Skeleton width={100} height={16} />
            <Skeleton width={80} height={16} />
            <Skeleton width={120} height={16} />
          </div>
        </div>
      ))}
    </div>
  );
};

export const CompactCalendarSkeleton: React.FC = () => {
  return (
    <div className="animate-in fade-in duration-300">
      {/* Mobile-optimized skeleton */}
      <div className="bg-[var(--bg-secondary)] rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton width={150} height={24} />
          <div className="flex gap-2">
            <Skeleton width={32} height={32} className="rounded" />
            <Skeleton width={32} height={32} className="rounded" />
          </div>
        </div>

        {/* Compact time slots */}
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-2"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <Skeleton width={60} height={40} className="rounded" />
              <div className="flex-1 grid grid-cols-2 gap-2">
                {Array.from({ length: 2 }).map((_, j) => (
                  <Skeleton
                    key={j}
                    height={40}
                    className={`rounded ${Math.random() > 0.5 ? 'opacity-60' : ''}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarSkeleton;