# UniFi Access Cloudflare Tunnel - Pre-Implementation Checklist

## 📋 Complete this checklist BEFORE starting implementation

### 1. Infrastructure Requirements

#### Cloudflare Account
- [ ] Have access to Cloudflare account
- [ ] Can create API tokens
- [ ] Know your Account ID
- [ ] Have a domain/subdomain available for tunnels

#### UniFi Controllers (Per Location)
- [ ] UniFi Access installed and running
- [ ] Version 1.9.2 or higher
- [ ] Admin access credentials available
- [ ] Know the local IP address
- [ ] Port 12445 accessible locally

#### Server Access (Per Location)
- [ ] SSH access to server
- [ ] Root/sudo privileges
- [ ] Can install software
- [ ] Can modify system services
- [ ] At least 100MB free disk space

### 2. Information to Gather

#### Bedford Location
- [ ] UniFi Controller IP: ________________
- [ ] Admin Username: ________________
- [ ] Admin Password: [Stored Securely]
- [ ] Server SSH Access: ________________
- [ ] Number of Doors: ________________

#### Dartmouth Location
- [ ] UniFi Controller IP: ________________
- [ ] Admin Username: ________________
- [ ] Admin Password: [Stored Securely]
- [ ] Server SSH Access: ________________
- [ ] Number of Doors: ________________

#### Door Information
- [ ] Bedford Front Door MAC: `28:70:4e:80:c4:4f` ✓
- [ ] Bedford Middle Door MAC: `28:70:4e:80:de:f3` ✓
- [ ] Dartmouth Staff Door MAC: `28:70:4e:80:de:3b` ✓
- [ ] Other Door MACs: ________________

### 3. Current System Status

#### Existing Setup
- [ ] Currently using port forwarding?
- [ ] Currently using VPN?
- [ ] Currently using cloud proxy?
- [ ] Any existing tunnels?

#### Network Configuration
- [ ] Firewall rules documented
- [ ] Port forwarding rules documented
- [ ] DNS settings documented
- [ ] Static IPs or DDNS in use?

### 4. Preparation Tasks

#### Documentation
- [ ] Read UniFi Access API documentation
- [ ] Read Cloudflare Tunnel documentation
- [ ] Review implementation guide
- [ ] Understand rollback procedure

#### Backups
- [ ] Current .env file backed up
- [ ] UniFi configuration exported
- [ ] Database backed up
- [ ] Document current working setup

#### Testing Environment
- [ ] Test location identified (non-critical door)
- [ ] Test time window scheduled
- [ ] Team notified of testing
- [ ] Monitoring setup ready

### 5. Tools & Software

#### Local Machine
- [ ] Terminal/SSH client installed
- [ ] Text editor ready (nano/vim)
- [ ] Web browser for Cloudflare
- [ ] Password manager ready

#### Commands to Have Ready
```bash
# Test UniFi Access locally (run on location server)
curl -k https://localhost:12445/api/v1/developer/doors \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test current connectivity (from ClubOS server)
curl https://your-current-unifi-endpoint/health

# Check service status
systemctl status unifi-access
```

### 6. Access Credentials

#### Cloudflare
- [ ] Email: ________________
- [ ] Password: [Stored Securely]
- [ ] 2FA method ready

#### UniFi
- [ ] UI.com account: ________________
- [ ] Password: [Stored Securely]
- [ ] Each location's local login ready

#### Servers
- [ ] SSH keys configured
- [ ] Root passwords available
- [ ] Service account credentials ready

### 7. Risk Assessment

#### Potential Issues
- [ ] Downtime acceptable? (Expected: 5-10 minutes)
- [ ] Rollback plan understood?
- [ ] Emergency contacts available?
- [ ] Alternative access method ready?

#### Success Criteria Defined
- [ ] All tunnels connect successfully
- [ ] Door list retrieves properly
- [ ] Test unlock completes < 2 seconds
- [ ] No errors in logs

### 8. Team Communication

#### Stakeholders Notified
- [ ] IT team aware of changes
- [ ] Security team consulted
- [ ] Management approved
- [ ] Users informed of maintenance

#### Documentation Ready
- [ ] Change request filed
- [ ] Implementation plan shared
- [ ] Rollback plan documented
- [ ] Contact list updated

### 9. Post-Implementation Plan

#### Monitoring
- [ ] Log aggregation setup
- [ ] Alert rules configured
- [ ] Dashboard prepared
- [ ] Health checks scheduled

#### Training
- [ ] Admin training scheduled
- [ ] User guide prepared
- [ ] Support docs updated
- [ ] FAQ created

### 10. Final Checks

#### Day Before Implementation
- [ ] All items above checked ✓
- [ ] Test environment verified
- [ ] Backups confirmed
- [ ] Team availability confirmed

#### Hour Before Implementation
- [ ] Current system working
- [ ] No ongoing issues
- [ ] Communication sent
- [ ] Tools and guides ready

---

## 🚦 Go/No-Go Decision

### GREEN LIGHT if:
- ✅ All critical items checked
- ✅ Backups completed
- ✅ Team ready
- ✅ Rollback plan clear

### YELLOW LIGHT if:
- ⚠️ Some non-critical items pending
- ⚠️ Need additional testing
- ⚠️ Team partially available

### RED LIGHT if:
- ❌ Critical items missing
- ❌ No backups
- ❌ Rollback plan unclear
- ❌ System currently unstable

---

## 📝 Implementation Sign-Off

**Date**: ________________

**Implementer**: ________________

**Approver**: ________________

**Notes**: 
_____________________________________________
_____________________________________________
_____________________________________________

---

## 🔗 Quick Links

- [Implementation Guide](./UNIFI-IMPLEMENTATION-GUIDE.md)
- [Cloudflare Dashboard](https://dash.cloudflare.com)
- [UniFi Portal](https://unifi.ui.com)
- [Support Contacts](./SUPPORT-CONTACTS.md)

---

**Remember**: It's better to postpone than to rush. Take your time and do it right! 🚀