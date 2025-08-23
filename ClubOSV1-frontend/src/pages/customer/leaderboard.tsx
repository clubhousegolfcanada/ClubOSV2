import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import { Trophy } from 'lucide-react';
import { LeaderboardList } from '@/components/customer/LeaderboardList';

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Remove /api from the end if it exists
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}


export default function CustomerLeaderboard() {
  const router = useRouter();
  const { user } = useAuthState();
  const [activeTab, setActiveTab] = useState<'pro' | 'house' | 'closest' | 'alltime'>('alltime');
  const [refreshKey, setRefreshKey] = useState(0);

  // TrackMan embed URLs
  const embedUrls = {
    pro: 'https://tm-short.me/pZY461g', // Pro League
    house: 'https://tm-short.me/Tqjb7AS', // House League
    closest: 'https://tm-short.me/IsUwwGi', // Closest to the Pin
    alltime: null // All-time will be custom implementation
  };

  const handleRefresh = async () => {
    // Trigger component refresh by changing key
    setRefreshKey(prev => prev + 1);
  };

  // Check authentication on mount
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A]"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Leaderboard - Clubhouse Golf</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8">
          {/* Compact Header */}
          <div className="bg-gradient-to-r from-[#0B3D3A] to-[#084a45] text-white px-4 py-3">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">
                  Leaderboard
                </h1>
              </div>
              <p className="text-xs text-white/80 mt-1">
                Install the TrackMan app and go to any Clubhouse to enter
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border-b border-gray-200 sticky top-14 z-40">
            <div className="max-w-7xl mx-auto px-2 sm:px-4">
              <div className="flex gap-1 sm:gap-4 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveTab('pro')}
                  className={`py-3 px-2 sm:px-3 border-b-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === 'pro'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="sm:hidden">Pro</span>
                  <span className="hidden sm:inline">Pro League</span>
                </button>
                <button
                  onClick={() => setActiveTab('house')}
                  className={`py-3 px-2 sm:px-3 border-b-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === 'house'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="sm:hidden">House</span>
                  <span className="hidden sm:inline">House League</span>
                </button>
                <button
                  onClick={() => setActiveTab('closest')}
                  className={`py-3 px-2 sm:px-3 border-b-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === 'closest'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="sm:hidden">Closest</span>
                  <span className="hidden sm:inline">Closest to Pin</span>
                </button>
                <button
                  onClick={() => setActiveTab('alltime')}
                  className={`py-3 px-2 sm:px-3 border-b-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === 'alltime'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="max-w-7xl mx-auto">
            {activeTab === 'alltime' ? (
              // All-time leaderboard using unified component
              <div className="p-4">
                <LeaderboardList 
                  key={refreshKey}
                  userId={user?.id}
                  userToken={user?.token}
                  onRefresh={handleRefresh}
                  showSearch={true}
                  virtualScroll={true}
                />
              </div>
            ) : (
              // TrackMan embed for Pro and House leagues
              <div className="relative w-full h-[60vh] sm:h-[70vh] md:h-[75vh]">
                {embedUrls[activeTab] ? (
                  <iframe
                    src={embedUrls[activeTab]}
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    loading="lazy"
                    title={`${
                      activeTab === 'pro' ? 'Pro League' : 
                      activeTab === 'house' ? 'House League' : 
                      'Closest to the Pin'
                    } Leaderboard`}
                  />
                ) : (
                  <div className="p-8 text-center">
                    <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {activeTab === 'pro' ? 'Pro League' : 'House League'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                      TrackMan leaderboard will appear here
                    </p>
                    <p className="text-sm text-gray-400">
                      Contact support to configure the {activeTab === 'pro' ? 'Pro' : 'House'} League embed URL
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}