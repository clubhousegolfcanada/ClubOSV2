import Head from 'next/head';
import { ChecklistSystem } from '@/components/ChecklistSystem';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Checklists() {
  const { user } = useAuthState();
  const router = useRouter();

  // Redirect if not authorized
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'operator') {
      router.push('/');
    }
  }, [user, router]);

  // Don't render until we know the user's role
  if (!user || (user.role !== 'admin' && user.role !== 'operator')) {
    return null;
  }

  return (
    <>
      <Head>
        <title>ClubOS - Checklists</title>
        <meta name="description" content="Complete cleaning and tech maintenance checklists" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
              Checklists
            </h1>
            <p className="text-[var(--text-secondary)] text-sm font-light max-w-3xl">
              Complete cleaning and tech maintenance checklists with real-time tracking and submission history
            </p>
          </div>

          {/* Main Content */}
          <ChecklistSystem />
        </div>
      </div>
    </>
  );
}