import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import axios from 'axios';
import { 
  ArrowLeft,
  Clock,
  Target,
  User,
  MapPin,
  DollarSign,
  Check,
  X,
  AlertCircle,
  Trophy,
  Activity,
  Calendar,
  ChevronRight,
  Flag,
  Star
} from 'lucide-react';


interface ChallengeDetail {
  id: string;
  status: string;
  creatorId: string;
  acceptorId: string;
  creatorName: string;
  acceptorName: string;
  creatorRank: string;
  acceptorRank: string;
  creatorHasChampion?: boolean;
  acceptorHasChampion?: boolean;
  wagerAmount: number;
  creatorStakeAmount: number;
  acceptorStakeAmount: number;
  totalPot: number;
  expiresAt: string;
  courseName: string;
  creatorNote?: string;
  creatorPlayedAt?: string;
  acceptorPlayedAt?: string;
  creatorPlayedScore?: number;
  acceptorPlayedScore?: number;
  trackmanSettings: any;
  winnerUserId?: string;
  finalPayout?: number;
}

export default function ChallengeDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuthState();
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDescription, setDisputeDescription] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else if (id) {
      fetchChallenge();
    }
  }, [user, router, id]);

  const fetchChallenge = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/challenges/${id}`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });

      if (response.data.success) {
        setChallenge(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch challenge:', error);
      router.push('/customer/challenges');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/challenges/${id}/accept`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` }}
      );
      
      setShowAcceptModal(false);
      await fetchChallenge();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to accept challenge');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!confirm('Are you sure you want to decline this challenge?')) return;
    
    setActionLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/challenges/${id}/decline`,
        { reason: 'User declined' },
        { headers: { Authorization: `Bearer ${user?.token}` }}
      );
      
      router.push('/customer/challenges');
    } catch (error) {
      console.error('Failed to decline challenge:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason || !disputeDescription) {
      alert('Please provide a reason and description for the dispute');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/challenges/${id}/dispute`,
        {
          type: disputeReason,
          description: disputeDescription
        },
        { headers: { Authorization: `Bearer ${user?.token}` }}
      );
      
      setShowDisputeModal(false);
      alert('Dispute filed successfully. Our team will review it soon.');
      await fetchChallenge();
    } catch (error) {
      console.error('Failed to file dispute:', error);
      alert('Failed to file dispute');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff < 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} days, ${hours} hours`;
    return `${hours} hours`;
  };

  const getRankColor = (rank: string) => {
    const colors: Record<string, string> = {
      legend: 'bg-purple-100 text-purple-700',
      champion: 'bg-red-100 text-red-700',
      pro: 'bg-blue-100 text-blue-700',
      gold: 'bg-yellow-100 text-yellow-700',
      silver: 'bg-gray-100 text-gray-700',
      bronze: 'bg-orange-100 text-orange-700',
      amateur: 'bg-green-100 text-green-700',
      house: 'bg-gray-50 text-gray-500'
    };
    return colors[rank?.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
      accepted: { color: 'bg-blue-100 text-blue-700', label: 'Accepted' },
      active: { color: 'bg-green-100 text-green-700', label: 'Active' },
      awaiting_sync: { color: 'bg-orange-100 text-orange-700', label: 'Awaiting Opponent' },
      ready_resolve: { color: 'bg-purple-100 text-purple-700', label: 'Ready to Resolve' },
      resolved: { color: 'bg-gray-100 text-gray-700', label: 'Completed' },
      expired: { color: 'bg-red-100 text-red-700', label: 'Expired' },
      disputed: { color: 'bg-red-100 text-red-700', label: 'Under Dispute' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  if (loading || !challenge) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A] mx-auto mb-4"></div>
          <p className="text-gray-500">Loading challenge...</p>
        </div>
      </div>
    );
  }

  const isCreator = challenge.creatorId === user?.id;
  const isPending = challenge.status === 'pending';
  const isActive = ['accepted', 'active', 'awaiting_sync'].includes(challenge.status);
  const isResolved = challenge.status === 'resolved';
  const hasPlayed = isCreator ? !!challenge.creatorPlayedAt : !!challenge.acceptorPlayedAt;
  const opponentHasPlayed = isCreator ? !!challenge.acceptorPlayedAt : !!challenge.creatorPlayedAt;

  return (
    <>
      <Head>
        <title>Challenge Details - Clubhouse Golf</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8 pt-14">
          {/* Header */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-4xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => router.push('/customer/challenges')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Challenge Details</h1>
                    <p className="text-sm text-gray-500">
                      {isCreator ? `vs ${challenge.acceptorName}` : `vs ${challenge.creatorName}`}
                    </p>
                  </div>
                </div>
                {getStatusBadge(challenge.status)}
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            {/* Players Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Players</h2>
              <div className="grid grid-cols-2 gap-4">
                {/* Creator */}
                <div className={`p-4 rounded-lg border ${isCreator ? 'border-[#0B3D3A] bg-[#0B3D3A]/5' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Challenger</span>
                    {isCreator && <span className="text-xs font-medium text-[#0B3D3A]">YOU</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{challenge.creatorName}</p>
                    {challenge.creatorHasChampion && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getRankColor(challenge.creatorRank)}`}>
                    {challenge.creatorRank?.toUpperCase()}
                  </span>
                  {challenge.creatorPlayedAt && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-600">Score</p>
                      <p className="font-bold text-lg">{challenge.creatorPlayedScore}</p>
                    </div>
                  )}
                </div>

                {/* Acceptor */}
                <div className={`p-4 rounded-lg border ${!isCreator ? 'border-[#0B3D3A] bg-[#0B3D3A]/5' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Opponent</span>
                    {!isCreator && <span className="text-xs font-medium text-[#0B3D3A]">YOU</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{challenge.acceptorName}</p>
                    {challenge.acceptorHasChampion && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getRankColor(challenge.acceptorRank)}`}>
                    {challenge.acceptorRank?.toUpperCase()}
                  </span>
                  {challenge.acceptorPlayedAt && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-600">Score</p>
                      <p className="font-bold text-lg">{challenge.acceptorPlayedScore}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Challenge Details Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Challenge Details</h2>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>Course</span>
                  </div>
                  <span className="font-medium">{challenge.courseName}</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Target className="w-4 h-4" />
                    <span>Settings</span>
                  </div>
                  <span className="font-medium">
                    {challenge.trackmanSettings?.holes || 18} holes • {challenge.trackmanSettings?.scoringType || 'Stroke Play'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <DollarSign className="w-4 h-4" />
                    <span>Total Pot</span>
                  </div>
                  <span className="font-bold text-[#0B3D3A] text-lg">{challenge.totalPot} CC</span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>Time Remaining</span>
                  </div>
                  <span className={`font-medium ${
                    formatTimeRemaining(challenge.expiresAt) === 'Expired' ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {formatTimeRemaining(challenge.expiresAt)}
                  </span>
                </div>

                {challenge.creatorNote && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-sm text-gray-600 mb-1">Message from challenger:</p>
                    <p className="text-gray-900 italic">"{challenge.creatorNote}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stakes Breakdown */}
            {(isPending || isActive) && (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Stakes Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Challenger stake (50%)</span>
                    <span className="font-medium">{challenge.creatorStakeAmount} CC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Opponent stake (50%)</span>
                    <span className="font-medium">{challenge.acceptorStakeAmount} CC</span>
                  </div>
                  <div className="pt-2 border-t border-gray-300 flex justify-between">
                    <span className="font-semibold">Total Pot</span>
                    <span className="font-bold text-[#0B3D3A]">{challenge.totalPot} CC</span>
                  </div>
                </div>
              </div>
            )}

            {/* Result Card */}
            {isResolved && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Challenge Result
                </h2>
                
                <div className="text-center py-6">
                  <p className="text-2xl font-bold text-gray-900 mb-2">
                    {challenge.winnerUserId === user?.id ? 'Victory!' : 'Defeat'}
                  </p>
                  <p className="text-lg text-gray-600">
                    Final Score: {challenge.creatorPlayedScore} - {challenge.acceptorPlayedScore}
                  </p>
                  {challenge.winnerUserId === user?.id && challenge.finalPayout && (
                    <p className="mt-4 text-xl font-bold text-[#0B3D3A]">
                      Won {challenge.finalPayout} CC
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {/* Pending - Acceptor can accept/decline */}
              {isPending && !isCreator && (
                <>
                  <button
                    onClick={() => setShowAcceptModal(true)}
                    className="w-full bg-[#0B3D3A] text-white py-3 rounded-lg font-medium hover:bg-[#084a45] transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    Accept Challenge
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={actionLoading}
                    className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Decline
                  </button>
                </>
              )}

              {/* Active - Show play status */}
              {isActive && !hasPlayed && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Action Required:</strong> Complete your round and sync with TrackMan to record your score.
                  </p>
                </div>
              )}

              {isActive && hasPlayed && !opponentHasPlayed && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    <strong>Round Complete:</strong> Waiting for opponent to complete their round.
                  </p>
                </div>
              )}

              {/* Dispute button */}
              {(isActive || isResolved) && (
                <button
                  onClick={() => setShowDisputeModal(true)}
                  className="w-full bg-white border border-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Flag className="w-5 h-5" />
                  File Dispute
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Accept Modal */}
        {showAcceptModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Accept Challenge</h3>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  By accepting this challenge, you agree to:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Lock {challenge.acceptorStakeAmount} CC as your stake</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Complete your round within {formatTimeRemaining(challenge.expiresAt)}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Play with the agreed course settings</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Your stake</span>
                  <span className="font-bold">{challenge.acceptorStakeAmount} CC</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Potential winnings</span>
                  <span className="font-bold text-[#0B3D3A]">{challenge.totalPot} CC</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAcceptModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAccept}
                  disabled={actionLoading}
                  className="flex-1 bg-[#0B3D3A] text-white py-2 rounded-lg font-medium hover:bg-[#084a45] transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Accepting...' : 'Accept & Lock Stake'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dispute Modal */}
        {showDisputeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">File Dispute</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dispute Type
                </label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                >
                  <option value="">Select a reason</option>
                  <option value="wrong_settings">Wrong settings used</option>
                  <option value="invalid_score">Invalid score reported</option>
                  <option value="no_show">Opponent didn't play</option>
                  <option value="cheating">Suspected cheating</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Provide details about your dispute..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                  rows={4}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDisputeModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDispute}
                  disabled={actionLoading || !disputeReason || !disputeDescription}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Filing...' : 'File Dispute'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}