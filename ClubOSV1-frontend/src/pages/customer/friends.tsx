import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthState } from '@/state/useStore';
import { useRouter } from 'next/router';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import { 
  Users, Send, Search, UserPlus, Clock, ArrowLeft, 
  Check, X, UserMinus, Ban, Sparkles, ChevronLeft,
  RefreshCw, DollarSign, Trophy, MapPin, Shield
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Friend {
  id: string;
  friendship_id: string;
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  handicap?: number;
  home_location?: string;
  status: 'pending' | 'accepted' | 'blocked';
  requested_at: string;
  accepted_at?: string;
  mutual_friends_count: number;
  friendship_source?: string;
  last_active?: string;
  // ClubCoin wager stats
  wagers_together?: number;
  total_wagered?: number;
  last_wager?: string;
  total_friends?: number;
  clubcoin_balance?: number; // Future field
}

interface FriendRequest {
  id: string;
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  direction: 'incoming' | 'outgoing';
  message?: string;
  requested_at: string;
  mutual_friends: number;
}

interface FriendSuggestion {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  mutual_friends: number;
  same_location: boolean;
  reason: 'mutual_friends' | 'same_location';
}

export default function Friends() {
  const { user } = useAuthState();
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'discover'>('friends');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendQuery, setAddFriendQuery] = useState('');
  const [addFriendType, setAddFriendType] = useState<'email' | 'phone'>('email');
  const [friendMessage, setFriendMessage] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Check auth - customers only
  useEffect(() => {
    if (!user) {
      // No user, redirect to login
      router.push('/login');
    } else if (user.role !== 'customer') {
      // Not a customer, show message instead of redirect
      setAuthChecked(true); // Allow render but show error message
    } else {
      // User is a customer, allow access
      setAuthChecked(true);
    }
  }, [user, router]);

  // Load initial data - only for customers
  useEffect(() => {
    if (authChecked && user?.role === 'customer') {
      loadFriends();
      loadPendingRequests();
      loadSuggestions();
    }
  }, [authChecked, user]);

  const loadFriends = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/friends?include_stats=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(response.data.data.friends);
    } catch (error) {
      console.error('Error loading friends:', error);
      toast.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/friends/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingRequests(response.data.data.requests);
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.get(`${API_URL}/friends/suggestions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuggestions(response.data.data.suggestions);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadFriends(),
      loadPendingRequests(),
      loadSuggestions()
    ]);
    setRefreshing(false);
    toast.success('Friends list refreshed');
  };

  const searchFriends = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/friends/search`,
        { query, type: 'all' },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setSearchResults(response.data.data.users);
    } catch (error) {
      console.error('Error searching friends:', error);
    }
  };

  const sendFriendRequest = async (targetUserId?: string, targetEmail?: string, targetPhone?: string) => {
    try {
      const token = localStorage.getItem('clubos_token');
      const response = await axios.post(
        `${API_URL}/friends/request`,
        {
          target_user_id: targetUserId,
          target_email: targetEmail,
          target_phone: targetPhone,
          message: friendMessage
        },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success(response.data.data.message);
      setShowAddFriend(false);
      setAddFriendQuery('');
      setFriendMessage('');
      loadPendingRequests();
      loadSuggestions();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send friend request');
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.put(
        `${API_URL}/friends/${requestId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Friend request accepted');
      loadFriends();
      loadPendingRequests();
    } catch (error) {
      toast.error('Failed to accept request');
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.put(
        `${API_URL}/friends/${requestId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Friend request rejected');
      loadPendingRequests();
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  const removeFriend = async (friendshipId: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.delete(
        `${API_URL}/friends/${friendshipId}`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Friend removed');
      setSelectedFriend(null);
      loadFriends();
    } catch (error) {
      toast.error('Failed to remove friend');
    }
  };

  const blockUser = async (userId: string) => {
    if (!confirm('Are you sure you want to block this user? They will not be able to send you friend requests or wagers.')) return;
    
    try {
      const token = localStorage.getItem('clubos_token');
      await axios.put(
        `${API_URL}/friends/${userId}/block`,
        {},
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('User blocked');
      setSelectedFriend(null);
      loadFriends();
    } catch (error) {
      toast.error('Failed to block user');
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (activeTab === 'discover' && searchTerm) {
        searchFriends(searchTerm);
      }
    }, 500);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, activeTab]);

  const formatLastActive = (date?: string) => {
    if (!date) return 'Never';
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const incomingRequests = pendingRequests.filter(r => r.direction === 'incoming');
  const outgoingRequests = pendingRequests.filter(r => r.direction === 'outgoing');

  // Don't render until auth is checked
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show message for non-customers
  if (user?.role !== 'customer') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <Users className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Friends - Customer Feature</h2>
        <p className="text-gray-600 text-center max-w-md mb-6">
          The friends system is only available for customer accounts. 
          Switch to a customer account to connect with other players and manage friendships.
        </p>
        <button
          onClick={() => router.push('/customer')}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Friends - Clubhouse 24/7</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <div className="flex flex-col h-screen bg-gray-50 pt-14 pb-16 lg:pb-0">
          {/* Header */}
          <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold">Friends</h1>
                <p className="text-sm text-gray-600">
                  {friends.length} friends • {incomingRequests.length} pending
              </p>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b px-4">
          <div className="flex gap-6">
            {['friends', 'pending', 'discover'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-3 px-1 border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 font-medium'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab}
                {tab === 'pending' && incomingRequests.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {incomingRequests.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Friends List (Mobile: Full width, Desktop: Sidebar) */}
          <div className={`${selectedFriend ? 'hidden lg:block' : 'w-full lg:w-96'} bg-white border-r overflow-y-auto`}>
            {/* Search Bar */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={activeTab === 'discover' ? 'Search by email or phone...' : 'Search friends...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {activeTab === 'friends' && (
                <button
                  onClick={() => setShowAddFriend(true)}
                  className="mt-3 w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-5 h-5" />
                  Add Friend
                </button>
              )}
            </div>

            {/* Content based on active tab */}
            {activeTab === 'friends' && (
              <div className="divide-y">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">Loading friends...</div>
                ) : filteredFriends.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">
                      {searchTerm ? 'No friends found' : 'No friends yet'}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={() => setActiveTab('discover')}
                        className="mt-3 text-blue-500 hover:underline"
                      >
                        Discover friends
                      </button>
                    )}
                  </div>
                ) : (
                  filteredFriends.map((friend) => (
                    <div
                      key={friend.id}
                      onClick={() => setSelectedFriend(friend)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedFriend?.id === friend.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt={friend.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-lg font-medium text-gray-600">
                              {friend.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium text-gray-900 truncate">{friend.name}</h3>
                              <p className="text-sm text-gray-500 truncate">{friend.email}</p>
                            </div>
                            {friend.clubcoin_balance && (
                              <div className="flex items-center gap-1 text-sm text-green-600">
                                <DollarSign className="w-4 h-4" />
                                <span>{friend.clubcoin_balance} CC</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            {friend.home_location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span>{friend.home_location}</span>
                              </div>
                            )}
                            {friend.wagers_together && friend.wagers_together > 0 && (
                              <div className="flex items-center gap-1">
                                <Trophy className="w-3 h-3" />
                                <span>{friend.wagers_together} wagers</span>
                              </div>
                            )}
                          </div>
                          
                          <p className="text-xs text-gray-400 mt-1">
                            Active {formatLastActive(friend.last_active)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'pending' && (
              <div className="divide-y">
                {incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No pending friend requests
                  </div>
                ) : (
                  <>
                    {incomingRequests.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                          Incoming Requests ({incomingRequests.length})
                        </div>
                        {incomingRequests.map((request) => (
                          <div key={request.id} className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                                {request.avatar_url ? (
                                  <img src={request.avatar_url} alt={request.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  <span className="text-lg font-medium text-gray-600">
                                    {request.name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex-1">
                                <h3 className="font-medium text-gray-900">{request.name}</h3>
                                <p className="text-sm text-gray-500">{request.email}</p>
                                {request.mutual_friends > 0 && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {request.mutual_friends} mutual friends
                                  </p>
                                )}
                                {request.message && (
                                  <p className="text-sm text-gray-600 mt-2 italic">"{request.message}"</p>
                                )}
                                
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => acceptRequest(request.id)}
                                    className="flex-1 bg-green-500 text-white py-1.5 px-3 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                                  >
                                    <Check className="w-4 h-4" />
                                    Accept
                                  </button>
                                  <button
                                    onClick={() => rejectRequest(request.id)}
                                    className="flex-1 bg-red-500 text-white py-1.5 px-3 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-1"
                                  >
                                    <X className="w-4 h-4" />
                                    Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    
                    {outgoingRequests.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                          Sent Requests ({outgoingRequests.length})
                        </div>
                        {outgoingRequests.map((request) => (
                          <div key={request.id} className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-lg font-medium text-gray-600">
                                  {request.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              
                              <div className="flex-1">
                                <h3 className="font-medium text-gray-900">{request.name}</h3>
                                <p className="text-sm text-gray-500">{request.email}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  Sent {formatDistanceToNow(new Date(request.requested_at), { addSuffix: true })}
                                </p>
                              </div>
                              
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                Pending
                              </span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'discover' && (
              <div className="divide-y">
                {/* Search Results */}
                {searchTerm && searchResults.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                      Search Results ({searchResults.length})
                    </div>
                    {searchResults.map((user) => (
                      <div key={user.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span className="text-lg font-medium text-gray-600">
                                {user.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{user.name}</h3>
                            <p className="text-sm text-gray-500">{user.location}</p>
                            {user.mutual_friends > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                {user.mutual_friends} mutual friends
                              </p>
                            )}
                          </div>
                          
                          {user.friendship_status === 'accepted' ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              Friends
                            </span>
                          ) : user.friendship_status === 'pending' ? (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                              Pending
                            </span>
                          ) : (
                            <button
                              onClick={() => sendFriendRequest(user.id)}
                              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
                
                {/* Suggestions */}
                {!searchTerm && suggestions.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                      Suggested Friends
                    </div>
                    {suggestions.map((suggestion) => (
                      <div key={suggestion.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                            {suggestion.avatar_url ? (
                              <img src={suggestion.avatar_url} alt={suggestion.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span className="text-lg font-medium text-gray-600">
                                {suggestion.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{suggestion.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              {suggestion.mutual_friends > 0 && (
                                <span>{suggestion.mutual_friends} mutual friends</span>
                              )}
                              {suggestion.same_location && (
                                <span>• Same location</span>
                              )}
                            </div>
                            {suggestion.bio && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{suggestion.bio}</p>
                            )}
                          </div>
                          
                          <button
                            onClick={() => sendFriendRequest(suggestion.id)}
                            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                          >
                            <UserPlus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                
                {!searchTerm && suggestions.length === 0 && (
                  <div className="p-8 text-center">
                    <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No suggestions available</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Try searching for friends by email or phone
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Friend Details (Mobile: Full screen, Desktop: Main panel) */}
          {selectedFriend && (
            <div className="flex-1 bg-white flex flex-col">
              {/* Friend Header */}
              <div className="p-4 border-b">
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => setSelectedFriend(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    {selectedFriend.avatar_url ? (
                      <img src={selectedFriend.avatar_url} alt={selectedFriend.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-2xl font-medium text-gray-600">
                        {selectedFriend.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900">{selectedFriend.name}</h2>
                    <p className="text-gray-600">{selectedFriend.email}</p>
                    {selectedFriend.home_location && (
                      <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {selectedFriend.home_location}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => blockUser(selectedFriend.user_id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Block User"
                    >
                      <Ban className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => removeFriend(selectedFriend.friendship_id)}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Remove Friend"
                    >
                      <UserMinus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Friend Stats */}
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {selectedFriend.clubcoin_balance || 0}
                  </div>
                  <div className="text-sm text-gray-600">ClubCoins</div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {selectedFriend.wagers_together || 0}
                  </div>
                  <div className="text-sm text-gray-600">Wagers Together</div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {selectedFriend.total_friends || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Friends</div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">
                    {selectedFriend.handicap || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Handicap</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t mt-auto">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    disabled
                    className="bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                  >
                    <DollarSign className="w-5 h-5" />
                    Wager (Coming Soon)
                  </button>
                  
                  <button
                    disabled
                    className="bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
                  >
                    <Trophy className="w-5 h-5" />
                    View Stats (Coming Soon)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty State for Desktop */}
          {!selectedFriend && (
            <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50">
              <div className="text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Select a friend to view details</p>
              </div>
            </div>
          )}
        </div>

        {/* Add Friend Modal */}
        {showAddFriend && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-bold mb-4">Add Friend</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search by
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAddFriendType('email')}
                      className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                        addFriendType === 'email'
                          ? 'bg-blue-50 border-blue-500 text-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Email
                    </button>
                    <button
                      onClick={() => setAddFriendType('phone')}
                      className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                        addFriendType === 'phone'
                          ? 'bg-blue-50 border-blue-500 text-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Phone
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {addFriendType === 'email' ? 'Email Address' : 'Phone Number'}
                  </label>
                  <input
                    type={addFriendType === 'email' ? 'email' : 'tel'}
                    value={addFriendQuery}
                    onChange={(e) => setAddFriendQuery(e.target.value)}
                    placeholder={addFriendType === 'email' ? 'friend@example.com' : '+1 234 567 8900'}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message (Optional)
                  </label>
                  <textarea
                    value={friendMessage}
                    onChange={(e) => setFriendMessage(e.target.value)}
                    placeholder="Add a personal message..."
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddFriend(false);
                    setAddFriendQuery('');
                    setFriendMessage('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (addFriendType === 'email') {
                      sendFriendRequest(undefined, addFriendQuery, undefined);
                    } else {
                      sendFriendRequest(undefined, undefined, addFriendQuery);
                    }
                  }}
                  disabled={!addFriendQuery}
                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Request
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}