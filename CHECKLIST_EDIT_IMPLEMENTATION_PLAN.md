# Checklist Edit Functionality Implementation Plan

## Overview
Implement admin-only edit functionality for checklist tasks, allowing admins to modify task labels inline without affecting the hardcoded template structure.

## Current Architecture
- **Frontend**: ChecklistSystem component displays tasks from hardcoded templates
- **Backend**: CHECKLIST_TEMPLATES object in `/routes/checklists.ts` defines all tasks
- **Storage**: Currently no database storage for task modifications

## Implementation Steps

### Step 1: Database Schema Updates
Create migration to store task customizations:

```sql
-- /backend/src/database/migrations/016_checklist_task_customizations.sql
CREATE TABLE IF NOT EXISTS checklist_task_customizations (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL, -- 'cleaning' or 'tech'
    type VARCHAR(50) NOT NULL,      -- 'daily', 'weekly', or 'quarterly'
    task_id VARCHAR(100) NOT NULL,  -- Original task ID from template
    custom_label TEXT NOT NULL,     -- Admin-customized label
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, type, task_id)
);

-- Index for fast lookups
CREATE INDEX idx_checklist_customizations_lookup 
ON checklist_task_customizations(category, type);
```

### Step 2: Backend API Updates

#### 2.1 Update GET /template endpoint
Modify `/backend/src/routes/checklists.ts` to merge customizations:

```typescript
// After getting template from CHECKLIST_TEMPLATES
const customizations = await db.query(
  `SELECT task_id, custom_label 
   FROM checklist_task_customizations 
   WHERE category = $1 AND type = $2`,
  [category, type]
);

// Merge customizations with template
const tasksWithCustomizations = template.map(task => {
  const customization = customizations.rows.find(c => c.task_id === task.id);
  return {
    ...task,
    label: customization ? customization.custom_label : task.label,
    originalLabel: task.label,
    isCustomized: !!customization
  };
});
```

#### 2.2 Add PUT /template/task endpoint
New endpoint for admin-only task updates:

```typescript
router.put('/template/task',
  authenticate,
  roleGuard(['admin']),
  validate([
    body('category').isIn(['cleaning', 'tech']),
    body('type').isIn(['daily', 'weekly', 'quarterly']),
    body('taskId').notEmpty(),
    body('label').notEmpty().trim()
  ]),
  async (req, res, next) => {
    const { category, type, taskId, label } = req.body;
    
    // Validate task exists in template
    const template = CHECKLIST_TEMPLATES[category]?.[type];
    const taskExists = template?.some(t => t.id === taskId);
    
    if (!taskExists) {
      throw new AppError('Task not found', 404);
    }
    
    // Upsert customization
    await db.query(
      `INSERT INTO checklist_task_customizations 
       (category, type, task_id, custom_label, updated_by) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (category, type, task_id) 
       DO UPDATE SET 
         custom_label = $4,
         updated_by = $5,
         updated_at = CURRENT_TIMESTAMP`,
      [category, type, taskId, label, req.user.id]
    );
    
    res.json({ success: true });
  }
);
```

#### 2.3 Add DELETE /template/task endpoint
Reset task to original label:

```typescript
router.delete('/template/task/:category/:type/:taskId',
  authenticate,
  roleGuard(['admin']),
  async (req, res, next) => {
    const { category, type, taskId } = req.params;
    
    await db.query(
      `DELETE FROM checklist_task_customizations 
       WHERE category = $1 AND type = $2 AND task_id = $3`,
      [category, type, taskId]
    );
    
    res.json({ success: true });
  }
);
```

### Step 3: Frontend Implementation

#### 3.1 Add Edit State Management
Update ChecklistSystem component:

```typescript
// New state variables
const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
const [editValue, setEditValue] = useState('');
const [savingTask, setSavingTask] = useState(false);

// Check if user is admin
const isAdmin = user?.role === 'admin';
```

#### 3.2 Create Edit UI Components
Add inline edit functionality:

