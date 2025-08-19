import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import { Trophy, Download } from 'lucide-react';

export default function CustomerLeaderboard() {
  const router = useRouter();
  const { user } = useAuthState();
  const [activeTab, setActiveTab] = useState<'pro' | 'house' | 'closest' | 'alltime'>('pro');

  // TrackMan embed URLs
  const embedUrls = {
    pro: 'https://tm-short.me/pZY461g', // Pro League
    house: 'https://tm-short.me/Tqjb7AS', // House League
    closest: 'https://tm-short.me/IsUwwGi', // Closest to the Pin
    alltime: null // All-time will be custom implementation
  };

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <>
      <Head>
        <title>Leaderboard - Clubhouse 24/7</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8">
          {/* Compact Header */}
          <div className="bg-gradient-to-r from-[#0B3D3A] to-[#084a45] text-white px-4 py-3">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Trophy className="w-5 h-5" />
                  Leaderboard
                </h1>
                <a
                  href="https://apps.apple.com/app/trackman-golf/id123456789"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-medium transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Get App
                </a>
              </div>
              <p className="text-xs text-white/80 mt-1">
                Join our leagues in the TrackMan app to compete for prizes
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border-b border-gray-200 sticky top-14 z-30">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex space-x-6 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('pro')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'pro'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Pro League
                </button>
                <button
                  onClick={() => setActiveTab('house')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'house'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  House League
                </button>
                <button
                  onClick={() => setActiveTab('closest')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === 'closest'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Closest to Pin
                </button>
                <button
                  onClick={() => setActiveTab('alltime')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
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
              // All-time leaderboard (placeholder for now)
              <div className="p-4">
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                  <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">All-Time Leaderboard</h3>
                  <p className="text-gray-500">Coming soon - track your lifetime performance</p>
                </div>
              </div>
            ) : (
              // TrackMan embed for Pro and House leagues
              <div className="relative" style={{ minHeight: '70vh' }}>
                {embedUrls[activeTab] ? (
                  <iframe
                    src={embedUrls[activeTab]}
                    className="w-full h-full absolute inset-0"
                    style={{ minHeight: '70vh' }}
                    frameBorder="0"
                    allowFullScreen
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