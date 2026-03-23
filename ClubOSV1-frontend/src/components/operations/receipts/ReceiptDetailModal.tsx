import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertTriangle, FileText, Image } from 'lucide-react';
import { http } from '@/api/http';
import logger from '@/services/logger';

interface ReceiptDetailModalProps {
  receiptId: string;
  onClose: () => void;
  onSaved: () => void;
  onViewReceipt?: (id: string) => void;
}

const CATEGORIES = [
  'Supplies', 'Equipment', 'Services', 'Food', 'Office', 'Utilities',
  'Fuel', 'Software', 'Advertising', 'Insurance', 'Rent', 'Maintenance',
  'Professional Fees', 'Shipping', 'Other'
];

const LOCATIONS = ['Bedford', 'Dartmouth', 'Bayers Lake', 'Truro', 'Stratford', 'River Oaks'];

export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({ receiptId, onClose, onSaved, onViewReceipt }) => {
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Editable fields
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [hst, setHst] = useState('');
  const [tax, setTax] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchReceipt();
  }, [receiptId]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const fetchReceipt = async () => {
    setLoading(true);
    try {
      const response = await http.get(`receipts/${receiptId}`);
      const r = response.data?.data || response.data;
      setReceipt(r);
      setVendor(r.vendor || '');
      setAmount(r.amount_cents ? (r.amount_cents / 100).toFixed(2) : '');
      setHst(r.hst_cents ? (r.hst_cents / 100).toFixed(2) : '');
      setTax(r.tax_cents ? (r.tax_cents / 100).toFixed(2) : '');
      setPurchaseDate(r.purchase_date ? r.purchase_date.slice(0, 10) : '');
      setCategory(r.category || '');
      setLocation(r.club_location || '');
      setNotes(r.notes || '');
    } catch (err) {
      setError('Failed to load receipt');
      logger.error('Failed to fetch receipt:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const amountCents = amount ? Math.round(parseFloat(amount) * 100) : null;
      const hstCents = hst ? Math.round(parseFloat(hst) * 100) : null;

      await http.patch(`receipts/${receiptId}`, {
        vendor: vendor || null,
        amount_cents: amountCents,
        purchase_date: purchaseDate || null,
        category: category || null,
        club_location: location || null,
        notes: notes || null,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
      logger.error('Failed to save receipt:', err);
    } finally {
      setSaving(false);
    }
  };

  const isLowConfidence = receipt && (receipt.ocr_confidence < 0.7 || receipt.ocr_confidence === null);
  const hasSuspiciousDate = purchaseDate && parseInt(purchaseDate.slice(0, 4)) < 2020;

  // Determine image src from file_data
  const imageSrc = receipt?.file_data?.startsWith('data:') ? receipt.file_data : null;
  const isPdf = receipt?.mime_type === 'application/pdf' || receipt?.file_data?.startsWith('data:application/pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Receipt Details</h2>
            {isLowConfidence && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded-full border border-yellow-200">
                <AlertTriangle className="w-3 h-3" /> Needs Review
              </span>
            )}
            {receipt?.ocr_confidence != null && (
              <span className="text-xs text-gray-400">
                OCR {Math.round(receipt.ocr_confidence * 100)}%
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Fuzzy duplicate warning banner */}
            {receipt?.fuzzy_duplicate_of && (
              <div className="mx-6 mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                  <p className="text-sm text-orange-700">
                    Possible duplicate of another receipt.
                  </p>
                </div>
                {onViewReceipt && (
                  <button
                    onClick={() => onViewReceipt(receipt.fuzzy_duplicate_of)}
                    className="text-sm text-orange-700 font-medium hover:text-orange-900 underline whitespace-nowrap"
                  >
                    View Original
                  </button>
                )}
              </div>
            )}
            <div className="flex flex-col lg:flex-row">
              {/* Left: Image/PDF viewer */}
              <div className="lg:w-1/2 p-6 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50 flex items-center justify-center min-h-[300px]">
                {imageSrc ? (
                  isPdf ? (
                    <div className="text-center">
                      <FileText className="w-16 h-16 text-red-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 mb-3">{receipt.file_name}</p>
                      <a
                        href={imageSrc}
                        download={receipt.file_name || 'receipt.pdf'}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        Download PDF
                      </a>
                    </div>
                  ) : (
                    <img
                      src={imageSrc}
                      alt="Receipt"
                      className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
                    />
                  )
                ) : (
                  <div className="text-center text-gray-400">
                    <Image className="w-16 h-16 mx-auto mb-2" />
                    <p className="text-sm">No image available</p>
                  </div>
                )}
              </div>

              {/* Right: Edit form */}
              <div className="lg:w-1/2 p-6">
                <div className="space-y-4">
                  {/* Vendor */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Vendor</label>
                    <input
                      type="text"
                      value={vendor}
                      onChange={e => setVendor(e.target.value)}
                      placeholder="Business name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Amount + HST + Tax row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Amount ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">HST ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={hst}
                        onChange={e => setHst(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Tax ($)</label>
                      <div
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
                        title="Tax amount from OCR (read-only)"
                      >
                        {tax || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                      Purchase Date
                      {hasSuspiciousDate && (
                        <span className="ml-2 text-yellow-600 normal-case font-normal">
                          <AlertTriangle className="w-3 h-3 inline" /> Date looks old — please verify
                        </span>
                      )}
                    </label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={e => setPurchaseDate(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        hasSuspiciousDate ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'
                      }`}
                    />
                  </div>

                  {/* Category + Location row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Category</label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select...</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Location</label>
                      <select
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select...</option>
                        {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Notes</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Add notes..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                  </div>

                  {/* Metadata (read-only) */}
                  <div className="pt-3 border-t border-gray-200 text-xs text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>File</span>
                      <span>{receipt?.file_name || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Source</span>
                      <span>{receipt?.source || 'upload'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uploaded</span>
                      <span>{receipt?.created_at ? new Date(receipt.created_at).toLocaleDateString() : '—'}</span>
                    </div>
                    {receipt?.uploader_name && (
                      <div className="flex justify-between">
                        <span>By</span>
                        <span>{receipt.uploader_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">Saved!</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
