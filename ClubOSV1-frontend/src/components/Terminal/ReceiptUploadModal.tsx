import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, Camera, RotateCw, Check, AlertCircle, FileText } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';
import { ReceiptPreview } from './ReceiptPreview';

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
}

export const ReceiptUploadModal: React.FC<ReceiptUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
  onProcessingChange
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [captureMode, setCaptureMode] = useState<'file' | 'camera'>('file');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ReceiptFormData>();
  const { notify } = useNotifications();

  // Watch form fields
  const vendor = watch('vendor');
  const amount = watch('amount');

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      notify('error', 'Please select a PDF or image file (JPEG, PNG)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      notify('error', 'File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(''); // PDF preview not supported in basic implementation
    }
  }, [notify]);

  // Handle form submission
  const onSubmit = async (data: ReceiptFormData) => {
    if (!selectedFile) {
      notify('error', 'Please select a file to upload');
      return;
    }

    setIsUploading(true);
    if (onProcessingChange) onProcessingChange(true);
    setUploadProgress(20);

    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Add optional metadata
      if (data.vendor) formData.append('vendor', data.vendor);
      if (data.amount) {
        // Convert amount to cents
        const cents = Math.round(parseFloat(data.amount.replace(/[^\d.]/g, '')) * 100);
        formData.append('amount_cents', cents.toString());
      }
      if (data.purchaseDate) formData.append('purchase_date', data.purchaseDate);
      if (data.location) formData.append('club_location', data.location);
      if (data.notes) formData.append('notes', data.notes);

      setUploadProgress(50);

      // Upload to backend
      const response = await http.post('receipts/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(50 + (progress * 0.4)); // 50-90%
        }
      });

      setUploadProgress(90);

      if (response.data.success) {
        const receipt = response.data.data;

        // If OCR data is returned, show it
        if (receipt.parsed_fields) {
          setOcrResult(receipt.parsed_fields);

          // Auto-fill form with OCR results
          if (receipt.parsed_fields.vendor && !vendor) {
            setValue('vendor', receipt.parsed_fields.vendor);
          }
          if (receipt.parsed_fields.amount && !amount) {
            setValue('amount', `$${(receipt.parsed_fields.amount / 100).toFixed(2)}`);
          }
          if (receipt.parsed_fields.date && !data.purchaseDate) {
            setValue('purchaseDate', receipt.parsed_fields.date);
          }
        }

        setUploadProgress(100);

        // Complete upload
        setTimeout(() => {
          onUploadComplete(receipt);
        }, 500);

      } else {
        throw new Error(response.data.error || 'Upload failed');
      }

    } catch (error: any) {
      console.error('Receipt upload error:', error);
      notify('error', error.response?.data?.error || 'Failed to upload receipt');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
      if (onProcessingChange) onProcessingChange(false);
    }
  };

  // Handle camera capture
  const handleCameraCapture = async () => {
    // For mobile devices, use native camera
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use back camera
    input.onchange = (e: any) => handleFileSelect(e);
    input.click();
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

            {/* File Selection */}
            {!selectedFile && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 p-4 border-2 border-dashed border-[var(--border-secondary)] rounded-lg hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all text-center"
                  >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
                    <p className="text-sm font-medium">Choose File</p>
                    <p className="text-xs text-[var(--text-muted)]">PDF or Image (max 10MB)</p>
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
                  <h3 className="text-sm font-medium">Preview</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl('');
                      setOcrResult(null);
                    }}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Change File
                  </button>
                </div>

                {previewUrl ? (
                  <ReceiptPreview
                    imageUrl={previewUrl}
                    fileName={selectedFile.name}
                    onRotate={(url) => setPreviewUrl(url)}
                  />
                ) : (
                  <div className="p-8 bg-[var(--bg-tertiary)] rounded-lg text-center">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-[var(--text-secondary)]" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* OCR Results */}
            {ocrResult && (
              <div className="p-3 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-[var(--accent)]" />
                  <p className="text-sm font-medium text-[var(--accent)]">OCR Extraction Complete</p>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Fields have been auto-filled below. Please verify and correct if needed.
                </p>
              </div>
            )}

            {/* Manual Input Fields */}
            {selectedFile && (
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

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">Uploading...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--text-muted)] text-center">
                  {uploadProgress < 50 ? 'Uploading to server...' :
                   uploadProgress < 90 ? 'Processing with OCR...' :
                   'Finalizing...'}
                </p>
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
            <button
              type="submit"
              disabled={!selectedFile || isUploading}
              className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {isUploading ? 'Uploading...' : 'Upload Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiptUploadModal;