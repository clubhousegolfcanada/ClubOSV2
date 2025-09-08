# Dynamic Checklists - Minimal Implementation Plan

## Core Goal
Move checklist templates from hardcoded constants to database so different locations can have different tasks. That's it.

## What We're NOT Doing
- ❌ GPS tracking (UniFi door logs already tell us who's there)
- ❌ Billing/invoicing systems
- ❌ Complex contractor management
- ❌ Time tracking (already have submission timestamps)
- ❌ Offline mode
- ❌ Voice notes
- ❌ Complex scheduling systems
- ❌ SLA monitoring
- ❌ Any "nice to have" features

## Simple Database Changes

### Just 3 New Tables

```sql
-- 1. Move templates to database
CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'cleaning' or 'tech'
  type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'quarterly'
  location VARCHAR(255), -- NULL = all locations
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Move tasks to database
CREATE TABLE checklist_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE,
  task_text VARCHAR(500) NOT NULL,
  position INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Track which company cleans which location (optional)
CREATE TABLE location_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location VARCHAR(255) NOT NULL,
  company_name VARCHAR(255), -- Just a text field, not a foreign key
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Minimal Code Changes

### Backend (checklists.ts)

```typescript
// Replace CHECKLIST_TEMPLATES constant with:
router.get('/template/:category/:type', async (req, res) => {
  const { category, type } = req.params;
  const { location } = req.query;
  
  // Try location-specific first, then fall back to global
  let template = await db.query(`
    SELECT * FROM checklist_templates 
    WHERE category = $1 AND type = $2 AND location = $3 AND active = true
  `, [category, type, location]);
  
  if (!template.rows[0]) {
    template = await db.query(`
      SELECT * FROM checklist_templates 
      WHERE category = $1 AND type = $2 AND location IS NULL AND active = true
    `, [category, type]);
  }
  
  const tasks = await db.query(`
    SELECT * FROM checklist_tasks 
    WHERE template_id = $1 
    ORDER BY position
  `, [template.rows[0].id]);
  
  res.json({ 
    template: template.rows[0], 
    tasks: tasks.rows 
  });
});

// Add endpoint to manage templates (admin only)
router.post('/template', roleGuard(['admin']), async (req, res) => {
  // Simple CRUD for templates
});

router.post('/template/:id/task', roleGuard(['admin']), async (req, res) => {
  // Add/remove/reorder tasks
});
```

### Frontend Changes

Almost nothing! The existing UI works fine, just add:

1. **Admin Template Manager** (new page):
   - List all templates
   - Clone template for different location
   - Add/remove/reorder tasks
   - No fancy drag-drop needed, just up/down arrows

2. **Update QR Code** to include template ID:
```typescript
// Small change to QR generation
const checklistUrl = `${window.location.origin}/checklists?templateId=${templateId}&location=${location}`;
```

## Migration Steps

### Step 1: Migrate Current Templates (1 day)
```sql
-- Insert current hardcoded templates as "global" (location = NULL)
INSERT INTO checklist_templates (name, category, type, location) VALUES
  ('Daily Cleaning', 'cleaning', 'daily', NULL),
  ('Weekly Cleaning', 'cleaning', 'weekly', NULL),
  ('Quarterly Cleaning', 'cleaning', 'quarterly', NULL),
  ('Weekly Tech', 'tech', 'weekly', NULL),
  ('Quarterly Tech', 'tech', 'quarterly', NULL);

-- Then insert all the tasks from CHECKLIST_TEMPLATES constant
```

### Step 2: Simple Admin UI (2-3 days)
- Page at `/operations/templates`
- Table showing all templates
- "Clone for Location" button
- Basic task add/edit/delete/reorder
- No complex UI needed

### Step 3: Update Backend (1 day)
- Replace hardcoded constant with database queries
- Add caching if needed for performance
- Keep existing submission logic exactly the same

### Step 4: Test & Deploy (1 day)
- Test with one location first
- Roll out gradually

## What This Gives You

✅ **Different checklists per location** - Main goal achieved  
✅ **Easy template management** - Clone and modify per location  
✅ **Backward compatible** - Existing submissions unchanged  
✅ **Simple to implement** - ~1 week of work  
✅ **No complexity** - Just moves data from code to database  

## What Stays The Same

- Authentication/permissions (unchanged)
- Submission process (unchanged)
- Tracking/reporting (unchanged)
- UI/UX (99% unchanged)
- QR codes (minor update)

## Example Use Cases

1. **Bedford needs extra bathroom task**:
   - Clone global template for Bedford
   - Add "Check bay 3 bathroom supplies"
   - Done

2. **New location Truro**:
   - Uses global templates by default
   - Customize if needed later

3. **Contractor for Dartmouth**:
   - Create operator account
   - They see Dartmouth templates
   - Submit like normal

## Total Implementation Time: 1 Week

- Day 1: Database tables & migration
- Day 2-3: Admin template manager
- Day 4: Backend updates
- Day 5: Testing & deployment

## No Feature Creep

This plan does ONLY what's needed:
- Templates in database instead of code
- Location-specific variations
- Simple management UI

Everything else stays exactly as is. The system already tracks who did what and when. UniFi tells you they were there. The existing reporting shows completion rates. 

**If it's not broken, we're not fixing it.**