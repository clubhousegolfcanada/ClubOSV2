import Head from 'next/head';
import { ChecklistSystem } from '@/components/ChecklistSystem';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Checklists() {
  const { user } = useAuthState();
  const router = useRouter();

  // SECURITY: Block customer role from accessing checklists
  useEffect(() => {
    if (user) {
      if (user.role === 'customer') {
        router.push('/customer/');
        return;
      }
      // Allow operator roles and contractors
      if (!['admin', 'operator', 'support', 'contractor'].includes(user.role)) {
        router.push('/login');
        return;
      }
    }
  }, [user, router]);

  // Don't render until we know the user's role
  if (!user || !['admin', 'operator', 'support', 'contractor'].includes(user.role)) {
    return null;
  }

  return (
    <>
      <Head>
        <title>ClubOS - Checklists</title>
        <meta name="description" content="Complete cleaning and tech maintenance checklists" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] pb-12">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Header Section */}
          <div className="mb-4">
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