import { toast } from 'react-hot-toast';
import { TierName, tierConfigs } from '@/components/TierBadge';

interface TierProgressionEvent {
  previousTier: TierName;
  newTier: TierName;
  totalCC: number;
}

export const checkTierProgression = (
  previousCC: number,
  currentCC: number,
  showNotification: boolean = true
): TierProgressionEvent | null => {
  const previousTier = calculateTierFromCC(previousCC);
  const currentTier = calculateTierFromCC(currentCC);

  if (previousTier !== currentTier && showNotification) {
    const event: TierProgressionEvent = {
      previousTier,
      newTier: currentTier,
      totalCC: currentCC
    };

    showTierProgressionNotification(event);
    return event;
  }

  return null;
};

export const showTierProgressionNotification = (event: TierProgressionEvent) => {
  const newTierConfig = tierConfigs[event.newTier];
  const isUpgrade = getTierLevel(event.newTier) > getTierLevel(event.previousTier);

  if (isUpgrade) {
    toast.success(
      `🎉 Congratulations! You've reached ${newTierConfig.name} tier!`,
      {
        duration: 5000,
        style: {
          background: '#10B981',
          color: 'white',
          fontWeight: 'bold'
        }
      }
    );
  } else {
    toast(
      `Your tier has changed to ${newTierConfig.name}`,
      {
        duration: 3000,
        icon: '📊'
      }
    );
  }
};

export const calculateTierFromCC = (totalCC: number): TierName => {
  if (totalCC >= 10000) return 'legend';
  if (totalCC >= 5000) return 'master';
  if (totalCC >= 2000) return 'pro';
  if (totalCC >= 750) return 'amateur';
  if (totalCC >= 200) return 'house';
  return 'junior';
};

const getTierLevel = (tier: TierName): number => {
  const levels: Record<TierName, number> = {
    junior: 1,
    house: 2,
    amateur: 3,
    pro: 4,
    master: 5,
    legend: 6
  };
  return levels[tier] || 1;
};

export const getCCToNextTier = (currentCC: number): number | null => {
  const thresholds = [200, 750, 2000, 5000, 10000];
  
  for (const threshold of thresholds) {
    if (currentCC < threshold) {
      return threshold - currentCC;
    }
  }
  
  return null; // Already at legend tier
};

export const getNextTierName = (currentTier: TierName): string | null => {
  const nextTier: Record<TierName, string | null> = {
    junior: 'House',
    house: 'Amateur',
    amateur: 'Pro',
    pro: 'Master',
    master: 'Legend',
    legend: null
  };
  
  return nextTier[currentTier];
};