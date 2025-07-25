import React, { useState } from 'react';
import { StructuredResponse } from '@/components/StructuredResponse';
import type { NextPage } from 'next';

const StructuredResponseDemo: NextPage = () => {
  const [selectedDemo, setSelectedDemo] = useState<'emergency' | 'tech' | 'booking' | 'brand'>('tech');
  const [completedActions, setCompletedActions] = useState<number[]>([]);

  const handleActionComplete = (index: number) => {
    setCompletedActions(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const demos = {
    emergency: {
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
            information: "Fire at ClubHouse247 Golf, 123 Golf Way"
          }
        },
        {
          type: "system_action" as const,
          description: "Facility management has been notified",
          details: {
            notified: ["management", "security"],
            alarmActivated: true
          }
        }
      ],
      metadata: {
        requiresFollowUp: true,
        emergencyType: "fire",
        emergencyContacts: ["911", "Facility Management: 555-0111"],
        evacuationProcedure: "standard"
      },
      escalation: {
        required: true,
        to: "emergency_services",
        reason: "Fire reported in facility",
        contactMethod: "911"
      }
    },
    tech: {
      response: "I'll help you resolve the frozen Trackman issue. This is a common issue that can be fixed in about 5 minutes.",
      category: "solution" as const,
      priority: "medium" as const,
      actions: [
        {
          type: "user_action" as const,
          description: "Connect to the bay PC using Splashtop remote access",
          details: {
            tool: "Splashtop",
            estimatedTime: "1 minute",
            technicalLevel: "basic",
            connectionInfo: "Use bay number as computer name"
          }
        },
        {
          type: "user_action" as const,
          description: "Press the Windows key to reveal the taskbar",
          details: {
            key: "Windows key",
            alternativeMethod: "Ctrl+Esc if Windows key doesn't work",
            technicalLevel: "basic"
          }
        },
        {
          type: "user_action" as const,
          description: "Right-click on TrackMan icon and select 'Close'",
          details: {
            location: "System tray (bottom right)",
            action: "Force close application",
            technicalLevel: "basic"
          }
        },
        {
          type: "user_action" as const,
          description: "Double-click TrackMan desktop icon to restart",
          details: {
            waitTime: "30-45 seconds for full initialization",
            expectedBehavior: "TrackMan splash screen followed by main interface",
            technicalLevel: "basic"
          }
        }
      ],
      metadata: {
        requiresFollowUp: false,
        estimatedResolutionTime: "5 minutes",
        affectedSystems: ["TrackMan", "Bay PC"],
        commonIssue: true,
        solutionArticleId: "TM-001"
      },
      escalation: {
        required: false,
        to: "tech_support",
        reason: "If issue persists after restart",
        contactMethod: "slack"
      }
    },
    booking: {
      response: "I'll help you cancel your booking for tomorrow. Let me find your reservation and process the cancellation.",
      category: "confirmation" as const,
      priority: "low" as const,
      actions: [
        {
          type: "system_action" as const,
          description: "Searching for your booking",
          details: {
            searchCriteria: "User ID and date",
            timeframe: "Tomorrow (July 26, 2024)"
          }
        },
        {
          type: "user_action" as const,
          description: "Please confirm the booking you'd like to cancel",
          details: {
            bookingInfo: {
              date: "2024-07-26",
              time: "15:00",
              bay: "Bay 5",
              duration: "1 hour",
              players: "4"
            },
            confirmationRequired: true
          }
        },
        {
          type: "system_action" as const,
          description: "Processing cancellation and refund",
          details: {
            refundAmount: "$85.00",
            refundMethod: "Original payment method",
            processingTime: "3-5 business days"
          }
        }
      ],
      metadata: {
        requiresFollowUp: false,
        bookingDetails: {
          confirmationNumber: "CH247-2024-0726-1500",
          originalBookingDate: "2024-07-20",
          cancellationDate: "2024-07-25"
        },
        policies: {
          cancellation: "Free cancellation up to 2 hours before booking",
          refund: "Full refund for timely cancellations"
        }
      },
      escalation: {
        required: false
      }
    },
    brand: {
      response: "Great question about our memberships! We offer several options designed to fit different playing styles and budgets.",
      category: "information" as const,
      priority: "low" as const,
      actions: [
        {
          type: "user_action" as const,
          description: "Explore our membership tiers",
          details: {
            membershipTypes: [
              {
                name: "Eagle Unlimited",
                price: "$299/month",
                benefits: ["Unlimited play", "20% off guests", "Priority booking"],
                bestFor: "Serious golfers (15+ hours/month)"
              },
              {
                name: "Birdie Plus",
                price: "$149/month",
                benefits: ["10 hours monthly", "10% off guests", "$10/hour after"],
                bestFor: "Regular players (2-3 times/week)"
              },
              {
                name: "Par Player",
                price: "$79/month",
                benefits: ["5 hours monthly", "5% off guests"],
                bestFor: "Casual golfers"
              }
            ]
          }
        },
        {
          type: "user_action" as const,
          description: "Schedule a facility tour",
          details: {
            tourAvailability: "Daily at 10am, 2pm, and 6pm",
            duration: "30 minutes",
            bookingLink: "clubhouse247golf.com/tour"
          }
        },
        {
          type: "system_action" as const,
          description: "Special offer available",
          details: {
            promotion: "First month 50% off",
            validUntil: "End of month",
            promoCode: "NEWMEMBER50"
          }
        }
      ],
      metadata: {
        requiresFollowUp: true,
        topicCategory: "membership",
        relevantOffers: ["NEWMEMBER50", "REFERRAL20"],
        additionalResources: ["Membership comparison chart", "Member testimonials"]
      },
      escalation: {
        required: false,
        to: "sales_team",
        reason: "Custom membership packages available",
        contactMethod: "email: memberships@clubhouse247golf.com"
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8">Structured Response Demo</h1>
        
        {/* Demo Selector */}
        <div className="mb-8">
          <label className="block text-sm font-medium mb-2">Select Response Type:</label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedDemo('emergency');
                setCompletedActions([]);
              }}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedDemo === 'emergency' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              🚨 Emergency
            </button>
            <button
              onClick={() => {
                setSelectedDemo('tech');
                setCompletedActions([]);
              }}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedDemo === 'tech' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              🔧 Tech Support
            </button>
            <button
              onClick={() => {
                setSelectedDemo('booking');
                setCompletedActions([]);
              }}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedDemo === 'booking' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              📅 Booking
            </button>
            <button
              onClick={() => {
                setSelectedDemo('brand');
                setCompletedActions([]);
              }}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedDemo === 'brand' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              💼 Brand Info
            </button>
          </div>
        </div>

        {/* Structured Response Display */}
        <StructuredResponse
          response={demos[selectedDemo]}
          onActionComplete={handleActionComplete}
          completedActions={completedActions}
        />

        {/* Progress Tracker */}
        {demos[selectedDemo].actions && (
          <div className="mt-6 p-4 bg-[var(--bg-secondary)] rounded-lg">
            <h3 className="text-sm font-medium mb-2">Progress Tracker</h3>
            <div className="text-sm text-[var(--text-secondary)]">
              {completedActions.length} of {demos[selectedDemo].actions.length} steps completed
            </div>
            {completedActions.length === demos[selectedDemo].actions.length && (
              <div className="mt-2 text-green-500 text-sm font-medium">
                ✅ All steps completed!
              </div>
            )}
          </div>
        )}

        {/* Raw JSON Display (for debugging) */}
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            View Raw JSON Response
          </summary>
          <pre className="mt-2 p-4 bg-[var(--bg-secondary)] rounded-lg overflow-auto text-xs">
            {JSON.stringify(demos[selectedDemo], null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

export default StructuredResponseDemo;
