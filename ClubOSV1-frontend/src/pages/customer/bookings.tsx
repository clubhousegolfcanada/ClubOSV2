import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import { Calendar, MapPin, Clock, Info } from 'lucide-react';

export default function CustomerBookings() {
  const router = useRouter();
  const { user } = useAuthState();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    if (!user) {
      router.push('/login');
    } else {
      setLoading(false);
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto mb-4"></div>
          <p className="text-gray-500">Loading booking system...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Book a Box - Clubhouse Golf</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

      <div className="min-h-screen bg-[var(--bg-primary)] customer-app">
        <CustomerNavigation />
        
        <main className="pb-24 lg:pb-8 pt-12 lg:pt-14">
          {/* Skedda Booking System Embed - Full Width */}
          <div className="h-full">
            <iframe
              src="https://clubhouse247golf.skedda.com/booking"
              title="Clubhouse Golf Booking System"
              className="w-full"
              style={{ 
                height: 'calc(100vh - 136px)', 
                border: 'none',
                minHeight: '600px'
              }}
              allow="payment; fullscreen; camera; microphone; geolocation"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-popups-to-escape-sandbox allow-top-navigation"
            />
          </div>
        </main>
      </div>
    </>
  );
}