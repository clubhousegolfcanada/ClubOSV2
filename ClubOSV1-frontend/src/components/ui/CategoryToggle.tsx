import React from 'react';
import { Wrench, Monitor } from 'lucide-react';

interface CategoryToggleProps {
  value: 'facilities' | 'tech';
  onChange: (value: 'facilities' | 'tech') => void;
  disabled?: boolean;
}

const CategoryToggle: React.FC<CategoryToggleProps> = ({ value, onChange, disabled = false }) => {
  return (
    <div className="space-y-2">
      {/* Toggle Container */}
      <div className="relative bg-[var(--bg-tertiary)] rounded-full p-1 border border-[var(--border-secondary)]">
        {/* Sliding Background */}
        <div
          className="absolute top-1 bottom-1 bg-[var(--accent)] rounded-full transition-all duration-200 ease-out"
          style={{
            width: 'calc(50% - 4px)',
            left: value === 'facilities' ? '4px' : 'calc(50% + 0px)'
          }}
        />

        {/* Toggle Options */}
        <div className="relative flex">
          <button
            type="button"
            onClick={() => !disabled && onChange('facilities')}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full transition-all duration-200 ${
              value === 'facilities' ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <Wrench className="w-4 h-4" />
            <span className="text-sm font-medium">Facilities</span>
          </button>

          <button
            type="button"
            onClick={() => !disabled && onChange('tech')}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full transition-all duration-200 ${
              value === 'tech' ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <Monitor className="w-4 h-4" />
            <span className="text-sm font-medium">Tech Support</span>
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--text-muted)] text-center">
        {value === 'facilities'
          ? "Physical maintenance, cleaning, supplies, or facility issues"
          : "Software, hardware, network, or technical equipment problems"}
      </p>
    </div>
  );
};

export default CategoryToggle;