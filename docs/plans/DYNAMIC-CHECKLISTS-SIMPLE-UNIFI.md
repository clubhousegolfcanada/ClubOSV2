# Dynamic Checklists with UniFi - Simplified Plan

## Core Workflow (Cleaner's View)
1. **Select Location**
2. **Unlock Door & Start** 
3. **Complete Tasks**
4. **Submit**

That's it. No timer, no distractions. Just the job.

## Database Changes (Minimal)

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

-- 3. Track timing in submissions (backend only)
ALTER TABLE checklist_submissions 
ADD COLUMN template_id UUID REFERENCES checklist_templates(id),
ADD COLUMN door_unlocked_at TIMESTAMP,
ADD COLUMN started_at TIMESTAMP,
ADD COLUMN completed_at TIMESTAMP,
ADD COLUMN duration_minutes INT GENERATED ALWAYS AS (
  EXTRACT(EPOCH FROM (completed_at - started_at))/60
) STORED;

-- 4. User location permissions
ALTER TABLE users 
ADD COLUMN allowed_locations TEXT[] DEFAULT ARRAY[]::TEXT[];
```

## Frontend - Clean & Simple

### ChecklistSystem.tsx Updates

```typescript
const ChecklistSystem = () => {
  const [checklistStarted, setChecklistStarted] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null); // Hidden from user
  
  // Step 1: Location Selection with Door Unlock
  const LocationSelector = () => (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Category Selection */}
        <div>
          <label className="block text-sm font-medium mb-3">Category</label>
          {/* ... existing category buttons ... */}
        </div>
        
        {/* Type Selection */}
        <div>
          <label className="block text-sm font-medium mb-3">Type</label>
          {/* ... existing type buttons ... */}
        </div>
        
        {/* Location Selection */}
        <div>
          <label className="block text-sm font-medium mb-3">Location</label>
          <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
            {/* Only show locations user has access to */}
            {userLocations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>
      
      {!checklistStarted ? (
        <button
          onClick={handleUnlockAndStart}
          className="mt-4 w-full px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600"
        >
          🔓 Unlock Door & Begin Checklist
        </button>
      ) : (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-700 font-medium">✓ Checklist Active</span>
          <span className="text-sm text-gray-600 ml-2">at {selectedLocation}</span>
        </div>
      )}
    </div>
  );
  
  // Unlock door and start (no timer shown)
  const handleUnlockAndStart = async () => {
    try {
      // Unlock door
      const unlockResponse = await http.post('/api/unifi/unlock', {
        location: selectedLocation,
        reason: 'checklist_start'
      });
      
      if (unlockResponse.data.success) {
        setChecklistStarted(true);
        setStartTime(new Date()); // Track internally, don't show
        
        // Create submission record
        const submission = await http.post('/api/checklists/start', {
          templateId: currentTemplate.id,
          location: selectedLocation,
          doorUnlockedAt: new Date()
        });
        
        setCurrentSubmissionId(submission.data.id);
        toast.success('Door unlocked - begin cleaning');
      }
    } catch (error) {
      toast.error('Unable to unlock door');
    }
  };
  
  // Submit (timing happens in backend)
  const handleSubmit = async () => {
    // ... collect task completions ...
    
    await http.patch(`/api/checklists/complete/${currentSubmissionId}`, {
      completedTasks,
      comments,
      supplies,
      photos
    });
    
    toast.success('Checklist submitted successfully!');
    // Note: No duration shown to cleaner
    
    // Reset for next checklist
    setChecklistStarted(false);
    setStartTime(null);
  };
  
  return (
    <div>
      <LocationSelector />
      
      {checklistStarted && currentTemplate && (
        <div className="mt-4">
          {/* Regular checklist tasks - no timer visible */}
          <ChecklistTasks />
          <SubmitButton />
        </div>
      )}
    </div>
  );
};
```

## Backend - Track Everything

```typescript
// routes/checklists.ts

