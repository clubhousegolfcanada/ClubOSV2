import React from 'react';
import { Calendar, Repeat } from 'lucide-react';
import Toggle from '@/components/Toggle';

interface RecurringPattern {
  frequency: 'weekly' | 'biweekly' | 'monthly';
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday
  endDate?: string;
  occurrences?: number;
}

interface RecurringBookingOptionsProps {
  enabled: boolean;
  pattern?: RecurringPattern;
  onChange: (enabled: boolean, pattern?: RecurringPattern) => void;
}

export default function RecurringBookingOptions({
  enabled,
  pattern,
  onChange
}: RecurringBookingOptionsProps) {
  const handlePatternChange = (updates: Partial<RecurringPattern>) => {
    const newPattern = { ...pattern, ...updates } as RecurringPattern;
    onChange(enabled, newPattern);
  };

  const daysOfWeek = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' }
  ];

  return (
    <div className="space-y-3 p-4 bg-purple-50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-purple-600" />
          <span className="font-medium">Recurring Booking</span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
            Standard Members Only
          </span>
        </div>
        <Toggle
          enabled={enabled}
          onChange={(checked: boolean) => onChange(checked, checked ? pattern || { frequency: 'weekly' } : undefined)}
        />
      </div>

      {enabled && (
        <div className="space-y-3 pt-2">
          {/* Frequency Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Frequency</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Bi-weekly' },
                { value: 'monthly', label: 'Monthly' }
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePatternChange({ frequency: option.value as any })}
                  className={`p-2 text-sm border rounded-lg transition-colors ${
                    pattern?.frequency === option.value
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white hover:bg-gray-50 border-gray-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Days of Week (for weekly/biweekly) */}
          {(pattern?.frequency === 'weekly' || pattern?.frequency === 'biweekly') && (
            <div>
              <label className="block text-sm font-medium mb-1">Repeat on</label>
              <div className="flex gap-1">
                {daysOfWeek.map(day => {
                  const isSelected = pattern?.daysOfWeek?.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        const current = pattern?.daysOfWeek || [];
                        const updated = isSelected
                          ? current.filter(d => d !== day.value)
                          : [...current, day.value];
                        handlePatternChange({ daysOfWeek: updated });
                      }}
                      className={`w-10 h-10 text-xs rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-purple-600 text-white'
                          : 'bg-white hover:bg-gray-50 border border-gray-300'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* End Condition */}
          <div>
            <label className="block text-sm font-medium mb-1">End</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="end-condition"
                  checked={!!pattern?.occurrences}
                  onChange={() => handlePatternChange({ occurrences: 10, endDate: undefined })}
                />
                <span className="text-sm">After</span>
                <input
                  type="number"
                  min="2"
                  max="52"
                  value={pattern?.occurrences || 10}
                  onChange={(e) => handlePatternChange({ occurrences: parseInt(e.target.value) })}
                  disabled={!pattern?.occurrences}
                  className="w-16 px-2 py-1 text-sm border rounded"
                />
                <span className="text-sm">occurrences</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="end-condition"
                  checked={!!pattern?.endDate}
                  onChange={() => handlePatternChange({ endDate: '', occurrences: undefined })}
                />
                <span className="text-sm">On date</span>
                <input
                  type="date"
                  value={pattern?.endDate || ''}
                  onChange={(e) => handlePatternChange({ endDate: e.target.value })}
                  disabled={!pattern?.endDate && pattern?.endDate !== ''}
                  min={new Date().toISOString().split('T')[0]}
                  className="px-2 py-1 text-sm border rounded"
                />
              </label>
            </div>
          </div>

          {/* Summary */}
          <div className="p-2 bg-purple-100 rounded text-sm text-purple-800">
            <Calendar className="inline w-3 h-3 mr-1" />
            {getSummaryText(pattern)}
          </div>
        </div>
      )}
    </div>
  );
}

function getSummaryText(pattern?: RecurringPattern): string {
  if (!pattern) return 'No recurring pattern set';

  let summary = `Repeats ${pattern.frequency}`;

  if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const days = pattern.daysOfWeek.map(d => dayNames[d]).join(', ');
    summary += ` on ${days}`;
  }

  if (pattern.occurrences) {
    summary += ` for ${pattern.occurrences} times`;
  } else if (pattern.endDate) {
    summary += ` until ${new Date(pattern.endDate).toLocaleDateString()}`;
  }

  return summary;
}