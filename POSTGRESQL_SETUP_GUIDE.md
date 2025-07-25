# Setting Up PostgreSQL on Railway for ClubOS

## Current Status
✅ Your backend already has PostgreSQL packages installed
❓ Need to check if database is provisioned on Railway

## Step 1: Check Railway Dashboard

1. **Go to Railway Dashboard**
   ```
   https://railway.app/dashboard
   ```

2. **Look for your ClubOS project**
   - You should see your backend service

3. **Check for PostgreSQL**
   - Look for a PostgreSQL service/database
   - If you don't see one, we need to add it

## Step 2: Add PostgreSQL to Railway (if not present)

### Option A: Through Railway Dashboard (Easiest)
1. Click on your project
2. Click "+ New" button
3. Select "Database" 
4. Choose "PostgreSQL"
5. Railway will automatically:
   - Create the database
   - Set up connection
   - Add DATABASE_URL to your backend

### Option B: Through Railway CLI
```bash
# Install Railway CLI if needed
brew install railway

# Login
railway login

# Link to your project
railway link

# Add PostgreSQL
railway add postgresql
```

## Step 3: Verify Database Connection

Once PostgreSQL is added, Railway automatically provides:
- `DATABASE_URL` environment variable
- Full connection string
- SSL certificates

## Step 4: Quick Test Script

Create this file to test your database connection:

`test-db.js`:
```javascript
const { Sequelize } = require('sequelize');

async function testConnection() {
  try {
    // Railway provides DATABASE_URL automatically
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });

    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    
    // Test creating users table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS test_connection (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Can create tables!');
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

testConnection();
```

## Step 5: Environment Variables in Railway

Make sure these are set in your Railway backend service:

```env
# Railway provides this automatically when you add PostgreSQL
DATABASE_URL=postgresql://...

# You need to add these manually
JWT_SECRET=your-super-secret-jwt-key-change-this
NODE_ENV=production
```

## How to Check What You Have:

1. **Go to Railway Dashboard**
2. **Click on your backend service**
3. **Go to "Variables" tab**
4. **Look for DATABASE_URL**
   - If present = PostgreSQL is set up ✅
   - If missing = Need to add PostgreSQL ❌

## Quick Commands to Run:

```bash
# Check if database exists (run in backend folder)
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Test connection locally (if you have DATABASE_URL)
node -e "console.log(process.env.DATABASE_URL || 'No DATABASE_URL found')"

# If DATABASE_URL exists, test it
npm install
node test-db.js
```

## What Happens Next:

### If PostgreSQL exists on Railway:
- Your users are probably already in the database
- Just need to check/migrate

### If PostgreSQL doesn't exist:
- Add it through Railway dashboard (2 clicks)
- Railway handles everything automatically
- Then migrate your JSON users to database

## No PostgreSQL? No Problem!

If you don't want to use PostgreSQL, we can:
1. Continue with JSON files (not recommended)
2. Use SQLite (file-based database)
3. Use Railway Volumes to persist JSON (hacky but works)

Let me know what you find in your Railway dashboard!
