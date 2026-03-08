import React from 'react';
import { Receipt, AlertCircle } from 'lucide-react';

interface MonthlySummaryCardProps {
  summary: {
    totalReceipts: number;
    totalAmount: number;
    totalTax: number;
    totalHst: number;
    unreconciled: number;
    categories: Array<{ category: string; count: number; total: number }>;
  } | null;
  loading: boolean;
}

export const MonthlySummaryCard: React.FC<MonthlySummaryCardProps> = ({ summary, loading }) => {
  const maxCategoryTotal = summary?.categories?.length
    ? Math.max(...summary.categories.map(c => c.total))
    : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-100 rounded-lg">
          <Receipt className="w-5 h-5 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Monthly Summary</h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Receipts</p>
              <p className="text-xl font-bold text-gray-900">{summary.totalReceipts}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Total</p>
              <p className="text-xl font-bold text-gray-900">${summary.totalAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Tax</p>
              <p className="text-lg font-semibold text-gray-700">${summary.totalTax.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">HST</p>
              <p className="text-lg font-semibold text-gray-700">${summary.totalHst.toFixed(2)}</p>
            </div>
          </div>

          {summary.unreconciled > 0 && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-orange-700">
                {summary.unreconciled} unreconciled receipt{summary.unreconciled !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {summary.categories && summary.categories.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase mb-2">By Category</p>
              <div className="space-y-2">
                {summary.categories.slice(0, 5).map((cat) => (
                  <div key={cat.category} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-24 truncate" title={cat.category}>
                      {cat.category}
                    </span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${maxCategoryTotal > 0 ? (cat.total / maxCategoryTotal) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-16 text-right">
                      ${cat.total.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-400">No data available</p>
      )}
    </div>
  );
};
