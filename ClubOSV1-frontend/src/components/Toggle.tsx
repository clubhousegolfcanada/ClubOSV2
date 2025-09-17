import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled = false }) => {
  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className={`
            block w-14 h-8 rounded-full transition-colors duration-200
            ${checked ? 'bg-primary' : 'bg-[var(--bg-tertiary)]'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        <div
          className={`
            absolute left-1 top-1 bg-[var(--bg-secondary)] w-6 h-6 rounded-full transition-transform duration-200
            ${checked ? 'transform translate-x-6' : ''}
          `}
        />
      </div>
      {label && (
        <span className={`ml-3 text-[var(--text-primary)] ${disabled ? 'opacity-50' : ''}`}>
          {label}
        </span>
      )}
    </label>
  );
};

export default Toggle;
