#!/bin/bash

# Create admin user for ClubOS

cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"

# Create the data directories
mkdir -p src/data/sync
mkdir -p src/data/logs
mkdir -p src/data/backups

# Create users.json with admin user
cat > src/data/users.json << 'EOF'
[
  {
    "id": "admin-001",
    "email": "admin@clubhouse247golf.com",
    "password": "$2b$10$YVn3nQ8Q2vM5FPqg3SZQT.GjGK9AVkGH8J8mUqaJHUEiDCVxDkwKe",
    "name": "Admin User",
    "role": "admin",
    "phone": "+1234567890",
    "createdAt": "2024-01-20T12:00:00.000Z",
    "updatedAt": "2024-01-20T12:00:00.000Z"
  }
]
EOF

echo "✅ Admin user created in src/data/users.json"
echo "Email: admin@clubhouse247golf.com"
echo "Password: admin123"

# Also create in sync directory
cp src/data/users.json src/data/sync/users.json

echo "✅ Files created successfully"
