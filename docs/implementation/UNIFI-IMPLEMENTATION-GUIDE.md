# UniFi Access Cloudflare Tunnel Implementation Guide

## 📅 Implementation Timeline: 1-2 Weeks from Now

This guide contains everything you need to implement UniFi Access with Cloudflare tunnels. Follow these steps in order when you're ready to deploy.

---

## 📋 Pre-Implementation Checklist

Before starting, ensure you have:

- [ ] **Cloudflare Account** with access to create tunnels
- [ ] **UniFi Access Controllers** at each location (Bedford, Dartmouth, etc.)
- [ ] **Admin access** to UniFi controllers
- [ ] **Root/admin access** to servers at each location
- [ ] **UniFi Access API tokens** generated for each location
- [ ] **30-60 minutes** for initial setup per location

---

## 🚀 Step-by-Step Implementation

### Phase 1: Cloudflare Account Setup (15 minutes)

1. **Get Cloudflare Account Credentials:**
   ```bash
   # Log into Cloudflare Dashboard
   https://dash.cloudflare.com
   
   # Navigate to your account
   # Copy your Account ID from the right sidebar
   # Create an API token: My Profile > API Tokens > Create Token
   # Use template: "Create Custom Token" with these permissions:
   # - Account: Cloudflare Tunnel:Edit
   # - Zone: DNS:Edit (for your domain)
   ```

2. **Install cloudflared on your local machine:**
   ```bash
   # macOS
   brew install cloudflared
   
   # Linux
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
   chmod +x cloudflared
   sudo mv cloudflared /usr/local/bin/
   ```

### Phase 2: UniFi Access Setup (20 minutes per location)

For EACH location (Bedford, Dartmouth):

1. **Enable Remote Access in UniFi:**
   ```
   1. Log into UniFi controller web interface
   2. Go to Settings > System > Advanced
   3. Enable "Remote Access"
   4. Save settings
   ```

2. **Generate Access API Token:**
   ```
   1. In UniFi controller, go to Applications > Access
   2. Navigate to Settings > Security > Advanced
   3. Click "Generate Access API Token"
   4. COPY AND SAVE THE TOKEN (shown only once!)
   5. Label it clearly (e.g., "Bedford Access Token - Dec 2024")
   ```

3. **Note Down Door Information:**
   ```
   1. Go to Access > Doors
   2. For each door, note:
      - Door Name
      - MAC Address
      - Current Status
   ```

### Phase 3: Install Cloudflare Tunnels at Each Location (30 minutes per location)

**SSH into each location's server** and run:

```bash
# 1. Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# 2. Login to Cloudflare (do this once)
cloudflared tunnel login
# This opens a browser - select your account and authorize

# 3. Create tunnel for this location (example for Bedford)
cloudflared tunnel create clubos-bedford-unifi

# 4. Note the Tunnel ID that's displayed
# Example: 550e8400-e29b-41d4-a716-446655440000

# 5. Create config file
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

**Paste this configuration** (adjust for each location):

```yaml
tunnel: YOUR-TUNNEL-ID-HERE
credentials-file: /root/.cloudflared/YOUR-TUNNEL-ID.json

ingress:
  - hostname: bedford-unifi.clubos.internal
    service: https://localhost:12445
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
  - service: http_status:404
```

**Install as a system service:**

```bash
# Install service
sudo cloudflared service install

