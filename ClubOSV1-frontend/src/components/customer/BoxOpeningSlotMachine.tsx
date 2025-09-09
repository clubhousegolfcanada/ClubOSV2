import React, { useState, useEffect, useRef } from 'react';
import { 
  Coins, 
  Clock, 
  Percent, 
  Users, 
  Trophy,
  Sparkles,
  X
} from 'lucide-react';
import logger from '@/services/logger';

interface BoxReward {
  id: string;
  rewardType: string;
  rewardName: string;
  rewardValue: any;
  voucherCode?: string;
  expiresAt?: Date;
}

interface BoxOpeningSlotMachineProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => Promise<BoxReward>;
  boxId?: string;
}

// Define possible reward items for the slot machine
const slotItems = [
  { 
    icon: Coins, 
    label: '100 CC', 
    type: 'club_coins',
    value: 100,
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  { 
    icon: Coins, 
    label: '250 CC', 
    type: 'club_coins',
    value: 250,
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  { 
    icon: Clock, 
    label: 'Free Hour', 
    type: 'free_hour',
    value: 1,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  { 
    icon: Percent, 
    label: '20% Off', 
    type: 'discount',
    value: 20,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  },
  { 
    icon: Coins, 
    label: '500 CC', 
    type: 'club_coins',
    value: 500,
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  { 
    icon: Users, 
    label: 'Friend Pass', 
    type: 'friend_pass',
    value: 1,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50'
  },
  { 
    icon: Trophy, 
    label: '10,000 CC', 
    type: 'mega_jackpot',
    value: 10000,
    color: 'text-yellow-600',
    bgColor: 'bg-gradient-to-br from-yellow-50 to-amber-50',
    special: true
  }
];

export const BoxOpeningSlotMachine: React.FC<BoxOpeningSlotMachineProps> = ({
  isOpen,
  onClose,
  onOpen,
  boxId
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinComplete, setSpinComplete] = useState(false);
  const [selectedReward, setSelectedReward] = useState<BoxReward | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reelPositions, setReelPositions] = useState([0, 0, 0]);
  const [finalIndexes, setFinalIndexes] = useState([0, 0, 0]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsSpinning(false);
      setSpinComplete(false);
      setSelectedReward(null);
      setError(null);
      setReelPositions([0, 0, 0]);
      setFinalIndexes([0, 0, 0]);
    }
  }, [isOpen]);

  const handleSpin = async () => {
    if (isSpinning) return;
    
    setIsSpinning(true);
    setError(null);
    
    try {
      // Start spinning animation
      const spinDuration = 3000; // 3 seconds
      const spinSpeed = 50; // Update every 50ms
      const totalSpins = spinDuration / spinSpeed;
      
      // Animate reels spinning
      let currentSpin = 0;
      const spinInterval = setInterval(() => {
        currentSpin++;
        
        // Different speeds for each reel for realistic effect
        setReelPositions([
          (currentSpin * 8) % slotItems.length,
          (currentSpin * 6) % slotItems.length,
          (currentSpin * 4) % slotItems.length
        ]);
        
        if (currentSpin >= totalSpins) {
          clearInterval(spinInterval);
        }
      }, spinSpeed);
      
      // Call API to get actual reward
      const reward = await onOpen();
      setSelectedReward(reward);
      
      // Map reward to slot item
      let targetIndex = 0;
      if (reward.rewardType === 'club_coins') {
        const ccAmount = reward.rewardValue?.amount || 0;
        if (ccAmount >= 10000) {
          targetIndex = slotItems.findIndex(item => item.value === 10000);
        } else if (ccAmount >= 500) {
          targetIndex = slotItems.findIndex(item => item.value === 500 && item.type === 'club_coins');
        } else if (ccAmount >= 250) {
          targetIndex = slotItems.findIndex(item => item.value === 250 && item.type === 'club_coins');
        } else {
          targetIndex = slotItems.findIndex(item => item.value === 100 && item.type === 'club_coins');
        }
      } else if (reward.rewardType === 'free_hour') {
        targetIndex = slotItems.findIndex(item => item.type === 'free_hour');
      } else if (reward.rewardType === 'discount') {
        targetIndex = slotItems.findIndex(item => item.type === 'discount');
      } else if (reward.rewardType === 'friend_pass') {
        targetIndex = slotItems.findIndex(item => item.type === 'friend_pass');
      }
      
      // Wait for spinning animation to nearly complete
      await new Promise(resolve => setTimeout(resolve, spinDuration - 500));
      
      // Stop at the winning position
      clearInterval(spinInterval);
      setFinalIndexes([targetIndex, targetIndex, targetIndex]);
      setReelPositions([targetIndex, targetIndex, targetIndex]);
      setIsSpinning(false);
      setSpinComplete(true);
      
      // Play win sound if it's a mega jackpot
      if (reward.rewardValue?.amount >= 10000) {
        // Could add sound effect here
      }
    } catch (err) {
      setError('Failed to open box. Please try again.');
      setIsSpinning(false);
      logger.error('Error opening box:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full relative overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--accent)] to-[#156963] p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Open Your Box</h2>
              <p className="text-white/80 text-sm mt-1">Spin to reveal your reward!</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slot Machine */}
        <div className="p-8">
          <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl p-6 shadow-2xl">
            {/* Slot Window */}
            <div className="bg-black rounded-lg p-4 shadow-inner">
              <div className="flex justify-center items-center space-x-2">
                {/* Three Reels */}
                {[0, 1, 2].map((reelIndex) => (
                  <div key={reelIndex} className="relative w-24 h-32 overflow-hidden bg-white rounded-lg">
                    <div 
                      className={`absolute inset-0 flex flex-col items-center justify-center transition-all ${
                        isSpinning ? 'animate-spin' : ''
                      }`}
                      style={{
                        transform: spinComplete 
                          ? 'translateY(0)' 
                          : `translateY(-${reelPositions[reelIndex] * 100}%)`
                      }}
                    >
                      {/* Display current item */}
                      {(() => {
                        const item = slotItems[spinComplete ? finalIndexes[reelIndex] : reelPositions[reelIndex]];
                        const Icon = item.icon;
                        return (
                          <div className={`p-4 rounded-lg ${item.bgColor} ${item.special ? 'animate-pulse' : ''}`}>
                            <Icon className={`w-12 h-12 ${item.color}`} />
                            <p className={`text-xs font-bold mt-2 text-center ${item.color}`}>
                              {item.label}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                    
                    {/* Winning line indicator */}
                    {spinComplete && (
                      <div className="absolute inset-x-0 top-1/2 h-1 bg-yellow-400 animate-pulse -translate-y-1/2" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Spin Button */}
            <button
              onClick={handleSpin}
              disabled={isSpinning || spinComplete}
              className={`w-full mt-6 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
                isSpinning 
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : spinComplete
                  ? 'bg-green-600 text-white'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 transform hover:scale-105'
              }`}
            >
              {isSpinning ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Spinning...
                </span>
              ) : spinComplete ? (
                'Winner!'
              ) : (
                'SPIN TO OPEN'
              )}
            </button>
          </div>

          {/* Reward Display */}
          {spinComplete && selectedReward && (
            <div className="mt-6 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg p-6 border-2 border-amber-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Congratulations!</h3>
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">You won:</p>
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {selectedReward.rewardName}
                  </p>
                </div>
                
                {selectedReward.voucherCode && (
                  <div className="bg-white rounded-lg p-3 border border-amber-200">
                    <p className="text-xs text-gray-600 mb-1">Voucher Code:</p>
                    <p className="font-mono font-bold text-lg text-[var(--accent)]">
                      {selectedReward.voucherCode}
                    </p>
                  </div>
                )}
                
                {selectedReward.expiresAt && (
                  <p className="text-xs text-gray-500">
                    Expires: {new Date(selectedReward.expiresAt).toLocaleDateString()}
                  </p>
                )}
                
                {selectedReward.rewardType === 'club_coins' && (
                  <p className="text-sm text-green-600 font-medium">
                    ✓ Club Coins have been added to your account
                  </p>
                )}
              </div>
              
              <button
                onClick={onClose}
                className="w-full mt-4 py-2 px-4 bg-[var(--accent)] text-white rounded-lg hover:bg-[#0a312f] transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};