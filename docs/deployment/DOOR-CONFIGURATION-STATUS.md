# Door Configuration Status

## ✅ First Door Found!
**MAC Address**: `28:70:4e:80:de:3b`

## 🔍 Next Steps

### 1. Identify This Door
In your UniFi Network console, find this device (MAC: 28:70:4e:80:de:3b) and check:
- What's the device name?
- What location is it at?
- Is it Main, Staff, or Bay door?

### 2. Update Your .env
Once you know which door it is, update the .env file:

```bash
# For example, if it's Dartmouth Staff Door:
DARTMOUTH_STAFF_DOOR_MAC=28:70:4e:80:de:3b

# Or if it's Bedford Staff Door:
BEDFORD_STAFF_DOOR_MAC=28:70:4e:80:de:3b
```

### 3. Find Other Doors
Look for similar devices with MAC addresses starting with:
- `28:70:4e` (same manufacturer)
- Any UAH or UA-Lite devices
- Devices with "door" in the name

## 📝 Door Checklist

Track your progress:

- [ ] Bedford Main Door - MAC: ________________
- [ ] Bedford Staff Door - MAC: ________________
- [?] Dartmouth Main Door - MAC: `28:70:4e:80:de:3b` (verify)
- [?] Dartmouth Staff Door - MAC: `28:70:4e:80:de:3b` (verify)
- [ ] Dartmouth Bay Access - MAC: ________________

## 🧪 Testing

Once you've added the MACs to .env:

```bash
# Enable Network API mode
echo "UNIFI_USE_NETWORK_API=true" >> .env

# Test the configuration
npx tsx scripts/test-all-unifi-approaches.ts
```

## 💡 Tips

1. **Can't see device names?**
   - Click on the device in the UniFi console
   - Check the "Details" or "Properties" tab
   - Look for custom aliases or labels

2. **Finding all doors quickly:**
   - In UniFi console, use the search box
   - Try searching for: "door", "access", "UAH", "UA-Lite"
   - Filter by device type if available

3. **Device offline?**
   - Note the MAC anyway
   - It will work once the device comes online

## 🎯 Quick Configuration

Add all these to your .env once you find them:

```env
# Network API Configuration
UNIFI_USE_NETWORK_API=true
UNIFI_CONSOLE_ID=0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302

# Door MACs (update with actual values)
BEDFORD_MAIN_DOOR_MAC=
BEDFORD_STAFF_DOOR_MAC=
DARTMOUTH_MAIN_DOOR_MAC=
DARTMOUTH_STAFF_DOOR_MAC=28:70:4e:80:de:3b  # Update if this is different door
DARTMOUTH_BAY_DOOR_MAC=

# Also add Mobile API token when you get it
UNIFI_MOBILE_TOKEN=

# And Tailscale IPs when set up
BEDFORD_CONTROLLER_IP=
DARTMOUTH_CONTROLLER_IP=
```

## 🚀 Almost There!

You're very close! Just need to:
1. Identify which door `28:70:4e:80:de:3b` is
2. Find the other door MACs
3. Add them all to .env
4. Test with the script

The system will work as soon as you have the MACs configured!