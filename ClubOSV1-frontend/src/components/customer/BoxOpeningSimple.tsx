import React, { useState, useEffect, useRef } from 'react';
import { 
  Coins, 
  X,
  Calendar,
  Gift,
  Trophy,
  Shirt,
  Package
} from 'lucide-react';

interface BoxReward {
  id: string;
  rewardType: string;
  rewardName: string;
  rewardValue: any;
  voucherCode?: string;
  expiresAt?: Date;
}

interface BoxOpeningSimpleProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => Promise<BoxReward>;
  boxId?: string;
}

// Define reward items based on actual database distribution
const rewardItems = [
  { 
    icon: Calendar, 
    label: 'Free Hour',
    type: 'free_hour',
    value: 1,
    color: 'from-emerald-800 to-emerald-700',
    probability: 30
  },
  { 
    icon: Coins, 
    label: '25 CC',
    type: 'club_coins',
    value: 25,
    color: 'from-zinc-700 to-zinc-600',
    probability: 18
  },
  { 
    icon: Coins, 
    label: '50 CC',
    type: 'club_coins',
    value: 50,
    color: 'from-zinc-700 to-zinc-600',
    probability: 15
  },
  { 
    icon: Coins, 
    label: '75 CC',
    type: 'club_coins',
    value: 75,
    color: 'from-zinc-700 to-zinc-600',
    probability: 12
  },
  { 
    icon: Coins, 
    label: '100 CC',
    type: 'club_coins',
    value: 100,
    color: 'from-emerald-800 to-emerald-700',
    probability: 10
  },
  { 
    icon: Coins, 
    label: '150 CC',
    type: 'club_coins',
    value: 150,
    color: 'from-emerald-800 to-emerald-700',
    probability: 8
  },
  { 
    icon: Coins, 
    label: '200 CC',
    type: 'club_coins',
    value: 200,
    color: 'from-slate-800 to-slate-700',
    probability: 6
  },
  { 
    icon: Coins, 
    label: '250 CC',
    type: 'club_coins',
    value: 250,
    color: 'from-slate-800 to-slate-700',
    probability: 4
  },
  { 
    icon: Coins, 
    label: '300 CC',
    type: 'club_coins',
    value: 300,
    color: 'from-slate-800 to-slate-700',
    probability: 3
  },
  { 
    icon: Coins, 
    label: '400 CC',
    type: 'club_coins',
    value: 400,
    color: 'from-slate-900 to-slate-800',
    probability: 2
  },
  { 
    icon: Coins, 
    label: '500 CC',
    type: 'club_coins',
    value: 500,
    color: 'from-slate-900 to-slate-800',
    probability: 1.5
  },
  { 
    icon: Shirt, 
    label: 'Merch',
    type: 'merch',
    value: 1,
    color: 'from-slate-900 to-slate-800',
    probability: 2
  },
  { 
    icon: Trophy, 
    label: '10,000 CC',
    type: 'mega_jackpot',
    value: 10000,
    color: 'from-amber-600 via-amber-500 to-yellow-500',
    probability: 0.5
  }
];

export const BoxOpeningSimple: React.FC<BoxOpeningSimpleProps> = ({
  isOpen,
  onClose,
  onOpen,
  boxId
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedReward, setSelectedReward] = useState<BoxReward | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const speedRef = useRef(50); // Start fast (50ms per item)

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsSpinning(false);
      setCurrentIndex(0);
      setSelectedReward(null);
      setShowResult(false);
      setError(null);
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    }
  }, [isOpen]);

  const handleOpenBox = async () => {
    if (isSpinning || showResult) return;
    
    setIsSpinning(true);
    setError(null);
    
    try {
      // Start with a random item (not the winner) to avoid spoiling
      const randomStartIndex = Math.floor(Math.random() * rewardItems.length);
      setCurrentIndex(randomStartIndex);
      
      // Start the cycling animation immediately
      let cycles = 0;
      const totalCycles = 30; // Total number of items to cycle through
      let currentSpeed = 50; // Start fast
      
      // Get the actual reward from the API
      const reward = await onOpen();
      setSelectedReward(reward);
      
      // Find which item matches the reward
      let targetIndex = 0;
      if (reward.rewardType === 'club_coins') {
        const ccAmount = reward.rewardValue?.amount || 0;
        targetIndex = rewardItems.findIndex(item => 
          item.type === 'club_coins' && item.value === ccAmount
        );
        if (targetIndex === -1) {
          // Find closest match if exact amount not found
          let closestDiff = Infinity;
          let closestIndex = 0;
          
          rewardItems.forEach((item, index) => {
            if (item.type === 'club_coins') {
              const diff = Math.abs(item.value - ccAmount);
              if (diff < closestDiff) {
                closestDiff = diff;
                closestIndex = index;
              }
            }
          });
          
          targetIndex = closestIndex;
        }
      } else if (reward.rewardType === 'free_hour') {
        targetIndex = rewardItems.findIndex(item => item.type === 'free_hour');
      } else if (reward.rewardType === 'merch') {
        targetIndex = rewardItems.findIndex(item => item.type === 'merch');
      }
      
      
      const animateCycle = () => {
        if (cycles < totalCycles) {
          // Cycle to next item
          setCurrentIndex(prev => (prev + 1) % rewardItems.length);
          cycles++;
          
          // Gradually slow down
          if (cycles > 20) {
            currentSpeed += 30; // Slow down more dramatically near the end
          } else if (cycles > 10) {
            currentSpeed += 10; // Start slowing down
          }
          
          animationRef.current = setTimeout(animateCycle, currentSpeed) as any;
        } else {
          // Animation complete - show the winning item
          setCurrentIndex(targetIndex);
          setIsSpinning(false);
          setShowResult(true);
          
          // Subtle celebration effect handled by CSS animation on result display
        }
      };
      
      // Start the animation
      animateCycle();
      
    } catch (err) {
      setError('Failed to open box. Please try again.');
      setIsSpinning(false);
      console.error('Error opening box:', err);
    }
  };

  if (!isOpen) return null;

  const currentItem = (isSpinning || showResult) ? rewardItems[currentIndex] : null;
  const Icon = currentItem?.icon || Package;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 box-simple-container">
      <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-lg max-w-md w-full relative overflow-hidden border border-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="relative p-6 border-b border-zinc-800">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/20 to-emerald-800/20" />
          <div className="relative flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-white tracking-wide">REWARD BOX</h2>
              <p className="text-zinc-400 text-xs mt-1 uppercase tracking-wider">
                {!isSpinning && !showResult ? 'Tap to reveal' : 
                 isSpinning ? 'Processing...' : 
                 'Success'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white dark:bg-gray-900/5 rounded transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Display Area */}
        <div className="p-12">
          <div className="flex justify-center items-center">
            {!currentItem ? (
              // Mystery box state - before opening
              <div className="relative">
                <div className="w-32 h-32 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 
                              flex items-center justify-center border border-zinc-700 shadow-2xl">
                  <Package className="w-16 h-16 text-zinc-500" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-900/20 to-emerald-800/20 rounded-lg blur-xl" />
              </div>
            ) : (
              // Spinning/Result state
              <div className="relative">
                <div 
                  className={`
                    w-32 h-32 rounded-lg bg-gradient-to-br ${currentItem.color}
                    flex flex-col items-center justify-center transition-all duration-100
                    border ${showResult ? 'border-emerald-500/50 scale-110' : 
                      isSpinning ? 'border-zinc-700 scale-105' : 'border-zinc-700'}
                  `}
                >
                  <Icon className="w-12 h-12 text-white/90 mb-1" />
                  <span className="text-white/90 font-medium text-sm">{currentItem.label}</span>
                </div>
                {showResult && (
                  <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500/30 to-emerald-600/30 rounded-lg blur-2xl animate-pulse" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action/Result Section */}
        <div className="p-6 border-t border-zinc-800">
          {!showResult ? (
            <button
              onClick={handleOpenBox}
              disabled={isSpinning}
              className={`w-full py-3 px-6 rounded font-semibold text-sm tracking-wider transition-all uppercase ${
                isSpinning
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-800 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-600 shadow-lg'
              }`}
            >
              {isSpinning ? 'Processing' : 'Open'}
            </button>
          ) : (
            <div className="space-y-4">
              {/* Reward Display */}
              {selectedReward && (
                <div className="bg-zinc-900/50 rounded border border-zinc-800 p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Reward Claimed</h3>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-2xl font-semibold text-white">
                        {selectedReward.rewardName}
                      </p>
                    </div>
                    
                    {selectedReward.voucherCode && (
                      <div className="bg-zinc-800/50 rounded p-3 border border-zinc-700">
                        <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Code</p>
                        <p className="font-mono font-medium text-emerald-400">
                          {selectedReward.voucherCode}
                        </p>
                      </div>
                    )}
                    
                    {selectedReward.expiresAt && (
                      <p className="text-xs text-zinc-500">
                        Valid until {new Date(selectedReward.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                    
                    {selectedReward.rewardType === 'club_coins' && (
                      <p className="text-xs text-emerald-400 font-medium">
                        Balance updated
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              <button
                onClick={onClose}
                className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-medium text-sm transition-colors uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 bg-red-900/20 border border-red-900/30 rounded p-3">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};