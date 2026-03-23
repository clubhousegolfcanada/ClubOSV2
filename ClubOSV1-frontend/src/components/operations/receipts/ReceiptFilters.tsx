import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ReceiptFiltersProps {
  filters: {
    category: string;
    location: string;
    source: string;
    reconciled: string;
    needs_review: string;
  };
  onChange: (filters: ReceiptFiltersProps['filters']) => void;
  needsReviewCount?: number;
}

const CATEGORIES = ['Supplies', 'Equipment', 'Services', 'Food', 'Office', 'Utilities', 'Fuel', 'Software', 'Advertising', 'Insurance', 'Rent', 'Maintenance', 'Professional Fees', 'Shipping', 'Other'];
const LOCATIONS = ['Bedford', 'Dartmouth', 'Bayers Lake', 'Truro', 'Stratford', 'River Oaks'];

const selectClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export const ReceiptFilters: React.FC<ReceiptFiltersProps> = ({ filters, onChange, needsReviewCount = 0 }) => {
  const update = (key: string, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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

        <button
          onClick={() => update('needs_review', filters.needs_review === 'true' ? '' : 'true')}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            filters.needs_review === 'true'
              ? 'bg-orange-100 text-orange-700 border-2 border-orange-300'
              : 'bg-white text-gray-600 border border-gray-300 hover:border-orange-300 hover:text-orange-600'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Needs Review
          {needsReviewCount > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full ${
              filters.needs_review === 'true'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-100 text-orange-700'
            }`}>
              {needsReviewCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
