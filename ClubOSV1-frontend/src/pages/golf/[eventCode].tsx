import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Button from '../../components/ui/Button';
import Input from '../../components/Input';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';
import { Trophy, ChevronLeft, ChevronRight, Flag, Home, User, MapPin } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface PlayerInfo {
  firstName: string;
  lastName: string;
  division: string;
  homeClub: string;
  email: string;
  phone: string;
}

interface EventData {
  id: number;
  event_code: string;
  event_name: string;
  course_name: string;
  event_date: string;
  hole_pars: number[];
  course_par: number;
}

interface ScoreData {
  [hole: number]: number;
}

const GolfScorecard = () => {
  const router = useRouter();
  const { eventCode } = router.query;

  // State management
  const [event, setEvent] = useState<EventData | null>(null);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo>({
    firstName: '',
    lastName: '',
    division: '',
    homeClub: '',
    email: '',
    phone: ''
  });
  const [scores, setScores] = useState<ScoreData>({});
  const [currentHole, setCurrentHole] = useState(1);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReturningPlayer, setIsReturningPlayer] = useState(false);
  const [divisions, setDivisions] = useState<any[]>([]);

  // Load event data and configuration
  useEffect(() => {
    if (eventCode) {
      loadEventData();
      loadConfiguration();
      checkForReturningPlayer();
    }
  }, [eventCode]);

  const loadEventData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/golf/events/${eventCode}`);
      if (!response.ok) throw new Error('Event not found');

      const data = await response.json();
      setEvent(data);
    } catch (err) {
      setError('Failed to load event data');
      console.error(err);
    } finally {
      setLoading(false);
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

  const checkForReturningPlayer = async () => {
    const storedSession = localStorage.getItem(`golf_${eventCode}_session`);
    if (storedSession) {
      try {
        const response = await fetch(`${API_URL}/api/golf/scorecard/${storedSession}`);
        if (response.ok) {
          const data = await response.json();
          setSessionToken(storedSession);
          setPlayerInfo({
            firstName: data.first_name,
            lastName: data.last_name,
            division: data.division,
            homeClub: data.home_club || '',
            email: data.email || '',
            phone: data.phone || ''
          });
          setScores(data.hole_scores || {});
          setIsReturningPlayer(true);

          // Set current hole to next unplayed hole
          const playedHoles = Object.keys(data.hole_scores || {}).map(h => parseInt(h));
          const nextHole = Array.from({ length: 18 }, (_, i) => i + 1)
            .find(h => !playedHoles.includes(h)) || 1;
          setCurrentHole(nextHole);
        }
      } catch (err) {
        // Session invalid, clear it
        localStorage.removeItem(`golf_${eventCode}_session`);
      }
    }
  };

  const validatePlayerInfo = () => {
    if (!playerInfo.firstName.trim()) {
      alert('Please enter your first name');
      return false;
    }
    if (!playerInfo.lastName.trim()) {
      alert('Please enter your last name');
      return false;
    }
    if (!playerInfo.division) {
      alert('Please select your division');
      return false;
    }
    return true;
  };

  const saveScore = async (hole: number, score: number) => {
    if (!sessionToken && !validatePlayerInfo()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/golf/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          eventCode,
          hole,
          score,
          playerInfo: !sessionToken ? playerInfo : undefined
        })
      });

      if (!response.ok) throw new Error('Failed to save score');

      const data = await response.json();

      // Update local state
      if (!sessionToken && data.sessionToken) {
        setSessionToken(data.sessionToken);
        localStorage.setItem(`golf_${eventCode}_session`, data.sessionToken);
        setIsReturningPlayer(true);
      }

      setScores({ ...scores, [hole]: score });

      // Auto-advance to next hole
      if (hole < 18 && !scores[hole + 1]) {
        setTimeout(() => setCurrentHole(hole + 1), 500);
      }
    } catch (err) {
      setError('Failed to save score. Please try again.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const completeRound = async () => {
    if (Object.keys(scores).length < 18) {
      if (!confirm('You haven\'t completed all 18 holes. Are you sure you want to finish?')) {
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/golf/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Round complete! Your score: ${data.finalScore} (${data.toPar >= 0 ? '+' : ''}${data.toPar})`);

        // Redirect to leaderboard
        window.open(`/golf/leaderboard?event=${eventCode}&highlight=${playerInfo.firstName}+${playerInfo.lastName}`, '_self');
      }
    } catch (err) {
      console.error('Failed to complete round:', err);
    } finally {
      setSaving(false);
    }
  };

  // Calculate scores
  const calculateFront9 = () => {
    return Array.from({ length: 9 }, (_, i) => scores[i + 1] || 0)
      .reduce((sum, score) => sum + score, 0) || '-';
  };

  const calculateBack9 = () => {
    return Array.from({ length: 9 }, (_, i) => scores[i + 10] || 0)
      .reduce((sum, score) => sum + score, 0) || '-';
  };

  const calculateTotal = () => {
    const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
    return total || '-';
  };

  const calculateToPar = () => {
    if (!event) return 0;
    const total = calculateTotal();
    if (total === '-') return 0;
    return (total as number) - event.course_par;
  };

  const formatToPar = (toPar: number) => {
    if (toPar === 0) return 'E';
    return toPar > 0 ? `+${toPar}` : `${toPar}`;
  };

  const getScoreColor = (toPar: number) => {
    if (toPar < 0) return 'text-green-600';
    if (toPar > 0) return 'text-red-600';
    return 'text-gray-900';
  };

  if (loading) {
    return <LoadingSpinner fullScreen label="Loading scorecard..." />;
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <EmptyState
          icon={Trophy}
          title="Event Not Found"
          description={error || "This event doesn't exist or is no longer active"}
          action={{
            label: "View All Events",
            onClick: () => router.push('/golf')
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-2xl mx-auto p-4">
        {/* Event Header */}
        <div className="card bg-[var(--accent)] text-white p-6 mb-6">
          <h1 className="text-2xl font-bold">NS Senior Golf Tour</h1>
          <p className="text-xl mt-2">{event.event_name}</p>
          <p className="text-lg opacity-90 flex items-center gap-2 mt-2">
            <MapPin className="w-4 h-4" />
            {event.course_name}
          </p>
          <p className="text-sm opacity-75 mt-4">Sponsored by Clubhouse 24/7</p>
        </div>

        {/* Player Info Section (if not returning player) */}
        {!isReturningPlayer && (
          <div className="card p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Your Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Input
                label="First Name"
                value={playerInfo.firstName}
                onChange={(e) => setPlayerInfo({ ...playerInfo, firstName: e.target.value })}
                className="text-lg"
                required
              />
              <Input
                label="Last Name"
                value={playerInfo.lastName}
                onChange={(e) => setPlayerInfo({ ...playerInfo, lastName: e.target.value })}
                className="text-lg"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                Division *
              </label>
              <select
                className="form-input text-lg w-full p-3 rounded-lg border border-[var(--border-primary)]
                          bg-[var(--bg-tertiary)] focus:ring-2 focus:ring-[var(--accent)]"
                value={playerInfo.division}
                onChange={(e) => setPlayerInfo({ ...playerInfo, division: e.target.value })}
                required
              >
                <option value="">Select Division</option>
                {divisions.map(div => (
                  <option key={div.id} value={div.id}>{div.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Home Club (Optional)"
                value={playerInfo.homeClub}
                onChange={(e) => setPlayerInfo({ ...playerInfo, homeClub: e.target.value })}
                className="text-lg"
                icon={Home}
              />
              <Input
                label="Email (Optional)"
                type="email"
                value={playerInfo.email}
                onChange={(e) => setPlayerInfo({ ...playerInfo, email: e.target.value })}
                className="text-lg"
              />
            </div>
          </div>
        )}

        {/* Welcome Back Message */}
        {isReturningPlayer && (
          <div className="card p-4 mb-6 bg-green-50 dark:bg-green-900/20 border-green-200">
            <p className="text-lg text-green-800 dark:text-green-200">
              Welcome back, <strong>{playerInfo.firstName}</strong>!
              You've completed {Object.keys(scores).length} holes.
            </p>
          </div>
        )}

        {/* Hole Navigation */}
        <div className="card p-4 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => (
              <Button
                key={hole}
                variant={currentHole === hole ? "primary" : scores[hole] ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setCurrentHole(hole)}
                className="min-w-[50px] relative"
              >
                {hole}
                {scores[hole] && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Current Hole Scoring */}
        <div className="card p-6 mb-6">
          <div className="text-center mb-6">
            <h2 className="text-4xl font-bold text-[var(--text-primary)]">
              Hole {currentHole}
            </h2>
            <p className="text-2xl text-[var(--text-secondary)] mt-2">
              Par {event.hole_pars[currentHole - 1]}
            </p>
            {scores[currentHole] && (
              <p className="text-lg text-[var(--accent)] mt-2">
                Current Score: {scores[currentHole]}
              </p>
            )}
          </div>

          {/* Score Selection Grid - Senior-friendly large buttons */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[2, 3, 4, 5, 6, 7, 8, 9].map(score => (
              <Button
                key={score}
                variant={scores[currentHole] === score ? "primary" : "outline"}
                size="lg"
                className="h-20 text-3xl font-bold"
                onClick={() => saveScore(currentHole, score)}
                disabled={saving}
              >
                {score}
              </Button>
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-4">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setCurrentHole(Math.max(1, currentHole - 1))}
              disabled={currentHole === 1}
              icon={ChevronLeft}
            >
              Previous
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => {
                if (currentHole < 18) {
                  setCurrentHole(currentHole + 1);
                } else {
                  completeRound();
                }
              }}
              icon={currentHole === 18 ? Flag : ChevronRight}
              iconPosition="right"
              loading={saving}
            >
              {currentHole === 18 ? 'Finish Round' : 'Next Hole'}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Score Summary */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Your Progress
          </h3>

          <div className="grid grid-cols-3 gap-4 text-center mb-6">
            <div>
              <p className="text-sm text-[var(--text-muted)] uppercase">Front 9</p>
              <p className="text-3xl font-bold">{calculateFront9()}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)] uppercase">Back 9</p>
              <p className="text-3xl font-bold">{calculateBack9()}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)] uppercase">Total</p>
              <p className="text-3xl font-bold">{calculateTotal()}</p>
              {calculateTotal() !== '-' && (
                <p className={`text-xl font-semibold ${getScoreColor(calculateToPar())}`}>
                  {formatToPar(calculateToPar())}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => window.open(`/golf/leaderboard?event=${eventCode}`, '_blank')}
            >
              View Leaderboard
            </Button>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => {
                const firstName = prompt('Enter your first name:');
                const lastName = prompt('Enter your last name:');
                if (firstName && lastName) {
                  router.push(`/golf/find-player?firstName=${firstName}&lastName=${lastName}&eventCode=${eventCode}`);
                }
              }}
            >
              Find My Score
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GolfScorecard;