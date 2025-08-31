import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Target, Clock, Coins, ChevronRight, TrendingUp, Users } from 'lucide-react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';


interface Challenge {
  id: string;
  status: 'pending' | 'accepted' | 'active' | 'resolved' | 'expired' | 'declined';
  creatorId: string;
  acceptorId: string;
  creatorName: string;
  acceptorName: string;
  wagerAmount: number;
  totalPot: number;
  expiresAt: string;
  courseName: string;
  createdAt: string;
  opponent_name?: string;
  wager_amount?: number;
  expires_at?: string;
}

interface RecentChallengesProps {
  userId?: string;
  userToken?: string;
}

export const RecentChallenges: React.FC<RecentChallengesProps> = ({ userId, userToken }) => {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userToken) {
      fetchChallenges();
    }
  }, [userToken]);

  const fetchChallenges = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/challenges/my-challenges`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      
      if (response.data.success) {
        // Get the 2 most recent active or pending challenges
        const recentChallenges = response.data.data
          .filter((c: Challenge) => c.status === 'active' || c.status === 'pending' || c.status === 'accepted')
          .slice(0, 2);
        setChallenges(recentChallenges);
      }
    } catch (error) {
      console.error('Failed to fetch challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
      accepted: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Accepted' },
      active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
      resolved: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Completed' },
      expired: { bg: 'bg-red-100', text: 'text-red-700', label: 'Expired' },
      declined: { bg: 'bg-red-100', text: 'text-red-700', label: 'Declined' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-3"></div>
          <div className="space-y-2">
            <div className="h-12 bg-gray-100 rounded"></div>
            <div className="h-12 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Active Challenges</h2>
          <Target className="w-4 h-4 text-[#0B3D3A]" />
        </div>
        <div className="text-center py-6">
          <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-700">No active challenges</p>
          <button
            onClick={() => router.push('/customer/compete')}
            className="mt-3 px-3 py-1.5 bg-[#0B3D3A] text-white text-xs font-medium rounded-lg hover:bg-[#084a45] transition-colors"
          >
            Create Challenge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Active Challenges</h2>
        <Target className="w-4 h-4 text-[#0B3D3A]" />
      </div>
      
      <div className="space-y-2">
        {challenges.map((challenge) => {
          const isCreator = challenge.creatorId === userId;
          const opponentName = isCreator ? 
            (challenge.acceptorName || 'Waiting for opponent') : 
            challenge.creatorName;
          const wagerAmount = challenge.wagerAmount || challenge.wager_amount || 0;
          
          return (
            <button
              key={challenge.id}
              onClick={() => router.push(`/customer/challenges/${challenge.id}`)}
              className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-between group text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-900 truncate">
                    vs {opponentName}
                  </span>
                  {getStatusBadge(challenge.status)}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-700">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3 h-3" />
                    {wagerAmount} CC
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(challenge.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500 group-hover:translate-x-1 transition-transform flex-shrink-0" />
            </button>
          );
        })}
      </div>
      
      <button
        onClick={() => router.push('/customer/compete')}
        className="w-full mt-3 p-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
      >
        <Users className="w-3.5 h-3.5" />
        View All Challenges
      </button>
    </div>
  );
};

export default RecentChallenges;