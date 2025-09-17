import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Check } from 'lucide-react';

interface LocationDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const locations = [
  { value: 'Bedford', label: 'Bedford', icon: '🏌️' },
  { value: 'Dartmouth', label: 'Dartmouth', icon: '⛳' },
  { value: 'Bayers Lake', label: 'Bayers Lake', icon: '🏌️' },
  { value: 'Stratford', label: 'Stratford', icon: '⛳' }
];

const LocationDropdown: React.FC<LocationDropdownProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = "Select location"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedLocation = locations.find(loc => loc.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (locationValue: string) => {
    onChange(locationValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg
          flex items-center justify-between gap-2 transition-all duration-200
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-[var(--accent)]'}
          ${isOpen ? 'border-[var(--accent)] shadow-sm' : ''}
        `}
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
          <span className={`text-sm ${value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
            {selectedLocation ? (
              <>
                <span className="mr-1">{selectedLocation.icon}</span>
                {selectedLocation.label}
              </>
            ) : (
              placeholder
            )}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg shadow-lg overflow-hidden animate-in slide-in-from-top-1 duration-200">
          <div className="py-1">
            {locations.map((location) => (
              <button
                key={location.value}
                type="button"
                onClick={() => handleSelect(location.value)}
                className={`
                  w-full px-4 py-2.5 flex items-center justify-between gap-2 transition-all duration-150
                  ${value === location.value
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{location.icon}</span>
                  <span className="text-sm font-medium">{location.label}</span>
                </div>
                {value === location.value && (
                  <Check className="w-4 h-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationDropdown;