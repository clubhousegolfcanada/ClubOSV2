import Head from 'next/head';
import TicketCenterOptimizedV3 from '@/components/TicketCenterOptimizedV3';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function TicketCenter() {
  const { user } = useAuthState();
  const router = useRouter();

  // SECURITY: Block customer role from accessing tickets
  useEffect(() => {
    if (user) {
      if (user.role === 'customer') {
        router.push('/customer/');
        return;
      }
      // Only allow operator roles
      if (!['admin', 'operator', 'support'].includes(user.role)) {
        router.push('/login');
        return;
      }
    }
  }, [user, router]);

  return (
    <>
      <Head>
        <title>ClubOS - Ticket Center</title>
        <meta name="description" content="Manage facilities and technical support tickets" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] pb-12">
        <div className="container mx-auto px-4 py-2 md:py-4">
          {/* Header Section - Minimal and clean like Messages page */}
          <div className="mb-4">
            <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">
              Ticket Center
            </h1>
            <p className="text-[var(--text-secondary)] text-xs md:text-sm font-light mt-1">
              Manage support tickets across all locations
            </p>
          </div>

          {/* Main Content - New modernized component */}
          <TicketCenterOptimizedV3 />
        </div>
      </div>
    </>
  );
}
