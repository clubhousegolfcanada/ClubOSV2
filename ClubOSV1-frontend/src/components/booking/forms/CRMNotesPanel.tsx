import React from 'react';
import { FileText, AlertTriangle, Eye } from 'lucide-react';

interface CRMNotesPanelProps {
  notes: string;
  onChange: (notes: string) => void;
  existingNotes?: string;
  userFlagged?: boolean;
  readOnly?: boolean;
}

export default function CRMNotesPanel({
  notes,
  onChange,
  existingNotes,
  userFlagged,
  readOnly = false
}: CRMNotesPanelProps) {
  return (
    <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="font-medium">CRM Notes</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
            Staff Only
          </span>
          {readOnly && (
            <Eye className="w-4 h-4 text-gray-500" />
          )}
        </div>

        {userFlagged && (
          <div className="flex items-center gap-1 text-orange-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium">User Flagged</span>
          </div>
        )}
      </div>

      {/* Previous Notes */}
      {existingNotes && (
        <div className="p-3 bg-white rounded border border-blue-200">
          <h4 className="text-xs font-medium text-gray-600 mb-1">Previous Notes:</h4>
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
            {existingNotes}
          </pre>
        </div>
      )}

      {/* New Notes Input */}
      {!readOnly && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Add Note
          </label>
          <textarea
            value={notes}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Add internal notes about this booking or customer..."
            className="w-full p-2 border border-blue-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
          <p className="text-xs text-gray-600 mt-1">
            These notes are only visible to staff and help track customer behavior or special requirements.
          </p>
        </div>
      )}

      {/* Flagged User Warning */}
      {userFlagged && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded">
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">Customer Flagged for Excessive Changes</p>
              <p className="text-xs mt-1">
                This customer has made multiple booking changes. Consider monitoring their booking patterns
                and may require manager approval for future changes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Notes Templates */}
      {!readOnly && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">Quick Add:</p>
          <div className="flex flex-wrap gap-1">
            {[
              'No-show',
              'Late arrival',
              'Early departure',
              'Equipment issue',
              'Great customer',
              'VIP treatment',
              'Payment issue',
              'Behavior concern'
            ].map(template => (
              <button
                key={template}
                type="button"
                onClick={() => {
                  const currentNotes = notes.trim();
                  const newNote = currentNotes
                    ? `${currentNotes}\n${template}`
                    : template;
                  onChange(newNote);
                }}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                {template}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}