import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { http } from '@/api/http';
import logger from '@/services/logger';

interface GmailScanCardProps {
  year: number;
  month: number;
  onScanComplete: () => void;
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const GmailScanCard: React.FC<GmailScanCardProps> = ({ year, month, onScanComplete }) => {
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ found: number } | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await http.get('gmail/status');
      setStatus(response.data);
      setNotConfigured(false);
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 500) {
        setNotConfigured(true);
      }
      logger.debug('Gmail status fetch failed:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      const response = await http.post('gmail/scan', {
        startDate: `after:${year}/${String(month).padStart(2, '0')}/01 before:${month === 12 ? year + 1 : year}/${String(month === 12 ? 1 : month + 1).padStart(2, '0')}/01`
      });
      const data = response.data;
      setResult({ found: data.receiptsCreated || data.totalProcessed || 0 });
      onScanComplete();
      fetchStatus();
    } catch (err: any) {
      logger.error('Gmail scan failed:', err);
      setError(err.response?.data?.message || err.response?.data?.error || 'Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Mail className="w-5 h-5 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Gmail Scanner</h3>
      </div>

      {notConfigured ? (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500">Gmail scanning is not configured. Set up OAuth credentials on the backend to enable this feature.</p>
        </div>
      ) : (
        <>
          {!statusLoading && status && (
            <div className="space-y-2 mb-4 text-sm text-gray-600">
              {status.lastScanTime && (
                <div className="flex justify-between">
                  <span>Last scan</span>
                  <span className="font-medium">{new Date(status.lastScanTime).toLocaleDateString()}</span>
                </div>
              )}
              {typeof status.totalScanned === 'number' && (
                <div className="flex justify-between">
                  <span>Emails scanned</span>
                  <span className="font-medium">{status.totalScanned}</span>
                </div>
              )}
              {typeof status.totalReceipts === 'number' && (
                <div className="flex justify-between">
                  <span>Receipts found</span>
                  <span className="font-medium">{status.totalReceipts}</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-700">
                Found {result.found} receipt{result.found !== 1 ? 's' : ''} from {monthLabel}
              </p>
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={scanning}
            className={`w-full py-2 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              scanning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {scanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Scan {monthLabel}
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};
