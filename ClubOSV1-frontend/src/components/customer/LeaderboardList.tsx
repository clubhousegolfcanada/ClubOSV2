import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, UserPlus, Coins, TrendingUp, Crown, Star, Medal, Home, Target, TrendingDown, Minus } from 'lucide-react';
import { useRouter } from 'next/router';
import axios from 'axios';
import toast from 'react-hot-toast';

// Fix for double /api/ issue
let API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
if (API_URL.endsWith('/api')) {
  API_URL = API_URL.slice(0, -4);
}

interface LeaderboardEntry {
  user_id: string;
  name: string;
  rank: number;
  rank_tier: string;
  cc_balance: number;
  total_challenges_won: number;
  total_challenges_played: number;
  win_rate: number;
  has_champion_marker: boolean;
  is_friend: boolean;
  has_pending_request: boolean;
  rank_change?: number; // Positive = moved up, negative = moved down
}

interface LeaderboardListProps {
  userId?: string;
  userToken?: string;
  onRefresh?: () => Promise<void>;
  className?: string;
  showSearch?: boolean;
  virtualScroll?: boolean;
}

// Loading skeleton component
const LeaderboardSkeleton = () => (
  <div className="divide-y divide-gray-200 animate-pulse">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="px-3 sm:px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-start sm:items-center space-x-2 sm:space-x-3 flex-1">
            <div className="w-8 h-6 bg-gray-200 rounded"></div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="h-5 w-32 bg-gray-200 rounded"></div>
                <div className="h-4 w-4 bg-gray-200 rounded-full"></div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-3 w-16 bg-gray-200 rounded"></div>
                <div className="h-3 w-20 bg-gray-200 rounded"></div>
                <div className="h-3 w-12 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
          <div className="h-8 w-20 bg-gray-200 rounded-full"></div>
        </div>
      </div>
    ))}
  </div>
);

