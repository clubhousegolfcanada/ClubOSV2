import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import { ProfileAchievements } from '@/components/customer/ProfileAchievements';
import { TierBadge, TierProgressBar, calculateTierFromCC, getNextTier, tierConfigs } from '@/components/TierBadge';
import { BoxOpeningSlotMachine } from '@/components/customer/BoxOpeningSlotMachine';
import Head from 'next/head';
import { 
  Trophy, User, Mail, Phone, Save, ChevronRight,
  Settings, BarChart3, Coins, TrendingUp, Calendar,
  Target, Clock, Award, MapPin, Shield, X, Eye, EyeOff, Gift, Package, Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Remove /api from the end if it exists
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  location?: string;
  homeGolfCourse?: string;
  memberSince?: string;
  handicap?: number;
  ccBalance: number;
  totalCCEarned: number;
  totalChallenges: number;
  totalWins: number;
  winRate: number;
  currentStreak: number;
  longestStreak: number;
  rank?: string;
  totalBookings?: number;
  boxProgress?: number;
  availableBoxes?: number;
  activeRewards?: number;
}

interface Box {
  id: string;
  status: 'available' | 'opened' | 'revoked';
  earnedAt: string;
}

interface BoxReward {
  id: string;
  rewardType: string;
  rewardName: string;
  rewardValue: any;
  voucherCode?: string;
  expiresAt?: Date;
}

