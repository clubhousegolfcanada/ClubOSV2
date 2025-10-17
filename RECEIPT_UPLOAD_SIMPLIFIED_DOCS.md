# Receipt Upload Feature - Simplified Implementation

## Overview
The Receipt Upload feature in ClubOS allows staff to upload and manage receipts directly from the Terminal interface. This implementation follows existing ClubOS patterns for maximum compatibility and minimal complexity.

## Key Design Decisions

### 1. Base64 Storage Pattern
- **Decision**: Store receipts as base64-encoded data in PostgreSQL
- **Rationale**: Matches existing ticket photo and checklist photo implementations
- **Benefits**:
  - No external dependencies (Google Drive, S3, etc.)
  - Consistent with existing codebase patterns
  - Simplified deployment and maintenance
  - Works immediately without API key configuration

### 2. Manual OCR Status
- **Decision**: Set OCR status to 'manual' by default
- **Rationale**: Allows immediate use without OCR integration
- **Future**: OCR can be added later as an enhancement without breaking existing functionality

### 3. 5MB File Size Limit
- **Decision**: Enforce same 5MB limit as ticket photos
- **Rationale**:
  - Consistent with existing validations
  - Prevents database bloat
  - Sufficient for receipt images/PDFs

## Component Architecture

### Frontend Components

#### ReceiptUploadButton (`/src/components/Terminal/ReceiptUploadButton.tsx`)
- Role-based access control (admin, staff, operator)
- Integrated into Terminal header next to Update Knowledge button
- Opens modal when clicked
- Shows loading state during upload

#### ReceiptUploadModalSimple (`/src/components/Terminal/ReceiptUploadModalSimple.tsx`)
- File selection via browse or camera capture
- Supports PDF and image formats (JPEG, PNG)
- Optional metadata fields:
  - Vendor name
  - Amount
  - Purchase date
  - Club location
  - Notes
- Real-time image preview
- Base64 conversion before upload

### Backend API Routes (`/src/routes/receipts-simple.ts`)

#### POST `/api/receipts/upload`
- Validates file size and format
- Stores base64 data in database
- Returns receipt ID and metadata

#### GET `/api/receipts/search`
- Search by vendor, date range, location
- Pagination support
- Filter by reconciliation status

#### GET `/api/receipts/:id`
- Retrieve full receipt with base64 data
- Include uploader information

#### PATCH `/api/receipts/:id`
- Update receipt metadata
- Mark as reconciled
- Audit logging

#### DELETE `/api/receipts/:id`
- Admin-only deletion
- Audit log before removal

## Database Schema

```sql
receipts table:
- id (UUID, primary key)
- file_data (TEXT, base64 encoded)
- file_name (TEXT)
- file_size (INTEGER)
- mime_type (TEXT)
- vendor (TEXT)
- amount_cents (INTEGER)
- purchase_date (DATE)
- club_location (TEXT)
- notes (TEXT)
- category (TEXT)
- ocr_status (TEXT, default: 'manual')
- reconciled (BOOLEAN)
- reconciled_at (TIMESTAMP)
- reconciled_by (UUID)
- uploader_user_id (UUID)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

receipt_audit_log table:
- id (UUID)
- receipt_id (UUID)
- action (TEXT)
- changed_fields (JSONB)
- user_id (UUID)
- created_at (TIMESTAMP)
```

## Usage Instructions

### For Staff/Operators

1. **Upload a Receipt**:
   - Click "Upload Receipt" button in Terminal header
   - Choose file or take photo
   - Optionally add vendor, amount, date, location
   - Click "Upload Receipt" to save

2. **Search Receipts**:
   ```typescript
   // API endpoint for searching
   GET /api/receipts/search?vendor=HomeDepot&location=Bedford
   ```

3. **View Receipt**:
   ```typescript
   // API endpoint to retrieve receipt with image
   GET /api/receipts/{id}
   ```

### For Developers

