import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthState } from '@/state/useStore';
import CustomerNavigation from '@/components/customer/CustomerNavigation';
import Head from 'next/head';
import axios from 'axios';
import { 
  ArrowLeft,
  Search,
  ChevronRight,
  AlertCircle,
  DollarSign,
  Calendar,
  MapPin,
  Settings2,
  User,
  Target,
  Star
} from 'lucide-react';


interface Friend {
  id?: string;
  user_id?: string;
  friendship_id?: string;
  name?: string;
  friend_name?: string;
  email?: string;
  friend_email?: string;
  rank?: string;
  rank_tier?: string;
  ccBalance?: number;
  cc_balance?: number;
  hasChampionMarker?: boolean;
  has_champion_marker?: boolean;
}

interface CourseSettings {
  id?: string;
  name?: string;
  category?: string;
  courseName?: string;
  holes?: number;
  scoringType?: string;
  teePosition?: string;
  pins?: string;
  putting?: string;
  wind?: string;
  fairwayFirmness?: string;
  greenFirmness?: string;
  attempts?: string;
}

export default function CreateChallenge() {
  const router = useRouter();
  const { user } = useAuthState();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form data
  const [selectedOpponent, setSelectedOpponent] = useState<Friend | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseSettings | null>(null);
  const [wagerAmount, setWagerAmount] = useState(100);
  const [expiryDays, setExpiryDays] = useState<7 | 14 | 30>(14);
  const [creatorNote, setCreatorNote] = useState('');
  
  // Data
  const [friends, setFriends] = useState<Friend[]>([]);
  const [courseSettings, setCourseSettings] = useState<CourseSettings[]>([]);
  const [ccBalance, setCCBalance] = useState(0);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else {
      fetchFriends();
      fetchCourseSettings();
      fetchBalance();
      
      // Check if a friend was pre-selected from the compete page
      if (router.query.friend) {
        const friendId = router.query.friend as string;
        // We'll select the friend after friends are loaded
      }
    }
  }, [user, router]);

  const fetchFriends = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/friends`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      console.log('Friends API response:', response.data); // Debug log
      
      if (response.data.success && response.data.data) {
        // The API returns { success: true, data: { friends: [...], total: n } }
        const friendsList = response.data.data.friends;
        setFriends(Array.isArray(friendsList) ? friendsList : []);
        
        // Check if we should pre-select a friend
        if (router.query.friend && Array.isArray(friendsList)) {
          const friendId = router.query.friend as string;
          const friend = friendsList.find(f => 
            f.id === friendId || f.user_id === friendId || f.friend_id === friendId
          );
          if (friend) {
            setSelectedOpponent({
              id: friend.user_id || friend.friend_id || friend.id,
              name: friend.name || friend.friend_name,
              email: friend.email || friend.friend_email,
              rank: friend.rank_tier || friend.friend_rank || 'House',
              ccBalance: friend.cc_balance || friend.friend_cc_balance || friend.clubcoin_balance || 0
            });
          }
        }
      } else {
        console.log('No friends data in response');
        setFriends([]);
      }
    } catch (error) {
      console.error('Failed to fetch friends:', error);
      setFriends([]);
    }
  };

  const fetchCourseSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/trackman/settings-catalog`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (response.data.success && response.data.data) {
        const settings = response.data.data;
        setCourseSettings(Array.isArray(settings) ? settings : []);
      } else {
        setCourseSettings([]);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setCourseSettings([]);
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

  const calculateStakes = () => {
    const creatorStake = Math.round(wagerAmount * 0.50 * 100) / 100;
    const acceptorStake = Math.round(wagerAmount * 0.50 * 100) / 100;
    const totalPot = creatorStake + acceptorStake;
    return { creatorStake, acceptorStake, totalPot };
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

  const validateStep = () => {
    const newErrors: any = {};
    
    if (step === 1 && !selectedOpponent) {
      newErrors.opponent = 'Please select an opponent';
    }
    
    if (step === 2) {
      if (!selectedCourse?.courseName) {
        newErrors.course = 'Please select a course or choose to decide outside of the challenge';
      } else if (selectedCourse?.courseName !== 'DECIDE_LATER') {
        // Only validate settings if not deciding later
        if (!selectedCourse?.teePosition) newErrors.course = 'Please select tee position';
        if (!selectedCourse?.pins) newErrors.course = 'Please select pins';
        if (!selectedCourse?.putting) newErrors.course = 'Please select putting';
        if (!selectedCourse?.wind) newErrors.course = 'Please select wind';
        if (!selectedCourse?.fairwayFirmness) newErrors.course = 'Please select fairway firmness';
        if (!selectedCourse?.greenFirmness) newErrors.course = 'Please select green firmness';
        if (!selectedCourse?.attempts) newErrors.course = 'Please select attempts';
        if (!selectedCourse?.scoringType) newErrors.course = 'Please select scoring format';
      }
    }
    
    if (step === 3) {
      const { creatorStake } = calculateStakes();
      if (wagerAmount < 10) {
        newErrors.wager = 'Minimum wager is 10 CC';
      } else if (wagerAmount > 10000) {
        newErrors.wager = 'Maximum wager is 10,000 CC';
      } else if (creatorStake > ccBalance) {
        newErrors.wager = `Insufficient balance. You need ${creatorStake} CC for your stake`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handleCreateChallenge = async () => {
    if (!validateStep()) return;
    
    setLoading(true);
    try {
      // Build the request payload based on whether TrackMan settings are included
      const payload: any = {
        acceptorId: selectedOpponent?.id,
        courseName: selectedCourse?.courseName,
        wagerAmount,
        expiryDays,
        creatorNote
      };

      // Only include courseId and trackman settings if not deciding later
      if (selectedCourse?.courseName !== 'DECIDE_LATER') {
        payload.courseId = selectedCourse?.id || selectedCourse?.courseName; // Use courseName as courseId if no id
        payload.trackmanSettings = {
          courseName: selectedCourse?.courseName,
          teePosition: selectedCourse?.teePosition,
          pins: selectedCourse?.pins,
          putting: selectedCourse?.putting,
          wind: selectedCourse?.wind,
          fairwayFirmness: selectedCourse?.fairwayFirmness,
          greenFirmness: selectedCourse?.greenFirmness,
          attempts: selectedCourse?.attempts,
          scoringType: selectedCourse?.scoringType
        };
      } else {
        // For decide later, pass minimal trackman settings
        payload.trackmanSettings = {
          decideLater: true
        };
      }

      const response = await axios.post(
        `${API_URL}/api/challenges`,
        payload,
        { headers: { Authorization: `Bearer ${user?.token}` }}
      );

      if (response.data.success) {
        router.push('/customer/challenges');
      }
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error || 'Failed to create challenge' });
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = Array.isArray(friends) 
    ? friends.filter(friend => {
        const friendName = friend.name || friend.friend_name || '';
        const friendEmail = friend.email || friend.friend_email || '';
        return friendName.toLowerCase().includes(searchQuery.toLowerCase()) ||
               friendEmail.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : [];

  const { creatorStake, acceptorStake, totalPot } = calculateStakes();

  return (
    <>
      <Head>
        <title>Create Challenge - Clubhouse Golf</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>

      <div className="min-h-screen bg-[#fafafa] customer-app">
        <CustomerNavigation />
        
        <main className="pb-20 lg:pb-8 pt-14">
          {/* Header */}
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => step > 1 ? setStep(step - 1) : router.push('/customer/compete')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-gray-900">Create Challenge</h1>
                  <p className="text-sm text-gray-500">Step {step} of 4</p>
                </div>
                <div className="text-sm text-gray-600">
                  Balance: <span className="font-bold text-[#0B3D3A]">{ccBalance} CC</span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-4 flex gap-2">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`flex-1 h-1 rounded-full ${
                      s <= step ? 'bg-[#0B3D3A]' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="max-w-3xl mx-auto px-4 py-6">
            {/* Step 1: Select Opponent */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-[#0B3D3A]" />
                    Select Opponent
                  </h2>
                  
                  {/* Search */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search friends..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                    />
                  </div>

                  {/* Selected opponent preview */}
                  {selectedOpponent && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-green-800 font-medium">Selected Opponent</p>
                          <p className="text-lg font-semibold text-gray-900">{selectedOpponent.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              getRankColor(selectedOpponent.rank || selectedOpponent.rank_tier || 'house')
                            }`}>
                              {(selectedOpponent.rank || selectedOpponent.rank_tier || 'House').toUpperCase()}
                            </span>
                            {(selectedOpponent.hasChampionMarker || selectedOpponent.has_champion_marker) && (
                              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedOpponent(null)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Friends list */}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredFriends.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        No friends found. Add friends to challenge them.
                      </p>
                    ) : (
                      filteredFriends.map((friend) => (
                        <button
                          key={friend.id || friend.user_id || friend.friendship_id}
                          onClick={() => setSelectedOpponent({
                            id: friend.user_id || friend.id,
                            name: friend.name || friend.friend_name,
                            email: friend.email || friend.friend_email,
                            rank: friend.rank_tier || friend.rank || 'House',
                            ccBalance: friend.cc_balance || friend.ccBalance || 0
                          })}
                          className={`w-full p-3 rounded-lg border text-left transition-colors ${
                            selectedOpponent?.id === (friend.user_id || friend.id)
                              ? 'border-[#0B3D3A] bg-[#0B3D3A]/5'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{friend.name || friend.friend_name}</p>
                                {(friend.hasChampionMarker || friend.has_champion_marker) && (
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{friend.email || friend.friend_email}</p>
                            </div>
                            {(friend.rank_tier || friend.rank) && (
                              <span className="text-xs font-medium text-gray-600 uppercase">
                                {friend.rank_tier || friend.rank}
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {errors.opponent && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.opponent}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  disabled={!selectedOpponent}
                  className="w-full bg-[#0B3D3A] text-white py-3 rounded-lg font-medium hover:bg-[#084a45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 2: Select Course */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#0B3D3A]" />
                    Select Course & Settings
                  </h2>

                  {/* Skip Settings Option */}
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setSelectedCourse({ courseName: 'DECIDE_LATER' } as any)}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        selectedCourse?.courseName === 'DECIDE_LATER'
                          ? 'border-[#0B3D3A] bg-[#0B3D3A]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-medium text-gray-900 mb-1">
                          Skip Course & Settings Selection
                        </div>
                        <div className="text-sm text-gray-500">
                          Decide on the course and settings outside of the challenge
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="relative mb-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-3 bg-white text-gray-500">OR</span>
                    </div>
                  </div>

                  {/* Course Selection */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Course with TrackMan Settings
                    </label>
                    <select
                      value={selectedCourse?.courseName === 'DECIDE_LATER' ? '' : (selectedCourse?.courseName || '')}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedCourse(prev => ({ ...prev, courseName: e.target.value } as any));
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                    >
                      <option value="">Please Select a Course</option>
                      <option value="Casa De Campo">Casa De Campo</option>
                      <option value="Lofoten Links">Lofoten Links</option>
                      <option value="Marco Simone">Marco Simone</option>
                      <option value="Moonlight Basin">Moonlight Basin</option>
                      <option value="Muirfield Village G.C.">Muirfield Village G.C.</option>
                      <option value="Pebble Beach">Pebble Beach (requires Course Pack)</option>
                      <option value="Pinehurst No. 2">Pinehurst No. 2</option>
                      <option value="Royal County Down">Royal County Down</option>
                      <option value="Royal Melbourne">Royal Melbourne</option>
                      <option value="Spanish Bay">Spanish Bay (requires Course Pack)</option>
                      <option value="Spyglass Hill">Spyglass Hill (requires Course Pack)</option>
                      <option value="St. Andrews – Old Course">St. Andrews – Old Course</option>
                      <option value="Valderrama">Valderrama</option>
                      <option value="Wentworth">Wentworth</option>
                      <option value="Liberty National">Liberty National</option>
                    </select>
                  </div>

                  {/* TrackMan Settings Grid - Only show if not deciding later and a course is selected */}
                  {selectedCourse?.courseName && selectedCourse?.courseName !== 'DECIDE_LATER' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Tee Position */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tee Position *
                      </label>
                      <select
                        value={selectedCourse?.teePosition || ''}
                        onChange={(e) => setSelectedCourse(prev => ({ ...prev, teePosition: e.target.value } as any))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      >
                        <option value="">Please Select</option>
                        <option value="Pro">Pro (Black)</option>
                        <option value="Championship">Championship (Blue)</option>
                        <option value="Men">Men (White)</option>
                        <option value="Women">Women (Red)</option>
                        <option value="Junior">Junior (Green)</option>
                      </select>
                    </div>

                    {/* Pins */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pins *
                      </label>
                      <select
                        value={selectedCourse?.pins || ''}
                        onChange={(e) => setSelectedCourse(prev => ({ ...prev, pins: e.target.value } as any))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      >
                        <option value="">Please Select</option>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>

                    {/* Putting */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Putting *
                      </label>
                      <select
                        value={selectedCourse?.putting || ''}
                        onChange={(e) => setSelectedCourse(prev => ({ ...prev, putting: e.target.value } as any))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      >
                        <option value="">Please Select</option>
                        <option value="Auto">Auto</option>
                        <option value="Gimme 4">Gimme 4</option>
                        <option value="Gimme 8">Gimme 8</option>
                        <option value="Gimme 12">Gimme 12</option>
                        <option value="Gimme 16">Gimme 16</option>
                        <option value="Gimme 20">Gimme 20</option>
                      </select>
                    </div>

                    {/* Wind */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Wind *
                      </label>
                      <select
                        value={selectedCourse?.wind || ''}
                        onChange={(e) => setSelectedCourse(prev => ({ ...prev, wind: e.target.value } as any))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      >
                        <option value="">Please Select</option>
                        <option value="None">None</option>
                        <option value="Light">Light (0-5 mph)</option>
                        <option value="Medium">Medium (5-15 mph)</option>
                        <option value="Heavy">Heavy (15-25 mph)</option>
                        <option value="Random">Random</option>
                      </select>
                    </div>

                    {/* Fairway Firmness */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fairway Firmness *
                      </label>
                      <select
                        value={selectedCourse?.fairwayFirmness || ''}
                        onChange={(e) => setSelectedCourse(prev => ({ ...prev, fairwayFirmness: e.target.value } as any))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      >
                        <option value="">Please Select</option>
                        <option value="Soft">Soft</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>

                    {/* Green Firmness */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Green Firmness *
                      </label>
                      <select
                        value={selectedCourse?.greenFirmness || ''}
                        onChange={(e) => setSelectedCourse(prev => ({ ...prev, greenFirmness: e.target.value } as any))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      >
                        <option value="">Please Select</option>
                        <option value="Soft">Soft</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>

                    {/* Attempts */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        How Many Attempts? *
                      </label>
                      <select
                        value={selectedCourse?.attempts || ''}
                        onChange={(e) => setSelectedCourse(prev => ({ ...prev, attempts: e.target.value } as any))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      >
                        <option value="">Please Select</option>
                        <option value="1">1 Attempt</option>
                        <option value="2">2 Attempts</option>
                        <option value="3">3 Attempts</option>
                        <option value="4">4 Attempts</option>
                        <option value="5">5 Attempts</option>
                        <option value="10">10 Attempts</option>
                        <option value="Unlimited">Unlimited</option>
                      </select>
                    </div>

                    {/* Scoring Format */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Scoring Format *
                      </label>
                      <select
                        value={selectedCourse?.scoringType || ''}
                        onChange={(e) => setSelectedCourse(prev => ({ ...prev, scoringType: e.target.value } as any))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      >
                        <option value="">Please Select</option>
                        <option value="Stroke Play">Stroke Play</option>
                        <option value="Match Play">Match Play</option>
                        <option value="Stableford">Stableford</option>
                        <option value="Skins">Skins</option>
                      </select>
                    </div>
                  </div>
                  )}

                  {/* Info message when "Decide outside" is selected */}
                  {selectedCourse?.courseName === 'DECIDE_LATER' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <p className="text-sm text-blue-800">
                        Course and settings will be decided outside of the challenge. Both players should agree on the terms before playing.
                      </p>
                    </div>
                  )}

                  {errors.course && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.course}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  disabled={!selectedCourse?.courseName || 
                           (selectedCourse?.courseName !== 'DECIDE_LATER' && 
                            (!selectedCourse?.teePosition || !selectedCourse?.pins || 
                             !selectedCourse?.putting || !selectedCourse?.wind || !selectedCourse?.fairwayFirmness || 
                             !selectedCourse?.greenFirmness || !selectedCourse?.attempts || !selectedCourse?.scoringType))}
                  className="w-full bg-[#0B3D3A] text-white py-3 rounded-lg font-medium hover:bg-[#084a45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 3: Set Wager */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-[#0B3D3A]" />
                    Set Wager & Expiry
                  </h2>

                  {/* Wager Amount */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Wager Amount (CC)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="10"
                        max="10000"
                        value={wagerAmount}
                        onChange={(e) => setWagerAmount(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Min: 10 CC • Max: 10,000 CC</p>
                  </div>

                  {/* Quick select buttons */}
                  <div className="grid grid-cols-4 gap-2 mb-6">
                    {[50, 100, 250, 500].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setWagerAmount(amount)}
                        className="py-2 px-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium"
                      >
                        {amount} CC
                      </button>
                    ))}
                  </div>

                  {/* Stake Breakdown */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Stake Breakdown</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Your stake (50%)</span>
                        <span className="font-medium">{creatorStake} CC</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Opponent stake (50%)</span>
                        <span className="font-medium">{acceptorStake} CC</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200 flex justify-between">
                        <span className="font-medium">Total Pot</span>
                        <span className="font-bold text-[#0B3D3A]">{totalPot} CC</span>
                      </div>
                    </div>
                    
                    {/* Balance check */}
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Your balance</span>
                        <span className={`font-medium ${creatorStake > ccBalance ? 'text-red-600' : 'text-gray-900'}`}>
                          {ccBalance.toLocaleString()} CC
                        </span>
                      </div>
                      {creatorStake > ccBalance && (
                        <p className="text-xs text-red-600 mt-2">
                          ⚠️ Insufficient balance for this wager
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Expiry Days */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Challenge Expiry
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[7, 14, 30].map((days) => (
                        <button
                          key={days}
                          onClick={() => setExpiryDays(days as 7 | 14 | 30)}
                          className={`py-2 px-3 border rounded-lg font-medium transition-colors ${
                            expiryDays === days
                              ? 'border-[#0B3D3A] bg-[#0B3D3A] text-white'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {days} days
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Optional Note */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message (optional)
                    </label>
                    <textarea
                      value={creatorNote}
                      onChange={(e) => setCreatorNote(e.target.value)}
                      placeholder="Add a message for your opponent..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B3D3A]/20"
                      rows={3}
                    />
                  </div>

                  {errors.wager && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.wager}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  className="w-full bg-[#0B3D3A] text-white py-3 rounded-lg font-medium hover:bg-[#084a45] transition-colors"
                >
                  Review Challenge
                </button>
              </div>
            )}

            {/* Step 4: Review & Confirm */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#0B3D3A]" />
                    Review Challenge
                  </h2>

                  <div className="space-y-4">
                    {/* Opponent with more details */}
                    <div className="py-3 border-b border-gray-100">
                      <div className="flex justify-between items-start">
                        <span className="text-gray-600">Opponent</span>
                        <div className="text-right">
                          <span className="font-medium block">{selectedOpponent?.name}</span>
                          {selectedOpponent && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                getRankColor(selectedOpponent.rank || selectedOpponent.rank_tier || 'house')
                              }`}>
                                {(selectedOpponent.rank || selectedOpponent.rank_tier || 'House').toUpperCase()}
                              </span>
                              {(selectedOpponent.hasChampionMarker || selectedOpponent.has_champion_marker) && (
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Course */}
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Course</span>
                      <span className="font-medium">
                        {selectedCourse?.courseName === 'DECIDE_LATER' 
                          ? 'Decide outside of challenge' 
                          : selectedCourse?.courseName}
                      </span>
                    </div>

                    {/* Settings Summary - Only show if not deciding later */}
                    {selectedCourse?.courseName !== 'DECIDE_LATER' && (
                    <div className="py-3 border-b border-gray-100">
                      <span className="text-gray-600 block mb-2">Settings</span>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Tee:</span>
                          <span className="font-medium">{selectedCourse?.teePosition}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Pins:</span>
                          <span className="font-medium">{selectedCourse?.pins}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Putting:</span>
                          <span className="font-medium">{selectedCourse?.putting}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Wind:</span>
                          <span className="font-medium">{selectedCourse?.wind}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Fairway:</span>
                          <span className="font-medium">{selectedCourse?.fairwayFirmness}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Greens:</span>
                          <span className="font-medium">{selectedCourse?.greenFirmness}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Attempts:</span>
                          <span className="font-medium">{selectedCourse?.attempts}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Format:</span>
                          <span className="font-medium">{selectedCourse?.scoringType}</span>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Wager */}
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Your Stake</span>
                      <span className="font-medium">{creatorStake} CC</span>
                    </div>

                    {/* Total Pot */}
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Total Pot</span>
                      <span className="font-bold text-[#0B3D3A]">{totalPot} CC</span>
                    </div>

                    {/* Expiry */}
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Expires In</span>
                      <span className="font-medium">{expiryDays} days</span>
                    </div>

                    {creatorNote && (
                      <div className="pt-3">
                        <p className="text-sm text-gray-600 mb-1">Your message:</p>
                        <p className="text-gray-900 italic">"{creatorNote}"</p>
                      </div>
                    )}
                  </div>

                  {errors.submit && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.submit}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Your stake of {creatorStake} CC will be locked when your opponent accepts.
                    You'll have {expiryDays} days to complete your round.
                  </p>
                </div>

                <button
                  onClick={handleCreateChallenge}
                  disabled={loading}
                  className="w-full bg-[#0B3D3A] text-white py-3 rounded-lg font-medium hover:bg-[#084a45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Send Challenge'}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}