import React, { memo } from 'react';
import { X } from 'lucide-react';
import TicketDetailContent from './TicketDetailContent';
import type { TicketDetailModalProps } from '@/types/ticket.types';

/**
 * TicketDetailModal Component
 * Desktop modal for displaying ticket details
 * Uses TicketDetailContent for the main content
 */
const TicketDetailModal: React.FC<TicketDetailModalProps> = memo(({
  ticket,
  onClose,
  onUpdateStatus,
  onAddComment,
  newComment,
  setNewComment,
  priorityConfig,
  getStatusConfig
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-[var(--bg-primary)] w-full max-w-2xl max-h-[90vh] rounded-lg overflow-hidden flex flex-col animate-in fade-in-up duration-300">
        {/* Modal Header */}
        <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Ticket Details</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">#{ticket.id.slice(0, 8)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors touch-manipulation"
            style={{ minWidth: '48px', minHeight: '48px' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <TicketDetailContent
            ticket={ticket}
            onUpdateStatus={onUpdateStatus}
            onAddComment={onAddComment}
            newComment={newComment}
            setNewComment={setNewComment}
            priorityConfig={priorityConfig}
            getStatusConfig={getStatusConfig}
          />
        </div>
      </div>
    </div>
  );
});

TicketDetailModal.displayName = 'TicketDetailModal';

export default TicketDetailModal;