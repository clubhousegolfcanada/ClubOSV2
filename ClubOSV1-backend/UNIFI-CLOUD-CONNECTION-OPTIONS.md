# UniFi Cloud Connection Options

## Your Setup
- **Cloud Console URL**: `https://unifi.ui.com/consoles/[your-console-id]/access/dashboard`
- **Issue**: The `unifi-access` npm package doesn't support UniFi Cloud directly
- **Current Status**: System works in Demo Mode

## Your Options (Ranked by Feasibility)

### Option 1: Enable Local API Access (Recommended)
**Best if you have physical/network access to the controllers**

1. **At each location (Bedford/Dartmouth):**
   - Access the UniFi controller locally
   - Enable "Local Portal" in Settings
   - Note the local IP address (e.g., 192.168.1.100)

2. **Set up secure remote access:**
   - Use a VPN service (like Tailscale, WireGuard, or OpenVPN)
   - Or use port forwarding with dynamic DNS

3. **Update .env:**
   ```env
   # For VPN access
   UNIFI_CONTROLLER_URL=https://192.168.1.100:8443
   
   # For port forwarding
   UNIFI_CONTROLLER_URL=https://bedford.yourdomain.com:8443
   ```

### Option 2: Use UniFi's REST API Directly (Advanced)
**Requires custom implementation**

We would need to:
1. Replace the `unifi-access` npm package
2. Use direct HTTP calls to UniFi's API
3. Handle authentication differently

This would require rewriting the UniFi service to use fetch/axios instead of the npm package.

### Option 3: UniFi Access Mobile SDK
**For mobile/web control**

UniFi offers SDKs for mobile apps that might support cloud access better than the Node.js package.

### Option 4: Use UniFi Webhooks + Commands
**Indirect control**

1. Set up webhooks in UniFi Cloud
2. Create a command queue system
3. Have a local script at each location that polls for commands

### Option 5: Continue with Demo Mode
**Immediate solution**

The system is fully functional in demo mode:
- All features work in the UI
- Staff can see door status (simulated)
- Perfect for training and testing
- No actual door control (yet)

## Recommended Approach

### Short Term (Today):
1. **Use Demo Mode** - System is ready to use
2. Staff can see and test all features
3. Train employees on the interface

### Medium Term (This Week):
1. **Set up Tailscale VPN** (free for personal use)
   - Install Tailscale on the UniFi controller machines
   - Install Tailscale on your ClubOS server
   - Controllers become accessible via stable IPs

2. **Or use Dynamic DNS**:
   - Set up DDNS at each location
   - Forward port 8443 to UniFi controller
   - Use DDNS URLs in configuration

### Example Tailscale Setup:
```bash
# 1. Install Tailscale on each UniFi controller machine
# 2. They get IPs like 100.x.x.x
# 3. Update .env:
UNIFI_CONTROLLER_URL=https://100.64.1.1:8443  # Bedford via Tailscale
# or
UNIFI_CONTROLLER_URL=https://bedford-unifi.tail-scale.ts.net:8443
```

## Configuration for Multiple Sites

Since you have multiple locations, you might need:

```env
# Bedford Controller
BEDFORD_CONTROLLER_URL=https://bedford.local:8443
BEDFORD_USERNAME=admin
BEDFORD_PASSWORD=password

# Dartmouth Controller  
DARTMOUTH_CONTROLLER_URL=https://dartmouth.local:8443
DARTMOUTH_USERNAME=admin
DARTMOUTH_PASSWORD=password
```

We'd need to modify the code to support multiple controllers.

## Action Items

1. **Can you access the UniFi controllers locally at each location?**
   - If yes, we can set up VPN or port forwarding

2. **Do you have IT support at each location?**
   - They could help set up local access

3. **Is there a UniFi admin who manages the system?**
   - They might know if API access is already configured

## For Now

The system is **fully functional in Demo Mode**:
- ✅ All UI features work
- ✅ Door status displays (simulated)
- ✅ Unlock/lock buttons functional
- ✅ Access logs generated
- ✅ Perfect for training staff

Just missing the actual door control, which requires direct controller access.