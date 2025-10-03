# Google OAuth Setup Guide

## Prerequisites
- Google Cloud Console account
- Admin access to Railway (backend)
- Admin access to Vercel (frontend)
- Domain verification for @clubhouse247golf.com (for operator restrictions)

## Step 1: Google Cloud Console Setup

1. **Go to [Google Cloud Console](https://console.cloud.google.com)**

2. **Create a new project or select existing**
   - Project name: `ClubOS Production` (or similar)
   - Organization: Clubhouse 24/7

3. **Enable required APIs**
   - Go to "APIs & Services" → "Enable APIs and Services"
   - Search for and enable: `Google+ API` or `Google Identity API`

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: **Web application**
   - Name: `ClubOS OAuth Client`

5. **Configure OAuth Consent Screen**
   - User type: Internal (if using Google Workspace) or External
   - App name: `ClubOS`
   - User support email: `support@clubhouse247golf.com`
   - App domain: `clubhouse247.com`
   - Authorized domains: `clubhouse247.com`
   - Developer contact: Your email

6. **Add Authorized JavaScript Origins**
   ```
   Production:
   https://club-osv-2-owqx.vercel.app
   https://club-osv-2-owqx-git-main-clubosv2s-projects.vercel.app

   Development:
   http://localhost:3001
   ```

7. **Add Authorized Redirect URIs**
   ```
   Production:
   https://clubosv2-production.up.railway.app/api/auth/google/callback

   Development:
   http://localhost:3000/api/auth/google/callback
   ```

8. **Save and copy credentials**
   - Client ID: `[YOUR_CLIENT_ID].apps.googleusercontent.com`
   - Client Secret: `[YOUR_CLIENT_SECRET]`

## Step 2: Railway Environment Variables (Backend)

Add these to your Railway service variables:

```bash
GOOGLE_CLIENT_ID=[YOUR_CLIENT_ID].apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[YOUR_CLIENT_SECRET]
GOOGLE_REDIRECT_URI=https://clubosv2-production.up.railway.app/api/auth/google/callback

# Optional: For development/testing
GOOGLE_TEST_EMAILS=test@example.com,developer@example.com
```

## Step 3: Vercel Environment Variables (Frontend)

Add these to your Vercel project settings:

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=[YOUR_CLIENT_ID].apps.googleusercontent.com
NEXT_PUBLIC_FRONTEND_URL=https://club-osv-2-owqx.vercel.app
```

## Step 4: Local Development Setup

### Backend `.env` file:
```bash
# Google OAuth
GOOGLE_CLIENT_ID=[YOUR_CLIENT_ID].apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[YOUR_CLIENT_SECRET]
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_TEST_EMAILS=your.email@example.com  # For testing without domain restriction
```

### Frontend `.env.local` file:
```bash
# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=[YOUR_CLIENT_ID].apps.googleusercontent.com
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3001
```

## Step 5: Database Migration

Run the migration to add OAuth columns to the database:

### Production (via Railway):
```bash
railway run npm run db:migrate
```

### Local Development:
```bash
cd ClubOSV1-backend
npm run db:migrate
```

## Step 6: Domain Verification (For @clubhouse247golf.com restriction)

1. **Verify domain ownership in Google Cloud Console**
   - Go to "APIs & Services" → "Domain verification"
   - Add `clubhouse247.com`
   - Follow Google's verification process (DNS TXT record)

2. **Configure Google Workspace (if applicable)**
   - Ensure @clubhouse247golf.com emails are part of Google Workspace
   - This enables single sign-on for operators

## Step 7: Testing

1. **Run the test script**:
   ```bash
   ./scripts/test-google-oauth.sh
   ```

2. **Start development servers**:
   ```bash
   # Terminal 1
   cd ClubOSV1-backend && npm run dev

   # Terminal 2
   cd ClubOSV1-frontend && npm run dev
   ```

3. **Test login flows**:
   - Go to http://localhost:3001/login
   - Test operator login with @clubhouse247golf.com account
   - Switch to customer mode and test with regular Gmail account

## Features

### For Operators
- **Domain Restriction**: Only @clubhouse247golf.com emails can sign in
- **Single Sign-On**: Uses existing Google Workspace accounts
- **Remember Me**: 30-day tokens when checked, 7-day without

### For Customers
- **Open Registration**: Any valid Google account works
- **Auto-Approval**: Accounts are automatically approved
- **Profile Creation**: Customer profiles created with Google profile picture
- **Remember Me**: 90-day tokens when checked, 24-hour without

## Troubleshooting

### Common Issues

1. **"Domain not allowed" error**
   - Ensure email domain is in `ALLOWED_DOMAINS` in `googleAuth.ts`
   - Verify domain in Google Cloud Console
   - Check `GOOGLE_TEST_EMAILS` for development

2. **Redirect URI mismatch**
   - Ensure `GOOGLE_REDIRECT_URI` matches exactly in Google Console
   - Include protocol (http/https) and path
   - No trailing slashes

3. **404 on callback**
   - Verify routes are registered in `backend/src/index.ts`
   - Check that migration has run (OAuth columns exist)
   - Ensure backend server is running

4. **No Google button showing**
   - Check `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set in frontend
   - Verify component is imported in login page
   - Check browser console for errors

## Security Considerations

1. **Never commit credentials** - Use environment variables only
2. **Rotate secrets regularly** - Especially if exposed
3. **Use HTTPS in production** - OAuth requires secure connections
4. **Validate tokens server-side** - Don't trust client-side verification
5. **Monitor OAuth audit logs** - Check `oauth_login_audit` table

## Support

For issues or questions:
- Check logs: `railway logs` for backend errors
- Review audit table: `SELECT * FROM oauth_login_audit ORDER BY created_at DESC`
- Contact: Development team or create GitHub issue