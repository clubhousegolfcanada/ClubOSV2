import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState, useStore } from '@/state/useStore';
import { CustomerDashboard } from '@/components/customer/CustomerDashboard';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';

export default function CustomerApp() {
  const router = useRouter();
  const { user, isLoading } = useAuthState();
  const { viewMode } = useStore();

  useEffect(() => {
    // Don't redirect while auth is still loading
    if (isLoading) return;
    
    // Redirect if not in customer mode and not a customer
    if (!user) {
      router.push('/login');
    } else if (viewMode !== 'customer' && user.role !== 'customer') {
      router.push('/');
    }
  }, [user, viewMode, router, isLoading]);

  // Show loading state while auth is being verified
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
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

      <div className="min-h-screen bg-[#fafafa] customer-app">
        {/* Customer Navigation - Mobile optimized */}
        <CustomerNavigation />
        
        {/* Main Content - Mobile first design */}
        <main className="pb-20 lg:pb-8 lg:pt-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <CustomerDashboard />
          </div>
        </main>
      </div>
    </>
  );
}