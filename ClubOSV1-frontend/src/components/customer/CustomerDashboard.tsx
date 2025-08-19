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
  Coins,
  Target,
  Clock
} from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    ccBalance: 0,
    activeChallenges: 0,
    weekStreak: 0,
    nextBooking: null as any
  });

  // Available locations - simplified
  const locations: Location[] = [
    { id: 'bedford', name: 'Bedford', city: 'Bedford' },
    { id: 'dartmouth', name: 'Dartmouth', city: 'Dartmouth' }
  ];

  // Skedda booking URLs
  const skeddaUrls: Record<string, string> = {
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
          const response = await axios.get(`${API_URL}/customer-profile`, {
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
          const bookingsResponse = await axios.get(`${API_URL}/customer-bookings`, {
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

        // Fetch CC balance and challenges
        try {
          const ccResponse = await axios.get(`${API_URL}/api/challenges/cc-balance`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (ccResponse.data.success) {
            setQuickStats(prev => ({ ...prev, ccBalance: ccResponse.data.data.balance }));
          }
        } catch (error) {
          console.error('Failed to fetch CC balance:', error);
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

  const quickActions = [
    { 
      icon: Calendar, 
      label: 'Book a Bay', 
      description: 'Reserve your spot',
      onClick: () => {
        if (selectedLocation) {
          window.open(skeddaUrls[selectedLocation.id], '_blank');
        } else {
          router.push('/customer/bookings');
        }
      }
    },
    { 
      icon: Trophy, 
      label: 'Compete', 
      description: 'Challenge players',
      onClick: () => router.push('/customer/compete') 
    },
    { 
      icon: BarChart3, 
      label: 'Leaderboard', 
      description: 'Live rankings',
      onClick: () => router.push('/customer/leaderboard') 
    },
    { 
      icon: Users, 
      label: 'Profile', 
      description: 'View your stats',
      onClick: () => router.push('/customer/profile') 
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

  const firstName = customerProfile?.displayName?.split(' ')[0] || 
                    customerProfile?.name?.split(' ')[0] || 
                    user?.name?.split(' ')[0] || 
                    'Golfer';

  return (
    <div className="space-y-4">
      {/* Welcome Section with Location Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">
              Welcome back, {firstName}
            </h1>
            <p className="text-sm text-gray-600 mt-0.5">
              {welcomeMessage}
            </p>
          </div>
          
          {/* Compact Location Selector */}
          <div className="relative ml-4">
            <button
              onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              <MapPin className="w-4 h-4 text-[#0B3D3A]" />
              <span className="font-medium text-gray-900">{selectedLocation?.name || 'Select'}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showLocationDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
                {locations.map((location) => (
                  <button
                    key={location.id}
                    onClick={() => handleLocationChange(location)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                      selectedLocation?.id === location.id ? 'bg-[#0B3D3A]/10 text-[#0B3D3A]' : 'text-gray-700'
                    }`}
                  >
                    <div className="font-medium text-sm">{location.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">ClubCoins</p>
              <p className="text-lg font-bold text-gray-900 flex items-center gap-1">
                <Coins className="w-4 h-4 text-[#0B3D3A]" />
                {quickStats.ccBalance}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Active Challenges</p>
              <p className="text-lg font-bold text-gray-900 flex items-center gap-1">
                <Target className="w-4 h-4 text-[#0B3D3A]" />
                {quickStats.activeChallenges}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Next Booking</p>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                <Clock className="w-4 h-4 text-[#0B3D3A]" />
                {quickStats.nextBooking ? quickStats.nextBooking.time : 'None'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-100 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Week Streak</p>
              <p className="text-lg font-bold text-gray-900 flex items-center gap-1">
                <Zap className="w-4 h-4 text-[#0B3D3A]" />
                {quickStats.weekStreak}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="group relative bg-white rounded-lg border border-gray-100 p-4 hover:shadow-md hover:border-[#0B3D3A]/30 transition-all duration-200"
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="p-3 rounded-full bg-[#0B3D3A]/10 group-hover:bg-[#0B3D3A]/20 transition-colors">
                <action.icon className="w-5 h-5 text-[#0B3D3A]" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">{action.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
              </div>
            </div>
          </button>
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