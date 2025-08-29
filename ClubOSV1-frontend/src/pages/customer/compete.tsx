import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import { 
  Trophy, Users, User, Clock, Target, Check, X, Plus, TrendingUp,
  Coins, UserPlus, Crown, Star, Medal, Home, Shield, Search,
  ChevronRight, Filter, Zap, Award, DollarSign, Activity, MoreVertical,
  UserMinus, Ban, Bell, ChevronDown, MapPin, Flag, AlertCircle
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { FriendRequests } from '@/components/customer/FriendRequests';
import { AchievementBadgeGroup } from '@/components/achievements/AchievementBadge';
import { TabNavigation } from '@/components/customer/TabNavigation';

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
  winner_user_id?: string;
  final_payout?: number;
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
  featured_achievements?: Array<{
    id: string;
    name: string;
    icon: string;
    rarity: string;
    color?: string;
    backgroundColor?: string;
    glowColor?: string;
    animationType?: string;
  }>;
  wagers_together?: number;
  friendship_id?: string;
}

export default function Compete() {
  const { user } = useAuthState();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'challenges' | 'competitors' | 'requests'>('challenges');
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [challengeFilter, setChallengeFilter] = useState<'all' | 'active' | 'pending' | 'history'>('all');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [ccBalance, setCCBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [showFriendMenu, setShowFriendMenu] = useState<string | null>(null);
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);

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
    fetchPendingRequestCount();
  }, [user, activeTab, challengeFilter]);

  const fetchPendingRequestCount = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) return; // Don't make request without token
      
      const response = await axios.get(`${API_URL}/api/friends/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const incoming = response.data.data.incoming || 0;
        setPendingRequestCount(incoming);
      }
    } catch (error: any) {
      // Silently fail for auth/rate limit errors
      if (error.response?.status !== 401 && error.response?.status !== 429) {
        console.error('Failed to fetch pending request count:', error);
      }
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showFriendMenu !== null) {
        setShowFriendMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showFriendMenu]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCCBalance(),
        activeTab === 'challenges' ? loadChallenges() : null,
        activeTab === 'competitors' ? loadCompetitors() : null
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadCCBalance = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) return; // Don't make request without token
      
      const response = await axios.get(`${API_URL}/api/challenges/cc-balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setCCBalance(response.data.data.balance);
      }
    } catch (error: any) {
      // Silently fail for auth/rate limit errors
      if (error.response?.status !== 401 && error.response?.status !== 429) {
        console.error('Error loading CC balance:', error);
      }
    }
  };

  const loadChallenges = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) return; // Don't make request without token
      
      // Load challenges ONCE and filter client-side
      const response = await axios.get(`${API_URL}/api/challenges/my-challenges`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        let filteredChallenges = response.data.data || [];
        
        // Apply filter client-side instead of making multiple requests
        if (challengeFilter === 'active') {
          filteredChallenges = filteredChallenges.filter((c: any) => 
            c.status === 'active' || c.status === 'accepted'
          );
        } else if (challengeFilter === 'pending') {
          filteredChallenges = filteredChallenges.filter((c: any) => 
            c.status === 'pending'
          );
        } else if (challengeFilter === 'history') {
          filteredChallenges = filteredChallenges.filter((c: any) => 
            c.status === 'resolved' || c.status === 'expired' || c.status === 'declined'
          );
        }
        // 'all' filter shows everything
        
        setChallenges(filteredChallenges);
      }
    } catch (error: any) {
      // Handle auth errors
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        localStorage.removeItem('clubos_token');
        localStorage.removeItem('clubos_user');
        setTimeout(() => {
          router.push('/login');
        }, 1000);
      } else if (error.response?.status === 429) {
        toast.error('Too many requests. Please wait a moment.');
      } else {
        console.error('Error loading challenges:', error);
      }
      setChallenges([]);
    }
  };

  const loadCompetitors = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) return; // Don't make request without token
      
      const response = await axios.get(`${API_URL}/api/friends?include_stats=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Handle different response structures
      let friendsArray = [];
      if (response.data.data?.friends) {
        friendsArray = response.data.data.friends;
      } else if (Array.isArray(response.data.data)) {
        friendsArray = response.data.data;
      } else if (response.data.friends) {
        friendsArray = response.data.friends;
      }
      
      console.log('Friends from API:', friendsArray.length, 'friends');
      friendsArray.forEach((f: any) => {
        console.log('Friend:', f.email, 'ID:', f.id, 'Name:', f.name);
      });
      
      // Transform friends data to competitor format
      const competitorData = friendsArray.map((friend: any) => ({
        ...friend,
        rank_tier: friend.rank_tier || 'House',
        cc_balance: friend.clubcoin_balance || friend.cc_balance || 0,
        total_challenges_won: friend.total_challenges_won || 0,
        total_challenges_played: friend.total_challenges_played || 0,
        win_rate: friend.win_rate ? Math.round(friend.win_rate * 100) : 0,
        has_champion_marker: friend.has_champion_marker || false,
        is_friend: true,
        has_pending_request: false,
        featured_achievements: friend.featured_achievements || []
      }));
      setCompetitors(competitorData);
    } catch (error) {
      console.error('Error loading competitors:', error);
      setCompetitors([]);
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

  const handleSelectWinner = async (challengeId: string) => {
    try {
      // Find the challenge to get player names
      const challenge = challenges.find(c => c.id === challengeId);
      if (!challenge) return;

      const isCreator = challenge.creatorId === user?.id;
      
      // Show a modal or confirm dialog for winner selection
      const winner = await new Promise<string | null>((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
          <div class="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 class="text-lg font-semibold mb-4">Who Won?</h3>
            <p class="text-sm text-gray-600 mb-4">Select the winner of this challenge:</p>
            <div class="space-y-2">
              <button id="select-me" class="w-full p-3 border rounded-lg hover:bg-gray-50 text-left">
                <div class="font-medium">Me</div>
                <div class="text-sm text-gray-500">${isCreator ? challenge.creatorName : challenge.acceptorName}</div>
              </button>
              <button id="select-opponent" class="w-full p-3 border rounded-lg hover:bg-gray-50 text-left">
                <div class="font-medium">Opponent</div>
                <div class="text-sm text-gray-500">${isCreator ? challenge.acceptorName : challenge.creatorName}</div>
              </button>
              <button id="cancel" class="w-full p-2 text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        const selectMe = modal.querySelector('#select-me') as HTMLButtonElement;
        const selectOpponent = modal.querySelector('#select-opponent') as HTMLButtonElement;
        const cancel = modal.querySelector('#cancel') as HTMLButtonElement;

        selectMe?.addEventListener('click', () => {
          document.body.removeChild(modal);
          resolve(user?.id || null);
        });

        selectOpponent?.addEventListener('click', () => {
          document.body.removeChild(modal);
          resolve(isCreator ? challenge.acceptorId : challenge.creatorId);
        });

        cancel?.addEventListener('click', () => {
          document.body.removeChild(modal);
          resolve(null);
        });
      });

      if (!winner) return;

      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/api/challenges/${challengeId}/select-winner`,
        { winnerId: winner },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      if (response.data.data?.status === 'agreed') {
        toast.success('Both players agree! Challenge will be resolved.');
      } else if (response.data.data?.status === 'disagreement') {
        toast.error('Players disagree on winner. Please discuss or file a dispute.');
      } else {
        toast.success('Winner selection recorded. Waiting for other player.');
      }
      
      loadChallenges();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to select winner');
    }
  };

  const handleDispute = async (challengeId: string) => {
    try {
      const reason = prompt('Please describe the issue with this challenge:');
      if (!reason) return;

      const token = localStorage.getItem('clubos_token');
      await axios.post(
        `${API_URL}/api/challenges/${challengeId}/dispute`,
        { 
          type: 'disagreement',
          description: reason,
          evidence: []
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Dispute filed. An admin will review it soon.');
      loadChallenges();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to file dispute');
    }
  };


  const removeFriend = async (friendshipId: string, friendName: string) => {
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.delete(
        `${API_URL}/api/friends/${friendshipId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${friendName} removed from friends`);
      
      // Refresh the friends list
      loadCompetitors();
      setShowFriendMenu(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove friend');
    }
  };

  const blockUser = async (userId: string, userName: string) => {
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.put(
        `${API_URL}/api/friends/${userId}/block`,
        { reason: 'User blocked' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${userName} has been blocked`);
      
      // Refresh the friends list
      loadCompetitors();
      setShowFriendMenu(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to block user');
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

  return (
    <>
      <Head>
        <title>Compete - Clubhouse Golf</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8">
          {/* Header - Consistent minimalist style */}
          <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] px-4 py-3">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-[var(--text-primary)]">
                    Compete
                  </h1>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                    Challenge friends, win Club Coins
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1 bg-[#0B3D3A]/10 rounded-full">
                    <Coins className="w-4 h-4 text-[#0B3D3A]" />
                    <span className="text-sm font-bold text-[#0B3D3A]">{ccBalance.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => router.push('/customer/challenges/create')}
                    className="p-1.5 bg-[#0B3D3A] text-white rounded-lg hover:bg-[#084a45] transition-colors"
                    title="Create Challenge"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs - Using unified TabNavigation */}
          <TabNavigation
            tabs={[
              { 
                key: 'challenges', 
                label: 'Challenges',
                badge: challenges.filter(c => c.status === 'pending').length || undefined,
                badgeColor: 'red'
              },
              { key: 'competitors', label: 'Competitors' },
              { 
                key: 'requests', 
                label: 'Requests',
                badge: pendingRequestCount || undefined,
                badgeColor: 'red'
              }
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as 'challenges' | 'competitors' | 'requests')}
            sticky={true}
          />

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
                          : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-50'
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
                    <p className="text-gray-800 mb-6">
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
                    {challenges.map((challenge) => {
                      const isExpanded = expandedChallenge === challenge.id;
                      const isCreator = challenge.creatorId === user?.id;
                      
                      return (
                        <div
                          key={challenge.id}
                          className="bg-white rounded-lg border border-gray-200 overflow-hidden transition-all"
                        >
                          {/* Main Challenge Card - Always Visible */}
                          <div
                            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => setExpandedChallenge(isExpanded ? null : challenge.id)}
                          >
                            <div className="flex items-center justify-between">
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
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <div className="font-bold text-[#0B3D3A]">
                                    {challenge.wager_amount || challenge.wagerAmount || challenge.totalPot} CC
                                  </div>
                                  <div className="text-xs text-gray-800">
                                    {formatTimeRemaining(challenge.expires_at || challenge.expiresAt)}
                                  </div>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="border-t border-gray-200 p-4 bg-gray-50">
                              {/* Challenge Details */}
                              <div className="bg-white rounded-lg p-3 mb-4">
                                <div className="space-y-2 text-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-gray-800">
                                      <MapPin className="w-4 h-4" />
                                      <span>Course</span>
                                    </div>
                                    <span className="font-medium">{challenge.courseName === 'DECIDE_LATER' ? 'To Be Decided' : (challenge.courseName || 'TBD')}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-gray-800">
                                      <Target className="w-4 h-4" />
                                      <span>Format</span>
                                    </div>
                                    <span className="font-medium">{challenge.settings?.holes || 18} holes</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-gray-800">
                                      <DollarSign className="w-4 h-4" />
                                      <span>Stakes</span>
                                    </div>
                                    <span className="font-medium">{challenge.wager_amount || challenge.wagerAmount} CC (50/50 split)</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-gray-800">
                                      <Clock className="w-4 h-4" />
                                      <span>Time Remaining</span>
                                    </div>
                                    <span className="font-medium">{formatTimeRemaining(challenge.expires_at || challenge.expiresAt)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              {challenge.status === 'pending' && !isCreator && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAcceptChallenge(challenge.id);
                                    }}
                                    className="flex-1 bg-[#0B3D3A] text-white py-2 rounded-lg font-medium hover:bg-[#084a45] transition-colors flex items-center justify-center gap-2"
                                  >
                                    <Check className="w-4 h-4" />
                                    Accept Challenge
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

                              {(challenge.status === 'active' || challenge.status === 'accepted') && (
                                <div className="space-y-3">
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-sm text-blue-800">
                                      <strong>Action Required:</strong> Complete your round and sync with TrackMan to record your score.
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectWinner(challenge.id);
                                      }}
                                      className="flex-1 bg-[#0B3D3A] text-white py-2 rounded-lg font-medium hover:bg-[#084a45] transition-colors flex items-center justify-center gap-2"
                                    >
                                      <Trophy className="w-4 h-4" />
                                      Select Winner
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDispute(challenge.id);
                                      }}
                                      className="flex-1 bg-red-50 text-red-700 py-2 rounded-lg font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-200"
                                    >
                                      <AlertCircle className="w-4 h-4" />
                                      Dispute
                                    </button>
                                  </div>
                                </div>
                              )}

                              {challenge.status === 'resolved' && (
                                <div className="text-center py-3">
                                  <p className="text-sm font-medium text-gray-900">
                                    {challenge.winner_user_id === user?.id ? '🏆 You Won!' : 'Challenge Complete'}
                                  </p>
                                  {challenge.final_payout && challenge.winner_user_id === user?.id && (
                                    <p className="text-lg font-bold text-[#0B3D3A] mt-1">+{challenge.final_payout} CC</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Competitors Tab */}
            {activeTab === 'competitors' && (
              <div className="p-4">
                {/* Header with description */}
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Your Friends</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Challenge your friends to head-to-head golf matches
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search friends..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]"
                  />
                </div>

                {/* Friends List */}
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A]"></div>
                  </div>
                ) : filteredCompetitors.length === 0 && searchTerm ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No friends found
                    </h3>
                    <p className="text-gray-500">
                      Try a different search term
                    </p>
                  </div>
                ) : filteredCompetitors.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No friends yet
                    </h3>
                    <p className="text-gray-800 mb-6">
                      Send friend requests to other players to challenge them
                    </p>
                    <button
                      onClick={() => router.push('/customer/leaderboard')}
                      className="px-4 py-2 bg-[#0B3D3A] text-white rounded-lg font-medium hover:bg-[#084a45] transition-colors"
                    >
                      Find Players
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {filteredCompetitors.map((competitor) => (
                      <div
                        key={competitor.id || competitor.user_id}
                        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                            onClick={() => router.push(`/customer/challenges/create?friend=${competitor.user_id || competitor.id}`)}
                          >
                            <div className="w-12 h-12 bg-gradient-to-br from-[#0B3D3A] to-[#084a45] rounded-full flex items-center justify-center">
                              <span className="text-lg font-bold text-white">
                                {competitor.name?.charAt(0).toUpperCase() || '?'}
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
                                {/* Achievement Badges */}
                                {competitor.featured_achievements && competitor.featured_achievements.length > 0 && (
                                  <AchievementBadgeGroup
                                    achievements={competitor.featured_achievements}
                                    size="xs"
                                    maxDisplay={3}
                                  />
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
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => router.push(`/customer/challenges/create?friend=${competitor.user_id || competitor.id}`)}
                              className="px-4 py-2 bg-[#0B3D3A] text-white rounded-lg font-medium hover:bg-[#084a45] transition-colors flex items-center gap-2"
                            >
                              <Trophy className="w-4 h-4" />
                              Challenge
                            </button>
                            
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowFriendMenu(showFriendMenu === competitor.id ? null : competitor.id);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <MoreVertical className="w-4 h-4 text-gray-600" />
                              </button>
                              
                              {showFriendMenu === competitor.id && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeFriend(competitor.friendship_id || competitor.id, competitor.name);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                  >
                                    <UserMinus className="w-4 h-4" />
                                    Remove Friend
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      blockUser(competitor.user_id || competitor.id, competitor.name);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600 border-t border-gray-100"
                                  >
                                    <Ban className="w-4 h-4" />
                                    Block User
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Friend Requests Tab */}
            {activeTab === 'requests' && (
              <div className="p-4">
                <FriendRequests />
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}