import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Trophy, Calendar, MapPin, Users, ChevronRight, BarChart3, Shield } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface EventData {
  id: number;
  event_code: string;
  event_name: string;
  course_name: string;
  event_date: string;
  hole_pars: number[];
  course_par: number;
  is_active: boolean;
}

interface EventWithStats extends EventData {
  playerCount?: number;
  completedCount?: number;
}

const GolfTourHome = () => {
  const router = useRouter();
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sponsor, setSponsor] = useState<any>(null);

  useEffect(() => {
    loadEvents();
    loadSponsorInfo();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/golf/events`);
      const data = await response.json();

      // Load player counts for each event
      const eventsWithStats = await Promise.all(
        data.map(async (event: EventData) => {
          try {
            const countResponse = await fetch(
              `${API_URL}/api/golf/player-counts/${event.event_code}`
            );
            const counts = await countResponse.json();
            return {
              ...event,
              playerCount: counts.all || 0,
              completedCount: counts.completed || 0
            };
          } catch {
            return event;
          }
        })
      );

      setEvents(eventsWithStats);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSponsorInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/api/golf/config`);
      const config = await response.json();
      if (config.sponsor) {
        setSponsor(config.sponsor);
      }
    } catch (err) {
      console.error('Failed to load sponsor info:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getEventStatus = (event: EventWithStats) => {
    const eventDate = new Date(event.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate > today) {
      return { label: 'Upcoming', status: 'pending' };
    } else if (eventDate.getTime() === today.getTime()) {
      return { label: 'Today', status: 'active' };
    } else if (event.completedCount && event.completedCount > 0) {
      return { label: 'Completed', status: 'completed' };
    } else {
      return { label: 'In Progress', status: 'active' };
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen label="Loading tour events..." />;
  }

  if (events.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <EmptyState
          icon={Trophy}
          title="No Events Available"
          description="Check back soon for upcoming golf tour events"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Nova Scotia Senior Golf Tour
            </h1>
            <p className="text-xl md:text-2xl opacity-90 mb-8">
              2024 Tour • 4 Premier Courses • All Skill Levels
            </p>
            {sponsor && (
              <div className="inline-flex items-center gap-3 bg-white/20 backdrop-blur
                            rounded-full px-6 py-3">
                <span className="text-sm uppercase tracking-wider opacity-75">
                  Presented by
                </span>
                <span className="text-lg font-semibold">{sponsor.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="max-w-6xl mx-auto px-4 -mt-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-6 bg-white dark:bg-[var(--bg-secondary)] shadow-lg">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon={BarChart3}
              onClick={() => router.push('/golf/leaderboard')}
            >
              View Live Leaderboard
            </Button>
          </div>
          <div className="card p-6 bg-white dark:bg-[var(--bg-secondary)] shadow-lg">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              icon={Trophy}
              onClick={() => {
                const firstName = prompt('Enter your first name:');
                const lastName = prompt('Enter your last name:');
                if (firstName && lastName) {
                  // Try to find player in first event
                  router.push(`/golf/find-player?firstName=${firstName}&lastName=${lastName}`);
                }
              }}
            >
              Find My Score
            </Button>
          </div>
          <div className="card p-6 bg-white dark:bg-[var(--bg-secondary)] shadow-lg">
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              icon={Shield}
              onClick={() => router.push('/golf/admin')}
            >
              Admin Access
            </Button>
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
          <Trophy className="w-7 h-7 text-[var(--accent)]" />
          Tour Events
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.map(event => {
            const status = getEventStatus(event);
            const isToday = status.label === 'Today';

            return (
              <div
                key={event.event_code}
                className={`card p-6 transition-all duration-200 hover:shadow-lg cursor-pointer
                          ${isToday ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/5' : ''}`}
                onClick={() => router.push(`/golf/${event.event_code}`)}
              >
                {/* Event Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{event.event_name}</h3>
                    <p className="text-lg text-[var(--text-secondary)] flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {event.course_name}
                    </p>
                  </div>
                  <StatusBadge
                    status={status.status as any}
                    label={status.label}
                    variant="subtle"
                    dot
                  />
                </div>

                {/* Event Details */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <Calendar className="w-5 h-5" />
                    <span>{formatDate(event.event_date)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <Trophy className="w-5 h-5" />
                    <span>Par {event.course_par} • 18 Holes</span>
                  </div>
                  {event.playerCount !== undefined && event.playerCount > 0 && (
                    <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                      <Users className="w-5 h-5" />
                      <span>
                        {event.playerCount} player{event.playerCount !== 1 ? 's' : ''}
                        {event.completedCount && event.completedCount > 0 &&
                          ` • ${event.completedCount} completed`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Call to Action */}
                <Button
                  variant={isToday ? "primary" : "outline"}
                  size="md"
                  fullWidth
                  icon={ChevronRight}
                  iconPosition="right"
                >
                  {status.label === 'Upcoming' && 'View Event Details'}
                  {status.label === 'Today' && 'Enter Scores Now'}
                  {status.label === 'In Progress' && 'Continue Scoring'}
                  {status.label === 'Completed' && 'View Results'}
                </Button>

                {isToday && (
                  <div className="mt-3 p-3 bg-[var(--accent)]/10 rounded-lg">
                    <p className="text-sm text-[var(--accent)] font-medium text-center">
                      🏌️ Event is happening today! Start entering scores now.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tour Information */}
      <div className="bg-[var(--bg-secondary)] py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold mb-8">Tour Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6">
              <h3 className="font-semibold mb-3">Divisions</h3>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li>• Men's Championship (50-64)</li>
                <li>• Men's Senior (65-74)</li>
                <li>• Men's Super Senior (75+)</li>
                <li>• Ladies Division (50+)</li>
              </ul>
            </div>

            <div className="card p-6">
              <h3 className="font-semibold mb-3">How to Play</h3>
              <ol className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li>1. Scan QR code at course or click event</li>
                <li>2. Enter your name and division</li>
                <li>3. Input scores hole by hole</li>
                <li>4. View live leaderboard anytime</li>
              </ol>
            </div>

            <div className="card p-6">
              <h3 className="font-semibold mb-3">Features</h3>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li>• Live scoring and leaderboards</li>
                <li>• Mobile-friendly interface</li>
                <li>• Auto-save after each hole</li>
                <li>• Division-based standings</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Sponsor Section */}
      {sponsor && (
        <div className="py-12 text-center">
          <p className="text-[var(--text-muted)] mb-3">Proudly Sponsored by</p>
          <h3 className="text-2xl font-bold text-[var(--accent)] mb-2">{sponsor.name}</h3>
          {sponsor.message && (
            <p className="text-[var(--text-secondary)]">{sponsor.message}</p>
          )}
          {sponsor.website && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              onClick={() => window.open(sponsor.website, '_blank')}
            >
              Visit {sponsor.name} →
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default GolfTourHome;