```typescript
const handleEditStart = (task: Task) => {
  setEditingTaskId(task.id);
  setEditValue(task.label);
};

const handleEditSave = async (task: Task) => {
  if (editValue.trim() === task.label) {
    setEditingTaskId(null);
    return;
  }
  
  try {
    setSavingTask(true);
    const token = localStorage.getItem('clubos_token');
    
    await axios.put(
      `${API_URL}/checklists/template/task`,
      {
        category: activeCategory,
        type: activeType,
        taskId: task.id,
        label: editValue.trim()
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    toast.success('Task updated successfully');
    setEditingTaskId(null);
    loadTemplate(); // Reload to get updated data
  } catch (error) {
    toast.error('Failed to update task');
  } finally {
    setSavingTask(false);
  }
};

const handleEditCancel = () => {
  setEditingTaskId(null);
  setEditValue('');
};

const handleResetTask = async (task: Task) => {
  try {
    const token = localStorage.getItem('clubos_token');
    
    await axios.delete(
      `${API_URL}/checklists/template/task/${activeCategory}/${activeType}/${task.id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    toast.success('Task reset to default');
    loadTemplate();
  } catch (error) {
    toast.error('Failed to reset task');
  }
};
```

#### 3.3 Update Task Rendering
Replace current task rendering with edit-capable version:

```tsx
{currentTemplate?.tasks.map((task) => (
  <div key={task.id} className="checklist-item">
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        id={task.id}
        checked={completedTasks[task.id] || false}
        onChange={() => toggleTask(task.id)}
        className="w-4 h-4 text-[var(--accent)] rounded"
      />
      
      {editingTaskId === task.id ? (
        // Edit mode
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEditSave(task);
              if (e.key === 'Escape') handleEditCancel();
            }}
            className="flex-1 px-2 py-1 text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded"
            autoFocus
          />
          <button
            onClick={() => handleEditSave(task)}
            disabled={savingTask}
            className="p-1 text-green-500 hover:text-green-600"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleEditCancel}
            className="p-1 text-red-500 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        // View mode
        <div className="flex-1 flex items-center justify-between group">
          <label htmlFor={task.id} className="flex-1 cursor-pointer">
            <span className={`text-xs ${
              completedTasks[task.id]
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]'
            }`}>
              {task.label}
              {task.isCustomized && (
                <span className="ml-1 text-[var(--accent)] text-[10px]">
                  (edited)
                </span>
              )}
            </span>
          </label>
          
          {isAdmin && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleEditStart(task)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                title="Edit task"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              
              {task.isCustomized && (
                <button
                  onClick={() => handleResetTask(task)}
                  className="p-1 text-[var(--text-secondary)] hover:text-red-500"
                  title="Reset to default"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
))}
```

### Step 4: Styling Updates
Add CSS for smooth transitions:

```css
.checklist-item {
  transition: background-color 0.2s;
}

.checklist-item:hover {
  background-color: var(--bg-tertiary);
}

.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}
```

### Step 5: Testing Checklist

1. **Database Migration**
   - [ ] Migration creates table successfully
   - [ ] Indexes are created
   - [ ] Table constraints work properly

2. **Backend API**
   - [ ] GET template returns customizations
   - [ ] PUT updates task labels
   - [ ] DELETE resets to original
   - [ ] Only admins can edit
   - [ ] Validation works

3. **Frontend**
   - [ ] Edit buttons only show for admins
   - [ ] Inline editing works smoothly
   - [ ] Save/cancel functionality
   - [ ] Reset to default works
   - [ ] Visual indicators for edited tasks
   - [ ] Keyboard shortcuts (Enter/Escape)

4. **Integration**
   - [ ] Changes persist across sessions
   - [ ] Multiple admins can edit
   - [ ] Non-admins see customized labels
   - [ ] Performance is good

### Step 6: Deployment Steps

1. **Backend First**
   ```bash
   cd ClubOSV1-backend
   # Migration will run automatically on deploy
   git add -A
   git commit -m "feat: Add checklist task edit API for admins"
   git push origin main
   ```

2. **Frontend Second**
   ```bash
   cd ClubOSV1-frontend
   git add -A
   git commit -m "feat: Add inline edit for checklist tasks (admin only)"
   git push origin main
   ```

3. **Verify**
   - Check Railway logs for migration success
   - Test edit functionality as admin
   - Verify non-admins can't edit

## Additional Considerations

### Future Enhancements
1. Bulk edit mode for multiple tasks
2. Task reordering via drag-and-drop
3. Add/remove custom tasks
4. Import/export task configurations
5. Audit log for task changes

### Security Notes
- Only admins can modify tasks
- Original templates remain unchanged
- All edits are tracked with user ID
- Customizations are location-agnostic

### Performance
- Customizations are cached after first load
- Minimal database queries
- No impact on non-admin users

## Risk Mitigation
- Original templates are never modified
- Easy rollback via DELETE endpoint
- All changes are logged
- Database backup before deployment

---

**Estimated Time**: 2-3 hours for full implementation
**Complexity**: Medium
**Risk**: Low (additive feature, no breaking changes)