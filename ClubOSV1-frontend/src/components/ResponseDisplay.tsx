import React from 'react';
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import logger from '@/services/logger';

interface StructuredResponse {
  response: string;
  category?: string;
  priority?: string;
  actions?: Array<{
    type: string;
    description: string;
    details?: any;
  }>;
  metadata?: {
    requiresFollowUp?: boolean;
    emergencyType?: string;
    emergencyContacts?: string[];
  };
  escalation?: {
    required: boolean;
    to: string;
    reason: string;
    contactMethod: string;
  };
}

interface Props {
  response: any;
  route?: string;
}

export const ResponseDisplay: React.FC<Props> = ({ response, route }) => {
  // Log the response for debugging
  logger.debug('ResponseDisplay received:', { response, route });
  
  // Handle null/undefined response
  if (!response) {
    return (
      <div className="response-text">
        <p>Request processed successfully</p>
      </div>
    );
  }
  
  // Check if we have structured data either as a 'structured' property or directly in the response
  const structured = response?.structured || 
    (response?.category && response?.actions ? response : null);
  
  // Get the display text - could be in response.response or just response if it's a string
  let displayText = '';
  
  if (typeof response === 'string') {
    displayText = response;
  } else if (response?.response) {
    displayText = response.response;
  } else if (response?.message) {
    displayText = response.message;
  } else {
    // If we can't find a text response, show a default message
    displayText = 'Request processed successfully';
  }
  
  // Don't clean up the text - preserve assistant formatting
  // The assistants now return properly formatted text
  
  if (!structured) {
    // Simple text response - use ReactMarkdown for proper formatting
    return (
      <div className="space-y-2">
        <strong>Response:</strong>
        <div className="response-text text-[var(--text-primary)]">
          <ReactMarkdown 
            components={{
              p: ({children}) => <p className="mb-3 leading-relaxed">{children}</p>,
              ul: ({children}) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
              li: ({children}) => <li className="text-[var(--text-primary)]">{children}</li>,
              strong: ({children}) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
              em: ({children}) => <em className="italic">{children}</em>,
              code: ({children}) => <code className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>,
              pre: ({children}) => <pre className="bg-[var(--bg-tertiary)] p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>,
              blockquote: ({children}) => <blockquote className="border-l-4 border-[var(--accent)] pl-4 italic my-3">{children}</blockquote>,
              h1: ({children}) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
              h2: ({children}) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
              h3: ({children}) => <h3 className="text-base font-medium mb-2">{children}</h3>,
            }}
          >
            {displayText}
          </ReactMarkdown>
        </div>
        {/* AI Disclosure */}
        <div className="mt-4 pt-3 border-t border-[var(--border-secondary)]">
          <span className="text-[10px] text-[var(--text-muted)]">ClubOS AI</span>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-400';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'escalation': return <AlertCircle className="w-5 h-5" />;
      case 'resolution': return <CheckCircle className="w-5 h-5" />;
      case 'information': return <Clock className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with category and priority */}
      {(structured.category || structured.priority) && (
        <div className="flex items-center gap-4 pb-3 border-b border-[var(--border-secondary)]">
          {structured.category && (
            <div className="flex items-center gap-2">
              {getCategoryIcon(structured.category)}
              <span className="text-sm font-medium capitalize">{structured.category}</span>
            </div>
          )}
          {structured.priority && (
            <span className={`text-sm font-medium capitalize ${getPriorityColor(structured.priority)}`}>
              {structured.priority} Priority
            </span>
          )}
        </div>
      )}

      {/* Main response */}
      <div>
        <strong>Response:</strong>
        <div className="response-text mt-1 text-[var(--text-primary)]">
          <ReactMarkdown 
            components={{
              p: ({children}) => <p className="mb-3 leading-relaxed">{children}</p>,
              ul: ({children}) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
              li: ({children}) => <li className="text-[var(--text-primary)]">{children}</li>,
              strong: ({children}) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
              em: ({children}) => <em className="italic">{children}</em>,
              code: ({children}) => <code className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>,
              pre: ({children}) => <pre className="bg-[var(--bg-tertiary)] p-3 rounded-lg overflow-x-auto mb-3">{children}</pre>,
              blockquote: ({children}) => <blockquote className="border-l-4 border-[var(--accent)] pl-4 italic my-3">{children}</blockquote>,
              h1: ({children}) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
              h2: ({children}) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
              h3: ({children}) => <h3 className="text-base font-medium mb-2">{children}</h3>,
            }}
          >
            {structured.response || displayText}
          </ReactMarkdown>
        </div>
      </div>

      {/* Actions */}
      {structured.actions && structured.actions.length > 0 && (
        <div className="space-y-2">
          <strong>Required Actions:</strong>
          <div className="space-y-2 mt-2">
            {structured.actions.map((action: any, index: number) => (
              <div key={index} className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-secondary)]">
                <div className="flex items-start gap-2">
                  <span className="text-[var(--accent)] mt-0.5">
                    {action.type === 'user_action' ? '👤' : '⚙️'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm">{action.description}</p>
                    {action.details?.immediate && (
                      <span className="text-xs text-orange-400 mt-1 inline-block">⚡ Immediate action required</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emergency Contacts */}
      {structured.metadata?.emergencyContacts && structured.metadata.emergencyContacts.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <strong className="text-red-400">Emergency Contacts:</strong>
          <ul className="mt-1 space-y-1">
            {structured.metadata.emergencyContacts.map((contact: string, index: number) => (
              <li key={index} className="text-sm text-red-300">{contact}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Escalation Info */}
      {structured.escalation?.required && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
          <strong className="text-orange-400">Escalation Required:</strong>
          <p className="text-sm text-orange-300 mt-1">
            To: {structured.escalation.to} via {structured.escalation.contactMethod}
          </p>
          <p className="text-sm text-orange-300/80 mt-1">
            Reason: {structured.escalation.reason}
          </p>
        </div>
      )}

      {/* Follow-up Required */}
      {structured.metadata?.requiresFollowUp && (
        <div className="flex items-center gap-2 text-sm text-yellow-400">
          <Clock className="w-4 h-4" />
          <span>Follow-up required</span>
        </div>
      )}

      {/* AI Disclosure */}
      <div className="mt-4 pt-3 border-t border-[var(--border-secondary)]">
        <span className="text-[10px] text-[var(--text-muted)]">ClubOS AI</span>
      </div>
    </div>
  );
};
