import React from 'react';
import { Trophy, Star, Award, Crown, Sparkles, Gem } from 'lucide-react';

export type TierName = 'junior' | 'house' | 'amateur' | 'pro' | 'master' | 'legend';

interface TierConfig {
  name: string;
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
  minCC: number;
  maxCC?: number;
}

const tierConfigs: Record<TierName, TierConfig> = {
  junior: {
    name: 'Junior',
    icon: <Star className="w-4 h-4" />,
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    textColor: 'text-gray-700',
    iconColor: 'text-gray-500',
    minCC: 0,
    maxCC: 199
  },
  house: {
    name: 'House',
    icon: <Trophy className="w-4 h-4" />,
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    textColor: 'text-green-800',
    iconColor: 'text-green-600',
    minCC: 200,
    maxCC: 749
  },
  amateur: {
    name: 'Amateur',
    icon: <Award className="w-4 h-4" />,
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-600',
    minCC: 750,
    maxCC: 1999
  },
  pro: {
    name: 'Pro',
    icon: <Crown className="w-4 h-4" />,
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-800',
    iconColor: 'text-purple-600',
    minCC: 2000,
    maxCC: 4999
  },
  master: {
    name: 'Master',
    icon: <Sparkles className="w-4 h-4" />,
    bgColor: 'bg-gradient-to-r from-yellow-100 to-amber-100',
    borderColor: 'border-amber-400',
    textColor: 'text-amber-900',
    iconColor: 'text-amber-700',
    minCC: 5000,
    maxCC: 9999
  },
  legend: {
    name: 'Legend',
    icon: <Gem className="w-4 h-4" />,
    bgColor: 'bg-gradient-to-r from-slate-900 to-slate-700',
    borderColor: 'border-slate-800',
    textColor: 'text-white',
    iconColor: 'text-slate-200',
    minCC: 10000
  }
};

interface TierBadgeProps {
  tier: TierName;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const TierBadge: React.FC<TierBadgeProps> = ({ 
  tier, 
  size = 'md', 
  showIcon = true,
  className = ''
}) => {
  const config = tierConfigs[tier];
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded-full font-semibold
        ${config.bgColor} ${config.borderColor} ${config.textColor}
        ${sizeClasses[size]} border ${className}
      `}
    >
      {showIcon && (
        <span className={config.iconColor}>
          {config.icon}
        </span>
      )}
      <span>{config.name}</span>
    </div>
  );
};

interface TierProgressBarProps {
  currentCC: number;
  tier: TierName;
  nextTier?: TierName;
  className?: string;
}

export const TierProgressBar: React.FC<TierProgressBarProps> = ({
  currentCC,
  tier,
  nextTier,
  className = ''
}) => {
  const currentConfig = tierConfigs[tier];
  const nextConfig = nextTier ? tierConfigs[nextTier] : null;
  
  if (!nextConfig) {
    // Master tier - no progression
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-between mb-2">
          <TierBadge tier={tier} size="sm" />
          <span className="text-sm text-gray-600">
            {currentCC.toLocaleString()} CC
          </span>
        </div>
        <div className="text-xs text-gray-500 text-center mt-1">
          {tier === 'legend' ? 'Legendary status achieved!' : 'Maximum tier achieved!'}
        </div>
      </div>
    );
  }

  const progress = ((currentCC - currentConfig.minCC) / (nextConfig.minCC - currentConfig.minCC)) * 100;
  const remaining = nextConfig.minCC - currentCC;

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-2">
        <TierBadge tier={tier} size="sm" />
        <span className="text-xs text-gray-500">
          {remaining} CC to {nextConfig.name}
        </span>
        {nextTier && <TierBadge tier={nextTier} size="sm" className="opacity-50" />}
      </div>
      
      <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full transition-all duration-500 ${
            tier === 'junior' ? 'bg-gray-400' :
            tier === 'house' ? 'bg-green-500' :
            tier === 'amateur' ? 'bg-blue-500' :
            tier === 'pro' ? 'bg-purple-500' :
            tier === 'master' ? 'bg-amber-500' :
            'bg-gradient-to-r from-slate-800 to-slate-600'
          }`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-600">
          {currentCC.toLocaleString()} CC
        </span>
        <span className="text-xs text-gray-600">
          {nextConfig.minCC.toLocaleString()} CC
        </span>
      </div>
    </div>
  );
};

// Helper function to calculate tier from CC
export const calculateTierFromCC = (totalCC: number): TierName => {
  if (totalCC >= 10000) return 'legend';
  if (totalCC >= 5000) return 'master';
  if (totalCC >= 2000) return 'pro';
  if (totalCC >= 750) return 'amateur';
  if (totalCC >= 200) return 'house';
  return 'junior';
};

// Helper function to get next tier
export const getNextTier = (currentTier: TierName): TierName | null => {
  const tierOrder: TierName[] = ['junior', 'house', 'amateur', 'pro', 'master', 'legend'];
  const currentIndex = tierOrder.indexOf(currentTier);
  
  if (currentIndex === -1 || currentIndex === tierOrder.length - 1) {
    return null;
  }
  
  return tierOrder[currentIndex + 1];
};

// Export tier configurations for use in other components
export { tierConfigs };