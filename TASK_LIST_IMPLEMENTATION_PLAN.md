# Task List Implementation Plan - ClubOS

## Executive Summary
Implement a Google Keep-style task management system integrated with the existing ticket system, allowing operators to manage personal tasks alongside tickets in a less cumbersome way.

## Current State Analysis

### Existing Systems
1. **Ticket System**: Full-featured issue tracking (facilities/tech categories)
2. **Checklist System**: Feeds issues into tickets via "create ticket" option
3. **Database**: PostgreSQL with tickets, ticket_comments tables

### Pain Points
- Tickets are too heavyweight for simple operator tasks
- No personal task management for operators
- Checklists are location/time-specific, not personal

## Proposed Solution: Hybrid Task-Ticket System

### Architecture Overview
```
┌─────────────────┐     ┌─────────────────┐
│   Quick Tasks   │────▶│     Tickets     │
│  (Google Keep)  │     │   (Full Issue)  │
└─────────────────┘     └─────────────────┘
        │                        ▲
        └──── Convert To ────────┘
```

## Implementation Approach

### Option 1: Enhanced Ticket System (Recommended)
Add a lightweight "task mode" to existing tickets with simplified UI.

#### Database Changes
```sql
-- Add to tickets table
ALTER TABLE tickets ADD COLUMN is_task BOOLEAN DEFAULT false;
ALTER TABLE tickets ADD COLUMN task_type VARCHAR(50); -- 'personal', 'team', 'quick'
ALTER TABLE tickets ADD COLUMN due_date TIMESTAMP;
ALTER TABLE tickets ADD COLUMN completed_at TIMESTAMP;
ALTER TABLE tickets ADD COLUMN parent_ticket_id UUID REFERENCES tickets(id);
ALTER TABLE tickets ADD COLUMN checklist_items JSONB; -- For sub-tasks
ALTER TABLE tickets ADD COLUMN tags TEXT[]; -- For categorization
ALTER TABLE tickets ADD COLUMN color VARCHAR(20); -- Visual organization
ALTER TABLE tickets ADD COLUMN pinned BOOLEAN DEFAULT false;
ALTER TABLE tickets ADD COLUMN archived BOOLEAN DEFAULT false;
```

#### Features
1. **Quick Task Creation**
   - Minimal fields: title + optional description
   - Auto-assign to creator
   - Default to "task" category
   - No priority/location required

2. **Google Keep-Style UI**
   - Card-based layout
   - Drag & drop reordering
   - Color coding
   - Pin important tasks
   - Archive completed tasks

3. **Task → Ticket Conversion**
   - One-click upgrade to full ticket
   - Preserves history and comments
   - Adds required ticket fields

### Option 2: Separate Task System
Create dedicated task tables with optional ticket linking.

#### New Database Tables
```sql
CREATE TABLE operator_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT false,
  due_date TIMESTAMP,
  reminder_date TIMESTAMP,
  color VARCHAR(20),
  pinned BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  tags TEXT[],
  checklist_items JSONB,
  linked_ticket_id UUID REFERENCES tickets(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE task_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES operator_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES operator_tasks(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## UI/UX Design

### Task Center Page Layout
```
┌──────────────────────────────────────────┐
│  [Tickets] [Tasks] [All]    [+ New Task] │
├──────────────────────────────────────────┤
│  Pinned Tasks                            │
│  ┌─────┐ ┌─────┐ ┌─────┐                │
│  │Task1│ │Task2│ │Task3│                 │
│  └─────┘ └─────┘ └─────┘                 │
├──────────────────────────────────────────┤
│  Today                                    │
│  ┌─────┐ ┌─────┐                         │
│  │Task4│ │Task5│                         │
│  └─────┘ └─────┘                         │
├──────────────────────────────────────────┤
│  This Week                                │
│  ┌─────┐ ┌─────┐ ┌─────┐                │
│  │Task6│ │Task7│ │Task8│                 │
│  └─────┘ └─────┘ └─────┘                 │
└──────────────────────────────────────────┘
```

### Task Card Component
```tsx
interface TaskCard {
  id: string;
  title: string;
  description?: string;
  color: string;
  isPinned: boolean;
  isCompleted: boolean;
  dueDate?: Date;
  tags: string[];
  checklistItems?: {
    text: string;
    completed: boolean;
  }[];
  quickActions: {
    convertToTicket: () => void;
    archive: () => void;
    duplicate: () => void;
  };
}
```

## Implementation Steps

### Phase 1: Database & Backend (Week 1)
1. Create migration for task fields
2. Add task API endpoints:
   - `GET /api/tasks` - List operator tasks
   - `POST /api/tasks` - Create quick task
   - `PATCH /api/tasks/:id` - Update task
   - `POST /api/tasks/:id/convert` - Convert to ticket
   - `DELETE /api/tasks/:id` - Delete task

### Phase 2: Frontend Components (Week 2)
1. Create `TaskCard` component
2. Build `TaskBoard` with drag-and-drop
3. Add `QuickTaskModal` for creation
4. Implement task filtering/search

### Phase 3: Integration (Week 3)
1. Add task view toggle to ticket page
2. Implement task → ticket conversion
3. Add task notifications
4. Create task templates

### Phase 4: Enhancements (Week 4)
1. Add recurring tasks
2. Implement task sharing
3. Add voice-to-task (mobile)
4. Create task analytics

## Benefits

### For Operators
- Quick task capture without ticket overhead
- Personal organization tools
- Seamless escalation to tickets when needed
- Visual task management

### For Management
- Better visibility into operator workload
- Distinction between personal tasks and system issues
- Improved ticket quality (real issues only)

## Technical Considerations

### Performance
- Index on `is_task`, `operator_id`, `created_at`
- Pagination for task lists
- Caching for frequently accessed tasks

### Security
- Tasks visible only to creator (unless shared)
- Role-based access for task → ticket conversion
- Audit trail for all changes

### Mobile Optimization
- Touch-friendly task cards
- Swipe actions (complete, archive)
- Offline support with sync

## Migration Strategy
1. Deploy backend changes
2. Soft launch with "Tasks (Beta)" tab
3. Gather feedback from operators
4. Iterate on UI/features
5. Full rollout with training

## Success Metrics
- Reduction in low-priority tickets
- Increased operator satisfaction scores
- Task completion rates
- Time from task → ticket conversion

## Alternative: Third-Party Integration
If building in-house is too complex, consider:
- Notion API integration
- Todoist for Business
- Microsoft To-Do integration
- Custom Google Keep integration

## Recommendation
**Go with Option 1 (Enhanced Ticket System)** because:
1. Leverages existing infrastructure
2. Maintains data consistency
3. Easier upgrade path (task → ticket)
4. Single source of truth
5. Lower maintenance overhead

## Next Steps
1. Review plan with stakeholders
2. Create detailed technical specifications
3. Build proof-of-concept
4. Test with select operators
5. Iterate based on feedback
6. Full deployment