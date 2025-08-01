import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

interface SwipeIndicatorProps {
  enabled?: boolean;
}

export const SwipeIndicator: React.FC<SwipeIndicatorProps> = ({ enabled = true }) => {
  const { canSwipeLeft, canSwipeRight } = useSwipeNavigation({ enabled });

  if (!enabled || (!canSwipeLeft && !canSwipeRight)) return null;

  return (
    <>
      {/* Left indicator */}
      {canSwipeRight && (
        <div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 pointer-events-none md:hidden gpu-accelerated swipe-indicator">
          <div className="bg-[var(--bg-secondary)]/80 backdrop-blur-sm rounded-r-lg px-1 py-3 border-r border-t border-b border-[var(--border-secondary)] smooth-transition">
            <ChevronLeft className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        </div>
      )}

      {/* Right indicator */}
      {canSwipeLeft && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 pointer-events-none md:hidden gpu-accelerated swipe-indicator">
          <div className="bg-[var(--bg-secondary)]/80 backdrop-blur-sm rounded-l-lg px-1 py-3 border-l border-t border-b border-[var(--border-secondary)] smooth-transition">
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        </div>
      )}

      {/* Page dots indicator at bottom */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none md:hidden gpu-accelerated">
        <div className="bg-[var(--bg-secondary)]/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-[var(--border-secondary)] flex items-center gap-1.5 smooth-transition">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-30 smooth-transition"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] smooth-transition"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] opacity-30 smooth-transition"></div>
        </div>
      </div>
    </>
  );
};