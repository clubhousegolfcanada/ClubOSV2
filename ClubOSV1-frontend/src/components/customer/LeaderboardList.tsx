import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, UserPlus, Coins, TrendingUp, Crown, Star, Medal, Home, Target, TrendingDown, Minus, Gem, Award, Sparkles, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/router';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AchievementBadgeGroup } from '@/components/achievements/AchievementBadge';
import { calculateTierFromCC, tierConfigs } from '@/components/TierBadge';

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
  total_cc_earned: number;
  total_challenges_won: number;
  total_challenges_played: number;
  win_rate: number;
  has_champion_marker: boolean;
  is_friend: boolean;
  has_pending_request: boolean;
  rank_change?: number; // Positive = moved up, negative = moved down
  achievement_count?: number;
  achievement_points?: number;
  featured_achievements?: Array<{
    id: string;
    code: string;
    name: string;
    icon: string;
    rarity: string;
    category: string;
    color?: string;
    backgroundColor?: string;
    glowColor?: string;
    animationType?: string;
  }>;
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
  <div className="bg-white divide-y divide-gray-200 animate-pulse">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="px-3 sm:px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-start sm:items-center space-x-2 sm:space-x-3 flex-1">
            <div className="w-8 h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
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
  const [sortBy, setSortBy] = useState<string>('cc_earned');

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    if (!userToken) return;
    
    try {
      const response = await axios.get(`${API_URL}/leaderboard/alltime`, {
        headers: { Authorization: `Bearer ${userToken}` },
        params: { sort: sortBy }
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
  }, [userToken, router, sortBy]);

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
        `${API_URL}/friends/request`,
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

  const getTierIcon = (ccBalance: number) => {
    const tier = calculateTierFromCC(ccBalance);
    const config = tierConfigs[tier];
    
    // Return just the icon with subtle coloring
    return React.cloneElement(config.icon as React.ReactElement, {
      className: `w-4 h-4 ${config.iconColor}`
    });
  };
  
  const getTierOutlineClass = (ccBalance: number) => {
    const tier = calculateTierFromCC(ccBalance);
    const config = tierConfigs[tier];
    
    // Return subtle border classes based on tier
    switch(tier) {
      case 'legend':
        return 'border-l-4 border-l-purple-400/50 hover:border-l-purple-500/70';
      case 'master':
        return 'border-l-4 border-l-amber-400/50 hover:border-l-amber-500/70';
      case 'pro':
        return 'border-l-4 border-l-purple-300/50 hover:border-l-purple-400/70';
      case 'amateur':
        return 'border-l-4 border-l-blue-300/50 hover:border-l-blue-400/70';
      case 'house':
        return 'border-l-4 border-l-[#0B3D3A]/30 hover:border-l-[#0B3D3A]/50';
      default:
        return 'border-l-4 border-l-gray-200 hover:border-l-gray-300';
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
      <span className="flex items-center text-gray-500 text-xs">
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
      className={`${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="flex items-center justify-center py-2 bg-gray-50 dark:bg-gray-950 transition-all"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 100 }}
        >
          <div className={`${pullDistance > 50 ? 'animate-spin' : ''}`}>
            <Trophy className="w-5 h-5 text-[#0B3D3A]" />
          </div>
        </div>
      )}

      {/* Search bar and Sort dropdown */}
      {showSearch && (
        <div className="px-3 py-2 bg-white border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]"
            />
            <div className="relative overflow-hidden">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none pl-2 pr-7 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A] bg-white cursor-pointer"
              >
                <option value="cc_earned">Total CC</option>
                <option value="cc_balance">Balance</option>
                <option value="wins">Wins</option>
                <option value="win_rate">Win Rate</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard list */}
      {loading ? (
        <LeaderboardSkeleton />
      ) : refreshing ? (
        <div className="flex justify-center items-center py-12 bg-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0B3D3A]"></div>
        </div>
      ) : (
        <div className="bg-white divide-y divide-gray-200">
          {displayData.map((player) => (
            <div 
              key={player.user_id} 
              className={`px-2 sm:px-3 py-2 bg-white hover:bg-gray-50 transition-all duration-200 ${
                player.rank <= 3 ? 
                  player.rank === 1 ? 'bg-gradient-to-r from-yellow-50/50 to-transparent' :
                  player.rank === 2 ? 'bg-gradient-to-r from-gray-50/50 to-transparent' :
                  'bg-gradient-to-r from-orange-50/30 to-transparent' : 
                  ''
              } ${getTierOutlineClass(player.cc_balance)}`}
            >
              {/* Mobile: Single line layout with fixed widths for alignment */}
              <div className="sm:hidden flex items-center gap-2">
                {/* Left: Rank - Fixed width */}
                <div className="w-8 flex-shrink-0 text-center">
                  <span className={`font-bold ${
                    player.rank === 1 ? 'text-yellow-500 text-sm' :
                    player.rank === 2 ? 'text-gray-500 text-sm' :
                    player.rank === 3 ? 'text-orange-600 text-sm' :
                    'text-gray-600 text-xs'
                  }`}>
                    {player.rank}
                  </span>
                </div>
                
                {/* Name with tier - Flex grow but max width */}
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                    {player.name}
                  </span>
                  <span className="flex-shrink-0">{getTierIcon(player.cc_balance)}</span>
                  <span className="text-[10px] text-gray-700 dark:text-gray-300 flex-shrink-0">
                    {calculateTierFromCC(player.cc_balance).charAt(0).toUpperCase() + calculateTierFromCC(player.cc_balance).slice(1)}
                  </span>
                </div>
                
                {/* Stats - Fixed width for alignment */}
                <div className="flex flex-col items-end flex-shrink-0" style={{ minWidth: '80px' }}>
                  <span className="font-semibold text-[#0B3D3A] text-xs">
                    {sortBy === 'cc_balance' ? (player.cc_balance || 0).toLocaleString() :
                     sortBy === 'wins' ? player.total_challenges_won :
                     sortBy === 'win_rate' ? `${player.win_rate}%` :
                     (player.total_cc_earned || 0).toLocaleString()}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 text-[10px]">
                    {player.total_challenges_won}/{player.total_challenges_played}
                  </span>
                </div>
                
                {/* Action button - Fixed width */}
                <div className="w-20 flex-shrink-0 flex justify-end">
                  {player.user_id !== userId && (
                    player.is_friend ? (
                      <button
                        onClick={() => router.push(`/customer/challenges/create?friend=${player.user_id}`)}
                        className="px-3 py-1 text-xs font-medium text-[#0B3D3A] hover:bg-[#0B3D3A] hover:text-white border border-[#0B3D3A] rounded-full transition-colors w-full"
                      >
                        Challenge
                      </button>
                    ) : player.has_pending_request ? (
                      <span className="text-xs text-gray-700 dark:text-gray-300 px-3 py-1 inline-block w-full text-center">
                        Sent
                      </span>
                    ) : (
                      <button
                        onClick={() => sendFriendRequest(player.user_id, player.name)}
                        disabled={sendingRequest === player.user_id}
                        className="p-1.5 text-xs font-medium text-[#0B3D3A] hover:bg-[#0B3D3A] hover:text-white border border-[#0B3D3A] rounded-full transition-colors disabled:opacity-50 w-8 h-8 flex items-center justify-center"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              </div>
              
              {/* Desktop: Original multi-line layout */}
              <div className="hidden sm:flex flex-col gap-3">
                {/* Top row: Rank, Name, and Action Button */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {/* Rank with change indicator */}
                    <div className="flex-shrink-0 flex flex-col items-center min-w-[32px]">
                      <span className={`font-bold ${
                        player.rank === 1 ? 'text-yellow-500 text-xl' :
                        player.rank === 2 ? 'text-gray-500 text-lg' :
                        player.rank === 3 ? 'text-orange-600 text-lg' :
                        'text-gray-600 text-base'
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
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                          {player.name}
                        </span>
                        <span className="flex-shrink-0">{getTierIcon(player.cc_balance)}</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          {calculateTierFromCC(player.cc_balance).charAt(0).toUpperCase() + calculateTierFromCC(player.cc_balance).slice(1)}
                        </span>
                      </div>
                      {/* Badges */}
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {player.has_champion_marker && (
                          <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded flex-shrink-0">
                            Champion
                          </span>
                        )}
                        {/* Achievement Badges */}
                        {player.featured_achievements && player.featured_achievements.length > 0 && (
                          <AchievementBadgeGroup
                            achievements={player.featured_achievements}
                            size="xs"
                            maxDisplay={2}
                            className="flex-shrink-0"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Friend Request Button */}
                  <div className="flex-shrink-0">
                    {player.user_id !== userId && (
                      player.is_friend ? (
                        <button
                          onClick={() => router.push(`/customer/challenges/create?friend=${player.user_id}`)}
                          className="px-3 py-1.5 text-xs font-medium text-[#0B3D3A] hover:bg-[#0B3D3A] hover:text-white border border-[#0B3D3A] rounded-full transition-colors"
                        >
                          Challenge
                        </button>
                      ) : player.has_pending_request ? (
                        <span className="text-xs text-gray-700 dark:text-gray-300 px-3 py-1.5 inline-block">
                          Sent
                        </span>
                      ) : (
                        <button
                          onClick={() => sendFriendRequest(player.user_id, player.name)}
                          disabled={sendingRequest === player.user_id}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#0B3D3A] hover:bg-[#0B3D3A] hover:text-white border border-[#0B3D3A] rounded-full transition-colors disabled:opacity-50"
                        >
                          {sendingRequest === player.user_id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>
                {/* Stats row */}
                <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-300 pl-9">
                  <div className="flex items-center gap-4">
                    {/* Primary stat based on sort */}
                    <span className="flex items-center gap-1 font-semibold text-[#0B3D3A]">
                      {sortBy === 'cc_balance' ? (
                        <>
                          <Coins className="w-4 h-4" />
                          {(player.cc_balance || 0).toLocaleString()} CC
                        </>
                      ) : sortBy === 'wins' ? (
                        <>
                          <Trophy className="w-4 h-4" />
                          {player.total_challenges_won} Wins
                        </>
                      ) : sortBy === 'win_rate' ? (
                        <>
                          <TrendingUp className="w-4 h-4" />
                          {player.win_rate}% Win Rate
                        </>
                      ) : (
                        <>
                          <Coins className="w-4 h-4" />
                          {(player.total_cc_earned || 0).toLocaleString()} Total CC
                        </>
                      )}
                    </span>
                    {/* Secondary stats */}
                    <span className="flex items-center gap-1">
                      <Trophy className="w-4 h-4" />
                      <span>{player.total_challenges_won}W / {player.total_challenges_played}P</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {player.win_rate}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {displayData.length === 0 && !loading && (
        <div className="p-8 text-center text-gray-700 dark:text-gray-300 bg-white">
          <Trophy className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <p>No players ranked yet. Start playing to climb the leaderboard!</p>
        </div>
      )}

      {/* Load more indicator for virtual scrolling */}
      {virtualScroll && visibleItems < filteredData.length && (
        <div className="p-4 text-center text-sm text-gray-700 dark:text-gray-300 bg-white">
          Loading more... ({visibleItems} of {filteredData.length})
        </div>
      )}
    </div>
  );
};

export default LeaderboardList;