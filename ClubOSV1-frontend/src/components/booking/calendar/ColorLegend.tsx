import React from 'react';
import { CustomerTier } from '@/services/booking/bookingConfig';

interface ColorLegendProps {
  tiers: CustomerTier[];
  className?: string;
}

const ColorLegend: React.FC<ColorLegendProps> = ({ tiers, className = '' }) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {tiers.map(tier => (
        <div
          key={tier.id}
          className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-tertiary)] rounded-full"
        >
          <div
            className="w-2.5 h-2.5 rounded-full border border-[var(--border-primary)]"
            style={{ backgroundColor: tier.color }}
            aria-label={`${tier.name} color`}
          />
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {tier.name}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ColorLegend;