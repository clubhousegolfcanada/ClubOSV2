# Dynamic Checklists - Final Implementation Plan

## Goal
Move checklist templates from hardcoded to database AND leverage existing ClubOS systems for smarter operations.

## Phase 1: Database Migration (Day 1-2)

### New Tables
```sql
-- 1. Dynamic templates
CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'cleaning' or 'tech'
  type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'quarterly'
  location VARCHAR(255), -- NULL = all locations
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Template tasks
CREATE TABLE checklist_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE,
  task_text VARCHAR(500) NOT NULL,
  position INT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  ninjaone_script_id UUID, -- Link to NinjaOne scripts
  typical_duration_minutes INT, -- For time tracking
  common_issues TEXT, -- Historical problem notes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Enhanced submissions (modify existing table)
ALTER TABLE checklist_submissions 
ADD COLUMN template_id UUID REFERENCES checklist_templates(id),
ADD COLUMN door_entry_time TIMESTAMP, -- From UniFi
ADD COLUMN actual_duration_minutes INT, -- Calculated from UniFi
ADD COLUMN auto_verified BOOLEAN DEFAULT false; -- UniFi confirmed on-site

-- 4. Task-level tracking (new)
CREATE TABLE task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES checklist_submissions(id),
  task_id UUID REFERENCES checklist_tasks(id),
  completed_at TIMESTAMP,
  skipped BOOLEAN DEFAULT false,
  skip_reason TEXT,
  ninjaone_executed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Data Migration
```sql
-- Migrate existing templates
INSERT INTO checklist_templates (name, category, type) VALUES
  ('Daily Cleaning', 'cleaning', 'daily'),
  ('Weekly Cleaning', 'cleaning', 'weekly'),
  ('Quarterly Cleaning', 'cleaning', 'quarterly'),
  ('Weekly Tech', 'tech', 'weekly'),
  ('Quarterly Tech', 'tech', 'quarterly');

-- Insert tasks from CHECKLIST_TEMPLATES constant
-- Include NinjaOne script IDs for relevant tasks
```

## Phase 2: Backend Integration (Day 3-4)

### Core Template API
```typescript
// checklists.ts - Enhanced template loading
router.get('/template/:category/:type', async (req, res) => {
  const { category, type } = req.params;
  const { location } = req.query;
  const userId = req.user.id;
  
  // Load template (location-specific or global)
  const template = await getTemplateForLocation(category, type, location);
  
  // Get UniFi door status
  const doorStatus = await unifiService.getRecentEntry(userId, location);
  
  // Get recent issues for context
  const recentIssues = await db.query(`
    SELECT comments, supplies_needed 
    FROM checklist_submissions 
    WHERE location = $1 
    ORDER BY completion_time DESC 
    LIMIT 3
  `, [location]);
  
  // Get open tickets for awareness
  const openTickets = await db.query(`
    SELECT COUNT(*) as count, priority 
    FROM tickets 
    WHERE location = $1 AND status = 'open'
    GROUP BY priority
  `, [location]);
  
  res.json({
    template,
    context: {
      doorEntry: doorStatus.lastEntry,
      isOnSite: doorStatus.isCurrentlyOnSite,
      recentIssues: recentIssues.rows,
      openTickets: openTickets.rows,
      lastCleaned: await getLastCleaningTime(location)
    }
  });
});

// Enhanced submission with verification
router.post('/submit', async (req, res) => {
  const { templateId, location, taskCompletions, comments, supplies, photos } = req.body;
  const userId = req.user.id;
  
  // Verify with UniFi
  const doorLog = await unifiService.getEntryLog(userId, location);
  const onSiteVerified = doorLog.wasPresent;
  const entryTime = doorLog.entryTime;
  const duration = doorLog.duration;
  
  // Create submission with enhanced data
  const submission = await db.query(`
    INSERT INTO checklist_submissions 
    (template_id, user_id, location, door_entry_time, actual_duration_minutes, 
     auto_verified, comments, supplies_needed, photo_urls, ticket_created)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [templateId, userId, location, entryTime, duration, 
      onSiteVerified, comments, supplies, photos, false]);
  
  // Record task-level completions
  for (const task of taskCompletions) {
    await db.query(`
      INSERT INTO task_completions 
      (submission_id, task_id, completed_at, skipped, skip_reason, ninjaone_executed)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [submission.rows[0].id, task.id, task.completedAt, 
        task.skipped, task.skipReason, false]);
    
    // Execute NinjaOne scripts if linked
    if (task.ninjaoneScriptId && !task.skipped) {
      await ninjaOneService.executeScript(task.ninjaoneScriptId, location);
      await db.query(
        'UPDATE task_completions SET ninjaone_executed = true WHERE submission_id = $1 AND task_id = $2',
        [submission.rows[0].id, task.id]
      );
    }
  }
  
  // Auto-create ticket if needed (existing logic)
  if (comments || supplies) {
    await createTicketFromChecklist(submission.rows[0]);
  }
  
  // Analytics tracking
  await trackCompletionAnalytics(submission.rows[0]);
  
  res.json({ success: true, submission: submission.rows[0] });
});
```

## Phase 3: Frontend Enhancements (Day 5-6)

### Update ChecklistSystem.tsx
```typescript
// Show context information
const ChecklistHeader = ({ context }) => (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
    <div className="flex items-center justify-between">
      <div>
        {context.isOnSite ? (
          <span className="text-green-600">✓ On-site verified (entered {context.doorEntry})</span>
        ) : (
          <span className="text-yellow-600">⚠ No door entry detected</span>
        )}
      </div>
      <div className="text-sm text-gray-600">
        Last cleaned: {context.lastCleaned}
      </div>
    </div>
    {context.openTickets.length > 0 && (
      <div className="mt-2 text-sm text-red-600">
        ⚠ {context.openTickets[0].count} open tickets at this location
      </div>
    )}
  </div>
);

