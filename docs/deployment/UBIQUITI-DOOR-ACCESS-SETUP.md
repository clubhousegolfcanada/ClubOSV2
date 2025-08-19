# Ubiquiti Door Access Setup Guide

## Overview
ClubOS integrates with Ubiquiti UniFi Access to control doors at all locations. Staff can unlock doors remotely through the ClubOS interface, making it easy to grant access to employees and (in the future) customers.

## Current Status
✅ **Bedford Staff Door** - Ready to use
✅ **Dartmouth Staff Door** - Ready to use
🔄 **Main Entrance Doors** - Configured, pending future customer access implementation

## Features Available Now

### For Staff (Operators & Admins)
- **Remote Unlock**: Unlock any configured door for 30 seconds
- **Door Status**: View real-time status of all doors (locked/unlocked, online/offline)
- **Access Logs**: Track who unlocked which door and when
- **Emergency Controls**: Admins can unlock all doors in emergency situations

### Locations Configured
1. **Bedford**
   - Main Entrance (future customer access)
   - Staff Door ✅
   - Emergency Exit

2. **Dartmouth**  
   - Main Entrance (future customer access)
   - Staff Door ✅
   - Bay Access Door
   - Emergency Exit

3. **Stratford**
   - Main Entrance
   - Staff Door
   - Emergency Exit

4. **Bayers Lake**
   - Main Entrance
   - Staff Door
   - Loading Door
   - Emergency Exit

5. **Truro**
   - Main Entrance
   - Staff Door
   - Emergency Exit

## Setup Instructions

### 1. Configure UniFi Access Controller

1. Log into your UniFi Access controller
2. Navigate to Doors section
3. Note the MAC address or ID for each door
4. Set up API access credentials

### 2. Configure Environment Variables

Add these to your `.env` file on the backend:

```env
# UniFi Access Controller
UNIFI_CONTROLLER_URL=https://your-unifi-controller-url
UNIFI_USERNAME=your-unifi-username
UNIFI_PASSWORD=your-unifi-password

# Bedford Door IDs
BEDFORD_MAIN_DOOR_ID=actual-mac-address-from-unifi
BEDFORD_STAFF_DOOR_ID=actual-mac-address-from-unifi
BEDFORD_EMERGENCY_DOOR_ID=actual-mac-address-from-unifi

# Dartmouth Door IDs
DARTMOUTH_MAIN_DOOR_ID=actual-mac-address-from-unifi
DARTMOUTH_STAFF_DOOR_ID=actual-mac-address-from-unifi
DARTMOUTH_BAY_DOOR_ID=actual-mac-address-from-unifi
DARTMOUTH_EMERGENCY_DOOR_ID=actual-mac-address-from-unifi

# Optional: Configure unlock durations
DEFAULT_UNLOCK_DURATION=30  # seconds
MAX_UNLOCK_DURATION=300     # 5 minutes max
EMERGENCY_UNLOCK_DURATION=60 # for emergency unlock all
```

### 3. Test the Integration

1. **Check Connection Status**
   - The system will show "[DEMO]" prefix if not connected to UniFi
   - When properly configured, doors will show real-time status

2. **Test Staff Door Unlock**
   - Log in as an operator or admin
   - Open Remote Actions bar at bottom of screen
   - Find your location
   - Click "Unlock" next to Staff Door
   - Door should unlock for 30 seconds

3. **Verify Logging**
   - Check Slack #tech-actions-log channel for notifications
   - Access logs are stored in database for audit trail

## Using the Feature

### For Employees Opening Staff Doors

1. **From Dashboard**:
   - Click the Remote Actions bar at bottom of screen
   - Find your location
   - Under "Door Access" section, click "Unlock" next to Staff Door
   - Door unlocks for 30 seconds

2. **Mobile Access**:
   - Works perfectly on mobile devices
   - Same interface, optimized for touch

### Door Status Indicators

- 🔒 **Locked** - Door is secure
- 🔓 **Unlocked** - Door is temporarily unlocked
- ⚠️ **Offline** - Door controller not responding
- 🔋 **Battery** - Shows battery level (if applicable)

## Security Features

1. **Role-Based Access**
   - Operators: Can unlock staff doors
   - Admins: Can unlock all doors + emergency functions
   - Other roles: No door access

2. **Audit Logging**
   - Every action logged with timestamp
   - User who initiated action recorded
   - Reason for unlock can be specified
   - Logs stored in `door_access_log` table

3. **Slack Notifications**
   - Non-main door unlocks trigger Slack alerts
   - Emergency actions send urgent notifications

4. **Time Limits**
   - Default unlock: 30 seconds
   - Maximum unlock: 5 minutes
   - Auto-relock after duration expires

## Demo Mode

If UniFi credentials are not configured, the system runs in demo mode:
- Shows simulated door statuses
- Allows testing UI without hardware
- All actions prefixed with "[DEMO]"
- Perfect for development/testing

## Troubleshooting

### Doors Show as Offline
- Check UniFi controller connectivity
- Verify door MAC addresses in .env file
- Check network connection to door controllers

### Can't Unlock Doors
- Verify user role (must be operator or admin)
- Check UniFi credentials in .env
- Look for error messages in logs

### Demo Mode Active When It Shouldn't Be
- Ensure all three UniFi env variables are set:
  - UNIFI_CONTROLLER_URL
  - UNIFI_USERNAME  
  - UNIFI_PASSWORD
- Restart backend after adding credentials

## Future Enhancements

### Phase 2: Customer Access (Planned)
- Customers can unlock front door when arriving
- Integration with booking system
- Time-based access windows
- Mobile app integration

### Phase 3: Advanced Features
- Access schedules for regular customers
- Temporary access codes
- Integration with check-in system
- Multi-factor authentication for sensitive doors

## API Endpoints

All endpoints require authentication:

- `POST /api/door-access/unlock` - Unlock a door
- `POST /api/door-access/lock` - Lock a door  
- `GET /api/door-access/status/:location` - Get door statuses
- `POST /api/door-access/emergency` - Emergency actions
- `GET /api/door-access/logs/:location` - Get access logs
- `GET /api/door-access/doors/:location` - Get configured doors

## Support

For help with setup or issues:
1. Check this documentation
2. Review logs in ClubOS admin panel
3. Contact tech support with:
   - Location and door having issues
   - Error messages from logs
   - Screenshot of door status in UI

## Security Notes

⚠️ **Important Security Practices**:
- Never share UniFi credentials
- Regularly review access logs
- Update door IDs if hardware changes
- Test emergency procedures monthly
- Keep firmware updated on door controllers

---

Last Updated: January 2025
Status: ✅ Ready for Production Use