# OpenAI Assistant JSON Schemas

## Emergency Assistant Schema

```json
{
  "name": "emergency_response",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "response": {
        "type": "string",
        "description": "Clear, calm instructions for the emergency"
      },
      "category": {
        "type": "string",
        "enum": ["escalation"],
        "description": "Always 'escalation' for emergencies"
      },
      "priority": {
        "type": "string",
        "enum": ["urgent"],
        "description": "Always 'urgent' for emergencies"
      },
      "actions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["user_action", "system_action"]
            },
            "description": {
              "type": "string"
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          },
          "required": ["type", "description"],
          "additionalProperties": false
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "requiresFollowUp": {
            "type": "boolean"
          },
          "emergencyType": {
            "type": "string",
            "enum": ["fire", "medical", "power", "safety", "other"]
          },
          "emergencyContacts": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": ["requiresFollowUp", "emergencyType"],
        "additionalProperties": true
      },
      "escalation": {
        "type": "object",
        "properties": {
          "required": {
            "type": "boolean"
          },
          "to": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          },
          "contactMethod": {
            "type": "string"
          }
        },
        "required": ["required"],
        "additionalProperties": false
      }
    },
    "required": ["response", "category", "priority", "actions", "metadata", "escalation"],
    "additionalProperties": false
  }
}
```

## Tech Support Assistant Schema

```json
{
  "name": "tech_support_response",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "response": {
        "type": "string",
        "description": "Clear explanation of the solution"
      },
      "category": {
        "type": "string",
        "enum": ["solution", "information", "escalation"],
        "description": "Type of response being provided"
      },
      "priority": {
        "type": "string",
        "enum": ["low", "medium", "high"],
        "description": "Urgency of the issue"
      },
      "actions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["user_action", "system_action"]
            },
            "description": {
              "type": "string"
            },
            "details": {
              "type": "object",
              "properties": {
                "tool": {
                  "type": "string"
                },
                "estimatedTime": {
                  "type": "string"
                },
                "technicalLevel": {
                  "type": "string",
                  "enum": ["basic", "intermediate", "advanced"]
                }
              },
              "additionalProperties": true
            }
          },
          "required": ["type", "description"],
          "additionalProperties": false
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "requiresFollowUp": {
            "type": "boolean"
          },
          "estimatedResolutionTime": {
            "type": "string"
          },
          "affectedSystems": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "commonIssue": {
            "type": "boolean"
          },
          "solutionArticleId": {
            "type": "string"
          }
        },
        "required": ["requiresFollowUp"],
        "additionalProperties": true
      },
      "escalation": {
        "type": "object",
        "properties": {
          "required": {
            "type": "boolean"
          },
          "to": {
            "type": "string",
            "enum": ["tech_support", "maintenance"]
          },
          "reason": {
            "type": "string"
          },
          "contactMethod": {
            "type": "string"
          }
        },
        "required": ["required"],
        "additionalProperties": false
      }
    },
    "required": ["response", "category", "priority", "actions", "metadata", "escalation"],
    "additionalProperties": false
  }
}
```

## Booking & Access Assistant Schema

```json
{
  "name": "booking_access_response",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "response": {
        "type": "string",
        "description": "Friendly, helpful message about the booking/access request"
      },
      "category": {
        "type": "string",
        "enum": ["confirmation", "information", "solution", "error"],
        "description": "Type of response"
      },
      "priority": {
        "type": "string",
        "enum": ["low", "medium", "high"],
        "description": "Urgency level"
      },
      "actions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["user_action", "system_action"]
            },
            "description": {
              "type": "string"
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          },
          "required": ["type", "description"],
          "additionalProperties": false
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "requiresFollowUp": {
            "type": "boolean"
          },
          "bookingDetails": {
            "type": "object",
            "properties": {
              "date": {
                "type": "string"
              },
              "time": {
                "type": "string"
              },
              "bay": {
                "type": "string"
              },
              "duration": {
                "type": "string"
              }
            },
            "additionalProperties": true
          },
          "policies": {
            "type": "object",
            "properties": {
              "cancellation": {
                "type": "string"
              },
              "refund": {
                "type": "string"
              }
            },
            "additionalProperties": true
          }
        },
        "required": ["requiresFollowUp"],
        "additionalProperties": true
      },
      "escalation": {
        "type": "object",
        "properties": {
          "required": {
            "type": "boolean"
          },
          "to": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          },
          "contactMethod": {
            "type": "string"
          }
        },
        "required": ["required"],
        "additionalProperties": false
      }
    },
    "required": ["response", "category", "priority", "actions", "metadata", "escalation"],
    "additionalProperties": false
  }
}
```

## Brand & Marketing Assistant Schema

```json
{
  "name": "brand_marketing_response",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "response": {
        "type": "string",
        "description": "Engaging, brand-aligned message"
      },
      "category": {
        "type": "string",
        "enum": ["information", "promotion", "confirmation"],
        "description": "Type of response"
      },
      "priority": {
        "type": "string",
        "enum": ["low"],
        "description": "Usually low priority for marketing"
      },
      "actions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "enum": ["user_action", "system_action"]
            },
            "description": {
              "type": "string"
            },
            "details": {
              "type": "object",
              "additionalProperties": true
            }
          },
          "required": ["type", "description"],
          "additionalProperties": false
        }
      },
      "metadata": {
        "type": "object",
        "properties": {
          "requiresFollowUp": {
            "type": "boolean"
          },
          "topicCategory": {
            "type": "string",
            "enum": ["membership", "pricing", "facilities", "events", "general"]
          },
          "relevantOffers": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "additionalResources": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": ["requiresFollowUp", "topicCategory"],
        "additionalProperties": true
      },
      "escalation": {
        "type": "object",
        "properties": {
          "required": {
            "type": "boolean"
          },
          "to": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          },
          "contactMethod": {
            "type": "string"
          }
        },
        "required": ["required"],
        "additionalProperties": false
      }
    },
    "required": ["response", "category", "priority", "actions", "metadata", "escalation"],
    "additionalProperties": false
  }
}
```
