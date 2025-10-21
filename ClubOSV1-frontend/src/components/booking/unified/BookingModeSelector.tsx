import React from 'react';
import { Calendar, Ban, Wrench, CalendarDays, Users } from 'lucide-react';
import { BookingMode } from './UnifiedBookingCard';

interface BookingModeSelectorProps {
  currentMode: BookingMode;
  onModeChange: (mode: BookingMode) => void;
  availableModes: BookingMode[];
}

const modeConfig = {
  booking: {
    label: 'Booking',
    icon: Calendar,
    description: 'Create a customer booking',
    color: 'bg-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    hoverColor: 'hover:bg-green-500/20'
  },
  block: {
    label: 'Block',
    icon: Ban,
    description: 'Block time slots',
    color: 'bg-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    hoverColor: 'hover:bg-red-500/20'
  },
  maintenance: {
    label: 'Maintenance',
    icon: Wrench,
    description: 'Schedule maintenance',
    color: 'bg-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    hoverColor: 'hover:bg-orange-500/20'
  },
  event: {
    label: 'Event',
    icon: CalendarDays,
    description: 'Create special event',
    color: 'bg-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    hoverColor: 'hover:bg-purple-500/20'
  },
  class: {
    label: 'Class',
    icon: Users,
    description: 'Schedule a class',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    hoverColor: 'hover:bg-blue-500/20'
  }
};

export default function BookingModeSelector({
  currentMode,
  onModeChange,
  availableModes
}: BookingModeSelectorProps) {
  return (
    <div className="bg-[var(--bg-primary)] border-x border-[var(--border-primary)] px-4 py-3">
      <div className="flex items-center gap-2 overflow-x-auto">
        {availableModes.map((mode) => {
          const config = modeConfig[mode];
          const Icon = config.icon;
          const isActive = currentMode === mode;

          return (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
                ${isActive
                  ? `${config.bgColor} ${config.borderColor} ring-2 ring-offset-2 ring-offset-[var(--bg-primary)] ring-${config.color.replace('bg-', '')}`
                  : `border-[var(--border-primary)] ${config.hoverColor} hover:border-[var(--border-hover)]`
                }
              `}
              title={config.description}
            >
              <Icon className={`w-4 h-4 ${isActive ? config.color.replace('bg-', 'text-') : 'text-[var(--text-muted)]'}`} />
              <span className={`text-sm font-medium ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                {config.label}
              </span>
              {isActive && (
                <span className={`w-2 h-2 rounded-full ${config.color} animate-pulse`} />
              )}
            </button>
          );
        })}
      </div>
      {currentMode && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {modeConfig[currentMode].description}
        </p>
      )}
    </div>
  );
}