# Location Management UI Plan

## Overview
Plan for adding location management functionality to ClubOS, allowing admins to add/remove locations, configure bays, and manage devices dynamically.

## Database Schema

### Locations Table
```sql
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'America/Halifax',
  bay_count INTEGER DEFAULT 0,
  has_music_system BOOLEAN DEFAULT false,
  has_tv_system BOOLEAN DEFAULT false,
  has_door_access BOOLEAN DEFAULT false,
  opening_time TIME DEFAULT '09:00',
  closing_time TIME DEFAULT '23:00',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update ninjaone_devices to reference locations
ALTER TABLE ninjaone_devices 
ADD COLUMN location_id INTEGER REFERENCES locations(id);

-- Migrate existing location data
INSERT INTO locations (name, bay_count, has_music_system, has_tv_system)
SELECT DISTINCT 
  location as name,
  COUNT(CASE WHEN device_type = 'trackman' THEN 1 END) as bay_count,
  MAX(CASE WHEN device_type = 'music' THEN 1 ELSE 0 END)::boolean as has_music_system,
  MAX(CASE WHEN device_type = 'tv' THEN 1 ELSE 0 END)::boolean as has_tv_system
FROM ninjaone_devices
GROUP BY location;
```

## UI Implementation

### Location Management Page
**Path**: `/admin/locations`
**Access**: Admin only

#### Features:

1. **Location List View**
   - Table showing all locations
   - Active/inactive status
   - Bay count
   - Available systems (music, TV, door)
   - Edit/Delete actions

2. **Add Location Form**
   ```typescript
   interface LocationForm {
     name: string;
     address: string;
     phone: string;
     email: string;
     timezone: string;
     bayCount: number;
     hasMusicSystem: boolean;
     hasTvSystem: boolean;
     hasDoorAccess: boolean;
     openingTime: string;
     closingTime: string;
   }
   ```

3. **Edit Location**
   - Update all location details
   - Add/remove bays
   - Configure systems
   - Set operating hours

4. **Device Assignment**
   - After adding location, prompt to:
     - Run NinjaOne device sync
     - Assign devices to bays
     - Configure door access

### Integration Points

1. **NinjaOne Integration**
   - When adding a location:
     - Create device placeholders
     - Prompt to install NinjaOne agents
     - Auto-detect new devices
     - Map devices to location/bays

2. **Ubiquiti UniFi Access Integration**
   - Configure UniFi Access controller per location
   - Map UniFi door IDs to location
   - Set access policies and schedules
   - Configure Cloudflare tunnel if needed

3. **System Components Updates**
   - Dashboard: Show new locations
   - Commands: Include new locations
   - Remote Actions Bar: Dynamic location list
   - Messages: Location-based routing

### API Endpoints

```typescript
// Location management
GET    /api/admin/locations           // List all locations
POST   /api/admin/locations           // Create location
PUT    /api/admin/locations/:id       // Update location
DELETE /api/admin/locations/:id       // Delete location

// Bay management
POST   /api/admin/locations/:id/bays  // Add bays
DELETE /api/admin/locations/:id/bays/:bayNumber // Remove bay

// Device assignment
POST   /api/admin/locations/:id/devices // Assign devices
PUT    /api/admin/locations/:id/devices/:deviceId // Update device assignment
```

### UI Components

```typescript
// LocationManagement.tsx
export const LocationManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <LocationList />
      <AddLocationButton />
      <LocationEditModal />
      <DeviceAssignmentModal />
    </div>
  );
};

// AddLocationWizard.tsx
export const AddLocationWizard: React.FC = () => {
  const steps = [
    'Basic Information',
    'Configure Bays',
    'System Features',
    'Device Setup',
    'Review & Create'
  ];
  
  return <MultiStepForm steps={steps} />;
};
```

### Workflow for Adding New Location

1. **Admin clicks "Add Location"**
2. **Enter basic info** (name, address, contact)
3. **Configure bays** (number of simulator bays)
4. **Select systems** (music, TV, door access)
5. **Create location** in database
6. **Device setup wizard**:
   - Install NinjaOne agents on PCs
   - Run device sync
   - Map devices to bays
   - Test connections
7. **Configure integrations**:
   - Ubiquiti UniFi Access doors
   - Skedda booking
   - HubSpot CRM
8. **Activate location**

### Benefits

1. **No code changes** for new locations
2. **Self-service** location setup
3. **Automatic UI updates** across system
4. **Centralized configuration**
5. **Easy deactivation** for maintenance

### Migration Strategy

1. **Phase 1**: Create locations table, migrate existing data
2. **Phase 2**: Add location management UI
3. **Phase 3**: Update all components to use dynamic locations
4. **Phase 4**: Remove hardcoded location references

### Security Considerations

- Admin-only access for location management
- Audit logging for all changes
- Validation of device assignments
- Prevent deletion of active locations with bookings

### Implementation Timeline

- **Week 1**: Database schema and migrations
- **Week 2**: API endpoints and backend logic
- **Week 3**: Location management UI
- **Week 4**: Integration with existing components
- **Week 5**: Testing and migration

### Alternative: Simple Configuration File

If full UI is too complex, use a simpler approach:

1. **locations.json** configuration file
2. Upload through admin UI
3. Validates and updates database
4. Still dynamic but less UI work

```json
{
  "locations": [
    {
      "name": "Bedford",
      "bays": 2,
      "systems": ["music", "tv", "door"],
      "address": "123 Bedford Highway",
      "hours": "9:00-23:00"
    }
  ]
}
```

## Recommendation

Implement the full UI solution for maximum flexibility and ease of use. The investment will pay off as locations are added/modified over time.