#### Adding the Button to Other Components
```tsx
import { ReceiptUploadButton } from '@/components/Terminal/ReceiptUploadButton';

// In your component
<ReceiptUploadButton
  onUploadComplete={(receipt) => {
    console.log('Receipt uploaded:', receipt);
    // Refresh your receipt list, etc.
  }}
/>
```

#### Retrieving and Displaying Receipts
```tsx
// Fetch receipts
const response = await http.get('/api/receipts/search', {
  params: {
    location: 'Bedford',
    date_from: '2024-01-01'
  }
});

// Display receipt image
const receipt = await http.get(`/api/receipts/${id}`);
if (receipt.data.file_data) {
  return <img src={receipt.data.file_data} alt={receipt.data.file_name} />;
}
```

## Security Considerations

1. **Role-Based Access**:
   - Upload: admin, staff, operator
   - Update: admin, staff
   - Delete: admin only

2. **File Validation**:
   - Type checking (PDF, JPEG, PNG only)
   - Size limit (5MB)
   - MIME type verification

3. **Audit Logging**:
   - All actions logged to receipt_audit_log
   - Includes user ID and timestamp
   - Tracks field changes

## Migration Path

### Running the Migration
```bash
cd ClubOSV1-backend
npm run db:migrate
```

### Rollback if Needed
```bash
npm run db:rollback
```

## Testing Checklist

- [ ] Upload receipt via file browser
- [ ] Upload receipt via camera (mobile)
- [ ] View uploaded receipt
- [ ] Search by vendor name
- [ ] Filter by date range
- [ ] Filter by location
- [ ] Update receipt metadata
- [ ] Mark receipt as reconciled
- [ ] Delete receipt (admin only)
- [ ] Verify role restrictions

## Future Enhancements

1. **OCR Integration** (Phase 2):
   - Add Google Vision API or Tesseract
   - Auto-extract vendor, amount, date
   - Queue processing for large files

2. **Expense Categories**:
   - Add category taxonomy
   - Auto-categorization rules
   - Spending analytics

3. **Integration with Accounting**:
   - Export to QuickBooks
   - Batch reconciliation
   - Monthly reports

4. **Mobile App**:
   - Native camera integration
   - Offline mode with sync
   - Push notifications

## Troubleshooting

### Common Issues

1. **"File size exceeds 5MB limit"**
   - Solution: Compress image before upload
   - Consider using image optimization library

2. **Receipt image not displaying**
   - Check: Is file_data field populated?
   - Verify: MIME type matches file content
   - Test: Base64 string is valid

3. **401 Unauthorized errors**
   - Verify: User has correct role (admin/staff/operator)
   - Check: JWT token is valid and not expired
   - Test: localStorage has auth token

4. **Database migration fails**
   - Check: PostgreSQL version compatibility
   - Verify: No existing receipts table
   - Run: `npm run db:rollback` if needed

## Code Patterns Used

### Existing Patterns Leveraged
1. **Base64 Storage** (from tickets/checklists)
2. **Modal Components** (from RequestForm)
3. **Role-Based Auth** (from existing middleware)
4. **Audit Logging** (from user_actions)
5. **File Validation** (from ticket photos)
6. **API Structure** (from existing routes)
7. **UI Components** (from Terminal interface)

### Consistency with ClubOS
- Uses existing color variables (`var(--accent)`, `var(--bg-primary)`)
- Follows Terminal UI patterns
- Matches existing button styles
- Consistent error handling
- Standard API response format

## Performance Notes

- Base64 adds ~33% overhead vs binary storage
- 5MB file = ~6.7MB in database
- Consider pagination for large receipt lists
- Index on vendor, purchase_date for search performance

## Deployment

This feature auto-deploys with standard ClubOS workflow:
```bash
git add -A
git commit -m "feat: add receipt upload feature"
git push origin main
```

No additional configuration required - works immediately after deployment.

---

*Last Updated: October 2024*
*ClubOS Version: 1.21.79*