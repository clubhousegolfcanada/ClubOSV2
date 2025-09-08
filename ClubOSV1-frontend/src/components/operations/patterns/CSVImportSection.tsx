import React, { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Info,
  Clock,
  TrendingUp,
  RefreshCw,
  X
} from 'lucide-react';
import apiClient from '@/api/http';
import logger from '@/services/logger';

interface ImportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalMessages: number;
  processedMessages: number;
  conversationsFound: number;
  conversationsAnalyzed: number;
  patternsCreated: number;
  patternsEnhanced: number;
  errors: string[];
  startedAt: string;
  completedAt?: string;
}

interface CSVImportSectionProps {
  onImportComplete?: () => void;
}

export const CSVImportSection: React.FC<CSVImportSectionProps> = ({ onImportComplete }) => {
  const [importing, setImporting] = useState(false);
  const [jobStatus, setJobStatus] = useState<ImportJob | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Handle file selection
  const handleFileSelect = (file: File) => {
    setError(null);
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return;
    }
    
    setSelectedFile(file);
  };

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Start CSV import
  const startImport = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setImporting(true);
    setError(null);
    setJobStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await apiClient.post('/patterns/import/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        const jobId = response.data.jobId;
        
        // Start polling for status
        pollJobStatus(jobId);
      } else {
        throw new Error(response.data.error || 'Failed to start import');
      }
    } catch (err: any) {
      logger.error('CSV import failed:', err);
      setError(err.response?.data?.error || err.message || 'Failed to start import');
      setImporting(false);
    }
  };

  // Poll for job status
  const pollJobStatus = (jobId: string) => {
    // Clear any existing polling
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }

    // Poll every 2 seconds
    pollingInterval.current = setInterval(async () => {
      try {
        const response = await apiClient.get(`/patterns/import/status/${jobId}`);
        
        if (response.data.success) {
          const job = response.data.job;
          setJobStatus(job);

          // Stop polling if job is complete or failed
          if (job.status === 'completed' || job.status === 'failed') {
            if (pollingInterval.current) {
              clearInterval(pollingInterval.current);
              pollingInterval.current = null;
            }
            setImporting(false);

            // Call callback if import was successful
            if (job.status === 'completed' && onImportComplete) {
              onImportComplete();
            }

            // Clear file selection after successful import
            if (job.status === 'completed') {
              setSelectedFile(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }
          }
        }
      } catch (err) {
        logger.error('Failed to poll job status:', err);
        // Continue polling unless explicitly stopped
      }
    }, 2000);
  };

  // Clean up polling on unmount
  React.useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!jobStatus || jobStatus.conversationsFound === 0) return 0;
    return Math.round((jobStatus.conversationsAnalyzed / jobStatus.conversationsFound) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Bulk Pattern Import</h3>
            <p className="text-sm text-gray-600 mt-1">
              Import conversation history from OpenPhone CSV exports to automatically create patterns
            </p>
          </div>
          <Upload className="h-5 w-5 text-gray-400" />
        </div>

        {/* File Upload Zone */}
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive 
              ? 'border-primary bg-primary/5' 
              : selectedFile 
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onClick={() => !importing && fileInputRef.current?.click()}
        >
          {selectedFile ? (
            <div className="space-y-2">
              <FileText className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {!importing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Remove file
                </button>
              )}
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900">
                Drop your CSV file here, or click to browse
              </p>
              <p className="text-xs text-gray-500 mt-1">
                OpenPhone export format • Maximum 10MB
              </p>
            </>
          )}
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".csv" 
            onChange={handleFileInputChange}
            hidden 
            disabled={importing}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Import Button */}
        {selectedFile && !jobStatus && (
          <button
            onClick={startImport}
            disabled={importing}
            className="mt-4 w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {importing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Starting import...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Start Import
              </>
            )}
          </button>
        )}

        {/* Import Progress */}
        {jobStatus && (
          <div className="mt-6 space-y-4">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {jobStatus.status === 'processing' && (
                  <>
                    <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                    <span className="text-sm font-medium text-blue-700">Processing conversations...</span>
                  </>
                )}
                {jobStatus.status === 'completed' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-green-700">Import completed successfully</span>
                  </>
                )}
                {jobStatus.status === 'failed' && (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">Import failed</span>
                  </>
                )}
              </div>
              <span className="text-sm text-gray-600">
                {jobStatus.conversationsAnalyzed} / {jobStatus.conversationsFound} conversations
              </span>
            </div>

            {/* Progress Bar */}
            {jobStatus.status === 'processing' && (
              <div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgressPercentage()}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {getProgressPercentage()}% complete
                </p>
              </div>
            )}

            {/* Results Summary */}
            {(jobStatus.status === 'completed' || jobStatus.patternsCreated > 0 || jobStatus.patternsEnhanced > 0) && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Import Results</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Messages processed:</span>
                    <span className="ml-2 font-medium">{jobStatus.processedMessages}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Conversations found:</span>
                    <span className="ml-2 font-medium">{jobStatus.conversationsFound}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">New patterns created:</span>
                    <span className="ml-2 font-medium text-green-600">
                      {jobStatus.patternsCreated}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Existing patterns enhanced:</span>
                    <span className="ml-2 font-medium text-blue-600">
                      {jobStatus.patternsEnhanced}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Errors */}
            {jobStatus.errors && jobStatus.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2">Errors encountered:</h4>
                <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                  {jobStatus.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-xs text-blue-800 space-y-1">
              <p className="font-medium mb-2">How CSV import works:</p>
              <ul className="space-y-1">
                <li>• Each conversation in your CSV is analyzed by AI to extract patterns</li>
                <li>• One pattern is created per conversation (main issue and resolution)</li>
                <li>• Duplicate patterns boost confidence of existing ones</li>
                <li>• Processing is limited to 500 conversations per import for performance</li>
                <li>• Only conversations with both customer and operator messages are processed</li>
              </ul>
              <p className="mt-2 font-medium">Required CSV format:</p>
              <p className="font-mono text-xs bg-white/50 p-1 rounded mt-1">
                id, conversationBody, direction, from, to, sentAt
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};