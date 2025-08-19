import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import { Trophy, Download, MapPin, Smartphone, Crown, Medal, Award, Star, Coins } from 'lucide-react';

export default function CustomerEvents() {
  const router = useRouter();
  const { user } = useAuthState();
  const [loading, setLoading] = useState(true);
  const [activeLeaderboard, setActiveLeaderboard] = useState<'new' | 'original' | 'alltime'>('new');
  const [alltimeLoading, setAlltimeLoading] = useState(false);
  
  // Competitive ranking tiers
  const getRankTier = (rank: number) => {
    if (rank <= 10) return { name: 'Grand Master', color: 'text-red-600', bg: 'bg-red-50' };
    if (rank <= 25) return { name: 'Master', color: 'text-purple-600', bg: 'bg-purple-50' };
    if (rank <= 50) return { name: 'Diamond', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (rank <= 100) return { name: 'Platinum', color: 'text-cyan-600', bg: 'bg-cyan-50' };
    if (rank <= 200) return { name: 'Gold', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (rank <= 500) return { name: 'Silver', color: 'text-gray-600', bg: 'bg-gray-50' };
    return { name: 'Bronze', color: 'text-orange-600', bg: 'bg-orange-50' };
  };

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
        <title>Leaderboard - Clubhouse Golf</title>
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
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeLeaderboard === 'new'
                      ? 'bg-[#0B3D3A] text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Pro League
                </button>
                <button
                  onClick={() => setActiveLeaderboard('original')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeLeaderboard === 'original'
                      ? 'bg-[#0B3D3A] text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  House League
                </button>
                <button
                  onClick={() => setActiveLeaderboard('alltime')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                    activeLeaderboard === 'alltime'
                      ? 'bg-[#0B3D3A] text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  All Time
                </button>
              </div>
            </div>
          </div>
          
          {/* Leaderboard Content */}
          <div className="pt-12" style={{ height: 'calc(100vh - 48px)' }}>
            {activeLeaderboard === 'alltime' ? (
              // All Time Competitive Rankings
              <div className="max-w-5xl mx-auto px-4 py-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#0B3D3A] to-[#084a45]">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Trophy className="w-6 h-6" />
                      All Time Rankings
                    </h2>
                    <p className="text-white/80 text-sm mt-1">Official competitive standings across all Clubhouse Golf locations</p>
                  </div>
                  
                  {/* Coming Soon Content */}
                  <div className="p-12 text-center">
                    <div className="max-w-2xl mx-auto">
                      <Trophy className="w-16 h-16 text-[#0B3D3A] mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-gray-900 mb-4">
                        Competitive Rankings Coming Soon
                      </h3>
                      <p className="text-gray-600 mb-6">
                        The official Clubhouse Golf competitive ranking system is launching soon. 
                        Track your progress from Bronze to Grand Master as you compete against players across all locations.
                      </p>
                      
                      {/* Tier Preview */}
                      <div className="bg-gray-50 rounded-lg p-6 mb-8">
                        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                          Competitive Tiers
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="text-orange-600 font-bold">Bronze</div>
                            <div className="text-xs text-gray-500">Entry Level</div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="text-gray-600 font-bold">Silver</div>
                            <div className="text-xs text-gray-500">Top 500</div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="text-yellow-600 font-bold">Gold</div>
                            <div className="text-xs text-gray-500">Top 200</div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="text-cyan-600 font-bold">Platinum</div>
                            <div className="text-xs text-gray-500">Top 100</div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="text-blue-600 font-bold">Diamond</div>
                            <div className="text-xs text-gray-500">Top 50</div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <div className="text-purple-600 font-bold">Master</div>
                            <div className="text-xs text-gray-500">Top 25</div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-200 md:col-span-2">
                            <div className="text-red-600 font-bold">Grand Master</div>
                            <div className="text-xs text-gray-500">Top 10 Elite Players</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-500">
                        ClubCoin rewards, seasonal championships, and exclusive prizes for top performers.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeLeaderboard === 'new' ? (
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