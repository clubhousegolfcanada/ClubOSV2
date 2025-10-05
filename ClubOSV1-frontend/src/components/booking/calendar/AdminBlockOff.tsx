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
    <div className="p-4 bg-gray-50 rounded-md">
      <h3 className="text-sm font-medium mb-3">Admin Block-Off Time</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Reason for Block</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Maintenance, Cleaning, Private Event"
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>

        <div className="text-sm text-gray-500">
          <p>Select time slots on the calendar to block them off.</p>
          <p className="mt-1">This feature will be fully implemented in the next iteration.</p>
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