// Start checklist (tracks time internally)
router.post('/start', authenticate, async (req, res) => {
  const { templateId, location, doorUnlockedAt } = req.body;
  const userId = req.user.id;
  
  // Verify access
  if (!req.user.allowed_locations?.includes(location)) {
    throw new AppError('No access to this location', 403);
  }
  
  // Create submission with timestamps
  const submission = await db.query(`
    INSERT INTO checklist_submissions 
    (template_id, user_id, location, door_unlocked_at, started_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id
  `, [templateId, userId, location, doorUnlockedAt]);
  
  logger.info('Checklist started', {
    userId,
    location,
    submissionId: submission.rows[0].id,
    startTime: new Date()
  });
  
  res.json({ success: true, id: submission.rows[0].id });
});

// Complete checklist (calculate duration internally)
router.patch('/complete/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  
  const result = await db.query(`
    UPDATE checklist_submissions 
    SET 
      completed_at = NOW(),
      completed_tasks = $2,
      comments = $3,
      supplies_needed = $4,
      photo_urls = $5
    WHERE id = $1 AND user_id = $6
    RETURNING *, duration_minutes
  `, [id, ...otherParams, req.user.id]);
  
  logger.info('Checklist completed', {
    submissionId: id,
    duration: result.rows[0].duration_minutes,
    location: result.rows[0].location
  });
  
  res.json({ success: true });
  // Note: Don't return duration to frontend
});
```

## Admin Dashboard - See All Timing

```typescript
// Admin can see timing details
const AdminChecklistReport = () => {
  return (
    <table>
      <thead>
        <tr>
          <th>Location</th>
          <th>Cleaner</th>
          <th>Date</th>
          <th>Door Unlock</th>
          <th>Start</th>
          <th>Complete</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        {submissions.map(s => (
          <tr>
            <td>{s.location}</td>
            <td>{s.user_name}</td>
            <td>{formatDate(s.completed_at)}</td>
            <td>{formatTime(s.door_unlocked_at)}</td>
            <td>{formatTime(s.started_at)}</td>
            <td>{formatTime(s.completed_at)}</td>
            <td className={getDurationColor(s.duration_minutes)}>
              {s.duration_minutes} min
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

## Analytics Queries (Backend Only)

```sql
-- Average cleaning times by location (for management)
SELECT 
  location,
  AVG(duration_minutes) as avg_duration,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_minutes) as median_duration,
  COUNT(*) as total_cleanings
FROM checklist_submissions
WHERE completed_at > NOW() - INTERVAL '30 days'
GROUP BY location;

-- Identify outliers (too fast or too slow)
SELECT 
  cs.*,
  u.name as cleaner_name,
  CASE 
    WHEN duration_minutes < 10 THEN 'Too Fast - Possible Skip'
    WHEN duration_minutes > 60 THEN 'Too Slow - Check Issues'
    ELSE 'Normal'
  END as flag
FROM checklist_submissions cs
JOIN users u ON u.id = cs.user_id
WHERE duration_minutes < 10 OR duration_minutes > 60
ORDER BY completed_at DESC;

-- Track improvement over time
SELECT 
  u.name,
  DATE_TRUNC('week', completed_at) as week,
  AVG(duration_minutes) as avg_time,
  COUNT(*) as cleanings_completed
FROM checklist_submissions cs
JOIN users u ON u.id = cs.user_id
GROUP BY u.name, week
ORDER BY u.name, week;
```

## What Cleaners See vs What Admins See

### Cleaner View (Simple)
- Select location → Unlock door → Do tasks → Submit
- No timer, no pressure, no distractions
- Focus on quality and completeness

### Admin View (Detailed)
- Full timing breakdowns
- Duration analysis by location/cleaner
- Outlier detection (rushed or delayed jobs)
- Trend analysis over time
- Efficiency metrics

## Benefits

### For Cleaners
- **No pressure** - Focus on doing the job right
- **Simple workflow** - Just unlock and clean
- **Clear expectations** - Complete all tasks

### For Management
- **Perfect tracking** - Know exact times without cleaner gaming
- **Quality focus** - Cleaners aren't rushing
- **Data insights** - Identify training needs or location issues
- **Accountability** - Door unlock proves presence

## Implementation (1 Week)

**Days 1-2**: Database setup
**Day 3**: Backend tracking 
**Day 4**: Frontend simplification
**Day 5**: Admin reporting
**Days 6-7**: Testing & deploy

The cleaner experience stays simple and focused. All the timing intelligence happens silently in the background where it belongs.