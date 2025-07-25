# ClubOS User Data Persistence Strategy

## Current Setup
- **Frontend**: Vercel (stateless)
- **Backend**: Railway with PostgreSQL
- **Need**: Persist user accounts between deployments

## Best Approach: PostgreSQL Database (RECOMMENDED)

### Why PostgreSQL is Best:
1. **Already in your stack** - You have PostgreSQL on Railway
2. **Secure** - Passwords properly hashed with bcrypt
3. **Scalable** - Can handle thousands of users
4. **Backed up** - Railway provides database backups
5. **Professional** - Industry standard approach

### Implementation:
```sql
-- Users table (likely already exists)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'support',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### Current Implementation Check:
Your backend likely already has this in:
- `/ClubOSV1-backend/src/models/User.js`
- `/ClubOSV1-backend/src/routes/auth.js`

## Alternative Approaches (NOT Recommended)

### 1. Railway Volumes
```javascript
// Can persist files, but NOT ideal for user data
const fs = require('fs');
const path = require('path');

// Railway volume path
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT || '/data';
const USERS_FILE = path.join(VOLUME_PATH, 'users.json');

// Problems:
// - No concurrent access control
// - No query capabilities  
// - Security concerns with plain files
// - Not scalable
```

### 2. Environment Variables
```bash
# Terrible idea for user data!
ADMIN_USER=admin@clubos.com
ADMIN_PASS_HASH=$2b$10$... # Never do this
```

### 3. External Services
- Auth0, Clerk, Supabase Auth
- Adds complexity and cost
- Overkill for internal tool

## Ensuring Data Persistence

### 1. Database Backup Strategy
```bash
# Add to your deployment process
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### 2. Seed Data for Development
Create `/ClubOSV1-backend/src/seeds/users.js`:
```javascript
const bcrypt = require('bcryptjs');

const seedUsers = [
  {
    email: 'admin@clubos.com',
    name: 'Admin User',
    password: 'ChangeMe123!', // Change in production
    role: 'admin'
  },
  {
    email: 'operator@clubos.com',
    name: 'Operator User',
    password: 'ChangeMe123!',
    role: 'operator'
  }
];

async function seedDatabase() {
  for (const user of seedUsers) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await User.findOrCreate({
      where: { email: user.email },
      defaults: {
        ...user,
        password: hashedPassword
      }
    });
  }
}
```

### 3. Add Seed Command
In `package.json`:
```json
{
  "scripts": {
    "seed": "node src/seeds/users.js",
    "start": "npm run seed && node server.js"
  }
}
```

## Implementation Checklist

1. **Verify Database Schema**
   ```bash
   # Check if users table exists
   SELECT * FROM users LIMIT 1;
   ```

2. **Add Database Backup**
   ```yaml
   # railway.toml
   [deploy]
   startCommand = "npm run migrate && npm run seed && npm start"
   ```

3. **Environment Variables in Railway**
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET=your-secret-key
   BCRYPT_ROUNDS=10
   ```

4. **Migration Script**
   ```javascript
   // migrations/001_create_users.js
   exports.up = (knex) => {
     return knex.schema.createTable('users', (table) => {
       table.uuid('id').primary();
       table.string('email').unique().notNullable();
       table.string('name');
       table.string('password_hash').notNullable();
       table.string('role').notNullable().defaultTo('support');
       table.timestamps(true, true);
     });
   };
   ```

## Quick Implementation Path

Since you likely already have user authentication working:

1. **Verify your database has user data**:
   ```sql
   -- Run this in Railway's database console
   SELECT email, role, created_at FROM users;
   ```

2. **Ensure seed data exists**:
   ```javascript
   // Add to your backend startup
   const checkAdminExists = async () => {
     const adminCount = await User.count({ where: { role: 'admin' } });
     if (adminCount === 0) {
       console.log('No admin user found, creating default admin...');
       await createDefaultAdmin();
     }
   };
   ```

3. **Add backup routine**:
   ```yaml
   # .github/workflows/backup.yml
   name: Backup Database
   on:
     schedule:
       - cron: '0 2 * * *' # Daily at 2 AM
   ```

## Security Best Practices

1. **Never store plain text passwords**
2. **Use bcrypt with salt rounds >= 10**
3. **Implement password policies**
4. **Add rate limiting to login endpoints**
5. **Log authentication attempts**
6. **Use HTTPS everywhere**
7. **Rotate JWT secrets periodically**

## Summary

Your user data should already be persisting in PostgreSQL on Railway. If users are disappearing between deployments, check:

1. Database connection is stable
2. Migrations run before app starts
3. No accidental database resets
4. Proper environment variables in Railway

The PostgreSQL database on Railway is the correct place for user data - NOT volumes, files, or environment variables.
