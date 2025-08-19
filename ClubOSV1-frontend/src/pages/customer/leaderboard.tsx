import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import axios from 'axios';
import { Trophy, TrendingUp, Users, Crown, Medal, Award, Star } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface LeaderboardEntry {
  id: string;
  name: string;
  position: number;
  currentRank: string;
  ccNet: number;
  challengesCompleted: number;
  winRate: number;
  hasChampionMarker?: boolean;
}

export default function CustomerLeaderboard() {
  const router = useRouter();
  const { user } = useAuthState();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'seasonal' | 'alltime' | 'activity'>('seasonal');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userPosition, setUserPosition] = useState<number | null>(null);
  const [seasonInfo, setSeasonInfo] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else {
      fetchLeaderboard();
      fetchSeasonInfo();
    }
  }, [user, router, activeTab]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'seasonal' 
        ? '/api/leaderboard/seasonal'
        : activeTab === 'alltime'
        ? '/api/leaderboard/alltime'
        : '/api/leaderboard/activity';

      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });

      if (response.data.success) {
        setLeaderboard(response.data.data);
        
        // Find user's position
        const userEntry = response.data.data.findIndex((entry: any) => entry.id === user?.id);
        setUserPosition(userEntry !== -1 ? userEntry + 1 : null);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasonInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/seasons/current`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });

      if (response.data.success) {
        setSeasonInfo(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch season info:', error);
    }
  };

  const getRankColor = (rank: string) => {
    const colors: Record<string, string> = {
      legend: 'bg-purple-100 text-purple-700 border-purple-200',
      champion: 'bg-red-100 text-red-700 border-red-200',
      pro: 'bg-blue-100 text-blue-700 border-blue-200',
      gold: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      silver: 'bg-gray-100 text-gray-700 border-gray-200',
      bronze: 'bg-orange-100 text-orange-700 border-orange-200',
      amateur: 'bg-green-100 text-green-700 border-green-200',
      house: 'bg-gray-50 text-gray-500 border-gray-200'
    };
    return colors[rank?.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const getPositionIcon = (position: number) => {
    if (position === 1) return <Crown className="w-5 h-5 text-yellow-600" />;
    if (position === 2) return <Medal className="w-5 h-5 text-gray-500" />;
    if (position === 3) return <Award className="w-5 h-5 text-orange-600" />;
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A] mx-auto mb-4"></div>
          <p className="text-gray-500">Loading leaderboard...</p>
        </div>
      </div>
    );
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
          {/* Header */}
          <div className="bg-gradient-to-r from-[#0B3D3A] to-[#084a45] text-white">
            <div className="max-w-7xl mx-auto px-4 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Trophy className="w-6 h-6" />
                    Leaderboard
                  </h1>
                  {seasonInfo && (
                    <p className="text-white/80 text-sm mt-1">
                      {seasonInfo.name} - Ends {new Date(seasonInfo.endDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {userPosition && (
                  <div className="text-right">
                    <div className="text-2xl font-bold">#{userPosition}</div>
                    <div className="text-xs text-white/80">Your Rank</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border-b border-gray-200 sticky top-14 z-30">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('seasonal')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === 'seasonal'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Current Season
                </button>
                <button
                  onClick={() => setActiveTab('alltime')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === 'alltime'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === 'activity'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Recent Activity
                </button>
              </div>
            </div>
          </div>

          {/* Leaderboard Table */}
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Table Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-4">Player</div>
                  <div className="col-span-2">Tier</div>
                  <div className="col-span-2 text-right">CC Net</div>
                  <div className="col-span-1 text-right">Games</div>
                  <div className="col-span-2 text-right">Win Rate</div>
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-gray-200">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.id}
                    className={`px-4 py-4 hover:bg-gray-50 transition-colors ${
                      entry.id === user?.id ? 'bg-[#0B3D3A]/5' : ''
                    }`}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Rank */}
                      <div className="col-span-1">
                        <div className="flex items-center gap-2">
                          {getPositionIcon(entry.position)}
                          <span className="font-bold text-gray-900">
                            {entry.position}
                          </span>
                        </div>
                      </div>

                      {/* Player */}
                      <div className="col-span-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {entry.name}
                          </span>
                          {entry.hasChampionMarker && (
                            <Star className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                      </div>

                      {/* Tier */}
                      <div className="col-span-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRankColor(entry.currentRank)}`}>
                          {entry.currentRank?.toUpperCase()}
                        </span>
                      </div>

                      {/* CC Net */}
                      <div className="col-span-2 text-right">
                        <span className="font-bold text-[#0B3D3A]">
                          {entry.ccNet.toLocaleString()}
                        </span>
                      </div>

                      {/* Games */}
                      <div className="col-span-1 text-right text-gray-600">
                        {entry.challengesCompleted}
                      </div>

                      {/* Win Rate */}
                      <div className="col-span-2 text-right">
                        <span className={`font-medium ${
                          entry.winRate >= 0.6 ? 'text-green-600' :
                          entry.winRate >= 0.4 ? 'text-gray-600' :
                          'text-red-600'
                        }`}>
                          {(entry.winRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty State */}
              {leaderboard.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No leaderboard data available</p>
                </div>
              )}
            </div>

            {/* Rank Distribution */}
            {activeTab === 'seasonal' && seasonInfo && (
              <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Rank Distribution</h3>
                <div className="grid grid-cols-4 gap-3">
                  {['legend', 'champion', 'pro', 'gold', 'silver', 'bronze', 'amateur', 'house'].map((rank) => (
                    <div key={rank} className="text-center">
                      <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-medium border ${getRankColor(rank)}`}>
                        {rank.toUpperCase()}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {rank === 'legend' && 'Top 1%'}
                        {rank === 'champion' && 'Top 5%'}
                        {rank === 'pro' && 'Top 15%'}
                        {rank === 'gold' && 'Top 35%'}
                        {rank === 'silver' && 'Top 65%'}
                        {rank === 'bronze' && 'Top 90%'}
                        {rank === 'amateur' && 'Bottom 10%'}
                        {rank === 'house' && 'Unranked'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}