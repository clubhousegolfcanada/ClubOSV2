import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, Camera, Check, FileText } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { http } from '@/api/http';
import { useNotifications } from '@/state/hooks';

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
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, setValue, watch } = useForm<ReceiptFormData>();
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
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setFileDataUrl(dataUrl);
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
        notes: data.notes
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

  // Handle camera capture for mobile
  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment' as any;
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiptUploadModal;