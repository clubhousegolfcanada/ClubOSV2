import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState, useStore } from '@/state/useStore';
import { CustomerDashboard } from '@/components/customer/CustomerDashboard';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';

export default function CustomerApp() {
  const router = useRouter();
  const { user } = useAuthState();
  const { viewMode } = useStore();

  useEffect(() => {
    // Redirect if not in customer mode and not a customer
    if (!user) {
      router.push('/login');
    } else if (viewMode !== 'customer' && user.role !== 'customer') {
      router.push('/');
    }
  }, [user, viewMode, router]);

  return (
    <>
      <Head>
        <title>Clubhouse 24/7 - Your Golf Experience</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

      <div className="min-h-screen bg-[#fafafa]">
        {/* Customer Navigation - Mobile optimized */}
        <CustomerNavigation />
        
        {/* Main Content - Mobile first design */}
        <main className="pb-20 lg:pb-8 pt-12 lg:pt-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <CustomerDashboard />
          </div>
        </main>
      </div>
    </>
  );
}