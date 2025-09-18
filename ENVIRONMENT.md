# Environment Variables Configuration

## Frontend (.env.local)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | - | Backend API URL (e.g., http://localhost:3001) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Yes | - | Push notification public key |

## Backend (.env)

### Core Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JWT_SECRET` | Yes | - | Secret key for JWT token generation |
| `PORT` | No | 3001 | Server port |
| `NODE_ENV` | No | development | Environment (development/production) |

### AI & Integration Services

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | No | - | GPT-4 API access key |
| `SLACK_WEBHOOK_URL` | No | - | Slack webhook for notifications |
| `HUBSPOT_API_KEY` | No | - | HubSpot CRM integration |
| `NINJAONE_API_KEY` | No | - | NinjaOne device management |
| `NINJAONE_API_URL` | No | - | NinjaOne API endpoint |

### OpenPhone Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENPHONE_API_KEY` | Yes | - | OpenPhone API key |
| `OPENPHONE_WEBHOOK_SECRET` | Yes | - | Webhook signature verification |
| `OPENPHONE_DEFAULT_NUMBER` | Yes | - | Default sending phone number |

### Security & Encryption

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENCRYPTION_KEY` | Yes | - | 32-byte key for AES-256 encryption |
| `VAPID_PUBLIC_KEY` | Yes | - | Web push public key |
| `VAPID_PRIVATE_KEY` | Yes | - | Web push private key |
| `VAPID_EMAIL` | Yes | - | Contact email for push service |

### UniFi Access (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UNIFI_USE_CLOUDFLARE` | No | false | Enable Cloudflare tunnels |
| `CLOUDFLARE_ACCOUNT_ID` | No | - | Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | No | - | Cloudflare API token |
| `UNIFI_DARTMOUTH_HOST` | No | - | Dartmouth UniFi host |
| `UNIFI_DARTMOUTH_TOKEN` | No | - | Dartmouth API token |
| `UNIFI_BEDFORD_HOST` | No | - | Bedford UniFi host |
| `UNIFI_BEDFORD_USERNAME` | No | - | Bedford username |
| `UNIFI_BEDFORD_PASSWORD` | No | - | Bedford password |

## Quick Setup

### Generate Required Keys

```bash
# Generate VAPID keys for push notifications
cd ClubOSV1-backend
node scripts/generate-vapid-keys.js

# Generate encryption key
openssl rand -base64 32

# Generate JWT secret
openssl rand -base64 64
```

### Example .env Files

See `.env.example` in both frontend and backend directories for complete templates.

## Production Deployment

### Vercel (Frontend)
Environment variables are set in Vercel dashboard under Project Settings → Environment Variables.

### Railway (Backend)
Environment variables are set in Railway dashboard under Variables tab.

### Important Notes

1. **Never commit .env files** - They contain sensitive credentials
2. **Rotate keys regularly** - Especially JWT_SECRET and ENCRYPTION_KEY
3. **Use strong values** - Generate cryptographically secure random values
4. **Environment-specific** - Use different values for dev/staging/production