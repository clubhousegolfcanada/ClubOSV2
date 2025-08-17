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
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A] mx-auto mb-4"></div>
          <p className="text-gray-500">Loading booking system...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Book a Box - Clubhouse 24/7</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

      <div className="min-h-screen bg-[#fafafa]">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8 pt-16 lg:pt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Compact Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
                    <Calendar className="w-6 h-6 text-[#0B3D3A] mr-2" />
                    Book a Box
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Reserve your time at any Clubhouse 24/7 location
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Info Bar */}
            <div className="bg-gradient-to-r from-[#0B3D3A] to-[#084a45] rounded-xl shadow-sm p-4 mb-4 text-white">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span className="text-sm">4 Locations</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    <span className="text-sm">Open 6am - 11pm</span>
                  </div>
                </div>
                <div className="flex items-center">
                  <Info className="w-4 h-4 mr-2" />
                  <span className="text-sm">Select your location and preferred time below</span>
                </div>
              </div>
            </div>

            {/* Skedda Booking System Embed */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="relative bg-gray-50" style={{ minHeight: '700px' }}>
                <iframe
                  src="https://clubhouse247golf.skedda.com/booking"
                  title="Clubhouse 24/7 Booking System"
                  className="w-full"
                  style={{ 
                    height: '800px', 
                    border: 'none',
                    minHeight: '700px'
                  }}
                  allow="fullscreen"
                />
              </div>
            </div>

            {/* Help Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Booking Tips</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600">
                <div className="flex items-start">
                  <span className="font-medium text-[#0B3D3A] mr-2">•</span>
                  <span>TrackMan boxes are marked with (TM)</span>
                </div>
                <div className="flex items-start">
                  <span className="font-medium text-[#0B3D3A] mr-2">•</span>
                  <span>Book up to 7 days in advance</span>
                </div>
                <div className="flex items-start">
                  <span className="font-medium text-[#0B3D3A] mr-2">•</span>
                  <span>Cancel up to 2 hours before</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}