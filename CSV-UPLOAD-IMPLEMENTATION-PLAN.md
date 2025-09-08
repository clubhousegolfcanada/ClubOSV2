# CSV Upload Implementation Plan for V3-PLS

## Overview
Add CSV import functionality to the V3-PLS Stats & Settings page to enable bulk pattern learning from OpenPhone conversation exports.

## How the Backend Handles Pattern Detection

### Current CSV Processing Logic

1. **Message Grouping**:
   - Groups messages into conversations based on:
     - Conversation ID (if present in CSV)
     - Phone number + 2-hour time window
     - Skips automated messages (specific IDs)

2. **Pattern Extraction per Conversation**:
   - Each conversation analyzed individually by GPT-4o
   - ONE pattern extracted per conversation (main issue/resolution)
   - Ignores greetings and closings
   - Creates generalized trigger and response template

3. **Pattern Deduplication**:
   - Checks for existing similar patterns (70% similarity)
   - If exists: Boosts confidence by 0.02
   - If new: Creates pattern with initial confidence from GPT-4o

4. **Batch Processing**:
   - Processes 10 conversations at a time
   - 2-second delay between batches (rate limiting)
   - Maximum 500 conversations per import (safety limit)

### Key Insights
- **ONE pattern per conversation** (not multiple patterns from single conversation)
- **Multiple patterns from CSV** = multiple conversations analyzed
- **100 conversations might yield 60-80 patterns** (some conversations don't produce patterns)
- **Duplicates enhance existing patterns** rather than creating new ones

## Implementation Plan

### Phase 1: Backend API Endpoint
Create missing API endpoint to expose CSV import service:

```typescript
// In enhanced-patterns.ts or new patterns-import.ts

router.post('/import/csv',
  authenticate,
  roleGuard(['admin']), // Admin only initially
  multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'text/csv') {
        cb(null, true);
      } else {
        cb(new Error('Only CSV files allowed'));
      }
    }
  }).single('file'),
  async (req, res) => {
    const csvData = req.file.buffer.toString();
    const job = await csvImportService.startImport(csvData, req.user.id);
    res.json({ jobId: job.id, status: job.status });
  }
);

router.get('/import/status/:jobId',
  authenticate,
  async (req, res) => {
    const status = csvImportService.getJobStatus(req.params.jobId);
    res.json(status);
  }
);
```

### Phase 2: Frontend UI Component

#### Location: Add new section in PatternsStatsAndSettings.tsx

```typescript
// New component: CSVImportSection
const CSVImportSection = () => {
  const [importing, setImporting] = useState(false);
  const [jobStatus, setJobStatus] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Bulk Pattern Import</h3>
          <p className="text-sm text-gray-600">Import conversations from OpenPhone CSV export</p>
        </div>
        <Upload className="h-5 w-5 text-gray-400" />
      </div>
      
      {/* Drag & Drop Zone */}
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
      >
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-900">
          Drop your CSV file here, or click to browse
        </p>
        <p className="text-xs text-gray-500 mt-1">
          OpenPhone export format • Max 10MB
        </p>
        <input type="file" accept=".csv" hidden />
      </div>
      
      {/* Import Progress */}
      {jobStatus && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Processing conversations...</span>
            <span className="text-sm text-gray-600">
              {jobStatus.conversationsAnalyzed}/{jobStatus.conversationsFound}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${(jobStatus.conversationsAnalyzed / jobStatus.conversationsFound) * 100}%` }}
            />
          </div>
          
          {/* Results Summary */}
          {jobStatus.status === 'completed' && (
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Patterns created:</span>
                <span className="ml-2 font-medium text-green-600">
                  {jobStatus.patternsCreated}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Patterns enhanced:</span>
                <span className="ml-2 font-medium text-blue-600">
                  {jobStatus.patternsEnhanced}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Info Box */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="space-y-0.5">
              <li>• Each conversation is analyzed for patterns</li>
              <li>• One pattern extracted per conversation</li>
              <li>• Duplicates boost existing pattern confidence</li>
              <li>• Processing limited to 500 conversations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Phase 3: Integration Points

#### 1. Add to PatternsStatsAndSettings tabs:
```typescript
// Add new tab
const tabs = ['Statistics', 'Settings', 'Import'];

// Add tab content
{activeTab === 'Import' && (
  <CSVImportSection 
    onImportComplete={fetchStats} // Refresh stats after import
  />
)}
```

#### 2. File Processing Flow:
```
1. User selects/drops CSV file
2. Frontend validates file (size, type)
3. Upload to /api/patterns/import/csv
4. Receive job ID
5. Poll /api/patterns/import/status/:jobId every 2s
6. Display progress (conversations analyzed, patterns created)
7. Show completion summary
8. Refresh pattern list and stats
```

### Phase 4: UI/UX Considerations

#### Pre-Import Validation:
- Show preview of first 5 rows
- Detect column headers (must have: id, conversationBody, direction, from, to, sentAt)
- Warn if wrong format

#### During Import:
- Real-time progress bar
- Cancel button (future enhancement)
- Prevent navigation away with confirmation

#### Post-Import:
- Success notification
- Link to view new patterns
- Summary statistics
- Option to download import report

### Phase 5: Error Handling

```typescript
const errorMessages = {
  'INVALID_FORMAT': 'CSV format not recognized. Please use OpenPhone export.',
  'NO_CONVERSATIONS': 'No valid conversations found in file.',
  'RATE_LIMITED': 'Too many imports. Please wait before trying again.',
  'FILE_TOO_LARGE': 'File exceeds 10MB limit.',
  'NO_PATTERNS_FOUND': 'No patterns could be extracted from conversations.'
};
```

### Phase 6: Security & Permissions

1. **Role-based access**:
   - Initially admin-only
   - Later: operator with approval workflow

2. **Rate limiting**:
   - 1 import per user per hour
   - Maximum 10MB file size
   - Maximum 500 conversations per import

3. **Validation**:
   - Sanitize CSV content
   - Validate required columns
   - Check for malicious patterns

## Database Considerations

Tables already exist:
- `pattern_import_jobs` - Track import status
- `imported_messages` - Deduplication
- `decision_patterns` - Pattern storage

No migrations needed!

## Testing Plan

1. **Test CSV formats**:
   - Valid OpenPhone export
   - Missing columns
   - Empty conversations
   - Large files (500+ conversations)

2. **Pattern extraction**:
   - Verify one pattern per conversation
   - Check deduplication logic
   - Validate confidence boosting

3. **UI/UX**:
   - Drag & drop functionality
   - Progress updates
   - Error states
   - Success states

## Implementation Timeline

- **Day 1**: Backend API endpoints (2-3 hours)
- **Day 2**: Frontend UI component (3-4 hours)
- **Day 3**: Integration and testing (2-3 hours)
- **Day 4**: Error handling and polish (2 hours)

Total: ~12 hours of development

## Future Enhancements

1. **Pattern preview** before import
2. **Selective import** (choose which patterns to create)
3. **Undo import** functionality
4. **Export patterns** to CSV
5. **Import from other sources** (Slack, email)
6. **Automatic scheduled imports** via API
7. **Pattern quality scoring** during import
8. **Conflict resolution** for similar patterns

## Notes on CSV Format

Expected columns from OpenPhone export:
```csv
id,conversationBody,direction,from,to,sentAt
msg_123,"Hello, I need help",incoming,+16035551234,+16035555678,2024-01-15T10:30:00Z
msg_124,"Hi! How can I help you today?",outgoing,+16035555678,+16035551234,2024-01-15T10:31:00Z
```

The system will:
- Group these by conversation
- Extract patterns from operator responses
- Create reusable templates with variables
- Learn from real interactions only