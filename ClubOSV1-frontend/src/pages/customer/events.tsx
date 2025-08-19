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
  const [activeLeaderboard, setActiveLeaderboard] = useState<'new' | 'original'>('new');

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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8">
          {/* Leaderboard Toggle */}
          <div className="fixed top-14 left-0 right-0 bg-white border-b border-gray-200 z-40">
            <div className="flex justify-center p-2">
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                <button
                  onClick={() => setActiveLeaderboard('new')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeLeaderboard === 'new'
                      ? 'bg-[#0B3D3A] text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Pro League
                </button>
                <button
                  onClick={() => setActiveLeaderboard('original')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeLeaderboard === 'original'
                      ? 'bg-[#0B3D3A] text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  House League
                </button>
              </div>
            </div>
          </div>
          
          {/* TrackMan Leaderboard Embeds - Full Screen */}
          <div className="pt-12" style={{ height: 'calc(100vh - 48px)' }}>
            {activeLeaderboard === 'new' ? (
              <iframe
                src="https://tm-short.me/pZY461g"
                title="Pro League Leaderboard"
                className="w-full h-full"
                style={{ 
                  border: 'none',
                  minHeight: '600px'
                }}
                allow="fullscreen"
              />
            ) : (
              <iframe
                src="https://tm-short.me/Tqjb7AS"
                title="House League Leaderboard"
                className="w-full h-full"
                style={{ 
                  border: 'none',
                  minHeight: '600px'
                }}
                allow="fullscreen"
              />
            )}
          </div>
        </main>
      </div>
    </>
  );
}