import React from 'react';
import { Clock, TrendingUp } from 'lucide-react';
import Button from '@/components/ui/Button';
import { TimeValidationService, formatDuration } from '@/services/booking/timeValidationService';

interface DurationOption {
  minutes: number;
  label: string;
  popular?: boolean;
  discount?: number;
}

interface DurationPickerProps {
  minDuration: number;
  maxDuration: number;
  incrementAfterFirstHour: number;
  selectedDuration?: number;
  onChange: (minutes: number) => void;
  customerTier?: string;
  className?: string;
}

const DurationPicker: React.FC<DurationPickerProps> = ({
  minDuration = 60,
  maxDuration = 360,
  incrementAfterFirstHour = 30,
  selectedDuration,
  onChange,
  customerTier = 'new',
  className = ''
}) => {
  // Generate duration options based on validation service
  const generateOptions = (): DurationOption[] => {
    const validDurations = TimeValidationService.getValidDurations({
      minDuration,
      maxDuration,
      incrementAfterFirst: incrementAfterFirstHour
    });

    return validDurations.map(minutes => {
      const option: DurationOption = {
        minutes,
        label: formatDuration(minutes)
      };

      // Mark popular durations
      if (minutes === 60 || minutes === 90 || minutes === 120) {
        option.popular = true;
      }

      // Add discount for longer sessions (member benefit)
      if (customerTier === 'member' && minutes >= 180) {
        option.discount = 10; // 10% discount for 3+ hours
      }

      return option;
    });
  };

  const options = generateOptions();

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-5 h-5 text-[var(--text-secondary)]" />
        <h3 className="text-sm font-semibold">Select Duration</h3>
      </div>

      {/* Quick selection grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {options.map(option => (
          <button
            key={option.minutes}
            onClick={() => onChange(option.minutes)}
            className={`
              relative px-3 py-3 rounded-lg border transition-all
              hover:bg-[var(--bg-hover)]
              ${selectedDuration === option.minutes
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border-primary)] bg-[var(--bg-secondary)]'
              }
            `}
          >

            <div className="text-sm font-medium">
              {option.label}
            </div>

            {/* Price estimate */}
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              ~${calculatePrice(option.minutes, customerTier, option.discount)}
            </div>
          </button>
        ))}
      </div>

      {/* Info message */}
      <div className="bg-[var(--status-info)]/10 border border-[var(--status-info)]/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--status-info)] mt-0.5" />
          <div className="text-xs text-[var(--text-secondary)]">
            <div className="font-medium text-[var(--text-primary)]">Duration Rules</div>
            <ul className="mt-1 space-y-0.5">
              <li>• Minimum booking: {formatDuration(minDuration)}</li>
              <li>• After {formatDuration(minDuration)}: {incrementAfterFirstHour}-minute increments</li>
              {customerTier === 'member' && (
                <li>• Members get 10% off on 3+ hour sessions</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Custom duration input */}
      <div className="pt-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-secondary)]">
            Need a different duration?
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // This could open a modal or input for custom duration
              console.log('Custom duration picker');
            }}
          >
            Custom Time
          </Button>
        </div>
      </div>
    </div>
  );
};

// Helper function to calculate estimated price
function calculatePrice(minutes: number, tier: string, discount?: number): number {
  const rates: Record<string, number> = {
    new: 30,
    member: 22.50,
    promo: 15,
    frequent: 20
  };

  const hourlyRate = rates[tier] || 30;
  const hours = minutes / 60;
  let price = hourlyRate * hours;

  if (discount) {
    price = price * (1 - discount / 100);
  }

  return Math.round(price);
}

export default DurationPicker;