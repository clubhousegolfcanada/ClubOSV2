import React, { useState } from 'react';
import { Receipt, Loader2 } from 'lucide-react';
import { ReceiptUploadModal } from './ReceiptUploadModalSimple';
import { useNotifications } from '@/state/hooks';
import { useAuthState } from '@/state/useStore';

interface ReceiptUploadButtonProps {
  onUploadComplete?: (receipt: any) => void;
  className?: string;
}

export const ReceiptUploadButton: React.FC<ReceiptUploadButtonProps> = ({
  onUploadComplete,
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { notify } = useNotifications();
  const { user } = useAuthState();

  // Check if user has permission to upload receipts
  const canUpload = user?.role && ['admin', 'staff', 'operator'].includes(user.role);

  const handleUploadComplete = (receipt: any) => {
    setIsModalOpen(false);

    if (onUploadComplete) {
      onUploadComplete(receipt);
    }
  };

  if (!canUpload) {
    return null; // Don't show button if user doesn't have permission
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        disabled={isProcessing}
        className={`
          px-4 py-2.5
          bg-[var(--bg-tertiary)]
          border border-[var(--border-secondary)]
          text-[var(--text-secondary)]
          rounded-lg
          font-medium text-sm
          hover:border-[var(--accent)]
          hover:text-[var(--text-primary)]
          hover:bg-[var(--bg-secondary)]
          transition-all duration-200
          flex items-center gap-2
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
        style={{ fontFamily: 'Poppins, sans-serif' }}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Receipt className="w-4 h-4" />
        )}
        <span>Upload Receipt</span>
      </button>

      {isModalOpen && (
        <ReceiptUploadModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onUploadComplete={handleUploadComplete}
          onProcessingChange={setIsProcessing}
        />
      )}
    </>
  );
};

export default ReceiptUploadButton;