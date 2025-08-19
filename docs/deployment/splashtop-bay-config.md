# Splashtop Bay-Specific Remote Desktop Configuration

## Implementation Plan

### Option 1: Using MAC Address Deep Links (Recommended)
For direct connection to specific computers using the Splashtop Business app.

#### URL Format
```
st-business://com.splashtop.business?account=YOUR_EMAIL&mac=COMPUTER_MAC_ADDRESS
```

#### Requirements
1. Splashtop Business app installed and logged in with "Stay logged in" enabled
2. MAC addresses of each bay computer
3. All computers must have Splashtop Streamer installed and configured

### Option 2: Web Portal with Computer Names
Using the web portal but with clear naming conventions.

#### Setup Steps
1. Name each computer clearly in Splashtop:
   - Bedford Bay 1 PC
   - Bedford Bay 2 PC
   - Dartmouth Bay 1 PC
   - etc.

2. Users click bay-specific button → Opens my.splashtop.com → Select correct computer

### Option 3: Hybrid Approach (Best UX)
Combine both methods with intelligent fallback:

```javascript
const bayComputers = {
  'Bedford': {
    '1': { mac: 'XX:XX:XX:XX:XX:01', name: 'Bedford Bay 1 PC' },
    '2': { mac: 'XX:XX:XX:XX:XX:02', name: 'Bedford Bay 2 PC' },
    '3': { mac: 'XX:XX:XX:XX:XX:03', name: 'Bedford Bay 3 PC' },
    '4': { mac: 'XX:XX:XX:XX:XX:04', name: 'Bedford Bay 4 PC' }
  },
  'Dartmouth': {
    '1': { mac: 'XX:XX:XX:XX:XX:11', name: 'Dartmouth Bay 1 PC' },
    '2': { mac: 'XX:XX:XX:XX:XX:12', name: 'Dartmouth Bay 2 PC' },
    '3': { mac: 'XX:XX:XX:XX:XX:13', name: 'Dartmouth Bay 3 PC' },
    '4': { mac: 'XX:XX:XX:XX:XX:14', name: 'Dartmouth Bay 4 PC' }
  },
  // ... other locations
};
```

## Data Collection Needed

To implement this feature, we need:

1. **Splashtop Account Email** - The email used for Splashtop Business account
2. **MAC Addresses** - For each bay computer at each location
3. **Computer Names** - Current names in Splashtop dashboard

### How to Get MAC Addresses

#### Windows:
1. Open Command Prompt on each bay computer
2. Run: `ipconfig /all`
3. Look for "Physical Address" under the active network adapter
4. Format: Remove dashes (e.g., `C0-4A-00-1C-72-EC` becomes `C04A001C72EC`)

#### From Splashtop Console:
1. Log into my.splashtop.com
2. Go to Computers tab
3. Click on computer details
4. MAC address should be visible in computer information

## Implementation in ClubOS

### Database Schema
```sql
-- Add to existing database
CREATE TABLE IF NOT EXISTS bay_computers (
  id SERIAL PRIMARY KEY,
  location VARCHAR(100) NOT NULL,
  bay_number VARCHAR(10) NOT NULL,
  computer_name VARCHAR(255),
  mac_address VARCHAR(17),
  splashtop_id VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(location, bay_number)
);
```

### UI Integration Points

1. **Commands Page** - Add "Remote Desktop" button next to each bay's reset button
2. **Dashboard** - Quick access buttons for frequently accessed bays
3. **Settings** - Admin panel to configure MAC addresses and computer names

### Security Considerations

1. MAC addresses should be stored encrypted in database
2. Only show full MAC to admin users
3. Consider using environment variables for Splashtop account email
4. Audit log all remote desktop access attempts

## Testing Plan

1. **Phase 1**: Test with one bay at Bedford location
2. **Phase 2**: Roll out to all Bedford bays
3. **Phase 3**: Deploy to all locations

## Alternative Solutions

### Splashtop API Integration
If Splashtop offers API access, we could:
1. Authenticate via API
2. Get list of computers programmatically
3. Generate session tokens for direct access
4. Embed remote desktop directly in ClubOS (if supported)

### TeamViewer or Alternative
Consider alternatives that might offer better deep linking:
- TeamViewer has documented deep link support
- AnyDesk supports custom URLs
- Chrome Remote Desktop has web-based access

## Next Steps

1. Collect MAC addresses for all bay computers
2. Verify Splashtop Business app URL scheme works
3. Implement database storage for computer configuration
4. Add UI buttons to Commands page
5. Test on multiple platforms (iOS, Android, Desktop)