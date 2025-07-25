import React, { useState } from 'react';
import { StructuredResponse } from './StructuredResponse';

// Example hook to integrate with your existing request form
export const useStructuredResponse = () => {
  const [completedActions, setCompletedActions] = useState<number[]>([]);

  const handleActionComplete = (index: number) => {
    setCompletedActions(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const resetActions = () => {
    setCompletedActions([]);
  };

  return {
    completedActions,
    handleActionComplete,
    resetActions
  };
};

// Integration example for RequestForm.tsx
// Replace the existing response section with this:
export const ResponseSection = ({ lastResponse, smartAssistEnabled }: any) => {
  const { completedActions, handleActionComplete, resetActions } = useStructuredResponse();

  // Extract structured data from the response
  const structuredData = lastResponse?.llmResponse;
  
  if (!structuredData) {
    // Fallback to original display
    return (
      <div className="response-content">
        <strong>Recommendation:</strong>
        <p className="response-text">{lastResponse?.llmResponse?.response || 'Request processed successfully'}</p>
      </div>
    );
  }

  return (
    <StructuredResponse
      response={structuredData}
      onActionComplete={handleActionComplete}
      completedActions={completedActions}
    />
  );
};

// Example of how to use in different scenarios:

// Emergency Response Example
export const EmergencyResponseExample = () => {
  const emergencyResponse = {
    response: "Fire emergency detected. Your safety is our top priority. Follow these immediate steps.",
    category: "escalation" as const,
    priority: "urgent" as const,
    actions: [
      {
        type: "user_action" as const,
        description: "EVACUATE immediately using the nearest exit",
        details: {
          immediate: true,
          avoid: ["elevators", "locked areas"],
          evacuationPoint: "parking lot assembly area"
        }
      },
      {
        type: "user_action" as const,
        description: "Call 911 after reaching safety",
        details: {
          number: "911",
          information: "Fire at ClubHouse247 Golf"
        }
      }
    ],
    metadata: {
      requiresFollowUp: true,
      emergencyType: "fire",
      emergencyContacts: ["911", "Facility Management: 555-0111"]
    },
    escalation: {
      required: true,
      to: "emergency_services",
      reason: "Fire reported in facility",
      contactMethod: "911"
    }
  };

  return <StructuredResponse response={emergencyResponse} />;
};

// Tech Support Example
export const TechSupportResponseExample = () => {
  const techResponse = {
    response: "I'll help you resolve the frozen Trackman issue. Please follow these steps.",
    category: "solution" as const,
    priority: "medium" as const,
    actions: [
      {
        type: "user_action" as const,
        description: "Access the Bay PC remotely using Splashtop",
        details: {
          tool: "Splashtop",
          estimatedTime: "1 minute",
          technicalLevel: "basic"
        }
      },
      {
        type: "user_action" as const,
        description: "Press Windows key to reveal the taskbar",
        details: {
          key: "Windows",
          alternativeMethod: "Ctrl+Esc if Windows key doesn't work"
        }
      }
    ],
    metadata: {
      requiresFollowUp: false,
      estimatedResolutionTime: "5 minutes",
      affectedSystems: ["TrackMan", "Bay 3"],
      commonIssue: true
    },
    escalation: {
      required: false,
      to: "tech_support",
      reason: "If issue persists after restart",
      contactMethod: "slack"
    }
  };

  return <StructuredResponse response={techResponse} />;
};

// Integration points for RequestForm.tsx:

// 1. Import the StructuredResponse component
// import { StructuredResponse } from './StructuredResponse';

// 2. Add state for tracking completed actions
// const [completedActions, setCompletedActions] = useState<number[]>([]);

// 3. Replace the response display section with:
/*
{showResponse && lastResponse && !isProcessing && (
  <div className="card response-area" id="response-area">
    {smartAssistEnabled && lastResponse.llmResponse ? (
      <StructuredResponse
        response={lastResponse.llmResponse}
        onActionComplete={(index) => {
          setCompletedActions(prev => 
            prev.includes(index) 
              ? prev.filter(i => i !== index)
              : [...prev, index]
          );
        }}
        completedActions={completedActions}
      />
    ) : (
      // Original Slack response display
      <div className="response-content">
        <strong>Sent to Slack</strong><br />
        Your question has been posted to the general Slack channel.
      </div>
    )}
  </div>
)}
*/

// 4. Reset completed actions when resetting form
// In handleReset function, add: setCompletedActions([]);
