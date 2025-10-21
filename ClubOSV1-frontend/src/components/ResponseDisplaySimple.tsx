import React, { useState } from 'react';
import { Bot, Database, Clock, Edit2, Save, X, Receipt, DollarSign, Calendar, MapPin, Trash2, Check } from 'lucide-react';
import logger from '@/services/logger';
import { http } from '@/api/http';
import toast from 'react-hot-toast';
import { sanitizeResponseHtml } from '@/utils/sanitizer';

interface Props {
  response: any;
  route?: string;
  photos?: string[];
  originalQuery?: string;
}

// Parse and format the response text for better readability
const formatResponseText = (text: string): React.ReactNode => {
  if (!text) return null;

  // Handle numbered lists that may not have proper formatting
  let formattedText = text
    // Fix numbered lists that are inline (e.g., "steps: 1. Do this 2. Do that")
    .replace(/(\d+)\.\s+/g, '\n$1. ')
    // Add line break after colon if followed by numbered list
    .replace(/:\s*(\d+\.)/g, ':\n$1')
    // Add line break after colon followed by text
    .replace(/:\s+(?=\w)/g, ':\n')
    // Bold time measurements (30-45 seconds, etc)
    .replace(/\b(\d+[-–]\d+)\s*(seconds?|minutes?|hours?)\b/gi, '**$1 $2**')
    .replace(/\b(\d+)\s*(seconds?|minutes?|hours?)\b/gi, '**$1 $2**')
    // Bold measurements (using proper quotes)
    .replace(/\b(\d+)"/g, '**$1"**')
    .replace(/\b(\d+)'/g, "**$1'**")
    .replace(/\b(\d+)\s+(inches?|feet|ft|mm|cm|m)\b/gi, '**$1 $2**')
    .replace(/\b(\d+)\s*[x×]\s*(\d+)/gi, '**$1 × $2**');

  // Split into lines and clean up
  const lines = formattedText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();

        // Check if this is a numbered list item
        const isNumberedItem = /^\d+\.\s/.test(trimmedLine);

        // Check if this line is a header (ends with colon but not part of numbered list)
        if (trimmedLine.endsWith(':') && !isNumberedItem) {
          return (
            <div key={index} className="mt-3 mb-2">
              <strong className="text-sm font-semibold text-[var(--text-primary)]">
                {trimmedLine}
              </strong>
            </div>
          );
        }

        // Function to render text with bold parts
        const renderWithBold = (text: string): React.ReactNode => {
          // Split by ** markers
          const parts = text.split(/\*\*([^*]+)\*\*/g);

          return parts.map((part, i) => {
            // Every odd index is meant to be bold (captured group from regex)
            if (i % 2 === 1) {
              return <strong key={i} className="font-semibold">{part}</strong>;
            }
            return part;
          });
        };

        // Render line with proper indentation
        return (
          <div
            key={index}
            className={`text-sm text-[var(--text-primary)] leading-relaxed ${isNumberedItem ? 'pl-6' : 'pl-4'}`}
          >
            {renderWithBold(trimmedLine)}
          </div>
        );
      })}
    </div>
  );
};

