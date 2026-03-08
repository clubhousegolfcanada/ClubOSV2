import React from 'react';

interface ReceiptFiltersProps {
  filters: {
    category: string;
    location: string;
    source: string;
    reconciled: string;
  };
  onChange: (filters: ReceiptFiltersProps['filters']) => void;
}

const CATEGORIES = ['Supplies', 'Equipment', 'Services', 'Food', 'Office', 'Utilities', 'Fuel', 'Software', 'Other'];
const LOCATIONS = ['Bedford', 'Dartmouth', 'Bayers Lake', 'Truro', 'Stratford', 'River Oaks'];

const selectClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export const ReceiptFilters: React.FC<ReceiptFiltersProps> = ({ filters, onChange }) => {
  const update = (key: string, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <select
        value={filters.category}
        onChange={(e) => update('category', e.target.value)}
        className={selectClass}
      >
        <option value="">All Categories</option>
        {CATEGORIES.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select
        value={filters.location}
        onChange={(e) => update('location', e.target.value)}
        className={selectClass}
      >
        <option value="">All Locations</option>
        {LOCATIONS.map(l => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>

      <select
        value={filters.source}
        onChange={(e) => update('source', e.target.value)}
        className={selectClass}
      >
        <option value="">All Sources</option>
        <option value="terminal">Terminal</option>
        <option value="gmail">Gmail</option>
      </select>

      <select
        value={filters.reconciled}
        onChange={(e) => update('reconciled', e.target.value)}
        className={selectClass}
      >
        <option value="">All Status</option>
        <option value="true">Reconciled</option>
        <option value="false">Unreconciled</option>
      </select>
    </div>
  );
};
