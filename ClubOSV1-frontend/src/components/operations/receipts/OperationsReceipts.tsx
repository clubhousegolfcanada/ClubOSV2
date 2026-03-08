import React from 'react';
import ReceiptExportCard from '../integrations/ReceiptExportCard';

export const OperationsReceipts: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ReceiptExportCard />
      </div>
    </div>
  );
};
