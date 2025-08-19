import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import CustomerLayout from '@/components/customer/CustomerLayout';
import { 
  User, 
  Mail, 
  Phone, 
  Save, 
  CheckCircle, 
  Trophy,
  Target,
  Award,
  TrendingUp,
  Shield,
  Star,
  ChevronRight,
  Activity
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
  seasonPosition: number;
  hasChampionMarker: boolean;
}

interface Badge {
  id: string;
  key: string;
  name: string;
  description: string;
  tier: string;
  earnedAt: string;
  isFeatured: boolean;
}

export default function CustomerProfile() {
  const { user, setUser } = useAuthState();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'badges'>('profile');
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
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
      fetchProfileStats();
      fetchBadges();
    }
  }, [user]);

  const fetchProfileStats = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(
        `${API_URL}/api/leaderboard/user/${user?.id}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      if (response.data.success) {
        setProfileStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch profile stats:', error);
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
      console.error('Failed to fetch badges:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('clubos_token');
      
      const response = await axios.put(
        `${API_URL}/customer-profile/users/profile`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        if (user) {
          const updatedUser = { ...user, ...formData };
          setUser(updatedUser);
          localStorage.setItem('clubos_user', JSON.stringify(updatedUser));
        }
        
        setSaved(true);
        toast.success('Profile updated successfully');
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setSaved(false);
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
    return colors[rank?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getBadgeColor = (tier: string) => {
    const colors: Record<string, string> = {
      legendary: 'bg-purple-50 border-purple-200',
      epic: 'bg-indigo-50 border-indigo-200',
      rare: 'bg-blue-50 border-blue-200',
      uncommon: 'bg-green-50 border-green-200',
      common: 'bg-gray-50 border-gray-200'
    };
    return colors[tier?.toLowerCase()] || 'bg-gray-50 border-gray-200';
  };

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header with Rank Display */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-[#0B3D3A] rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getRankColor(profileStats?.currentRank || 'house')}`}>
                      {profileStats?.currentRank?.toUpperCase() || 'HOUSE'}
                    </span>
                    {profileStats?.hasChampionMarker && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                        <Star className="w-3 h-3" />
                        Champion
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">CC Balance</p>
                <p className="text-2xl font-bold text-[#0B3D3A]">
                  {profileStats?.ccBalance?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'profile'
                    ? 'border-[#0B3D3A] text-[#0B3D3A]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'stats'
                    ? 'border-[#0B3D3A] text-[#0B3D3A]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Challenge Stats
              </button>
              <button
                onClick={() => setActiveTab('badges')}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'badges'
                    ? 'border-[#0B3D3A] text-[#0B3D3A]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Badges ({badges.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-2" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                    placeholder="Enter your phone number"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || saved}
                  className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                    saved
                      ? 'bg-green-600 text-white'
                      : 'bg-[#0B3D3A] text-white hover:bg-[#084a45]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {saved ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      {loading ? 'Saving...' : 'Save Changes'}
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && profileStats && (
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Target className="w-5 h-5 text-gray-400" />
                      <span className="text-xs text-gray-500">Total</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{profileStats.totalChallenges}</p>
                    <p className="text-xs text-gray-500">Challenges</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Trophy className="w-5 h-5 text-gray-400" />
                      <span className="text-xs text-gray-500">Wins</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{profileStats.totalWins}</p>
                    <p className="text-xs text-gray-500">Victories</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <TrendingUp className="w-5 h-5 text-gray-400" />
                      <span className="text-xs text-gray-500">Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {(profileStats.winRate * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">Win Rate</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Activity className="w-5 h-5 text-gray-400" />
                      <span className="text-xs text-gray-500">Streak</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                      {Math.abs(profileStats.currentStreak)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {profileStats.currentStreak > 0 ? 'Win' : profileStats.currentStreak < 0 ? 'Loss' : 'No'} Streak
                    </p>
                  </div>
                </div>

                {/* Detailed Stats */}
                <div className="space-y-3">
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Season Position</span>
                    <span className="font-medium">#{profileStats.seasonPosition || 'Unranked'}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Total CC Earned</span>
                    <span className="font-medium text-[#0B3D3A]">
                      {profileStats.totalCCEarned.toLocaleString()} CC
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Highest Rank</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getRankColor(profileStats.highestRank)}`}>
                      {profileStats.highestRank?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-gray-100">
                    <span className="text-gray-600">Best Win Streak</span>
                    <span className="font-medium">{profileStats.maxWinStreak} wins</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={() => window.location.href = '/customer/challenges'}
                    className="w-full py-3 bg-[#0B3D3A] text-white rounded-lg font-medium hover:bg-[#084a45] transition-colors flex items-center justify-center gap-2"
                  >
                    View Challenges
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => window.location.href = '/customer/leaderboard'}
                    className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    View Leaderboard
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Badges Tab */}
            {activeTab === 'badges' && (
              <div className="space-y-6">
                {badges.length === 0 ? (
                  <div className="text-center py-12">
                    <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No badges earned yet</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Complete challenges to earn badges
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {badges.map((badge) => (
                      <div
                        key={badge.id}
                        className={`p-4 rounded-lg border ${getBadgeColor(badge.tier)} ${
                          badge.isFeatured ? 'ring-2 ring-[#0B3D3A]' : ''
                        }`}
                      >
                        <div className="text-center">
                          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2">
                            <Award className="w-6 h-6 text-gray-600" />
                          </div>
                          <h3 className="font-medium text-gray-900 text-sm">{badge.name}</h3>
                          <p className="text-xs text-gray-500 mt-1">{badge.description}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(badge.earnedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}