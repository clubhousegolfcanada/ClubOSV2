import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import PageHeader from '../../components/ui/PageHeader';
import TabNavigation from '../../components/customer/TabNavigation';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import Button from '../../components/ui/Button';
import { Trophy, RefreshCw, Download, Users, Medal, Award } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface LeaderboardEntry {
  position: number;
  displayPosition: string;
  player_name: string;
  first_name: string;
  last_name: string;
  division: string;
  home_club: string;
  holes_completed: number;
  thru: string;
  front_nine: number;
  back_nine: number;
  total_score: number;
  to_par: number;
  scoreDisplay: string;
  status: string;
}

interface EventData {
  id: number;
  event_code: string;
  event_name: string;
  course_name: string;
  event_date: string;
  course_par: number;
}

const GolfLeaderboard = () => {
  const router = useRouter();
  const { event: eventParam, highlight } = router.query;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // State management
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [activeDiv, setActiveDiv] = useState('all');
  const [playerCounts, setPlayerCounts] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load initial data
  useEffect(() => {
    loadEvents();
    loadConfiguration();
  }, []);

  // Set selected event from URL param
  useEffect(() => {
    if (eventParam && events.length > 0) {
      setSelectedEvent(eventParam as string);
    } else if (events.length > 0 && !selectedEvent) {
      setSelectedEvent(events[0].event_code);
    }
  }, [eventParam, events]);

  // Load leaderboard when event changes
  useEffect(() => {
    if (selectedEvent) {
      loadLeaderboard();
      loadPlayerCounts();
    }
  }, [selectedEvent, activeDiv]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (autoRefresh && selectedEvent) {
      intervalRef.current = setInterval(() => {
        loadLeaderboard(true);
      }, 30000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, selectedEvent, activeDiv]);

  const loadEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/golf/events`);
      const data = await response.json();
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  const loadConfiguration = async () => {
    try {
      const response = await fetch(`${API_URL}/api/golf/config`);
      const config = await response.json();

      if (config.divisions) {
        setDivisions(config.divisions);
      }
    } catch (err) {
      console.error('Failed to load configuration:', err);
    }
  };

  const loadLeaderboard = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch(
        `${API_URL}/api/golf/leaderboard/${selectedEvent}?division=${activeDiv}`
      );
      const data = await response.json();
      setLeaderboard(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadPlayerCounts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/golf/player-counts/${selectedEvent}`);
      const data = await response.json();
      setPlayerCounts(data);
    } catch (err) {
      console.error('Failed to load player counts:', err);
    }
  };

  const manualRefresh = () => {
    loadLeaderboard(true);
    loadPlayerCounts();
  };

  const exportLeaderboard = () => {
    const password = prompt('Enter admin password to export:');
    if (password) {
      window.location.href = `${API_URL}/api/golf/export/${selectedEvent}?format=csv`;
    }
  };

  const getPositionIcon = (position: string) => {
    if (position === '1' || position === 'T1') {
      return <Trophy className="w-5 h-5 text-yellow-500" />;
    }
    if (position === '2' || position === 'T2') {
      return <Medal className="w-5 h-5 text-gray-400" />;
    }
    if (position === '3' || position === 'T3') {
      return <Award className="w-5 h-5 text-amber-600" />;
    }
    return null;
  };

  const getScoreColor = (toPar: number) => {
    if (toPar < 0) return 'text-green-600 font-semibold';
    if (toPar > 0) return 'text-red-600 font-semibold';
    return 'text-gray-900';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Build tabs for divisions
  const tabs = [
    {
      key: 'all',
      label: 'Overall',
      badge: playerCounts.all?.toString()
    },
    ...divisions.map(d => ({
      key: d.id,
      label: d.name.split('(')[0].trim(), // Shorter label for mobile
      badge: playerCounts[d.id]?.toString()
    }))
  ];

  const currentEvent = events.find(e => e.event_code === selectedEvent);

  if (loading && leaderboard.length === 0) {
    return <LoadingSpinner fullScreen label="Loading leaderboard..." />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <PageHeader
          title="Live Leaderboard"
          subtitle={
            currentEvent
              ? `${currentEvent.event_name} • ${currentEvent.course_name}`
              : 'NS Senior Golf Tour'
          }
          icon={Trophy}
          action={{
            label: 'Export',
            onClick: exportLeaderboard,
            icon: Download,
            variant: 'secondary'
          }}
          compact
        />

        {/* Event Selector (if multiple events) */}
        {events.length > 1 && (
          <div className="px-4 pb-4">
            <select
              className="form-input w-full md:w-auto text-lg p-3 rounded-lg
                        border border-[var(--border-primary)]
                        bg-[var(--bg-tertiary)]"
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
            >
              {events.map(event => (
                <option key={event.event_code} value={event.event_code}>
                  {event.event_name} - {event.course_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Division Tabs */}
        <div className="px-4">
          <TabNavigation
            tabs={tabs}
            activeTab={activeDiv}
            onTabChange={setActiveDiv}
            sticky
          />
        </div>

        {/* Auto-refresh controls */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-[var(--text-secondary)]">
                Auto-refresh (30s)
              </span>
            </label>
            {lastUpdated && (
              <span className="text-xs text-[var(--text-muted)]">
                Updated: {formatTime(lastUpdated)}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            onClick={manualRefresh}
            loading={refreshing}
          >
            Refresh
          </Button>
        </div>

        {/* Leaderboard Content */}
        <div className="p-4">
          {leaderboard.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Scores Yet"
              description="Scores will appear as players complete holes"
              size="md"
            />
          ) : (
            <div className="space-y-2">
              {/* Leaderboard Header - Desktop only */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2
                            text-xs uppercase text-[var(--text-muted)] font-medium">
                <div className="col-span-1">Pos</div>
                <div className="col-span-4">Player</div>
                <div className="col-span-1">Thru</div>
                <div className="col-span-1 text-center">F9</div>
                <div className="col-span-1 text-center">B9</div>
                <div className="col-span-2 text-center">Total</div>
                <div className="col-span-2 text-center">Score</div>
              </div>

              {/* Leaderboard Rows */}
              {leaderboard.map((entry, index) => {
                const isHighlighted = highlight &&
                  entry.player_name.toLowerCase().includes(highlight.toString().toLowerCase());

                return (
                  <div
                    key={`${entry.player_name}-${index}`}
                    className={`card p-4 transition-all duration-200 hover:shadow-md
                              ${isHighlighted ? 'ring-2 ring-[var(--accent)] bg-[var(--accent)]/5' : ''}`}
                  >
                    {/* Mobile Layout */}
                    <div className="md:hidden">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-[var(--text-secondary)]">
                              {entry.displayPosition}
                            </span>
                            {getPositionIcon(entry.displayPosition)}
                          </div>
                          <div>
                            <p className="font-semibold text-lg">{entry.player_name}</p>
                            {entry.home_club && (
                              <p className="text-sm text-[var(--text-muted)]">{entry.home_club}</p>
                            )}
                          </div>
                        </div>
                        <StatusBadge
                          status={entry.status === 'completed' ? 'completed' : 'active'}
                          label={entry.thru}
                          variant="subtle"
                          size="sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-[var(--text-muted)]">
                          F9: {entry.front_nine || '-'} • B9: {entry.back_nine || '-'}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{entry.total_score || '-'}</p>
                          <p className={`text-lg ${getScoreColor(entry.to_par)}`}>
                            {entry.scoreDisplay}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden md:grid md:grid-cols-12 gap-4 items-center">
                      <div className="col-span-1 flex items-center gap-2">
                        <span className="text-xl font-bold text-[var(--text-secondary)]">
                          {entry.displayPosition}
                        </span>
                        {getPositionIcon(entry.displayPosition)}
                      </div>
                      <div className="col-span-4">
                        <p className="font-semibold">{entry.player_name}</p>
                        {entry.home_club && (
                          <p className="text-sm text-[var(--text-muted)]">{entry.home_club}</p>
                        )}
                      </div>
                      <div className="col-span-1">
                        <StatusBadge
                          status={entry.status === 'completed' ? 'completed' : 'active'}
                          label={entry.thru}
                          variant="subtle"
                          size="sm"
                        />
                      </div>
                      <div className="col-span-1 text-center text-[var(--text-secondary)]">
                        {entry.front_nine || '-'}
                      </div>
                      <div className="col-span-1 text-center text-[var(--text-secondary)]">
                        {entry.back_nine || '-'}
                      </div>
                      <div className="col-span-2 text-center">
                        <p className="text-xl font-bold">{entry.total_score || '-'}</p>
                      </div>
                      <div className="col-span-2 text-center">
                        <p className={`text-lg ${getScoreColor(entry.to_par)}`}>
                          {entry.scoreDisplay}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with sponsor */}
        <div className="mt-12 p-8 text-center border-t border-[var(--border-primary)]">
          <p className="text-[var(--text-muted)] mb-2">Proudly Sponsored by</p>
          <p className="text-xl font-semibold text-[var(--accent)]">Clubhouse 24/7</p>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Nova Scotia's Premier Golf & Recreation Facilities
          </p>
        </div>
      </div>
    </div>
  );
};

export default GolfLeaderboard;