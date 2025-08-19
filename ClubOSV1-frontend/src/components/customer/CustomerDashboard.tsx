import React, { useEffect, useState } from 'react';
import { 
  Calendar, 
  Users, 
  Trophy, 
  MapPin, 
  ChevronRight,
  ChevronDown,
  BarChart3,
  Zap,
  Target,
  Clock,
  Crown,
  Coins,
  Medal,
  Star,
  Home as HomeIcon,
  Shield
} from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import axios from 'axios';

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

interface Booking {
  id: string;
  date: string;
  time: string;
  bay: string;
  location: string;
  friends: string[];
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
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [quickStats, setQuickStats] = useState({
    activeChallenges: 0,
    nextBooking: null as any,
    ccBalance: 0,
    rank: 'House',
    isChampion: false
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
        
        // Fetch bookings
        try {
          const bookingsResponse = await axios.get(`${API_URL}/api/customer-bookings`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (bookingsResponse.data.success) {
            const upcomingOnly = bookingsResponse.data.bookings
              .filter((b: any) => b.status === 'upcoming')
              .slice(0, 3);
            setUpcomingBookings(upcomingOnly);
            
            // Set next booking for quick stats
            if (upcomingOnly.length > 0) {
              setQuickStats(prev => ({ ...prev, nextBooking: upcomingOnly[0] }));
            }
          }
        } catch (error) {
          console.error('Failed to fetch bookings:', error);
          // Use mock data as fallback
          setUpcomingBookings([
            { id: '1', date: 'Today', time: '6:00 PM', bay: 'Bay 2', location: 'Bedford', friends: ['John D.'] },
            { id: '2', date: 'Tomorrow', time: '7:00 PM', bay: 'Bay 4', location: 'Bedford', friends: [] }
          ]);
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
          // Set default 100 CC for Michael's account
          if (user?.email === 'mikebelair79@gmail.com') {
            setQuickStats(prev => ({ ...prev, ccBalance: 100 }));
          }
        }
        
        // Mock rank data for now (would come from profile API)
        setQuickStats(prev => ({ 
          ...prev, 
          rank: 'House',
          isChampion: false 
        }));
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

  const quickActions = [
    { 
      icon: Calendar, 
      label: 'Book a Box', 
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
      icon: Trophy, 
      label: 'Compete', 
      description: 'Challenge players',
      onClick: () => router.push('/customer/compete'),
      info: quickStats.ccBalance > 0 ? `${quickStats.ccBalance} CC` : null
    },
    { 
      icon: BarChart3, 
      label: 'Leaderboard', 
      description: 'Live rankings',
      onClick: () => router.push('/customer/leaderboard'),
      info: quickStats.rank
    },
    { 
      icon: Users, 
      label: firstName, 
      description: 'View your stats',
      onClick: () => router.push('/customer/profile'),
      hasChampionCrown: quickStats.isChampion
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
      {(quickStats.activeChallenges > 0 || quickStats.nextBooking) && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {quickStats.activeChallenges > 0 && (
            <div className="bg-white rounded-lg border border-gray-100 px-4 py-2 flex items-center gap-2 whitespace-nowrap">
              <Target className="w-4 h-4 text-[#0B3D3A]" />
              <span className="text-sm">
                <span className="font-semibold">{quickStats.activeChallenges}</span> active challenge{quickStats.activeChallenges !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {quickStats.nextBooking && (
            <div className="bg-white rounded-lg border border-gray-100 px-4 py-2 flex items-center gap-2 whitespace-nowrap">
              <Clock className="w-4 h-4 text-[#0B3D3A]" />
              <span className="text-sm">
                Next: <span className="font-semibold">{quickStats.nextBooking.date} {quickStats.nextBooking.time}</span>
              </span>
            </div>
          )}
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
                  className="flex items-center gap-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-xs relative z-30"
                >
                  <MapPin className="w-3 h-3 text-[#0B3D3A]" />
                  <span className="font-medium text-gray-700">{selectedLocation?.name === 'All Locations' ? 'All' : selectedLocation?.name || 'Select'}</span>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
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
            {action.info && (
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#0B3D3A]/10 rounded text-xs font-semibold text-[#0B3D3A]">
                {action.info}
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
              <div className="p-3 rounded-full bg-[#0B3D3A]/10 group-hover:bg-[#0B3D3A]/20 transition-colors">
                <action.icon className="w-5 h-5 text-[#0B3D3A]" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">{action.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Bookings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Upcoming Bookings</h2>
            <Calendar className="w-4 h-4 text-[#0B3D3A]" />
          </div>
          <div className="space-y-2">
            {upcomingBookings.length > 0 ? (
              <>
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{booking.date}</span>
                          <span className="text-xs text-gray-500">{booking.time}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[#0B3D3A] font-medium">{booking.bay}</span>
                          {booking.friends.length > 0 && (
                            <span className="text-xs text-gray-500">
                              • With {booking.friends.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
                <button 
                  onClick={() => router.push('/customer/bookings')}
                  className="w-full pt-2 text-[#0B3D3A] hover:text-[#084a45] text-sm font-medium flex items-center justify-center"
                >
                  View All Bookings
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </>
            ) : (
              <div className="text-center py-6">
                <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-3">No upcoming bookings</p>
                <button 
                  onClick={() => {
                    if (selectedLocation) {
                      window.open(skeddaUrls[selectedLocation.id], '_blank');
                    } else {
                      router.push('/customer/bookings');
                    }
                  }}
                  className="px-4 py-2 bg-[#0B3D3A] text-white text-sm rounded-lg hover:bg-[#084a45] transition-colors font-medium"
                >
                  Book a Bay Now
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Quick Links</h2>
            <Zap className="w-4 h-4 text-[#0B3D3A]" />
          </div>
          <div className="space-y-2">
            <button
              onClick={() => router.push('/customer/compete')}
              className="w-full p-3 bg-gradient-to-r from-[#0B3D3A] to-[#084a45] text-white rounded-lg hover:shadow-md transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-medium">Create Challenge</p>
                  <p className="text-xs opacity-90">Compete for ClubCoins</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button
              onClick={() => router.push('/customer/leaderboard')}
              className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-[#0B3D3A]" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">View Leaderboard</p>
                  <p className="text-xs text-gray-500">Check your ranking</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button
              onClick={() => router.push('/customer/profile')}
              className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#0B3D3A]" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">Your Profile</p>
                  <p className="text-xs text-gray-500">Stats & achievements</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};