// More structured formatting for technical content
const formatStructuredContent = (text: string): React.ReactNode => {
  if (!text) return null;

  // Try to identify key sections
  const sections: { [key: string]: string[] } = {};
  let currentSection = 'General';

  const lines = text.split(/[.!?]/).filter(line => line.trim());

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers
    if (trimmed.toLowerCase().includes('screen') && trimmed.toLowerCase().includes('information')) {
      currentSection = 'Screen Requirements';
      sections[currentSection] = sections[currentSection] || [];
      sections[currentSection].push(trimmed);
    } else if (trimmed.toLowerCase().includes('bay opening')) {
      currentSection = 'Bay Opening';
      sections[currentSection] = sections[currentSection] || [];
      sections[currentSection].push(trimmed);
    } else if (trimmed.toLowerCase().includes('framing')) {
      currentSection = 'Framing Details';
      sections[currentSection] = sections[currentSection] || [];
      sections[currentSection].push(trimmed);
    } else if (trimmed.toLowerCase().includes('dimension') || trimmed.toLowerCase().includes('overall')) {
      currentSection = 'Dimensions';
      sections[currentSection] = sections[currentSection] || [];
      sections[currentSection].push(trimmed);
    } else if (trimmed.toLowerCase().includes('clear') || trimmed.toLowerCase().includes('inside')) {
      currentSection = 'Clear Opening';
      sections[currentSection] = sections[currentSection] || [];
      sections[currentSection].push(trimmed);
    } else {
      sections[currentSection] = sections[currentSection] || [];
      sections[currentSection].push(trimmed);
    }
  }

  return (
    <div className="space-y-4">
      {Object.entries(sections).map(([section, content]) => {
        if (content.length === 0) return null;

        return (
          <div key={section}>
            {section !== 'General' && (
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                {section}
              </h4>
            )}
            <div className="space-y-2 pl-4">
              {content.map((item, index) => {
                // Format measurements
                const formatted = item
                  .replace(/(\d+(?:\.\d+)?)\s*["'″′]/g, '<strong>$1"</strong>')
                  .replace(/(\d+(?:\.\d+)?)\s*(inches?|feet|ft|mm|cm|m)\b/gi, '<strong>$1 $2</strong>')
                  .replace(/(\d+)\s*[x×]\s*(\d+)/gi, '<strong>$1 × $2</strong>')
                  .replace(/(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)/gi, '<strong>$1 × $2 × $3</strong>');

                // Sanitize HTML to prevent XSS attacks
                const sanitized = sanitizeResponseHtml(formatted);

                return (
                  <div
                    key={index}
                    className="text-sm text-[var(--text-primary)] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitized }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Component to render receipt data in a formatted way
const ReceiptDisplay: React.FC<{ receipts: any[], summary?: any, actions?: any }> = ({ receipts, summary, actions }) => {
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<any>({});

  const handleReceiptAction = async (receiptId: string, action: string, value?: any) => {
    setProcessingAction(receiptId);

    try {
      let result;

      switch (action) {
        case 'reconcile':
          result = await http.post(`receipts/${receiptId}/reconcile`, { reconciled: true });
          toast.success('Receipt marked as reconciled');
          break;

        case 'delete':
          if (confirm('Are you sure you want to delete this receipt?')) {
            result = await http.delete(`receipts/${receiptId}`);
            toast.success('Receipt deleted successfully');
          }
          break;

        case 'edit':
          // Enter edit mode for this receipt
          setEditingReceipt(receiptId);
          setEditedFields({
            vendor: receipts.find(r => r.id === receiptId)?.vendor || '',
            amount: receipts.find(r => r.id === receiptId)?.amount || '',
            category: receipts.find(r => r.id === receiptId)?.category || '',
            location: receipts.find(r => r.id === receiptId)?.location || ''
          });
          break;

        default:
          toast.error('Unknown action');
      }
    } catch (error: any) {
      console.error('Receipt action error:', error);
      toast.error(error.response?.data?.message || 'Action failed');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleSaveEdit = async (receiptId: string) => {
    setProcessingAction(receiptId);

    try {
      // Get original receipt data for correction tracking
      const originalReceipt = receipts.find(r => r.id === receiptId);
      if (!originalReceipt) {
        throw new Error('Receipt not found');
      }

      // Convert amount to cents for backend (database stores in cents)
      const updateData: any = {
        vendor: editedFields.vendor,
        amount_cents: Math.round(parseFloat(editedFields.amount) * 100), // Convert dollars to cents
        category: editedFields.category || null,
        club_location: editedFields.location || null // Use correct field name
      };

      // Remove null/undefined fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === null || updateData[key] === undefined || updateData[key] === '') {
          delete updateData[key];
        }
      });

      const result = await http.patch(`receipts/${receiptId}`, updateData);

      // Update the local receipt data
      const index = receipts.findIndex(r => r.id === receiptId);
      if (index > -1) {
        receipts[index] = { ...receipts[index], ...editedFields };
      }

      // Track this edit as a correction for AI learning
      try {
        const originalText = `Vendor: ${originalReceipt.vendor}, Amount: $${originalReceipt.amount}, Category: ${originalReceipt.category || 'N/A'}, Location: ${originalReceipt.location || 'N/A'}`;
        const correctedText = `Vendor: ${editedFields.vendor}, Amount: $${editedFields.amount}, Category: ${editedFields.category || 'N/A'}, Location: ${editedFields.location || 'N/A'}`;

        // Only send correction if something actually changed
        if (originalText !== correctedText) {
          await http.post('corrections/save', {
            originalQuery: `Receipt from ${originalReceipt.vendor}`,
            originalResponse: originalText,
            correctedResponse: correctedText,
            route: 'receipt_edit',
            confidence: 1.0
          });

          logger.debug('Receipt correction saved for AI learning');
        }
      } catch (correctionError) {
        // Don't fail the main operation if correction tracking fails
        logger.error('Failed to save receipt correction:', correctionError);
      }

      toast.success('Receipt updated successfully');
      setEditingReceipt(null);
      setEditedFields({});
    } catch (error: any) {
      console.error('Failed to save receipt:', error);
      toast.error(error.response?.data?.message || 'Failed to save changes');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingReceipt(null);
    setEditedFields({});
  };

  return (
    <div className="space-y-3">
      {receipts.map((receipt, index) => (
        <div
          key={receipt.id || index}
          className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-secondary)] hover:border-[var(--accent)] transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-[var(--text-muted)]" />
                {editingReceipt === receipt.id ? (
                  <input
                    type="text"
                    value={editedFields.vendor}
                    onChange={(e) => setEditedFields({...editedFields, vendor: e.target.value})}
                    className="flex-1 px-2 py-0.5 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded text-sm font-medium focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Vendor name"
                    autoFocus
                  />
                ) : (
                  <span className="font-medium text-[var(--text-primary)]">
                    {receipt.vendor || 'Unknown Vendor'}
                  </span>
                )}
                {receipt.hasPhoto && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">📷</span>
                )}
                {receipt.reconciled && (
                  <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">✓ Reconciled</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  {editingReceipt === receipt.id ? (
                    <input
                      type="number"
                      value={editedFields.amount}
                      onChange={(e) => setEditedFields({...editedFields, amount: e.target.value})}
                      className="w-24 px-2 py-0.5 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded text-xs focus:outline-none focus:border-[var(--accent)]"
                      placeholder="0.00"
                      step="0.01"
                    />
                  ) : (
                    <span className="font-semibold">${receipt.amount}</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{receipt.date}</span>
                </div>

                {(receipt.category || editingReceipt === receipt.id) && (
                  <div className="col-span-1">
                    <span className="text-[var(--text-muted)]">Category:</span>
                    {editingReceipt === receipt.id ? (
                      <input
                        type="text"
                        value={editedFields.category}
                        onChange={(e) => setEditedFields({...editedFields, category: e.target.value})}
                        className="ml-1 w-24 px-2 py-0.5 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded text-xs focus:outline-none focus:border-[var(--accent)]"
                        placeholder="Category"
                      />
                    ) : (
                      <span> {receipt.category}</span>
                    )}
                  </div>
                )}

                {(receipt.location || editingReceipt === receipt.id) && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {editingReceipt === receipt.id ? (
                      <input
                        type="text"
                        value={editedFields.location}
                        onChange={(e) => setEditedFields({...editedFields, location: e.target.value})}
                        className="w-24 px-2 py-0.5 bg-[var(--bg-primary)] border border-[var(--border-secondary)] rounded text-xs focus:outline-none focus:border-[var(--accent)]"
                        placeholder="Location"
                      />
                    ) : (
                      <span>{receipt.location}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-1 ml-3">
              {editingReceipt === receipt.id ? (
                <>
                  <button
                    onClick={() => handleSaveEdit(receipt.id)}
                    disabled={processingAction === receipt.id}
                    className="px-2 py-1 bg-[var(--accent)] text-white rounded text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                    title="Save changes"
                  >
                    {processingAction === receipt.id ? (
                      'Saving...'
                    ) : (
                      <>
                        <Save className="w-3 h-3" />
                        Save
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-2 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded text-xs font-medium flex items-center gap-1 hover:bg-[var(--bg-secondary)]"
                    title="Cancel editing"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {!receipt.reconciled && (
                    <button
                      onClick={() => handleReceiptAction(receipt.id, 'reconcile')}
                      disabled={processingAction === receipt.id}
                      className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                      title="Mark as reconciled"
                    >
                      <Check className="w-4 h-4 text-green-600" />
                    </button>
                  )}

                  <button
                    onClick={() => handleReceiptAction(receipt.id, 'edit')}
                    disabled={processingAction === receipt.id}
                    className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                    title="Edit receipt"
                  >
                    <Edit2 className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>

                  <button
                    onClick={() => handleReceiptAction(receipt.id, 'delete')}
                    disabled={processingAction === receipt.id}
                    className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                    title="Delete receipt"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {summary && summary.count > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border-secondary)]">
          <div className="text-sm text-[var(--text-secondary)] space-y-1">
            <div className="flex justify-between">
              <span>Total Receipts:</span>
              <span className="font-semibold">{summary.count}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Amount:</span>
              <span className="font-semibold text-green-600">
                ${summary.totalAmount.toFixed(2)}
              </span>
            </div>
            {summary.averageAmount && (
              <div className="flex justify-between">
                <span>Average:</span>
                <span className="font-semibold">${summary.averageAmount.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ResponseDisplaySimple: React.FC<Props> = ({ response, route, photos = [], originalQuery }) => {
  logger.debug('ResponseDisplaySimple received:', { response, route, photos });

  // Handle null/undefined response
  if (!response) {
    return (
      <div className="space-y-4">
        <div className="text-[var(--text-primary)]">
          <p>Request processed successfully</p>
        </div>
      </div>
    );
  }

  // Extract response data
  let displayText = '';
  if (typeof response === 'string') {
    displayText = response;
  } else if (response?.response) {
    displayText = response.response;
  } else if (response?.message) {
    displayText = response.message;
  } else {
    displayText = 'Request processed successfully';
  }

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(displayText);
  const [saving, setSaving] = useState(false);

  // Extract metadata
  const confidence = response?.confidence || response?.llmResponse?.confidence;
  const status = response?.status || 'completed';
  const dataSource = response?.dataSource || response?.llmResponse?.dataSource;
  const processingTime = response?.processingTime;

  // Check if this is a receipt response
  const hasReceipts = response?.receipts && Array.isArray(response.receipts) && response.receipts.length > 0;
  const receiptSummary = response?.summary;
  const receiptActions = response?.actions;

  // Handle save correction
  const handleSaveCorrection = async () => {
    setSaving(true);
    try {
      // Use the new direct correction endpoint
      const result = await http.post('corrections/save', {
        responseId: response?.responseId, // Use response tracking ID if available
        originalQuery: originalQuery || response?.originalQuery || '',
        originalResponse: displayText,
        correctedResponse: editedText,
        route: route || response?.botRoute || response?.llmResponse?.route,
        confidence: confidence
      });

      if (result.data.success) {
        const { results } = result.data;

        // Provide detailed feedback
        let message = '✓ Correction saved!';
        if (results.patternCreated) {
          message += ' New pattern created for automation.';
        } else if (results.patternId) {
          message += ' Pattern updated.';
        }
        if (results.knowledgeUpdated > 0) {
          message += ` ${results.knowledgeUpdated} knowledge entries updated.`;
        }

        toast.success(message);
        setIsEditing(false);

        // Update display text locally
        displayText = editedText;
      } else {
        toast.error(result.data.error || 'Failed to save correction');
      }
    } catch (error: any) {
      console.error('Correction error:', error);
      const errorMsg = error.response?.data?.error || 'Failed to save correction';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Simple status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-green-500">✓</span>
          <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
            {status || 'Completed'}
          </span>
        </div>
        {confidence !== undefined && (
          <div className="text-sm text-[var(--text-secondary)]">
            Confidence: <strong>{Math.round(confidence * 100)}%</strong>
          </div>
        )}
      </div>

      {/* Main response content - better formatted */}
      <div className="border-l-2 border-[var(--border-secondary)] pl-4">
        <div className="mb-2 flex items-center justify-between">
          <strong className="text-sm font-semibold text-[var(--text-primary)]">Response:</strong>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
              title="Edit response"
            >
              <Edit2 className="w-3 h-3 text-[var(--text-muted)] hover:text-[var(--accent)]" />
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg text-sm font-mono focus:outline-none focus:border-[var(--accent)] resize-none"
              rows={Math.min(editedText.split('\n').length + 2, 10)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveCorrection}
                disabled={saving}
                className="px-3 py-1.5 bg-[var(--accent)] text-white rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50"
              >
                {saving ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    Save
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedText(displayText);
                }}
                className="px-3 py-1.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-lg text-xs font-medium flex items-center gap-1 hover:bg-[var(--bg-secondary)]"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
            {saving && (
              <p className="text-xs text-[var(--text-muted)]">Updating knowledge store...</p>
            )}
          </div>
        ) : (
          <>
            {/* Show formatted text response */}
            {displayText && formatResponseText(displayText)}

            {/* Show receipt cards if available */}
            {hasReceipts && (
              <div className="mt-4">
                <ReceiptDisplay
                  receipts={response.receipts}
                  summary={receiptSummary}
                  actions={receiptActions}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Clean metadata footer */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-secondary)]">
        {route || response?.botRoute ? (
          <div className="flex items-center gap-1">
            <Bot className="w-3 h-3" />
            <span>Route: {route || response?.botRoute}</span>
          </div>
        ) : null}
        {dataSource && (
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            <span>Source: {dataSource}</span>
          </div>
        )}
        {processingTime && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{(processingTime / 1000).toFixed(1)}s</span>
          </div>
        )}
        <div className="ml-auto">
          <span>ClubOS AI</span>
        </div>
      </div>
    </div>
  );
};

export default ResponseDisplaySimple;