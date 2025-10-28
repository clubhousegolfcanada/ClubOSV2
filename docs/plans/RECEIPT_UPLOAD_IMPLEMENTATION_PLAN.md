# 📘 ClubOS Receipt Upload + OCR Implementation Plan

## Executive Summary
Complete implementation plan for adding Receipt Upload + OCR functionality to ClubOS, fully integrated with Google Drive and the existing financial reconciliation workflow. This feature will eliminate manual receipt management and enable automated data extraction for bookkeeping.

## Current State Analysis

### Existing Infrastructure
- **Database**: PostgreSQL with existing financial tracking tables
- **Queue System**: BullMQ for async processing (used in patterns, messages)
- **Auth**: JWT-based with role permissions (staff, admin, operator)
- **File Handling**: Base64 image storage for tickets/checklists
- **UI Framework**: Next.js 15 with ClubOS design system
- **API Pattern**: Express routes with standardized error handling

### Related Systems
- **Tickets**: Photo upload with base64 storage (reference: TicketCenterV4)
- **Checklists**: Photo attachments for damage reporting
- **Terminal**: Action cards for system operations

## Implementation Architecture

### 1. Frontend Components

#### A. ReceiptUploadButton Component
**Location**: `/ClubOSV1-frontend/src/components/Terminal/ReceiptUploadButton.tsx`

```typescript
// Following existing Terminal button patterns
interface ReceiptUploadButtonProps {
  onUploadComplete?: (receipt: Receipt) => void;
  className?: string;
}

// UI Patterns to Follow:
// - Use existing modal patterns from TicketDetailModal
// - Button styling from Terminal action cards
// - Photo preview from RequestForm component
```

#### B. ReceiptUploadModal Component
**Location**: `/ClubOSV1-frontend/src/components/Terminal/ReceiptUploadModal.tsx`

```typescript
// Modal Structure (following TicketDetailModal pattern):
// 1. Header with close button
// 2. File/Camera selection
// 3. Preview with rotate/crop tools
// 4. Metadata fields (optional manual entry)
// 5. Submit button with loading state
```

#### C. ReceiptPreview Component
**Location**: `/ClubOSV1-frontend/src/components/Terminal/ReceiptPreview.tsx`

```typescript
// Features:
// - Image rotation (90° increments)
// - Basic cropping
// - Multi-page PDF assembly
// - Follows photo preview pattern from tickets
```

### 2. Backend API Routes

#### A. Upload Endpoint
**Location**: `/ClubOSV1-backend/src/routes/receipts.ts`

```typescript
POST /api/receipts/upload
// Authentication: requireAuth middleware
// Roles: staff, admin, operator
// Body: multipart/form-data or base64
// Response: { id, fileId, driveLink, status }

// Implementation steps:
// 1. Validate file (PDF/image, <10MB)
// 2. Generate SHA-256 hash for deduplication
// 3. Upload to Google Drive
// 4. Create database record
// 5. Queue OCR job
// 6. Return response with tracking ID
```

#### B. Search Endpoint
**Location**: Same file

```typescript
GET /api/receipts/search
// Query params: q, vendor, date_from, date_to, location
// Uses PostgreSQL full-text search
// Returns paginated results with OCR data
```

#### C. Status Endpoint
**Location**: Same file

```typescript
GET /api/receipts/:id/status
// Returns OCR processing status
// Includes extracted fields when complete
```

### 3. Database Schema

**Migration**: `/ClubOSV1-backend/src/database/migrations/320_receipt_upload_system.sql`

