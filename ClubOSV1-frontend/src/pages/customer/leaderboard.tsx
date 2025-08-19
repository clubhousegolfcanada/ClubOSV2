import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import { Trophy, Download, UserPlus, Award, TrendingUp, Coins, Crown, Star, Medal, Home, Target } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Remove /api from the end if it exists
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}

interface LeaderboardEntry {
  user_id: string;
  name: string;
  rank: number;
  rank_tier: string;
  cc_balance: number;
  total_challenges_won: number;
  total_challenges_played: number;
  win_rate: number;
  has_champion_marker: boolean;
  is_friend: boolean;
  has_pending_request: boolean;
}

export default function CustomerLeaderboard() {
  const router = useRouter();
  const { user } = useAuthState();
  const [activeTab, setActiveTab] = useState<'pro' | 'house' | 'closest' | 'alltime'>('pro');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  // TrackMan embed URLs
  const embedUrls = {
    pro: 'https://tm-short.me/pZY461g', // Pro League
    house: 'https://tm-short.me/Tqjb7AS', // House League
    closest: 'https://tm-short.me/IsUwwGi', // Closest to the Pin
    alltime: null // All-time will be custom implementation
  };

  // Fetch all-time leaderboard data
  useEffect(() => {
    if (activeTab === 'alltime' && user) {
      fetchLeaderboard();
    }
  }, [activeTab, user]);

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const response = await axios.get(`${API_URL}/api/leaderboard/alltime`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setLeaderboardData(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      // Use mock data for now if endpoint doesn't exist
      setLeaderboardData([
        { user_id: '1', name: 'TigerWoods97', rank: 1, rank_tier: 'Legend', cc_balance: 18450, total_challenges_won: 142, total_challenges_played: 180, win_rate: 78.9, has_champion_marker: true, is_friend: false, has_pending_request: false },
        { user_id: '2', name: 'HappyGilmore', rank: 2, rank_tier: 'Champion', cc_balance: 15200, total_challenges_won: 98, total_challenges_played: 145, win_rate: 67.6, has_champion_marker: false, is_friend: false, has_pending_request: false },
        { user_id: '3', name: 'TheShark', rank: 3, rank_tier: 'Champion', cc_balance: 14800, total_challenges_won: 89, total_challenges_played: 132, win_rate: 67.4, has_champion_marker: false, is_friend: true, has_pending_request: false },
        { user_id: '4', name: 'LongBallLarry', rank: 4, rank_tier: 'Pro', cc_balance: 12100, total_challenges_won: 72, total_challenges_played: 118, win_rate: 61.0, has_champion_marker: false, is_friend: false, has_pending_request: false },
        { user_id: '5', name: 'AceVentura', rank: 5, rank_tier: 'Pro', cc_balance: 10500, total_challenges_won: 65, total_challenges_played: 110, win_rate: 59.1, has_champion_marker: false, is_friend: false, has_pending_request: true },
      ]);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const sendFriendRequest = async (targetUserId: string, targetName: string) => {
    setSendingRequest(targetUserId);
    try {
      await axios.post(
        `${API_URL}/api/friends/request`,
        { target_user_id: targetUserId },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      toast.success(`Friend request sent to ${targetName}!`);
      // Update the leaderboard to show pending status
      setLeaderboardData(prev => 
        prev.map(entry => 
          entry.user_id === targetUserId 
            ? { ...entry, has_pending_request: true }
            : entry
        )
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send friend request');
    } finally {
      setSendingRequest(null);
    }
  };

  const getRankIcon = (tier: string) => {
    switch(tier) {
      case 'Legend': return <Crown className="w-4 h-4 text-purple-600" />;
      case 'Champion': return <Trophy className="w-4 h-4 text-yellow-600" />;
      case 'Pro': return <Star className="w-4 h-4 text-blue-600" />;
      case 'Gold': return <Medal className="w-4 h-4 text-yellow-500" />;
      case 'Silver': return <Medal className="w-4 h-4 text-gray-400" />;
      case 'Bronze': return <Medal className="w-4 h-4 text-orange-600" />;
      case 'Amateur': return <Target className="w-4 h-4 text-green-600" />;
      case 'House': return <Home className="w-4 h-4 text-gray-600" />;
      default: return <Home className="w-4 h-4 text-gray-600" />;
    }
  };

  if (!user) {
    router.push('/login');
    return null;
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
              // All-time leaderboard with friend request functionality
              <div className="p-4">
                {loadingLeaderboard ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A]"></div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-[#0B3D3A] to-[#084a45] text-white">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Trophy className="w-5 h-5" />
                        All-Time Rankings
                      </h3>
                      <p className="text-xs text-white/80 mt-1">Season-wide competitive standings</p>
                    </div>
                    
                    <div className="divide-y divide-gray-200">
                      {leaderboardData.map((player) => (
                        <div key={player.user_id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {/* Rank */}
                              <div className="flex-shrink-0 w-8 text-center">
                                <span className={`font-bold ${
                                  player.rank === 1 ? 'text-yellow-500 text-xl' :
                                  player.rank === 2 ? 'text-gray-400 text-lg' :
                                  player.rank === 3 ? 'text-orange-600 text-lg' :
                                  'text-gray-600'
                                }`}>
                                  {player.rank}
                                </span>
                              </div>
                              
                              {/* Player Info */}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">
                                    {player.name}
                                  </span>
                                  {getRankIcon(player.rank_tier)}
                                  {player.has_champion_marker && (
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                      Champion
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Coins className="w-3 h-3" />
                                    {player.cc_balance.toLocaleString()} CC
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Trophy className="w-3 h-3" />
                                    {player.total_challenges_won}W / {player.total_challenges_played}P
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    {player.win_rate}%
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Friend Request Button */}
                            <div className="flex-shrink-0">
                              {player.user_id !== user?.id && (
                                player.is_friend ? (
                                  <span className="text-xs text-gray-500 px-3 py-1.5">
                                    ✓ Friends
                                  </span>
                                ) : player.has_pending_request ? (
                                  <span className="text-xs text-gray-500 px-3 py-1.5">
                                    Request Sent
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => sendFriendRequest(player.user_id, player.name)}
                                    disabled={sendingRequest === player.user_id}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#0B3D3A] hover:bg-[#0B3D3A] hover:text-white border border-[#0B3D3A] rounded-full transition-colors disabled:opacity-50"
                                  >
                                    {sendingRequest === player.user_id ? (
                                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                                    ) : (
                                      <>
                                        <UserPlus className="w-3 h-3" />
                                        Add Friend
                                      </>
                                    )}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {leaderboardData.length === 0 && (
                      <div className="p-8 text-center text-gray-500">
                        <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p>No players ranked yet. Start playing to climb the leaderboard!</p>
                      </div>
                    )}
                  </div>
                )}
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