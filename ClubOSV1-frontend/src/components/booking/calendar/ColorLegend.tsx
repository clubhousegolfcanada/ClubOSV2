import React from 'react';
import { CustomerTier } from '@/services/booking/bookingConfig';

interface ColorLegendProps {
  tiers: CustomerTier[];
  className?: string;
}

const ColorLegend: React.FC<ColorLegendProps> = ({ tiers, className = '' }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {tiers.map(tier => (
        <div key={tier.id} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm border border-gray-300"
            style={{ backgroundColor: tier.color }}
            aria-label={`${tier.name} color`}
          />
          <span className="text-xs text-gray-600">{tier.name}</span>
        </div>
      ))}
    </div>
  );
};

export default ColorLegend;