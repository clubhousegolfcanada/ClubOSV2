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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Friend {
  id: string;
  name: string;
  email: string;
  rank?: string;
  ccBalance?: number;
  hasChampionMarker?: boolean;
}

interface CourseSettings {
  id: string;
  name: string;
  category: string;
  courseName: string;
  holes: number;
  scoringType: string;
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
    }
  }, [user, router]);

  const fetchFriends = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/friends`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (response.data.success) {
        setFriends(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  const fetchCourseSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/trackman/settings-catalog`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      if (response.data.success) {
        setCourseSettings(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
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
    const creatorStake = Math.round(wagerAmount * 0.30 * 100) / 100;
    const acceptorStake = Math.round(wagerAmount * 0.70 * 100) / 100;
    const totalPot = creatorStake + acceptorStake;
    return { creatorStake, acceptorStake, totalPot };
  };

  const validateStep = () => {
    const newErrors: any = {};
    
    if (step === 1 && !selectedOpponent) {
      newErrors.opponent = 'Please select an opponent';
    }
    
    if (step === 2 && !selectedCourse) {
      newErrors.course = 'Please select course settings';
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
      const response = await axios.post(
        `${API_URL}/api/challenges`,
        {
          acceptorId: selectedOpponent?.id,
          courseId: selectedCourse?.id,
          courseName: selectedCourse?.courseName,
          settingsCatalogId: selectedCourse?.id,
          wagerAmount,
          expiryDays,
          creatorNote,
          trackmanSettings: {
            holes: selectedCourse?.holes,
            scoringType: selectedCourse?.scoringType,
            category: selectedCourse?.category
          }
        },
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

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { creatorStake, acceptorStake, totalPot } = calculateStakes();

  return (
    <>
      <Head>
        <title>Create Challenge - Clubhouse 24/7</title>
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
                  onClick={() => step > 1 ? setStep(step - 1) : router.push('/customer/challenges')}
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

                  {/* Friends list */}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredFriends.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        No friends found. Add friends to challenge them.
                      </p>
                    ) : (
                      filteredFriends.map((friend) => (
                        <button
                          key={friend.id}
                          onClick={() => setSelectedOpponent(friend)}
                          className={`w-full p-3 rounded-lg border text-left transition-colors ${
                            selectedOpponent?.id === friend.id
                              ? 'border-[#0B3D3A] bg-[#0B3D3A]/5'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{friend.name}</p>
                                {friend.hasChampionMarker && (
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{friend.email}</p>
                            </div>
                            {friend.rank && (
                              <span className="text-xs font-medium text-gray-600 uppercase">
                                {friend.rank}
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

                  <div className="space-y-2">
                    {courseSettings.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        No course settings available
                      </p>
                    ) : (
                      courseSettings.map((course) => (
                        <button
                          key={course.id}
                          onClick={() => setSelectedCourse(course)}
                          className={`w-full p-4 rounded-lg border text-left transition-colors ${
                            selectedCourse?.id === course.id
                              ? 'border-[#0B3D3A] bg-[#0B3D3A]/5'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{course.name}</p>
                              <p className="text-sm text-gray-500">
                                {course.courseName} • {course.holes} holes • {course.scoringType}
                              </p>
                            </div>
                            <span className="text-xs font-medium text-gray-600 uppercase bg-gray-100 px-2 py-1 rounded">
                              {course.category}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {errors.course && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.course}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  disabled={!selectedCourse}
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
                        <span className="text-gray-600">Your stake (30%)</span>
                        <span className="font-medium">{creatorStake} CC</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Opponent stake (70%)</span>
                        <span className="font-medium">{acceptorStake} CC</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200 flex justify-between">
                        <span className="font-medium">Total Pot</span>
                        <span className="font-bold text-[#0B3D3A]">{totalPot} CC</span>
                      </div>
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
                    {/* Opponent */}
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Opponent</span>
                      <span className="font-medium">{selectedOpponent?.name}</span>
                    </div>

                    {/* Course */}
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Course</span>
                      <span className="font-medium">{selectedCourse?.courseName}</span>
                    </div>

                    {/* Settings */}
                    <div className="flex justify-between py-3 border-b border-gray-100">
                      <span className="text-gray-600">Settings</span>
                      <span className="font-medium">
                        {selectedCourse?.holes} holes • {selectedCourse?.scoringType}
                      </span>
                    </div>

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