# NinjaOne Dynamic Script Integration Plan

## Problem Statement
Currently, NinjaOne scripts are hardcoded in ClubOS. When new scripts are created in NinjaOne, they must be manually added to the codebase. This creates maintenance overhead and delays.

## Proposed Solution: Dynamic Script Registry

### Architecture Overview

```
NinjaOne API → ClubOS Database → Admin UI → Dynamic Buttons
     ↓              ↓                ↓           ↓
  Scripts List   Script Registry   Manage     Execute
```

## Implementation Plan

### Phase 1: Database Schema

Create tables to store NinjaOne scripts and their configurations:

```sql
-- Store NinjaOne scripts
CREATE TABLE ninjaone_scripts (
  id SERIAL PRIMARY KEY,
  ninjaone_script_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  description TEXT,
  category VARCHAR(100), -- 'trackman', 'system', 'network', 'custom'
  icon VARCHAR(50), -- lucide icon name
  requires_bay BOOLEAN DEFAULT true,
  requires_location BOOLEAN DEFAULT true,
  parameters JSONB, -- expected parameters
  warning_message TEXT, -- show before execution
  estimated_duration VARCHAR(50), -- '30-60 seconds'
  is_critical BOOLEAN DEFAULT false, -- requires extra confirmation
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_synced_at TIMESTAMP
);

-- Store device-script compatibility
CREATE TABLE ninjaone_script_devices (
  id SERIAL PRIMARY KEY,
  script_id INTEGER REFERENCES ninjaone_scripts(id),
  device_type VARCHAR(50), -- 'trackman', 'music', 'tv', 'all'
  location VARCHAR(100), -- specific location or 'all'
  UNIQUE(script_id, device_type, location)
);

-- Store script execution history
CREATE TABLE ninjaone_executions (
  id SERIAL PRIMARY KEY,
  script_id INTEGER REFERENCES ninjaone_scripts(id),
  ninjaone_job_id VARCHAR(255),
  device_id VARCHAR(255),
  location VARCHAR(100),
  bay_number VARCHAR(10),
  initiated_by VARCHAR(255),
  status VARCHAR(50),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  result JSONB
);

-- Store custom button configurations
CREATE TABLE ninjaone_quick_actions (
  id SERIAL PRIMARY KEY,
  script_id INTEGER REFERENCES ninjaone_scripts(id),
  position INTEGER, -- order on page
  color VARCHAR(20), -- 'red', 'yellow', 'green'
  size VARCHAR(20), -- 'small', 'medium', 'large'
  show_on_dashboard BOOLEAN DEFAULT false,
  role_required VARCHAR(50) DEFAULT 'operator',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Phase 2: NinjaOne Script Sync Service

Create a service to fetch and sync scripts from NinjaOne:

```typescript
// backend/src/services/ninjaoneSync.ts
class NinjaOneSyncService {
  async syncScripts() {
    // 1. Fetch all scripts from NinjaOne API
    const scripts = await this.fetchNinjaOneScripts();
    
    // 2. For each script, update or create in database
    for (const script of scripts) {
      await this.upsertScript(script);
    }
    
    // 3. Mark inactive scripts not returned by API
    await this.markInactiveScripts(scripts);
  }
  
  async fetchNinjaOneScripts() {
    // GET /v2/scripts from NinjaOne API
    // Returns list of available scripts with IDs and metadata
  }
  