// Enhanced task display with history
const TaskItem = ({ task, lastIssue }) => (
  <div className="task-item">
    <input type="checkbox" />
    <span>{task.task_text}</span>
    {task.ninjaone_script_id && (
      <span className="ml-2 text-xs text-blue-600">🤖 Auto-reset on completion</span>
    )}
    {lastIssue && (
      <div className="text-xs text-gray-500 mt-1">
        Last note: {lastIssue}
      </div>
    )}
  </div>
);

// Update QR generation for template IDs
const generateQrCode = async () => {
  const params = new URLSearchParams({
    templateId: selectedTemplate.id,
    location: selectedLocation
  });
  const checklistUrl = `${window.location.origin}/checklists?${params}`;
  // Generate QR...
};
```

### Admin Template Manager (New Page)
```typescript
// /pages/operations/templates.tsx
const TemplateManager = () => {
  // List all templates
  // Clone template for location
  // Edit tasks (add/remove/reorder)
  // Link NinjaOne scripts to tasks
  // View analytics per template
};
```

## Phase 4: Analytics & Reporting (Day 7)

### Add Analytics Queries
```sql
-- Task completion rates
CREATE VIEW task_analytics AS
SELECT 
  ct.task_text,
  ct.template_id,
  COUNT(tc.id) as total_completions,
  COUNT(CASE WHEN tc.skipped THEN 1 END) as times_skipped,
  AVG(EXTRACT(EPOCH FROM (tc.completed_at - cs.door_entry_time))/60) as avg_minutes_to_complete,
  COUNT(DISTINCT cs.ticket_id) as tickets_generated
FROM checklist_tasks ct
LEFT JOIN task_completions tc ON tc.task_id = ct.id
LEFT JOIN checklist_submissions cs ON cs.id = tc.submission_id
GROUP BY ct.id, ct.task_text, ct.template_id;

-- Supply predictions
CREATE VIEW supply_trends AS
SELECT 
  location,
  JSON_EXTRACT_PATH_TEXT(supplies_needed::json, 'name') as supply,
  COUNT(*) as times_requested,
  DATE_TRUNC('week', completion_time) as week
FROM checklist_submissions
WHERE supplies_needed IS NOT NULL
GROUP BY location, supply, week;

-- Location performance
CREATE VIEW location_performance AS
SELECT 
  location,
  AVG(actual_duration_minutes) as avg_cleaning_time,
  COUNT(CASE WHEN auto_verified THEN 1 END)::float / COUNT(*) as verification_rate,
  COUNT(CASE WHEN ticket_created THEN 1 END) as total_issues
FROM checklist_submissions
WHERE completion_time > NOW() - INTERVAL '30 days'
GROUP BY location;
```

### Dashboard Updates
- Show which tasks are most often skipped
- Predict when supplies will be needed
- Compare actual vs expected cleaning times
- Flag suspicious submissions (no door entry)

## Phase 5: Testing & Rollout (Day 8-10)

### Testing Checklist
- [ ] Templates load correctly from database
- [ ] Location-specific templates work
- [ ] UniFi verification works
- [ ] NinjaOne scripts trigger correctly
- [ ] Tickets still auto-create
- [ ] Analytics queries perform well
- [ ] QR codes work with new template IDs
- [ ] Mobile responsiveness maintained

### Rollout Strategy
1. **Pilot**: Test with one location for 3 days
2. **Expand**: Add 2 more locations
3. **Full Deploy**: All locations after 1 week
4. **Monitor**: Watch for issues, performance

## Benefits Delivered

### Immediate
- ✅ Different checklists per location
- ✅ Fraud prevention (UniFi verification)
- ✅ Automatic equipment resets (NinjaOne)
- ✅ Better context for cleaners

### Within 30 Days
- 📊 Know which tasks cause problems
- ⏱️ Accurate time estimates
- 📦 Predict supply needs
- 🎯 Optimize templates based on data

### Within 90 Days
- 💰 Reduce supply waste (15-20%)
- ⏰ Reduce cleaning time (10%)
- 📉 Reduce tickets (20%)
- 📈 Improve quality scores

## What Stays Simple

- **No GPS tracking** - UniFi is enough
- **No billing** - Not needed
- **No complex scheduling** - Current system works
- **No offline mode** - Not required
- **Same UI** - Minimal changes
- **Same permissions** - Use existing roles

## Total Implementation: 10 Days

- Days 1-2: Database setup
- Days 3-4: Backend integration  
- Days 5-6: Frontend updates
- Day 7: Analytics
- Days 8-10: Testing & rollout

## Success Metrics

1. **Templates migrated**: 100% to database
2. **UniFi verification**: 95%+ accuracy
3. **NinjaOne automation**: 10+ tasks automated
4. **Time saved**: 10% reduction in completion time
5. **User satisfaction**: No complaints about changes

This plan delivers flexibility and intelligence while keeping the system simple and maintainable.