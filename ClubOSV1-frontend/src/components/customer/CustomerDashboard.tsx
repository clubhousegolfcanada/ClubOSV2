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
  availableBays: number;
  nextAvailable: string;
}

interface Booking {
  id: string;
  date: string;
  time: string;
  bay: string;
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

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuthState();
  const router = useRouter();
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

  useEffect(() => {
    fetchCustomerData();
  }, []);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      // For now, use mock data until API endpoints are ready
      setMyClubhouse({
        id: '1',
        name: 'Bedford',
        displayName: 'Clubhouse 24/7 Golf - Bedford',
        city: 'Bedford',
        availableBays: 3,
        nextAvailable: '2:00 PM'
      });

      setUpcomingBookings([
        {
          id: '1',
          date: 'Today',
          time: '6:00 PM',
          bay: 'Bay 2',
          location: 'Bedford',
          friends: ['John D.', 'Mike S.']
        },
        {
          id: '2',
          date: 'Tomorrow',
          time: '7:00 PM',
          bay: 'Bay 4',
          location: 'Bedford',
          friends: []
        }
      ]);

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
      label: 'Book a Bay', 
      description: 'Reserve your spot',
      gradient: 'from-emerald-500 to-green-600',
      onClick: () => router.push('/customer/bookings') 
    },
    { 
      icon: Users, 
      label: 'Find Friends', 
      description: 'Connect with players',
      gradient: 'from-blue-500 to-indigo-600',
      onClick: () => router.push('/customer/friends') 
    },
    { 
      icon: Trophy, 
      label: 'Join Event', 
      description: 'Compete and win',
      gradient: 'from-purple-500 to-pink-600',
      onClick: () => router.push('/customer/events') 
    },
    { 
      icon: BarChart3, 
      label: 'My Stats', 
      description: 'Track progress',
      gradient: 'from-orange-500 to-red-600',
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
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
            <p className="mt-1 text-gray-600">
              Ready to improve your game? You have {upcomingBookings.length} upcoming {upcomingBookings.length === 1 ? 'booking' : 'bookings'}.
            </p>
          </div>
          <div className="hidden sm:block">
            <Zap className="w-8 h-8 text-[#0B3D3A]" />
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="group relative bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 overflow-hidden"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
            <div className="relative">
              <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${action.gradient} mb-4`}>
                <action.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{action.label}</h3>
              <p className="text-sm text-gray-500">{action.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Clubhouse Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">My Clubhouse</h2>
            <MapPin className="w-5 h-5 text-[#0B3D3A]" />
          </div>
          {myClubhouse ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">{myClubhouse.city}</p>
                <p className="text-xl font-bold text-gray-900">{myClubhouse.name}</p>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Available Now</span>
                    <span className="text-sm font-semibold text-green-600">
                      {myClubhouse.availableBays} {myClubhouse.availableBays === 1 ? 'bay' : 'bays'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Next Available</span>
                    <span className="text-sm font-medium text-gray-900">{myClubhouse.nextAvailable}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => router.push('/customer/bookings')}
                className="w-full mt-4 py-2.5 bg-[#0B3D3A] text-white rounded-lg hover:bg-[#084a45] transition-colors font-medium"
              >
                Book Now
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-3">Set your home clubhouse</p>
              <button className="text-[#0B3D3A] hover:text-[#084a45] font-medium">
                Choose Location
              </button>
            </div>
          )}
        </div>

        {/* Upcoming Bookings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Bookings</h2>
            <Calendar className="w-5 h-5 text-[#0B3D3A]" />
          </div>
          <div className="space-y-3">
            {upcomingBookings.length > 0 ? (
              <>
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{booking.date}</span>
                      <span className="text-sm font-medium text-[#0B3D3A]">{booking.time}</span>
                    </div>
                    <p className="text-sm text-gray-600">{booking.bay} • {booking.location}</p>
                    {booking.friends.length > 0 && (
                      <div className="flex items-center mt-2">
                        <Users className="w-3 h-3 text-gray-400 mr-1" />
                        <p className="text-xs text-gray-500">
                          {booking.friends.join(', ')}
                        </p>
                      </div>
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
                  Book a Bay
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <Activity className="w-5 h-5 text-[#0B3D3A]" />
          </div>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="p-1.5 bg-gray-100 rounded-lg">
                    {getActivityIcon(activity.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{activity.time}</p>
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
      </div>

      {/* Stats Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Performance This Month</h2>
          <TrendingUp className="w-5 h-5 text-[#0B3D3A]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <p className="text-3xl font-bold text-gray-900">{stats.roundsPlayed}</p>
            </div>
            <p className="text-sm text-gray-600">Rounds Played</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <p className="text-3xl font-bold text-gray-900">{stats.avgScore}</p>
            </div>
            <p className="text-sm text-gray-600">Average Score</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 mb-2">
              <p className="text-3xl font-bold text-gray-900">
                {Math.abs(stats.improvement)}
              </p>
              {getTrendIcon(stats.improvement)}
            </div>
            <p className="text-sm text-gray-600">Improvement</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <p className="text-3xl font-bold text-gray-900">{stats.avgDrive}</p>
            </div>
            <p className="text-sm text-gray-600">Avg Drive (yds)</p>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-100">
          <button 
            onClick={() => router.push('/customer/stats')}
            className="w-full py-2.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium flex items-center justify-center"
          >
            View Detailed Stats
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};