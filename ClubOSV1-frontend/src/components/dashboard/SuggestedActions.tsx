import React, { useEffect, useState } from 'react';
import { AlertCircle, X, Check, Clock } from 'lucide-react';
import { http } from '@/api/http';
import { tokenManager } from '@/utils/tokenManager';
import logger from '@/services/logger';


interface SuggestedAction {
  id: string;
  type: 'reset' | 'customer' | 'bay_idle' | 'pattern';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: Date;
  metadata?: any;
}

export const SuggestedActions: React.FC = () => {
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [dismissedActions, setDismissedActions] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatterns = async () => {
      try {
        const token = tokenManager.getToken();
        const headers = token ? { } : {};

        // Fetch recent history and tickets to identify patterns
        const [historyRes, ticketsRes] = await Promise.all([
          http.get(`history?limit=50`, { headers }),
          http.get(`tickets?status=open&limit=20`, { headers })
        ]);

        const history = historyRes.data?.data || [];
        const tickets = ticketsRes.data?.data || [];

        const suggestedActions: SuggestedAction[] = [];

        // Pattern 1: Multiple resets in same bay
        const bayResets: Record<string, number> = {};
        history.forEach((item: any) => {
          if (item.request?.toLowerCase().includes('reset') && item.request.match(/bay\s*(\d+)/i)) {
            const bayMatch = item.request.match(/bay\s*(\d+)/i);
            if (bayMatch) {
              const bayNumber = bayMatch[1];
              bayResets[bayNumber] = (bayResets[bayNumber] || 0) + 1;
            }
          }
        });

        Object.entries(bayResets).forEach(([bay, count]) => {
          if (count >= 2) {
            suggestedActions.push({
              id: `reset-bay-${bay}`,
              type: 'reset',
              title: `Multiple resets in Bay ${bay}`,
              description: `${count} reset requests in the last 2 hours. Consider flagging for tech review.`,
              priority: count > 3 ? 'high' : 'medium',
              timestamp: new Date(),
              metadata: { bay, count }
            });
          }
        });

        // Pattern 2: Customer with multiple cancellations (mock for now)
        // In real implementation, would analyze booking/customer data

        // Pattern 3: Bay idle detection (mock)
        const idleBays = [
          { bay: 4, duration: '45 min' },
          { bay: 7, duration: '30 min' }
        ];

        idleBays.forEach(({ bay, duration }) => {
          if (Math.random() > 0.7) { // Only show occasionally to avoid clutter
            suggestedActions.push({
              id: `idle-bay-${bay}`,
              type: 'bay_idle',
              title: `Bay ${bay} idle but marked booked`,
              description: `No activity for ${duration}. Send check-in prompt to customer?`,
              priority: 'low',
              timestamp: new Date(),
              metadata: { bay, duration }
            });
          }
        });

        // Limit to 3 most important actions
        const topActions = suggestedActions
          .sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          })
          .slice(0, 3);

        setActions(topActions);
      } catch (error) {
        logger.error('Failed to fetch pattern data:', error);
      }
    };

    fetchPatterns();
    // Refresh every 2 minutes
    const interval = setInterval(fetchPatterns, 120000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = (actionId: string) => {
    setDismissedActions(prev => new Set(prev).add(actionId));
    setActions(prev => prev.filter(a => a.id !== actionId));
  };

  const handleConfirm = async (action: SuggestedAction) => {
    setIsProcessing(action.id);
    
    try {
      const token = tokenManager.getToken();
      
      // Handle different action types
      switch (action.type) {
        case 'reset':
          // Create a tech ticket
          await http.post(`tickets`, {
            title: action.title,
            description: `Automated flag: ${action.description}`,
            category: 'tech',
            priority: action.priority
          }, {

          });
          break;
          
        case 'bay_idle':
          // Would send check-in message in real implementation
          logger.debug('Sending check-in prompt for', action.metadata.bay);
          break;
      }
      
      handleDismiss(action.id);
    } catch (error) {
      logger.error('Failed to process action:', error);
    } finally {
      setIsProcessing(null);
    }
  };

  const visibleActions = actions.filter(a => !dismissedActions.has(a.id));

  if (visibleActions.length === 0) {
    return null;
  }

  return (
    <div className="hidden lg:block w-full mt-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Suggested Actions
          </h3>
          <span className="text-xs text-[var(--text-muted)]">
            {visibleActions.length} pattern{visibleActions.length !== 1 ? 's' : ''} detected
          </span>
        </div>
        
        <div className="space-y-2">
          {visibleActions.map(action => (
            <div 
              key={action.id}
              className="flex items-start justify-between p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]"
            >
              <div className="flex items-start space-x-2 flex-1">
                <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  action.priority === 'high' ? 'text-red-500' :
                  action.priority === 'medium' ? 'text-yellow-500' :
                  'text-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {action.title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {action.description}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => handleConfirm(action)}
                  disabled={isProcessing === action.id}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                  title="Confirm action"
                >
                  {isProcessing === action.id ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleDismiss(action.id)}
                  disabled={isProcessing === action.id}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] rounded transition-colors"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};