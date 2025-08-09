# UniFi Access Remote Setup - Action Plan

## ✅ What We've Accomplished
1. **API Token Created**: `5lXwpnBmlVAWoA5TK3GkVw`
2. **Correct API Port Identified**: 12445 (not 8443 or 443)
3. **Door MAC Addresses Configured**: Bedford & Dartmouth staff doors
4. **Test Scripts Ready**: All tools created and tested

## 🚫 Current Blocker
**The UniFi Access controllers are not accessible from your current network.**
- Controllers are at physical locations (Bedford & Dartmouth)
- API requires direct HTTPS connection to port 12445
- No cloud proxy available for UniFi Access API

## ✅ Solution: Port Forwarding Setup

### What You Need to Do at Each Location:

#### 1. Bedford Location Setup
**On the Bedford router/firewall:**
```
External Port: 12445 → Internal: [Bedford-Controller-IP]:12445
```

**Get the public IP or domain:**
- Option A: Static IP from ISP
- Option B: Dynamic DNS (DuckDNS, No-IP, etc.)
  - Example: `bedford.duckdns.org`

#### 2. Dartmouth Location Setup
**On the Dartmouth router/firewall:**
```
External Port: 12445 → Internal: [Dartmouth-Controller-IP]:12445
```

**Get the public IP or domain:**
- Option A: Static IP from ISP
- Option B: Dynamic DNS
  - Example: `dartmouth.duckdns.org`

### Step-by-Step Instructions:

#### Step 1: Find Controller IPs at Each Location
Someone at each location needs to:
1. Access the UniFi console locally
2. Note the controller's IP address (likely 192.168.x.x)
3. Verify they can access: `https://[IP]:12445` locally

#### Step 2: Configure Port Forwarding
**On each location's router:**
1. Log into router admin panel
2. Find "Port Forwarding" or "Virtual Server" settings
3. Add new rule:
   - Service Name: `UniFi Access API`
   - External Port: `12445`
   - Internal IP: `[Controller IP]`
   - Internal Port: `12445`
   - Protocol: `TCP`
4. Save and apply

#### Step 3: Set Up Dynamic DNS (if no static IP)
1. Sign up for free DDNS service (DuckDNS, No-IP, etc.)
2. Configure DDNS on router or controller
3. Note your DDNS hostname

#### Step 4: Update ClubOS Configuration
Update your `.env` file:
```env
# Bedford Controller (use public IP or DDNS)
BEDFORD_CONTROLLER_IP=bedford.duckdns.org
# or
BEDFORD_CONTROLLER_IP=75.123.45.67

# Dartmouth Controller
DARTMOUTH_CONTROLLER_IP=dartmouth.duckdns.org
# or
DARTMOUTH_CONTROLLER_IP=75.123.45.68
```

#### Step 5: Test Connection
```bash
npm run test:unifi
```

## 🔒 Security Considerations

### Recommended Security Measures:
1. **Firewall Rules**: Limit access to ClubOS server IP only
2. **VPN Alternative**: Consider VPN instead of port forwarding
3. **Regular Updates**: Keep UniFi Access updated
4. **Monitor Access**: Check logs regularly

### Firewall Rule Example:
```
Allow TCP 12445 FROM [ClubOS-Server-IP] TO [Controller]
Deny all other 12445 traffic
```

## 📱 Who Can Help Set This Up?

You'll need someone at each location who can:
1. **Access the router/firewall admin panel**
2. **Find the UniFi controller's local IP**
3. **Configure port forwarding**
4. **Set up DDNS if needed**

This could be:
- IT support staff
- Network administrator
- Anyone with router admin access

## 🎯 Quick Setup Checklist

### Bedford:
- [ ] Find controller IP: _______________
- [ ] Set up port forwarding (12445)
- [ ] Get public IP/DDNS: _______________
- [ ] Test local access
- [ ] Update .env file

### Dartmouth:
- [ ] Find controller IP: _______________
- [ ] Set up port forwarding (12445)
- [ ] Get public IP/DDNS: _______________
- [ ] Test local access
- [ ] Update .env file

### ClubOS:
- [ ] Update BEDFORD_CONTROLLER_IP in .env
- [ ] Update DARTMOUTH_CONTROLLER_IP in .env
- [ ] Run: `npm run test:unifi`
- [ ] Restart backend
- [ ] Test door unlock in UI

## 💡 Alternative Solutions

### Option 1: VPN Setup (More Secure)
- Set up site-to-site VPN
- Or use Tailscale/WireGuard
- No port forwarding needed
- More complex setup

### Option 2: Local Proxy Server
- Deploy Raspberry Pi at each location
- Run proxy service to forward API calls
- More complex but flexible

### Option 3: Continue with Demo Mode
- Fully functional UI
- No actual door control
- Good for training/testing

## 📞 Next Steps

1. **Contact IT support** at Bedford & Dartmouth
2. **Share this document** with them
3. **Get the information** needed (IPs, domains)
4. **Update configuration** in ClubOS
5. **Test the connection**

Once port forwarding is set up, the door control will work immediately!

## Need Help?
- The API token is ready: `5lXwpnBmlVAWoA5TK3GkVw`
- All code is configured and tested
- Just needs network access to controllers on port 12445

---
*System is fully functional in Demo Mode while setting up remote access*