export const LeaderboardList: React.FC<LeaderboardListProps> = ({
  userId,
  userToken,
  onRefresh,
  className = '',
  showSearch = false,
  virtualScroll = false
}) => {
  const router = useRouter();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleItems, setVisibleItems] = useState(50);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    if (!userToken) return;
    
    try {
      const response = await axios.get(`${API_URL}/api/leaderboard/alltime`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      
      if (response.data.success) {
        // Use actual rank change data from API
        setLeaderboardData(response.data.data || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch leaderboard:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        router.push('/login');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userToken, router]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
    const distance = e.targetTouches[0].clientY - touchStart;
    if (distance > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(distance, 100));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 50 && !refreshing) {
      setRefreshing(true);
      setPullDistance(0);
      if (onRefresh) {
        onRefresh().then(() => setRefreshing(false));
      } else {
        fetchLeaderboard();
      }
    } else {
      setPullDistance(0);
    }
  };

  // Virtual scrolling - load more as user scrolls
  const handleScroll = useCallback(() => {
    if (!virtualScroll) return;
    
    const scrollPosition = window.innerHeight + window.scrollY;
    const threshold = document.body.offsetHeight - 200;
    
    if (scrollPosition > threshold && visibleItems < leaderboardData.length) {
      setVisibleItems(prev => Math.min(prev + 20, leaderboardData.length));
    }
  }, [virtualScroll, visibleItems, leaderboardData.length]);

  useEffect(() => {
    if (virtualScroll) {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, virtualScroll]);

  const sendFriendRequest = async (targetUserId: string, targetName: string) => {
    setSendingRequest(targetUserId);
    try {
      await axios.post(
        `${API_URL}/api/friends/request`,
        { target_user_id: targetUserId },
        { headers: { Authorization: `Bearer ${userToken}` } }
      );
      toast.success(`Friend request sent to ${targetName}!`);
      setLeaderboardData(prev => 
        prev.map(entry => 
          entry.user_id === targetUserId 
            ? { ...entry, has_pending_request: true }
            : entry
        )
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send friend request');
    } finally {
      setSendingRequest(null);
    }
  };

  const getRankIcon = (tier: string) => {
    switch(tier) {
      case 'Legend': return <Crown className="w-4 h-4 text-purple-600" />;
      case 'Champion': return <Trophy className="w-4 h-4 text-yellow-600" />;
      case 'Pro': return <Star className="w-4 h-4 text-blue-600" />;
      case 'Gold': return <Medal className="w-4 h-4 text-yellow-500" />;
      case 'Silver': return <Medal className="w-4 h-4 text-gray-400" />;
      case 'Bronze': return <Medal className="w-4 h-4 text-orange-600" />;
      case 'Amateur': return <Target className="w-4 h-4 text-green-600" />;
      case 'House': return <Home className="w-4 h-4 text-gray-600" />;
      default: return <Home className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRankChangeIcon = (change: number) => {
    if (change > 0) {
      return (
        <span className="flex items-center text-green-600 text-xs">
          <TrendingUp className="w-3 h-3" />
          <span className="ml-0.5">{change}</span>
        </span>
      );
    } else if (change < 0) {
      return (
        <span className="flex items-center text-red-600 text-xs">
          <TrendingDown className="w-3 h-3" />
          <span className="ml-0.5">{Math.abs(change)}</span>
        </span>
      );
    }
    return (
      <span className="flex items-center text-gray-400 text-xs">
        <Minus className="w-3 h-3" />
      </span>
    );
  };

  const filteredData = leaderboardData.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayData = virtualScroll ? filteredData.slice(0, visibleItems) : filteredData;

  return (
    <div 
      className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="flex items-center justify-center py-2 bg-gray-50 transition-all"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 100 }}
        >
          <div className={`${pullDistance > 50 ? 'animate-spin' : ''}`}>
            <Trophy className="w-5 h-5 text-[#0B3D3A]" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-[#0B3D3A] to-[#084a45] text-white">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          All-Time Rankings
        </h3>
        <p className="text-xs text-white/80 mt-1">Season-wide competitive standings</p>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="p-3 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]"
          />
        </div>
      )}

      {/* Leaderboard list */}
      {loading ? (
        <LeaderboardSkeleton />
      ) : refreshing ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A]"></div>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {displayData.map((player) => (
            <div key={player.user_id} className="px-3 sm:px-4 py-3 hover:bg-gray-50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-start sm:items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                  {/* Rank with change indicator */}
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <span className={`font-bold ${
                      player.rank === 1 ? 'text-yellow-500 text-lg sm:text-xl' :
                      player.rank === 2 ? 'text-gray-400 text-base sm:text-lg' :
                      player.rank === 3 ? 'text-orange-600 text-base sm:text-lg' :
                      'text-gray-600 text-sm sm:text-base'
                    }`}>
                      {player.rank}
                    </span>
                    {player.rank_change !== undefined && (
                      <div className="mt-0.5">
                        {getRankChangeIcon(player.rank_change)}
                      </div>
                    )}
                  </div>
                  
                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 truncate max-w-[150px] sm:max-w-none">
                        {player.name}
                      </span>
                      <span className="flex-shrink-0">{getRankIcon(player.rank_tier)}</span>
                      {player.has_champion_marker && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded flex-shrink-0">
                          Champion
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Coins className="w-3 h-3 flex-shrink-0" />
                        <span className="hidden sm:inline">{player.cc_balance.toLocaleString()} CC</span>
                        <span className="sm:hidden">{player.cc_balance.toLocaleString()}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 flex-shrink-0" />
                        <span className="hidden sm:inline">{player.total_challenges_won}W / {player.total_challenges_played}P</span>
                        <span className="sm:hidden">{player.total_challenges_won}/{player.total_challenges_played}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 flex-shrink-0" />
                        {player.win_rate}%
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Friend Request Button */}
                <div className="flex-shrink-0 ml-10 sm:ml-0">
                  {player.user_id !== userId && (
                    player.is_friend ? (
                      <button
                        onClick={() => router.push(`/customer/challenges/create?friend=${player.user_id}`)}
                        className="px-3 py-1.5 text-xs font-medium text-[#0B3D3A] hover:bg-[#0B3D3A] hover:text-white border border-[#0B3D3A] rounded-full transition-colors min-w-[80px] min-h-[32px] flex items-center justify-center"
                      >
                        Challenge
                      </button>
                    ) : player.has_pending_request ? (
                      <span className="text-xs text-gray-500 px-2 sm:px-3 py-1.5 inline-block">
                        Sent
                      </span>
                    ) : (
                      <button
                        onClick={() => sendFriendRequest(player.user_id, player.name)}
                        disabled={sendingRequest === player.user_id}
                        className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium text-[#0B3D3A] hover:bg-[#0B3D3A] hover:text-white border border-[#0B3D3A] rounded-full transition-colors disabled:opacity-50 min-w-[44px] min-h-[32px] sm:min-h-[28px] justify-center"
                      >
                        {sendingRequest === player.user_id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3" />
                            <span className="hidden sm:inline">Add</span>
                          </>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {displayData.length === 0 && !loading && (
        <div className="p-8 text-center text-gray-500">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>No players ranked yet. Start playing to climb the leaderboard!</p>
        </div>
      )}

      {/* Load more indicator for virtual scrolling */}
      {virtualScroll && visibleItems < filteredData.length && (
        <div className="p-4 text-center text-sm text-gray-500">
          Loading more... ({visibleItems} of {filteredData.length})
        </div>
      )}
    </div>
  );
};

export default LeaderboardList;