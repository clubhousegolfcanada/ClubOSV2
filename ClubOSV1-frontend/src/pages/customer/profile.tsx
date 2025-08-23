import React, { useState, useEffect } from 'react';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import { 
  Trophy, User, Mail, Phone, Save, ChevronRight,
  Settings, BarChart3, Coins, TrendingUp, Calendar,
  Target, Clock, Award, MapPin, Shield, X, Eye, EyeOff
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
  totalChallenges: number;
  totalWins: number;
  winRate: number;
  currentStreak: number;
  longestStreak: number;
  rank?: string;
  totalBookings?: number;
}

export default function CustomerProfile() {
  const { user } = useAuthState();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'account' | 'preferences'>('stats');
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [editMode, setEditMode] = useState(false);
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
      
      // Fetch all profile stats in one API call
      const statsResponse = await axios.get(`${API_URL}/api/profile/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (statsResponse.data.success) {
        const stats = statsResponse.data.data;
        
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
          totalChallenges: stats.challenges.totalPlayed,
          totalWins: stats.challenges.totalWon,
          winRate: stats.challenges.winRate,
          currentStreak: stats.challenges.currentStreak,
          longestStreak: stats.challenges.longestWinStreak,
          rank: stats.ranking.currentRank || 'House',
          totalBookings: stats.social.totalBookings
        };
        
        setProfileData(profileInfo);
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
          {/* Professional Header - ClubOS Style */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-6xl mx-auto px-4 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-[#0B3D3A] rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                    <p className="text-sm text-gray-600">{user.email}</p>
                    {profileData?.location && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span>{profileData.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === 'stats'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Statistics
                </button>
                <button
                  onClick={() => setActiveTab('account')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === 'account'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Profile & Account
                </button>
                <button
                  onClick={() => setActiveTab('preferences')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
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

          <div className="max-w-6xl mx-auto px-4 py-6">
            {/* Statistics Tab */}
            {activeTab === 'stats' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {statCards.map((stat, index) => (
                    <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                      <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Tournament Achievements */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Tournament Achievements</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Tournament Wins */}
                    <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                      <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <div className="text-sm font-medium text-gray-400">Tournament Wins</div>
                      <div className="text-xl font-bold text-gray-300 mt-1">-</div>
                    </div>
                    
                    {/* Champion Title */}
                    <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                      <Award className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <div className="text-sm font-medium text-gray-400">Champion</div>
                      <div className="text-xl font-bold text-gray-300 mt-1">-</div>
                    </div>
                    
                    {/* Closest to Pin */}
                    <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                      <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <div className="text-sm font-medium text-gray-400">Closest to Pin</div>
                      <div className="text-xl font-bold text-gray-300 mt-1">-</div>
                    </div>
                    
                    {/* Tour Pro */}
                    <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                      <Shield className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <div className="text-sm font-medium text-gray-400">Tour Pro</div>
                      <div className="text-xl font-bold text-gray-300 mt-1">-</div>
                    </div>
                  </div>
                </div>

                {/* Activity Summary */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Summary</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Member Since</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{profileData?.memberSince}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Current Rank</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{profileData?.rank || 'House'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Target className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Handicap</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {profileData?.handicap !== undefined ? profileData.handicap : 'Not set'}
                      </span>
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
                      className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">Change Password</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
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
              <div className="max-w-2xl">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Preferences</h2>
                  <div className="space-y-4">
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
                <div className="bg-white rounded-lg border border-red-200 p-6 mt-6">
                  <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
                  <button className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium">
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
      </div>
    </>
  );
}