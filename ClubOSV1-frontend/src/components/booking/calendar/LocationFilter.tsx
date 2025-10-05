import React from 'react';
import { MapPin } from 'lucide-react';

interface LocationFilterProps {
  locations: Array<{
    id: string;
    name: string;
    isVisible?: boolean;
  }>;
  selectedLocation: string;
  onChange: (locationId: string) => void;
  className?: string;
}

const LocationFilter: React.FC<LocationFilterProps> = ({
  locations,
  selectedLocation,
  onChange,
  className = ''
}) => {
  // Location colors matching the ticket system
  const locationColors: Record<string, string> = {
    'river-oaks': '#8B5CF6',      // Purple
    'heights': '#3B82F6',          // Blue
    'energy-corridor': '#10B981',  // Green
    'midtown': '#F59E0B',          // Amber
    'galleria': '#EF4444',         // Red
    'woodlands': '#EC4899',        // Pink
    'all': '#6B7280'               // Gray for "All Locations"
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <MapPin className="w-4 h-4 text-[var(--text-secondary)]" />

      <select
        value={selectedLocation}
        onChange={(e) => onChange(e.target.value)}
        className="
          px-3 py-1.5 text-sm font-medium
          bg-[var(--bg-secondary)] border border-[var(--border)]
          rounded-lg cursor-pointer
          hover:bg-[var(--bg-tertiary)]
          focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
        "
        style={{
          borderLeftColor: locationColors[selectedLocation] || '#6B7280',
          borderLeftWidth: '3px'
        }}
      >
        <option value="all">All Locations</option>
        {locations
          .filter(loc => loc.isVisible !== false)
          .map(location => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
      </select>

      {/* Visual indicator of selected location */}
      {selectedLocation !== 'all' && (
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: locationColors[selectedLocation] }}
          title={locations.find(l => l.id === selectedLocation)?.name}
        />
      )}
    </div>
  );
};

export default LocationFilter;