import React from 'react';
import { AlertTriangle, Clock, CheckCircle, Info, XCircle } from 'lucide-react';

// Type definitions for the structured response
interface Action {
  type: 'user_action' | 'system_action';
  description: string;
  details?: Record<string, any>;
}

interface Escalation {
  required: boolean;
  to?: string;
  reason?: string;
  contactMethod?: string;
}

interface LLMResponse {
  response: string;
  category?: 'escalation' | 'solution' | 'information' | 'confirmation' | 'error';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  actions?: Action[];
  metadata?: Record<string, any>;
  escalation?: Escalation;
}

// Priority indicator component
const PriorityIndicator: React.FC<{ priority?: string }> = ({ priority }) => {
  const configs = {
    urgent: { color: 'bg-red-500', text: 'text-red-500', icon: AlertTriangle, pulse: true },
    high: { color: 'bg-orange-500', text: 'text-orange-500', icon: AlertTriangle, pulse: false },
    medium: { color: 'bg-yellow-500', text: 'text-yellow-500', icon: Clock, pulse: false },
    low: { color: 'bg-blue-500', text: 'text-blue-500', icon: Info, pulse: false }
  };

  const config = configs[priority as keyof typeof configs] || configs.low;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className={`relative ${config.pulse ? 'animate-pulse' : ''}`}>
        <div className={`w-3 h-3 ${config.color} rounded-full`} />
        {config.pulse && (
          <div className={`absolute inset-0 w-3 h-3 ${config.color} rounded-full animate-ping`} />
        )}
      </div>
      <Icon className={`w-5 h-5 ${config.text}`} />
      <span className={`text-sm font-medium ${config.text} uppercase`}>
        {priority}
      </span>
    </div>
  );
};

// Category badge component
const CategoryBadge: React.FC<{ category?: string }> = ({ category }) => {
  const configs = {
    escalation: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    solution: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    information: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
    confirmation: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
    error: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' }
  };

  const config = configs[category as keyof typeof configs] || configs.information;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      {category}
    </span>
  );
};

// Action item component
const ActionItem: React.FC<{ 
  action: Action; 
  index: number;
  onComplete?: (index: number) => void;
  isCompleted?: boolean;
}> = ({ action, index, onComplete, isCompleted = false }) => {
  const isUserAction = action.type === 'user_action';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
      isCompleted ? 'bg-gray-50 opacity-60' : 'bg-white hover:bg-gray-50'
    }`}>
      {isUserAction && onComplete && (
        <button
          onClick={() => onComplete(index)}
          className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isCompleted 
              ? 'bg-green-500 border-green-500' 
              : 'border-gray-300 hover:border-green-500'
          }`}
        >
          {isCompleted && <CheckCircle className="w-3 h-3 text-white" />}
        </button>
      )}
      
      {!isUserAction && (
        <div className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
        </div>
      )}

      <div className="flex-1">
        <p className={`text-sm ${isCompleted ? 'line-through' : ''}`}>
          {action.description}
        </p>
        
        {action.details && Object.keys(action.details).length > 0 && (
          <div className="mt-2 space-y-1">
            {Object.entries(action.details).map(([key, value]) => (
              <div key={key} className="text-xs text-gray-600">
                <span className="font-medium">{key.replace(/_/g, ' ')}:</span>{' '}
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </div>
            ))}
          </div>
        )}
      </div>

      <span className="text-xs text-gray-500 mt-0.5">
        {isUserAction ? 'You' : 'System'}
      </span>
    </div>
  );
};

// Escalation alert component
const EscalationAlert: React.FC<{ escalation: Escalation }> = ({ escalation }) => {
  if (!escalation.required) return null;

  return (
    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-red-800">Escalation Required</h4>
          <p className="text-sm text-red-700 mt-1">{escalation.reason}</p>
          {escalation.to && (
            <p className="text-sm text-red-600 mt-2">
              <span className="font-medium">Contact:</span> {escalation.to}
              {escalation.contactMethod && ` via ${escalation.contactMethod}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Main response component
export const StructuredResponse: React.FC<{ 
  response: LLMResponse;
  onActionComplete?: (index: number) => void;
  completedActions?: number[];
}> = ({ response, onActionComplete, completedActions = [] }) => {
  // If no structured data, fall back to simple display
  if (!response.category && !response.priority && !response.actions) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <p className="text-gray-800">{response.response}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CategoryBadge category={response.category} />
            {response.metadata?.estimatedResolutionTime && (
              <span className="text-sm text-gray-600 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {response.metadata.estimatedResolutionTime}
              </span>
            )}
          </div>
          <PriorityIndicator priority={response.priority} />
        </div>
      </div>

      {/* Main response */}
      <div className="px-6 py-4">
        <p className="text-gray-800 mb-4">{response.response}</p>

        {/* Actions */}
        {response.actions && response.actions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Steps to Follow
            </h3>
            <div className="space-y-2">
              {response.actions.map((action, index) => (
                <ActionItem
                  key={index}
                  action={action}
                  index={index}
                  onComplete={onActionComplete}
                  isCompleted={completedActions.includes(index)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Metadata display */}
        {response.metadata && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Additional Information</h4>
            <div className="space-y-2">
              {Object.entries(response.metadata).map(([key, value]) => {
                if (key === 'requiresFollowUp' || key === 'estimatedResolutionTime') return null;
                return (
                  <div key={key} className="text-sm">
                    <span className="font-medium text-gray-700">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                    </span>{' '}
                    <span className="text-gray-600">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Escalation alert */}
        {response.escalation && <EscalationAlert escalation={response.escalation} />}
      </div>

      {/* Footer */}
      {response.metadata?.requiresFollowUp && (
        <div className="px-6 py-3 bg-blue-50 border-t border-blue-100">
          <p className="text-sm text-blue-800 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Follow-up required after completing these steps
          </p>
        </div>
      )}
    </div>
  );
};
