# Tailscale + UniFi Access Setup Guide

## 🚀 Quick Setup (15 minutes)

Since you confirmed:
- ✅ You have door/access devices in your Network console
- ✅ The mobile app works
- ✅ You're open to Tailscale

Let's set up BOTH approaches for maximum reliability!

## Option 1: Tailscale Direct Connection (Most Reliable)

### Step 1: Install Tailscale at Each Location

#### At Bedford Location:
```bash
# On the computer/device that can access the UniFi controller
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Note the IP assigned (e.g., 100.64.1.1)
```

#### At Dartmouth Location:
```bash
# On the computer/device that can access the UniFi controller
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Note the IP assigned (e.g., 100.64.1.2)
```

#### On ClubOS Server (Railway):
```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

### Step 2: Update .env with Tailscale IPs

```env
# Tailscale Direct Connection
BEDFORD_CONTROLLER_IP=100.64.1.1
DARTMOUTH_CONTROLLER_IP=100.64.1.2
CONTROLLER_PORT=8443

# Use Network API since devices are in Network console
UNIFI_USE_NETWORK_API=true
UNIFI_USERNAME=your-local-username
UNIFI_PASSWORD=your-local-password
```

### Step 3: Test Connection
```bash
cd ClubOSV1-backend
npm run test:tailscale-unifi
```

## Option 2: Mobile API Approach

Since the mobile app works, we can use mobile-specific endpoints:

### Step 1: Get Mobile API Credentials

The mobile app uses OAuth tokens. We need to capture these:

1. **Enable Developer Mode on Phone**
   - iOS: Settings > UniFi > Developer Mode
   - Android: UniFi App > Settings > About > Tap version 7 times

2. **Get OAuth Token**
   - In app, go to Settings > Developer > Show Token
   - Copy the token

### Step 2: Configure Mobile API

```env
# Mobile API Configuration
UNIFI_MOBILE_TOKEN=<token-from-app>
UNIFI_MOBILE_API=true
UNIFI_CONSOLE_ID=0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302
```

## Option 3: Network Console Device Control

Since you see the devices in your Network console:

### Step 1: Get Device Information

1. Log into https://unifi.ui.com
2. Go to your Network console
3. Find your door devices
4. Click on each and note:
   - MAC Address
   - IP Address
   - Device ID

### Step 2: Configure Devices

```env
# Door Devices from Network Console
BEDFORD_DOOR_MAC=aa:bb:cc:dd:ee:01
BEDFORD_DOOR_IP=192.168.1.100
DARTMOUTH_DOOR_MAC=aa:bb:cc:dd:ee:02
DARTMOUTH_DOOR_IP=192.168.1.101
```

## 🔧 Implementation Updates

I'll update the service to handle all three approaches: