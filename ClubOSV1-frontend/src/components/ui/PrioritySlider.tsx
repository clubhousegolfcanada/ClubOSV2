import React from 'react';
import { AlertCircle, AlertTriangle, Info, Flame } from 'lucide-react';

interface PrioritySliderProps {
  value: 'low' | 'medium' | 'high' | 'urgent';
  onChange: (value: 'low' | 'medium' | 'high' | 'urgent') => void;
  disabled?: boolean;
}

const PrioritySlider: React.FC<PrioritySliderProps> = ({ value, onChange, disabled = false }) => {
  const priorities = [
    { value: 'low', label: 'Low', icon: Info, color: '#10B981' },
    { value: 'medium', label: 'Medium', icon: AlertCircle, color: '#F59E0B' },
    { value: 'high', label: 'High', icon: AlertTriangle, color: '#F97316' },
    { value: 'urgent', label: 'Urgent', icon: Flame, color: '#EF4444' }
  ] as const;

  const currentIndex = priorities.findIndex(p => p.value === value);
  const percentage = (currentIndex / (priorities.length - 1)) * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    const priority = priorities[val].value;
    onChange(priority);
  };

  const CurrentIcon = priorities[currentIndex].icon;

  return (
    <div className="space-y-3">
      {/* Slider Container */}
      <div className="relative">
        {/* Track with gradient */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full overflow-hidden bg-gradient-to-r from-green-500 via-yellow-500 via-orange-500 to-red-500 opacity-20" />

        {/* Active track */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full transition-all duration-200"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(to right, #10B981, ${priorities[currentIndex].color})`
          }}
        />

        {/* Tick marks */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2">
          {priorities.map((_, index) => (
            <div
              key={index}
              className={`w-1 h-3 rounded-full transition-all duration-200 ${
                index <= currentIndex ? 'bg-white' : 'bg-[var(--bg-tertiary)]'
              }`}
            />
          ))}
        </div>

        {/* Range input (invisible but functional) */}
        <input
          type="range"
          min="0"
          max={priorities.length - 1}
          step="1"
          value={currentIndex}
          onChange={handleSliderChange}
          disabled={disabled}
          className="relative w-full h-10 opacity-0 cursor-pointer z-10"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        />

        {/* Custom thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-all duration-200"
          style={{ left: `${percentage}%` }}
        >
          <div
            className="w-6 h-6 rounded-full shadow-lg border-2 border-white flex items-center justify-center"
            style={{ backgroundColor: priorities[currentIndex].color }}
          >
            <CurrentIcon className="w-3 h-3 text-white" />
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between px-1">
        {priorities.map((priority) => {
          const Icon = priority.icon;
          const isActive = priority.value === value;
          return (
            <button
              key={priority.value}
              type="button"
              onClick={() => !disabled && onChange(priority.value)}
              disabled={disabled}
              className={`flex flex-col items-center gap-1 transition-all duration-200 ${
                isActive ? 'opacity-100 scale-110' : 'opacity-50 hover:opacity-75'
              } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Icon
                className="w-4 h-4"
                style={{ color: isActive ? priority.color : 'var(--text-muted)' }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: isActive ? priority.color : 'var(--text-muted)' }}
              >
                {priority.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Description */}
      <div className="text-center">
        <p className="text-sm text-[var(--text-muted)]">
          {value === 'low' && "Minor issues that can be addressed when convenient"}
          {value === 'medium' && "Standard requests requiring attention within 24-48 hours"}
          {value === 'high' && "Issues impacting operations, needs prompt attention"}
          {value === 'urgent' && "Critical issues requiring immediate response"}
        </p>
      </div>
    </div>
  );
};

export default PrioritySlider;