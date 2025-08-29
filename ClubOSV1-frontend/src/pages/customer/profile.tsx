import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import { TabNavigation } from '@/components/customer/TabNavigation';
import { ProfileAchievements } from '@/components/customer/ProfileAchievements';
import { TierBadge, TierProgressBar, calculateTierFromCC, getNextTier, tierConfigs } from '@/components/TierBadge';
import { BoxOpeningSimple } from '@/components/customer/BoxOpeningSimple';
import Head from 'next/head';
import { 
  Trophy, User, Mail, Phone, Save, ChevronRight, ChevronDown,
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
  const router = useRouter();
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
  const [achievementsExpanded, setAchievementsExpanded] = useState(false);
  const [achievementCount, setAchievementCount] = useState(0);
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

  // Handle tab parameter from URL
  useEffect(() => {
    const tab = router.query.tab as string;
    if (tab === 'account') {
      setActiveTab('account');
    } else if (tab === 'preferences') {
      setActiveTab('preferences');
    } else if (tab === 'stats') {
      setActiveTab('stats');
    }
  }, [router.query.tab]);

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
      
      // If no token, don't make requests
      if (!token) {
        setLoading(false);
        return;
      }
      
      // Fetch all profile stats, box stats, achievements, and box data in parallel
      const [statsResponse, boxStatsResponse, boxesResponse, rewardsResponse, achievementsResponse] = await Promise.all([
        axios.get(`${API_URL}/api/profile/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/api/boxes/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch((err) => {
          if (err.response?.status === 401) throw err; // Re-throw auth errors
          return { data: { progress: { current: 0 }, availableCount: 0, rewardsCount: 0 } };
        }),
        axios.get(`${API_URL}/api/boxes/available`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch((err) => {
          if (err.response?.status === 401) throw err; // Re-throw auth errors
          return { data: [] };
        }),
        axios.get(`${API_URL}/api/boxes/rewards`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch((err) => {
          if (err.response?.status === 401) throw err; // Re-throw auth errors
          return { data: [] };
        }),
        axios.get(`${API_URL}/api/achievements/user/${user?.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch((err) => {
          if (err.response?.status === 401) throw err; // Re-throw auth errors
          return { data: [] };
        })
      ]);
      
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
        console.log('Available boxes from API:', boxesResponse.data);
        setAvailableBoxes(boxesResponse.data || []);
        setActiveRewards(rewardsResponse.data || []);
        setAchievementCount(achievementsResponse.data?.length || 0);
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
    } catch (error: any) {
      console.error('Failed to fetch profile stats:', error);
      
      // Handle authentication errors
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        localStorage.removeItem('clubos_token');
        localStorage.removeItem('clubos_user');
        setTimeout(() => {
          router.push('/login');
        }, 1000);
      } else if (error.response?.status === 429) {
        toast.error('Too many requests. Please wait a moment and try again.');
      } else if (error.message) {
        toast.error('Failed to load profile data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) {
        toast.error('Please log in again');
        return;
      }
      
      const response = await axios.put(
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
    } catch (error: any) {
      console.error('Profile update error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to update profile';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBoxClick = (box: Box) => {
    // Double-check the box is actually available
    const isAvailable = availableBoxes.some(b => b.id === box.id);
    if (!isAvailable) {
      toast.error('This box is no longer available');
      fetchProfileData(); // Refresh the data
      return;
    }
    setSelectedBox(box);
    setShowSlotMachine(true);
  };
  
  const openBox = async (): Promise<BoxReward> => {
    if (!selectedBox) throw new Error('No box selected');
    
    console.log('Opening box:', selectedBox);
    
    const token = localStorage.getItem('clubos_token');
    
    const response = await axios.post(
      `${API_URL}/api/boxes/${selectedBox.id}/open`,
      {},
      { headers: { Authorization: `Bearer ${token}` }}
    );
    
    // Immediately remove the opened box from state
    setAvailableBoxes(prev => prev.filter(box => box.id !== selectedBox.id));
    
    // Refresh all data after successful opening
    await fetchProfileData();
    
    return response.data.data || response.data.reward || response.data;
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
      if (!token) {
        toast.error('Please log in again');
        return;
      }
      
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
      console.error('Password change error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to change password. Please check your current password.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePreferenceChange = async (key: string, value: boolean) => {
    try {
      const token = localStorage.getItem('clubos_token');
      if (!token) {
        toast.error('Please log in again');
        return;
      }
      
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
    } catch (error: any) {
      console.error('Preference update error:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to update preferences';
      toast.error(errorMessage);
      // Revert on error
      setPreferences(preferences);
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

      <div className="min-h-screen bg-[var(--bg-primary)] customer-app">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8">
          {/* Header - Consistent minimalist style */}
          <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] px-4 py-3">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-[var(--text-primary)]">
                    Profile
                  </h1>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                    {user.name}{profileData?.handicap !== undefined && profileData.handicap !== null ? ` • ${profileData.handicap} Handicap` : ''}
                  </p>
                </div>
                {profileData && (
                  <div className="flex items-center gap-2">
                    <TierBadge 
                      tier={calculateTierFromCC(profileData.totalCCEarned)} 
                      size="sm"
                    />
                    <div className="flex items-center gap-2 px-3 py-1 bg-[#0B3D3A]/10 rounded-full">
                      <Coins className="w-4 h-4 text-[#0B3D3A]" />
                      <span className="text-sm font-bold text-[#0B3D3A]">{profileData.ccBalance.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs - Using unified TabNavigation */}
          <TabNavigation
            tabs={[
              { key: 'stats', label: 'Statistics' },
              { key: 'account', label: 'Account' },
              { key: 'preferences', label: 'Preferences' }
            ]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as 'stats' | 'account' | 'preferences')}
            sticky={true}
          />

          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
            {/* Statistics Tab */}
            {activeTab === 'stats' && (
              <div className="space-y-4">
                {/* Enhanced Performance with Clear Groups */}
                {profileData && (
                  <div className={`bg-[var(--bg-secondary)] rounded-lg border p-4 border-l-4 ${
                    tierConfigs[calculateTierFromCC(profileData.totalCCEarned)].outlineColor
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Performance</h2>
                    </div>
                    
                    {/* Core Stats Group */}
                    <div className="grid grid-cols-4 gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Coins className="w-3.5 h-3.5 text-[#0B3D3A]" />
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">{profileData.ccBalance.toLocaleString()}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">ClubCoins</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <TrendingUp className="w-3.5 h-3.5 text-[#0B3D3A]" />
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">{Math.round((profileData.winRate || 0) * 100)}%</div>
                        <div className="text-[10px] text-[var(--text-muted)]">Win Rate</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Trophy className="w-3.5 h-3.5 text-[#0B3D3A]" />
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">{profileData.totalWins}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">Wins</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Target className="w-3.5 h-3.5 text-[#0B3D3A]" />
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">{profileData.currentStreak}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">Streak</div>
                      </div>
                    </div>
                    
                    {/* Tier Status and Progress */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-[var(--text-muted)]">
                          Tier Status • {profileData.totalBookings || 0} Lifetime Bookings
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <TierProgressBar
                        currentCC={profileData.totalCCEarned}
                        tier={calculateTierFromCC(profileData.totalCCEarned)}
                        nextTier={getNextTier(calculateTierFromCC(profileData.totalCCEarned)) || undefined}
                        className="w-full"
                      />
                      
                      {/* Progress text - only show if not at max tier */}
                      {getNextTier(calculateTierFromCC(profileData.totalCCEarned)) && (
                        <div className="text-xs text-[var(--text-muted)] text-center">
                          {profileData.totalCCEarned.toLocaleString()} / {tierConfigs[getNextTier(calculateTierFromCC(profileData.totalCCEarned))!].minCC.toLocaleString()} CC to next tier
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Box Progress & Rewards - Redesigned */}
                {profileData && (
                  <div className="bg-[var(--bg-secondary)] rounded-lg border p-4 border-l-4 border-l-[#0B3D3A]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#0B3D3A]" />
                        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Box Openings</h2>
                      </div>
                      {availableBoxes.length > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#0B3D3A]/10 text-[#0B3D3A]">
                          {availableBoxes.length}
                        </span>
                      )}
                    </div>
                    
                    {/* Progress Bar with consolidated text */}
                    <div className="mb-4">
                      <div className="w-full bg-[var(--border-primary)] rounded-full h-2 overflow-hidden mb-2">
                        <div 
                          className="h-full bg-gradient-to-r from-[#0B3D3A] to-[#0B3D3A]/80 rounded-full transition-all duration-300"
                          style={{ width: `${((profileData.boxProgress || 0) / 3) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] text-center">
                        Bookings: {profileData.boxProgress || 0}/3
                      </div>
                    </div>
                    
                    {/* Available Boxes Grid */}
                    {availableBoxes.length > 0 && (
                      <div className="mb-3">
                        <style jsx>{`
                          @keyframes shimmer {
                            0%, 100% {
                              filter: drop-shadow(0 0 2px rgba(11, 61, 58, 0.4));
                            }
                            50% {
                              filter: drop-shadow(0 0 6px rgba(11, 61, 58, 0.9));
                            }
                          }
                        `}</style>
                        <div className="grid grid-cols-6 gap-2 mb-2">
                          {availableBoxes.slice(0, 12).map((box, index) => (
                            <button
                              key={box.id}
                              onClick={() => handleBoxClick(box)}
                              disabled={opening}
                              className="relative p-1 transition-all transform hover:scale-110 active:scale-95 cursor-pointer group"
                              aria-label="Open mystery box"
                              style={{
                                animation: `shimmer ${2 + index * 0.1}s ease-in-out infinite`
                              }}
                            >
                              <div className="relative">
                                <Package 
                                  className="w-8 h-8 text-[#0B3D3A] group-hover:text-[#084a45] transition-colors" 
                                  strokeWidth={1.5} 
                                  fill="currentColor"
                                  fillOpacity={0.1}
                                />
                                <div className="absolute inset-0 bg-gradient-to-br from-[#0B3D3A]/10 to-transparent rounded opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          ))}
                        </div>
                        {availableBoxes.length > 12 && (
                          <p className="text-xs text-[var(--text-muted)] text-center">+{availableBoxes.length - 12} more available</p>
                        )}
                      </div>
                    )}
                    
                    {/* Simplified Stats - only show if has active rewards */}
                    {activeRewards.length > 0 && (
                      <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-muted)]">Active Rewards</span>
                          <span className="font-medium text-[var(--text-primary)]">{activeRewards.length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tournament Achievements - Collapsible */}
                <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-4">
                  <button
                    onClick={() => setAchievementsExpanded(!achievementsExpanded)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-[#0B3D3A]" />
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Tournament Achievements</h2>
                      {achievementCount > 0 && (
                        <span className="text-xs text-[var(--text-muted)]">({achievementCount})</span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${
                      achievementsExpanded ? 'rotate-180' : ''
                    }`} />
                  </button>
                  
                  {achievementsExpanded && (
                    <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                      <ProfileAchievements userId={user?.id || ''} />
                    </div>
                  )}
                </div>

                {/* Compact Activity Summary */}
                <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-4">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Activity Summary</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)]">Member Since</p>
                        <p className="text-xs font-medium text-[var(--text-primary)]">{profileData?.memberSince}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)]">Current Rank</p>
                        <p className="text-xs font-medium text-[var(--text-primary)]">{calculateTierFromCC(profileData?.totalCCEarned || 0)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)]">Handicap</p>
                        <p className="text-xs font-medium text-[var(--text-primary)]">
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
                <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Profile & Account</h2>
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
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Email</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                          disabled
                        />
                        <p className="text-xs text-[var(--text-muted)] mt-1">Email cannot be changed</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Phone</label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Location</label>
                        <select
                          value={formData.location}
                          onChange={(e) => setFormData({...formData, location: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
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
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Home Golf Course</label>
                        <input
                          type="text"
                          value={formData.homeGolfCourse}
                          onChange={(e) => setFormData({...formData, homeGolfCourse: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                          placeholder="e.g., Glen Arbour Golf Course"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Bio</label>
                        <textarea
                          value={formData.bio}
                          onChange={(e) => setFormData({...formData, bio: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                          placeholder="Tell us about yourself..."
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Handicap</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="54"
                          value={formData.handicap}
                          onChange={(e) => setFormData({...formData, handicap: e.target.value})}
                          className="w-full px-3 py-2 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
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
                          className="px-4 py-2 border border-[var(--border-primary)] rounded-lg font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4 text-[var(--text-muted)]" />
                          <span className="text-sm text-[var(--text-secondary)]">Name</span>
                        </div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{profileData?.name}</span>
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                          <span className="text-sm text-[var(--text-secondary)]">Email</span>
                        </div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">{profileData?.email}</span>
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-[var(--text-muted)]" />
                          <span className="text-sm text-[var(--text-secondary)]">Phone</span>
                        </div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {profileData?.phone || 'Not set'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
                          <span className="text-sm text-[var(--text-secondary)]">Location</span>
                        </div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {profileData?.location || 'Not set'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <Target className="w-4 h-4 text-[var(--text-muted)]" />
                          <span className="text-sm text-[var(--text-secondary)]">Home Golf Course</span>
                        </div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {profileData?.homeGolfCourse || 'Not set'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Security Section */}
                <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-6 mt-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Security</h2>
                  <div className="space-y-3">
                    <button 
                      onClick={() => setShowPasswordModal(true)}
                      className="w-full text-left px-3 py-2.5 border border-[var(--border-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span className="text-xs font-medium text-[var(--text-primary)]">Change Password</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button className="w-full text-left px-4 py-3 border border-[var(--border-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">Login History</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="space-y-4">
                <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-4">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Preferences</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">Email Notifications</p>
                        <p className="text-xs text-[var(--text-muted)]">Receive updates about challenges and bookings</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={preferences.emailNotifications}
                          onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-[var(--border-primary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--bg-secondary)] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B3D3A]"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">SMS Notifications</p>
                        <p className="text-xs text-[var(--text-muted)]">Get text alerts for upcoming bookings</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={preferences.smsNotifications}
                          onChange={(e) => handlePreferenceChange('smsNotifications', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-[var(--border-primary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--bg-secondary)] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B3D3A]"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">Public Profile</p>
                        <p className="text-xs text-[var(--text-muted)]">Allow others to see your stats</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={preferences.publicProfile}
                          onChange={(e) => handlePreferenceChange('publicProfile', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-[var(--border-primary)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--bg-secondary)] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B3D3A]"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-[var(--bg-secondary)] rounded-lg border border-red-200 p-4">
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
            <div className="bg-[var(--bg-secondary)] rounded-lg max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Change Password</h2>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="p-1 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
              </div>
              
              <form onSubmit={handleChangePassword} className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                      className="w-full px-3 py-2 pr-10 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                    >
                      {showPasswords.current ? 
                        <EyeOff className="w-4 h-4 text-[var(--text-muted)]" /> : 
                        <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                      }
                    </button>
                  </div>
                </div>
                
                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      className="w-full px-3 py-2 pr-10 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                    >
                      {showPasswords.new ? 
                        <EyeOff className="w-4 h-4 text-[var(--text-muted)]" /> : 
                        <Eye className="w-4 h-4 text-[var(--text-muted)]" />
                      }
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Must be at least 6 characters
                  </p>
                </div>
                
                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      className="w-full px-3 py-2 pr-10 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
                    >
                      {showPasswords.confirm ? 
                        <EyeOff className="w-4 h-4 text-[var(--text-muted)]" /> : 
                        <Eye className="w-4 h-4 text-[var(--text-muted)]" />
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
                    className="flex-1 px-4 py-2 border border-[var(--border-primary)] rounded-lg font-medium hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Box Opening Animation */}
        <BoxOpeningSimple
          isOpen={showSlotMachine}
          onClose={() => {
            setShowSlotMachine(false);
            setSelectedBox(null);
            // Add small delay before refresh to ensure backend has updated
            setTimeout(() => {
              fetchProfileData();
            }, 500);
          }}
          onOpen={openBox}
          boxId={selectedBox?.id}
        />
      </div>
    </>
  );
}