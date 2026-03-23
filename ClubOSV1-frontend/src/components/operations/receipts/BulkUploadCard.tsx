import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Image, CheckCircle, XCircle, AlertTriangle, X, Loader2 } from 'lucide-react';
import { http } from '@/api/http';
import logger from '@/services/logger';

interface BulkUploadCardProps {
  onUploadComplete: () => void;
}

interface FileItem {
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'uploading' | 'success' | 'duplicate' | 'error';
  error?: string;
  vendor?: string;
  amount?: number;
  base64?: string;
}

const MAX_FILES = 50;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB raw (supports multi-page PDFs)
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BulkUploadCard({ onUploadComplete }: BulkUploadCardProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: FileItem[] = [];

    for (const file of fileArray) {
      if (files.length + validFiles.length >= MAX_FILES) break;

      if (!ACCEPTED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
        validFiles.push({
          file, name: file.name, size: file.size, type: file.type,
          status: 'error', error: 'Unsupported format (use JPEG, PNG, WebP, or PDF)'
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        validFiles.push({
          file, name: file.name, size: file.size, type: file.type,
          status: 'error', error: `File too large (${formatBytes(file.size)}, max 20MB)`
        });
        continue;
      }

      validFiles.push({
        file, name: file.name, size: file.size, type: file.type, status: 'pending'
      });
    }

    setFiles(prev => [...prev, ...validFiles]);
  }, [files.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setCurrentIndex(-1);
    abortRef.current = false;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // For PDFs, read directly as base64
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      // For images, compress via canvas
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 2000;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height / width) * maxDim);
              width = maxDim;
            } else {
              width = Math.round((width / height) * maxDim);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas context failed')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadAll = async () => {
    setIsUploading(true);
    abortRef.current = false;

    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');

    for (let i = 0; i < files.length; i++) {
      if (abortRef.current) break;

      const item = files[i];
      if (item.status !== 'pending') continue;

      setCurrentIndex(i);
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));

      try {
        let base64: string | null = await fileToBase64(item.file);
        const isPdf = item.type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf');

        const response = await http.post('receipts/upload', {
          file_data: base64,
          file_name: item.name,
          file_size: item.size,
          mime_type: isPdf ? 'application/pdf' : 'image/jpeg',
        });

        // Free memory immediately after upload
        base64 = null;

        if (response.data.success) {
          const d = response.data.data;
          // Handle multi-receipt response (PDF pages or multi-receipt image)
          const receiptCount = d.receiptsCreated || 1;
          const displayVendor = d.vendor || (d.receipts?.[0]?.vendor) || null;
          const displayAmount = d.amount ?? (d.receipts?.[0]?.amount) ?? null;
          setFiles(prev => prev.map((f, idx) => idx === i ? {
            ...f,
            status: 'success',
            vendor: receiptCount > 1 ? `${receiptCount} receipts` : displayVendor,
            amount: receiptCount > 1 ? null : displayAmount,
          } : f));
        } else {
          setFiles(prev => prev.map((f, idx) => idx === i ? {
            ...f, status: 'error', error: response.data.error || 'Upload failed'
          } : f));
        }
      } catch (err: any) {
        const status = err?.response?.status;
        const msg = err?.response?.data?.error || err?.message || 'Upload failed';

        if (status === 409) {
          setFiles(prev => prev.map((f, idx) => idx === i ? {
            ...f, status: 'duplicate', error: 'Already uploaded'
          } : f));
        } else {
          setFiles(prev => prev.map((f, idx) => idx === i ? {
            ...f, status: 'error', error: msg
          } : f));
        }
        logger.error('Bulk upload error:', err);
      }
    }

    setIsUploading(false);
    setCurrentIndex(-1);
    onUploadComplete();
  };

  const stopUpload = () => {
    abortRef.current = true;
  };

  const successCount = files.filter(f => f.status === 'success').length;
  const dupeCount = files.filter(f => f.status === 'duplicate').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;
  const totalCount = files.length;

  const StatusIcon = ({ status }: { status: FileItem['status'] }) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />;
      case 'duplicate': return <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
      case 'uploading': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Bulk Upload</h3>
        </div>
        {files.length > 0 && !isUploading && (
          <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-600">
            Clear all
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
      >
        <Upload className="w-6 h-6 mx-auto mb-1 text-gray-400" />
        <p className="text-sm text-gray-600">
          Drop files here or <span className="text-blue-600 font-medium">browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          JPEG, PNG, WebP, PDF — up to {MAX_FILES} files, 20MB each
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
        className="hidden"
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
          {files.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 text-xs">
              <StatusIcon status={item.status} />
              {item.type === 'application/pdf'
                ? <FileText className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                : <Image className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              }
              <span className="truncate flex-1 text-gray-700" title={item.name}>
                {item.name}
              </span>
              {item.vendor && (
                <span className="text-gray-500 truncate max-w-[100px]" title={item.vendor}>
                  {item.vendor}
                </span>
              )}
              {item.amount != null && (
                <span className="text-green-600 font-medium whitespace-nowrap">
                  ${item.amount.toFixed(2)}
                </span>
              )}
              {item.error && item.status !== 'duplicate' && (
                <span className="text-red-500 truncate max-w-[120px]" title={item.error}>
                  {item.error}
                </span>
              )}
              {item.status === 'duplicate' && (
                <span className="text-yellow-600">Duplicate</span>
              )}
              <span className="text-gray-400 whitespace-nowrap">{formatBytes(item.size)}</span>
              {!isUploading && item.status !== 'uploading' && (
                <button onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="text-gray-300 hover:text-red-400 flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {isUploading && totalCount > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Processing {currentIndex + 1} of {totalCount}</span>
            <span>{successCount} done, {dupeCount} dupes, {errorCount} failed</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${((successCount + dupeCount + errorCount) / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary after completion */}
      {!isUploading && successCount > 0 && pendingCount === 0 && (
        <div className="mt-3 p-2 bg-green-50 rounded-lg">
          <p className="text-xs text-green-700">
            <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
            {successCount} receipt{successCount !== 1 ? 's' : ''} uploaded
            {dupeCount > 0 && `, ${dupeCount} duplicate${dupeCount !== 1 ? 's' : ''} skipped`}
            {errorCount > 0 && `, ${errorCount} failed`}
          </p>
        </div>
      )}

      {/* Action buttons */}
      {files.length > 0 && (
        <div className="mt-3 flex gap-2">
          {!isUploading && pendingCount > 0 && (
            <button
              onClick={uploadAll}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
            </button>
          )}
          {isUploading && (
            <button
              onClick={stopUpload}
              className="flex-1 px-3 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors border border-red-200"
            >
              Stop
            </button>
          )}
        </div>
      )}
    </div>
  );
}
