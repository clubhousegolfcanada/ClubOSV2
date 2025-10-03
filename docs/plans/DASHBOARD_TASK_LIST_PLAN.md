# Dashboard Task List Integration - ClubOS

## Replace Status Section with Personal Tasks

Perfect spot! Replace the collapsible "Status" section (lines 399-441) in `DatabaseExternalTools.tsx` with a task list.

## Simple Implementation

### 1. Modify DatabaseExternalTools.tsx

Replace the Status section with tasks:

```tsx
// Line 399 - Replace entire Status section with:

{/* Tasks Section - Personal Todo List */}
<div>
  <button
    onClick={toggleTasksCollapsed}
    className="w-full flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-3 hover:text-[var(--text-primary)] transition-colors"
  >
    <span>My Tasks</span>
    <div className="flex items-center gap-2">
      {isTasksCollapsed && (
        <div className="flex items-center gap-2 text-[10px]">
          <span className="bg-[var(--bg-tertiary)] px-2 py-1 rounded">
            {activeTasks.length} active
          </span>
        </div>
      )}
      {isTasksCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
    </div>
  </button>

  {/* Collapsible Content */}
  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
    isTasksCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
  }`}>
    {/* Task Input */}
    <div className="flex gap-1.5 mb-3">
      <input
        type="text"
        value={newTask}
        onChange={(e) => setNewTask(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && addTask()}
        placeholder="Add a task..."
        className="flex-1 px-2 py-1.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] rounded focus:outline-none focus:border-[var(--accent)]"
      />
      <button
        onClick={addTask}
        className="px-3 py-1.5 bg-[var(--accent)] text-white rounded text-xs hover:opacity-90"
      >
        Add
      </button>
    </div>

    {/* Task List */}
    <div className="space-y-1 max-h-60 overflow-y-auto">
      {loadingTasks ? (
        <div className="text-center py-4">
          <Loader className="w-4 h-4 animate-spin mx-auto text-[var(--accent)]" />
        </div>
      ) : (
        <>
          {/* Active Tasks */}
          {activeTasks.map(task => (
            <div key={task.id} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded hover:bg-[var(--bg-secondary)] transition-colors">
              <input
                type="checkbox"
                checked={false}
                onChange={() => toggleTask(task.id, true)}
                className="w-3 h-3 rounded"
              />
              <span className="flex-1 text-xs text-[var(--text-primary)]">{task.text}</span>
              <button
                onClick={() => deleteTask(task.id)}
                className="text-[var(--text-muted)] hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Completed Count */}
          {completedTasks.length > 0 && (
            <div className="pt-2 mt-2 border-t border-[var(--border-secondary)]">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                + {completedTasks.length} completed {showCompleted ? '▼' : '▶'}
              </button>

              {showCompleted && (
                <div className="mt-1 space-y-1">
                  {completedTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-2 p-2 bg-[var(--bg-tertiary)] rounded opacity-50">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleTask(task.id, false)}
                        className="w-3 h-3 rounded"
                      />
                      <span className="flex-1 text-xs line-through text-[var(--text-muted)]">{task.text}</span>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-[var(--text-muted)] hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  </div>
</div>
```

### 2. Add Task State & Functions

Add to DatabaseExternalTools.tsx (around line 47):

```tsx
// Task states
const [tasks, setTasks] = useState<any[]>([]);
const [newTask, setNewTask] = useState('');
const [loadingTasks, setLoadingTasks] = useState(false);
const [showCompleted, setShowCompleted] = useState(false);
const [isTasksCollapsed, setIsTasksCollapsed] = useState(false);

const activeTasks = tasks.filter(t => !t.is_completed);
const completedTasks = tasks.filter(t => t.is_completed);

// Load tasks on mount
useEffect(() => {
  if (user) {
    loadTasks();
  }
}, [user]);

const loadTasks = async () => {
  setLoadingTasks(true);
  try {
    const response = await http.get('tasks');
    if (response.data.success) {
      setTasks(response.data.data);
    }
  } catch (error) {
    logger.error('Failed to load tasks:', error);
  } finally {
    setLoadingTasks(false);
  }
};

const addTask = async () => {
  if (!newTask.trim()) return;
  try {
    await http.post('tasks', { text: newTask });
    setNewTask('');
    loadTasks();
  } catch (error) {
    notify('error', 'Failed to add task');
  }
};

const toggleTask = async (id: string, completed: boolean) => {
  try {
    await http.patch(`tasks/${id}`, { is_completed: completed });
    loadTasks();
  } catch (error) {
    notify('error', 'Failed to update task');
  }
};

const deleteTask = async (id: string) => {
  try {
    await http.delete(`tasks/${id}`);
    loadTasks();
  } catch (error) {
    notify('error', 'Failed to delete task');
  }
};

const toggleTasksCollapsed = () => {
  const newState = !isTasksCollapsed;
  setIsTasksCollapsed(newState);
  localStorage.setItem('tasksSectionCollapsed', String(newState));
};
```

### 3. Add Imports

Add to top of DatabaseExternalTools.tsx:

```tsx
import { http } from '@/api/http';
// X icon already imported
```

## Backend (Same as Before)

### Migration (232_add_operator_tasks.sql):
```sql
CREATE TABLE IF NOT EXISTS operator_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  position INTEGER DEFAULT 0
);

CREATE INDEX idx_operator_tasks_user ON operator_tasks(operator_id, is_completed);
```

### Routes (src/routes/tasks.ts):
Same 4 simple endpoints as before.

### Register in server.ts:
```typescript
import taskRoutes from './routes/tasks';
app.use('/api/tasks', taskRoutes);
```

## Benefits of Dashboard Placement

1. **Always Visible** - Right there when operators log in
2. **Quick Access** - No navigation needed
3. **Replaces Unused Stats** - Those booking stats weren't actionable
4. **Mobile Friendly** - Collapsible on small screens
5. **Fits UI Pattern** - Same collapsible style as Quick Links

## What Changes

### Remove:
- Status section with 4 toggle buttons (Checklists, Requests, Tech, Facilities)

### Add:
- Personal task list with:
  - Add task input
  - Active tasks with checkboxes
  - Completed tasks (collapsible)
  - Delete buttons
  - Task counter

## Visual Result

```
┌─────────────────────────┐
│ MY TASKS          3 active ▼│
├─────────────────────────┤
│ [Add a task...]    [Add] │
├─────────────────────────┤
│ ☐ NSSGT              [X] │
│ ☐ River oaks modem   [X] │
│ ☐ pickup projector   [X] │
├─────────────────────────┤
│ + 259 completed ▶        │
└─────────────────────────┘
```

## Implementation Time: 1 Day

- 1 hour: Backend setup
- 2 hours: Modify DatabaseExternalTools.tsx
- 1 hour: Test and deploy

This is even simpler than adding to tickets page - just replace existing code in the dashboard sidebar!