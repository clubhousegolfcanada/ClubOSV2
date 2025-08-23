# Backend Scripts

This directory contains utility scripts for managing the ClubOS backend.

## fix-alanna-account.js

A utility script for managing Alanna's account. This script:
- Checks if the account exists
- Allows creating the account if it doesn't exist
- Can reset the password if needed
- Updates account status to active

### Usage

```bash
cd ClubOSV1-backend
node scripts/fix-alanna-account.js
```

The script will prompt you for:
- Whether to create the account (if it doesn't exist)
- Password for new account creation
- Whether to reset the password (if account exists)
- New password for reset

### Security Notes

- Passwords are never hardcoded in the script
- All passwords are prompted for at runtime
- Passwords are hashed using bcrypt before storage
- No sensitive information is logged to console

### Requirements

- Node.js
- PostgreSQL connection (via DATABASE_URL in .env)
- Required npm packages: pg, bcryptjs, dotenv