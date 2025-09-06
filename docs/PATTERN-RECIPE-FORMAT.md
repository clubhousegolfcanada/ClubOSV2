# Pattern Recipe Format - Maximum Effectiveness Guide

## The 3-5-1 Rule for Perfect Patterns

### 3 Core Questions (Trigger Examples)
Always include exactly 3-5 trigger examples covering:
1. **Formal version**: "What are your operating hours?"
2. **Casual version**: "when r u open"  
3. **Action version**: "I need to book for tonight"
4. **Context version**: "Are you open on Sundays?"
5. **Problem version**: "The website doesn't show hours"

### 5 Key Elements (Response Template)
Every response should have:
1. **Direct answer** first (no fluff)
2. **Specific details** (times, prices, links)
3. **Next action** (what customer should do)
4. **Alternative option** (if applicable)
5. **Contact method** (for follow-up)

### 1 Clear Intent (Pattern Type)
Pick ONE primary intent - don't mix multiple purposes.

## Optimal Pattern Formats by Type

### PRICING Pattern Recipe
```yaml
Triggers:
- "how much" | "what price" | "cost"
- Include: hourly, daily, membership
- Avoid: generic "pricing" alone

Response Format:
$XX/hour for [type]
$XX/hour for [type]
[Special rates if applicable]
Book: [link] or call [number]

Confidence: Start at 75%
Auto-execute: Yes (factual info)
```

### HOURS Pattern Recipe
```yaml
Triggers:
- "when open" | "what time" | "hours today"
- Include: specific days, "right now"
- Must have: "are you open"

Response Format:
[Day range]: [time-time]
[Day range]: [time-time]
[Special hours note]
Currently: [open/closed until X]

Confidence: Start at 80%
Auto-execute: Yes (factual info)
```

### TECHNICAL ISSUE Pattern Recipe
```yaml
Triggers:
- "[equipment] not working" | "broken" | "frozen"
- Include specific equipment names
- Include symptom descriptions

Response Format:
I'll help fix that right away.
Quick fix: [simple solution]
If that doesn't work, [I'll remote reset / call us]
Bay number: ?

Confidence: Start at 60%
Auto-execute: No (needs context)
```

### BOOKING Pattern Recipe
```yaml
Triggers:
- "book" | "reserve" | "availability"
- Include: today, tonight, weekend
- Include: group, party, event

Response Format:
Book online: [link]
Call: [number]
[Walk-in policy]
[Busy times warning if applicable]

Confidence: Start at 70%
Auto-execute: No (send link only)
```

## Power Tips for Maximum Effectiveness

### 1. Front-Load Information
❌ "Thanks for asking! We'd love to help you. Our hours are..."
✅ "Open 10am-10pm today. Book at [link]"

### 2. Use Natural Variations
❌ All triggers starting with "What"
✅ Mix: questions, statements, problems, actions

### 3. Include Misspellings
Add common typos as triggers:
- "bokking" → booking
- "membrship" → membership  
- "trackman" → TrackMan

### 4. Response Variables That Matter
Only use variables that add value:
- ✅ {{customer_name}} - for greetings
- ✅ {{location}} - for multi-location info
- ❌ {{current_time}} - unless time-sensitive
- ❌ {{bay_number}} - unless troubleshooting

### 5. Keywords That Trigger
Best keywords are 3-6 characters and unique:
- ✅ "hours", "price", "book"
- ❌ "the", "what", "how"

## The 80/20 Rule for Patterns

**80% of effectiveness comes from:**
- Clear, specific trigger examples (not generic)
- Direct answer in first sentence
- One clear next action

**The other 20%:**
- Perfect grammar
- Brand voice
- Additional context

## Pattern Testing Checklist

Before saving, verify:
- [ ] Would match 3+ different phrasings
- [ ] Answer is in first 10 words
- [ ] Includes actionable next step
- [ ] No assumptions about context
- [ ] Works for both locations (if applicable)

## Common Mistakes to Avoid

### ❌ Too Broad
```
Trigger: "help"
Response: "How can I help you?"
```

### ✅ Specific and Actionable
```
Trigger: "need help booking"
Response: "Book at skedda.com/clubhouse or call (603) 555-0100"
```

### ❌ Too Many Concepts
```
Pattern handles: booking + pricing + hours
```

### ✅ Single Purpose
```
Pattern handles: booking only
```

### ❌ Assuming Context
```
Response: "Your bay will be reset"
```

### ✅ Gathering Context
```
Response: "I'll reset your bay. What bay number?"
```

## Quick Pattern Starters

Copy and modify these:

### Information Pattern
```
Triggers: [specific question] + [casual version] + [action version]
Response: [answer]. [details]. [action/link].
```

### Problem Pattern
```
Triggers: [problem description] + [symptom] + ["not working"]
Response: I'll help. Try [solution]. If not, [escalation].
```

### Action Pattern
```
Triggers: ["how to X"] + ["need to X"] + ["want to X"]
Response: [Method 1]: [details]. Or [Method 2]: [details].
```

## Effectiveness Metrics

A pattern is effective when:
- **Matches 90%+** of intended messages
- **Confidence grows** over time (not decreases)
- **Operators rarely modify** the suggested response
- **No escalations** from auto-executed responses

## Remember: Simple Wins

The best patterns are boring:
- Predictable triggers
- Straightforward responses  
- Clear next actions
- No creativity needed

Save creativity for human conversations. Let patterns handle the repetitive stuff perfectly.