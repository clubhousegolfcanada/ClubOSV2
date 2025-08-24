import React from 'react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AchievementBadgeProps {
  icon: string;
  name: string;
  description?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showTooltip?: boolean;
  animate?: boolean;
  onClick?: () => void;
  className?: string;
}

const rarityStyles = {
  common: {
    border: 'border-gray-400',
    glow: '',
    bg: 'bg-gray-50'
  },
  rare: {
    border: 'border-blue-500',
    glow: 'shadow-[0_0_10px_rgba(59,130,246,0.5)]',
    bg: 'bg-blue-50'
  },
  epic: {
    border: 'border-purple-500',
    glow: 'shadow-[0_0_15px_rgba(139,92,246,0.6)]',
    bg: 'bg-purple-50'
  },
  legendary: {
    border: 'border-yellow-500',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.7)]',
    bg: 'bg-gradient-to-br from-yellow-50 to-amber-50',
    animation: 'animate-pulse'
  }
};

const sizeStyles = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-4xl'
};

export function AchievementBadge({
  icon,
  name,
  description,
  rarity,
  size = 'md',
  showTooltip = true,
  animate = true,
  onClick,
  className
}: AchievementBadgeProps) {
  const styles = rarityStyles[rarity];
  const sizeClass = sizeStyles[size];

  const badge = (
    <motion.div
      className={cn(
        'relative flex items-center justify-center rounded-full border-2 transition-all',
        sizeClass,
        styles.border,
        styles.bg,
        styles.glow,
        rarity === 'legendary' && animate && styles.animation,
        onClick && 'cursor-pointer hover:scale-110',
        className
      )}
      whileHover={animate ? { scale: 1.1 } : undefined}
      whileTap={animate ? { scale: 0.95 } : undefined}
      onClick={onClick}
      initial={animate ? { scale: 0, opacity: 0 } : undefined}
      animate={animate ? { scale: 1, opacity: 1 } : undefined}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
    >
      <span className="select-none">{icon}</span>
      
      {/* Legendary shimmer effect */}
      {rarity === 'legendary' && animate && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.7) 50%, transparent 60%)',
            backgroundSize: '200% 200%'
          }}
          animate={{
            backgroundPosition: ['200% 0%', '-200% 0%']
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatDelay: 2
          }}
        />
      )}
    </motion.div>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center max-w-xs">
            <div className="font-semibold">{name}</div>
            {description && (
              <div className="text-xs text-gray-500 mt-1">{description}</div>
            )}
            <div className={cn(
              'text-xs mt-1 px-2 py-0.5 rounded inline-block',
              rarity === 'common' && 'bg-gray-500 text-white',
              rarity === 'rare' && 'bg-blue-500 text-white',
              rarity === 'epic' && 'bg-purple-500 text-white',
              rarity === 'legendary' && 'bg-yellow-500 text-white'
            )}>
              {rarity}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface AchievementBadgeGroupProps {
  achievements: Array<{
    id: string;
    icon: string;
    name: string;
    description?: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
  }>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  maxDisplay?: number;
  onBadgeClick?: (achievement: any) => void;
  className?: string;
}

export function AchievementBadgeGroup({
  achievements,
  size = 'sm',
  maxDisplay = 3,
  onBadgeClick,
  className
}: AchievementBadgeGroupProps) {
  const displayAchievements = achievements.slice(0, maxDisplay);
  const remainingCount = Math.max(0, achievements.length - maxDisplay);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {displayAchievements.map((achievement, index) => (
        <motion.div
          key={achievement.id}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: index * 0.1 }}
        >
          <AchievementBadge
            icon={achievement.icon}
            name={achievement.name}
            description={achievement.description}
            rarity={achievement.rarity}
            size={size}
            onClick={() => onBadgeClick?.(achievement)}
          />
        </motion.div>
      ))}
      {remainingCount > 0 && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: displayAchievements.length * 0.1 }}
          className={cn(
            'flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-medium',
            sizeStyles[size]
          )}
        >
          +{remainingCount}
        </motion.div>
      )}
    </div>
  );
}