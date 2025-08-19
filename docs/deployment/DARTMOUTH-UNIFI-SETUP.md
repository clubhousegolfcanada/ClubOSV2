# Dartmouth UniFi Access Setup

## Quick Info
- **Console ID**: `0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302`
- **Direct Link**: [Dartmouth UniFi Access Console](https://unifi.ui.com/consoles/0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302/access/dashboard)

## Setup Steps

### 1. Add Cloud Credentials to `.env`
```env
# UniFi Cloud Access
UNIFI_CLOUD_USERNAME=your-ubiquiti-email@example.com
UNIFI_CLOUD_PASSWORD=your-password
UNIFI_CONSOLE_ID=0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302
```

### 2. Get Door IDs
Run the test script to discover door IDs:
```bash
cd ClubOSV1-backend
npx tsx scripts/test-dartmouth-doors.ts
```

This will list all doors and their IDs.

### 3. Configure Door IDs
Add the actual door IDs to `.env`:
```env
# Dartmouth Door IDs (get these from step 2)
DARTMOUTH_MAIN_DOOR_ID=<actual-door-id>
DARTMOUTH_STAFF_DOOR_ID=<actual-door-id>
DARTMOUTH_BAY_DOOR_ID=<actual-door-id>
DARTMOUTH_EMERGENCY_DOOR_ID=<actual-door-id>
```

### 4. Test the Connection
```bash
npm run test:unifi-cloud
```

## API Endpoints

The Dartmouth console uses these endpoints:
- **Base URL**: `https://unifi.ui.com/proxy/consoles/[CONSOLE_ID]/access`
- **Authentication**: `/api/v1/developer/login`
- **List Doors**: `/api/v1/developer/doors`
- **Unlock Door**: `/api/v1/developer/doors/{id}/unlock`
- **Door Status**: `/api/v1/developer/doors/{id}`

## Troubleshooting

### Can't Connect?
1. **Check credentials**: Try logging in at https://unifi.ui.com
2. **Verify access**: Make sure your account has access to the Dartmouth console
3. **Remote access**: Ensure Remote Access is enabled in UniFi settings

### Can't Find Door IDs?
1. Run: `npx tsx scripts/test-dartmouth-doors.ts`
2. Or manually check: https://unifi.ui.com/consoles/[CONSOLE_ID]/access/doors
3. Click on each door to see its ID/MAC address

### Authentication Fails?
- Check if 2FA is enabled on your Ubiquiti account
- You might need an app-specific password
- Verify credentials work at https://unifi.ui.com

## Testing Individual Doors

Once configured, test specific doors:
```javascript
// Test unlock Dartmouth staff door
await unifiCloudService.unlockDoor('Dartmouth', 'staff-door', 30);

// Get Dartmouth door status
const status = await unifiCloudService.getDoorStatus('Dartmouth');
```

## Security Notes
- Never commit credentials to git
- Use environment variables only
- All door actions are logged
- Slack notifications sent for door unlocks

## Support
- UniFi Access Help: https://help.ui.com
- Check logs: `tail -f logs/app.log`
- Database logs: `SELECT * FROM door_access_log WHERE location='Dartmouth'`

---
**Status**: Ready for configuration
**Console ID**: Confirmed for Dartmouth location
**Next Step**: Add credentials and discover door IDs