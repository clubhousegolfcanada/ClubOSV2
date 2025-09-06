# V3-PLS Automation Cards Implementation
*Exactly like existing AI Automations UI*

## 🎯 Goal
Transform learned patterns into toggleable automation cards that operators can control individually.

## 📐 Implementation Details

### 1. Database Structure for Automation Cards

Each pattern in `decision_patterns` table becomes an automation card:

```sql
-- Already exists, just need to use these fields properly
ALTER TABLE decision_patterns 
ADD COLUMN IF NOT EXISTS automation_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS automation_description TEXT,
ADD COLUMN IF NOT EXISTS automation_icon VARCHAR(50) DEFAULT '💬',
ADD COLUMN IF NOT EXISTS automation_category VARCHAR(50) DEFAULT 'customer_service';

-- Example: Update existing patterns to have card info
UPDATE decision_patterns 
SET 
  automation_name = 'Gift Card Inquiries',
  automation_description = 'Automatically respond to gift card purchase questions with link to purchase page',
  automation_icon = '🎁',
  automation_category = 'customer_service'
WHERE pattern_type = 'gift_cards';
```

### 2. Frontend: Automation Cards Component

Replace the complex V3-PLS tabs with clean automation cards:

```typescript
// File: /ClubOSV1-frontend/src/components/operations/patterns/PatternAutomationCards.tsx

import React, { useState, useEffect } from 'react';
import { Settings, Zap, Brain, TrendingUp, Clock, Check, X, Edit2 } from 'lucide-react';
import apiClient from '@/api/http';

interface PatternAutomation {
  id: number;
  automation_name: string;
  automation_description: string;
  automation_icon: string;
  automation_category: string;
  is_active: boolean;
  confidence_score: number;
  execution_count: number;
  success_count: number;
  last_used?: string;
  trigger_text: string;
  response_template: string;
}

export const PatternAutomationCards: React.FC = () => {
  const [automations, setAutomations] = useState<PatternAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [editedResponse, setEditedResponse] = useState('');

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    try {
      const response = await apiClient.get('/patterns');
      const patterns = response.data.patterns || response.data;
      
      // Group and format patterns as automations
      const formattedAutomations = patterns.map(formatPatternAsAutomation);
      setAutomations(formattedAutomations);
    } catch (error) {
      console.error('Failed to fetch automations:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPatternAsAutomation = (pattern: any): PatternAutomation => {
    // Auto-generate name if not set
    const name = pattern.automation_name || generateAutomationName(pattern);
    const description = pattern.automation_description || generateDescription(pattern);
    
    return {
      ...pattern,
      automation_name: name,
      automation_description: description,
      automation_icon: pattern.automation_icon || getIconForType(pattern.pattern_type),
      automation_category: pattern.automation_category || getCategoryForType(pattern.pattern_type)
    };
  };

  const generateAutomationName = (pattern: any): string => {
    const typeNames: Record<string, string> = {
      'gift_cards': 'Gift Card Inquiries',
      'hours': 'Hours & Location Info',
      'booking': 'Booking Assistance',
      'tech_issue': 'Technical Support',
      'membership': 'Membership Questions',
      'pricing': 'Pricing Information',
      'general': 'General Inquiries'
    };
    
    return typeNames[pattern.pattern_type] || 
           pattern.trigger_text.substring(0, 30) + '...';
  };

  const generateDescription = (pattern: any): string => {
    return `Automatically respond when customers ask: "${pattern.trigger_text.substring(0, 60)}..."`;
  };

  const getIconForType = (type: string): string => {
    const icons: Record<string, string> = {
      'gift_cards': '🎁',
      'hours': '🕐',
      'booking': '📅',
      'tech_issue': '🔧',
      'membership': '💳',
      'pricing': '💰',
      'general': '💬'
    };
    return icons[type] || '💬';
  };

  const getCategoryForType = (type: string): string => {
    const categories: Record<string, string> = {
      'gift_cards': 'customer_service',
      'hours': 'customer_service',
      'booking': 'customer_service',
      'tech_issue': 'technical',
      'membership': 'customer_service',
      'pricing': 'customer_service',
      'general': 'customer_service'
    };
    return categories[type] || 'customer_service';
  };

  const toggleAutomation = async (id: number, currentState: boolean) => {
    try {
      await apiClient.patch(`/patterns/${id}`, {
        is_active: !currentState
      });
      
      // Update local state
      setAutomations(prev => prev.map(a => 
        a.id === id ? { ...a, is_active: !currentState } : a
      ));
    } catch (error) {
      console.error('Failed to toggle automation:', error);
    }
  };

  const saveEditedResponse = async (id: number) => {
    try {
      await apiClient.patch(`/patterns/${id}`, {
        response_template: editedResponse
      });
      
      // Update local state
      setAutomations(prev => prev.map(a => 
        a.id === id ? { ...a, response_template: editedResponse } : a
      ));
      
      setEditingCard(null);
      setEditedResponse('');
    } catch (error) {
      console.error('Failed to save response:', error);
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.85) return 'text-green-600 bg-green-50';
    if (confidence >= 0.70) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getSuccessRate = (automation: PatternAutomation): number => {
    if (automation.execution_count === 0) return 0;
    return Math.round((automation.success_count / automation.execution_count) * 100);
  };

  // Group automations by category
  const groupedAutomations = automations.reduce((acc, automation) => {
    const category = automation.automation_category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(automation);
    return acc;
  }, {} as Record<string, PatternAutomation[]>);

  const categoryTitles: Record<string, string> = {
    'customer_service': 'Customer Service',
    'technical': 'Technical Support',
    'booking': 'Booking & Reservations',
    'other': 'Other Automations'
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading automations...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Zap className="h-5 w-5" />
          AI Automations
          <span className="text-sm text-gray-500 font-normal">
            ({automations.filter(a => a.is_active).length}/{automations.length} active)
          </span>
        </h2>
        
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Brain className="h-4 w-4" />
            {automations.length} learned patterns
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            {automations.reduce((sum, a) => sum + a.execution_count, 0)} total uses
          </span>
        </div>
      </div>

      {/* Automation cards by category */}
      {Object.entries(groupedAutomations).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            {categoryTitles[category] || category}
          </h3>
          
          <div className="space-y-3">
            {items.map(automation => (
              <div
                key={automation.id}
                className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Title and status */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{automation.automation_icon}</span>
                      <h4 className="font-medium text-gray-900">
                        {automation.automation_name}
                      </h4>
                      {automation.confidence_score >= 0.85 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          RECOMMENDED
                        </span>
                      )}
                      {automation.is_active && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    
                    {/* Description */}
                    <p className="text-sm text-gray-600 mb-3">
                      {automation.automation_description}
                    </p>
                    
                    {/* Stats when active */}
                    {automation.is_active && automation.execution_count > 0 && (
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>✨ Used {automation.execution_count} times</span>
                        <span>📊 {getSuccessRate(automation)}% success rate</span>
                        {automation.last_used && (
                          <span>🕐 Last used {new Date(automation.last_used).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Confidence indicator */}
                    <div className="mt-2">
                      <span className={`text-xs px-2 py-1 rounded ${getConfidenceColor(automation.confidence_score)}`}>
                        {Math.round(automation.confidence_score * 100)}% confidence
                      </span>
                    </div>
                    
                    {/* Expanded details */}
                    {expandedCard === automation.id && (
                      <div className="mt-4 p-3 bg-gray-50 rounded">
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            When customer says:
                          </p>
                          <p className="text-sm text-gray-700 italic">
                            "{automation.trigger_text}"
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            AI responds with:
                          </p>
                          {editingCard === automation.id ? (
                            <div className="space-y-2">
                              <textarea
                                className="w-full p-2 text-sm border rounded"
                                rows={4}
                                value={editedResponse}
                                onChange={(e) => setEditedResponse(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveEditedResponse(automation.id)}
                                  className="px-3 py-1 bg-green-600 text-white rounded text-xs"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingCard(null);
                                    setEditedResponse('');
                                  }}
                                  className="px-3 py-1 bg-gray-600 text-white rounded text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                {automation.response_template}
                              </p>
                              <button
                                onClick={() => {
                                  setEditingCard(automation.id);
                                  setEditedResponse(automation.response_template);
                                }}
                                className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                              >
                                Edit Response
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Controls */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setExpandedCard(
                        expandedCard === automation.id ? null : automation.id
                      )}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => toggleAutomation(automation.id, automation.is_active)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        automation.is_active ? 'bg-green-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          automation.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {automations.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Brain className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>No patterns learned yet.</p>
          <p className="text-sm mt-1">
            Patterns will appear here as the system learns from operator responses.
          </p>
        </div>
      )}
    </div>
  );
};
```

