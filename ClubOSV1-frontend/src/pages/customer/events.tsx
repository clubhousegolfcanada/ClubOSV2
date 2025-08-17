import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import { Trophy, Download, MapPin, Smartphone } from 'lucide-react';

export default function CustomerEvents() {
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
          <p className="text-gray-500">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Leaderboard - Clubhouse 24/7</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

      <div className="min-h-screen bg-[#fafafa]">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8 pt-16 lg:pt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Compact Instructions Bar */}
            <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6 text-xs text-gray-600">
                  <span className="flex items-center">
                    <span className="font-medium text-gray-900 mr-1">1.</span> Download TrackMan
                  </span>
                  <span className="flex items-center">
                    <span className="font-medium text-gray-900 mr-1">2.</span> Sign in at clubhouse
                  </span>
                  <span className="flex items-center">
                    <span className="font-medium text-gray-900 mr-1">3.</span> Join "Local" tournaments
                  </span>
                </div>
                <button 
                  onClick={() => {
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    const isAndroid = /Android/.test(navigator.userAgent);
                    
                    if (isIOS) {
                      window.open('https://apps.apple.com/app/trackman-golf/id1024653815', '_blank');
                    } else if (isAndroid) {
                      window.open('https://play.google.com/store/apps/details?id=com.trackman.golf', '_blank');
                    } else {
                      window.open('https://trackman.com/golf/apps', '_blank');
                    }
                  }}
                  className="px-3 py-1.5 bg-[#0B3D3A] text-white text-xs rounded-md hover:bg-[#084a45] transition-colors flex items-center"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Get App
                </button>
              </div>
            </div>

            {/* Live Leaderboard - Maximized */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center">
                    <Trophy className="w-4 h-4 text-[#0B3D3A] mr-1.5" />
                    Live Leaderboard
                  </h2>
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse mr-1.5"></div>
                    <span className="text-xs text-gray-600">Live</span>
                  </div>
                </div>
              </div>
              
              {/* TrackMan Leaderboard Embed - Full Height */}
              <div className="relative bg-gray-50" style={{ minHeight: '70vh' }}>
                <iframe
                  src="https://tm-short.me/pZY461g"
                  title="TrackMan Tournament Leaderboard"
                  className="w-full"
                  style={{ height: 'calc(100vh - 200px)', minHeight: '600px', border: 'none' }}
                  allow="fullscreen"
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}