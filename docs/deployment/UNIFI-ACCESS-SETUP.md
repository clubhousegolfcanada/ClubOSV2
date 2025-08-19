# UniFi Access Integration Setup Guide

## Overview
ClubOS is fully integrated with Ubiquiti UniFi Access for remote door control across all locations. The system supports unlocking/locking doors remotely through both the Commands page and the Remote Actions Bar.

## Current Integration Status
✅ **Backend Service**: UniFi Access service configured and ready
✅ **API Endpoints**: Door control endpoints active at `/api/door-access/*`
✅ **Frontend Integration**: Door controls in both Commands page and Remote Actions Bar
✅ **Demo Mode**: System runs in demo mode when UniFi credentials not configured
⏳ **Waiting For**: UniFi Access controller credentials and door IDs

## Setup Requirements

### 1. UniFi Access Controller
- UniFi Access Hub or Cloud Key with Access installed
- Network connectivity between ClubOS backend and UniFi controller
- Admin credentials for the UniFi Access system

### 2. Door Hardware
Each location should have UniFi Access-compatible door hardware:
- UA Hub or UA Lite for door control
- Compatible locks (electric strike, mag lock, or smart lock)
- Door position sensors (optional but recommended)

## Configuration Steps

### Step 1: Set UniFi Controller Credentials
Add these to your Railway environment variables:

```bash
# UniFi Access Controller Connection
UNIFI_CONTROLLER_URL=https://your-unifi-controller-ip:port
UNIFI_USERNAME=your-admin-username
UNIFI_PASSWORD=your-admin-password
```

### Step 2: Configure Door IDs
Each door in UniFi Access has a unique identifier. Add these to Railway:

#### Bedford Location
```bash
BEDFORD_MAIN_DOOR_ID=<MAC address or ID from UniFi>
BEDFORD_STAFF_DOOR_ID=<MAC address or ID from UniFi>
BEDFORD_EMERGENCY_DOOR_ID=<MAC address or ID from UniFi>
```

#### Dartmouth Location
```bash
DARTMOUTH_MAIN_DOOR_ID=<MAC address or ID from UniFi>
DARTMOUTH_STAFF_DOOR_ID=<MAC address or ID from UniFi>
DARTMOUTH_BAY_DOOR_ID=<MAC address or ID from UniFi>
DARTMOUTH_EMERGENCY_DOOR_ID=<MAC address or ID from UniFi>
```

#### Stratford Location
```bash
STRATFORD_MAIN_DOOR_ID=<MAC address or ID from UniFi>
STRATFORD_STAFF_DOOR_ID=<MAC address or ID from UniFi>
STRATFORD_EMERGENCY_DOOR_ID=<MAC address or ID from UniFi>
```

#### Bayers Lake Location
```bash
BAYERS_MAIN_DOOR_ID=<MAC address or ID from UniFi>
BAYERS_STAFF_DOOR_ID=<MAC address or ID from UniFi>
BAYERS_LOADING_DOOR_ID=<MAC address or ID from UniFi>
BAYERS_EMERGENCY_DOOR_ID=<MAC address or ID from UniFi>
```

#### Truro Location
```bash
TRURO_MAIN_DOOR_ID=<MAC address or ID from UniFi>
TRURO_STAFF_DOOR_ID=<MAC address or ID from UniFi>
TRURO_EMERGENCY_DOOR_ID=<MAC address or ID from UniFi>
```

### Step 3: Configure Unlock Durations (Optional)
```bash
DEFAULT_UNLOCK_DURATION=30      # Default unlock time in seconds
MAX_UNLOCK_DURATION=300         # Maximum allowed unlock duration
EMERGENCY_UNLOCK_DURATION=60    # Duration for emergency unlock all
```

## Finding Door IDs in UniFi Access

1. Log into your UniFi Access controller
2. Navigate to **Devices** section
3. Click on each door device
4. Find the MAC address or Device ID
5. Use this as the door ID in the environment variables

## Door Mapping

The system maps doors as follows:

| Location | Door Type | Key Name | Description |
|----------|-----------|----------|-------------|
| All | Main Entrance | `main-entrance` | Primary customer entrance |
| All | Staff Door | `staff-door` | Employee entrance |
| Dartmouth | Bay Access | `bay-access` | Access to simulator bays |
| Bayers Lake | Loading Door | `loading-door` | Loading/delivery entrance |
| Truro | Emergency Exit | `emergency-exit` | Emergency exit door |

## Features Available

### Commands Page
- **Quick Access Buttons**: 2-3 door unlock buttons per location
- **30-Second Unlock**: Standard unlock duration
- **Visual Feedback**: Loading states and success/error messages
- **Blue Theme**: Door controls highlighted in blue for visibility

### Remote Actions Bar
- **Live Door Status**: Shows locked/unlocked state
- **Individual Control**: Lock/unlock each door separately
- **Emergency Unlock**: Admin-only emergency unlock all doors
- **Status Indicators**: Online/offline and battery status

## API Endpoints

All door control goes through these endpoints:

- `POST /api/door-access/unlock` - Unlock a specific door
- `POST /api/door-access/lock` - Lock a specific door
- `GET /api/door-access/status/:location` - Get status of all doors at location
- `POST /api/door-access/emergency` - Emergency unlock all doors
- `GET /api/door-access/logs/:location` - Get access logs
- `GET /api/door-access/doors/:location` - Get configured doors for location

## Testing

### Demo Mode
When UniFi credentials are not configured, the system runs in demo mode:
- All door actions are simulated
- Random door statuses are generated
- Logs show [DEMO] prefix
- Full UI functionality without hardware

### Production Mode
With UniFi configured:
- Real door control through UniFi Access API
- Live door status updates
- Access logging to database
- Slack notifications for door events

## Troubleshooting

### Doors Not Responding
1. Check UniFi controller connectivity
2. Verify door IDs match UniFi configuration
3. Check Railway logs for connection errors
4. Ensure UniFi user has door control permissions

### Authentication Issues
1. Verify UNIFI_USERNAME and UNIFI_PASSWORD are correct
2. Check if UniFi controller URL includes correct port
3. Ensure no firewall blocking connection
4. Try accessing UniFi controller directly from browser

### Door Status Not Updating
1. Check if door devices are online in UniFi
2. Verify door IDs are correctly mapped
3. Look for WebSocket connection issues
4. Check Railway logs for API errors

## Security Notes

- All door actions are logged to database
- Role-based access control (operator/admin only)
- Emergency actions require admin role
- Slack notifications for non-main door unlocks
- 30-second auto-relock for safety

## Support

For UniFi Access hardware/software issues:
- Ubiquiti Support: https://help.ui.com
- UniFi Access Documentation: https://help.ui.com/hc/en-us/categories/6583256751383

For ClubOS integration issues:
- Check Railway logs
- Contact development team
- Review this documentation

## Next Steps

1. **Install UniFi Access Hardware** at each location
2. **Configure UniFi Controller** with door devices
3. **Add Environment Variables** to Railway
4. **Test Door Controls** in ClubOS
5. **Train Staff** on using door controls