# Start the tunnel
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared
```

### Phase 4: Configure ClubOS Backend (15 minutes)

1. **Navigate to backend directory:**
   ```bash
   cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"
   ```

2. **Copy and configure environment file:**
   ```bash
   # Copy the template
   cp .env.cloudflare.example .env.cloudflare
   
   # Edit with your values
   nano .env.cloudflare
   ```

3. **Add these values to your .env.cloudflare:**
   ```env
   # Enable Cloudflare tunnels
   UNIFI_USE_CLOUDFLARE=true
   
   # Your Cloudflare credentials
   CLOUDFLARE_ACCOUNT_ID=your-account-id-from-step-1
   CLOUDFLARE_API_TOKEN=your-api-token-from-step-1
   
   # Bedford Configuration
   CLOUDFLARE_TUNNEL_BEDFORD_ID=tunnel-id-from-step-3
   CLOUDFLARE_TUNNEL_BEDFORD_HOSTNAME=bedford-unifi.clubos.internal
   UNIFI_BEDFORD_TOKEN=access-token-from-step-2
   
   # Dartmouth Configuration  
   CLOUDFLARE_TUNNEL_DARTMOUTH_ID=tunnel-id-from-step-3
   CLOUDFLARE_TUNNEL_DARTMOUTH_HOSTNAME=dartmouth-unifi.clubos.internal
   UNIFI_DARTMOUTH_TOKEN=access-token-from-step-2
   ```

4. **Merge with main .env file:**
   ```bash
   # Backup current .env
   cp .env .env.backup
   
   # Append Cloudflare config to main .env
   cat .env.cloudflare >> .env
   ```

### Phase 5: Test the Integration (10 minutes)

1. **Run connection test:**
   ```bash
   npm run test:unifi-tunnels
   ```
   
   Expected output:
   ```
   ✅ dartmouth: Connection successful
   ✅ bedford: Connection successful
   ✅ Found 2 door(s) at bedford
   ✅ Found 1 door(s) at dartmouth
   ```

2. **Test door operations (without actually unlocking):**
   ```bash
   npm run test:unifi-doors
   ```

3. **If tests pass, try a real unlock (optional):**
   ```bash
   TEST_DOOR_UNLOCK=true npm run test:unifi-tunnels
   ```

### Phase 6: Deploy to Production (10 minutes)

1. **Run migration in test mode first:**
   ```bash
   npm run migrate:cloudflare:test
   ```

2. **If test passes, run actual migration:**
   ```bash
   npm run migrate:cloudflare
   ```

3. **Restart backend service:**
   ```bash
   npm run build
   npm run restart
   ```

4. **Monitor logs:**
   ```bash
   npm run logs:unifi
   ```

---

## 🔧 Troubleshooting Guide

### Issue: "Tunnel not connected"
```bash
# On the location server:
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
journalctl -u cloudflared -f
```

### Issue: "401 Unauthorized"
```bash
# Regenerate Access API token in UniFi
# Update token in .env file
# Restart backend service
```

### Issue: "Door not found"
```bash
# Check door MAC address matches exactly
# Run: npm run list:unifi-doors
# Verify door is online in UniFi Access app
```

### Issue: "Connection timeout"
```bash
# Check firewall rules
sudo ufw status
sudo ufw allow 12445

# Check UniFi Access is running
systemctl status unifi-access
```

---

## 📝 Quick Commands Reference

```bash
# Backend directory
cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"

# Test commands
npm run test:unifi-tunnels     # Test tunnel connectivity
npm run test:unifi-doors       # Test door operations
npm run list:unifi-doors       # List all configured doors

# Migration commands
npm run migrate:cloudflare:test  # Test migration (dry run)
npm run migrate:cloudflare       # Run actual migration
npm run migrate:rollback         # Rollback if needed

# Monitoring
npm run logs:unifi             # View UniFi logs
npm run health:unifi           # Check service health

# Emergency
npm run unifi:disable-cloudflare  # Switch back to direct mode
npm run unifi:clear-cache         # Clear all caches
```

---

## 🔐 Security Notes

1. **Never commit tokens to git** - Always use .env files
2. **Rotate tokens quarterly** - Set calendar reminder
3. **Monitor access logs** - Check for unusual patterns
4. **Test in off-hours** - Avoid testing during busy times
5. **Keep backups** - Always backup before changes

---

## 📱 Testing from Frontend

Once backend is configured:

1. **Open ClubOS frontend**
2. **Navigate to Commands page**
3. **Look for door unlock buttons**
4. **Test with a non-critical door first**
5. **Verify unlock works and logs appear**

---

## 📊 Success Criteria

Your implementation is successful when:

- ✅ All tunnel connections show "Connected"
- ✅ Door list populates for all locations
- ✅ Test unlock completes within 2 seconds
- ✅ Logs show successful operations
- ✅ Frontend buttons work properly
- ✅ No errors in production logs

---

## 🚨 Emergency Rollback

If something goes wrong:

```bash
# 1. Quick disable Cloudflare mode
cd ClubOSV1-backend
npm run unifi:disable-cloudflare

# 2. Restart service
npm run restart

# 3. Verify old mode works
npm run health:unifi

# 4. Full rollback if needed
npm run migrate:rollback
```

---

## 📞 Support Resources

- **UniFi Access Docs**: https://help.ui.com/hc/en-us/categories/6583256751383-UniFi-Access
- **Cloudflare Tunnel Docs**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **ClubOS Logs**: `ClubOSV1-backend/logs/`
- **Backup Location**: `ClubOSV1-backend/backups/`

---

## ✅ Final Checklist Before Going Live

- [ ] All tunnels show connected status
- [ ] All doors appear in door list
- [ ] Test unlock works on test door
- [ ] Logs show no errors
- [ ] Frontend integration tested
- [ ] Backup created and verified
- [ ] Team notified of changes
- [ ] Monitoring alerts configured

---

## 📅 Post-Implementation Tasks

After successful implementation:

1. **Week 1**: Monitor logs daily
2. **Week 2**: Review performance metrics
3. **Month 1**: Conduct security audit
4. **Quarter 1**: Rotate API tokens

---

This guide will be here when you're ready. Good luck with the implementation! 🚀