```sql
-- Main receipts table
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- File metadata
  file_id TEXT UNIQUE NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  content_hash TEXT UNIQUE,
  drive_link TEXT,

  -- Extracted data
  vendor TEXT,
  amount_cents INTEGER,
  tax_cents INTEGER,
  purchase_date DATE,
  club_location TEXT REFERENCES locations(name),
  category TEXT,
  payment_method TEXT,

  -- OCR results
  ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  ocr_text TEXT,
  ocr_json JSONB,
  ocr_confidence DECIMAL(3,2),
  ocr_processed_at TIMESTAMPTZ,

  -- Metadata
  uploader_user_id UUID REFERENCES users(id),
  notes TEXT,
  tags TEXT[],

  -- Reconciliation
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES users(id),
  xero_reference TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_receipts_vendor ON receipts USING gin(vendor gin_trgm_ops);
CREATE INDEX idx_receipts_text ON receipts USING gin(to_tsvector('english', ocr_text));
CREATE INDEX idx_receipts_date ON receipts(purchase_date);
CREATE INDEX idx_receipts_location ON receipts(club_location);
CREATE INDEX idx_receipts_status ON receipts(ocr_status) WHERE ocr_status != 'completed';
CREATE INDEX idx_receipts_hash ON receipts(content_hash);

-- Audit table for changes
CREATE TABLE receipt_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id),
  action TEXT NOT NULL,
  changed_fields JSONB,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. Google Drive Integration

**Location**: `/ClubOSV1-backend/src/services/googleDrive/receiptUploader.ts`

```typescript
// Service Account Setup:
// 1. Create service account in Google Cloud Console
// 2. Enable Drive API
// 3. Share "ClubOS Receipts Inbox" folder with service account email
// 4. Store credentials in GOOGLE_SERVICE_ACCOUNT_JSON env var

class ReceiptDriveUploader {
  private drive: drive_v3.Drive;
  private INBOX_FOLDER_ID: string;

  async uploadReceipt(file: Buffer, metadata: ReceiptMetadata): Promise<DriveFile> {
    // Naming convention: YYYYMMDD_vendor_amount_location.pdf
    // Set custom properties for ClubOS tracking
    // Return file ID and web view link
  }

  async getReceiptFile(fileId: string): Promise<Buffer> {
    // Stream file for OCR processing
  }
}
```

### 5. OCR Worker

**Location**: `/ClubOSV1-backend/src/workers/receiptOCR.ts`

```typescript
// Queue: receipts_ocr
// Processor using Google Vision API

interface OCRJob {
  receiptId: string;
  fileId: string;
  retryCount: number;
}

class ReceiptOCRProcessor {
  async process(job: OCRJob): Promise<void> {
    // 1. Fetch file from Drive
    // 2. Send to Vision API
    // 3. Parse structured data
    // 4. Update database with results
    // 5. Trigger reconciliation check if needed
  }

  private extractFields(text: string): ExtractedData {
    // Regex patterns for common receipt formats
    // Vendor detection from header lines
    // Amount extraction with currency handling
    // Date parsing with multiple formats
    // Tax calculation and separation
  }
}
```

### 6. UI/UX Integration Points

#### A. Terminal Card Integration
**File**: `/ClubOSV1-frontend/src/components/Terminal/Terminal.tsx`

```typescript
// Add to existing Terminal action buttons:
// - Upload Receipt (between Refund and System Reset)
// - Uses same button styling and hover effects
// - Opens modal on click
```

#### B. Financial Dashboard Integration
**File**: `/ClubOSV1-frontend/src/components/Financial/ReconciliationDashboard.tsx`

```typescript
// Add receipts section to reconciliation view:
// - Recent uploads with OCR status
// - Search and filter controls
// - Bulk reconciliation actions
// - Export to CSV for Xero
```

### 7. Security Considerations

1. **Authentication**: All endpoints require valid JWT
2. **Authorization**: Role-based access (staff minimum)
3. **File Validation**:
   - Max 10MB size
   - PDF/image MIME types only
   - Virus scanning via ClamAV (optional)
4. **Deduplication**: SHA-256 hash prevents duplicate uploads
5. **Rate Limiting**: 10 uploads per minute per user
6. **Data Encryption**: Sensitive financial data encrypted at rest

### 8. Testing Strategy

#### A. Unit Tests
```typescript
// Frontend:
// - Component rendering
// - File validation
// - Preview functions
// - Form submission

