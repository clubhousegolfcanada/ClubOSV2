import React, { useEffect, useState } from 'react';
import { Calendar, Users, Trophy, MapPin, Clock, TrendingUp, Activity, ChevronRight } from 'lucide-react';
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

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuthState();
  const router = useRouter();
  const [myClubhouse, setMyClubhouse] = useState<ClubhouseLocation | null>(null);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch customer data
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
          bay: 'Bay 2 (TrackMan)',
          location: 'Bedford',
          friends: ['John D.', 'Mike S.']
        },
        {
          id: '2',
          date: 'Tomorrow',
          time: '7:00 PM',
          bay: 'Bay 4 (TrackMan)',
          location: 'Bedford',
          friends: []
        }
      ]);

      setRecentActivity([
        { type: 'friend', message: 'Sarah K. accepted your friend request', time: '2 hours ago' },
        { type: 'booking', message: 'Mike S. joined your booking for today', time: '5 hours ago' },
        { type: 'score', message: 'New personal best: 72 at Pebble Beach', time: '1 day ago' }
      ]);
    } catch (error) {
      console.error('Failed to fetch customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { icon: Calendar, label: 'Book a Bay', color: 'bg-green-500', onClick: () => router.push('/bookings') },
    { icon: Users, label: 'Find Friends', color: 'bg-blue-500', onClick: () => router.push('/friends') },
    { icon: Trophy, label: 'Join Event', color: 'bg-purple-500', onClick: () => router.push('/events') },
    { icon: TrendingUp, label: 'My Stats', color: 'bg-orange-500', onClick: () => router.push('/stats') }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border-2 border-[var(--border-primary)]">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Welcome back, {user?.name?.split(' ')[0]}! ⛳
        </h1>
        <p className="text-[var(--text-secondary)]">
          Ready to improve your game? You have {upcomingBookings.length} upcoming bookings.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="bg-[var(--bg-secondary)] p-4 rounded-xl border-2 border-[var(--border-primary)] hover:border-[var(--accent)] transition-all group"
          >
            <div className={`${action.color} w-12 h-12 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <action.icon className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{action.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Clubhouse Card */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border-2 border-[var(--border-primary)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">My Clubhouse</h2>
            <MapPin className="w-5 h-5 text-[var(--accent)]" />
          </div>
          {myClubhouse ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-[var(--text-secondary)]">{myClubhouse.city}</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{myClubhouse.name}</p>
              </div>
              <div className="pt-3 border-t border-[var(--border-secondary)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">Available Now</span>
                  <span className="text-lg font-semibold text-green-500">{myClubhouse.availableBays} bays</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">Next Available</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{myClubhouse.nextAvailable}</span>
                </div>
              </div>
              <button className="w-full mt-3 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity">
                Book Now
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[var(--text-secondary)]">Set your home clubhouse</p>
              <button className="mt-2 text-[var(--accent)] hover:underline">Choose Location</button>
            </div>
          )}
        </div>

        {/* Upcoming Bookings */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border-2 border-[var(--border-primary)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Upcoming Bookings</h2>
            <Calendar className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div className="space-y-3">
            {upcomingBookings.map((booking) => (
              <div key={booking.id} className="p-3 bg-[var(--bg-primary)] rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-[var(--text-primary)]">{booking.date}</span>
                  <span className="text-sm text-[var(--accent)]">{booking.time}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{booking.bay}</p>
                {booking.friends.length > 0 && (
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    With: {booking.friends.join(', ')}
                  </p>
                )}
              </div>
            ))}
            <button className="w-full py-2 text-[var(--accent)] hover:underline text-sm">
              View All Bookings →
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border-2 border-[var(--border-primary)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent Activity</h2>
            <Activity className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div className="space-y-3">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${
                  activity.type === 'friend' ? 'bg-blue-500' :
                  activity.type === 'booking' ? 'bg-green-500' :
                  'bg-orange-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-[var(--text-primary)]">{activity.message}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{activity.time}</p>
                </div>
              </div>
            ))}
            <button className="w-full py-2 text-[var(--accent)] hover:underline text-sm">
              View All Activity →
            </button>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border-2 border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Your Stats This Month</h2>
          <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">12</p>
            <p className="text-sm text-[var(--text-secondary)]">Rounds Played</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">78.5</p>
            <p className="text-sm text-[var(--text-secondary)]">Avg Score</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">-2.3</p>
            <p className="text-sm text-[var(--text-secondary)]">Improvement</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">245</p>
            <p className="text-sm text-[var(--text-secondary)]">Avg Drive (yds)</p>
          </div>
        </div>
      </div>
    </div>
  );
};