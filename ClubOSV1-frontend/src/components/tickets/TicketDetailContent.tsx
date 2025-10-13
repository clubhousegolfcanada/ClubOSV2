import React, { memo } from 'react';
import type { TicketDetailContentProps, TicketStatus } from '@/types/ticket.types';

/**
 * TicketDetailContent Component
 * Shared content between mobile and desktop ticket detail views
 * Displays ticket information, photos, comments, and allows status updates
 */
const TicketDetailContent: React.FC<TicketDetailContentProps> = memo(({
  ticket,
  onUpdateStatus,
  onAddComment,
  newComment,
  setNewComment,
  priorityConfig,
  getStatusConfig
}) => {
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateStatus(ticket.id, e.target.value as TicketStatus);
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewComment(e.target.value);
  };

  const handlePhotoClick = (photo: string) => {
    window.open(photo, '_blank');
  };

  return (
    <div className="p-4 space-y-4">
      {/* Title and Description */}
      <div>
        <h3 className="font-medium text-lg mb-2 text-[var(--text-primary)]">{ticket.title}</h3>
        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
          {ticket.description}
        </p>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
          <span className="text-[var(--text-muted)] text-xs block mb-1">Status</span>
          <select
            value={ticket.status}
            onChange={handleStatusChange}
            className={`w-full px-2 py-1 rounded-md text-sm font-medium border-0 cursor-pointer transition-all
              ${getStatusConfig(ticket.status).bg} ${getStatusConfig(ticket.status).text}
              focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1
            `}
            style={{ backgroundColor: 'transparent' }}
          >
            {(['open', 'in-progress', 'resolved', 'closed', 'archived'] as TicketStatus[]).map(status => (
              <option
                key={status}
                value={status}
                className="bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                {getStatusConfig(status).label}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
          <span className="text-[var(--text-muted)] text-xs">Priority</span>
          <div className="mt-1 flex items-center gap-1">
            {priorityConfig[ticket.priority].icon}
            <span className="capitalize">{ticket.priority}</span>
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
          <span className="text-[var(--text-muted)] text-xs">Category</span>
          <div className="mt-1 capitalize">{ticket.category}</div>
        </div>
        {ticket.location && (
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <span className="text-[var(--text-muted)] text-xs">Location</span>
            <div className="mt-1">{ticket.location}</div>
          </div>
        )}
      </div>

      {/* Photos */}
      {ticket.photoUrls && ticket.photoUrls.length > 0 && (
        <div>
          <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Photos ({ticket.photoUrls.length})
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {ticket.photoUrls.map((photo, index) => (
              <img
                key={index}
                src={photo}
                alt={`Photo ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => handlePhotoClick(photo)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div>
        <h4 className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
          Comments ({ticket.comments?.length || 0})
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {!ticket.comments || ticket.comments.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">No comments yet</p>
          ) : (
            ticket.comments.map(comment => (
              <div key={comment.id} className="bg-[var(--bg-secondary)] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{comment.createdBy?.name || 'Unknown User'}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">{comment.text}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Comment */}
      <div>
        <textarea
          value={newComment}
          onChange={handleCommentChange}
          placeholder="Add a comment..."
          className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors touch-manipulation"
          rows={3}
          style={{ minHeight: '80px' }}
        />
        <button
          onClick={onAddComment}
          disabled={!newComment.trim()}
          className="mt-2 px-4 py-3 bg-[var(--accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-all duration-200 touch-manipulation"
          style={{ minHeight: '48px' }}
        >
          Add Comment
        </button>
      </div>
    </div>
  );
});

TicketDetailContent.displayName = 'TicketDetailContent';

export default TicketDetailContent;