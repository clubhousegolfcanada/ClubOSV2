# Dynamic Checklists Implementation Plan

## Executive Summary
Transform the current hardcoded checklist system into a fully database-driven, multi-tenant solution supporting multiple locations, cleaning companies, and customizable templates.

## Current State Analysis

### Limitations
- Templates hardcoded in backend (`CHECKLIST_TEMPLATES` constant)
- No ability to add/remove tasks dynamically
- No multi-company support
- No location-specific variations
- No task dependencies or conditional logic
- No versioning or audit trail for template changes

### Strengths to Preserve
- Clean UI/UX design
- Mobile responsiveness
- Supplies tracking with urgency levels
- Photo attachment capability
- QR code generation for quick access
- Performance tracking and analytics

## Proposed Database Schema

### Core Tables

```sql
-- 1. Cleaning Companies/Contractors
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  service_type VARCHAR(50), -- 'cleaning', 'tech', 'both'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Contractor-Location Assignments
CREATE TABLE contractor_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES contractors(id),
  location VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Checklist Templates (Master)
CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'cleaning', 'tech', 'safety', etc.
  type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'annual'
  description TEXT,
  is_global BOOLEAN DEFAULT false, -- Available to all locations
  created_by UUID REFERENCES users(id),
  version INT DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Location-Specific Templates
CREATE TABLE location_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id),
  location VARCHAR(255) NOT NULL,
  contractor_id UUID REFERENCES contractors(id), -- Optional: specific to contractor
  is_mandatory BOOLEAN DEFAULT false,
  frequency_override VARCHAR(50), -- Override template frequency
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_id, location, contractor_id)
);

-- 5. Template Tasks
CREATE TABLE template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE,
  task_text VARCHAR(500) NOT NULL,
  description TEXT, -- Detailed instructions
  position INT NOT NULL, -- For ordering
  is_required BOOLEAN DEFAULT true,
  estimated_time_minutes INT,
  requires_photo BOOLEAN DEFAULT false,
  requires_verification BOOLEAN DEFAULT false,
  parent_task_id UUID REFERENCES template_tasks(id), -- For subtasks
  condition_type VARCHAR(50), -- 'always', 'if_parent_checked', 'time_based', 'weather_based'
  condition_value JSONB, -- Store condition logic
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Task Dependencies
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES template_tasks(id),
  depends_on_task_id UUID REFERENCES template_tasks(id),
  dependency_type VARCHAR(50), -- 'blocks', 'requires', 'suggests'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Enhanced Submissions Table
CREATE TABLE checklist_submissions_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id),
  location VARCHAR(255) NOT NULL,
  contractor_id UUID REFERENCES contractors(id),
  submitted_by UUID REFERENCES users(id),
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  total_tasks INT NOT NULL,
  completed_tasks JSONB NOT NULL, -- Enhanced structure with timestamps per task
  skipped_tasks JSONB, -- Tasks marked as N/A with reasons
  supplies_needed JSONB,
  photo_urls JSONB,
  signature_url TEXT, -- Digital signature from cleaner
  verified_by UUID REFERENCES users(id), -- Manager verification
  verified_at TIMESTAMP,
  comments TEXT,
  weather_conditions JSONB, -- Temperature, conditions at time of cleaning
  equipment_issues JSONB, -- Track any equipment problems
  ticket_created BOOLEAN DEFAULT false,
  ticket_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Template Change History
CREATE TABLE template_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id),
  version INT NOT NULL,
  changed_by UUID REFERENCES users(id),
  change_type VARCHAR(50), -- 'created', 'task_added', 'task_removed', 'task_modified', 'archived'
  change_details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Contractor Permissions
CREATE TABLE contractor_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES contractors(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(50), -- 'viewer', 'submitter', 'supervisor', 'admin'
  can_edit_templates BOOLEAN DEFAULT false,
  can_view_all_locations BOOLEAN DEFAULT false,
  can_export_data BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contractor_id, user_id)
);

-- 10. Scheduled Checklists
CREATE TABLE scheduled_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates(id),
  location VARCHAR(255) NOT NULL,
  contractor_id UUID REFERENCES contractors(id),
  schedule_type VARCHAR(50), -- 'recurring', 'one_time'
  frequency VARCHAR(50), -- 'daily', 'weekly', 'monthly', etc.
  days_of_week INT[], -- [1,3,5] for Mon, Wed, Fri
  time_of_day TIME,
  next_due_date TIMESTAMP,
  auto_assign_to UUID REFERENCES users(id),
  send_reminder BOOLEAN DEFAULT true,
  reminder_minutes_before INT DEFAULT 30,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Performance Metrics
CREATE TABLE contractor_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID REFERENCES contractors(id),
  location VARCHAR(255),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_scheduled INT DEFAULT 0,
  total_completed INT DEFAULT 0,
  total_late INT DEFAULT 0,
  total_missed INT DEFAULT 0,
  average_completion_time_minutes INT,
  quality_score DECIMAL(3,2), -- 0.00 to 1.00
  supplies_reported INT DEFAULT 0,
  issues_reported INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Key Features to Implement

### 1. Multi-Tenant Support
- **Contractor Management**: Full CRUD for cleaning companies
- **Location Assignment**: Assign contractors to specific locations
- **Permission System**: Role-based access for contractor employees
- **Performance Tracking**: Monitor contractor performance by location

### 2. Dynamic Template Management
- **Template Builder UI**: Drag-and-drop interface for creating templates
- **Task Dependencies**: Set up conditional tasks and dependencies
- **Version Control**: Track all changes with ability to rollback
- **Template Library**: Share templates across locations or keep private
- **Import/Export**: CSV/JSON import/export for bulk template creation

### 3. Location-Specific Features
- **Custom Templates**: Override global templates for specific locations
- **Equipment Tracking**: Different equipment per location
- **Schedule Variations**: Different schedules per location
- **Local Compliance**: Add location-specific regulatory tasks

### 4. Enhanced Scheduling
- **Automated Scheduling**: Create recurring checklists automatically
- **Smart Assignments**: Auto-assign based on contractor availability
- **Reminder System**: Email/SMS reminders before due time
- **Calendar Integration**: Export to Google Calendar/Outlook

### 5. Quality Control
- **Photo Requirements**: Mandate photos for specific tasks
- **Manager Verification**: Require supervisor sign-off
- **Random Audits**: Flag random submissions for inspection
- **Scoring System**: Automatic quality scoring based on completeness

### 6. Reporting & Analytics
- **Contractor Dashboards**: Performance metrics per contractor
- **Comparison Reports**: Compare contractors across locations
- **Trend Analysis**: Identify patterns in issues/supplies
- **Cost Tracking**: Track supplies cost by contractor/location
- **SLA Monitoring**: Track against service level agreements

### 7. Mobile Enhancements
- **Offline Mode**: Complete checklists without internet
- **GPS Verification**: Verify cleaner is at location
- **Time Tracking**: Automatic time tracking per task
- **Voice Notes**: Add voice notes instead of typing
- **Barcode Scanning**: Scan equipment/supplies

### 8. Integration Points
- **Accounting Systems**: Export for billing/invoicing
- **Inventory Management**: Auto-order supplies when low
- **HR Systems**: Track contractor employee hours
- **Compliance Systems**: Export for regulatory reporting

## Implementation Phases

### Phase 1: Database Migration (Week 1-2)
1. Create new database tables
2. Migrate existing hardcoded templates to database
3. Migrate existing submissions to new schema
4. Create data migration scripts
5. Set up backup and rollback procedures

### Phase 2: Backend API Development (Week 2-4)
1. Create template management endpoints
2. Implement contractor management APIs
3. Build scheduling system
4. Add permission checking middleware
5. Create reporting endpoints

### Phase 3: Admin UI Development (Week 4-6)
1. Template builder interface
2. Contractor management pages
3. Location assignment UI
4. Scheduling interface
5. Reporting dashboards

### Phase 4: Operator UI Updates (Week 6-7)
1. Update checklist selection to use database templates
2. Add contractor selection/login
3. Implement offline capability
4. Add GPS and time tracking
5. Update submission flow

### Phase 5: Testing & Migration (Week 7-8)
1. Comprehensive testing
2. Data validation
3. Performance testing
4. User acceptance testing
5. Production migration

## Technical Considerations

### Performance
- Index frequently queried fields
- Implement caching for templates
- Use connection pooling
- Paginate large result sets
- Archive old submissions

### Security
- Row-level security for multi-tenancy
- Audit logging for all changes
- Encrypted storage for signatures
- API rate limiting per contractor
- Regular security audits

### Scalability
- Partition submissions table by date
- Use read replicas for reporting
- CDN for photo storage
- Queue system for notifications
- Microservice architecture consideration

### Compliance
- GDPR compliance for contractor data
- Data retention policies
- Right to deletion
- Audit trail requirements
- Export capabilities for legal requests

## Migration Strategy

### Step 1: Parallel Running
- Keep existing system running
- New system in shadow mode
- Gradually migrate locations

### Step 2: Pilot Program
- Select 1-2 locations for pilot
- Run for 2 weeks
- Gather feedback
- Make adjustments

### Step 3: Phased Rollout
- Migrate by location groups
- 25% → 50% → 75% → 100%
- Monitor performance
- Quick rollback capability

### Step 4: Deprecation
- Announce end-of-life for old system
- Final data migration
- Archive old system
- Remove hardcoded templates

## Success Metrics

1. **Adoption Rate**: 90% of contractors using within 30 days
2. **Completion Rate**: Maintain or improve current 95%+ rate
3. **Time Savings**: 20% reduction in checklist completion time
4. **Quality Score**: 10% improvement in quality metrics
5. **Issue Detection**: 30% faster issue identification
6. **Cost Reduction**: 15% reduction in supplies waste

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Comprehensive backups, parallel running |
| Contractor resistance | Medium | Training program, gradual rollout |
| Performance degradation | High | Load testing, caching, optimization |
| Integration failures | Medium | API versioning, fallback mechanisms |
| Compliance issues | High | Legal review, audit trails |

## Budget Considerations

- **Development**: 8 weeks @ 2 developers
- **Testing**: 2 weeks dedicated QA
- **Training**: Materials and sessions for contractors
- **Infrastructure**: Potential database upgrades
- **Support**: Increased support during rollout

## Next Steps

1. **Stakeholder Approval**: Review plan with management
2. **Contractor Feedback**: Survey current contractors for requirements
3. **Technical Spike**: Prototype template builder UI
4. **Database Design Review**: DBA review of schema
5. **Create Detailed Project Plan**: Break down into sprint tasks

## Conclusion

This implementation will transform the checklist system from a simple task tracker to a comprehensive facility management platform, enabling better contractor management, quality control, and operational insights while maintaining the current system's ease of use.