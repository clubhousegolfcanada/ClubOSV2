import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';

/**
 * /clubai route — redirects to Operations with ClubAI tab pre-selected.
 * This allows ClubAI to have its own spot in the nav menu.
 */
export default function ClubAIPage() {
  const router = useRouter();
  const { user } = useAuthState();

  useEffect(() => {
    if (!user) return;
    if (!['admin', 'operator'].includes(user.role)) {
      router.replace('/');
      return;
    }
    // Navigate to operations and trigger tab change
    router.replace('/operations');
    // Small delay to ensure operations page is mounted before dispatching event
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('operations-tab-change', { detail: 'patterns' }));
    }, 100);
  }, [user, router]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="animate-pulse text-[var(--text-secondary)]">Loading ClubAI...</div>
    </div>
  );
}
