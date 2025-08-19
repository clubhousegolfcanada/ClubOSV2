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
  
  // Mock data for All Time leaderboard - replace with API call
  const allTimeLeaderboard = [
    { 
      rank: 1, 
      name: 'Mike Johnson', 
      coins: 15420, 
      badges: ['champion', 'eagle', 'ironman'],
      avgScore: 72,
      roundsPlayed: 342 
    },
    { 
      rank: 2, 
      name: 'Sarah Williams', 
      coins: 14200, 
      badges: ['champion', 'birdie-king'],
      avgScore: 74,
      roundsPlayed: 298 
    },
    { 
      rank: 3, 
      name: 'Tom Anderson', 
      coins: 13850, 
      badges: ['eagle', 'consistency'],
      avgScore: 75,
      roundsPlayed: 276 
    },
    { 
      rank: 4, 
      name: 'Emily Chen', 
      coins: 12900, 
      badges: ['birdie-king'],
      avgScore: 76,
      roundsPlayed: 251 
    },
    { 
      rank: 5, 
      name: 'David Brown', 
      coins: 11750, 
      badges: ['ironman'],
      avgScore: 77,
      roundsPlayed: 234 
    }
  ];

  const getBadgeIcon = (badge: string) => {
    switch(badge) {
      case 'champion': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'eagle': return <Star className="w-4 h-4 text-purple-500" />;
      case 'birdie-king': return <Award className="w-4 h-4 text-blue-500" />;
      case 'ironman': return <Medal className="w-4 h-4 text-gray-500" />;
      case 'consistency': return <Trophy className="w-4 h-4 text-green-500" />;
      default: return null;
    }
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
              // All Time ClubCoin Leaderboard
              <div className="max-w-4xl mx-auto px-4 py-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#0B3D3A] to-[#084a45]">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Trophy className="w-6 h-6" />
                      All Time ClubCoin Leaderboard
                    </h2>
                    <p className="text-white/80 text-sm mt-1">Top players across all Clubhouse 24/7 locations</p>
                  </div>
                  
                  {/* Leaderboard Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Badges</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">ClubCoins</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Rounds</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {allTimeLeaderboard.map((player) => (
                          <tr key={player.rank} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4">
                              <div className="flex items-center">
                                {player.rank === 1 && <Crown className="w-5 h-5 text-yellow-500 mr-2" />}
                                {player.rank === 2 && <Medal className="w-5 h-5 text-gray-400 mr-2" />}
                                {player.rank === 3 && <Medal className="w-5 h-5 text-orange-600 mr-2" />}
                                <span className={`font-bold ${player.rank <= 3 ? 'text-lg' : 'text-base'}`}>
                                  #{player.rank}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#0B3D3A] to-[#084a45] rounded-full flex items-center justify-center mr-3">
                                  <span className="text-white font-bold">
                                    {player.name.split(' ').map(n => n[0]).join('')}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{player.name}</div>
                                  {player.rank === 1 && (
                                    <div className="text-xs text-yellow-600 font-medium">👑 Reigning Champion</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex gap-1">
                                {player.badges.map((badge, idx) => (
                                  <div key={idx} className="group relative">
                                    {getBadgeIcon(badge)}
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                      {badge.replace('-', ' ').charAt(0).toUpperCase() + badge.replace('-', ' ').slice(1)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Coins className="w-4 h-4 text-yellow-500" />
                                <span className="font-bold text-gray-900">{player.coins.toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-gray-600">{player.avgScore}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-gray-600">{player.roundsPlayed}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Footer */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Your Rank:</span> #47 • 
                        <span className="font-medium ml-2">Your ClubCoins:</span> 
                        <span className="font-bold text-yellow-600 ml-1">2,450</span>
                      </div>
                      <button className="text-sm text-[#0B3D3A] font-medium hover:underline">
                        View Full Rankings →
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Badge Legend */}
                <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold mb-4">Badge Legend</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-yellow-500" />
                      <span className="text-sm">Champion</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-purple-500" />
                      <span className="text-sm">Eagle Master</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-blue-500" />
                      <span className="text-sm">Birdie King</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Medal className="w-5 h-5 text-gray-500" />
                      <span className="text-sm">Iron Man</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-green-500" />
                      <span className="text-sm">Consistency</span>
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