// Backend:
// - API endpoint validation
// - OCR field extraction
// - Database operations
// - Queue processing
```

#### B. Integration Tests
```typescript
// End-to-end flow:
// 1. Upload receipt
// 2. Verify Drive upload
// 3. Check OCR processing
// 4. Validate search results
// 5. Test reconciliation
```

### 9. Deployment Checklist

1. **Environment Variables**
```bash
# Add to Railway/Vercel:
GOOGLE_DRIVE_INBOX_FOLDER_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_VISION_API_KEY=
OCR_QUEUE_CONCURRENCY=2
MAX_RECEIPT_SIZE_MB=10
```

2. **Database Migration**
```bash
npm run db:migrate
```

3. **Google Cloud Setup**
- Enable Vision API
- Create service account
- Share Drive folder
- Set up billing alerts

4. **Monitoring**
- Add OCR queue metrics to dashboard
- Set up error alerts for failed OCR
- Monitor Drive storage usage

### 10. Implementation Phases

#### Phase 1: Core Upload (Week 1)
- [ ] Basic upload UI component
- [ ] File validation and storage
- [ ] Database schema
- [ ] Drive integration

#### Phase 2: OCR Integration (Week 2)
- [ ] Vision API setup
- [ ] OCR worker queue
- [ ] Field extraction logic
- [ ] Result storage

#### Phase 3: Search & Reconciliation (Week 3)
- [ ] Search API endpoints
- [ ] Reconciliation UI
- [ ] Bulk actions
- [ ] Export functionality

#### Phase 4: Polish & Testing (Week 4)
- [ ] Error handling
- [ ] Performance optimization
- [ ] Comprehensive testing
- [ ] Documentation

## Code Scaffolding

### Frontend Component Example
```tsx
// ReceiptUploadButton.tsx
import React, { useState } from 'react';
import { Receipt } from 'lucide-react';
import { ReceiptUploadModal } from './ReceiptUploadModal';

export const ReceiptUploadButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="terminal-button"
      >
        <Receipt className="w-5 h-5 mr-2" />
        Upload Receipt
      </button>

      {isOpen && (
        <ReceiptUploadModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onUploadComplete={(receipt) => {
            // Show success toast
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
};
```

### Backend Route Example
```typescript
// receipts.ts
router.post('/upload', requireAuth, uploadLimiter, async (req, res) => {
  try {
    const { file, metadata } = req.body;

    // Validate file
    if (!file || file.size > MAX_SIZE) {
      return res.status(400).json({ error: 'Invalid file' });
    }

    // Check for duplicates
    const hash = crypto.createHash('sha256').update(file.data).digest('hex');
    const existing = await db.receipts.findByHash(hash);
    if (existing) {
      return res.json({
        id: existing.id,
        message: 'Receipt already uploaded',
        duplicate: true
      });
    }

    // Upload to Drive
    const driveFile = await driveUploader.upload(file, metadata);

    // Create database record
    const receipt = await db.receipts.create({
      file_id: driveFile.id,
      file_name: file.name,
      content_hash: hash,
      drive_link: driveFile.webViewLink,
      uploader_user_id: req.user.id,
      ...metadata
    });

    // Queue OCR
    await ocrQueue.add('process-receipt', {
      receiptId: receipt.id,
      fileId: driveFile.id
    });

    res.json({
      id: receipt.id,
      fileId: driveFile.id,
      driveLink: driveFile.webViewLink,
      status: 'processing'
    });

  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

## Success Metrics

1. **Upload Success Rate**: >95%
2. **OCR Accuracy**: >85% for standard receipts
3. **Processing Time**: <30 seconds per receipt
4. **Deduplication Rate**: 100% prevention of duplicates
5. **User Adoption**: 80% of staff using within first month

## Maintenance & Support

1. **Monthly Tasks**:
   - Review OCR accuracy metrics
   - Clean up orphaned Drive files
   - Audit reconciliation completeness

2. **Quarterly Tasks**:
   - Update OCR extraction patterns
   - Review and optimize database indexes
   - Archive old reconciled receipts

3. **Support Documentation**:
   - User guide for staff
   - Troubleshooting guide
   - OCR improvement feedback loop

## Conclusion

This implementation plan provides a complete, production-ready Receipt Upload + OCR system that:
- Integrates seamlessly with existing ClubOS architecture
- Follows all established UI/UX patterns
- Provides robust error handling and security
- Scales to handle thousands of receipts
- Enables automated financial reconciliation

The system is designed to be maintainable, testable, and extensible for future enhancements like multi-currency support, advanced categorization, or integration with accounting software.