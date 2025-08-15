# UniFi Cloud Access - Complete Analysis

## Key Findings

### 1. API Key Scope
The API key you provided (`5GmQjC0y7sgfJ0JmPmh17dL17SOFp8IV`) has **read-only** access to:
- ✅ Device information (`/ea/devices`)
- ✅ Host information (`/ea/hosts`) 
- ✅ Site information (`/ea/sites`)
- ❌ No door control capabilities
- ❌ No command execution permissions

### 2. EA API Limitations
The Early Access (EA) API at `api.ui.com/ea/*`:
- Provides device monitoring and status
- Does NOT provide control functions
- No WebSocket/SSE endpoints for commands
- No command/action endpoints available

### 3. Why the Mobile App Works
The UniFi Access mobile app likely uses one of these methods:
1. **OAuth2 flow with full user authentication** - gets a session token with control permissions
2. **Direct Bluetooth connection** to locks when nearby
3. **Different API endpoints** not exposed in the public EA API
4. **UniFi Identity Platform** with proper scope for door control

## The Real Solution

Based on my investigation, you have three viable options:

### Option 1: Get Proper API Credentials
The API key you have is for monitoring only. You need either:
- A UniFi Access API token (from Access controller settings)
- UniFi Cloud credentials (username/password) for full authentication

### Option 2: Use Local Network Access
Since all your doors are online at these IPs:
- Bedford Front Door: `192.168.1.64`
- Bedford Middle Door: `192.168.1.152`
- Dartmouth Staff Door: `192.168.1.222`

You can:
1. Use Tailscale/VPN to connect to the network
2. Access the local API directly at `https://[controller-ip]:12445`
3. Use the developer API with proper authentication

### Option 3: Reverse Engineer Mobile App
If you're determined to use cloud control:
1. Intercept mobile app traffic with a proxy
2. Extract the OAuth token or session cookie
3. Identify the actual control endpoints used

## What's Already Working
✅ All door configurations are correct
✅ Service code is properly structured
✅ Door MACs match actual devices
✅ All doors show as online and healthy
✅ UI properly displays door controls

## What's Missing
The only missing piece is **proper API credentials with door control scope**. The EA API key you provided is essentially a "view-only" key.

## Recommendation
The fastest path forward is to:
1. Log into your UniFi Access controller web interface
2. Navigate to Settings → API
3. Generate a new API token with door control permissions
4. Replace the current API key in your `.env` file

Alternatively, if you have your UniFi account credentials (username/password), we can implement full OAuth authentication to get a session token with proper permissions.

## Technical Note
The UniFi ecosystem has multiple API layers:
- **EA API** (`api.ui.com/ea/*`) - Monitoring only
- **UniFi OS API** (`unifi.ui.com/proxy/`) - Requires authentication
- **Access Developer API** (`/api/v1/developer/`) - Full control with proper token
- **UniFi Identity** (`sso.ui.com`) - OAuth2 authentication

Your current API key only works with the EA API layer, which is why we can see devices but not control them.