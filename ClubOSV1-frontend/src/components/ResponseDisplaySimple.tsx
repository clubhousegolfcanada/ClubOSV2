import React, { useState } from 'react';
import { Bot, Database, Clock, Edit2, Save, X } from 'lucide-react';
import logger from '@/services/logger';
import { http } from '@/api/http';
import toast from 'react-hot-toast';

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

                return (
                  <div
                    key={index}
                    className="text-sm text-[var(--text-primary)] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatted }}
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
          formatResponseText(displayText)
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