### 3. Update V3-PLS Page to Use Cards

Replace the complex tabs with the clean automation cards:

```typescript
// File: /ClubOSV1-frontend/src/components/operations/patterns/OperationsPatternsEnhanced.tsx

import { PatternAutomationCards } from './PatternAutomationCards';

export const OperationsPatternsEnhanced: React.FC = () => {
  const [activeView, setActiveView] = useState<'automations' | 'overview'>('automations');
  
  return (
    <div>
      {/* Simple toggle between automations and stats */}
      <div className="flex space-x-1 mb-6">
        <button
          onClick={() => setActiveView('automations')}
          className={`px-4 py-2 rounded ${
            activeView === 'automations' 
              ? 'bg-primary text-white' 
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Automations
        </button>
        <button
          onClick={() => setActiveView('overview')}
          className={`px-4 py-2 rounded ${
            activeView === 'overview' 
              ? 'bg-primary text-white' 
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          Statistics
        </button>
      </div>
      
      {activeView === 'automations' ? (
        <PatternAutomationCards />
      ) : (
        <PatternStatistics />
      )}
    </div>
  );
};
```

### 4. Backend: Update Pattern Creation to Include Card Info

When learning from operator responses, auto-generate card information:

```typescript
// File: /ClubOSV1-backend/src/services/patternLearningService.ts

async function createPatternFromOperatorResponse(
  customerMessage: string,
  operatorResponse: string
) {
  // Use GPT-4o to analyze and categorize
  const analysis = await analyzeWithGPT4o(customerMessage, operatorResponse);
  
  // Create pattern with automation card info
  const pattern = await db.query(`
    INSERT INTO decision_patterns (
      pattern_type,
      trigger_text,
      response_template,
      trigger_keywords,
      confidence_score,
      is_active,
      auto_executable,
      automation_name,
      automation_description,
      automation_icon,
      automation_category
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    analysis.type,
    customerMessage,
    operatorResponse,
    analysis.keywords,
    0.60, // Start at 60% confidence
    false, // Start disabled - operator can enable
    false, // Not auto-executable until high confidence
    analysis.automationName, // e.g., "Gift Card Inquiries"
    analysis.automationDescription, // e.g., "Respond to gift card questions"
    analysis.icon, // e.g., "🎁"
    analysis.category // e.g., "customer_service"
  ]);
  
  return pattern.rows[0];
}
```

## 🎮 How Operators Use It

### 1. System Learns Automatically
- Customer asks about gift cards
- Operator responds with URL
- Pattern created (initially OFF)

### 2. Operator Reviews in V3-PLS
- Sees new "Gift Card Inquiries" card
- Reviews the response template
- Toggles it ON if looks good

### 3. Pattern Now Active
- Next gift card question → AI suggests response
- Operator can accept/modify/reject
- Confidence increases with use

### 4. Full Control
- Turn any automation ON/OFF anytime
- Edit response templates
- View statistics
- Delete problematic patterns

## 🎯 Key Features

1. **Visual Control** - Each pattern is a toggleable card
2. **Categories** - Grouped by type (customer service, technical, etc.)
3. **Confidence Indicators** - See how reliable each pattern is
4. **Usage Stats** - Track how often each is used
5. **Edit Capability** - Modify responses without coding
6. **Safe Defaults** - New patterns start OFF until reviewed

## Summary

Yes, we're implementing the AI Automation style cards! Each learned pattern appears as a beautiful card in the V3-PLS page that you can:
- Toggle ON/OFF with a switch
- Edit the response template
- View usage statistics
- See confidence levels

This gives you full control while maintaining automatic learning. The system learns from operators but nothing goes live until you review and enable it.

---
*Exactly like your existing AI Automations, but for learned patterns.*