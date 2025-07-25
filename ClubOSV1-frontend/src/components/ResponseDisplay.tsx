import React from 'react';
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

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
  const structured = response?.structured || 
    (response?.category ? response : null);
  
  if (!structured) {
    // Simple text response
    return (
      <>
        <strong>Recommendation:</strong>
        <p className="response-text">{response?.response || 'Request processed successfully'}</p>
      </>
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
        <p className="response-text mt-1">{structured.response || response?.response}</p>
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
    </div>
  );
};
