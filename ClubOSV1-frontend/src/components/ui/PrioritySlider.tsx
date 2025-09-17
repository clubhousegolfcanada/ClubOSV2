import React from 'react';

interface PrioritySliderProps {
  value: 'low' | 'medium' | 'high' | 'urgent';
  onChange: (value: 'low' | 'medium' | 'high' | 'urgent') => void;
  disabled?: boolean;
}

const PrioritySlider: React.FC<PrioritySliderProps> = ({ value, onChange, disabled = false }) => {
  const priorities = [
    { value: 'low', label: 'Low', color: '#10B981' },
    { value: 'medium', label: 'Med', color: '#F59E0B' },
    { value: 'high', label: 'High', color: '#F97316' },
    { value: 'urgent', label: 'Urgent', color: '#EF4444' }
  ] as const;

  const currentIndex = priorities.findIndex(p => p.value === value);
  const percentage = (currentIndex / (priorities.length - 1)) * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    const priority = priorities[val].value;
    onChange(priority);
  };

  return (
    <div className="space-y-2">
      {/* Slider Container */}
      <div className="relative">
        {/* Track background */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-[var(--bg-tertiary)]" />

        {/* Active track - subtle gradient */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full transition-all duration-200"
          style={{
            width: `${percentage}%`,
            backgroundColor: priorities[currentIndex].color,
            opacity: 0.8
          }}
        />

        {/* Range input (invisible but functional) */}
        <input
          type="range"
          min="0"
          max={priorities.length - 1}
          step="1"
          value={currentIndex}
          onChange={handleSliderChange}
          disabled={disabled}
          className="relative w-full h-8 opacity-0 cursor-pointer z-10"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        />

        {/* Custom thumb - minimal */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-all duration-200"
          style={{ left: `${percentage}%` }}
        >
          <div
            className="w-4 h-4 rounded-full shadow-sm border-2 border-white"
            style={{ backgroundColor: priorities[currentIndex].color }}
          />
        </div>
      </div>

      {/* Labels - minimal text only */}
      <div className="flex justify-between px-1">
        {priorities.map((priority) => {
          const isActive = priority.value === value;
          return (
            <button
              key={priority.value}
              type="button"
              onClick={() => !disabled && onChange(priority.value)}
              disabled={disabled}
              className={`text-xs transition-all duration-200 ${
                isActive ? 'font-medium' : 'font-normal opacity-60 hover:opacity-100'
              } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              style={{ color: isActive ? priority.color : 'var(--text-muted)' }}
            >
              {priority.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PrioritySlider;