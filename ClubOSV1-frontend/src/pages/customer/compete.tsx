import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import { 
  Trophy, Users, User, Clock, Target, Check, X, Plus, TrendingUp,
  Coins, UserPlus, Crown, Star, Medal, Home, Shield, Search,
  ChevronRight, Filter, Zap, Award, DollarSign, Activity
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Remove /api from the end if it exists  
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}

interface Challenge {
  id: string;
  status: 'pending' | 'accepted' | 'active' | 'resolved' | 'expired' | 'declined';
  creatorId: string;
  acceptorId: string;
  creatorName: string;
  acceptorName: string;
  creatorRank: string;
  acceptorRank: string;
  creatorHasChampion?: boolean;
  acceptorHasChampion?: boolean;
  wagerAmount: number;
  totalPot: number;
  expiresAt: string;
  courseName: string;
  creatorScore?: number;
  acceptorScore?: number;
  createdAt: string;
  opponent_name?: string;
  settings?: any;
  expires_at?: string;
  wager_amount?: number;
}

interface Competitor {
  id: string;
  user_id: string;
  name: string;
  email: string;
  rank_tier: string;
  cc_balance: number;
  total_challenges_won: number;
  total_challenges_played: number;
  win_rate: number;
  has_champion_marker: boolean;
  is_friend: boolean;
  has_pending_request: boolean;
  last_active?: string;
  home_location?: string;
  handicap?: number;
  wagers_together?: number;
  friendship_id?: string;
}

export default function Compete() {
  const { user } = useAuthState();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'challenges' | 'competitors' | 'leaderboard'>('challenges');
  const [challengeFilter, setChallengeFilter] = useState<'all' | 'active' | 'pending' | 'history'>('all');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<Competitor[]>([]);
  const [ccBalance, setCCBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    if (user.role !== 'customer') {
      toast.error('This feature is only available for customers');
      router.push('/customer');
      return;
    }

    loadData();
  }, [user, activeTab, challengeFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCCBalance(),
        activeTab === 'challenges' ? loadChallenges() : null,
        activeTab === 'competitors' ? loadCompetitors() : null,
        activeTab === 'leaderboard' ? loadLeaderboard() : null
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadCCBalance = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/api/challenges/cc-balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setCCBalance(response.data.data.balance);
      }
    } catch (error) {
      console.error('Error loading CC balance:', error);
    }
  };

  const loadChallenges = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      
      // Load different endpoints based on filter
      let allChallenges: Challenge[] = [];
      
      if (challengeFilter === 'all' || challengeFilter === 'active') {
        const activeRes = await axios.get(`${API_URL}/api/challenges/my-challenges`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (activeRes.data.success) {
          allChallenges = [...allChallenges, ...activeRes.data.data.filter((c: any) => 
            c.status === 'active' || c.status === 'accepted'
          )];
        }
      }
      
      if (challengeFilter === 'all' || challengeFilter === 'pending') {
        const pendingRes = await axios.get(`${API_URL}/api/challenges/my-challenges`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (pendingRes.data.success) {
          allChallenges = [...allChallenges, ...pendingRes.data.data.filter((c: any) => 
            c.status === 'pending'
          )];
        }
      }
      
      if (challengeFilter === 'history') {
        const historyRes = await axios.get(`${API_URL}/api/challenges/my-challenges`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (historyRes.data.success) {
          allChallenges = [...allChallenges, ...historyRes.data.data.filter((c: any) => 
            c.status === 'resolved' || c.status === 'expired' || c.status === 'declined'
          )];
        }
      }
      
      // Remove duplicates by ID
      const uniqueChallenges = Array.from(new Map(allChallenges.map(c => [c.id, c])).values());
      setChallenges(uniqueChallenges);
    } catch (error) {
      console.error('Error loading challenges:', error);
      setChallenges([]);
    }
  };

  const loadCompetitors = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/api/friends?include_stats=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.data?.friends) {
        // Transform friends data to competitor format
        const competitorData = response.data.data.friends.map((friend: any) => ({
          ...friend,
          rank_tier: friend.rank_tier || 'House',
          cc_balance: friend.clubcoin_balance || 0,
          total_challenges_won: friend.wagers_won || 0,
          total_challenges_played: friend.wagers_together || 0,
          win_rate: friend.wagers_together > 0 
            ? Math.round((friend.wagers_won / friend.wagers_together) * 100) 
            : 0,
          has_champion_marker: false,
          is_friend: true,
          has_pending_request: false
        }));
        setCompetitors(competitorData);
      }
    } catch (error) {
      console.error('Error loading competitors:', error);
      setCompetitors([]);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/leaderboard/alltime`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setLeaderboardData(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      // Use mock data for now
      setLeaderboardData([
        { 
          id: '1', user_id: '1', name: 'TigerWoods97', email: '', rank_tier: 'Legend', 
          cc_balance: 18450, total_challenges_won: 142, total_challenges_played: 180, 
          win_rate: 78.9, has_champion_marker: true, is_friend: false, has_pending_request: false 
        },
        { 
          id: '2', user_id: '2', name: 'HappyGilmore', email: '', rank_tier: 'Champion', 
          cc_balance: 15200, total_challenges_won: 98, total_challenges_played: 145, 
          win_rate: 67.6, has_champion_marker: false, is_friend: false, has_pending_request: false 
        },
      ]);
    }
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.post(
        `${API_URL}/api/challenges/${challengeId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Challenge accepted!');
      loadChallenges();
      loadCCBalance();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to accept challenge');
    }
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.post(
        `${API_URL}/api/challenges/${challengeId}/decline`,
        { reason: 'Not interested' },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Challenge declined');
      loadChallenges();
    } catch (error) {
      toast.error('Failed to decline challenge');
    }
  };

  const sendFriendRequest = async (targetUserId: string, targetName: string) => {
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.post(
        `${API_URL}/api/friends/request`,
        { target_user_id: targetUserId },
        { headers: { Authorization: `Bearer ${token}` } }
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
    }
  };

  const getRankIcon = (tier: string) => {
    switch(tier?.toLowerCase()) {
      case 'legend': return <Crown className="w-4 h-4 text-purple-600" />;
      case 'champion': return <Trophy className="w-4 h-4 text-yellow-600" />;
      case 'pro': return <Star className="w-4 h-4 text-blue-600" />;
      case 'gold': return <Medal className="w-4 h-4 text-yellow-500" />;
      case 'silver': return <Medal className="w-4 h-4 text-gray-400" />;
      case 'bronze': return <Medal className="w-4 h-4 text-orange-600" />;
      case 'amateur': return <Target className="w-4 h-4 text-green-600" />;
      case 'house': return <Home className="w-4 h-4 text-gray-600" />;
      default: return <Home className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRankColor = (rank: string) => {
    const colors: Record<string, string> = {
      legend: 'text-purple-600',
      champion: 'text-red-600',
      pro: 'text-blue-600',
      gold: 'text-yellow-600',
      silver: 'text-gray-600',
      bronze: 'text-orange-600',
      amateur: 'text-green-600',
      house: 'text-gray-400'
    };
    return colors[rank?.toLowerCase()] || 'text-gray-500';
  };

  const formatTimeRemaining = (expiresAt: string) => {
    if (!expiresAt) return '';
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff < 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h remaining`;
  };

  const filteredCompetitors = competitors.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLeaderboard = leaderboardData.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Head>
        <title>Compete - Clubhouse Golf</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <div className="flex flex-col h-screen bg-gray-50 pt-14 pb-16 lg:pb-0">
          {/* Header with CC Balance */}
          <div className="bg-white border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#0B3D3A]" />
                  Compete
                </h1>
                <p className="text-sm text-gray-600">
                  Challenge • Compete • Win
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/customer/profile')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#0B3D3A] to-[#084a45] text-white rounded-full hover:opacity-90 transition-opacity"
                >
                  <User className="w-4 h-4" />
                  <span className="font-bold">{ccBalance} CC</span>
                </button>
                <button
                  onClick={() => router.push('/customer/challenges/create')}
                  className="p-2 bg-[#0B3D3A] text-white rounded-lg hover:bg-[#084a45] transition-colors"
                  title="Create Challenge"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border-b px-4">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('challenges')}
                className={`py-3 px-1 border-b-2 transition-colors font-medium ${
                  activeTab === 'challenges'
                    ? 'border-[#0B3D3A] text-[#0B3D3A]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Challenges
                {challenges.filter(c => c.status === 'pending').length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {challenges.filter(c => c.status === 'pending').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('competitors')}
                className={`py-3 px-1 border-b-2 transition-colors font-medium ${
                  activeTab === 'competitors'
                    ? 'border-[#0B3D3A] text-[#0B3D3A]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Competitors
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`py-3 px-1 border-b-2 transition-colors font-medium ${
                  activeTab === 'leaderboard'
                    ? 'border-[#0B3D3A] text-[#0B3D3A]'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Leaderboard
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {/* Challenges Tab */}
            {activeTab === 'challenges' && (
              <div className="p-4">
                {/* Filter Pills */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                  {(['all', 'active', 'pending', 'history'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setChallengeFilter(filter)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                        challengeFilter === filter
                          ? 'bg-[#0B3D3A] text-white'
                          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      {filter === 'pending' && challenges.filter(c => c.status === 'pending').length > 0 && (
                        <span className="ml-1">({challenges.filter(c => c.status === 'pending').length})</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Challenge List */}
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A]"></div>
                  </div>
                ) : challenges.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No {challengeFilter === 'all' ? '' : challengeFilter} challenges
                    </h3>
                    <p className="text-gray-500 mb-6">
                      {challengeFilter === 'pending' && 'When someone challenges you, it will appear here'}
                      {challengeFilter === 'active' && 'Accept a challenge or create a new one to compete'}
                      {challengeFilter === 'history' && 'Your completed challenges will appear here'}
                      {challengeFilter === 'all' && 'Create or accept a challenge to get started'}
                    </p>
                    <button
                      onClick={() => router.push('/customer/challenges/create')}
                      className="bg-[#0B3D3A] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#084a45] transition-colors"
                    >
                      Create Challenge
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {challenges.map((challenge) => (
                      <div
                        key={challenge.id}
                        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                        onClick={() => challenge.status !== 'pending' && router.push(`/customer/challenges/${challenge.id}`)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  vs {challenge.opponent_name || challenge.acceptorName || challenge.creatorName}
                                </span>
                                {getRankIcon(challenge.acceptorRank || challenge.creatorRank)}
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                challenge.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                challenge.status === 'active' || challenge.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                challenge.status === 'resolved' ? 'bg-gray-100 text-gray-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {challenge.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-[#0B3D3A]">
                              {challenge.wager_amount || challenge.wagerAmount || challenge.totalPot} CC
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTimeRemaining(challenge.expires_at || challenge.expiresAt)}
                            </div>
                          </div>
                        </div>

                        {challenge.status === 'pending' && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptChallenge(challenge.id);
                              }}
                              className="flex-1 bg-[#0B3D3A] text-white py-2 rounded-lg font-medium hover:bg-[#084a45] transition-colors flex items-center justify-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              Accept
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeclineChallenge(challenge.id);
                              }}
                              className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Competitors Tab */}
            {activeTab === 'competitors' && (
              <div className="p-4">
                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search competitors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]"
                  />
                </div>

                {/* Competitors List */}
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A]"></div>
                  </div>
                ) : filteredCompetitors.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No competitors yet
                    </h3>
                    <p className="text-gray-500 mb-6">
                      Add competitors from the leaderboard to challenge them
                    </p>
                    <button
                      onClick={() => setActiveTab('leaderboard')}
                      className="text-[#0B3D3A] font-medium hover:underline"
                    >
                      View Leaderboard
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {filteredCompetitors.map((competitor) => (
                      <div
                        key={competitor.id}
                        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                              <span className="text-lg font-medium text-gray-600">
                                {competitor.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{competitor.name}</span>
                                {getRankIcon(competitor.rank_tier)}
                                {competitor.has_champion_marker && (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                    Champion
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                <span className="flex items-center gap-1">
                                  <Coins className="w-3 h-3" />
                                  {competitor.cc_balance} CC
                                </span>
                                <span className="flex items-center gap-1">
                                  <Trophy className="w-3 h-3" />
                                  {competitor.total_challenges_won}W / {competitor.total_challenges_played}P
                                </span>
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  {competitor.win_rate}%
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => router.push(`/customer/challenges/create?friend=${competitor.user_id}`)}
                            className="px-4 py-2 bg-[#0B3D3A] text-white rounded-lg hover:bg-[#084a45] transition-colors flex items-center gap-2"
                          >
                            <Trophy className="w-4 h-4" />
                            Challenge
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div className="p-4">
                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]"
                  />
                </div>

                {/* Leaderboard List */}
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A]"></div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="divide-y divide-gray-200">
                      {filteredLeaderboard.map((player, index) => (
                        <div key={player.user_id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              {/* Rank */}
                              <div className="flex-shrink-0 w-8 text-center">
                                <span className={`font-bold ${
                                  index === 0 ? 'text-yellow-500 text-xl' :
                                  index === 1 ? 'text-gray-400 text-lg' :
                                  index === 2 ? 'text-orange-600 text-lg' :
                                  'text-gray-600'
                                }`}>
                                  {index + 1}
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
                            
                            {/* Action Button */}
                            <div className="flex-shrink-0">
                              {player.user_id !== user?.id && (
                                player.is_friend ? (
                                  <button
                                    onClick={() => router.push(`/customer/challenges/create?friend=${player.user_id}`)}
                                    className="px-3 py-1.5 text-xs font-medium text-[#0B3D3A] hover:bg-[#0B3D3A] hover:text-white border border-[#0B3D3A] rounded-full transition-colors"
                                  >
                                    Challenge
                                  </button>
                                ) : player.has_pending_request ? (
                                  <span className="text-xs text-gray-500 px-3 py-1.5">
                                    Request Sent
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => sendFriendRequest(player.user_id, player.name)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#0B3D3A] hover:bg-[#0B3D3A] hover:text-white border border-[#0B3D3A] rounded-full transition-colors"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    Add
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
            )}
          </div>
        </div>
      </div>
    </>
  );
}