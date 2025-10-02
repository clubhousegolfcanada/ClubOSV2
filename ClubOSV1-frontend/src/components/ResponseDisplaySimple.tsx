import React from 'react';
import { Bot, Database, Clock } from 'lucide-react';
import logger from '@/services/logger';

interface Props {
  response: any;
  route?: string;
  photos?: string[];
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

export const ResponseDisplaySimple: React.FC<Props> = ({ response, route, photos = [] }) => {
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

  // Extract metadata
  const confidence = response?.confidence || response?.llmResponse?.confidence;
  const status = response?.status || 'completed';
  const dataSource = response?.dataSource || response?.llmResponse?.dataSource;
  const processingTime = response?.processingTime;

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
        <div className="mb-2">
          <strong className="text-sm font-semibold text-[var(--text-primary)]">Response:</strong>
        </div>
        {formatStructuredContent(displayText)}
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