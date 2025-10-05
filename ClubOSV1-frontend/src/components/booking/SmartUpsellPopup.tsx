import React, { useState, useEffect } from 'react';
import { Clock, TrendingUp, X, DollarSign } from 'lucide-react';
import Button from '@/components/ui/Button';
import { formatDuration } from '@/utils/booking/timeIncrementLogic';

interface UpsellOffer {
  id: string;
  bookingId: string;
  originalDuration: number;
  suggestedDuration: number;
  additionalCost: number;
  discountPercent: number;
  expiresAt: string;
  message: string;
  spaceName?: string;
}

interface SmartUpsellPopupProps {
  offer: UpsellOffer;
  onAccept: (offerId: string) => Promise<void>;
  onDecline: (offerId: string) => void;
  onClose: () => void;
}

const SmartUpsellPopup: React.FC<SmartUpsellPopupProps> = ({
  offer,
  onAccept,
  onDecline,
  onClose
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(300); // 5 minutes in seconds
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  useEffect(() => {
    // Calculate actual time remaining
    const expiresAt = new Date(offer.expiresAt);
    const now = new Date();
    const remaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    setTimeRemaining(Math.max(0, remaining));

    // Update countdown every second
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [offer.expiresAt, onClose]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept(offer.id);
      onClose();
    } catch (error) {
      console.error('Failed to accept offer:', error);
      setIsAccepting(false);
    }
  };

  const handleDecline = () => {
    setIsDeclining(true);
    onDecline(offer.id);
    setTimeout(onClose, 500);
  };

  const additionalMinutes = offer.suggestedDuration - offer.originalDuration;
  const savingsAmount = (offer.additionalCost * offer.discountPercent / 100);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-primary)] rounded-xl max-w-md w-full shadow-2xl animate-slideUp">
        {/* Header with countdown */}
        <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-xl">
          <button
            onClick={handleDecline}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">Extend Your Session!</h3>
          </div>

          <p className="text-white/90">
            {offer.spaceName ? `Enjoying ${offer.spaceName}?` : 'Enjoying your session?'} Add more time at a special rate!
          </p>

          {/* Countdown timer */}
          <div className="mt-4 flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4" />
            <span>Offer expires in {formatTime(timeRemaining)}</span>
          </div>
        </div>

        {/* Offer details */}
        <div className="p-6 space-y-4">
          {/* Current vs Extended */}
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-secondary)]">Current session:</span>
              <span className="font-semibold">{formatDuration(offer.originalDuration)}</span>
            </div>
            <div className="flex justify-between items-center text-green-600 dark:text-green-400">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Extended session:
              </span>
              <span className="font-bold">{formatDuration(offer.suggestedDuration)}</span>
            </div>
            <div className="border-t border-[var(--border)] pt-3">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">Additional time:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  +{formatDuration(additionalMinutes)}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--text-secondary)]">Regular price:</span>
                <span className="text-sm line-through text-[var(--text-secondary)]">
                  ${(offer.additionalCost / (1 - offer.discountPercent / 100)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                  {offer.discountPercent}% discount:
                </span>
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                  -${savingsAmount.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-green-300 dark:border-green-700 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">You pay:</span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ${offer.additionalCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">✓</span>
              </div>
              <span className="text-sm">No need to rebook - seamlessly extend your current session</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">✓</span>
              </div>
              <span className="text-sm">Special {offer.discountPercent}% discount - exclusive offer</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">✓</span>
              </div>
              <span className="text-sm">Keep your momentum going without interruption</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleAccept}
              disabled={isAccepting || isDeclining}
              className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 text-white"
            >
              {isAccepting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Extending...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Yes, Extend for ${offer.additionalCost.toFixed(2)}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDecline}
              disabled={isAccepting || isDeclining}
              className="flex-1"
            >
              No Thanks
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartUpsellPopup;