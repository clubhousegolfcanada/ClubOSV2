# UniFi Access Quick Setup Guide

## 🚀 Quick Start (5 minutes)

### Step 1: Run Setup Script
```bash
cd ClubOSV1-backend
npm run setup:unifi
```

This interactive script will ask for:
1. **UniFi Controller URL** (e.g., `https://192.168.1.100` or `unifi.yourdomain.com`)
2. **Username & Password** for UniFi
3. **Door MAC addresses** for Bedford and Dartmouth

### Step 2: Get Door MAC Addresses

1. Log into your UniFi Access Controller
2. Go to **Devices** → **Doors**
3. Click on each door to see its MAC address
4. Note these for the setup script:
   - Bedford Staff Door MAC
   - Dartmouth Staff Door MAC
   - (Optional) Main entrance doors for future use

### Step 3: Run the Setup

When prompted by the setup script:
- Choose option **3** to configure both Bedford and Dartmouth
- Enter the MAC addresses you noted
- Use default unlock durations (30 seconds)

### Step 4: Test the Connection
```bash
npm run test:unifi
```

This will:
- Verify your credentials
- Check door configurations
- Test connectivity to UniFi controller

### Step 5: Restart Backend
```bash
npm run dev
# or for production
npm run start:prod
```

## 📝 Manual Configuration (Alternative)

If you prefer to manually edit the `.env` file:

```env
# UniFi Access Configuration
UNIFI_CONTROLLER_URL=https://192.168.1.100
UNIFI_CONTROLLER_PORT=8443
UNIFI_USERNAME=your-unifi-username
UNIFI_PASSWORD=your-unifi-password
UNIFI_SITE_ID=default

# Bedford Doors
BEDFORD_STAFF_DOOR_ID=aa:bb:cc:dd:ee:01
BEDFORD_MAIN_DOOR_ID=aa:bb:cc:dd:ee:02

# Dartmouth Doors  
DARTMOUTH_STAFF_DOOR_ID=aa:bb:cc:dd:ee:03
DARTMOUTH_MAIN_DOOR_ID=aa:bb:cc:dd:ee:04

# Unlock Durations (seconds)
DEFAULT_UNLOCK_DURATION=30
MAX_UNLOCK_DURATION=300
EMERGENCY_UNLOCK_DURATION=60
```

## ✅ Verification

You'll know it's working when:
1. `npm run test:unifi` shows "✓ UniFi Service initialized successfully"
2. The Remote Actions bar in ClubOS shows door status (no [DEMO] prefix)
3. Clicking "Unlock" on a door actually unlocks it for 30 seconds

## 🎮 Demo Mode

If UniFi isn't configured, the system runs in **Demo Mode**:
- All door functions work in the UI
- Actions show "[DEMO]" prefix
- Perfect for testing without hardware

## 🔧 Troubleshooting

### "Running in DEMO mode" message
- Check UniFi credentials are correct
- Verify controller URL is accessible
- Ensure firewall allows connection to UniFi controller

### Doors show as offline
- Verify MAC addresses are correct
- Check UniFi Access controller shows doors as online
- Ensure network connectivity between ClubOS and doors

### Can't unlock doors
- Verify user role (must be operator or admin)
- Check Slack for error notifications
- Review logs: `tail -f logs/combined.log`

## 📞 Support

Need help? Check:
1. Full documentation: `UBIQUITI-DOOR-ACCESS-SETUP.md`
2. Test connection: `npm run test:unifi`
3. Backend logs for detailed errors

---

**Next Step**: Run `npm run setup:unifi` to get started!