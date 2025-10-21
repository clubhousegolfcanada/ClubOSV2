/**
 * ReceiptUploadModalSimple - Standalone receipt upload modal with OCR
 *
 * NOTE: This component is currently NOT USED in the main receipt flow.
 * The main receipt upload flow is handled inline in RequestForm.tsx when receipt mode is activated.
 *
 * This modal is kept for potential future use cases where a standalone receipt upload is needed
 * (e.g., bulk upload, separate receipt management page, etc.)
 *
 * Features:
 * - Receipt photo upload with OCR processing
 * - Personal card checkbox for reimbursement tracking
 * - Manual field editing after OCR
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Upload, Camera, Check, FileText, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';
import { ResponseDisplaySimple } from '../ResponseDisplaySimple';

interface ReceiptUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (receipt: any) => void;
  onProcessingChange?: (processing: boolean) => void;
}

interface ReceiptFormData {
  vendor?: string;
  amount?: string;
  purchaseDate?: string;
  location?: string;
  notes?: string;
  isPersonalCard?: boolean;
}

export const ReceiptUploadModal: React.FC<ReceiptUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
  onProcessingChange
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [ocrDisplay, setOcrDisplay] = useState<string>('');
  const [showOcrReview, setShowOcrReview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, setValue, watch, reset } = useForm<ReceiptFormData>();
  const { notify } = useNotifications();

  // Handle file selection - convert to base64 like tickets do
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      notify('error', 'Please select a PDF or image file (JPEG, PNG)');
      return;
    }

    // Validate file size (5MB max for base64, same as tickets)
    if (file.size > 5 * 1024 * 1024) {
      notify('error', 'File size must be less than 5MB');
      return;
    }

    setSelectedFile(file);

    // Convert to base64 data URL
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setFileDataUrl(dataUrl);

      // If it's an image, immediately process with OCR
      if (file.type.startsWith('image/')) {
        await processWithOCR(dataUrl, file.name, file.size, file.type);
      }
    };
    reader.readAsDataURL(file);
  }, [notify]);

  // Handle form submission
  const onSubmit = async (data: ReceiptFormData) => {
    if (!selectedFile || !fileDataUrl) {
      notify('error', 'Please select a file to upload');
      return;
    }

    setIsUploading(true);
    if (onProcessingChange) onProcessingChange(true);

    try {
      // Prepare data (similar to how tickets handle photos)
      const requestData = {
        file_data: fileDataUrl,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        vendor: data.vendor,
        amount_cents: data.amount ? Math.round(parseFloat(data.amount.replace(/[^\d.]/g, '')) * 100) : undefined,
        purchase_date: data.purchaseDate,
        club_location: data.location,
        notes: data.notes,
        is_personal_card: data.isPersonalCard || false
      };

      // Upload to backend
      const response = await http.post('receipts/upload', requestData);

      if (response.data.success) {
        const receipt = response.data.data;
        onUploadComplete(receipt);
        notify('success', 'Receipt uploaded successfully!');
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }

    } catch (error: any) {
      console.error('Receipt upload error:', error);
      notify('error', error.response?.data?.error || 'Failed to upload receipt');
    } finally {
      setIsUploading(false);
      if (onProcessingChange) onProcessingChange(false);
    }
  };

  // Process receipt with OCR
  const processWithOCR = async (dataUrl: string, fileName: string, fileSize: number, mimeType: string) => {
    setOcrProcessing(true);
    setShowOcrReview(false);
    if (onProcessingChange) onProcessingChange(true);

    try {
      // Send to backend for OCR processing
      const response = await http.post('receipts/upload', {
        file_data: dataUrl,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType
      });

      if (response.data.success && response.data.data.ocrResult) {
        const { ocrResult, ocrDisplay } = response.data.data;

        setOcrResult(ocrResult);
        setOcrDisplay(ocrDisplay);
        setShowOcrReview(true);

        // Auto-populate form fields with OCR data
        if (ocrResult.vendor) setValue('vendor', ocrResult.vendor);
        if (ocrResult.totalAmount) setValue('amount', `$${ocrResult.totalAmount.toFixed(2)}`);
        if (ocrResult.purchaseDate) setValue('purchaseDate', ocrResult.purchaseDate);
        if (ocrResult.category === 'Supplies' || ocrResult.category === 'Equipment') {
          setValue('location', 'Bedford'); // Default location, user can change
        }

        notify('success', `Receipt scanned! Confidence: ${Math.round((ocrResult.confidence || 0) * 100)}%`);
      } else {
        notify('warning', 'Could not extract receipt data. Please enter manually.');
      }
    } catch (error: any) {
      console.error('OCR processing error:', error);
      notify('error', 'Failed to scan receipt. Please enter details manually.');
    } finally {
      setOcrProcessing(false);
      if (onProcessingChange) onProcessingChange(false);
    }
  };

  // Handle camera capture for mobile
  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment' as any;
    input.onchange = (e: any) => handleFileSelect(e);
    input.click();
  };

  // Handle manual save after review
  const handleSaveReceipt = async () => {
    // The receipt is already saved in database from OCR processing
    // Just notify and close
    onUploadComplete(ocrResult);
    notify('success', 'Receipt saved successfully!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Upload Receipt</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">

            {/* OCR Processing State */}
            {ocrProcessing && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--accent)]" />
                  <p className="text-sm font-medium text-[var(--text-primary)]">Scanning receipt...</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Using AI to extract information</p>
                </div>
              </div>
            )}

            {/* OCR Results Display */}
            {showOcrReview && ocrDisplay && !ocrProcessing && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[var(--text-primary)]">Receipt Scan Results</h3>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border-secondary)]">
                  <ResponseDisplaySimple
                    response={{
                      response: ocrDisplay,
                      confidence: ocrResult?.confidence,
                      status: 'completed',
                      route: 'OCR',
                      dataSource: 'OpenAI Vision'
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Check className="w-3 h-3 text-green-500" />
                  <span>Data has been extracted and filled below. You can edit if needed.</span>
                </div>
              </div>
            )}

            {/* File Selection */}
            {!selectedFile && !ocrProcessing && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 p-4 border-2 border-dashed border-[var(--border-secondary)] rounded-lg hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all text-center"
                  >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
                    <p className="text-sm font-medium">Choose File</p>
                    <p className="text-xs text-[var(--text-muted)]">PDF or Image (max 5MB)</p>
                  </button>

                  <button
                    type="button"
                    onClick={handleCameraCapture}
                    className="flex-1 p-4 border-2 border-dashed border-[var(--border-secondary)] rounded-lg hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all text-center"
                  >
                    <Camera className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
                    <p className="text-sm font-medium">Take Photo</p>
                    <p className="text-xs text-[var(--text-muted)]">Use device camera</p>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {/* File Preview */}
            {selectedFile && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Selected File</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setFileDataUrl('');
                    }}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Change File
                  </button>
                </div>

                {fileDataUrl && selectedFile.type.startsWith('image/') ? (
                  <div className="relative bg-[var(--bg-tertiary)] rounded-lg overflow-hidden">
                    <img
                      src={fileDataUrl}
                      alt={selectedFile.name}
                      className="w-full h-64 object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-8 bg-[var(--bg-tertiary)] rounded-lg text-center">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-[var(--text-secondary)]" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Manual Input Fields */}
            {selectedFile && !ocrProcessing && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-[var(--text-secondary)]">
                  Receipt Details (Optional)
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">
                      Vendor
                    </label>
                    <input
                      {...register('vendor')}
                      type="text"
                      placeholder="e.g., Home Depot"
                      className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">
                      Amount
                    </label>
                    <input
                      {...register('amount')}
                      type="text"
                      placeholder="$0.00"
                      className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">
                      Purchase Date
                    </label>
                    <input
                      {...register('purchaseDate')}
                      type="date"
                      className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">
                      Location
                    </label>
                    <select
                      {...register('location')}
                      className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    >
                      <option value="">Select location</option>
                      <option value="Bedford">Bedford</option>
                      <option value="Dartmouth">Dartmouth</option>
                      <option value="Bayers Lake">Bayers Lake</option>
                      <option value="Truro">Truro</option>
                      <option value="Stratford">Stratford</option>
                      <option value="River Oaks">River Oaks</option>
                    </select>
                  </div>
                </div>

                {/* Personal Card Checkbox */}
                <div className="py-3 px-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-secondary)]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      {...register('isPersonalCard')}
                      type="checkbox"
                      className="w-5 h-5 rounded border-[var(--border-secondary)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0 cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        Purchased with personal card
                      </span>
                      <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                        Check this if you need reimbursement for a personal card purchase
                      </span>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">
                    Notes
                  </label>
                  <textarea
                    {...register('notes')}
                    rows={2}
                    placeholder="Additional details..."
                    className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border-secondary)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-all"
            >
              Cancel
            </button>
            {showOcrReview ? (
              <button
                type="button"
                onClick={handleSaveReceipt}
                disabled={isUploading}
                className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save Receipt
              </button>
            ) : (
              <button
                type="submit"
                disabled={!selectedFile || isUploading || ocrProcessing}
                className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Upload Receipt
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiptUploadModal;