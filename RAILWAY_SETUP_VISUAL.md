# Railway Environment Variables - Visual Guide

## 🚂 Adding Variables to Railway

### Step 1: Navigate to Your Service
```
Railway Dashboard → Your Project → Backend Service → Variables Tab
```

### Step 2: Variables to Add/Update

Since you already have PostgreSQL working (users table), you should already have:
- ✅ `DATABASE_URL` (automatically provided by Railway)
- ✅ `JWT_SECRET` 
- ✅ Other existing variables

**Now add these NEW variables:**

```bash
# 1. Click "New Variable" or "Add Variable"
# 2. Enter the name and value for each:

SLACK_CHANNEL = #clubos-assistants
NODE_ENV = production
SLACK_WEBHOOK_URL = [your webhook URL - see below]
```

### Step 3: Getting Your Slack Webhook URL

1. Go to https://api.slack.com/apps
2. Select your app or create a new one
3. In the left sidebar, click "Incoming Webhooks"
4. Turn ON "Activate Incoming Webhooks"
5. Click "Add New Webhook to Workspace"
6. Select the channel: **#clubos-assistants**
7. Copy the webhook URL (looks like: `https://hooks.slack.com/services/T.../B.../...`)

### Step 4: What Your Railway Variables Should Look Like

```
DATABASE_URL          = postgresql://postgres:xxxxx@xxxx.railway.app:5432/railway
NODE_ENV             = production
SLACK_CHANNEL        = #clubos-assistants
SLACK_WEBHOOK_URL    = https://hooks.slack.com/services/T04XXX/B04XXX/xxxxxxxxx
JWT_SECRET           = [already set]
OPENAI_API_KEY       = [already set]
PORT                 = [automatically set by Railway]
```

### Step 5: Deploy Changes

After adding variables:
1. Railway will automatically redeploy your service
2. Wait for the deployment to complete (usually 1-2 minutes)
3. Check the deployment logs for any errors

## 🧪 Testing Your Setup

### Local Testing (before deploying):
```bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Check your environment
npx ts-node src/scripts/check-env.ts

# If everything looks good, run migrations
npx ts-node src/scripts/runMigrations.ts
```

### After Railway Deployment:
1. Go to your ClubOS app
2. Turn OFF Smart Assist
3. Submit a test request
4. Check if it appears in **#clubos-assistants** channel
5. Note the `slackThreadTs` in the response

## 🔍 Verifying in Railway

### Check Deployment Logs:
```
Railway Dashboard → Your Service → Deployments → View Logs
```

Look for:
- ✅ "Slack fallback service initialized"
- ✅ "Database connection established"
- ✅ No errors about missing environment variables

### Common Issues:

**"Slack webhook URL not configured"**
→ Add `SLACK_WEBHOOK_URL` variable

**"Cannot connect to database"**
→ DATABASE_URL should be automatically set by Railway

**Messages going to wrong channel**
→ Update `SLACK_CHANNEL` to `#clubos-assistants`

## 📝 Quick Copy-Paste for Railway

Copy these variable names to quickly add them:

```
SLACK_CHANNEL
NODE_ENV
SLACK_WEBHOOK_URL
```

Values:
```
#clubos-assistants
production
[paste your webhook URL]
```