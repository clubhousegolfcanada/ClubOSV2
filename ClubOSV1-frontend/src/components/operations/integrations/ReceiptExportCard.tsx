import React, { useState, useEffect } from 'react';
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
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExportTime, setLastExportTime] = useState<string | null>(
    localStorage.getItem('lastReceiptExport')
  );

  // Fetch summary on mount and when period changes
  useEffect(() => {
    fetchSummary();
  }, [period]);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(`receipts/summary?period=${period}`);
      setSummary(response.data);
    } catch (err) {
      console.error('Failed to fetch receipt summary:', err);
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

      // Use the base API URL from environment or fallback to localhost
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
      const exportUrl = `${baseUrl}/api/receipts/export?${params.toString()}`;

      // Get the auth token
      const token = localStorage.getItem('authToken');

      // Create a download link
      const response = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `receipts_${period}_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download the file
      const blob = await response.blob();
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
    } catch (err) {
      console.error('Failed to export receipts:', err);
      setError('Failed to export receipts');
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
            <option value="month">This Month</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>
        </div>

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
            <option value="pdf" disabled>PDF (Coming Soon)</option>
          </select>
        </div>
      </div>

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