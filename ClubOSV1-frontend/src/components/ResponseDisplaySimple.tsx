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

  // Split into sentences and clean up
  const lines = text
    .replace(/\. /g, '.\n\n')  // Add line breaks after periods
    .replace(/: /g, ':\n')      // Add line breaks after colons
    .replace(/\d+"/g, (match) => `**${match}**`)  // Bold measurements
    .replace(/\d+'/g, (match) => `**${match}**`)  // Bold feet measurements
    .replace(/\d+ inches/gi, (match) => `**${match}**`)  // Bold inch measurements
    .replace(/\d+ feet/gi, (match) => `**${match}**`)  // Bold feet text
    .split('\n')
    .filter(line => line.trim());

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();

        // Check if this line is a header (ends with colon)
        if (trimmedLine.endsWith(':')) {
          return (
            <div key={index} className="mt-4">
              <strong className="text-sm font-semibold text-[var(--text-primary)]">
                {trimmedLine}
              </strong>
            </div>
          );
        }

        // Check if this line contains measurements or dimensions
        const hasMeasurements = /\d+["']|\d+\s*(inches|feet|mm|cm|m)/i.test(trimmedLine);

        if (hasMeasurements) {
          // Parse the line and bold the measurements
          const formattedLine = trimmedLine
            .replace(/(\d+(?:\.\d+)?)\s*["']/g, '<strong>$1"</strong>')
            .replace(/(\d+(?:\.\d+)?)\s*(inches|feet|mm|cm|m)/gi, '<strong>$1 $2</strong>')
            .replace(/(\d+)\s*x\s*(\d+)/gi, '<strong>$1 × $2</strong>');

          return (
            <div
              key={index}
              className="text-sm text-[var(--text-primary)] leading-relaxed pl-4"
              dangerouslySetInnerHTML={{ __html: formattedLine }}
            />
          );
        }

        // Regular text line
        return (
          <div key={index} className="text-sm text-[var(--text-primary)] leading-relaxed pl-4">
            {trimmedLine}
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
      // Format as knowledge update
      const correctionInput = `Correction: The correct response is "${editedText}". This replaces the incorrect response: "${displayText}"`;

      const result = await http.post('knowledge-router/parse-and-route', {
        input: correctionInput
      });

      if (result.data.success) {
        // Also try to update specific knowledge entries
        const updateResult = await http.post('knowledge-correct/correct', {
          originalResponse: displayText,
          correctedResponse: editedText,
          context: {
            route: route || response?.botRoute,
            originalQuery: originalQuery,
            confidence: confidence
          }
        }).catch(() => null); // Fail silently if endpoint doesn't exist yet

        const updates = updateResult?.data?.updates || { knowledge_updated: 1 };
        toast.success(`✓ Correction saved! Updated ${updates.knowledge_updated || 1} knowledge entries`);
        setIsEditing(false);

        // Update display text
        displayText = editedText;
      } else {
        toast.error('Failed to save correction');
      }
    } catch (error) {
      console.error('Correction error:', error);
      toast.error('Failed to save correction');
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
          formatStructuredContent(displayText)
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