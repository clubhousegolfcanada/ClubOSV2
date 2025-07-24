# ClubOS Backup & Restore Documentation

## Overview
The ClubOS backup and restore functionality allows administrators to create complete system backups and restore from previous backups. This is accessible through the Operations page UI or via API endpoints.

## Features

### Backup
- Creates a complete snapshot of all system data
- Includes:
  - User accounts and profiles
  - User activity logs
  - Authentication logs
  - System configuration
  - Feedback data (both helpful and not helpful)
- Downloads as a JSON file with timestamp
- Version tracking for compatibility

### Restore
- Upload a backup file through the UI
- Validates backup structure before restoring
- Overwrites existing data with backup data
- Refreshes UI automatically after restore

## UI Usage

### Creating a Backup
1. Navigate to `/operations` (Operations Center)
2. Click the "Backup" button in the top-right corner
3. A JSON file will automatically download with the format: `clubos_backup_YYYY-MM-DD.json`

### Restoring from Backup
1. Navigate to `/operations` (Operations Center)
2. Click the "Restore" button in the top-right corner
3. Select your backup JSON file
4. Confirm the restore action when prompted
5. The system will restore all data and refresh the page

## API Usage

### Authentication
All backup/restore endpoints require:
- Valid authentication token
- Admin role

### Endpoints

#### GET /api/backup
Creates and returns a complete system backup.

**Headers:**
```
Authorization: Bearer <your-admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "userLogs": [...],
    "authLogs": [...],
    "systemConfig": {...},
    "notUsefulFeedback": [...],
    "allFeedback": [...],
    "timestamp": "2024-01-20T12:00:00.000Z",
    "version": "1.1"
  }
}
```

#### POST /api/backup/restore
Restores system from a backup file.

**Headers:**
```
Authorization: Bearer <your-admin-token>
Content-Type: application/json
```

**Body:**
The complete backup JSON object.

**Response:**
```json
{
  "success": true,
  "message": "Data restored successfully"
}
```

## Backup File Structure

```json
{
  "users": [
    {
      "id": "user-id",
      "email": "user@example.com",
      "name": "User Name",
      "role": "admin|operator|support",
      "phone": "+1234567890",
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z"
    }
  ],
  "userLogs": [
    {
      "userId": "user-id",
      "action": "login",
      "timestamp": "2024-01-20T12:00:00.000Z",
      "details": {}
    }
  ],
  "authLogs": [...],
  "systemConfig": {
    "llmEnabled": true,
    "slackFallbackEnabled": true,
    "maxRetries": 3,
    "requestTimeout": 30000,
    "dataRetentionDays": 90
  },
  "notUsefulFeedback": [...],
  "allFeedback": [...],
  "timestamp": "2024-01-20T12:00:00.000Z",
  "version": "1.1"
}
```

## Testing

### Manual Testing
1. Create a test backup through the UI
2. Make some changes (add a user, change settings)
3. Restore from the backup
4. Verify the changes were reverted

### Automated Testing
Run the included test script:
```bash
# Set your admin token
export CLUBOS_TOKEN='your-admin-token'

# Run the test
./test-backup-restore.js
```

## Security Considerations

1. **Access Control**: Only administrators can access backup/restore functionality
2. **Data Sensitivity**: Backup files contain all user data including hashed passwords
3. **Storage**: Store backup files securely and encrypt if necessary
4. **Version Compatibility**: Check version field before restoring old backups

## Best Practices

1. **Regular Backups**: Schedule regular backups (daily/weekly)
2. **Before Major Changes**: Always backup before system updates
3. **Test Restores**: Periodically test restore functionality
4. **Secure Storage**: Store backups in secure, encrypted locations
5. **Retention Policy**: Define how long to keep backups
6. **Documentation**: Document what changes were made between backups

## Troubleshooting

### Backup Fails
- Check admin permissions
- Verify token is valid
- Check server logs for specific errors

### Restore Fails
- Verify backup file is valid JSON
- Check file isn't corrupted
- Ensure version compatibility
- Verify admin permissions

### Missing Data After Restore
- Check backup file contains expected data
- Verify no errors during restore process
- Check server logs for warnings

## Version History

- **v1.0**: Initial backup/restore with core data
- **v1.1**: Added feedback data to backups
