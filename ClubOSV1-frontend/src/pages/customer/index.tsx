import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState, useStore } from '@/state/useStore';
import { CustomerDashboard } from '@/components/customer/CustomerDashboard';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import { CustomerErrorBoundary } from '@/components/SectionErrorBoundary';

export default function CustomerApp() {
  const router = useRouter();
  const { user, isLoading } = useAuthState();
  const { viewMode } = useStore();
  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setLocalLoading(false);
    }, 3000); // 3 second max load time
    
    // Clear timeout if auth loads successfully
    if (!isLoading && user) {
      setLocalLoading(false);
      clearTimeout(timeout);
    }
    
    // Redirect logic
    if (!isLoading && !user) {
      router.push('/login');
    } else if (!isLoading && user && viewMode !== 'customer' && user.role !== 'customer') {
      router.push('/');
    }
    
    return () => clearTimeout(timeout);
  }, [user, viewMode, router, isLoading]);

  // Show loading state only briefly
  if (localLoading && isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Clubhouse Golf - Your Golf Experience</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] customer-app">
        {/* Customer Navigation - Mobile optimized */}
        <CustomerNavigation />
        
        {/* Main Content - Mobile first design */}
        <main className="pb-24 lg:pb-8 lg:pt-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <CustomerErrorBoundary>
              <CustomerDashboard />
            </CustomerErrorBoundary>
          </div>
        </main>
      </div>
    </>
  );
}