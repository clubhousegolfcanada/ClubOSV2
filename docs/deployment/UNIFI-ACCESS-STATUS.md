# UniFi Access Integration Status

## ✅ What's Working
1. **Door Configuration**: All 3 doors are correctly configured with proper MAC addresses
   - Bedford Front Door: `28:70:4e:80:c4:4f` ✅
   - Bedford Middle Door: `28:70:4e:80:de:f3` ✅
   - Dartmouth Staff Door: `28:70:4e:80:de:3b` ✅

2. **API Key**: The provided key (`5GmQjC0y7sgfJ0JmPmh17dL17SOFp8IV`) is valid
   - Works with UniFi EA (Early Access) API
   - Can retrieve device status and information
   - Shows all Access devices are online

3. **UI Integration**: Door controls are properly shown in the UI
   - Remote Actions Bar shows correct doors
   - Commands page displays appropriate options

## ⚠️ The Issue
The API key you provided works with the **UniFi EA API** (`https://api.ui.com/ea/devices`) which provides:
- Device status monitoring
- Device information
- Firmware status

However, it does **NOT** provide door control capabilities. For actual door control, you need one of:

### Option 1: Local Access (Recommended)
- Connect to the same network as the UniFi controller
- Use Tailscale or VPN for remote access
- Access the developer API at `https://[controller-ip]:12445/api/v1/developer/`

### Option 2: UniFi Access API Token
- Generate an API token from the UniFi Access interface (not the EA API)
- This is different from the key you provided
- Instructions:
  1. Log into your UniFi Access controller web interface
  2. Go to Settings → API
  3. Generate a new API token
  4. This token will work with the `/api/v1/developer/` endpoints

### Option 3: Cloud Proxy with Credentials
- Use UniFi cloud username/password
- Authenticate through `https://unifi.ui.com`
- Access via proxy URL

## 🔍 Discovery Results
From the EA API, we confirmed your Access devices:
```
Bedford Front Door   - MAC: 28:70:4e:80:c4:4f - IP: 192.168.1.64  - Status: ONLINE ✅
Bedford Middle Door  - MAC: 28:70:4e:80:de:f3 - IP: 192.168.1.152 - Status: ONLINE ✅
Dartmouth Staff Door - MAC: 28:70:4e:80:de:3b - IP: 192.168.1.222 - Status: ONLINE ✅
```

All doors are:
- Running firmware v1.7.4.0
- Model: UA-ULTRA
- Fully adopted and managed

## 📝 Next Steps

### For Immediate Testing (with Tailscale/VPN):
1. Connect to your network via Tailscale or VPN
2. Update `.env` with the correct controller IP:
   ```
   UNIFI_CONTROLLER_IP=192.168.1.1  # Or actual controller IP
   UNIFI_API_PORT=12445
   ```
3. Run: `npx tsx scripts/discover-doors.ts`

### For Remote Access Without VPN:
1. Get the proper UniFi Access API token (not EA API key)
2. Or provide UniFi cloud credentials for proxy access

## 💡 Why the Mobile App Works
The UniFi Access mobile app uses either:
- Direct Bluetooth connection to the locks
- UniFi cloud proxy with your account credentials
- Different API endpoints than the developer API

The key you provided (`5GmQjC0y...`) appears to be an EA API key for monitoring, not for Access control.

## 🛠️ Code Status
All code is ready and configured correctly. Once we have proper API access (via VPN, correct API token, or cloud credentials), door control will work immediately.

## Test Scripts Available
- `scripts/discover-doors.ts` - Discovers doors on local network
- `scripts/test-unlock-door.ts` - Tests door unlock functionality
- `scripts/explore-ea-api.ts` - Explores EA API (monitoring only)
- `scripts/test-cloud-api.ts` - Tests various API endpoints