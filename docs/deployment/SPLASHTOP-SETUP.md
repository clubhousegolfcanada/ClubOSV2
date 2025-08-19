# Splashtop Bay-Specific Remote Desktop Setup

## Quick Setup Guide (5 Minutes)

### The Easy Way - Using PowerShell Script

1. **Download the setup script** to each bay computer
2. **Run PowerShell as Administrator** on each bay computer
3. **Execute the script**: 
   ```powershell
   .\getMacAddress.ps1
   ```
4. **Answer the prompts** (location and bay number)
5. **Copy the output** to your `.env.local` file
6. **Restart the ClubOS frontend**

That's it! The Remote Desktop buttons will now work for that bay.

## Overview
ClubOS now supports direct remote desktop connections to specific bay computers using Splashtop Business. This allows operators to quickly connect to any bay's computer directly from the Commands page or RemoteActionsBar.

## Features
- **Direct Bay Connection**: Click a button to connect directly to a specific bay's computer
- **Intelligent Platform Detection**: Automatically detects iOS, Android, Mac, or Windows
- **Smart Fallback**: If the Splashtop app isn't installed, falls back to web portal
- **Deep Link Support**: Uses `st-business://` URL scheme for direct app launching

## Setup Instructions

### Step 1: Gather Required Information

1. **Splashtop Account Email**
   - The email address used for your Splashtop Business account
   - This will be set as `NEXT_PUBLIC_SPLASHTOP_EMAIL`

2. **MAC Addresses for Each Bay Computer**
   - You need the MAC address of each computer's primary network adapter

#### Method 1: Quick Command (Easiest)

**On each bay computer, open Command Prompt and run:**
```cmd
getmac /v | findstr /i "ethernet wi-fi"
```
This will show the MAC address like: `C0-4A-00-1C-72-EC`

#### Method 2: From Splashtop (If Available)

Unfortunately, Splashtop doesn't show MAC addresses in the web console, only device names like "DESKTOP-Q4Q4KE3".

#### Method 3: Using PowerShell Script (Automated)

We've included a PowerShell script that automatically gets both the device name and MAC address:
```powershell
.\getMacAddress.ps1
```
This script will output the exact environment variables you need to add.

### Step 2: Configure Environment Variables

Add the following to your `.env.local` file:

```env
# Splashtop Configuration
NEXT_PUBLIC_SPLASHTOP_EMAIL=your-email@example.com

# Bedford Location
NEXT_PUBLIC_BEDFORD_BAY1_MAC=XX:XX:XX:XX:XX:01
NEXT_PUBLIC_BEDFORD_BAY2_MAC=XX:XX:XX:XX:XX:02
NEXT_PUBLIC_BEDFORD_BAY3_MAC=XX:XX:XX:XX:XX:03
NEXT_PUBLIC_BEDFORD_BAY4_MAC=XX:XX:XX:XX:XX:04

# Dartmouth Location
NEXT_PUBLIC_DARTMOUTH_BAY1_MAC=XX:XX:XX:XX:XX:11
NEXT_PUBLIC_DARTMOUTH_BAY2_MAC=XX:XX:XX:XX:XX:12
NEXT_PUBLIC_DARTMOUTH_BAY3_MAC=XX:XX:XX:XX:XX:13
NEXT_PUBLIC_DARTMOUTH_BAY4_MAC=XX:XX:XX:XX:XX:14

# Stratford Location
NEXT_PUBLIC_STRATFORD_BAY1_MAC=XX:XX:XX:XX:XX:21
NEXT_PUBLIC_STRATFORD_BAY2_MAC=XX:XX:XX:XX:XX:22
NEXT_PUBLIC_STRATFORD_BAY3_MAC=XX:XX:XX:XX:XX:23

# Bayers Lake Location
NEXT_PUBLIC_BAYERSLAKE_BAY1_MAC=XX:XX:XX:XX:XX:31
NEXT_PUBLIC_BAYERSLAKE_BAY2_MAC=XX:XX:XX:XX:XX:32
NEXT_PUBLIC_BAYERSLAKE_BAY3_MAC=XX:XX:XX:XX:XX:33
NEXT_PUBLIC_BAYERSLAKE_BAY4_MAC=XX:XX:XX:XX:XX:34
NEXT_PUBLIC_BAYERSLAKE_BAY5_MAC=XX:XX:XX:XX:XX:35

# Truro Location
NEXT_PUBLIC_TRURO_BAY1_MAC=XX:XX:XX:XX:XX:41
NEXT_PUBLIC_TRURO_BAY2_MAC=XX:XX:XX:XX:XX:42
NEXT_PUBLIC_TRURO_BAY3_MAC=XX:XX:XX:XX:XX:43
```

**Note**: MAC addresses can use either colons (:) or dashes (-) as separators.

### Step 3: Name Computers in Splashtop

For better user experience, ensure each computer is named clearly in Splashtop:

1. Log into my.splashtop.com
2. Go to Computers tab
3. Rename each computer to match its location:
   - Bedford Bay 1 PC
   - Bedford Bay 2 PC
   - Dartmouth Bay 1 PC
   - etc.

### Step 4: Test the Integration

1. **Test Deep Links**: Open `/test-splashtop-links.html` in a browser
2. **Test from Commands Page**: 
   - Go to Commands page
   - Find a bay under Remote Actions
   - Click the "Remote" button
3. **Test from RemoteActionsBar**:
   - Click "Remote Actions" at bottom of screen
   - Click "Remote" button for any bay

## How It Works

### URL Format
The deep link format for Splashtop Business is:
```
st-business://com.splashtop.business?account=EMAIL&mac=MACADDRESS
```

### Platform Behavior

**iOS:**
- Attempts to open Splashtop Business app using iframe method
- Tries multiple URL schemes: `splashtopbusiness://`, `splashtop://`, `stbusiness://`
- Falls back to web portal if app not installed

**Android:**
- Uses Android Intent URLs with automatic fallback
- Format: `intent://open#Intent;scheme=st-business;...`

**Mac/Windows Desktop:**
- Attempts to launch desktop Splashtop Business app
- Always opens web portal as backup option

## Troubleshooting

### Remote Desktop button doesn't work
1. Check if MAC address is configured in environment variables
2. Verify Splashtop Business app is installed
3. Ensure user is logged into Splashtop with "Stay logged in" enabled

### Wrong computer opens
1. Verify MAC address is correct for that bay
2. Check computer naming in Splashtop dashboard

### App doesn't open on mobile
1. Ensure Splashtop Business app (not Personal) is installed
2. On iOS, try opening the app manually first to ensure it's set up
3. Check that deep linking is enabled in device settings

## Security Considerations

1. **MAC Addresses**: While not highly sensitive, MAC addresses should not be exposed publicly
2. **Access Control**: Splashtop still requires authentication - deep links only pre-select the computer
3. **Environment Variables**: Use NEXT_PUBLIC_ prefix as these are client-side values

## Future Enhancements

1. **Database Storage**: Move MAC addresses to database for easier management
2. **Admin UI**: Create settings page to configure MAC addresses
3. **Session Tokens**: Integrate with Splashtop API for direct embedding
4. **Usage Analytics**: Track which bays are accessed most frequently
5. **Automated Discovery**: Use network scanning to auto-discover bay computers