# Testing Knowledge Toggle Feature

## What's New
The dashboard now has a 4-way toggle with a new **Knowledge** mode (📚) that lets you add knowledge directly from the main input field.

## Visual Guide
The toggle now has 4 positions:
1. **Human (•)** - Sends to Slack only
2. **AI** - Smart Assist mode 
3. **🎫** - Create Ticket mode
4. **📚** - Knowledge mode (NEW)

## How to Test

### Step 1: Access the Dashboard
1. Go to https://clubos-frontend.vercel.app (production) or http://localhost:3000 (local)
2. Log in with your admin credentials
3. You'll see the main dashboard with the request input field

### Step 2: Switch to Knowledge Mode
1. Look at the toggle slider above the input field
2. Click the **📚** button (4th position) 
3. The slider should move to the right-most position
4. The placeholder text should change to: "Add knowledge: e.g., 'Gift cards are available at website.com/giftcards for $25, $50, or $100'"

### Step 3: Add Knowledge
Try these test examples:

#### Example 1: Gift Cards
```
Gift cards can be purchased at clubhouse247golf.com/giftcards for $25, $50, or $100
```

#### Example 2: Business Hours
```
We are open Monday to Friday 8am-10pm, weekends 9am-11pm
```

#### Example 3: Technical Support
```
To reset the TrackMan simulator, hold the power button for 10 seconds then wait 30 seconds before turning back on
```

#### Example 4: Emergency Procedure
```
In case of fire, evacuate through the nearest exit and meet at the parking lot assembly point
```

### Step 4: Submit Knowledge
1. Click "Add Knowledge" button
2. You should see "Adding Knowledge..." while processing
3. Once complete, you'll see a success message showing:
   - Category detected (pricing, hours, tech, emergency, etc.)
   - Target assistant (brand, tech, emergency, booking)
   - Intent (add, update, overwrite)
   - The value that was stored

### Step 5: Verify Knowledge Works
1. Switch back to **AI** mode (2nd position)
2. Ask a question related to what you just added:
   - "How do I buy a gift card?"
   - "What are your hours?"
   - "How do I reset TrackMan?"
3. The AI should respond using the knowledge you added

## Database Verification (For Developers)

### Check Knowledge Was Stored
```sql
-- Check knowledge_audit_log (most recent entries)
SELECT * FROM knowledge_audit_log 
ORDER BY created_at DESC 
LIMIT 5;

-- Check assistant_knowledge 
SELECT * FROM assistant_knowledge 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;

-- Check knowledge_store (if using this table)
SELECT * FROM knowledge_store 
ORDER BY created_at DESC 
LIMIT 5;
```

### Verify LLM Uses Knowledge
Check the logs when making a request - you should see:
```
Unified knowledge search
Found in assistant_knowledge
```

## Troubleshooting

### If Knowledge Mode Doesn't Appear
1. Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)
2. Clear browser cache
3. Make sure you're logged in as Admin

### If Knowledge Submission Fails
1. Check you have admin role
2. Ensure OPENAI_API_KEY is set (needed for GPT-4o parsing)
3. Check backend logs for errors
4. Try simpler knowledge format

### If AI Doesn't Use the Knowledge
1. Wait 30 seconds for caching to update
2. Make sure your question matches the knowledge closely
3. Check confidence threshold (default 0.5)
4. Verify knowledge is in correct assistant category

## Success Criteria
✅ Toggle shows 4 positions
✅ Can switch to Knowledge mode
✅ Placeholder text updates
✅ Can submit knowledge
✅ Success message shows parsed details
✅ Knowledge stored in database
✅ AI uses knowledge when answering

## Notes
- Knowledge is parsed by GPT-4o to extract structure
- Automatically determines category and target assistant
- Works with existing knowledge retrieval system
- No changes to existing Smart Assist, Ticket, or Slack modes
- All existing functionality preserved