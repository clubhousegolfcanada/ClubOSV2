import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  MapPin, 
  ChevronDown,
  ChevronRight,
  Maximize2, 
  X, 
  Loader2,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

interface Location {
  id: string;
  name: string;
  city: string;
}

interface QuickBookCardProps {
  className?: string;
}

export const QuickBookCard: React.FC<QuickBookCardProps> = ({ className = '' }) => {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Available locations
  const locations: Location[] = [
    { id: 'all', name: 'All Locations', city: 'All' },
    { id: 'bedford', name: 'Bedford', city: 'Bedford' },
    { id: 'dartmouth', name: 'Dartmouth', city: 'Dartmouth' }
  ];

  // Skedda booking URLs
  const skeddaUrls: Record<string, string> = {
    all: 'https://clubhouse247golf.skedda.com/booking',
    bedford: 'https://clubhouse247golf.skedda.com/booking?spacefeatureids=c58c2cecfcce4559a3b61827b1cc8b47',
    dartmouth: 'https://clubhouse247golf.skedda.com/booking?spacefeatureids=9c2102d2571146709f186a1cc14b4ecf'
  };

  // Initialize with saved location or default
  useEffect(() => {
    const savedLocation = localStorage.getItem('preferredClubhouse');
    const defaultLocation = locations.find(loc => loc.id === savedLocation) || locations[0];
    setSelectedLocation(defaultLocation);
  }, []);

  // Lazy loading with Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [isVisible]);

  const handleLocationChange = (location: Location) => {
    setSelectedLocation(location);
    localStorage.setItem('preferredClubhouse', location.id);
    setShowLocationDropdown(false);
    setIsLoading(true);
    setHasError(false);
  };

  const handleExpand = () => {
    if (selectedLocation) {
      window.open(skeddaUrls[selectedLocation.id], '_blank');
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    // Check if iframe loaded successfully
    try {
      // This might throw due to cross-origin restrictions, which is expected
      const iframeDoc = iframeRef.current?.contentDocument;
      if (iframeDoc?.body?.innerHTML === '') {
        setHasError(true);
      }
    } catch (e) {
      // Cross-origin restriction - this is normal, iframe likely loaded fine
      setIsLoading(false);
    }
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (!selectedLocation) return null;

  return (
    <div 
      ref={cardRef}
      className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden ${className} ${
        isExpanded ? 'fixed inset-4 z-50 lg:relative lg:inset-auto' : ''
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Quick Book a Box</h2>
          <Calendar className="w-4 h-4 text-[#0B3D3A]" />
        </div>
        
        {/* Location Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLocationDropdown(!showLocationDropdown)}
            className="flex items-center gap-1 px-2 py-1 bg-[#0B3D3A]/10 hover:bg-[#0B3D3A]/20 rounded text-xs font-medium text-[#0B3D3A] transition-colors"
          >
            <MapPin className="w-3 h-3" />
            <span>{selectedLocation.name === 'All Locations' ? 'All' : selectedLocation.name}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showLocationDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-40 min-w-[150px]">
              {locations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => handleLocationChange(location)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                    selectedLocation?.id === location.id ? 'bg-[#0B3D3A]/10 text-[#0B3D3A] font-medium' : 'text-gray-700'
                  }`}
                >
                  <div className="font-medium text-sm">{location.name}</div>
                  {location.city !== 'All' && (
                    <div className="text-xs text-gray-700">{location.city}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`relative px-4 pb-4 ${isExpanded ? 'h-[calc(100vh-8rem)]' : 'h-[250px]'}`}>
        {/* Loading State */}
        {isLoading && isVisible && (
          <div className="absolute inset-0 bg-white z-10 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#0B3D3A] animate-spin mb-3" />
            <p className="text-sm text-gray-700">Loading booking system...</p>
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div className="absolute inset-0 bg-white z-10 flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Unable to load booking system</h4>
            <p className="text-sm text-gray-700 mb-4">
              The booking system couldn't be loaded in this view. Please open it in a new tab for the best experience.
            </p>
            <button
              onClick={handleExpand}
              className="px-4 py-2 bg-[#0B3D3A] text-white rounded-lg hover:bg-[#084a45] transition-colors flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open Booking System
            </button>
          </div>
        )}

        {/* Iframe - Only render when visible (lazy loading) */}
        {isVisible && !hasError && (
          <iframe
            ref={iframeRef}
            src={skeddaUrls[selectedLocation.id]}
            title="Clubhouse Golf Booking System"
            className="w-full h-full"
            style={{ border: 'none' }}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            allow="payment; fullscreen"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-popups-to-escape-sandbox"
          />
        )}

        {/* Placeholder when not visible */}
        {!isVisible && (
          <div className="absolute inset-0 bg-gray-50 flex flex-col items-center justify-center">
            <Calendar className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-700">Booking system will load when visible</p>
          </div>
        )}
      </div>

      
      {/* Action Button */}
      {!isExpanded && (
        <div className="px-4 pb-4">
          <button
            onClick={handleExpand}
            className="w-full p-3 bg-gradient-to-r from-[#0B3D3A] to-[#084a45] text-white rounded-lg hover:shadow-md transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <ExternalLink className="w-5 h-5" />
              <div className="text-left">
                <p className="font-medium">Open Full Booking</p>
                <p className="text-xs opacity-90">View all available times</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
};

export default QuickBookCard;