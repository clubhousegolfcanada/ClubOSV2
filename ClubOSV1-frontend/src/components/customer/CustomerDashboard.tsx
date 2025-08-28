import React, { useEffect, useState } from 'react';
import { 
  Calendar, 
  Users, 
  Trophy, 
  MapPin, 
  ChevronRight,
  ChevronDown,
  BarChart3,
  Target,
  Clock,
  Crown,
  Coins,
  Medal,
  Star,
  Home as HomeIcon,
  Shield,
  Gem,
  Award,
  Sparkles,
  Swords
} from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import axios from 'axios';
import { calculateTierFromCC, tierConfigs } from '@/components/TierBadge';
import { QuickBookCard } from '@/components/customer/QuickBookCard';
import { RecentChallenges } from '@/components/customer/RecentChallenges';

// Fix for double /api/ issue - ensure base URL doesn't end with /api
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// Remove /api from the end if it exists
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}
// Now we can safely add /api to our calls

interface Location {
  id: string;
  name: string;
  city: string;
}

interface CustomerProfile {
  displayName?: string;
  name?: string;
  ccBalance?: number;
  rank?: string;
  wins?: number;
  losses?: number;
  isChampion?: boolean;
  memberSince?: string;
}

const humorousMessages = [
  "Good news, the simulator is still cheaper than golf lessons. Book it.",
  "Look who crawled back—must've run out of excuses for why you're bad.",
  "Ah yes, the return of the bunker enthusiast. Book a bay, sandtrap king.",
  "Welcome back, legend… of the lost fairway.",
  "Behold, the crown prince of three-putts has returned.",
  "Welcome back, sire. The fairways tremble, the rough rejoices.",
  "All hail the monarch of mulligans. Book your throne (bay).",
  "Ah, the Emperor of Out-of-Bounds has logged back in.",
  "Just remind us to calibrate the system after you shank 5 into the TrackMan.",
  "Let us know if you manage to dig that hole 5 inches behind the ball this booking.",
  "Welcome back, noble ruler of the sandtrap kingdom.",
  "Hail the Baron of Bogeys, long may he chunk.",
  "The court jester of chip shots has entered the lobby.",
  "Ah yes, the Prince of Pushes and Pulls—make yourself at home.",
  "Long live the Overlord of Over-par. Book your dominion."
];

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuthState();
  const router = useRouter();
  const token = user?.token;
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [quickStats, setQuickStats] = useState({
    activeChallenges: 0,
    ccBalance: 0,
    rank: 'House',
    isChampion: false,
    pendingFriendRequests: 0
  });

  // Available locations - simplified
  const locations: Location[] = [
    { id: 'all', name: 'All Locations', city: 'All' },
    { id: 'bedford', name: 'Bedford', city: 'Bedford' },
    { id: 'dartmouth', name: 'Dartmouth', city: 'Dartmouth' }
  ];

  // Skedda booking URLs
  const skeddaUrls: Record<string, string> = {
    all: 'https://clubhouse247golf.skedda.com/booking',
    bedford: 'https://clubhouse247golf.skedda.com/booking?spacefeatureids=c58c2cecfcce4559a3b61827b1cc8b47',
    dartmouth: 'https://clubhouse247golf.skedda.com/booking?spacefeatureids=9c2102d2571146709f186a1cc14b4ecf'
  };

  useEffect(() => {
    if (token) {
      fetchCustomerData();
    }
    // Select a random humorous message
    const randomIndex = Math.floor(Math.random() * humorousMessages.length);
    setWelcomeMessage(humorousMessages[randomIndex]);
  }, [token]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      if (token) {
        // Fetch customer profile
        try {
          const response = await axios.get(`${API_URL}/api/customer-profile`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data.success) {
            setCustomerProfile(response.data.data);
          }
        } catch (error) {
          console.error('Failed to fetch customer profile:', error);
        }

        // Fetch active challenges count and CC balance
        try {
          const challengesResponse = await axios.get(`${API_URL}/api/challenges/my-challenges`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (challengesResponse.data.success) {
            const activeChallenges = challengesResponse.data.data.filter((c: any) => 
              c.status === 'active' || c.status === 'accepted'
            ).length;
            setQuickStats(prev => ({ ...prev, activeChallenges }));
          }
        } catch (error) {
          console.error('Failed to fetch challenges:', error);
        }
        
        // Fetch CC balance
        try {
          const ccResponse = await axios.get(`${API_URL}/api/challenges/cc-balance`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (ccResponse.data.success) {
            const balance = ccResponse.data.data.balance || 0;
            setQuickStats(prev => ({ ...prev, ccBalance: balance }));
          }
        } catch (error) {
          console.error('Failed to fetch CC balance:', error);
          // Set default CC for testing
          const testBalance = user?.email === 'mikebelair79@gmail.com' ? 10000 : 100;
          setQuickStats(prev => ({ ...prev, ccBalance: testBalance }));
        }
        
        // Mock rank data for now (would come from profile API)
        setQuickStats(prev => ({ 
          ...prev, 
          rank: 'House',
          isChampion: false 
        }));
        
        // Fetch pending friend requests
        try {
          const friendRequestsResponse = await axios.get(`${API_URL}/api/friends/pending?direction=incoming`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (friendRequestsResponse.data.success) {
            const pendingRequests = friendRequestsResponse.data.data?.requests?.length || 0;
            setQuickStats(prev => ({ ...prev, pendingFriendRequests: pendingRequests }));
          }
        } catch (error) {
          console.error('Failed to fetch friend requests:', error);
        }
      }
      
      // Set default location
      const savedLocation = localStorage.getItem('preferredClubhouse');
      const defaultLocation = locations.find(loc => loc.id === savedLocation) || locations[0];
      setSelectedLocation(defaultLocation);
      
    } catch (error) {
      console.error('Failed to fetch customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const firstName = customerProfile?.displayName?.split(' ')[0] || 
                    customerProfile?.name?.split(' ')[0] || 
                    user?.name?.split(' ')[0] || 
                    'Golfer';

  // Get tier icon based on CC balance
  const getTierIcon = () => {
    const tier = calculateTierFromCC(quickStats.ccBalance);
    const config = tierConfigs[tier];
    return config.icon;
  };

  const quickActions = [
    { 
      icon: Calendar, 
      label: selectedLocation?.name === 'All Locations' ? 'Book Anywhere' : 
             selectedLocation ? `Book ${selectedLocation.name}` : 'Book a Bay', 
      description: 'Reserve your spot',
      onClick: () => {
        if (selectedLocation) {
          window.open(skeddaUrls[selectedLocation.id], '_blank');
        } else {
          router.push('/customer/bookings');
        }
      },
      hasLocationSelector: true
    },
    { 
      icon: Swords, 
      label: 'Friends', 
      description: 'Challenge players',
      onClick: () => router.push('/customer/compete?tab=competitors'),
      info: quickStats.ccBalance > 0 ? `${quickStats.ccBalance} CC` : null,
      badge: quickStats.pendingFriendRequests > 0 ? quickStats.pendingFriendRequests : null
    },
    { 
      icon: BarChart3, 
      label: 'Leaderboard', 
      description: 'Live rankings',
      onClick: () => router.push('/customer/leaderboard'),
      info: quickStats.rank
    },
    { 
      icon: () => getTierIcon(), 
      label: firstName, 
      description: 'View your stats',
      onClick: () => router.push('/customer/profile'),
      hasChampionCrown: quickStats.isChampion,
      isTierIcon: true
    }
  ];

  const handleLocationChange = (location: Location) => {
    setSelectedLocation(location);
    localStorage.setItem('preferredClubhouse', location.id);
    setShowLocationDropdown(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A] mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className={`text-lg font-semibold ${
                quickStats.rank === 'Champion' ? 'text-yellow-600' :
                quickStats.rank === 'Fescue' ? 'text-purple-600' :
                quickStats.rank === 'Bent' ? 'text-blue-600' :
                quickStats.rank === 'Bermuda' ? 'text-green-600' :
                'text-gray-900'
              }`}>
                Welcome back, {firstName}
              </h1>
              {quickStats.isChampion && (
                <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              )}
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              {welcomeMessage}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Info Bar - Simplified */}
      {quickStats.activeChallenges > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          <div className="bg-white rounded-lg border border-gray-100 px-4 py-2 flex items-center gap-2 whitespace-nowrap">
            <Target className="w-4 h-4 text-[#0B3D3A]" />
            <span className="text-sm">
              <span className="font-semibold">{quickStats.activeChallenges}</span> active challenge{quickStats.activeChallenges !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((action, index) => (
          <div
            key={index}
            className="group relative bg-white rounded-lg border border-gray-100 p-4 hover:shadow-md hover:border-[#0B3D3A]/30 transition-all duration-200"
          >
            {/* Location selector for Book a Box card */}
            {action.hasLocationSelector && (
              <div className="absolute top-2 right-2 z-30">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLocationDropdown(!showLocationDropdown);
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-[#0B3D3A]/10 hover:bg-[#0B3D3A]/20 rounded text-xs font-semibold text-[#0B3D3A] relative z-30 transition-colors"
                  title={selectedLocation?.name || 'Select location'}
                >
                  <MapPin className="w-3 h-3" />
                  <ChevronDown className="w-3 h-3" />
                </button>
                
                {showLocationDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-40 min-w-[120px]">
                    {locations.map((location) => (
                      <button
                        key={location.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLocationChange(location);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                          selectedLocation?.id === location.id ? 'bg-[#0B3D3A]/10 text-[#0B3D3A]' : 'text-gray-700'
                        }`}
                      >
                        <div className="font-medium text-xs">{location.name === 'All Locations' ? 'All' : location.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Info badge (rank or CC) */}
            {action.info && !action.badge && (
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#0B3D3A]/10 rounded text-xs font-semibold text-[#0B3D3A]">
                {action.info}
              </div>
            )}
            
            {/* Notification badge for pending friend requests */}
            {action.badge && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-lg animate-pulse">
                {action.badge}
              </div>
            )}
            
            {/* Champion crown */}
            {action.hasChampionCrown && (
              <div className="absolute top-2 right-2">
                <Crown className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              </div>
            )}
            
            <button
              onClick={action.hasLocationSelector ? () => {
                if (selectedLocation) {
                  window.open(skeddaUrls[selectedLocation.id], '_blank');
                }
              } : action.onClick}
              className="w-full h-full flex flex-col items-center text-center space-y-2"
            >
              <div className={`p-3 rounded-full transition-colors ${
                action.isTierIcon 
                  ? `${tierConfigs[calculateTierFromCC(quickStats.ccBalance)].bgColor} group-hover:opacity-80`
                  : 'bg-[#0B3D3A]/10 group-hover:bg-[#0B3D3A]/20'
              }`}>
                {action.isTierIcon ? (
                  React.cloneElement(getTierIcon() as React.ReactElement, {
                    className: `w-5 h-5 ${tierConfigs[calculateTierFromCC(quickStats.ccBalance)].iconColor}`
                  })
                ) : (
                  <action.icon className="w-5 h-5 text-[#0B3D3A]" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">{action.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Recent Challenges */}
      <RecentChallenges userId={user?.id} userToken={token} />
      
      {/* Quick Book Card */}
      <QuickBookCard className="mt-4" />
    </div>
  );
};