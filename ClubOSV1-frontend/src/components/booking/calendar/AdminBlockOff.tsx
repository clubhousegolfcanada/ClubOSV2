import React, { useState, useEffect } from 'react';
import { Space } from './BookingCalendar';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { Calendar, Clock, AlertTriangle, MapPin, Ban } from 'lucide-react';
import { format, addHours, startOfHour, isBefore, isAfter } from 'date-fns';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';

interface AdminBlockOffProps {
  spaces: Space[];
  initialDate?: Date;
  onBlock: (blockData: {
    startAt: Date;
    endAt: Date;
    spaceIds: string[];
    reason: string;
    isRecurring?: boolean;
    recurringPattern?: string;
  }) => void;
  onCancel: () => void;
}

const AdminBlockOff: React.FC<AdminBlockOffProps> = ({
  spaces,
  initialDate = new Date(),
  onBlock,
  onCancel
}) => {
  const { notify } = useNotifications();
  const [loading, setLoading] = useState(false);

  // Form state
  const [reason, setReason] = useState('');
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [blockAll, setBlockAll] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState('daily');

  // Common reasons for quick selection
  const commonReasons = [
    'Maintenance',
    'Cleaning',
    'Private Event',
    'Staff Training',
    'Equipment Upgrade',
    'Holiday Closure'
  ];

  useEffect(() => {
    // Initialize dates with sensible defaults
    const now = startOfHour(addHours(new Date(), 1)); // Next hour
    const end = addHours(now, 2); // 2 hours later

    setStartDate(format(now, 'yyyy-MM-dd'));
    setStartTime(format(now, 'HH:mm'));
    setEndDate(format(end, 'yyyy-MM-dd'));
    setEndTime(format(end, 'HH:mm'));
  }, []);

  const toggleSpace = (spaceId: string) => {
    setSelectedSpaces(prev =>
      prev.includes(spaceId)
        ? prev.filter(id => id !== spaceId)
        : [...prev, spaceId]
    );
  };

  const toggleAllSpaces = () => {
    if (blockAll) {
      setSelectedSpaces([]);
    } else {
      setSelectedSpaces(spaces.map(s => s.id));
    }
    setBlockAll(!blockAll);
  };

  const validateForm = () => {
    if (!reason.trim()) {
      notify('error', 'Please provide a reason for the block-off');
      return false;
    }

    if (selectedSpaces.length === 0) {
      notify('error', 'Please select at least one space to block');
      return false;
    }

    if (!startDate || !startTime || !endDate || !endTime) {
      notify('error', 'Please select start and end times');
      return false;
    }

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    if (isBefore(end, start)) {
      notify('error', 'End time must be after start time');
      return false;
    }

    if (isBefore(start, new Date())) {
      notify('error', 'Cannot create blocks in the past');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);

      // Call the onBlock callback with the block data
      await onBlock({
        startAt: start,
        endAt: end,
        spaceIds: selectedSpaces,
        reason,
        isRecurring,
        recurringPattern: isRecurring ? recurringPattern : undefined
      });

      // Also create the block via API
      const response = await http.post('/bookings/admin-block', {
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        space_ids: selectedSpaces,
        reason,
        is_recurring: isRecurring,
        recurring_pattern: isRecurring ? recurringPattern : null
      });

      if (response.data.success) {
        notify('success', `Block-off created successfully`);
      }
    } catch (error: any) {
      notify('error', error.response?.data?.error || 'Failed to create block-off');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)] shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <Ban className="w-5 h-5 text-[var(--status-error)]" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Block Time Slots</h3>
        <StatusBadge status="error" label="Admin Only" />
      </div>

      <div className="space-y-4">
        {/* Reason Input */}
        <div className="form-group">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Reason for Block <span className="text-[var(--status-error)]">*</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason..."
            className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] text-[var(--text-primary)]"
            autoFocus
          />
          {/* Quick reason buttons */}
          <div className="flex flex-wrap gap-2 mt-2">
            {commonReasons.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className="px-3 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] rounded-full transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Date/Time Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Start Date & Time
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
              />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-24 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              <Clock className="inline w-4 h-4 mr-1" />
              End Date & Time
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-24 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Space Selection */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            <MapPin className="inline w-4 h-4 mr-1" />
            Select Spaces to Block
          </label>

          {/* Block All Toggle */}
          <div className="mb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={blockAll}
                onChange={toggleAllSpaces}
                className="w-4 h-4 rounded border-[var(--border-primary)] text-[var(--accent)]"
              />
              <span className="text-sm text-[var(--text-primary)]">Block all spaces</span>
            </label>
          </div>

          {/* Individual Space Selection */}
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-3 bg-[var(--bg-secondary)] rounded-lg">
            {spaces.map((space) => (
              <label key={space.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSpaces.includes(space.id)}
                  onChange={() => toggleSpace(space.id)}
                  className="w-4 h-4 rounded border-[var(--border-primary)] text-[var(--accent)]"
                />
                <span className="text-sm text-[var(--text-primary)]">{space.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Recurring Option */}
        <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border-primary)] text-[var(--accent)]"
            />
            <span className="text-sm font-medium text-[var(--text-primary)]">Make this a recurring block</span>
          </label>

          {isRecurring && (
            <select
              value={recurringPattern}
              onChange={(e) => setRecurringPattern(e.target.value)}
              className="w-full mt-2 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)]"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          )}
        </div>

        {/* Warning Message */}
        <div className="flex items-start gap-2 p-3 bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-[var(--status-warning)] mt-0.5" />
          <p className="text-sm text-[var(--text-secondary)]">
            This will prevent customers from booking these time slots. Existing bookings will need to be handled separately.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            disabled={loading || !reason || selectedSpaces.length === 0}
          >
            {loading ? 'Creating Block...' : 'Block Time Slots'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminBlockOff;