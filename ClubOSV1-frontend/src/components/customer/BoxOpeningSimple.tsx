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
import logger from '@/services/logger';

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
    color: 'from-[var(--accent)] to-[#084a45]',
    probability: 30
  },
  { 
    icon: Coins, 
    label: '25 CC',
    type: 'club_coins',
    value: 25,
    color: 'from-gray-600 to-gray-500',
    probability: 18
  },
  { 
    icon: Coins, 
    label: '50 CC',
    type: 'club_coins',
    value: 50,
    color: 'from-gray-600 to-gray-500',
    probability: 15
  },
  { 
    icon: Coins, 
    label: '75 CC',
    type: 'club_coins',
    value: 75,
    color: 'from-gray-600 to-gray-500',
    probability: 12
  },
  { 
    icon: Coins, 
    label: '100 CC',
    type: 'club_coins',
    value: 100,
    color: 'from-[var(--accent)] to-[#084a45]',
    probability: 10
  },
  { 
    icon: Coins, 
    label: '150 CC',
    type: 'club_coins',
    value: 150,
    color: 'from-[var(--accent)] to-[#084a45]',
    probability: 8
  },
  { 
    icon: Coins, 
    label: '200 CC',
    type: 'club_coins',
    value: 200,
    color: 'from-[#084a45] to-[#063a35]',
    probability: 6
  },
  { 
    icon: Coins, 
    label: '250 CC',
    type: 'club_coins',
    value: 250,
    color: 'from-[#084a45] to-[#063a35]',
    probability: 4
  },
  { 
    icon: Coins, 
    label: '300 CC',
    type: 'club_coins',
    value: 300,
    color: 'from-[#084a45] to-[#063a35]',
    probability: 3
  },
  { 
    icon: Coins, 
    label: '400 CC',
    type: 'club_coins',
    value: 400,
    color: 'from-[#063a35] to-[#052d2a]',
    probability: 2
  },
  { 
    icon: Coins, 
    label: '500 CC',
    type: 'club_coins',
    value: 500,
    color: 'from-[#063a35] to-[#052d2a]',
    probability: 1.5
  },
  { 
    icon: Shirt, 
    label: 'Merch',
    type: 'merch',
    value: 1,
    color: 'from-[#063a35] to-[#052d2a]',
    probability: 2
  },
  { 
    icon: Trophy, 
    label: '10,000 CC',
    type: 'mega_jackpot',
    value: 10000,
    color: 'from-yellow-500 via-amber-500 to-yellow-600',
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
      logger.error('Error opening box:', err);
    }
  };

  if (!isOpen) return null;

  const currentItem = (isSpinning || showResult) ? rewardItems[currentIndex] : null;
  const Icon = currentItem?.icon || Package;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4 box-simple-container">
      <div className="bg-white dark:bg-[var(--bg-primary)] rounded-2xl max-w-md w-full relative overflow-hidden border border-[var(--border-primary)] shadow-2xl">
        {/* Header */}
        <div className="relative p-6 border-b border-[var(--border-primary)]">
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 to-[var(--accent)]/10" />
          <div className="relative flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Mystery Box</h2>
              <p className="text-[var(--text-muted)] text-sm mt-1">
                {!isSpinning && !showResult ? 'Click to reveal your reward' : 
                 isSpinning ? 'Revealing...' : 
                 'Congratulations!'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        {/* Display Area */}
        <div className="p-12 bg-gradient-to-b from-transparent to-[var(--bg-tertiary)]">
          <div className="flex justify-center items-center">
            {!currentItem ? (
              // Mystery box state - before opening
              <div className="relative">
                <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[#084a45] 
                              flex items-center justify-center border-2 border-[var(--accent)]/20 shadow-xl
                              transform hover:scale-105 transition-transform cursor-pointer"
                     onClick={handleOpenBox}>
                  <Package className="w-16 h-16 text-white/90" strokeWidth={1.5} />
                </div>
                <div className="absolute -inset-2 bg-gradient-to-r from-[var(--accent)]/20 to-[#084a45]/20 rounded-xl blur-2xl" />
              </div>
            ) : (
              // Spinning/Result state
              <div className="relative">
                <div 
                  className={`
                    w-32 h-32 rounded-xl bg-gradient-to-br ${currentItem.color}
                    flex flex-col items-center justify-center transition-all duration-200
                    border-2 ${showResult ? 'border-[var(--accent)]/50 scale-110 shadow-2xl' : 
                      isSpinning ? 'border-[var(--accent)]/20 scale-105' : 'border-[var(--accent)]/20'}
                  `}
                >
                  <Icon className="w-12 h-12 text-white mb-2" strokeWidth={1.5} />
                  <span className="text-white font-semibold text-sm">{currentItem.label}</span>
                </div>
                {showResult && (
                  <div className="absolute -inset-3 bg-gradient-to-r from-[var(--accent)]/40 to-[#084a45]/40 rounded-xl blur-3xl animate-pulse" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action/Result Section */}
        <div className="p-6 border-t border-[var(--border-primary)]">
          {!showResult ? (
            <button
              onClick={handleOpenBox}
              disabled={isSpinning}
              className={`w-full py-3 px-6 rounded-lg font-semibold text-sm transition-all ${
                isSpinning
                  ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[var(--accent)] to-[#084a45] text-white hover:from-[#084a45] hover:to-[#063a35] shadow-lg transform hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isSpinning ? 'Revealing...' : 'Open Box'}
            </button>
          ) : (
            <div className="space-y-4">
              {/* Reward Display */}
              {selectedReward && (
                <div className="bg-gradient-to-br from-[var(--accent)]/5 to-[var(--accent)]/10 rounded-lg border border-[var(--accent)]/20 p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[var(--text-muted)]">Reward Claimed</h3>
                    <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse" />
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">
                        {selectedReward.rewardName}
                      </p>
                    </div>
                    
                    {selectedReward.voucherCode && (
                      <div className="bg-white dark:bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-primary)]">
                        <p className="text-xs text-[var(--text-muted)] mb-1 font-medium">Voucher Code</p>
                        <p className="font-mono font-bold text-[var(--accent)] text-lg">
                          {selectedReward.voucherCode}
                        </p>
                      </div>
                    )}
                    
                    {selectedReward.expiresAt && (
                      <p className="text-xs text-[var(--text-muted)]">
                        Valid until {new Date(selectedReward.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                    
                    {selectedReward.rewardType === 'club_coins' && (
                      <p className="text-sm text-[var(--accent)] font-semibold">
                        ✓ Added to your balance
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              <button
                onClick={onClose}
                className="w-full py-3 px-4 bg-gray-100 dark:bg-[var(--bg-secondary)] hover:bg-gray-200 dark:hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg font-semibold text-sm transition-colors"
              >
                Done
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