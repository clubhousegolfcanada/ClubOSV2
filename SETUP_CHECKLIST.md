# Quick Setup Checklist for Slack Reply Tracking

## Prerequisites
- [ ] PostgreSQL database (Railway provides this)
- [ ] Node.js and npm installed
- [ ] Access to Slack workspace admin

## Step 1: Install Dependencies
```bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend
npm install pg
npm install --save-dev @types/pg
```

## Step 2: Set Up Environment Variables

### For Local Development:
Create `.env` file with these minimum required variables:
```env
DATABASE_URL=your_railway_postgresql_url
NODE_ENV=development
SLACK_WEBHOOK_URL=your_slack_webhook_url
SLACK_CHANNEL=#clubos-requests
JWT_SECRET=your_secret_key
```

### For Railway:
Add these in Railway dashboard → Variables:
- `NODE_ENV` = production
- `SLACK_WEBHOOK_URL` = your_webhook_url
- `SLACK_CHANNEL` = #clubos-requests
- `JWT_SECRET` = your_secret_key

## Step 3: Run Database Migration
```bash
# Make sure you're in the backend directory
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Run the migration
npx ts-node src/scripts/runMigrations.ts
```

## Step 4: Verify Setup

### Test 1: Database Connection
```bash
npx ts-node -e "
const { query } = require('./src/utils/db');
query('SELECT NOW()').then(r => {
  console.log('✅ Database connected:', r.rows[0].now);
  process.exit(0);
}).catch(e => {
  console.error('❌ Database error:', e.message);
  process.exit(1);
});
"
```

### Test 2: Check Tables Created
```bash
npx ts-node -e "
const { query } = require('./src/utils/db');
query(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\").then(r => {
  console.log('✅ Tables:', r.rows.map(r => r.table_name).join(', '));
  process.exit(0);
});
"
```

### Test 3: Slack Webhook
```bash
# Replace YOUR_WEBHOOK_URL with your actual webhook
curl -X POST -H 'Content-type: application/json' \
--data '{"text":"✅ ClubOS Slack integration test successful!"}' \
YOUR_WEBHOOK_URL
```

## Step 5: Start the Server
```bash
npm run dev
```

## Step 6: Test the Implementation

1. **Send a request to Slack**:
   - Open the ClubOS frontend
   - Turn OFF Smart Assist
   - Submit a request
   - Note the `slackThreadTs` in the response

2. **Check the database**:
```bash
npx ts-node -e "
const { query } = require('./src/utils/db');
query('SELECT * FROM slack_messages ORDER BY created_at DESC LIMIT 1').then(r => {
  console.log('Latest Slack message:', r.rows[0]);
  process.exit(0);
});
"
```

## Troubleshooting

### "Cannot find module 'pg'" Error
```bash
npm install pg @types/pg
```

### "Database connection failed" Error
- Check DATABASE_URL is correct
- Verify PostgreSQL is running
- Check network/firewall settings

### "Slack webhook failed" Error
- Verify SLACK_WEBHOOK_URL is correct
- Check Slack workspace permissions
- Ensure webhook is active in Slack app settings

### Migration Fails
- Check DATABASE_URL has correct permissions
- Verify user can CREATE TABLE
- Check for syntax errors in SQL

## Success Indicators
- ✅ Migration completes without errors
- ✅ Database has `slack_messages` and `feedback` tables
- ✅ Slack receives test message
- ✅ Requests sent to Slack return `slackThreadTs`
- ✅ `slack_messages` table contains records

## Next Steps
Once Phase 1 is working:
1. Set up Slack App for Events API (Phase 2)
2. Implement webhook endpoint
3. Update UI to show Slack replies
4. Add real-time notifications