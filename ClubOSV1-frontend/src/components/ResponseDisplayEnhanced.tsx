import React, { useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Zap,
  Database,
  Bot,
  Image,
  FileText,
  Copy,
  X,
  Maximize2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import logger from '@/services/logger';

// Content parser utility
export const parseResponseContent = (text: string): ParsedSection[] => {
  if (!text) return [];

  const sections: ParsedSection[] = [];

  // Try to detect technical specifications with measurements
  const measurementPattern = /(\d+(?:\.\d+)?)\s*(?:["']|inches?|feet|ft|mm|cm|m|×|x)\s*/gi;
  const hasMeasurements = measurementPattern.test(text);

  // Split content into logical sections
  const lines = text.split('\n').filter(line => line.trim());
  let currentSection: ParsedSection | null = null;

  for (const line of lines) {
    // Check if this is a section header (contains colon and is relatively short)
    if (line.includes(':') && line.length < 100 && !line.includes('•')) {
      const [title, ...contentParts] = line.split(':');
      const content = contentParts.join(':').trim();

      if (currentSection) {
        sections.push(currentSection);
      }

      currentSection = {
        type: hasMeasurements && line.match(measurementPattern) ? 'specifications' : 'text',
        title: title.trim(),
        content: content ? [content] : []
      };
    } else if (line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./)) {
      // This is a list item
      if (!currentSection) {
        currentSection = { type: 'list', title: 'Details', content: [] };
      }
      if (currentSection.type !== 'list') {
        sections.push(currentSection);
        currentSection = { type: 'list', title: 'Details', content: [] };
      }
      currentSection.content.push(line.replace(/^[•\-\d+\.]\s*/, ''));
    } else {
      // Regular text
      if (!currentSection) {
        currentSection = { type: 'text', title: 'Information', content: [] };
      }
      currentSection.content.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  // If no sections were created, treat entire text as one section
  if (sections.length === 0) {
    sections.push({
      type: 'text',
      title: 'Response',
      content: lines
    });
  }

  return sections;
};

interface ParsedSection {
  type: 'specifications' | 'list' | 'table' | 'text';
  title: string;
  content: string[];
}

interface Props {
  response: any;
  route?: string;
  photos?: string[];
}

const ConfidenceMeter: React.FC<{ confidence: number }> = ({ confidence }) => {
  const percentage = Math.round(confidence * 100);
  const getColor = () => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-[var(--text-secondary)]">Confidence</span>
      <div className="flex-1 relative">
        <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className={`h-full ${getColor()} transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <span className="text-sm font-bold text-[var(--text-primary)]">{percentage}%</span>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string; confidence?: number }> = ({ status, confidence }) => {
  const getStatusIcon = () => {
    if (status === 'completed') return <CheckCircle className="w-5 h-5" />;
    if (status === 'processing') return <Clock className="w-5 h-5" />;
    if (status === 'error') return <AlertCircle className="w-5 h-5" />;
    return <AlertTriangle className="w-5 h-5" />;
  };

  const getStatusColor = () => {
    if (status === 'completed') return 'text-green-500 bg-green-500/10 border-green-500/20';
    if (status === 'processing') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    if (status === 'error') return 'text-red-500 bg-red-500/10 border-red-500/20';
    return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getStatusColor()}`}>
      {getStatusIcon()}
      <span className="text-sm font-medium capitalize">{status || 'Completed'}</span>
    </div>
  );
};

const PhotoGallery: React.FC<{ photos: string[] }> = ({ photos }) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {photos.map((photo, index) => (
          <button
            key={index}
            onClick={() => setSelectedPhoto(photo)}
            className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border-secondary)] hover:border-[var(--accent)] transition-colors group"
          >
            <img
              src={photo}
              alt={`Attachment ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={selectedPhoto}
            alt="Full size"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

const CollapsibleSection: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[var(--border-secondary)] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 bg-[var(--bg-primary)]">
          {children}
        </div>
      )}
    </div>
  );
};

const MetadataFooter: React.FC<{
  route?: string;
  dataSource?: string;
  processingTime?: number;
}> = ({ route, dataSource, processingTime }) => {
  const getRouteIcon = () => {
    if (route?.toLowerCase().includes('emergency')) return <AlertCircle className="w-3 h-3" />;
    if (route?.toLowerCase().includes('tech')) return <Bot className="w-3 h-3" />;
    if (route?.toLowerCase().includes('booking')) return <Clock className="w-3 h-3" />;
    return <Zap className="w-3 h-3" />;
  };

  const getTimeColor = () => {
    if (!processingTime) return 'text-[var(--text-muted)]';
    if (processingTime < 5000) return 'text-green-500';
    if (processingTime < 15000) return 'text-yellow-500';
    return 'text-orange-500';
  };

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] pt-3 border-t border-[var(--border-secondary)]">
      {route && (
        <div className="flex items-center gap-1">
          {getRouteIcon()}
          <span>Route: {route}</span>
        </div>
      )}
      {dataSource && (
        <div className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          <span>Source: {dataSource}</span>
        </div>
      )}
      {processingTime && (
        <div className={`flex items-center gap-1 ${getTimeColor()}`}>
          <Clock className="w-3 h-3" />
          <span>{(processingTime / 1000).toFixed(1)}s</span>
        </div>
      )}
      <div className="ml-auto">
        <span className="text-[10px] text-[var(--text-muted)]">ClubOS AI</span>
      </div>
    </div>
  );
};

export const ResponseDisplayEnhanced: React.FC<Props> = ({ response, route, photos = [] }) => {
  logger.debug('ResponseDisplayEnhanced received:', { response, route, photos });

  // Handle null/undefined response
  if (!response) {
    return (
      <div className="space-y-4">
        <StatusBadge status="completed" />
        <div className="text-[var(--text-primary)]">
          <p>Request processed successfully</p>
        </div>
      </div>
    );
  }

  // Extract response data
  const structured = response?.structured ||
    (response?.category && response?.actions ? response : null);

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

  // Parse the response content into sections
  const parsedSections = parseResponseContent(displayText);

  // Extract metadata
  const confidence = response?.confidence || response?.llmResponse?.confidence;
  const status = response?.status || 'completed';
  const dataSource = response?.dataSource || response?.llmResponse?.dataSource;
  const processingTime = response?.processingTime;

  return (
    <div className="space-y-4">
      {/* Header with status and confidence */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <StatusBadge status={status} confidence={confidence} />
        {confidence !== undefined && (
          <div className="flex-1 max-w-xs">
            <ConfidenceMeter confidence={confidence} />
          </div>
        )}
      </div>

      {/* Main content sections */}
      {parsedSections.map((section, index) => (
        <CollapsibleSection
          key={index}
          title={section.title}
          icon={
            section.type === 'specifications' ? <FileText className="w-4 h-4" /> :
            section.type === 'list' ? <AlertCircle className="w-4 h-4" /> :
            <Bot className="w-4 h-4" />
          }
          defaultOpen={index === 0}
        >
          {section.type === 'list' ? (
            <ul className="space-y-2">
              {section.content.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[var(--accent)] mt-0.5">•</span>
                  <span className="text-sm text-[var(--text-primary)]">{item}</span>
                </li>
              ))}
            </ul>
          ) : section.type === 'specifications' ? (
            <div className="space-y-3">
              {section.content.map((spec, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded">
                  <span className="text-sm text-[var(--text-primary)] font-mono">{spec}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {section.content.map((text, i) => (
                <p key={i} className="text-sm text-[var(--text-primary)] leading-relaxed">{text}</p>
              ))}
            </div>
          )}
        </CollapsibleSection>
      ))}

      {/* Structured response actions if present */}
      {structured?.actions && structured.actions.length > 0 && (
        <CollapsibleSection
          title="Required Actions"
          icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}
        >
          <div className="space-y-2">
            {structured.actions.map((action: any, index: number) => (
              <div key={index} className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-secondary)]">
                <div className="flex items-start gap-2">
                  <span className="text-[var(--accent)] mt-0.5">
                    {action.type === 'user_action' ? '👤' : '⚙️'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-primary)]">{action.description}</p>
                    {action.details?.immediate && (
                      <span className="text-xs text-orange-400 mt-1 inline-block">⚡ Immediate action required</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Photo attachments */}
      {photos.length > 0 && (
        <CollapsibleSection
          title={`Attachments (${photos.length})`}
          icon={<Image className="w-4 h-4" />}
        >
          <PhotoGallery photos={photos} />
        </CollapsibleSection>
      )}

      {/* Emergency contacts if present */}
      {structured?.metadata?.emergencyContacts && structured.metadata.emergencyContacts.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <strong className="text-red-400 text-sm">Emergency Contacts:</strong>
          <ul className="mt-1 space-y-1">
            {structured.metadata.emergencyContacts.map((contact: string, index: number) => (
              <li key={index} className="text-sm text-red-300">{contact}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Escalation info if present */}
      {structured?.escalation?.required && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <strong className="text-orange-400 text-sm">Escalation Required:</strong>
          <p className="text-sm text-orange-300 mt-1">
            To: {structured.escalation.to} via {structured.escalation.contactMethod}
          </p>
          <p className="text-sm text-orange-300/80 mt-1">
            Reason: {structured.escalation.reason}
          </p>
        </div>
      )}

      {/* Metadata footer */}
      <MetadataFooter
        route={route || response?.botRoute}
        dataSource={dataSource}
        processingTime={processingTime}
      />
    </div>
  );
};

export default ResponseDisplayEnhanced;