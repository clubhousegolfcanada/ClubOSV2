import React from 'react';
import { X, Users, Monitor, Volume2, Maximize } from 'lucide-react';
import Button from '@/components/ui/Button';

interface BoxInfo {
  id: string;
  name: string;
  location: string;
  image?: string;
  capacity: number;
  equipment: {
    simulator: string;
    projector?: string;
    tvs?: string;
    audio?: string;
    screen?: string;
  };
}

interface BoxInfoModalProps {
  box: BoxInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

const BoxInfoModal: React.FC<BoxInfoModalProps> = ({ box, isOpen, onClose }) => {
  if (!isOpen || !box) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="card max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-[var(--accent)] text-white px-6 py-4 flex items-center justify-between -m-3 mb-4 rounded-t-xl">
            <h2 className="text-lg font-semibold">
              {box.location.toUpperCase()} - {box.name.toUpperCase()}
            </h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-3">
            {/* Box Image */}
            {box.image && (
              <div className="mb-4 rounded-lg overflow-hidden">
                <img
                  src={box.image}
                  alt={`${box.name} simulator`}
                  className="w-full h-64 object-cover"
                />
              </div>
            )}

            {/* Box Details */}
            <div className="space-y-3">
              {/* Capacity */}
              <div className="flex items-center gap-2 text-[var(--text-primary)]">
                <Users className="h-4 w-4 text-[var(--text-secondary)]" />
                <span className="text-sm">{box.capacity} people</span>
              </div>

              {/* Equipment */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[var(--text-primary)]">
                  <Monitor className="h-4 w-4 text-[var(--text-secondary)]" />
                  <span className="text-sm">Trackman iO overhead simulator</span>
                </div>

                <div className="text-sm font-medium text-[var(--text-primary)] mt-3 mb-2">Equipment Details</div>

                <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 space-y-1.5 text-sm">
                  <div className="text-[var(--text-primary)]">
                    <span className="text-[var(--text-secondary)]">Simulator:</span> {box.equipment.simulator}
                  </div>

                  {box.equipment.projector && (
                    <div className="text-[var(--text-primary)]">
                      <span className="text-[var(--text-secondary)]">Projector:</span> {box.equipment.projector}
                    </div>
                  )}

                  {box.equipment.tvs && (
                    <div className="text-[var(--text-primary)]">
                      <span className="text-[var(--text-secondary)]">Display:</span> {box.equipment.tvs}
                    </div>
                  )}

                  {box.equipment.audio && (
                    <div className="text-[var(--text-primary)]">
                      <span className="text-[var(--text-secondary)]">Audio:</span> {box.equipment.audio}
                    </div>
                  )}

                  {box.equipment.screen && (
                    <div className="text-[var(--text-primary)]">
                      <span className="text-[var(--text-secondary)]">Screen:</span> {box.equipment.screen}
                    </div>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="pt-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                  <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {box.location}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <div className="mt-4 flex justify-center pb-3">
              <Button
                variant="secondary"
                onClick={onClose}
                size="sm"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BoxInfoModal;