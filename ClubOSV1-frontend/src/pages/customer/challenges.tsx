import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import axios from 'axios';
import { 
  Plus, 
  Clock, 
  TrendingUp, 
  Users, 
  ChevronRight, 
  Target,
  AlertCircle,
  Check,
  X,
  Star
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Challenge {
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
  totalPot: number;
  expiresAt: string;
  courseName: string;
  creatorScore?: number;
  acceptorScore?: number;
}

export default function CustomerChallenges() {
  const router = useRouter();
  const { user } = useAuthState();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'history'>('active');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [ccBalance, setCCBalance] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else {
      fetchChallenges();
      fetchBalance();
    }
  }, [user, router, activeTab]);

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      let endpoint = '/api/challenges/active';
      if (activeTab === 'pending') endpoint = '/api/challenges/pending';
      if (activeTab === 'history') endpoint = '/api/challenges/history';

      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });

      if (response.data.success) {
        setChallenges(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/challenges/balance`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });

      if (response.data.success) {
        setCCBalance(response.data.data.balance);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const getRankColor = (rank: string) => {
    const colors: Record<string, string> = {
      legend: 'text-purple-600',
      champion: 'text-red-600',
      pro: 'text-blue-600',
      gold: 'text-yellow-600',
      silver: 'text-gray-600',
      bronze: 'text-orange-600',
      amateur: 'text-green-600',
      house: 'text-gray-400'
    };
    return colors[rank?.toLowerCase()] || 'text-gray-500';
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff < 0) return 'Expired';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h remaining`;
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    try {
      await axios.post(
        `${API_URL}/api/challenges/${challengeId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` }}
      );
      fetchChallenges();
      fetchBalance();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to accept challenge');
    }
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    try {
      await axios.post(
        `${API_URL}/api/challenges/${challengeId}/decline`,
        { reason: 'Not interested' },
        { headers: { Authorization: `Bearer ${user?.token}` }}
      );
      fetchChallenges();
    } catch (error) {
      console.error('Failed to decline challenge:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A] mx-auto mb-4"></div>
          <p className="text-gray-500">Loading challenges...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Challenges - Clubhouse 24/7</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8">
          {/* Header with balance */}
          <div className="bg-white border-b border-gray-200 sticky top-14 z-30">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-900">Challenges</h1>
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="text-gray-500">Balance:</span>
                    <span className="font-bold text-[#0B3D3A] ml-1">{ccBalance} CC</span>
                  </div>
                  <button
                    onClick={() => router.push('/customer/challenges/create')}
                    className="bg-[#0B3D3A] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#084a45] transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('active')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === 'active'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === 'pending'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === 'history'
                      ? 'border-[#0B3D3A] text-[#0B3D3A]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  History
                </button>
              </div>
            </div>
          </div>

          {/* Challenge List */}
          <div className="max-w-7xl mx-auto px-4 py-6">
            {challenges.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {activeTab === 'active' && 'No active challenges'}
                  {activeTab === 'pending' && 'No pending invites'}
                  {activeTab === 'history' && 'No challenge history'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {activeTab === 'active' && 'Create or accept a challenge to get started'}
                  {activeTab === 'pending' && 'When someone challenges you, it will appear here'}
                  {activeTab === 'history' && 'Your completed challenges will appear here'}
                </p>
                {activeTab === 'active' && (
                  <button
                    onClick={() => router.push('/customer/challenges/create')}
                    className="bg-[#0B3D3A] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#084a45] transition-colors"
                  >
                    Create Challenge
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {challenge.creatorId === user?.id ? challenge.acceptorName : challenge.creatorName}
                            </span>
                            {(challenge.creatorId === user?.id ? challenge.acceptorHasChampion : challenge.creatorHasChampion) && (
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                          <div className={`text-xs font-medium ${getRankColor(
                            challenge.creatorId === user?.id ? challenge.acceptorRank : challenge.creatorRank
                          )}`}>
                            {(challenge.creatorId === user?.id ? challenge.acceptorRank : challenge.creatorRank)?.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#0B3D3A]">{challenge.totalPot} CC</div>
                        <div className="text-xs text-gray-500">Total Pot</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                      <span>{challenge.courseName}</span>
                      {activeTab === 'active' && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <Clock className="w-3 h-3" />
                          {formatTimeRemaining(challenge.expiresAt)}
                        </span>
                      )}
                    </div>

                    {activeTab === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptChallenge(challenge.id)}
                          className="flex-1 bg-[#0B3D3A] text-white py-2 rounded-lg font-medium hover:bg-[#084a45] transition-colors flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Accept
                        </button>
                        <button
                          onClick={() => handleDeclineChallenge(challenge.id)}
                          className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Decline
                        </button>
                      </div>
                    )}

                    {activeTab === 'active' && (
                      <button
                        onClick={() => router.push(`/customer/challenges/${challenge.id}`)}
                        className="w-full bg-gray-50 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                      >
                        View Details
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}

                    {activeTab === 'history' && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="text-sm">
                          {challenge.creatorScore && challenge.acceptorScore && (
                            <span className="text-gray-600">
                              Score: {challenge.creatorId === user?.id ? challenge.creatorScore : challenge.acceptorScore}
                              {' vs '}
                              {challenge.creatorId === user?.id ? challenge.acceptorScore : challenge.creatorScore}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => router.push(`/customer/challenges/${challenge.id}`)}
                          className="text-[#0B3D3A] text-sm font-medium hover:underline"
                        >
                          View Details
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}