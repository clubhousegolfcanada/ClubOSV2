import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import { 
  Crown, Trophy, Star, Medal, Target, Home, Shield,
  TrendingUp, Award, Activity, Clock, ChevronRight,
  Settings, History, BarChart3, Coins, Zap, Flame,
  User, Mail, Phone, Save, CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ProfileStats {
  currentRank: string;
  highestRank: string;
  ccBalance: number;
  totalCCEarned: number;
  totalChallenges: number;
  totalWins: number;
  winRate: number;
  currentStreak: number;
  maxWinStreak: number;
  maxLossStreak: number;
  seasonPosition: number;
  hasChampionMarker: boolean;
  championTitles?: string[];
  loreLine?: string;
}

interface Badge {
  id: string;
  key: string;
  name: string;
  description: string;
  tier: string;
  earnedAt: string;
  isFeatured: boolean;
  icon?: string;
}

interface SeasonHistory {
  seasonId: string;
  seasonName: string;
  finalRank: string;
  finalPosition: number;
  ccEarned: number;
  challenges: number;
  wins: number;
}

interface RecentActivity {
  id: string;
  type: 'win' | 'loss' | 'badge' | 'rank_up';
  description: string;
  ccChange?: number;
  timestamp: string;
}

export default function CustomerProfile() {
  const { user } = useAuthState();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'badges' | 'settings'>('overview');
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [seasonHistory, setSeasonHistory] = useState<SeasonHistory[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
      fetchProfileData();
    }
  }, [user]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProfileStats(),
        fetchBadges(),
        fetchSeasonHistory(),
        fetchRecentActivity()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileStats = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(
        `${API_URL}/api/leaderboard/user/${user?.id}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      if (response.data.success) {
        // Add mock lore line based on badges/stats
        const stats = response.data.data;
        stats.loreLine = generateLoreLine(stats);
        setProfileStats(stats);
      }
    } catch (error) {
      // Use mock data for demo
      setProfileStats({
        currentRank: 'Gold',
        highestRank: 'Pro',
        ccBalance: 4250,
        totalCCEarned: 18500,
        totalChallenges: 142,
        totalWins: 89,
        winRate: 0.627,
        currentStreak: 3,
        maxWinStreak: 12,
        maxLossStreak: 5,
        seasonPosition: 24,
        hasChampionMarker: true,
        championTitles: ['Summer Open 2025'],
        loreLine: 'Giant Killer • Bay Rat'
      });
    }
  };

  const fetchBadges = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(
        `${API_URL}/api/badges/user/${user?.id}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      if (response.data.success) {
        setBadges(response.data.data || []);
      }
    } catch (error) {
      // Mock badges for demo
      setBadges([
        { id: '1', key: 'giant_killer', name: 'Giant Killer', description: 'Defeated higher ranked opponent', tier: 'epic', earnedAt: '2025-08-15', isFeatured: true, icon: 'sword' },
        { id: '2', key: 'bay_rat', name: 'Bay Rat', description: 'Spent 100+ hours in simulators', tier: 'rare', earnedAt: '2025-08-10', isFeatured: false, icon: 'clock' },
        { id: '3', key: 'hot_streak', name: 'On Fire', description: 'Won 5 challenges in a row', tier: 'uncommon', earnedAt: '2025-08-05', isFeatured: false, icon: 'flame' },
        { id: '4', key: 'first_blood', name: 'First Blood', description: 'Won your first challenge', tier: 'common', earnedAt: '2025-07-20', isFeatured: false, icon: 'trophy' }
      ]);
    }
  };

  const fetchSeasonHistory = async () => {
    // Mock season history
    setSeasonHistory([
      { seasonId: '1', seasonName: 'Summer 2025', finalRank: 'Pro', finalPosition: 8, ccEarned: 8500, challenges: 62, wins: 41 },
      { seasonId: '2', seasonName: 'Spring 2025', finalRank: 'Gold', finalPosition: 18, ccEarned: 5200, challenges: 48, wins: 28 },
      { seasonId: '3', seasonName: 'Winter 2025', finalRank: 'Silver', finalPosition: 42, ccEarned: 3100, challenges: 32, wins: 15 }
    ]);
  };

  const fetchRecentActivity = async () => {
    // Mock recent activity
    setRecentActivity([
      { id: '1', type: 'win', description: 'Defeated TigerWoods97', ccChange: 150, timestamp: '2025-08-19T14:30:00' },
      { id: '2', type: 'badge', description: 'Earned "Giant Killer" badge', timestamp: '2025-08-19T14:25:00' },
      { id: '3', type: 'loss', description: 'Lost to HappyGilmore', ccChange: -75, timestamp: '2025-08-19T12:00:00' },
      { id: '4', type: 'rank_up', description: 'Promoted to Gold tier', timestamp: '2025-08-18T18:00:00' },
      { id: '5', type: 'win', description: 'Defeated TheShark', ccChange: 200, timestamp: '2025-08-18T16:30:00' }
    ]);
  };

  const generateLoreLine = (stats: ProfileStats) => {
    const lines = [];
    if (stats.winRate > 0.7) lines.push('Dominator');
    if (stats.maxWinStreak > 10) lines.push('Untouchable');
    if (stats.totalChallenges > 100) lines.push('Bay Rat');
    if (stats.hasChampionMarker) lines.push('Champion');
    return lines.slice(0, 2).join(' • ') || 'Rising Star';
  };

  const getRankEmblem = (rank: string) => {
    const emblems: Record<string, { icon: any, color: string, bg: string }> = {
      legend: { icon: Crown, color: 'text-purple-600', bg: 'bg-purple-100' },
      champion: { icon: Trophy, color: 'text-red-600', bg: 'bg-red-100' },
      pro: { icon: Star, color: 'text-blue-600', bg: 'bg-blue-100' },
      gold: { icon: Medal, color: 'text-yellow-600', bg: 'bg-yellow-100' },
      silver: { icon: Medal, color: 'text-gray-500', bg: 'bg-gray-100' },
      bronze: { icon: Medal, color: 'text-orange-600', bg: 'bg-orange-100' },
      amateur: { icon: Target, color: 'text-green-600', bg: 'bg-green-100' },
      house: { icon: Home, color: 'text-gray-600', bg: 'bg-gray-50' }
    };
    return emblems[rank?.toLowerCase()] || emblems.house;
  };

  const getBadgeIcon = (iconKey?: string) => {
    const icons: Record<string, any> = {
      sword: Shield,
      clock: Clock,
      flame: Flame,
      trophy: Trophy,
      zap: Zap
    };
    return icons[iconKey || 'trophy'] || Award;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.put(
        `${API_URL}/customer-profile/users/profile`,
        formData,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const RankEmblem = getRankEmblem(profileStats?.currentRank || 'house');

  return (
    <>
      <Head>
        <title>Profile - Clubhouse Golf</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8">
          {/* Hero Section */}
          <div className="bg-gradient-to-b from-[#0B3D3A] to-[#084a45] text-white">
            <div className="max-w-6xl mx-auto px-4 py-8">
              <div className="text-center">
                {/* Rank Emblem */}
                <div className={`w-24 h-24 mx-auto mb-4 rounded-full ${RankEmblem.bg} flex items-center justify-center`}>
                  <RankEmblem.icon className={`w-12 h-12 ${RankEmblem.color}`} />
                </div>
                
                {/* Username & Rank */}
                <h1 className="text-3xl font-bold mb-2">{user.name}</h1>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-lg font-medium uppercase tracking-wide">
                    {profileStats?.currentRank || 'HOUSE'} TIER
                  </span>
                  {profileStats?.hasChampionMarker && (
                    <div className="flex items-center gap-1 bg-yellow-500/20 px-3 py-1 rounded-full">
                      <Trophy className="w-4 h-4" />
                      <span className="text-sm font-medium">Champion</span>
                    </div>
                  )}
                </div>
                
                {/* Lore Line */}
                {profileStats?.loreLine && (
                  <p className="text-white/80 italic text-sm">
                    "{profileStats.loreLine}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Stats Overview Grid */}
          <div className="max-w-6xl mx-auto px-4 -mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg shadow-sm p-4 text-center">
                <div className="text-3xl font-bold text-[#0B3D3A]">
                  {profileStats?.totalCCEarned?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">All-Time CC Earned</div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-4 text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {profileStats?.totalWins || 0}–{(profileStats?.totalChallenges || 0) - (profileStats?.totalWins || 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {((profileStats?.winRate || 0) * 100).toFixed(0)}% Win Rate
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-4 text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {profileStats?.ccBalance?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">Current CC</div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div>
                    <span className="text-lg font-bold text-green-600">
                      W{profileStats?.maxWinStreak || 0}
                    </span>
                    <span className="text-gray-400 mx-1">•</span>
                    <span className="text-lg font-bold text-red-600">
                      L{profileStats?.maxLossStreak || 0}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">Best Streaks</div>
              </div>
            </div>
          </div>

          {/* Badges Showcase */}
          {badges.length > 0 && (
            <div className="max-w-6xl mx-auto px-4 mt-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Badges</h2>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {badges.slice(0, 6).map((badge) => {
                    const BadgeIcon = getBadgeIcon(badge.icon);
                    const isPrideOfPlace = badge.tier === 'epic' || badge.tier === 'legendary';
                    return (
                      <div
                        key={badge.id}
                        className={`relative group cursor-pointer ${isPrideOfPlace ? 'col-span-2' : ''}`}
                      >
                        <div className={`
                          p-3 rounded-lg border-2 transition-all
                          ${isPrideOfPlace 
                            ? 'border-purple-200 bg-purple-50 hover:border-purple-300' 
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'}
                        `}>
                          <BadgeIcon className={`
                            mx-auto mb-2
                            ${isPrideOfPlace ? 'w-8 h-8' : 'w-6 h-6'}
                            ${badge.tier === 'legendary' ? 'text-purple-600' :
                              badge.tier === 'epic' ? 'text-indigo-600' :
                              badge.tier === 'rare' ? 'text-blue-600' :
                              badge.tier === 'uncommon' ? 'text-green-600' :
                              'text-gray-600'}
                          `} />
                          <p className="text-xs font-medium text-center truncate">{badge.name}</p>
                        </div>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {badge.description}
                        </div>
                      </div>
                    );
                  })}
                  {badges.length > 6 && (
                    <button
                      onClick={() => setActiveTab('badges')}
                      className="p-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-all flex items-center justify-center"
                    >
                      <span className="text-sm text-gray-500">+{badges.length - 6}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Career Timeline */}
          <div className="max-w-6xl mx-auto px-4 mt-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Career Timeline</h2>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {seasonHistory.map((season, index) => {
                  const SeasonEmblem = getRankEmblem(season.finalRank);
                  return (
                    <div key={season.seasonId} className="flex items-center">
                      <div className="text-center min-w-[80px]">
                        <div className={`w-12 h-12 mx-auto mb-1 rounded-full ${SeasonEmblem.bg} flex items-center justify-center`}>
                          <SeasonEmblem.icon className={`w-6 h-6 ${SeasonEmblem.color}`} />
                        </div>
                        <p className="text-xs font-medium">{season.seasonName}</p>
                        <p className="text-xs text-gray-500">#{season.finalPosition}</p>
                      </div>
                      {index < seasonHistory.length - 1 && (
                        <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="max-w-6xl mx-auto px-4 mt-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        activity.type === 'win' ? 'bg-green-100' :
                        activity.type === 'loss' ? 'bg-red-100' :
                        activity.type === 'badge' ? 'bg-purple-100' :
                        'bg-blue-100'
                      }`}>
                        {activity.type === 'win' ? <Trophy className="w-4 h-4 text-green-600" /> :
                         activity.type === 'loss' ? <TrendingUp className="w-4 h-4 text-red-600 rotate-180" /> :
                         activity.type === 'badge' ? <Award className="w-4 h-4 text-purple-600" /> :
                         <TrendingUp className="w-4 h-4 text-blue-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {activity.ccChange && (
                      <div className={`flex items-center gap-1 ${
                        activity.ccChange > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <Coins className="w-4 h-4" />
                        <span className="font-medium">
                          {activity.ccChange > 0 ? '+' : ''}{activity.ccChange}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Deep Dive Tabs */}
          <div className="max-w-6xl mx-auto px-4 mt-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b border-gray-200">
                <div className="flex">
                  {[
                    { key: 'overview', label: 'Overview', icon: BarChart3 },
                    { key: 'history', label: 'Challenge History', icon: History },
                    { key: 'badges', label: 'All Badges', icon: Award },
                    { key: 'settings', label: 'Settings', icon: Settings }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key as any)}
                      className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                        activeTab === tab.key
                          ? 'border-[#0B3D3A] text-[#0B3D3A]'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className="hidden md:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'settings' && (
                  <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2 bg-[#0B3D3A] text-white rounded-lg font-medium hover:bg-[#084a45] transition-colors disabled:opacity-50"
                    >
                      Save Changes
                    </button>
                  </form>
                )}

                {activeTab === 'overview' && (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>Full statistics dashboard coming soon</p>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="text-center py-8 text-gray-500">
                    <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>Challenge history coming soon</p>
                  </div>
                )}

                {activeTab === 'badges' && (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {badges.map((badge) => {
                      const BadgeIcon = getBadgeIcon(badge.icon);
                      return (
                        <div key={badge.id} className="p-3 rounded-lg border border-gray-200 text-center">
                          <BadgeIcon className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                          <p className="text-xs font-medium">{badge.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{badge.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}