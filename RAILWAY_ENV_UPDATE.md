# 🚨 URGENT: Production Fix Required

## Current Issue
Production is failing to start with JWT_SECRET validation error after v1.25.9 deployment.

## Solution
Add the following environment variable to Railway to enable migration mode:

```
SECRET_MIGRATION_MODE=true
```

## Steps to Apply

### Option 1: Railway Dashboard (Recommended)
1. Go to Railway Dashboard
2. Select "ClubOS Backend" service
3. Navigate to "Variables" tab
4. Click "Add Variable"
5. Add:
   - Key: `SECRET_MIGRATION_MODE`
   - Value: `true`
6. Click "Deploy" or wait for automatic redeploy

### Option 2: Railway CLI
```bash
cd ClubOSV1-backend
railway variables set SECRET_MIGRATION_MODE=true
```

## What This Does
- Enables migration mode that accepts current 67-character secrets
- Allows production to start immediately
- Gives you until January 1, 2025 to rotate secrets
- Shows deprecation warnings in logs but doesn't block startup

## After Adding Variable
Production should start successfully within 1-2 minutes. You'll see:
- "🔄 SECRET MIGRATION MODE ACTIVE" in logs
- Deprecation warnings for weak secrets
- Normal application startup

## Next Steps (Before Jan 1, 2025)
1. Generate new secrets: `npm run generate:secrets`
2. Update Railway with new 64-character secrets
3. Remove `SECRET_MIGRATION_MODE` variable
4. All users will need to re-login after secret rotation

## Verification
Check production logs after adding the variable:
```bash
railway logs -n 50
```

Look for: "✅ Environment validation completed successfully"