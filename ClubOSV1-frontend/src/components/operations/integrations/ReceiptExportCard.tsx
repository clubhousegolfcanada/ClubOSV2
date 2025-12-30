import React, { useState, useEffect } from 'react';
import logger from '@/services/logger';
import { Download, FileText, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { http } from '@/api/http';

interface ReceiptSummary {
  totalReceipts: number;
  totalAmount: number;
  totalTax: number;
  dateRange: {
    from: string | null;
    to: string | null;
  };
  lastExport: string | null;
}

const ReceiptExportCard: React.FC = () => {
  const [summary, setSummary] = useState<ReceiptSummary>({
    totalReceipts: 0,
    totalAmount: 0,
    totalTax: 0,
    dateRange: { from: null, to: null },
    lastExport: null
  });
  const [period, setPeriod] = useState<'all' | 'year' | 'month' | 'week'>('month');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'pdf' | 'zip'>('csv');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExportTime, setLastExportTime] = useState<string | null>(
    localStorage.getItem('lastReceiptExport')
  );

  // Generate last 12 months for the month picker
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      });
    }
    return options;
  };

  // Fetch summary on mount and when period/month changes
  useEffect(() => {
    fetchSummary();
  }, [period, selectedYear, selectedMonth]);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `receipts/summary?period=${period}`;
      // Include year/month for custom month selection
      if (period === 'month') {
        url += `&year=${selectedYear}&month=${selectedMonth}`;
      }
      const response = await http.get(url);
      setSummary(response.data);
    } catch (err) {
      logger.error('Failed to fetch receipt summary:', err);
      setError('Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      // Create the export URL with parameters
      const params = new URLSearchParams({
        period,
        format: exportFormat
      });

      // Include year/month for custom month selection
      if (period === 'month') {
        params.append('year', String(selectedYear));
        params.append('month', String(selectedMonth));
      }

      // Use http client to get the export data as blob
      const response = await http.get(`receipts/export?${params.toString()}`, {
        responseType: 'blob'
      });

      // Create blob from response data
      const blob = response.data;

      // Generate filename
      const extension = exportFormat === 'zip' ? 'zip' : exportFormat;
      const filename = `receipts_${period}_${new Date().toISOString().split('T')[0]}.${extension}`;

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Update last export time
      const now = new Date().toISOString();
      setLastExportTime(now);
      localStorage.setItem('lastReceiptExport', now);

      // Refresh summary
      fetchSummary();
    } catch (err: any) {
      logger.error('Failed to export receipts:', err);

      // Check if it's a response error with a message from backend
      if (err.response?.data) {
        // Handle different response types
        if (err.response.data instanceof Blob) {
          // If it's a blob, try to read it as text
          try {
            const text = await err.response.data.text();
            const errorData = JSON.parse(text);
            setError(errorData.message || 'Failed to export receipts');
          } catch {
            setError('Failed to export receipts. Please try a smaller date range.');
          }
        } else if (err.response.data.message) {
          setError(err.response.data.message);
        } else {
          setError('Failed to export receipts. Please try again.');
        }
      } else {
        setError('Failed to export receipts. Please check your connection and try again.');
      }
    } finally {
      setExporting(false);
    }
  };

  const formatLastExport = () => {
    if (!lastExportTime) return 'Never';

    const now = new Date();
    const exportDate = new Date(lastExportTime);
    const diffMs = now.getTime() - exportDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return exportDate.toLocaleDateString();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-100 rounded-lg">
          <FileText className="w-6 h-6 text-green-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Receipt Exports</h3>
          <p className="text-sm text-gray-500">Export receipts for accounting</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 mb-4">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Receipts</span>
            <span className="font-semibold text-gray-900">{summary.totalReceipts}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total Amount</span>
            <span className="font-semibold text-gray-900">
              ${summary.totalAmount.toFixed(2)}
            </span>
          </div>
          {summary.totalTax > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Tax</span>
              <span className="font-semibold text-gray-900">
                ${summary.totalTax.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Period
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={exporting}
          >
            <option value="week">This Week</option>
            <option value="month">By Month</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
        </div>

        {/* Month picker - appears when "By Month" is selected */}
        {period === 'month' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Month
            </label>
            <select
              value={`${selectedYear}-${selectedMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-');
                setSelectedYear(parseInt(y));
                setSelectedMonth(parseInt(m));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={exporting}
            >
              {getMonthOptions().map(opt => (
                <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Format
          </label>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={exporting}
          >
            <option value="csv">CSV (Excel)</option>
            <option value="json">JSON (Data)</option>
            <option value="zip">ZIP (With Photos)</option>
            <option value="pdf" disabled>PDF (Coming Soon)</option>
          </select>
        </div>
      </div>

      {/* Info for large exports with photos */}
      {exportFormat === 'zip' && (period === 'all' || period === 'year') && summary.totalReceipts > 50 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <strong>Large Export:</strong> Exporting {summary.totalReceipts} receipts with photos. This may take a moment to process.
          </div>
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={exporting || loading || summary.totalReceipts === 0}
        className={`w-full py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
          exporting || loading || summary.totalReceipts === 0
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {exporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export Receipts
          </>
        )}
      </button>

      <div className="mt-3 text-xs text-gray-500 text-center">
        Last export: {formatLastExport()}
      </div>
    </div>
  );
};

export default ReceiptExportCard;