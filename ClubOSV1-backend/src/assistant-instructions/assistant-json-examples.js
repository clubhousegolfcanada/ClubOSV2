// Example responses for each assistant type

// Tech Support Assistant Response
{
  "response": "I'll help you resolve the frozen Trackman issue. Please follow these steps to fix the problem.",
  "category": "solution",
  "priority": "medium",
  "actions": [
    {
      "type": "user_action",
      "description": "Access the Bay PC remotely using Splashtop",
      "details": {
        "tool": "Splashtop",
        "estimatedTime": "1 minute"
      }
    },
    {
      "type": "user_action", 
      "description": "Press Windows key to reveal the taskbar",
      "details": {
        "key": "Windows",
        "purpose": "Access system controls"
      }
    },
    {
      "type": "user_action",
      "description": "Right-click on TrackMan icon and select 'Close'",
      "details": {
        "application": "TrackMan",
        "action": "force_close"
      }
    },
    {
      "type": "user_action",
      "description": "Relaunch TrackMan from desktop",
      "details": {
        "waitTime": "30-45 seconds",
        "expectedResult": "System initialization"
      }
    }
  ],
  "metadata": {
    "requiresFollowUp": true,
    "estimatedResolutionTime": "5 minutes",
    "affectedSystems": ["TrackMan", "Bay 3"],
    "relatedArticles": ["trackman-troubleshooting-guide"]
  },
  "escalation": {
    "required": false,
    "to": "tech_support",
    "reason": "If issue persists after following steps",
    "contactMethod": "Slack Tech Support channel"
  }
}

// Emergency Assistant Response
{
  "response": "I understand there's a fire emergency. Safety is our top priority.",
  "category": "escalation",
  "priority": "urgent",
  "actions": [
    {
      "type": "user_action",
      "description": "Evacuate the building immediately via nearest exit",
      "details": {
        "immediate": true,
        "doNotUse": ["elevators"]
      }
    },
    {
      "type": "user_action",
      "description": "Call 911 immediately",
      "details": {
        "number": "911",
        "information": "Report fire at ClubHouse247 Golf facility"
      }
    },
    {
      "type": "system_action",
      "description": "Alert facility management",
      "details": {
        "contact": "555-0111",
        "notificationSent": true
      }
    }
  ],
  "metadata": {
    "requiresFollowUp": true,
    "affectedSystems": ["entire_facility"],
    "emergencyProtocol": "FIRE_EVACUATION"
  },
  "escalation": {
    "required": true,
    "to": "emergency_services",
    "reason": "Fire emergency reported",
    "contactMethod": "911"
  }
}

// Booking Assistant Response  
{
  "response": "I'll help you cancel your booking for tomorrow.",
  "category": "confirmation",
  "priority": "low",
  "actions": [
    {
      "type": "system_action",
      "description": "Locate booking for tomorrow",
      "details": {
        "searchDate": "2024-01-26",
        "userId": "user123"
      }
    },
    {
      "type": "user_action",
      "description": "Please confirm the booking details",
      "details": {
        "bookingFound": true,
        "time": "3:00 PM",
        "bay": "Bay 5",
        "duration": "1 hour"
      }
    }
  ],
  "metadata": {
    "requiresFollowUp": false,
    "affectedSystems": ["booking_system"],
    "cancellationPolicy": "Free cancellation up to 2 hours before"
  },
  "escalation": {
    "required": false
  }
}
