# V3-PLS Pattern Creation Guide

## Overview
The V3-PLS (Pattern Learning System) allows operators to create high-quality response patterns that automatically handle customer inquiries. Patterns can be created manually or learned automatically from operator responses.

## Manual Pattern Creation

### When to Create Patterns Manually
- **Common questions** that come up repeatedly (pricing, hours, booking info)
- **Standard procedures** that have consistent responses
- **Policy information** that needs exact wording
- **Promotional content** that should be consistent across all responses

### How to Create a Pattern

1. **Navigate to Operations → V3-PLS**
2. **Click "Add Pattern" button** in the top right
3. **Fill out the pattern form:**

#### Pattern Type
Select the category that best matches your pattern:
- `FAQ` - General frequently asked questions
- `Pricing` - Cost and rate information
- `Hours` - Operating hours and schedule
- `Booking` - Reservation and booking help
- `Tech Issue` - Technical support responses
- `Membership` - Membership information
- `Access` - Door/entry issues
- `Gift Cards` - Gift card inquiries
- `General` - Other inquiries

#### Trigger Examples (CRITICAL)
Provide multiple ways customers might ask the same question:
```
Example for pricing pattern:
- "How much does it cost?"
- "What are your prices?"
- "What's the hourly rate?"
- "How much for an hour?"
- "What are your membership options?"
```

**Best Practices:**
- Include at least 3-5 variations
- Cover formal and casual phrasings
- Include common misspellings
- Think about how different customers phrase things

#### Response Template
Write the response that should be sent:
```
Our simulator rates are:
- Walk-in: $60/hour
- Members: $45/hour
- Late night (after 9pm): $40/hour

You can book online at {{booking_link}} or call us at (603) 555-0100.
```

**Available Variables:**
- `{{customer_name}}` - Customer's first name
- `{{location}}` - Current location (Bedford/Dartmouth)
- `{{bay_number}}` - Bay number if applicable
- `{{current_time}}` - Current time
- `{{booking_link}}` - Link to Skedda booking

#### Confidence Score
Set the initial confidence (0-100%):
- **0-40%**: Pattern will be queued for review
- **40-70%**: Pattern will be suggested to operators
- **70-85%**: Pattern will be suggested with high confidence
- **85-100%**: Pattern can auto-execute (if enabled)

Start with lower confidence for new patterns and let the system learn.

#### Auto-Execute Toggle
- **OFF (Recommended)**: Pattern will only suggest responses
- **ON**: Pattern will automatically send responses when confidence is high

⚠️ **WARNING**: Only enable auto-execute for:
- Simple, factual information (hours, pricing)
- Non-sensitive topics
- Responses that don't require context

### Testing Your Pattern

Before saving, use the **Test Pattern** feature:
1. Enter a sample customer message
2. Click "Test" to see if your pattern would match
3. Check the confidence score and response
4. Adjust trigger examples if needed

## Pattern Quality Guidelines

### DO ✅
- **Keep responses concise** - 2-3 sentences max
- **Use friendly, professional tone** - Match Clubhouse brand
- **Include actionable next steps** - Links, phone numbers, instructions
- **Test with real messages** - Use actual customer questions
- **Start with low confidence** - Let the system learn and improve

### DON'T ❌
- **Over-automate sensitive topics** - Complaints, refunds, medical issues
- **Use complex conditional logic** - Keep patterns simple
- **Forget to test** - Always validate before saving
- **Duplicate existing patterns** - Check if similar pattern exists
- **Enable auto-execute immediately** - Test in suggestion mode first

## GPT-4o Integration

All patterns benefit from GPT-4o adaptation:
1. **Tone Matching** - Adapts formality to match customer
2. **Context Awareness** - Includes relevant details
3. **Brand Consistency** - Maintains Clubhouse voice
4. **Natural Language** - Makes responses conversational

The system preserves exact information (prices, URLs, policies) while making responses feel natural and personalized.

## Safety Controls

The system includes multiple safety layers:

### Blacklisted Topics (Never Auto-Respond)
- Legal issues, lawsuits, lawyers
- Medical emergencies, injuries
- Refunds, compensation claims
- Harassment, discrimination

### Escalation Keywords (Alert Operators)
- Angry, furious, unacceptable
- Manager, complaint
- Emergency, urgent
- Lawsuit, attorney

### Pattern Approval
New patterns require 10 successful uses before auto-executing.

## Monitoring Pattern Performance

Track pattern effectiveness in the V3-PLS dashboard:
- **Execution Count** - How often the pattern is used
- **Success Rate** - Percentage of positive outcomes
- **Confidence Trend** - How confidence changes over time
- **Last Used** - Recent activity

## Best Practices Summary

1. **Start Simple** - Create patterns for the most common questions first
2. **Use Real Examples** - Base patterns on actual customer messages
3. **Test Thoroughly** - Validate patterns match intended messages
4. **Monitor Performance** - Check success rates and adjust
5. **Iterate and Improve** - Edit patterns based on feedback
6. **Maintain Safety** - Never auto-execute sensitive topics

## Common Pattern Templates

### Hours Pattern
```
Trigger Examples:
- "What are your hours?"
- "When are you open?"
- "Are you open now?"
- "What time do you close?"

Response:
We're open 7 days a week:
Mon-Thu: 10am-10pm
Fri-Sat: 10am-11pm
Sunday: 12pm-8pm

Late night rates available after 9pm!
```

### Booking Pattern
```
Trigger Examples:
- "How do I book a bay?"
- "Can I make a reservation?"
- "Do you take walk-ins?"

Response:
You can book online at {{booking_link}} or call us at (603) 555-0100. 
We recommend booking in advance, especially for weekends. 
Walk-ins are welcome based on availability!
```

### Technical Issue Pattern
```
Trigger Examples:
- "The simulator isn't working"
- "Screen is frozen"
- "Can't start my session"

Response:
I'm sorry you're having trouble! I'll help you right away.
Please try pressing the power button on the control panel to restart.
If that doesn't work, I can remotely reset your bay. 
What bay number are you in?
```

## Questions?
Contact the admin team for help with pattern creation or if you notice patterns behaving unexpectedly.