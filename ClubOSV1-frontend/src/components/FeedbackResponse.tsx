import React from 'react';
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface FeedbackResponseProps {
  responseData: string;
}

export const FeedbackResponse: React.FC<FeedbackResponseProps> = ({ responseData }) => {
  let parsedResponse: any = null;
  let displayText = responseData;
  
  try {
    // Try to parse the response as JSON
    parsedResponse = JSON.parse(responseData);
    displayText = parsedResponse.text || parsedResponse.response || responseData;
  } catch (e) {
    // If parsing fails, use the raw text
    displayText = responseData;
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
      case 'escalation': return <AlertCircle className="w-4 h-4" />;
      case 'resolution': return <CheckCircle className="w-4 h-4" />;
      case 'information': return <Clock className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };
  
  // If we don't have structured data, just display the text
  if (!parsedResponse || (!parsedResponse.structured && !parsedResponse.category && !parsedResponse.actions)) {
    return (
      <p className="text-sm bg-[var(--bg-primary)] p-3 rounded mt-1 whitespace-pre-wrap">
        {displayText}
      </p>
    );
  }
  
  const structured = parsedResponse.structured || parsedResponse;
  
  return (
    <div className="bg-[var(--bg-primary)] p-3 rounded mt-1 space-y-3">
      {/* Main response text */}
      <div className="text-sm whitespace-pre-wrap">{displayText}</div>
      
      {/* Category and Priority */}
      {(structured.category || structured.priority) && (
        <div className="flex items-center gap-4 pt-2 border-t border-[var(--border-secondary)]">
          {structured.category && (
            <div className="flex items-center gap-1">
              {getCategoryIcon(structured.category)}
              <span className="text-xs font-medium capitalize">{structured.category}</span>
            </div>
          )}
          {structured.priority && (
            <span className={`text-xs font-medium capitalize ${getPriorityColor(structured.priority)}`}>
              {structured.priority} Priority
            </span>
          )}
        </div>
      )}
      
      {/* Actions */}
      {structured.actions && structured.actions.length > 0 && (
        <div className="pt-2 border-t border-[var(--border-secondary)]">
          <div className="text-xs font-medium mb-1">Required Actions:</div>
          <div className="space-y-1">
            {structured.actions.map((action: any, index: number) => (
              <div key={index} className="flex items-start gap-1 text-xs">
                <span className="text-[var(--accent)] mt-0.5">
                  {action.type === 'user_action' ? '👤' : '⚙️'}
                </span>
                <div className="flex-1">
                  <span>{action.description}</span>
                  {action.details?.immediate && (
                    <span className="text-orange-400 ml-2">⚡ Immediate</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Emergency Contacts */}
      {structured.metadata?.emergencyContacts && structured.metadata.emergencyContacts.length > 0 && (
        <div className="pt-2 border-t border-[var(--border-secondary)]">
          <div className="text-xs font-medium text-red-400 mb-1">Emergency Contacts:</div>
          <div className="space-y-0.5">
            {structured.metadata.emergencyContacts.map((contact: string, index: number) => (
              <div key={index} className="text-xs text-red-300">{contact}</div>
            ))}
          </div>
        </div>
      )}
      
      {/* Escalation Info */}
      {structured.escalation?.required && (
        <div className="pt-2 border-t border-[var(--border-secondary)]">
          <div className="text-xs font-medium text-orange-400 mb-1">Escalation Required:</div>
          <div className="text-xs text-orange-300">
            To: {structured.escalation.to} via {structured.escalation.contactMethod}
          </div>
          <div className="text-xs text-orange-300/80">
            Reason: {structured.escalation.reason}
          </div>
        </div>
      )}
    </div>
  );
};
