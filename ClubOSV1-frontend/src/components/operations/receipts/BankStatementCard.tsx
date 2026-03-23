import React, { useState, useRef } from 'react';
import { Building2, Upload, CheckCircle, XCircle, Loader2, FileText, ArrowRight, Link2 } from 'lucide-react';
import { http } from '@/api/http';
import logger from '@/services/logger';

interface BankStatementCardProps {
  onImportComplete: () => void;
}

interface ParsedTransaction {
  txnId: string;
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  currency: string;
  matchedReceipt: { id: string; vendor: string; purchase_date: string; amount_cents: number } | null;
}

interface ParseResult {
  account: string;
  accountLabel: string;
  accountType: string;
  fileHash: string;
  statementStart: string;
  statementEnd: string;
  transactionCount: number;
  transactions: ParsedTransaction[];
  validation: { passed: boolean; errors?: string[] };
  alreadyImported?: boolean;
  existingCount?: number;
}

type Stage = 'idle' | 'parsing' | 'preview' | 'importing' | 'done';

const formatMoney = (n: number | null) => n != null ? `$${Math.abs(n).toFixed(2)}` : '—';

export default function BankStatementCard({ onImportComplete }: BankStatementCardProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF bank statement');
      return;
    }

    setStage('parsing');
    setError(null);
    setResult(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await http.post('bank-statements/parse', {
        file_data: base64,
        file_name: file.name,
      });

      const data = response.data?.data;
      if (data?.alreadyImported) {
        setError(`This statement was already imported (${data.existingCount} transactions).`);
        setStage('idle');
        return;
      }

      setResult(data);
      setStage('preview');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to parse statement';
      setError(msg);
      setStage('idle');
      logger.error('Bank statement parse error:', err);
    }
  };

  const handleImport = async () => {
    if (!result) return;
    setStage('importing');
    setError(null);

    try {
      const response = await http.post('bank-statements/import', {
        transactions: result.transactions,
        fileHash: result.fileHash,
        account: result.account,
      });

      setImportResult(response.data?.data);
      setStage('done');
      onImportComplete();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import failed');
      setStage('preview');
      logger.error('Bank statement import error:', err);
    }
  };

  const reset = () => {
    setStage('idle');
    setResult(null);
    setError(null);
    setImportResult(null);
  };

  const matched = result?.transactions.filter(t => t.matchedReceipt) || [];
  const unmatched = result?.transactions.filter(t => !t.matchedReceipt && t.debit) || [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-semibold text-gray-900">Bank Statement</h3>
        </div>
        {stage !== 'idle' && stage !== 'parsing' && (
          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>
        )}
      </div>

      {/* Idle — file picker */}
      {stage === 'idle' && (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-colors"
          >
            <Building2 className="w-6 h-6 mx-auto mb-1 text-gray-400" />
            <p className="text-sm text-gray-600">
              Upload <span className="text-purple-600 font-medium">RBC statement PDF</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Chequing or Visa statements</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </>
      )}

      {/* Parsing */}
      {stage === 'parsing' && (
        <div className="flex items-center justify-center py-6 gap-2">
          <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
          <span className="text-sm text-gray-500">Parsing statement...</span>
        </div>
      )}

      {/* Preview */}
      {stage === 'preview' && result && (
        <div className="space-y-3">
          {/* Header */}
          <div className="bg-purple-50 rounded-lg p-3">
            <p className="text-sm font-medium text-purple-900">{result.accountLabel}</p>
            <p className="text-xs text-purple-600">
              {result.statementStart} → {result.statementEnd} · {result.transactionCount} transactions
            </p>
            {result.validation && !result.validation.passed && (
              <p className="text-xs text-red-600 mt-1">
                <XCircle className="w-3 h-3 inline" /> Validation warnings: {result.validation.errors?.join(', ')}
              </p>
            )}
          </div>

          {/* Transaction preview */}
          <div className="max-h-48 overflow-y-auto text-xs space-y-0.5">
            {result.transactions.slice(0, 20).map((t, i) => (
              <div key={i} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50">
                <span className="text-gray-400 w-16">{t.date.slice(5)}</span>
                <span className="flex-1 truncate text-gray-700">{t.description}</span>
                {t.debit && <span className="text-red-600 font-medium">{formatMoney(t.debit)}</span>}
                {t.credit && <span className="text-green-600 font-medium">+{formatMoney(t.credit)}</span>}
                {t.matchedReceipt && (
                  <span title={`Matched: ${t.matchedReceipt.vendor}`}>
                    <Link2 className="w-3 h-3 text-green-500" />
                  </span>
                )}
              </div>
            ))}
            {result.transactionCount > 20 && (
              <p className="text-gray-400 text-center py-1">+ {result.transactionCount - 20} more</p>
            )}
          </div>

          {/* Match summary */}
          <div className="flex gap-3 text-xs">
            <span className="text-green-600">{matched.length} matched to receipts</span>
            <span className="text-gray-400">{unmatched.length} unmatched debits</span>
          </div>

          {/* Import button */}
          <button
            onClick={handleImport}
            className="w-full py-2 px-4 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            Import {result.transactionCount} Transactions
          </button>
        </div>
      )}

      {/* Importing */}
      {stage === 'importing' && (
        <div className="flex items-center justify-center py-6 gap-2">
          <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
          <span className="text-sm text-gray-500">Importing transactions...</span>
        </div>
      )}

      {/* Done */}
      {stage === 'done' && importResult && (
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-700">
            <CheckCircle className="w-4 h-4 inline mr-1" />
            Imported {importResult.imported} transactions
            {importResult.skipped > 0 && `, ${importResult.skipped} duplicates skipped`}
          </p>
          <button onClick={reset} className="text-xs text-green-600 underline mt-1">Import another</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 p-2 bg-red-50 rounded-lg">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
