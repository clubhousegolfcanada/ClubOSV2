import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Input from '../../components/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StatusBadge from '../../components/ui/StatusBadge';
import { Settings, Download, FileText, Users, Trophy, BarChart, Lock, Unlock } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface EventStats {
  event_code: string;
  event_name: string;
  total_players: number;
  completed_rounds: number;
  in_progress: number;
  avg_score: number;
  best_score: number;
  worst_score: number;
}

const GolfAdmin = () => {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<EventStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already authenticated (stored in session)
    const authStatus = sessionStorage.getItem('golf_admin_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      loadStats();
    }
  }, []);

  const handleLogin = async () => {
    if (password === 'NSGolf2024Admin') {
      setIsAuthenticated(true);
      sessionStorage.setItem('golf_admin_auth', 'true');
      setError(null);
      loadStats();
    } else {
      setError('Invalid password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('golf_admin_auth');
    setPassword('');
    setStats([]);
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/golf/stats`, {
        headers: {
          'password': 'NSGolf2024Admin'
        }
      });

      if (!response.ok) throw new Error('Failed to load statistics');

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError('Failed to load tournament statistics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportEvent = async (eventCode: string, format: 'csv' | 'json' = 'csv') => {
    try {
      const response = await fetch(
        `${API_URL}/api/golf/export/${eventCode}?format=${format}`,
        {
          headers: {
            'password': 'NSGolf2024Admin'
          }
        }
      );

      if (!response.ok) throw new Error('Export failed');

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${eventCode}-results.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${eventCode}-results.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      alert('Failed to export data. Please try again.');
      console.error(err);
    }
  };

  const exportAllEvents = async () => {
    for (const event of stats) {
      if (event.total_players > 0) {
        await exportEvent(event.event_code);
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-[var(--accent)]/10 rounded-full">
              <Lock className="w-8 h-8 text-[var(--accent)]" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">Golf Tour Admin</h1>
          <p className="text-[var(--text-muted)] text-center mb-6">
            Enter password to access tournament administration
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <Input
              type="password"
              label="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              error={error}
              className="mb-4"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              icon={Unlock}
            >
              Access Admin Panel
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner fullScreen label="Loading tournament data..." />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <PageHeader
          title="Golf Tour Administration"
          subtitle="NS Senior Golf Tour - Tournament Management"
          icon={Settings}
          action={{
            label: 'Logout',
            onClick: handleLogout,
            variant: 'secondary',
            icon: Lock
          }}
        />

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={Download}
            onClick={exportAllEvents}
          >
            Export All Events
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            icon={BarChart}
            onClick={() => window.open('/golf/leaderboard', '_blank')}
          >
            View Live Leaderboard
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            icon={Trophy}
            onClick={loadStats}
          >
            Refresh Statistics
          </Button>
        </div>

        {/* Event Statistics */}
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <BarChart className="w-5 h-5" />
          Tournament Statistics
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stats.map(event => (
            <div key={event.event_code} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{event.event_name}</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Event Code: {event.event_code}
                  </p>
                </div>
                <StatusBadge
                  status={event.completed_rounds > 0 ? 'active' : 'pending'}
                  label={event.completed_rounds > 0 ? 'Active' : 'Upcoming'}
                  variant="subtle"
                />
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <Users className="w-5 h-5 mx-auto mb-1 text-[var(--text-muted)]" />
                  <p className="text-2xl font-bold">{event.total_players || 0}</p>
                  <p className="text-xs text-[var(--text-muted)]">Total Players</p>
                </div>
                <div className="text-center p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <Trophy className="w-5 h-5 mx-auto mb-1 text-[var(--text-muted)]" />
                  <p className="text-2xl font-bold">{event.completed_rounds || 0}</p>
                  <p className="text-xs text-[var(--text-muted)]">Completed</p>
                </div>
              </div>

              {event.completed_rounds > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                  <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <p className="font-semibold text-green-700 dark:text-green-300">
                      {event.best_score || '-'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Best</p>
                  </div>
                  <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <p className="font-semibold text-blue-700 dark:text-blue-300">
                      {event.avg_score ? Math.round(event.avg_score) : '-'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Average</p>
                  </div>
                  <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <p className="font-semibold text-red-700 dark:text-red-300">
                      {event.worst_score || '-'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">Highest</p>
                  </div>
                </div>
              )}

              {event.in_progress > 0 && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {event.in_progress} player{event.in_progress !== 1 ? 's' : ''} currently on course
                  </p>
                </div>
              )}

              {/* Export Actions */}
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  icon={FileText}
                  onClick={() => exportEvent(event.event_code, 'csv')}
                  disabled={event.total_players === 0}
                >
                  Export CSV
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  icon={Download}
                  onClick={() => exportEvent(event.event_code, 'json')}
                  disabled={event.total_players === 0}
                >
                  Export JSON
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Statistics */}
        <div className="mt-8 card p-6 bg-[var(--accent)]/5">
          <h3 className="text-lg font-semibold mb-4">Overall Tour Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-[var(--accent)]">
                {stats.reduce((sum, e) => sum + (e.total_players || 0), 0)}
              </p>
              <p className="text-sm text-[var(--text-muted)]">Total Participants</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">
                {stats.reduce((sum, e) => sum + (e.completed_rounds || 0), 0)}
              </p>
              <p className="text-sm text-[var(--text-muted)]">Rounds Completed</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-600">
                {stats.reduce((sum, e) => sum + (e.in_progress || 0), 0)}
              </p>
              <p className="text-sm text-[var(--text-muted)]">In Progress</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">
                {stats.filter(e => e.total_players > 0).length}
              </p>
              <p className="text-sm text-[var(--text-muted)]">Active Events</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 card p-6 border-[var(--accent)] border">
          <h3 className="text-lg font-semibold mb-3">Export Instructions</h3>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            <li>• CSV exports can be opened directly in Excel or Google Sheets</li>
            <li>• JSON exports include complete scoring data for all players</li>
            <li>• Exports include player info, hole-by-hole scores, and final totals</li>
            <li>• Data is sorted by division and then by score (lowest to highest)</li>
            <li>• Use "Export All Events" to download all tournaments at once</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GolfAdmin;