export default function CustomerProfile() {
  const { user } = useAuthState();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'account' | 'preferences'>('stats');
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [editMode, setEditMode] = useState(false);
  
  // Box opening state
  const [availableBoxes, setAvailableBoxes] = useState<Box[]>([]);
  const [activeRewards, setActiveRewards] = useState<BoxReward[]>([]);
  const [opening, setOpening] = useState(false);
  const [openedReward, setOpenedReward] = useState<BoxReward | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [showSlotMachine, setShowSlotMachine] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    homeGolfCourse: '',
    bio: '',
    handicap: ''
  });
  
  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  // Preferences state
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    smsNotifications: false,
    publicProfile: true
  });

  useEffect(() => {
    if (user) {
      fetchProfileData();
    }
  }, [user]);

  // Auto-refresh on tab focus
  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && user) {
        fetchProfileData(); // Refresh stats when user returns to tab
      }
    };
    
    document.addEventListener('visibilitychange', handleFocus);
    
    // Also refresh when navigating back to this page
    const handleRouteChange = () => {
      if (user) {
        fetchProfileData();
      }
    };
    
    window.addEventListener('focus', handleRouteChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleRouteChange);
    };
  }, [user]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('clubos_token');
      
      // Fetch profile stats first
      const statsResponse = await axios.get(`${API_URL}/api/profile/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Box endpoints may not exist yet, so handle gracefully
      let boxStatsResponse = { data: { progress: { current: 0 }, availableCount: 0, rewardsCount: 0 } };
      let boxesResponse = { data: [] };
      let rewardsResponse = { data: [] };
      
      // Try to fetch box data but don't fail if endpoints don't exist
      try {
        const [boxStats, boxes, rewards] = await Promise.all([
          axios.get(`${API_URL}/api/boxes/stats`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null),
          axios.get(`${API_URL}/api/boxes/available`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null),
          axios.get(`${API_URL}/api/boxes/rewards`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null)
        ]);
        
        if (boxStats) boxStatsResponse = boxStats;
        if (boxes) boxesResponse = boxes;
        if (rewards) rewardsResponse = rewards;
      } catch (error) {
        // Box endpoints not available, use defaults
        console.log('Box endpoints not available yet');
      }
      
      if (statsResponse.data.success) {
        const stats = statsResponse.data.data;
        const boxStats = boxStatsResponse.data;
        
        const profileInfo: ProfileData = {
          name: stats.user.name || '',
          email: stats.user.email || '',
          phone: stats.user.phone || '',
          location: stats.profile.homeLocation || 'Not set',
          homeGolfCourse: stats.profile.homeGolfCourse || '',
          memberSince: stats.user.memberSince 
            ? new Date(stats.user.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : 'Unknown',
          handicap: stats.profile.handicap,
          ccBalance: stats.clubcoins.balance,
          totalCCEarned: stats.clubcoins.totalEarned || stats.clubcoins.balance || 0,
          totalChallenges: stats.challenges.totalPlayed,
          totalWins: stats.challenges.totalWon,
          winRate: stats.challenges.winRate,
          currentStreak: stats.challenges.currentStreak,
          longestStreak: stats.challenges.longestWinStreak,
          rank: stats.ranking.currentRank || 'House',
          totalBookings: stats.social.totalBookings,
          boxProgress: boxStats?.progress?.current || 0,
          availableBoxes: boxStats?.availableCount || 0,
          activeRewards: boxStats?.rewardsCount || 0
        };
        
        setProfileData(profileInfo);
        setAvailableBoxes(boxesResponse.data || []);
        setActiveRewards(rewardsResponse.data || []);
        setFormData({
          name: profileInfo.name,
          email: profileInfo.email,
          phone: profileInfo.phone,
          location: profileInfo.location || '',
          homeGolfCourse: profileInfo.homeGolfCourse || '',
          bio: stats.profile.bio || '',
          handicap: profileInfo.handicap?.toString() || ''
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile stats:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.put(
        `${API_URL}/api/auth/profile`,
        {
          name: formData.name,
          phone: formData.phone,
          location: formData.location,
          homeGolfCourse: formData.homeGolfCourse,
          bio: formData.bio,
          handicap: formData.handicap ? parseFloat(formData.handicap) : undefined
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success('Profile updated successfully');
      setEditMode(false);
      fetchProfileData();
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleBoxClick = (box: Box) => {
    setSelectedBox(box);
    setShowSlotMachine(true);
  };
  
  const openBox = async (): Promise<BoxReward> => {
    if (!selectedBox) throw new Error('No box selected');
    
    const token = localStorage.getItem('clubos_token');
    
    const response = await axios.post(
      `${API_URL}/api/boxes/${selectedBox.id}/open`,
      {},
      { headers: { Authorization: `Bearer ${token}` }}
    );
    
    // Refresh data after successful opening
    fetchProfileData();
    
    return response.data.reward;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.post(
        `${API_URL}/api/auth/change-password`,
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePreferenceChange = async (key: string, value: boolean) => {
    try {
      const token = localStorage.getItem('clubos_token');
      const updatedPreferences = { ...preferences, [key]: value };
      
      // Update local state immediately for better UX
      setPreferences(updatedPreferences);
      
      // Save to backend
      await axios.put(
        `${API_URL}/api/customer-profile`,
        {
          notification_preferences: {
            email: updatedPreferences.emailNotifications,
            sms: updatedPreferences.smsNotifications
          },
          profile_visibility: updatedPreferences.publicProfile ? 'public' : 'private'
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Preferences updated');
    } catch (error) {
      // Revert on error
      setPreferences(preferences);
      toast.error('Failed to update preferences');
    }
  };

  if (!user) return null;

  const statCards = [
    {
      label: 'ClubCoins',
      value: profileData?.ccBalance || 0,
      icon: Coins,
      color: 'text-[#0B3D3A]'
    },
    {
      label: 'Win Rate',
      value: `${Math.round((profileData?.winRate || 0) * 100)}%`,
      icon: TrendingUp,
      color: 'text-[#0B3D3A]'
    },
    {
      label: 'Total Wins',
      value: profileData?.totalWins || 0,
      icon: Trophy,
      color: 'text-[#0B3D3A]'
    },
    {
      label: 'Current Streak',
      value: profileData?.currentStreak || 0,
      icon: Target,
      color: 'text-[#0B3D3A]'
    }
  ];

  return (
    <>
      <Head>
        <title>Profile - Clubhouse Golf</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8">
          {/* Compact Header with tier accents */}
          <div className={`bg-white border-b ${
            profileData ? `${tierConfigs[calculateTierFromCC(profileData.totalCCEarned)].outlineColor} border-l-4` : 'border-gray-200'
          }`}>
            <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    profileData 
                      ? tierConfigs[calculateTierFromCC(profileData.totalCCEarned)].bgColor
                      : 'bg-[#0B3D3A]'
                  }`}>
                    {profileData ? (
                      React.cloneElement(tierConfigs[calculateTierFromCC(profileData.totalCCEarned)].icon as React.ReactElement, {
                        className: `w-6 h-6 ${tierConfigs[calculateTierFromCC(profileData.totalCCEarned)].iconColor}`
                      })
                    ) : (
                      <span className="text-lg font-bold text-white">
                        {user.name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{user.name}</h1>
                      {profileData && (
                        <TierBadge 
                          tier={calculateTierFromCC(profileData.totalCCEarned)} 
                          size="sm"
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                      <span>{user.email}</span>
                      {profileData?.location && (
                        <>
                          <span className="text-gray-400">•</span>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{profileData.location}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Tabs */}
          <div className="bg-white border-b border-gray-200 sticky top-14 z-10">
            <div className="max-w-6xl mx-auto px-3">
              <div className="flex gap-4 sm:gap-6">
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`py-2.5 px-1 border-b-2 text-xs sm:text-sm font-medium transition-colors ${
                    activeTab === 'stats'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Statistics
                </button>
                <button
                  onClick={() => setActiveTab('account')}
                  className={`py-2.5 px-1 border-b-2 text-xs sm:text-sm font-medium transition-colors ${
                    activeTab === 'account'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Account
                </button>
                <button
                  onClick={() => setActiveTab('preferences')}
                  className={`py-2.5 px-1 border-b-2 text-xs sm:text-sm font-medium transition-colors ${
                    activeTab === 'preferences'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Preferences
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            {/* Statistics Tab */}
            {activeTab === 'stats' && (
              <div className="space-y-4">
                {/* Compact Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                  {statCards.map((stat, index) => (
                    <div key={index} className="bg-white rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <stat.icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-gray-900">{stat.value}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Compact Tier Progression */}
                {profileData && (
                  <div className={`bg-white rounded-lg border p-4 border-l-4 ${
                    tierConfigs[calculateTierFromCC(profileData.totalCCEarned)].outlineColor
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-semibold text-gray-900">Tier Progression</h2>
                      <div className="flex gap-3 text-xs">
                        <span className="text-gray-500">Total Earned:</span>
                        <span className="font-bold text-[#0B3D3A]">{profileData.totalCCEarned.toLocaleString()} CC</span>
                      </div>
                    </div>
                    <TierProgressBar
                      currentCC={profileData.totalCCEarned}
                      tier={calculateTierFromCC(profileData.totalCCEarned)}
                      nextTier={getNextTier(calculateTierFromCC(profileData.totalCCEarned)) || undefined}
                      className="w-full"
                    />
                    <div className="mt-3 flex justify-between text-xs text-gray-600">
                      <span>Current: {calculateTierFromCC(profileData.totalCCEarned).charAt(0).toUpperCase() + calculateTierFromCC(profileData.totalCCEarned).slice(1)}</span>
                      <span>{profileData.totalBookings || 0} Total Bookings</span>
                    </div>
                  </div>
                )}

                {/* Box Progress & Rewards */}
                {profileData && (
                  <div className="bg-white rounded-lg border p-4 border-l-4 border-amber-500">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-600" />
                        <h2 className="text-sm font-semibold text-gray-900">Box Openings</h2>
                      </div>
                      {availableBoxes.length > 0 && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                          {availableBoxes.length} Available
                        </span>
                      )}
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Progress to Next Box</span>
                        <span className="font-medium">{profileData.boxProgress || 0}/3 Bookings</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${((profileData.boxProgress || 0) / 3) * 100}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Available Boxes to Open */}
                    {availableBoxes.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {availableBoxes.slice(0, 2).map((box) => (
                          <div key={box.id} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Gift className="w-4 h-4 text-amber-600" />
                              <span className="text-sm text-gray-700">Mystery Box</span>
                            </div>
                            <button
                              onClick={() => handleBoxClick(box)}
                              disabled={opening}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3" />
                              Open
                            </button>
                          </div>
                        ))}
                        {availableBoxes.length > 2 && (
                          <p className="text-xs text-gray-500 text-center">+{availableBoxes.length - 2} more boxes available</p>
                        )}
                      </div>
                    )}
                    
                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-lg font-bold text-gray-900">{profileData.boxProgress || 0}/3</div>
                        <div className="text-[10px] text-gray-500">Progress</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-amber-600">{availableBoxes.length}</div>
                        <div className="text-[10px] text-gray-500">Ready to Open</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900">{activeRewards.length}</div>
                        <div className="text-[10px] text-gray-500">Active Rewards</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Achievements Section */}
                <ProfileAchievements userId={user?.id || ''} />

                {/* Compact Activity Summary */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">Activity Summary</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <div>
                        <p className="text-[10px] text-gray-500">Member Since</p>
                        <p className="text-xs font-medium text-gray-900">{profileData?.memberSince}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-gray-400" />
                      <div>
                        <p className="text-[10px] text-gray-500">Current Rank</p>
                        <p className="text-xs font-medium text-gray-900">{profileData?.rank || 'House'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-gray-400" />
                      <div>
                        <p className="text-[10px] text-gray-500">Handicap</p>
                        <p className="text-xs font-medium text-gray-900">
                          {profileData?.handicap !== undefined ? profileData.handicap : 'Not set'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="max-w-2xl">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Profile & Account</h2>
                    {!editMode && (
                      <button
                        onClick={() => setEditMode(true)}
                        className="px-3 py-1.5 text-sm bg-[#0B3D3A] text-white rounded-lg hover:bg-[#084a45] transition-colors flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Edit Profile
                      </button>
                    )}
                  </div>
                  
                  {editMode ? (
                    <form onSubmit={handleSaveProfile} className="space-y-4">
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
                          disabled
                        />
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <select
                          value={formData.location}
                          onChange={(e) => setFormData({...formData, location: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                        >
                          <option value="">Select a location</option>
                          <option value="Bedford">Bedford</option>
                          <option value="Dartmouth">Dartmouth</option>
                          <option value="Stratford">Stratford</option>
                          <option value="Bayers Lake">Bayers Lake</option>
                          <option value="Truro">Truro</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Home Golf Course</label>
                        <input
                          type="text"
                          value={formData.homeGolfCourse}
                          onChange={(e) => setFormData({...formData, homeGolfCourse: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                          placeholder="e.g., Glen Arbour Golf Course"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                        <textarea
                          value={formData.bio}
                          onChange={(e) => setFormData({...formData, bio: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                          placeholder="Tell us about yourself..."
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Handicap</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="54"
                          value={formData.handicap}
                          onChange={(e) => setFormData({...formData, handicap: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                          placeholder="e.g., 18.5"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-2 bg-[#0B3D3A] text-white rounded-lg font-medium hover:bg-[#084a45] transition-colors disabled:opacity-50"
                        >
                          Save Changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditMode(false)}
                          className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Name</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{profileData?.name}</span>
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Email</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{profileData?.email}</span>
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Phone</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {profileData?.phone || 'Not set'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Location</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {profileData?.location || 'Not set'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <Target className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Home Golf Course</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {profileData?.homeGolfCourse || 'Not set'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Security Section */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Security</h2>
                  <div className="space-y-3">
                    <button 
                      onClick={() => setShowPasswordModal(true)}
                      className="w-full text-left px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-medium text-gray-900">Change Password</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">Login History</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">Preferences</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                        <p className="text-xs text-gray-500">Receive updates about challenges and bookings</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={preferences.emailNotifications}
                          onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B3D3A]"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">SMS Notifications</p>
                        <p className="text-xs text-gray-500">Get text alerts for upcoming bookings</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={preferences.smsNotifications}
                          onChange={(e) => handlePreferenceChange('smsNotifications', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B3D3A]"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Public Profile</p>
                        <p className="text-xs text-gray-500">Allow others to see your stats</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={preferences.publicProfile}
                          onChange={(e) => handlePreferenceChange('publicProfile', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B3D3A]"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-white rounded-lg border border-red-200 p-4">
                  <h2 className="text-sm font-semibold text-red-600 mb-3">Danger Zone</h2>
                  <button className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-xs font-medium">
                    Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
        
        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                      className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                    >
                      {showPasswords.current ? 
                        <EyeOff className="w-4 h-4 text-gray-400" /> : 
                        <Eye className="w-4 h-4 text-gray-400" />
                      }
                    </button>
                  </div>
                </div>
                
                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                    >
                      {showPasswords.new ? 
                        <EyeOff className="w-4 h-4 text-gray-400" /> : 
                        <Eye className="w-4 h-4 text-gray-400" />
                      }
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Must be at least 6 characters
                  </p>
                </div>
                
                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                    >
                      {showPasswords.confirm ? 
                        <EyeOff className="w-4 h-4 text-gray-400" /> : 
                        <Eye className="w-4 h-4 text-gray-400" />
                      }
                    </button>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-[#0B3D3A] text-white rounded-lg font-medium hover:bg-[#084a45] transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Changing...' : 'Change Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Box Opening Slot Machine */}
        <BoxOpeningSlotMachine
          isOpen={showSlotMachine}
          onClose={() => {
            setShowSlotMachine(false);
            setSelectedBox(null);
          }}
          onOpen={openBox}
          boxId={selectedBox?.id}
        />
      </div>
    </>
  );
}