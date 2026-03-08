import React from 'react';
import { ChevronUp, ChevronDown, CheckCircle, Circle, Mail, Smartphone, Receipt } from 'lucide-react';

interface ReceiptTableProps {
  receipts: any[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  selectedIds: Set<string>;
  onSort: (column: string) => void;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  monthLabel: string;
}

const LOCATION_ABBR: Record<string, string> = {
  'Bedford': 'Bed',
  'Dartmouth': 'Dart',
  'Bayers Lake': 'BL',
  'Truro': 'Tru',
  'Stratford': 'Strat',
  'River Oaks': 'RO',
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatCents = (cents: number | null) => {
  if (!cents && cents !== 0) return '—';
  return `$${(cents / 100).toFixed(2)}`;
};

const SortHeader: React.FC<{
  label: string;
  column: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: string) => void;
}> = ({ label, column, sortBy, sortDir, onSort }) => (
  <th
    className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2 cursor-pointer hover:text-gray-700 select-none"
    onClick={() => onSort(column)}
  >
    <span className="flex items-center gap-1">
      {label}
      {sortBy === column ? (
        sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : null}
    </span>
  </th>
);

export const ReceiptTable: React.FC<ReceiptTableProps> = ({
  receipts,
  loading,
  page,
  totalPages,
  total,
  sortBy,
  sortDir,
  selectedIds,
  onSort,
  onPageChange,
  onSelect,
  onSelectAll,
  monthLabel,
}) => {
  const allSelected = receipts.length > 0 && receipts.every(r => selectedIds.has(r.id));
  const start = (page - 1) * 20 + 1;
  const end = Math.min(page * 20, total);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No receipts found for {monthLabel}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <SortHeader label="Date" column="purchase_date" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Vendor" column="vendor" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Amount" column="amount_cents" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2">HST</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2">Category</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2">Location</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2">Src</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {receipts.map((r) => (
              <tr
                key={r.id}
                className={`hover:bg-gray-50 transition-colors ${selectedIds.has(r.id) ? 'bg-blue-50' : ''}`}
              >
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => onSelect(r.id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                  {formatDate(r.purchase_date || r.created_at)}
                </td>
                <td className="px-3 py-2.5 text-sm max-w-[200px] truncate" title={r.vendor || ''}>
                  {r.vendor || <span className="text-gray-400 italic">Unknown</span>}
                </td>
                <td className="px-3 py-2.5 text-sm font-medium whitespace-nowrap">
                  {formatCents(r.amount_cents)}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                  {formatCents(r.hst_cents)}
                </td>
                <td className="px-3 py-2.5">
                  {r.category ? (
                    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                      {r.category}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-nowrap">
                  {r.club_location ? LOCATION_ABBR[r.club_location] || r.club_location : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <span title={r.source === 'gmail' ? 'Gmail' : 'Terminal'}>
                    {r.source === 'gmail' ? (
                      <Mail className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-gray-400" />
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span title={r.reconciled ? 'Reconciled' : 'Unreconciled'}>
                    {r.reconciled ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300" />
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
        <span className="text-sm text-gray-500">
          Showing {start}–{end} of {total}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
