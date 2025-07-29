# Knowledge Replacement Confirmation Flow Implementation Plan

## Overview
Implement a confirmation flow for knowledge updates where replacements require user approval before being applied.

## Current State
- GPT-4o parses intent: "add" (new), "update" (modify), "overwrite" (replace all)
- All updates go directly to database without confirmation
- Assistant API updates are failing (not configured)

## Proposed Flow

### 1. For NEW Knowledge (intent: "add")
- Goes directly to database
- Shows success message
- No confirmation needed

### 2. For UPDATES/REPLACEMENTS (intent: "update" or "overwrite")
- Parse the input
- Check if similar knowledge exists
- Show comparison UI:
  ```
  Current: "Clubhouse Grey is #123456"
  Proposed: "Clubhouse Grey is #503285"
  [Cancel] [Replace]
  ```
- On confirmation, update database

## Implementation Steps

### Step 1: Modify Backend Response
```typescript
// In knowledge-router.ts
if (parsedUpdate.intent === 'update' || parsedUpdate.intent === 'overwrite') {
  // Search for existing knowledge
  const existing = await knowledgeSearchService.searchKnowledge(
    parsedUpdate.key || parsedUpdate.value,
    parsedUpdate.category
  );
  
  if (existing.found) {
    return res.json({
      success: true,
      requiresConfirmation: true,
      data: {
        parsed: parsedUpdate,
        existing: existing.data,
        message: 'Confirmation required for replacement'
      }
    });
  }
}
```

### Step 2: Create Confirmation UI Component
```tsx
// KnowledgeConfirmationDialog.tsx
interface Props {
  existing: any;
  proposed: any;
  onConfirm: () => void;
  onCancel: () => void;
}

export const KnowledgeConfirmationDialog = ({ existing, proposed, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-[var(--bg-secondary)] rounded-lg p-6 max-w-2xl">
        <h3>Confirm Knowledge Replacement</h3>
        
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <h4 className="text-red-500">Current Knowledge</h4>
            <div className="bg-red-500/10 p-3 rounded">
              {existing.answer || existing.value}
            </div>
          </div>
          
          <div>
            <h4 className="text-green-500">Proposed Knowledge</h4>
            <div className="bg-green-500/10 p-3 rounded">
              {proposed.value}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn-primary">Replace</button>
        </div>
      </div>
    </div>
  );
};
```

### Step 3: Add Confirmation Endpoint
```typescript
// New endpoint: /knowledge-router/confirm-update
protectedRouter.post('/confirm-update',
  asyncHandler(async (req, res) => {
    const { update, confirmed } = req.body;
    
    if (!confirmed) {
      return res.json({ success: false, message: 'Update cancelled' });
    }
    
    // Save to database
    await db.query(`
      INSERT INTO knowledge_audit_log 
      (action, category, key, new_value, previous_value, user_id, assistant_target)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [...]);
    
    res.json({ success: true, message: 'Knowledge replaced successfully' });
  })
);
```

### Step 4: Update Frontend Flow
```tsx
// In KnowledgeRouterPanel.tsx
const handleSubmit = async () => {
  const response = await axios.post('/parse-and-route', { input });
  
  if (response.data.requiresConfirmation) {
    setConfirmationDialog({
      show: true,
      existing: response.data.data.existing,
      proposed: response.data.data.parsed
    });
  } else {
    toast.success('Knowledge added successfully');
  }
};

const handleConfirm = async () => {
  await axios.post('/confirm-update', {
    update: confirmationDialog.proposed,
    confirmed: true
  });
  toast.success('Knowledge replaced successfully');
  setConfirmationDialog({ show: false });
};
```

## Benefits
1. **Prevents accidental overwrites** - Users see what they're replacing
2. **Better UX** - Clear visual comparison
3. **Audit trail** - Can store both old and new values
4. **Flexible** - Can add more confirmation rules later

## Future Enhancements
1. Show affected assistants/routes
2. Preview how responses will change
3. Bulk update confirmations
4. Rollback capability