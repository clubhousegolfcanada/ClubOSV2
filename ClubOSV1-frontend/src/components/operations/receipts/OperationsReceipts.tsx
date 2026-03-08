import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Download, CheckSquare } from 'lucide-react';
import { http } from '@/api/http';
import logger from '@/services/logger';
import { ReceiptFilters } from './ReceiptFilters';
import { ReceiptTable } from './ReceiptTable';
import { MonthlySummaryCard } from './MonthlySummaryCard';
import { GmailScanCard } from './GmailScanCard';

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const OperationsReceipts: React.FC = () => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('purchase_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ category: '', location: '', source: '', reconciled: '' });
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const monthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

  const fetchReceipts = useCallback(async () => {
    setLoadingReceipts(true);
    try {
      const dateFrom = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const dateTo = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        page: String(page),
        limit: '20',
        sort: sortBy,
        dir: sortDir,
      });
      if (filters.category) params.append('category', filters.category);
      if (filters.location) params.append('location', filters.location);
      if (filters.source) params.append('source', filters.source);
      if (filters.reconciled) params.append('reconciled', filters.reconciled);

      const response = await http.get(`receipts/search?${params}`);
      const data = response.data?.data || response.data;
      setReceipts(data.receipts || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      logger.error('Failed to fetch receipts:', err);
    } finally {
      setLoadingReceipts(false);
    }
  }, [selectedYear, selectedMonth, page, sortBy, sortDir, filters]);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const response = await http.get(`receipts/summary?period=month&year=${selectedYear}&month=${selectedMonth}`);
      setSummary(response.data);
    } catch (err) {
      logger.error('Failed to fetch summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters, sortBy, sortDir]);

  // Clear selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [receipts]);

  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(y => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(m => m - 1);
    }
    setPage(1);
  };

  const goToNextMonth = () => {
    const isCurrentOrFuture = selectedYear === now.getFullYear() && selectedMonth >= now.getMonth() + 1;
    if (isCurrentOrFuture) return;
    if (selectedMonth === 12) {
      setSelectedYear(y => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth(m => m + 1);
    }
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (receipts.every(r => selectedIds.has(r.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(receipts.map(r => r.id)));
    }
  };

  const handleBulkReconcile = async () => {
    if (selectedIds.size === 0) return;
    setReconciling(true);
    try {
      await http.post('receipts/reconcile', { receiptIds: Array.from(selectedIds) });
      setSelectedIds(new Set());
      fetchReceipts();
      fetchSummary();
    } catch (err) {
      logger.error('Bulk reconcile failed:', err);
    } finally {
      setReconciling(false);
    }
  };

  const handleExport = async (format: 'csv' | 'zip') => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        period: 'month',
        format,
        year: String(selectedYear),
        month: String(selectedMonth),
      });
      const response = await http.get(`receipts/export?${params}`, { responseType: 'blob' });
      const blob = response.data;
      const ext = format === 'zip' ? 'zip' : 'csv';
      const filename = `receipts_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.${ext}`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      logger.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const isNextDisabled = selectedYear === now.getFullYear() && selectedMonth >= now.getMonth() + 1;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={goToPrevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-900 min-w-[200px] text-center">
          {monthLabel}
        </h2>
        <button
          onClick={goToNextMonth}
          disabled={isNextDisabled}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GmailScanCard
          year={selectedYear}
          month={selectedMonth}
          onScanComplete={() => { fetchReceipts(); fetchSummary(); }}
        />
        <MonthlySummaryCard summary={summary} loading={loadingSummary} />
      </div>

      {/* Filters */}
      <ReceiptFilters filters={filters} onChange={setFilters} />

      {/* Receipt Table */}
      <ReceiptTable
        receipts={receipts}
        loading={loadingReceipts}
        page={page}
        totalPages={totalPages}
        total={total}
        sortBy={sortBy}
        sortDir={sortDir}
        selectedIds={selectedIds}
        onSort={handleSort}
        onPageChange={setPage}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        monthLabel={monthLabel}
      />

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <button
          onClick={handleBulkReconcile}
          disabled={selectedIds.size === 0 || reconciling}
          className="px-4 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400"
        >
          <CheckSquare className="w-4 h-4" />
          {reconciling ? 'Reconciling...' : `Reconcile (${selectedIds.size})`}
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting || total === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => handleExport('zip')}
            disabled={exporting || total === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            ZIP
          </button>
        </div>
      </div>
    </div>
  );
};
