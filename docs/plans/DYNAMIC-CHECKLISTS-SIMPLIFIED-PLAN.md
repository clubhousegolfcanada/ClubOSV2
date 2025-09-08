# Dynamic Checklists - Simplified Implementation Plan

## Leveraging Existing Systems

### ✅ **Existing Auth/Permission System**
ClubOS already has a robust role-based access control system:

**Current Roles:**
- **Admin**: Full system access, can edit templates
- **Operator**: Operations access, submit checklists
- **Support**: Limited access, view-only for some features
- **Customer**: Customer portal only (blocked from checklists)
- **Kiosk**: Public terminal access

**What We Can Reuse:**
- Authentication middleware (`authenticate`)
- Role guard middleware (`roleGuard`)
- JWT token system with role-based expiration
- User session management
- Permission checking on frontend pages

### 🔄 **Modified Approach: Extend Existing User System**

Instead of creating a separate contractor system, we can:

1. **Add a `company` field to users table**
```sql
ALTER TABLE users 
ADD COLUMN company_id UUID REFERENCES companies(id),
ADD COLUMN assigned_locations TEXT[]; -- Array of location names
```

2. **Create minimal companies table**
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50), -- 'internal', 'contractor', 'vendor'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

3. **Use existing role system**
- Keep using `operator` role for cleaning staff
- Add company filtering to checklist queries
- Show only assigned locations in dropdown

## 📱 **QR Code Updates Needed**

### Current QR Implementation
```typescript
// Current: Links to hardcoded template
`/checklists?category=${category}&type=${type}&location=${location}`
```

### Updated QR Implementation
```typescript
// Future: Link to specific template ID
`/checklists?template=${templateId}&location=${location}`

// Or with company pre-selection
`/checklists?template=${templateId}&location=${location}&company=${companyId}`
```

### QR Code Enhancements
1. **Template-specific QR codes** (not just category/type)
2. **Company branding** in QR code (logo overlay)
3. **Expiring QR codes** for temporary contractors
4. **Tracking QR scans** for analytics

## 🎯 **Simplified Database Schema**

### Core Tables Only

```sql
-- 1. Companies (minimal)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Dynamic Templates
CREATE TABLE checklist_templates_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  company_id UUID REFERENCES companies(id), -- NULL = global template
  locations TEXT[], -- Array of applicable locations, NULL = all
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Template Tasks
CREATE TABLE template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES checklist_templates_v2(id) ON DELETE CASCADE,
  task_text VARCHAR(500) NOT NULL,
  position INT NOT NULL,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Update users table
ALTER TABLE users 
ADD COLUMN company_id UUID REFERENCES companies(id),
ADD COLUMN assigned_locations TEXT[];
```

## 🚀 **Phased Implementation (Simplified)**

### Phase 1: Database Layer (Week 1)
1. Create new tables
2. Add company_id to users
3. Migrate hardcoded templates to database
4. Keep existing submission table (just add template_id)

### Phase 2: Template Management UI (Week 2)
1. Admin page to create/edit templates
2. Simple drag-drop for task ordering
3. Clone existing templates
4. Assign templates to locations/companies

### Phase 3: Update Checklist Flow (Week 3)
1. Load templates from database
2. Filter by user's company and location
3. Update QR code generation
4. Maintain existing submission process

### Phase 4: Company Management (Week 4)
1. Simple company CRUD for admins
2. Assign users to companies
3. Location assignment per user
4. Basic reporting by company

## 🔧 **Minimal Changes to Existing Code**

### Backend Changes
```typescript
// checklists.ts - Replace hardcoded templates with:
router.get('/template/:category/:type', async (req, res) => {
  const { category, type } = req.params;
  const { location } = req.query;
  const userCompanyId = req.user.companyId;
  
  // Load from database instead of CHECKLIST_TEMPLATES
  const template = await db.query(`
    SELECT * FROM checklist_templates_v2 
    WHERE category = $1 AND type = $2
    AND (company_id = $3 OR company_id IS NULL)
    AND ($4 = ANY(locations) OR locations IS NULL)
    ORDER BY company_id DESC -- Prefer company-specific
    LIMIT 1
  `, [category, type, userCompanyId, location]);
  
  // Load tasks for template
  const tasks = await db.query(`
    SELECT * FROM template_tasks 
    WHERE template_id = $1 
    ORDER BY position
  `, [template.id]);
  
  res.json({ template, tasks });
});
```

### Frontend Changes
```typescript
// ChecklistSystem.tsx - Update QR generation:
const generateQrCode = async () => {
  const params = new URLSearchParams({
    template: selectedTemplateId, // Use template ID
    location: selectedQrLocation,
    company: user.companyId // Include company if needed
  });
  
  const checklistUrl = `${window.location.origin}/checklists?${params}`;
  // ... rest of QR generation
};
```

## 📊 **Permissions Matrix Update**

| Feature | Admin | Operator (Internal) | Operator (Contractor) | Support |
|---------|-------|-------------------|---------------------|---------|
| View all templates | ✅ | ✅ | ❌ (company only) | ✅ |
| Create templates | ✅ | ❌ | ❌ | ❌ |
| Edit templates | ✅ | ❌ | ❌ | ❌ |
| Submit checklists | ✅ | ✅ | ✅ | ❌ |
| View all submissions | ✅ | ✅ | ❌ (company only) | ✅ |
| Delete submissions | ✅ | ✅ | ❌ | ❌ |
| Manage companies | ✅ | ❌ | ❌ | ❌ |

## 🎯 **Benefits of This Approach**

1. **Minimal disruption** to existing system
2. **Reuses existing auth** infrastructure
3. **Gradual migration** possible
4. **No new role system** needed
5. **Backwards compatible** with current checklists
6. **Simple company management** without complex multi-tenancy

## 📝 **Migration Script Example**

```sql
-- Migrate existing hardcoded templates to database
INSERT INTO checklist_templates_v2 (name, category, type, locations, active)
VALUES 
  ('Daily Cleaning', 'cleaning', 'daily', NULL, true),
  ('Weekly Cleaning', 'cleaning', 'weekly', NULL, true),
  ('Quarterly Cleaning', 'cleaning', 'quarterly', NULL, true),
  ('Weekly Tech', 'tech', 'weekly', NULL, true),
  ('Quarterly Tech', 'tech', 'quarterly', NULL, true);

-- Then insert tasks for each template from the hardcoded arrays
```

## 🔄 **Rollback Strategy**

1. Keep `CHECKLIST_TEMPLATES` constant as fallback
2. Feature flag to switch between database/hardcoded
3. Parallel run both systems initially
4. Easy revert by switching feature flag

## ⏱️ **Timeline: 4 Weeks Total**
- **Week 1**: Database setup and migration
- **Week 2**: Template management UI
- **Week 3**: Update checklist flow
- **Week 4**: Company management and testing

This simplified approach leverages your existing systems while adding the flexibility you need for multiple companies and locations.