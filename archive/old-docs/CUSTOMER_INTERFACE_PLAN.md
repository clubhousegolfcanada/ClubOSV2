# ClubOS Customer Interface Plan - Dashboard-Based Approach

## Overview
Create a new customer-facing interface by copying and simplifying the main dashboard's RequestForm component. This approach leverages existing, proven code while creating a streamlined experience for customers.

## Current Architecture Analysis

### 1. Existing ClubOS Boy (`/clubosboy`)
- **Simple form**: Question + Location
- **Direct to Slack**: No AI processing
- **Auto-reset**: 30-second timer
- **Endpoint**: `/api/customer/ask` (public, no auth)

### 2. Dashboard RequestForm 
- **Complex form**: Multiple modes, routes, toggles
- **AI Processing**: Smart Assist with LLM routing
- **Auth Required**: JWT token needed
- **Endpoint**: `/api/llm/request` (authenticated)

### 3. Customer Route (`/api/customer/ask`)
- **Processes with LLM**: Routes through AI despite being customer-facing
- **No auth required**: Public endpoint
- **Customer context**: Adds `isCustomerFacing: true` flag

## Proposed Solution: ClubOS Customer Portal

### Phase 1: Create New Customer Component

#### 1.1 File Structure
```
ClubOSV1-frontend/src/
├── pages/
│   └── customer.tsx          # New customer page
├── components/
│   ├── CustomerRequestForm.tsx   # Simplified RequestForm
│   └── CustomerResponse.tsx      # Customer-friendly response display
```

#### 1.2 CustomerRequestForm Component
```typescript
// Based on RequestForm but simplified:
- Remove: Route selection, Smart Assist toggle, Ticket mode
- Remove: Authentication checks
- Remove: Feedback system (customers can't auth)
- Keep: Question textarea, Location input
- Keep: Response display
- Add: Customer-friendly language
- Add: Automatic context injection
```

### Phase 2: Backend Modifications

#### 2.1 Enhanced Customer Route
```typescript
// Modify /api/customer/ask to:
1. Accept the request from customer
2. Process through LLM with customer context
3. Transform response to be customer-friendly
4. Log for analytics
```

#### 2.2 Customer Context Transformation
```typescript
// Add new service: customerContextService.ts
async function transformForCustomer(llmResponse: LLMResponse): Promise<CustomerResponse> {
  // 1. Preserve all technical details for staff
  const staffContext = {
    originalResponse: llmResponse,
    technicalDetails: llmResponse.structured,
    internalActions: llmResponse.actions
  };
  
  // 2. Create customer-friendly message
  const customerMessage = await rewriteForCustomer(llmResponse.response);
  
  // 3. Combine both
  return {
    customerDisplay: customerMessage,
    staffContext: staffContext,
    metadata: {
      transformedAt: new Date().toISOString(),
      originalRoute: llmResponse.route
    }
  };
}
```

### Phase 3: Implementation Details

#### 3.1 Customer Page (`/customer.tsx`)
```typescript
export default function CustomerPortal() {
  return (
    <main>
      <div className="customer-header">
        <h1>Welcome to ClubHouse247 Golf</h1>
        <p>How can we help you today?</p>
      </div>
      
      <CustomerRequestForm />
      
      <div className="customer-footer">
        <p>Need immediate help? Text us at (902)707-3748</p>
      </div>
    </main>
  );
}
```

#### 3.2 CustomerRequestForm (Simplified from RequestForm)
```typescript
const CustomerRequestForm = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [response, setResponse] = useState(null);
  
  const onSubmit = async (data) => {
    setIsProcessing(true);
    
    try {
      // Direct to customer endpoint
      const result = await axios.post('/api/customer/ask', {
        question: data.question,
        location: data.location,
        // Auto-inject customer context
        context: {
          interface: 'customer-portal',
          timestamp: new Date().toISOString()
        }
      });
      
      setResponse(result.data);
      setShowResponse(true);
      
      // Auto-reset after 60 seconds for customer
      setTimeout(() => {
        reset();
        setShowResponse(false);
      }, 60000);
      
    } catch (error) {
      // Customer-friendly error
      setResponse({
        message: "We're having trouble right now. Please ask our staff for help!",
        isError: true
      });
    }
    
    setIsProcessing(false);
  };
  
  return (
    <div className="customer-form-container">
      {/* Simplified form UI */}
    </div>
  );
};
```

