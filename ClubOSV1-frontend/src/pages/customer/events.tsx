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
        <title>Tournaments - Clubhouse 24/7</title>
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
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
                <Trophy className="w-6 h-6 text-[#0B3D3A] mr-2" />
                Local Tournaments
              </h1>
            </div>

            {/* Quick Instructions */}
            <div className="bg-gradient-to-br from-[#0B3D3A] to-[#084a45] rounded-xl shadow-sm p-4 sm:p-6 mb-4 text-white">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-bold">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Download TrackMan App</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-bold">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Sign in at Any Clubhouse</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-sm font-bold">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Go to "Local" Tournaments</p>
                  </div>
                </div>
              </div>
              
              {/* Download Button */}
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => {
                    // Detect iOS or Android and redirect accordingly
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    const isAndroid = /Android/.test(navigator.userAgent);
                    
                    if (isIOS) {
                      window.open('https://apps.apple.com/app/trackman-golf/id1024653815', '_blank');
                    } else if (isAndroid) {
                      window.open('https://play.google.com/store/apps/details?id=com.trackman.golf', '_blank');
                    } else {
                      // Default to web or show both options
                      window.open('https://trackman.com/golf/apps', '_blank');
                    }
                  }}
                  className="flex-1 bg-white text-[#0B3D3A] py-2.5 px-4 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download TrackMan App
                </button>
              </div>
            </div>

            {/* Live Leaderboard */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <MapPin className="w-5 h-5 text-[#0B3D3A] mr-2" />
                    Live Leaderboard
                  </h2>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                    <span className="text-sm text-gray-600">Live</span>
                  </div>
                </div>
              </div>
              
              {/* TrackMan Leaderboard Embed */}
              <div className="relative bg-gray-50" style={{ minHeight: '500px' }}>
                <iframe
                  src="https://tm-short.me/pZY461g"
                  title="TrackMan Tournament Leaderboard"
                  className="w-full"
                  style={{ height: '600px', border: 'none' }}
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