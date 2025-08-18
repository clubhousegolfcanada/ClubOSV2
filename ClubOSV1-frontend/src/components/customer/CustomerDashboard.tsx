import React, { useEffect, useState } from 'react';
import { 
  Calendar, 
  Users, 
  Trophy, 
  MapPin, 
  Clock, 
  TrendingUp, 
  Activity, 
  ChevronRight,
  BarChart3,
  Target,
  Award,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ClubhouseLocation {
  id: string;
  name: string;
  displayName: string;
  city: string;
  availableBoxes: number;
  nextAvailable: string;
}

interface Booking {
  id: string;
  date: string;
  time: string;
  box: string;
  location: string;
  friends: string[];
}

interface Activity {
  type: 'friend' | 'booking' | 'score' | 'achievement';
  message: string;
  time: string;
}

interface Stats {
  roundsPlayed: number;
  avgScore: number;
  improvement: number;
  avgDrive: number;
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
  const token = typeof window !== 'undefined' ? localStorage.getItem('clubos_token') : null;
  const [myClubhouse, setMyClubhouse] = useState<ClubhouseLocation | null>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats>({
    roundsPlayed: 0,
    avgScore: 0,
    improvement: 0,
    avgDrive: 0
  });
  const [loading, setLoading] = useState(true);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string>("");

  // Available locations
  const locations: ClubhouseLocation[] = [
    {
      id: 'bedford',
      name: 'Bedford',
      displayName: 'Clubhouse 24/7 Golf - Bedford',
      city: 'Bedford',
      availableBoxes: 3,
      nextAvailable: '2:00 PM'
    },
    {
      id: 'dartmouth',
      name: 'Dartmouth',
      displayName: 'Clubhouse 24/7 Golf - Dartmouth', 
      city: 'Dartmouth',
      availableBoxes: 4,
      nextAvailable: '1:30 PM'
    }
  ];

  // Skedda booking URLs
  const skeddaUrls: Record<string, string> = {
    bedford: 'https://clubhouse247golf.skedda.com/booking?spacefeatureids=c58c2cecfcce4559a3b61827b1cc8b47',
    dartmouth: 'https://clubhouse247golf.skedda.com/booking?spacefeatureids=9c2102d2571146709f186a1cc14b4ecf'
  };

  useEffect(() => {
    fetchCustomerData();
    // Select a random humorous message
    const randomIndex = Math.floor(Math.random() * humorousMessages.length);
    setWelcomeMessage(humorousMessages[randomIndex]);
  }, []);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      // Fetch customer profile with HubSpot data
      if (token) {
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
        
        // Fetch real bookings from HubSpot
        try {
          const bookingsResponse = await axios.get(`${API_URL}/api/customer-bookings`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (bookingsResponse.data.success) {
            // Filter only upcoming bookings for the dashboard
            const upcomingOnly = bookingsResponse.data.bookings
              .filter((b: any) => b.status === 'upcoming')
              .slice(0, 3); // Show max 3 bookings
            setUpcomingBookings(upcomingOnly);
          }
        } catch (error) {
          console.error('Failed to fetch bookings:', error);
          // Fallback to mock data if API fails
          setUpcomingBookings([
            {
              id: '1',
              date: 'Today',
              time: '6:00 PM',
              box: 'Box 2',
              location: 'Bedford',
              friends: ['John D.', 'Mike S.']
            },
            {
              id: '2',
              date: 'Tomorrow',
              time: '7:00 PM',
              box: 'Box 4',
              location: 'Bedford',
              friends: []
            }
          ]);
        }
      }
      
      // Set default location to Bedford (or from user preferences in future)
      const savedLocation = localStorage.getItem('preferredClubhouse');
      const defaultLocation = locations.find(loc => loc.id === savedLocation) || locations[0];
      setMyClubhouse(defaultLocation);

      setRecentActivity([
        { type: 'friend', message: 'Sarah K. accepted your friend request', time: '2 hours ago' },
        { type: 'booking', message: 'Mike S. joined your booking for today', time: '5 hours ago' },
        { type: 'achievement', message: 'New personal best: 72 at Pebble Beach', time: '1 day ago' }
      ]);

      setStats({
        roundsPlayed: 12,
        avgScore: 78.5,
        improvement: -2.3,
        avgDrive: 245
      });
    } catch (error) {
      console.error('Failed to fetch customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { 
      icon: Calendar, 
      label: 'Book a Box', 
      description: 'Reserve your spot',
      onClick: () => router.push('/customer/bookings')
    },
    { 
      icon: Users, 
      label: 'Friends', 
      description: 'Connect with players',
      onClick: () => router.push('/customer/friends') 
    },
    { 
      icon: Trophy, 
      label: 'Leaderboard', 
      description: 'Live rankings',
      onClick: () => router.push('/customer/events') 
    },
    { 
      icon: BarChart3, 
      label: 'My Stats', 
      description: 'Track progress',
      onClick: () => router.push('/customer/stats') 
    }
  ];

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'friend':
        return <Users className="w-4 h-4" />;
      case 'booking':
        return <Calendar className="w-4 h-4" />;
      case 'score':
        return <Target className="w-4 h-4" />;
      case 'achievement':
        return <Award className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (value < 0) return <ArrowDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const handleLocationChange = (location: ClubhouseLocation) => {
    setMyClubhouse(location);
    localStorage.setItem('preferredClubhouse', location.id);
    setShowLocationSelector(false);
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
      {/* Welcome Section - Compact */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Welcome back, {customerProfile?.displayName?.split(' ')[0] || user?.name?.split(' ')[0] || 'Guest'}
            </h1>
            <p className="text-sm text-gray-600 mt-0.5">
              {welcomeMessage}
            </p>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center space-x-2 text-sm">
              <Zap className="w-4 h-4 text-[#0B3D3A]" />
              <span className="text-gray-500">Active Member</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid - Compact Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="group relative bg-white rounded-lg border border-gray-100 p-4 hover:shadow-md hover:border-[#0B3D3A]/30 transition-all duration-200"
          >
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 p-2 rounded-md bg-[#0B3D3A]/10 group-hover:bg-[#0B3D3A]/20 transition-colors">
                <action.icon className="w-4 h-4 text-[#0B3D3A]" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-gray-900">{action.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Main Content Grid - Tighter Spacing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* My Clubhouse Card - Compact */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 relative">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">My Clubhouse</h2>
            <button
              onClick={() => setShowLocationSelector(!showLocationSelector)}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
              title="Change location"
            >
              <MapPin className="w-4 h-4 text-[#0B3D3A]" />
            </button>
          </div>
          
          {/* Location Selector Dropdown */}
          {showLocationSelector && (
            <div className="absolute top-14 right-4 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[200px]">
              <div className="p-2">
                <p className="text-xs text-gray-500 px-2 py-1">Select Location</p>
                {locations.map((location) => (
                  <button
                    key={location.id}
                    onClick={() => handleLocationChange(location)}
                    className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 transition-colors ${
                      myClubhouse?.id === location.id ? 'bg-[#0B3D3A]/10 text-[#0B3D3A]' : 'text-gray-700'
                    }`}
                  >
                    <div className="font-medium">{location.name}</div>
                    <div className="text-xs text-gray-500">{location.city}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {myClubhouse ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">{myClubhouse.city}</p>
                <p className="text-base font-semibold text-gray-900">{myClubhouse.name}</p>
              </div>
              <div className="space-y-2 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Available</span>
                  <span className="text-xs font-semibold text-green-600">
                    {myClubhouse.availableBoxes} {myClubhouse.availableBoxes === 1 ? 'box' : 'boxes'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Next slot</span>
                  <span className="text-xs font-medium text-gray-900">{myClubhouse.nextAvailable}</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  const url = skeddaUrls[myClubhouse.id] || 'https://clubhouse247golf.skedda.com/booking';
                  window.open(url, '_blank');
                }}
                className="w-full py-2 bg-[#0B3D3A] text-white text-sm rounded-md hover:bg-[#084a45] transition-colors font-medium"
              >
                Book Now
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-3">Set your home clubhouse</p>
              <button 
                onClick={() => setShowLocationSelector(true)}
                className="text-[#0B3D3A] hover:text-[#084a45] font-medium"
              >
                Choose Location
              </button>
            </div>
          )}
        </div>

        {/* Upcoming Bookings - Compact */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Upcoming Bookings</h2>
            <Calendar className="w-4 h-4 text-[#0B3D3A]" />
          </div>
          <div className="space-y-3">
            {upcomingBookings.length > 0 ? (
              <>
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="p-2.5 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{booking.date}</span>
                        <span className="text-xs text-gray-500 ml-2">{booking.time}</span>
                      </div>
                      <span className="text-xs text-[#0B3D3A] font-medium">{booking.box}</span>
                    </div>
                    {booking.friends.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        <Users className="w-3 h-3 inline mr-1" />
                        {booking.friends.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
                <button 
                  onClick={() => router.push('/customer/bookings')}
                  className="w-full pt-3 text-[#0B3D3A] hover:text-[#084a45] text-sm font-medium flex items-center justify-center"
                >
                  View All Bookings
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-3">No upcoming bookings</p>
                <button 
                  onClick={() => router.push('/customer/bookings')}
                  className="text-[#0B3D3A] hover:text-[#084a45] font-medium"
                >
                  Book a Box
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity - Completely hidden (not implemented) */}
        {/* <div className="hidden sm:block bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
            <Activity className="w-4 h-4 text-[#0B3D3A]" />
          </div>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-2 p-1.5 rounded-md hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="p-1 bg-gray-100 rounded">
                    {getActivityIcon(activity.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-900 line-clamp-1">{activity.message}</p>
                  <p className="text-[10px] text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
            <button 
              onClick={() => router.push('/customer/activity')}
              className="w-full pt-3 text-[#0B3D3A] hover:text-[#084a45] text-sm font-medium flex items-center justify-center"
            >
              View All Activity
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div> */}

      </div>

      {/* Stats Overview - Completely hidden (not implemented) */}
      {/* <div className="hidden sm:block bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">This Month</h2>
          <TrendingUp className="w-4 h-4 text-[#0B3D3A]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.roundsPlayed}</p>
            <p className="text-xs text-gray-600">Rounds</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.avgScore}</p>
            <p className="text-xs text-gray-600">Avg Score</p>
          </div>
          <div>
            <div className="flex items-center space-x-1">
              <p className="text-2xl font-bold text-gray-900">
                {Math.abs(stats.improvement)}
              </p>
              {getTrendIcon(stats.improvement)}
            </div>
            <p className="text-xs text-gray-600">Improvement</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.avgDrive}</p>
            <p className="text-xs text-gray-600">Avg Drive</p>
          </div>
        </div>
        <button 
          onClick={() => router.push('/customer/stats')}
          className="w-full mt-3 py-1.5 text-xs bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors font-medium flex items-center justify-center"
        >
          View Details
          <ChevronRight className="w-3 h-3 ml-1" />
        </button>
      </div> */}
    </div>
  );
};