#### 3.3 Response Transformation Pipeline
```typescript
// In customer route handler:
const processCustomerRequest = async (question: string, location: string) => {
  // 1. Process through LLM as normal
  const llmResponse = await llmService.processRequest(question, 'customer', {
    location,
    isCustomerFacing: true
  });
  
  // 2. Get assistant response
  const assistantResponse = await assistantService.getAssistantResponse(
    llmResponse.route,
    question,
    { isCustomerFacing: true }
  );
  
  // 3. Transform for customer display
  const customerResponse = await transformResponse(assistantResponse, {
    removeJargon: true,
    simplifyLanguage: true,
    addFriendlyTone: true,
    preserveActions: true  // Keep action items clear
  });
  
  // 4. Log both versions
  await logCustomerInteraction({
    customerShown: customerResponse,
    internalResponse: assistantResponse,
    route: llmResponse.route,
    confidence: llmResponse.confidence
  });
  
  return customerResponse;
};
```

### Phase 4: Customer Response Formatting

#### 4.1 Response Transformation Rules
```typescript
const customerTransformRules = {
  // Technical terms to friendly language
  replacements: {
    'TrackMan': 'the golf simulator',
    'reboot': 'restart',
    'authentication': 'sign in',
    'API': 'system',
    'database': 'our records'
  },
  
  // Add friendly prefixes
  prefixes: {
    'information': 'Here\'s what I found:',
    'action_required': 'Here\'s what you can do:',
    'error': 'I\'m having trouble with that.',
    'confirmation': 'Got it!'
  },
  
  // Simplify complex instructions
  simplifications: {
    'multi_step': 'break into numbered list',
    'technical': 'use everyday language',
    'long_text': 'summarize key points'
  }
};
```

#### 4.2 Context Preservation
```typescript
interface CustomerResponse {
  // What customer sees
  display: {
    message: string;
    actions?: string[];
    helpText?: string;
  };
  
  // What gets logged/sent to staff
  internal: {
    originalResponse: string;
    route: string;
    confidence: number;
    structured: any;
    technicalDetails: any;
  };
  
  // Metadata
  meta: {
    questionId: string;
    timestamp: string;
    location: string;
    transformApplied: boolean;
  };
}
```

### Phase 5: Routing & Access

#### 5.1 URL Structure
- `/customer` - New customer portal (no auth)
- `/clubosboy` - Keep existing kiosk interface
- `/` - Staff dashboard (requires auth)

#### 5.2 Navigation Flow
```typescript
// Auto-redirect based on context
if (isKioskMode && !isAuthenticated) {
  router.push('/customer');
} else if (requiresAuth && !isAuthenticated) {
  router.push('/login');
}
```

### Phase 6: Additional Features

#### 6.1 Analytics Tracking
```typescript
// Track customer interactions
const trackCustomerRequest = async (data: CustomerInteraction) => {
  await analytics.track({
    event: 'customer_request',
    properties: {
      route: data.route,
      location: data.location,
      responseTime: data.processingTime,
      wasHelpful: data.autoFeedback
    }
  });
};
```

#### 6.2 Multi-language Support (Future)
```typescript
// Detect and respond in customer's language
const detectLanguage = async (text: string): Promise<Language> => {
  // Use LLM to detect language
  // Respond in same language
};
```

## Implementation Timeline

### Week 1: Foundation
1. Create `/customer` page
2. Build `CustomerRequestForm` component
3. Test with existing `/api/customer/ask` endpoint

### Week 2: Enhancement
1. Add response transformation service
2. Implement customer-friendly formatting
3. Preserve technical context for staff

### Week 3: Polish
1. Add analytics tracking
2. Implement auto-reset timers
3. Test on actual kiosk hardware

### Week 4: Deployment
1. Deploy to production
2. Monitor usage patterns
3. Gather feedback

## Benefits of This Approach

1. **Code Reuse**: Leverages proven RequestForm logic
2. **Maintainability**: Single codebase for form logic
3. **Consistency**: Same LLM routing for all requests
4. **Context Preservation**: Technical details retained for staff
5. **Flexibility**: Easy to add/remove features
6. **Analytics**: Built-in tracking from day one

## Migration Path

1. **Phase 1**: Deploy new `/customer` alongside existing `/clubosboy`
2. **Phase 2**: A/B test both interfaces
3. **Phase 3**: Gradually migrate kiosks to new interface
4. **Phase 4**: Deprecate old `/clubosboy` endpoint

## Security Considerations

1. **No Auth Required**: Customer endpoints remain public
2. **Rate Limiting**: Stricter limits on customer endpoints
3. **Input Validation**: Sanitize all customer input
4. **No Sensitive Data**: Customer responses contain no internal info
5. **Logging**: Track all interactions for security audit

## Success Metrics

1. **Response Time**: < 3 seconds for AI response
2. **Clarity Score**: 90%+ customers understand response
3. **Completion Rate**: 80%+ questions answered without staff
4. **Error Rate**: < 5% technical errors
5. **Satisfaction**: Track via implicit feedback

## Next Steps

1. Review plan with team
2. Create feature branch: `feature/customer-portal`
3. Implement Phase 1 components
4. Test with sample customer queries
5. Deploy to staging for testing
