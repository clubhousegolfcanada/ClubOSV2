# Setup Custom Domain for ClubOS

## Quick Setup Guide for clubos.clubhouse247golf.com

### Step 1: Add Domain to Vercel (2 minutes)

Run this command in Warp:
```bash
# Add custom domain to your Vercel project
vercel domains add clubos.clubhouse247golf.com --project club-osv-2-owqx
```

If that doesn't work, try:
```bash
# Login to Vercel first
vercel login

# Then add the domain
vercel domains add clubos.clubhouse247golf.com
```

### Step 2: Get DNS Configuration

After adding the domain, Vercel will show you one of these options:

**Option A - CNAME Record (Recommended)**
```
Type: CNAME
Name: clubos
Value: cname.vercel-dns.com
```

**Option B - A Record**
```
Type: A
Name: clubos
Value: 76.76.21.21
```

### Step 3: Add DNS Record to Your Domain Provider

You'll need to add this DNS record wherever clubhouse247golf.com is registered (GoDaddy, Namecheap, Cloudflare, etc.)

1. Log into your domain provider
2. Find DNS Management or DNS Settings
3. Add a new record with the values from Step 2
4. Save changes

### Step 4: Wait and Verify (5-30 minutes)

DNS changes can take a few minutes to propagate. Check status:
```bash
# Check if DNS is working
dig clubos.clubhouse247golf.com

# Or use nslookup
nslookup clubos.clubhouse247golf.com
```

### Alternative: Using Vercel Dashboard (If CLI doesn't work)

1. Go to https://vercel.com/dashboard
2. Select your "club-osv-2-owqx" project
3. Go to Settings → Domains
4. Click "Add Domain"
5. Enter: clubos.clubhouse247golf.com
6. Follow the instructions shown

### Troubleshooting

If the domain doesn't work after 30 minutes:
- Make sure you added the DNS record to the correct domain
- Check that there are no conflicting records
- Verify the domain in Vercel dashboard shows as "Valid Configuration"

## Result

Once complete, users can access ClubOS at:
- https://clubos.clubhouse247golf.com (custom domain)
- https://club-osv-2-owqx.vercel.app (still works as backup)

Both URLs will show the same ClubOS application!