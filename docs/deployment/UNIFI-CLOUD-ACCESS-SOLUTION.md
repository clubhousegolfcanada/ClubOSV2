# UniFi Cloud Access Solution - Breaking Through the VPN Barrier

## Problem Summary
The UniFi Access mobile app can control doors remotely without VPN, but our Node.js implementation using the `unifi-access` npm package cannot. This is because:
1. The npm package only supports local controller connections (port 12445)
2. The mobile app uses UniFi's cloud proxy system at `https://unifi.ui.com`
3. Controllers are at physical locations (Bedford/Dartmouth) behind NAT

## How the Mobile App Works
The UniFi Access mobile app uses:
- **Cloud Proxy**: `https://unifi.ui.com/proxy/consoles/[console-id]/access/api/`
- **Authentication**: Ubiquiti account login (OAuth-style)
- **Session Management**: Cookie-based sessions
- **No VPN Required**: Traffic routed through Ubiquiti's cloud infrastructure

## Solution Options

### Option 1: Custom Cloud API Implementation (Recommended)
Replace the `unifi-access` npm package with a custom implementation that uses UniFi's cloud proxy.

**Pros:**
- No VPN or port forwarding needed
- Works exactly like the mobile app
- Secure (uses Ubiquiti's infrastructure)

**Cons:**
- Need to reverse-engineer API endpoints
- More complex authentication flow
- May break if Ubiquiti changes their API

### Option 2: Tailscale VPN (Easiest)
Use Tailscale to create a secure mesh network between ClubOS and the controllers.

**Pros:**
- Free for up to 100 devices
- Easy 5-minute setup
- Very secure (WireGuard-based)
- No port forwarding needed

**Cons:**
- Requires installing Tailscale at each location
- Another service to manage

### Option 3: Port Forwarding (Quick but Less Secure)
Forward port 12445 at each location to the controller.

**Pros:**
- Works with existing code
- No additional services needed

**Cons:**
- Security risk if not properly configured
- Requires static IPs or DDNS
- Network configuration at each location

## Implementation Plan for Cloud API

### Phase 1: Authentication Service
```typescript
// services/unifiCloudAuth.ts
class UnifiCloudAuth {
  private cookies: string[] = [];
  
  async login(username: string, password: string): Promise<boolean> {
    const response = await fetch('https://unifi.ui.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    // Store cookies from Set-Cookie headers
    this.cookies = response.headers.getSetCookie();
    return response.ok;
  }
  
  getAuthHeaders(): Record<string, string> {
    return {
      'Cookie': this.cookies.join('; ')
    };
  }
}
```

### Phase 2: Cloud Access Service
```typescript
// services/unifiCloudAccess.ts
class UnifiCloudAccess {
  private auth: UnifiCloudAuth;
  private consoleId: string;
  
  constructor(consoleId: string) {
    this.auth = new UnifiCloudAuth();
    this.consoleId = consoleId;
  }
  
  async unlockDoor(doorId: string, duration: number = 30): Promise<boolean> {
    const url = `https://unifi.ui.com/proxy/consoles/${this.consoleId}/access/api/v1/door/${doorId}/unlock`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.auth.getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        duration,
        reason: 'Remote unlock via ClubOS'
      })
    });
    
    return response.ok;
  }
  
  async getDoorStatus(doorId: string): Promise<DoorStatus> {
    const url = `https://unifi.ui.com/proxy/consoles/${this.consoleId}/access/api/v1/door/${doorId}/status`;
    
    const response = await fetch(url, {
      headers: this.auth.getAuthHeaders()
    });
    
    return response.json();
  }
}
```

### Phase 3: Environment Configuration
```env
# Cloud Access Configuration
UNIFI_CLOUD_USERNAME=your-ubiquiti-account@email.com
UNIFI_CLOUD_PASSWORD=your-password
UNIFI_CONSOLE_ID=0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302

# Door IDs (from UniFi Access console)
BEDFORD_DOOR_ID=abc123
DARTMOUTH_DOOR_ID=def456
```

## Tailscale Alternative Setup

If the cloud API proves difficult, here's the Tailscale approach:

### Step 1: Install Tailscale
```bash
# On each UniFi controller machine (Bedford/Dartmouth)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# On ClubOS server
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

### Step 2: Note Tailscale IPs
```bash
tailscale status
# Bedford controller: 100.64.1.1
# Dartmouth controller: 100.64.1.2
```

### Step 3: Update .env
```env
# Bedford via Tailscale
BEDFORD_CONTROLLER_URL=https://100.64.1.1:12445
# Dartmouth via Tailscale  
DARTMOUTH_CONTROLLER_URL=https://100.64.1.2:12445
```

## Testing Strategy

### 1. Test Cloud Authentication
```bash
npm run test:unifi-cloud-auth
```

### 2. Test Door Control
```bash
npm run test:unifi-cloud-doors
```

### 3. Integration Testing
```bash
npm run test:unifi-integration
```

## Security Considerations

1. **Store credentials securely**: Use environment variables, never commit credentials
2. **Implement rate limiting**: Prevent abuse of door unlock endpoints
3. **Audit logging**: Log all door actions with timestamps and user info
4. **Session management**: Refresh auth tokens before expiry
5. **Error handling**: Graceful fallback if cloud connection fails

## Next Steps

1. **Immediate**: Try Tailscale (can be set up in 15 minutes)
2. **This Week**: Implement cloud API authentication
3. **Next Week**: Full cloud API implementation
4. **Testing**: Validate with actual door hardware

## Resources

- [UniFi API Documentation](https://help.ui.com/hc/en-us/articles/30076656117655)
- [Tailscale Setup Guide](https://tailscale.com/kb/1017/install)
- [UniFi Identity Enterprise](https://ui.com/identity)
- [UniFi Developer Portal](https://developer.ui.com/)

## Contact for Help

- UniFi Support: https://help.ui.com
- Tailscale Support: https://tailscale.com/contact
- ClubOS Development: [Your contact info]