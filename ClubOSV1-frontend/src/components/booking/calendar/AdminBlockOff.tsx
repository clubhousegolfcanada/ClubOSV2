import React, { useState } from 'react';
import { Space } from './BookingCalendar';
import Button from '@/components/ui/Button';

interface AdminBlockOffProps {
  spaces: Space[];
  onBlock: (blockData: {
    startAt: Date;
    endAt: Date;
    spaceIds: string[];
    reason: string;
  }) => void;
  onCancel: () => void;
}

// Placeholder component - will be implemented in future iteration
const AdminBlockOff: React.FC<AdminBlockOffProps> = ({
  spaces,
  onBlock,
  onCancel
}) => {
  const [reason, setReason] = useState('');
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);

  return (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)]">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Admin Block-Off Time</h3>

      <div className="space-y-3">
        <div className="form-group">
          <label className="form-label">Reason for Block</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Maintenance, Cleaning, Private Event"
            className="form-input"
          />
        </div>

        <div className="text-sm text-[var(--text-secondary)] bg-[var(--bg-secondary)] p-3 rounded-md">
          <p>Select time slots on the calendar to block them off.</p>
          <p className="mt-1 text-[var(--text-muted)]">This feature will be fully implemented in the next iteration.</p>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!reason}
            onClick={() => {
              // Placeholder - will be implemented
              alert('Admin block feature coming soon');
            }}
          >
            Block Time
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminBlockOff;