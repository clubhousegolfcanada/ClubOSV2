# Dynamic Checklists with UniFi Door Integration

## Simple Workflow
1. **Select Location** → 2. **Unlock Door** → 3. **Start Checklist** → 4. **Complete Tasks** → 5. **Submit**

## Core Concept
The checklist system becomes the entry point for cleaners. They can't start cleaning without unlocking through the checklist, creating perfect tracking.

## Database Changes (Simplified)

```sql
-- 1. Dynamic templates
CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Template tasks
CREATE TABLE checklist_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE,
  task_text VARCHAR(500) NOT NULL,
  position INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Enhanced submissions with door tracking
ALTER TABLE checklist_submissions 
ADD COLUMN template_id UUID REFERENCES checklist_templates(id),
ADD COLUMN door_unlocked_at TIMESTAMP,
ADD COLUMN started_at TIMESTAMP,
ADD COLUMN completed_at TIMESTAMP,
ADD COLUMN duration_minutes INT GENERATED ALWAYS AS (
  EXTRACT(EPOCH FROM (completed_at - started_at))/60
) STORED;

-- 4. Door unlock log (for audit)
CREATE TABLE checklist_door_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  location VARCHAR(255) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checklist_submission_id UUID REFERENCES checklist_submissions(id),
  unifi_response JSONB
);
```

## Frontend Flow Changes

### ChecklistSystem.tsx Updates

```typescript
// Enhanced checklist page with door control
const ChecklistSystem = () => {
  const [checklistStarted, setChecklistStarted] = useState(false);
  const [doorUnlocked, setDoorUnlocked] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  
  // Step 1: Location Selection with Door Unlock
  const LocationSelector = () => (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-3">Select Location & Begin</h3>
      
      <select 
        value={selectedLocation} 
        onChange={(e) => setSelectedLocation(e.target.value)}
        className="w-full mb-4"
      >
        {locations.map(loc => (
          <option key={loc} value={loc}>{loc}</option>
        ))}
      </select>
      
      {!doorUnlocked ? (
        <button
          onClick={handleUnlockAndStart}
          className="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
        >
          🔓 Unlock Door & Start Checklist
        </button>
      ) : (
        <div className="text-green-600 font-medium">
          ✓ Door Unlocked - Checklist Active
          <div className="text-sm text-gray-500 mt-1">
            Started: {startTime?.toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
  
  // Unlock door and start checklist
  const handleUnlockAndStart = async () => {
    try {
      // Check user permissions for location
      if (!canAccessLocation(user, selectedLocation)) {
        toast.error('You do not have access to this location');
        return;
      }
      
      // Unlock door via UniFi
      const unlockResponse = await http.post('/api/unifi/unlock', {
        location: selectedLocation,
        reason: 'checklist_start'
      });
      
      if (unlockResponse.data.success) {
        setDoorUnlocked(true);
        setChecklistStarted(true);
        setStartTime(new Date());
        
        // Create initial submission record
        const submission = await http.post('/api/checklists/start', {
          templateId: currentTemplate.id,
          location: selectedLocation,
          doorUnlockedAt: new Date()
        });
        
        setCurrentSubmissionId(submission.data.id);
        toast.success('Door unlocked - you may begin cleaning');
      }
    } catch (error) {
      toast.error('Failed to unlock door');
    }
  };
  
  // Show timer while checklist is active
  const ChecklistTimer = () => {
    const [elapsed, setElapsed] = useState(0);
    
    useEffect(() => {
      if (checklistStarted && !isSubmitting) {
        const interval = setInterval(() => {
          setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
        }, 1000);
        return () => clearInterval(interval);
      }
    }, [checklistStarted]);
    
    return (
      <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Cleaning in Progress</span>
          <span className="text-lg font-mono">
            {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>
    );
  };
  
  // Modified submit to close the session
  const handleSubmit = async () => {
    // ... existing submission logic ...
    
    // Update submission with completion time
    await http.patch(`/api/checklists/complete/${currentSubmissionId}`, {
      completedAt: new Date(),
      completedTasks,
      comments,
      supplies,
      photos
    });
    
    toast.success('Checklist completed! Total time: ' + formatDuration(elapsed));
    
    // Reset for next checklist
    setChecklistStarted(false);
    setDoorUnlocked(false);
    setStartTime(null);
  };
  
  return (
    <div>
      {!checklistStarted ? (
        <LocationSelector />
      ) : (
        <>
          <ChecklistTimer />
          {/* Existing checklist UI */}
        </>
      )}
    </div>
  );
};
```

## Backend Integration

### New Endpoints

```typescript
// routes/checklists.ts

// Start a checklist session
router.post('/start', authenticate, async (req, res) => {
  const { templateId, location, doorUnlockedAt } = req.body;
  const userId = req.user.id;
  
  // Verify user has access to location
  const hasAccess = await verifyLocationAccess(userId, location);
  if (!hasAccess) {
    throw new AppError('Access denied for this location', 403);
  }
  
  // Create submission record
  const submission = await db.query(`
    INSERT INTO checklist_submissions 
    (template_id, user_id, location, door_unlocked_at, started_at, status)
    VALUES ($1, $2, $3, $4, NOW(), 'in_progress')
    RETURNING *
  `, [templateId, userId, location, doorUnlockedAt]);
  
  // Log door unlock
  await db.query(`
    INSERT INTO checklist_door_unlocks 
    (user_id, location, checklist_submission_id)
    VALUES ($1, $2, $3)
  `, [userId, location, submission.rows[0].id]);
  
  res.json({ success: true, id: submission.rows[0].id });
});

// Complete a checklist session
router.patch('/complete/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { completedTasks, comments, supplies, photos } = req.body;
  
  // Update submission
  const result = await db.query(`
    UPDATE checklist_submissions 
    SET 
      completed_at = NOW(),
      completed_tasks = $2,
      comments = $3,
      supplies_needed = $4,
      photo_urls = $5,
      status = 'completed'
    WHERE id = $1 AND user_id = $6
    RETURNING *, duration_minutes
  `, [id, JSON.stringify(completedTasks), comments, supplies, photos, req.user.id]);
  
  // Create ticket if needed
  if (comments || supplies) {
    await createTicketFromChecklist(result.rows[0]);
  }
  
  res.json({ 
    success: true, 
    duration: result.rows[0].duration_minutes 
  });
});

// Integration with UniFi
router.post('/api/unifi/unlock', authenticate, async (req, res) => {
  const { location, reason } = req.body;
  
  // Get UniFi door ID for location
  const doorConfig = {
    'Bedford': process.env.UNIFI_BEDFORD_DOOR_ID,
    'Dartmouth': process.env.UNIFI_DARTMOUTH_DOOR_ID,
    // ... other locations
  };
  
  if (!doorConfig[location]) {
    throw new AppError('No door configured for this location', 400);
  }
  
  // Call UniFi API to unlock
  const unifiResponse = await unifiService.unlockDoor(
    doorConfig[location],
    req.user.id,
    reason
  );
  
  res.json({ success: true, unifiResponse });
});
```

## User Permissions

```typescript
// Extend user permissions for location access
ALTER TABLE users 
ADD COLUMN allowed_locations TEXT[] DEFAULT ARRAY[]::TEXT[];

// Helper function
function canAccessLocation(user: User, location: string): boolean {
  // Admins can access all
  if (user.role === 'admin') return true;
  
  // Check if location is in user's allowed list
  return user.allowed_locations?.includes(location) || false;
}
```

## Analytics & Reporting

```sql
-- Average cleaning time by location
SELECT 
  location,
  AVG(duration_minutes) as avg_duration,
  MIN(duration_minutes) as fastest,
  MAX(duration_minutes) as slowest,
  COUNT(*) as total_cleanings
FROM checklist_submissions
WHERE completed_at IS NOT NULL
GROUP BY location
ORDER BY avg_duration DESC;

-- Track door unlock to completion time
SELECT 
  location,
  user_name,
  door_unlocked_at,
  started_at,
  completed_at,
  duration_minutes,
  EXTRACT(EPOCH FROM (started_at - door_unlocked_at))/60 as entry_delay_minutes
FROM checklist_submissions cs
JOIN users u ON u.id = cs.user_id
WHERE door_unlocked_at IS NOT NULL
ORDER BY completed_at DESC;

-- Incomplete checklists (started but not finished)
SELECT 
  location,
  user_name,
  started_at,
  NOW() - started_at as time_elapsed
FROM checklist_submissions cs
JOIN users u ON u.id = cs.user_id
WHERE status = 'in_progress'
  AND started_at < NOW() - INTERVAL '2 hours';
```

## Benefits of This Approach

### Perfect Tracking
- **Know exactly** when cleaning started (door unlock)
- **Know exactly** when cleaning ended (submission)
- **No gaming the system** - must unlock door to start

### Access Control
- Only authorized users can unlock specific locations
- Audit trail of every door unlock
- Link each unlock to a checklist submission

### Simple Workflow
- One button to start: "Unlock Door & Start Checklist"
- Timer shows elapsed time
- Clear completion with duration tracking

### Quality Metrics
- Actual cleaning time (not estimated)
- Entry delay (unlock to start)
- Abandonment rate (started but not completed)

## Implementation Timeline

**Day 1-2**: Database migration
- Create new tables
- Migrate templates from hardcoded

**Day 3**: Backend integration
- UniFi unlock endpoint
- Start/complete checklist endpoints
- Permission checking

**Day 4-5**: Frontend updates
- Add unlock button to checklist page
- Implement timer and session tracking
- Update submission flow

**Day 6**: Testing & refinement
- Test door unlocks at each location
- Verify permission system
- Test edge cases (abandonment, timeout)

**Day 7**: Deploy & monitor
- Roll out to one location
- Monitor for issues
- Gradual expansion

## Total: 1 Week Implementation

Simple, practical, and gives you perfect accountability without complexity.