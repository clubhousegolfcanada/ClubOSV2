# UniFi Remote Access Setup Guide

## Overview
Since the UniFi Access controllers are at the physical locations (Bedford and Dartmouth), you need to set up remote access. Here are your options:

## Option 1: UniFi Cloud Access (Recommended)
This is the easiest method if your UniFi controllers are connected to the internet.

### Setup:
1. **Enable Remote Access on each UniFi Controller:**
   - Access the controller locally at each location
   - Go to Settings → System → Remote Access
   - Enable "Remote Access"
   - Note the Remote Access URL (usually like: `https://unifi.ui.com`)

2. **Update your .env file:**
   ```env
   # Use UniFi Cloud URL
   UNIFI_CONTROLLER_URL=https://unifi.ui.com
   UNIFI_USERNAME=your-ui-account-email
   UNIFI_PASSWORD=your-ui-account-password
   ```

3. **For Site-specific access:**
   - You might need different site IDs for Bedford and Dartmouth
   - Update UNIFI_SITE_ID accordingly

## Option 2: VPN Access
If you have VPN access to each location's network:

### Setup:
1. **Connect to location VPN**
2. **Use local IP of UniFi controller:**
   ```env
   # Bedford controller (when on Bedford VPN)
   UNIFI_CONTROLLER_URL=https://192.168.1.1
   
   # Dartmouth controller (when on Dartmouth VPN)
   # You might need different configs for each
   ```

## Option 3: Port Forwarding (Less Secure)
Forward the UniFi ports through your router at each location:

### Setup:
1. **At each location's router:**
   - Forward port 8443 to UniFi controller's local IP
   - Use a dynamic DNS service if no static IP

2. **Update .env:**
   ```env
   # Bedford public IP or DDNS
   UNIFI_CONTROLLER_URL=https://bedford.yourdomain.com:8443
   ```

## Option 4: UniFi Hosting Service
Use Ubiquiti's hosting service or a cloud-hosted controller:

### Setup:
1. **Sign up for UniFi Hosting**
2. **Adopt your devices to the hosted controller**
3. **Use the hosted URL in .env**

## Option 5: Multi-Site Controller
If you have one controller managing multiple sites:

### Setup:
```env
# Single controller, multiple sites
UNIFI_CONTROLLER_URL=https://your-main-controller.com
UNIFI_SITE_ID=bedford  # or 'dartmouth' depending on setup
```

## Testing Remote Access

### Quick Test:
```bash
# Test if you can reach the controller
curl -k https://your-controller-url:8443/api/login
```

### Full Test:
```bash
npm run test:unifi
```

## Recommended Setup for ClubOS

Since you have multiple locations, consider:

1. **Use UniFi Cloud (unifi.ui.com)**
   - Easiest to manage
   - No VPN required
   - Works from anywhere

2. **Set up environment variables per location:**
   ```env
   # Option: Use Railway/Vercel environment variables
   # Different configs for production vs development
   ```

3. **For Development/Testing:**
   - Use DEMO mode (no controller configured)
   - All features work, just shows [DEMO] prefix

## Current Status

Based on your setup:
- Controller URL: `https://192.168.1.1` (not accessible remotely)
- Doors configured: Bedford and Dartmouth staff doors
- **Action Needed**: Set up remote access method

## Next Steps

1. **Choose a remote access method** from above
2. **Update UNIFI_CONTROLLER_URL** in .env
3. **Test connection**: `npm run test:unifi`
4. **Restart backend** to apply changes

## Need Help?

Common issues:
- **"Host not reachable"**: You're not on the same network, need remote access
- **"Login failed"**: Check credentials, might need UI account instead
- **"Site not found"**: Check UNIFI_SITE_ID matches your setup

For UniFi Cloud setup help:
1. Visit: https://unifi.ui.com
2. Sign in with your Ubiquiti account
3. Your controllers should appear if remote access is enabled