  async getScriptDetails(scriptId: string) {
    // GET /v2/script/{scriptId} for full details
    // Including parameters and requirements
  }
}
```

### Phase 3: Admin Management Interface

Create admin pages for script management:

```typescript
// frontend/src/pages/admin/ninjaone-scripts.tsx
- List all synced scripts
- Enable/disable scripts
- Set display names and descriptions
- Configure warnings and confirmations
- Assign icons and categories
- Create quick action buttons
- Test script execution
```

### Phase 4: Dynamic Execution System

Replace hardcoded buttons with dynamic generation:

```typescript
// frontend/src/components/DynamicNinjaActions.tsx
export function DynamicNinjaActions({ location, bayNumber }) {
  const { scripts, loading } = useNinjaOneScripts({ location, bayNumber });
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {scripts.map(script => (
        <ActionButton
          key={script.id}
          script={script}
          onClick={() => executeScript(script.id)}
          icon={getIcon(script.icon)}
          color={script.is_critical ? 'red' : 'blue'}
        />
      ))}
    </div>
  );
}
```

### Phase 5: Auto-Discovery Features

Advanced features for automatic script categorization:

1. **Script Name Pattern Recognition**
   - "Restart-*" → Category: restart
   - "*-TrackMan-*" → Device: trackman
   - "*-Emergency-*" → Critical: true

2. **Parameter Detection**
   - Analyze script parameters to determine requirements
   - Auto-configure which inputs are needed

3. **Smart Grouping**
   - Group related scripts together
   - Create dropdown menus for similar actions

## API Endpoints

### New Endpoints Needed

```typescript
// Sync scripts from NinjaOne
POST /api/admin/ninjaone/sync

// Get all available scripts
GET /api/ninjaone/scripts
Query params:
  - location
  - deviceType
  - category
  - active

// Get script details
GET /api/ninjaone/scripts/:id

// Execute a script
POST /api/ninjaone/scripts/:id/execute
Body: {
  location,
  bayNumber,
  parameters
}

// Update script configuration
PUT /api/admin/ninjaone/scripts/:id
Body: {
  display_name,
  description,
  category,
  icon,
  warning_message,
  is_critical,
  is_active
}

// Manage quick actions
POST /api/admin/ninjaone/quick-actions
PUT /api/admin/ninjaone/quick-actions/:id
DELETE /api/admin/ninjaone/quick-actions/:id
```

## Migration Strategy

### Step 1: Backward Compatibility
- Keep existing hardcoded scripts working
- Add feature flag for dynamic scripts

### Step 2: Gradual Migration
```typescript
// Use hybrid approach
const scripts = [
  ...hardcodedScripts, // existing
  ...dynamicScripts   // from database
];
```

### Step 3: Full Migration
- Move all scripts to database
- Remove hardcoded configuration
- Delete old script mapping files

## Benefits

1. **No Code Changes for New Scripts**
   - Create script in NinjaOne
   - Sync to ClubOS
   - Configure in admin UI
   - Ready to use

2. **Flexible UI Management**
   - Admins can reorganize buttons
   - Create custom quick actions
   - Hide/show based on role

3. **Better Tracking**
   - Full execution history
   - Success/failure rates
   - Usage analytics

4. **Reduced Maintenance**
   - No deployments for script changes
   - Instant updates
   - Version control in NinjaOne

## Security Considerations

1. **Script Validation**
   - Verify script exists in NinjaOne before execution
   - Check user permissions per script
   - Log all executions

2. **Rate Limiting**
   - Limit script executions per minute
   - Prevent script spamming
   - Alert on unusual activity

3. **Approval Workflow** (Optional)
   - Require approval for critical scripts
   - Two-person rule for destructive actions
   - Audit trail for compliance

## Implementation Timeline

- **Week 1**: Database schema and migrations
- **Week 2**: Sync service and API endpoints
- **Week 3**: Admin UI for script management
- **Week 4**: Dynamic button generation
- **Week 5**: Testing and migration

## Alternative: Semi-Dynamic Approach

If full dynamic integration is too complex, consider a hybrid:

1. **Configuration File** (`ninjaone-config.json`)
```json
{
  "scripts": [
    {
      "id": "SCRIPT_ID_FROM_NINJAONE",
      "name": "Restart TrackMan",
      "category": "trackman",
      "icon": "refresh-cw",
      "requiresBay": true
    }
  ]
}
```

2. **Admin uploads this file** instead of code changes
3. **Simpler but still requires manual updates**

## Recommendation

Implement the full dynamic solution for long-term maintainability. The initial investment will pay off quickly as scripts are added/modified frequently.

## Next Steps

1. Review and approve approach
2. Create database migrations
3. Build sync service
4. Create admin UI
5. Update frontend to use dynamic scripts
6. Test with sample scripts
7. Deploy to production