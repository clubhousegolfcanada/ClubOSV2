# UniFi Access Setup Guide

## Prerequisites
- UniFi Access version 1.9.2 or higher
- Admin access to your UniFi controller

## Step 1: Enable Remote Access
This allows you to control doors from anywhere without VPN.

1. Log into your UniFi controller
2. Navigate to **UniFi Dashboard > Settings > System > Remote Access**
3. Enable **Remote Access**
4. Save the settings

## Step 2: Generate Access API Token
This token will have proper door control permissions.

1. In your UniFi controller, go to **Applications > Access**
2. Navigate to **Settings > Security > Advanced**
3. Click **Generate Access API Token**
4. Copy the token (it will only be shown once!)
5. Download the API documentation for your controller version

## Step 3: Configure ClubOS

### Update your `.env` file:
```env
# Add your Access API token
UNIFI_ACCESS_API_TOKEN=your_token_here

# Enable remote access (since you enabled it in Step 1)
UNIFI_USE_REMOTE_ACCESS=true

# Your console ID (already configured)
UNIFI_CONSOLE_ID=0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302
```

## Step 4: Test the Connection

Run the test script:
```bash
cd ClubOSV1-backend
npx tsx scripts/test-access-api.ts
```

You should see:
- ✅ Successful connection to Access API
- ✅ List of doors found
- ✅ Successful unlock test

## How It Works

With Remote Access enabled and the Access API token:
1. Your API calls go through UniFi's cloud proxy
2. The cloud proxy forwards requests to your controller
3. The Access API token provides proper door control permissions
4. No VPN or local network access needed!

## API Endpoints

The official Access API provides these endpoints:
- `/api/v1/developer/doors` - List and control doors
- `/api/v1/developer/door_groups` - Manage door groups
- `/api/v1/developer/visitors` - Manage visitor access
- `/api/v1/developer/devices` - Access device management

### Door Control Operations:
- **Unlock**: `POST /api/v1/developer/doors/{doorId}/unlock`
- **Lock**: `POST /api/v1/developer/doors/{doorId}/lock`
- **Status**: `GET /api/v1/developer/doors/{doorId}`

## Troubleshooting

### "Connection refused" or timeout errors
- Verify Remote Access is enabled in UniFi settings
- Check that your console ID is correct
- Ensure the Access API token was generated (not the EA API key)

### "401 Unauthorized" errors
- The token may have expired
- Generate a new Access API token
- Make sure you copied the entire token

### Doors not appearing
- Verify doors are adopted in UniFi Access
- Check that doors show as online in the Access app
- Ensure your Access version is 1.9.2+

## Security Notes
- The Access API token has full control permissions
- Store it securely and never commit it to git
- Tokens don't expire but can be revoked in Access settings
- Each token is tied to your controller version

## Current Door Configuration
Your doors are already configured with the correct MACs:
- **Bedford Front Door**: `28:70:4e:80:c4:4f`
- **Bedford Middle Door**: `28:70:4e:80:de:f3`
- **Dartmouth Staff Door**: `28:70:4e:80:de:3b`

Once you add the Access API token, door control will work immediately!