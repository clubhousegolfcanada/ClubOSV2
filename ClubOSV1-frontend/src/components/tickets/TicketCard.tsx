import React, { memo } from 'react';
import { Check, Clock, MapPin, Archive, Camera, MessageSquare } from 'lucide-react';
import type { TicketCardProps } from '@/types/ticket.types';
import { getLocationDisplay } from '@/utils/ticketHelpers';

/**
 * TicketCard Component
 * Compact two-line professional design for efficient ticket display
 * Memoized to prevent unnecessary re-renders
 */
const TicketCard: React.FC<TicketCardProps> = memo(({
  ticket,
  onSelect,
  onResolve,
  onArchive,
  onPhotoClick,
  priorityConfig,
  getStatusConfig,
  formatTimeAgo,
  getTimeUrgency,
  isMobile
}) => {
  const urgency = getTimeUrgency(ticket.createdAt);
  const statusConfig = getStatusConfig(ticket.status);
  const priority = priorityConfig[ticket.priority];
  const locationDisplay = getLocationDisplay(ticket.location, isMobile);

  const handleResolveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onResolve();
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive();
  };

  const handlePhotoClick = (e: React.MouseEvent, photo: string) => {
    e.stopPropagation();
    onPhotoClick(photo);
  };

  return (
    <div
      className="group rounded-lg transition-all duration-200 hover:bg-[var(--bg-hover)] cursor-pointer border border-[var(--border-secondary)] hover:border-[var(--border-primary)]"
      style={{
        borderLeft: `3px solid ${priority.color}`
      }}
      onClick={onSelect}
    >
      <div className="p-2 md:p-2.5">
        {/* Two-line grid layout */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          {/* Left side: Title and metadata */}
          <div className="min-w-0">
            {/* Line 1: Location + Title + Time */}
            <div className="flex items-center gap-2 mb-1.5">
              {/* Location badge - compact */}
              {ticket.location && locationDisplay && (
                <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded">
                  <MapPin className="w-2.5 h-2.5" />
                  {locationDisplay}
                </span>
              )}

              {/* Title - single line with ellipsis */}
              <h4 className="flex-1 font-medium text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                {ticket.title}
              </h4>

              {/* Time - always visible, color indicates urgency */}
              <span className={`
                flex-shrink-0 text-xs
                ${urgency === 'critical' ? 'text-red-500 font-semibold' :
                  urgency === 'high' ? 'text-orange-500' :
                  urgency === 'medium' ? 'text-yellow-500' :
                  'text-[var(--text-muted)]'}
              `}>
                {formatTimeAgo(ticket.createdAt)}
              </span>
            </div>

            {/* Line 2: Status + Category + Metadata */}
            <div className="flex items-center gap-1.5 text-xs">
              {/* Status - compact pill */}
              <span className={`px-1.5 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text} font-medium`}>
                {statusConfig.label}
              </span>

              {/* Priority - icon only on desktop, with text on mobile */}
              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${priority.bg} ${priority.text}`}>
                {priority.icon}
                <span className={isMobile ? '' : 'hidden md:inline'}>{ticket.priority}</span>
              </span>

              {/* Category - compact */}
              <span className="px-1.5 py-0.5 text-[var(--text-muted)] capitalize">
                {ticket.category}
              </span>

              {/* Assigned to - if exists */}
              {ticket.assignedTo && (
                <span className="px-1.5 py-0.5 text-[var(--text-muted)]">
                  @{ticket.assignedTo.name.split(' ')[0]}
                </span>
              )}

              {/* Comments indicator */}
              {ticket.comments.length > 0 && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[var(--text-muted)]">
                  <MessageSquare className="w-3 h-3" />
                  {ticket.comments.length > 9 ? '9+' : ticket.comments.length}
                </span>
              )}

              {/* Photos indicator */}
              {ticket.photoUrls && ticket.photoUrls.length > 0 && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[var(--text-muted)]">
                  <Camera className="w-3 h-3" />
                  {ticket.photoUrls.length}
                </span>
              )}
            </div>
          </div>

          {/* Right side: Photo thumbnail and actions */}
          <div className="flex items-center gap-1">
            {/* Photo thumbnail - smaller */}
            {ticket.photoUrls && ticket.photoUrls.length > 0 && (
              <div className="relative flex-shrink-0">
                <img
                  src={ticket.photoUrls[0]}
                  alt="Ticket photo"
                  className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => handlePhotoClick(e, ticket.photoUrls![0])}
                />
                {ticket.photoUrls.length > 1 && (
                  <span className="absolute -top-1 -right-1 bg-[var(--accent)] text-white text-[9px] px-0.5 rounded-full leading-none">
                    +{ticket.photoUrls.length - 1}
                  </span>
                )}
              </div>
            )}

            {/* Quick actions - more compact, visible on mobile */}
            <div className={`flex gap-0.5 flex-shrink-0 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
              {(ticket.status === 'open' || ticket.status === 'in-progress') && (
                <button
                  onClick={handleResolveClick}
                  className="p-2 text-green-500 hover:bg-green-500/10 rounded transition-colors touch-manipulation"
                  style={{ minWidth: '36px', minHeight: '36px' }}
                  title="Resolve"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              )}
              {ticket.status !== 'archived' && (
                <button
                  onClick={handleArchiveClick}
                  className="p-2 text-gray-500 hover:bg-gray-500/10 rounded transition-colors touch-manipulation"
                  style={{ minWidth: '36px', minHeight: '36px' }}
                  title="Archive"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for memo
  // Only re-render if these specific props change
  return (
    prevProps.ticket.id === nextProps.ticket.id &&
    prevProps.ticket.status === nextProps.ticket.status &&
    prevProps.ticket.updatedAt === nextProps.ticket.updatedAt &&
    prevProps.ticket.comments.length === nextProps.ticket.comments.length &&
    prevProps.isMobile === nextProps.isMobile
  );
});

TicketCard.displayName = 'TicketCard';

export default TicketCard;