# UniFi Access - Final Action Plan

## ✅ Your Current Situation
- **Door devices exist** in your Network console
- **Mobile app works** for controlling doors
- **Open to Tailscale** for direct connection
- **Console ID**: `0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302`

## 🎯 Three-Pronged Approach

We'll implement ALL THREE methods for maximum reliability:

### 1️⃣ Immediate: Get Door Info (5 minutes)

**Right now, do this:**

1. Log into https://unifi.ui.com
2. Go to your Network console
3. Click "Devices" in the left menu
4. Find your door devices (UAH, UA-Lite, or devices with "door" in name)
5. For each door, note:
   - Device Name
   - MAC Address
   - IP Address
   - Model

**Add to .env:**
```env
# Example - replace with your actual values
BEDFORD_STAFF_DOOR_MAC=aa:bb:cc:dd:ee:01
BEDFORD_STAFF_DOOR_IP=192.168.1.100
DARTMOUTH_STAFF_DOOR_MAC=aa:bb:cc:dd:ee:02
DARTMOUTH_STAFF_DOOR_IP=192.168.1.101
DARTMOUTH_BAY_DOOR_MAC=aa:bb:cc:dd:ee:03
DARTMOUTH_BAY_DOOR_IP=192.168.1.102
```

### 2️⃣ Quick Win: Mobile API Token (10 minutes)

**On your phone with UniFi Access app:**

1. Open UniFi Access app
2. Go to Settings
3. Tap the version number 7 times (enables Developer Mode)
4. Go to Developer > Show Token
5. Copy the token

**Add to .env:**
```env
UNIFI_MOBILE_TOKEN=<paste-token-here>
UNIFI_MOBILE_API=true
```

### 3️⃣ Most Reliable: Tailscale (15 minutes)

**At Bedford location (on a computer that can access the controller):**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Note the IP (e.g., 100.64.1.1)
```

**At Dartmouth location:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Note the IP (e.g., 100.64.1.2)
```

**On your ClubOS server:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

**Add to .env:**
```env
BEDFORD_CONTROLLER_IP=100.64.1.1
DARTMOUTH_CONTROLLER_IP=100.64.1.2
CONTROLLER_PORT=8443
UNIFI_USERNAME=local-username
UNIFI_PASSWORD=local-password
```

## 🧪 Testing Your Setup

### Test what you've configured:
```bash
cd ClubOSV1-backend

# Run comprehensive test
npx tsx scripts/test-all-unifi-approaches.ts

# This will:
# - Show what's configured
# - Test each approach
# - Provide specific next steps
```

## 📋 Configuration Priority

Add to your `.env` in this order:

```env
# 1. Console and Network info
UNIFI_CONSOLE_ID=0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302
UNIFI_USE_NETWORK_API=true

# 2. Door Device MACs (from Network console)
BEDFORD_STAFF_DOOR_MAC=<from-devices-list>
DARTMOUTH_STAFF_DOOR_MAC=<from-devices-list>
DARTMOUTH_BAY_DOOR_MAC=<from-devices-list>

# 3. Mobile API (quick win)
UNIFI_MOBILE_TOKEN=<from-mobile-app>

# 4. Tailscale IPs (most reliable)
BEDFORD_CONTROLLER_IP=<tailscale-ip>
DARTMOUTH_CONTROLLER_IP=<tailscale-ip>
UNIFI_USERNAME=<local-username>
UNIFI_PASSWORD=<local-password>
```

## 🚀 Implementation Order

### Today (30 minutes total):
1. **[5 min]** Get door MAC addresses from Network console
2. **[10 min]** Get mobile API token from app
3. **[15 min]** Install Tailscale at one location as test

### Tomorrow:
1. Install Tailscale at remaining locations
2. Test all three approaches
3. Deploy to production

## 🎯 Expected Outcome

Once configured, the system will:
1. **Try Tailscale first** (most reliable, fastest)
2. **Fall back to Mobile API** (if Tailscale unavailable)
3. **Use Network API** (if devices in Network console)
4. **Demo mode** (if nothing configured)

## 📊 Status Check Commands

```bash
# See what's configured
npx tsx scripts/test-all-unifi-approaches.ts

# Test specific location
npx tsx scripts/test-dartmouth-doors.ts

# Extract door info helper
bash scripts/extract-door-devices.sh
```

## ❓ Quick Troubleshooting

**Can't find door devices?**
- Check under "Clients" if not adopted
- Look for UAH or UA-Lite models
- Search for devices with IPs in door controller range

**Mobile token not working?**
- Make sure Developer Mode is enabled
- Token might expire - regenerate if needed
- Check if app has latest updates

**Tailscale not connecting?**
- Ensure both devices are on same Tailscale network
- Check firewall rules
- Try `tailscale ping <other-device-ip>`

## 🎉 Success Criteria

You'll know it's working when:
1. `test-all-unifi-approaches.ts` shows "Connected to real UniFi system"
2. Door status shows actual door names (not demo data)
3. You can unlock a door from the test script

## 📞 Need Help?

Run this for diagnostic info:
```bash
npx tsx scripts/test-all-unifi-approaches.ts > unifi-diagnostic.txt
```

Share the output for troubleshooting.

---

**Next Step**: Get those door MAC addresses from your Network console!
**Time Required**: 30 minutes total for all three approaches
**Result**: Redundant, reliable door control system