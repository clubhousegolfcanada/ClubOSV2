# Smart Receipts Dashboard — Full Implementation Plan

**Version**: v1.25.47
**Date**: 2026-03-08
**Scope**: Smart Gmail month-scan pipeline + Receipts Operations tab rebuild

---

## Overview

Replace the current single-card Receipts tab with a full receipt management dashboard. Add a smart multi-stage Gmail scanner that can scan an entire inbox for a selected month without wasting OCR credits on junk.

---

## PHASE A — Smart Gmail Month Scanner (Backend)

### A1. Refactor `gmailReceiptScanner.ts` — Add Smart Pipeline

**File**: `ClubOSV1-backend/src/services/gmail/gmailReceiptScanner.ts`

**New export**: `runSmartMonthScan(year: number, month: number)`

#### Stage 1: COLLECT (Gmail API — metadata only)

```typescript
// Single broad query, searches ALL labels/folders
const startDate = `${year}/${String(month).padStart(2, '0')}/01`;
const endDate = month === 12
  ? `${year + 1}/01/01`
  : `${year}/${String(month + 1).padStart(2, '0')}/01`;

const queries = [
  `in:anywhere after:${startDate} before:${endDate} has:attachment`,
  `in:anywhere after:${startDate} before:${endDate} subject:(receipt OR invoice OR order OR payment OR billing OR statement)`,
];
```

- Fetch with `format: 'metadata'` (headers + snippet only — NOT full body)
- Extract: `{id, from, subject, snippet, date, hasAttachment}` from metadata
- Deduplicate by message ID
- Skip already-processed messages (check `gmail_scanned_messages`)

**Why metadata first**: A full message fetch with attachments costs ~10x more API quota than metadata. For 1,200 emails in a month, metadata fetch takes ~30 seconds. Full fetch of all 1,200 would take 10+ minutes.

#### Stage 2: RULE ENGINE (Zero cost, instant classification)

Classify each email into: `INCLUDE`, `SKIP`, `UNCERTAIN`

**Auto-SKIP domains** (new constant `SKIP_DOMAINS`):
```typescript
const SKIP_DOMAINS = new Set([
  // Social media
  'facebook.com', 'facebookmail.com', 'twitter.com', 'x.com',
  'linkedin.com', 'instagram.com', 'tiktok.com', 'pinterest.com',
  'reddit.com', 'tumblr.com',
  // Entertainment / streaming
  'youtube.com', 'spotify.com', 'netflix.com', 'twitch.tv',
  // Marketing platforms (the platform itself, not receipts FROM these)
  'mailchimp.com', 'substack.com', 'constantcontact.com',
  'sendinblue.com', 'mailgun.com', 'sendgrid.net',
  // Dev / collaboration (not receipts)
  'github.com', 'gitlab.com', 'bitbucket.org',
  'slack.com', 'discord.com', 'notion.so', 'figma.com',
  // Job / recruiting
  'indeed.com', 'glassdoor.com', 'monster.com',
  // News / media
  'cbc.ca', 'cnn.com', 'bbc.com',
  // Internal
  'calendar-notification', 'calendar.google.com',
]);
```

**Auto-SKIP subject patterns** (new constant `SKIP_SUBJECT_PATTERNS`):
```typescript
const SKIP_SUBJECT_PATTERNS = [
  /newsletter/i, /unsubscribe/i, /weekly digest/i, /daily brief/i,
  /password reset/i, /verify your email/i, /welcome to/i,
  /invitation to/i, /shared .* with you/i, /commented on/i,
  /liked your/i, /followed you/i, /mentioned you/i,
  /out of office/i, /auto-?reply/i, /meeting invite/i,
  /calendar event/i, /reminder:/i, /re:/i,  // Skip reply chains
];
```

**Auto-INCLUDE signals** (checked in order):

1. **Learned sender reputation** — query `gmail_scanned_messages`:
   ```sql
   SELECT from_address,
     SUM(receipts_created) as total_receipts,
     COUNT(*) as total_scanned
   FROM gmail_scanned_messages
   GROUP BY from_address
   HAVING COUNT(*) >= 2
   ```
   - `receipt_rate > 0.5` → `INCLUDE` (this sender usually has receipts)
   - `total_scanned >= 5 AND total_receipts = 0` → `SKIP` (known non-receipt sender)

2. **Known vendor domains** — keep existing `VENDOR_QUERIES` list as a `Set<string>` for O(1) lookup:
   ```typescript
   const KNOWN_VENDOR_DOMAINS = new Set([
     'homedepot', 'bestbuy', 'amazon', 'ikea', 'walmart', 'costco',
     'nspower', 'bellaliant', 'bell.ca', 'eastlink', 'rogers', 'telus',
     'shopify', 'stripe', 'square', 'anthropic', 'openai', 'hubspot',
     'vistaprint', 'kent.ca', 'canadiantire', 'staples', 'google',
     'petro-canada', 'ultramar', 'apple', 'microsoft',
   ]);
   ```
   If sender domain contains any of these → `INCLUDE`

3. **Receipt keywords in subject/snippet**:
   ```typescript
   const RECEIPT_KEYWORDS = [
     'receipt', 'invoice', 'order confirm', 'payment confirm',
     'your order', 'purchase', 'transaction', 'billing',
     'statement', 'paid', 'charge', 'subscription',
     'shipping confirm', 'delivery confirm',
   ];
   ```
   If subject or snippet contains any → `INCLUDE`

4. **Snippet contains dollar amounts** — regex `\$\d+\.\d{2}` in snippet → `INCLUDE`

5. Everything else → `UNCERTAIN`

**Expected results for 1,200 emails/month:**
- ~800 SKIP (social, newsletters, internal, replies)
- ~100 INCLUDE (known vendors, receipt keywords, learned senders)
- ~300 UNCERTAIN

#### Stage 3: AI TRIAGE (GPT-4o-mini — UNCERTAIN emails only)

Batch classify UNCERTAIN emails using GPT-4o-mini (fast, cheap: ~$0.15/1M input tokens).

```typescript
// Batch 20 emails per API call
const TRIAGE_BATCH_SIZE = 20;

async function triageEmails(
  emails: Array<{from: string, subject: string, snippet: string}>
): Promise<boolean[]> {
  const prompt = `You are classifying emails for a Canadian business (Clubhouse 24/7).
For each email, answer YES if it likely contains a business receipt, invoice, or purchase confirmation. Answer NO otherwise.

Respond with a JSON array of booleans, one per email. Example: [true, false, true, ...]

Emails:
${emails.map((e, i) => `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet}`).join('\n')}`;

  // GPT-4o-mini call
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0,
  });

  // Parse boolean array from response
  const content = response.choices[0]?.message?.content || '[]';
  return JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
}
```

**Cost**: 300 UNCERTAIN emails ÷ 20 per batch = 15 API calls. At ~500 tokens/call input, ~50 tokens output = **~$0.005 total**. Essentially free.

**Expected results**: ~40 YES, ~260 NO → total to process: ~140 emails (100 INCLUDE + 40 UNCERTAIN-YES)

#### Stage 4: PROCESS (Full fetch + OCR — only ~140 emails)

Same processing logic as current `processMessage()`:
- Fetch full message with `format: 'full'`
- Extract attachments → OCR → PDF → insert
- Extract HTML body for bodyreceipts → GPT extract → PDF → insert
- Content hash dedup, idempotent insert

**Rate limiting**: 500ms between messages (same as current)
**Estimated time**: 140 × 0.5s = ~70 seconds for fetching, plus OCR time

#### Stage 5: LEARN (Update reputation — automatic)

Already handled by existing `gmail_scanned_messages` INSERT. Each processed message records `from_address` and `receipts_created`. The Stage 2 reputation query uses this data automatically on the next scan.

**No new table or migration needed.**

#### Progress Reporting

The smart scan should return progress updates for the frontend. Add a scan status tracking mechanism:

```typescript
interface ScanProgress {
  stage: 'collecting' | 'classifying' | 'triaging' | 'processing' | 'complete';
  totalEmails: number;
  classified: { include: number; skip: number; uncertain: number };
  triaged: { yes: number; no: number };
  processed: number;
  receiptsCreated: number;
  duplicatesSkipped: number;
}
```

Store in-memory (or Redis if available) keyed by a `scanId`. Frontend polls `GET /api/gmail/scan-progress/:scanId`.

### A2. Update `gmail-scan.ts` Route

**File**: `ClubOSV1-backend/src/routes/gmail-scan.ts`

**Changes**:
- `POST /api/gmail/scan` — add `year` and `month` body params. When provided, call `runSmartMonthScan(year, month)` instead of `runGmailScan(startDate)`.
- `GET /api/gmail/scan-progress/:scanId` — new endpoint, returns current `ScanProgress` object for a running scan.

```typescript
router.post('/scan', authenticate, async (req, res) => {
  const { user } = req as any;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const { year, month, startDate } = req.body;

  try {
    if (year && month) {
      // Smart month scan — returns scanId immediately, processes in background
      const scanId = await startSmartMonthScan(year, month);
      res.json({ success: true, data: { scanId, message: 'Scan started' } });
    } else {
      // Legacy vendor-query scan
      const result = await runGmailScan(startDate);
      res.json({ success: true, data: result });
    }
  } catch (error) {
    logger.error('Gmail scan failed:', error);
    res.status(500).json({ error: 'Gmail scan failed' });
  }
});

router.get('/scan-progress/:scanId', authenticate, async (req, res) => {
  const progress = getScanProgress(req.params.scanId);
  if (!progress) {
    return res.status(404).json({ error: 'Scan not found' });
  }
  res.json({ success: true, data: progress });
});
```

### A3. Update `receipts-simple.ts` — Enhanced Summary

**File**: `ClubOSV1-backend/src/routes/receipts-simple.ts`

**GET /api/receipts/summary** — add HST total + category breakdown to response:

```sql
-- Add to existing summary query:
COALESCE(SUM(hst_cents), 0) as total_hst_cents

-- New category breakdown query:
SELECT
  COALESCE(category, 'Uncategorized') as category,
  COUNT(*) as count,
  COALESCE(SUM(amount_cents), 0) as total_cents
FROM receipts
WHERE [date filters]
GROUP BY category
ORDER BY total_cents DESC
```

**New response shape**:
```json
{
  "totalReceipts": 47,
  "totalAmount": 12340.56,
  "totalTax": 1234.05,
  "totalHst": 1604.27,
  "dateRange": { "from": "2026-03-01", "to": "2026-03-31" },
  "unreconciled": 12,
  "categories": [
    { "category": "Supplies", "count": 18, "total": 4560.00 },
    { "category": "Equipment", "count": 8, "total": 3200.00 },
    ...
  ],
  "lastExport": null
}
```

### A4. Update `receipts-simple.ts` — Enhanced Search

**GET /api/receipts/search** — add missing columns to SELECT:

```sql
-- Add to existing SELECT:
r.source,
r.hst_cents,
r.hst_reg_number,
r.tax_cents,
r.category,
r.mime_type,
r.is_personal_card,
r.notes
```

Add `source` filter parameter:
```typescript
if (source) {
  conditions.push(`r.source = $${paramIndex++}`);
  params.push(source);
}
if (category) {
  conditions.push(`r.category = $${paramIndex++}`);
  params.push(category);
}
```

---

## PHASE B — Receipts Dashboard (Frontend)

### B1. Component Architecture

**File**: `ClubOSV1-frontend/src/components/operations/receipts/OperationsReceipts.tsx`

Complete rewrite. New layout:

```
┌──────────────────────────────────────────────────────────────┐
│  ← Feb 2026        [  March 2026  ▼]         Apr 2026 →    │  ← MonthPicker
├────────────────────────────┬─────────────────────────────────┤
│  Gmail Scan Card           │  Monthly Summary Card           │
│  ┌──────────────────────┐  │  ┌───────────────────────────┐  │
│  │ [Scan March 2026]    │  │  │ 47 receipts               │  │
│  │                      │  │  │ Total: $12,340.56          │  │
│  │ Last scan: 2h ago    │  │  │ HST:   $1,604.27          │  │
│  │ 234 emails checked   │  │  │ Unreconciled: 12          │  │
│  │ 89 receipts found    │  │  │                           │  │
│  │ Stage: Complete ✓    │  │  │ Supplies    34%  $4,200   │  │
│  │                      │  │  │ Equipment   26%  $3,200   │  │
│  │ Top senders:         │  │  │ Food        15%  $1,850   │  │
│  │  Home Depot (12)     │  │  │ Utilities   12%  $1,480   │  │
│  │  Costco (8)          │  │  │ Other       13%  $1,610   │  │
│  └──────────────────────┘  │  └───────────────────────────┘  │
├────────────────────────────┴─────────────────────────────────┤
│  Filters: [Category ▼] [Location ▼] [Source ▼] [Status ▼]  │
├──────────────────────────────────────────────────────────────┤
│  ☐  Date ↕   Vendor ↕   Amount ↕  HST    Cat     Loc  Src  │  ← ReceiptTable
│  ──────────────────────────────────────────────────────────  │
│  ☐  Mar 2   Home Depot  $234.56   $30.49 Supply  Bed  📧   │
│  ☐  Mar 3   Costco       $89.12   $11.59 Food    Dart 📱   │
│  ☐  Mar 5   NS Power    $412.00   $53.56 Util    Bed  📧   │
│  ☐  Mar 7   Unknown      $45.00    $5.85 Other   Bed  📱   │
│  ...                                                        │
│  ☐  Mar 28  Staples     $123.45   $16.05 Office  Truro📧   │
│  ──────────────────────────────────────────────────────────  │
│  Showing 1-20 of 47         [← Prev]  Page 1 of 3  [Next →]│
├──────────────────────────────────────────────────────────────┤
│  [☑ Reconcile Selected (3)]     [Export CSV]    [Export ZIP] │  ← ActionBar
└──────────────────────────────────────────────────────────────┘
```

### B2. New Components to Create

All in `ClubOSV1-frontend/src/components/operations/receipts/`:

| Component | File | ~Lines | Purpose |
|-----------|------|--------|---------|
| `OperationsReceipts.tsx` | Rewrite | ~120 | Main orchestrator: state, month picker, layout |
| `GmailScanCard.tsx` | New | ~150 | Scan trigger, progress, stats, top senders |
| `MonthlySummaryCard.tsx` | New | ~100 | Totals, HST, unreconciled count, category bars |
| `ReceiptTable.tsx` | New | ~250 | Sortable table, checkbox select, pagination, inline status |
| `ReceiptFilters.tsx` | New | ~80 | Category/location/source/status filter dropdowns |

**Keep existing**: `ReceiptExportCard.tsx` — moves into the action bar as export buttons (simplified, no longer a standalone card)

### B3. Component Details

#### `OperationsReceipts.tsx` — Main Orchestrator

```typescript
// State managed at this level, passed down as props
interface ReceiptsPageState {
  // Month selection
  selectedYear: number;       // default: current year
  selectedMonth: number;      // default: current month (1-12)

  // Data
  receipts: Receipt[];
  summary: ReceiptSummary | null;
  gmailStatus: GmailStatus | null;
  scanProgress: ScanProgress | null;

  // Table state
  page: number;
  totalPages: number;
  totalReceipts: number;
  sortBy: string;             // 'purchase_date' | 'vendor' | 'amount_cents' | 'created_at'
  sortDir: 'asc' | 'desc';
  selectedIds: Set<string>;   // checked receipt IDs for bulk actions

  // Filters
  filters: {
    category: string | null;
    location: string | null;
    source: string | null;    // 'terminal' | 'gmail_attachment' | 'gmail_body'
    reconciled: string | null; // 'true' | 'false'
  };

  // Loading states
  loadingReceipts: boolean;
  loadingSummary: boolean;
  scanRunning: boolean;
}
```

**Data fetching**:
- On mount + whenever `selectedYear`, `selectedMonth`, `page`, `sortBy`, `sortDir`, or `filters` change:
  - `GET /api/receipts/search?date_from=2026-03-01&date_to=2026-03-31&page=1&limit=20&sort=purchase_date&dir=desc`
  - `GET /api/receipts/summary?period=month&year=2026&month=3`
- On mount (once):
  - `GET /api/gmail/status`
- While `scanRunning`:
  - Poll `GET /api/gmail/scan-progress/:scanId` every 2 seconds

**Month navigation**:
```typescript
const goToPrevMonth = () => {
  if (selectedMonth === 1) {
    setSelectedYear(y => y - 1);
    setSelectedMonth(12);
  } else {
    setSelectedMonth(m => m - 1);
  }
  setPage(1); // Reset pagination
};
```

#### `GmailScanCard.tsx`

**Props**: `{ year, month, scanProgress, gmailStatus, onScanStart }`

**UI States**:

1. **Idle** — Show "Scan [Month Year]" button + last scan stats
2. **Scanning — Collecting** — "Searching inbox..." with email count climbing
3. **Scanning — Classifying** — "Classifying 1,200 emails..." with INCLUDE/SKIP/UNCERTAIN counts
4. **Scanning — Triaging** — "AI reviewing 300 uncertain emails..." with progress
5. **Scanning — Processing** — "Extracting receipts..." with receipts found count
6. **Complete** — "Done! 23 new receipts found" with summary

**Progress bar**: Simple horizontal bar showing `processed / totalToProcess`

**Top senders section**: List top 5 senders from `gmailStatus.topSenders` with receipt counts

#### `MonthlySummaryCard.tsx`

**Props**: `{ summary, loading }`

**Display**:
- Receipt count (large number)
- Total amount (formatted: `$12,340.56`)
- HST total (formatted)
- Unreconciled count (with orange badge if > 0)
- Category breakdown — simple horizontal bars (no chart library):
  ```
  Supplies    ████████████████  34%  $4,200.00
  Equipment   ████████████      26%  $3,200.00
  Food        ███████           15%  $1,850.00
  ```
  Each bar is a `<div>` with `width: ${percentage}%` and `bg-[var(--accent)]`

#### `ReceiptTable.tsx`

**Props**: `{ receipts, page, totalPages, sortBy, sortDir, selectedIds, onSort, onPageChange, onSelect, onSelectAll, loading }`

**Columns**:
| Column | Sortable | Width | Format |
|--------|----------|-------|--------|
| Checkbox | No | 40px | Select for bulk action |
| Date | Yes (`purchase_date`) | 80px | `Mar 2` |
| Vendor | Yes (`vendor`) | auto | Text, truncate at 25ch |
| Amount | Yes (`amount_cents`) | 90px | `$234.56` |
| HST | No | 70px | `$30.49` or `—` |
| Category | No | 90px | Badge style |
| Location | No | 70px | Abbreviated: `Bed`, `Dart`, `BL`, `Tru`, `Strat`, `RO` |
| Source | No | 40px | Icon: 📧 gmail, 📱 terminal |
| Status | No | 40px | ✓ green (reconciled) or ○ gray |

**Sort behavior**: Click column header toggles `asc → desc → asc`. Active sort column has arrow indicator.

**Pagination**: `[← Prev] Page 1 of 3 [Next →]` — standard pattern

**Empty state**: "No receipts for [Month Year]. Scan Gmail or upload receipts from the terminal."

**Row click**: Future enhancement (expand to show PDF preview / line items). For now, no-op.

#### `ReceiptFilters.tsx`

**Props**: `{ filters, onChange }`

Four dropdown selects in a row:

1. **Category**: All | Supplies | Equipment | Services | Food | Office | Utilities | Fuel | Software | Other
2. **Location**: All | Bedford | Dartmouth | Bayers Lake | Truro | Stratford | River Oaks
3. **Source**: All | Terminal | Gmail Attachment | Gmail Body
4. **Status**: All | Reconciled | Unreconciled

Each is a simple `<select>` with `onChange` calling parent state update. Matches existing select styling from `ReceiptExportCard`.

### B4. Action Bar (Bottom of ReceiptTable)

Inline at the bottom of the table component:

```typescript
<div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
  <div>
    {selectedIds.size > 0 && (
      <button onClick={handleBulkReconcile} className="...">
        <Check className="w-4 h-4" />
        Reconcile Selected ({selectedIds.size})
      </button>
    )}
  </div>
  <div className="flex gap-2">
    <button onClick={() => handleExport('csv')} className="...">
      Export CSV
    </button>
    <button onClick={() => handleExport('zip')} className="...">
      Export ZIP
    </button>
  </div>
</div>
```

Export uses existing `GET /api/receipts/export?period=month&year=X&month=Y&format=csv` endpoint with blob download.

Bulk reconcile uses existing `POST /api/receipts/reconcile` with `{ receiptIds: [...selectedIds] }`.

---

## PHASE C — Backend Small Fixes

### C1. Summary Endpoint Enhancements

**File**: `ClubOSV1-backend/src/routes/receipts-simple.ts`

Add to `GET /summary`:
```sql
-- After existing summary query, add:

-- HST total
COALESCE(SUM(hst_cents), 0) as total_hst_cents

-- Unreconciled count
COUNT(*) FILTER (WHERE reconciled = false OR reconciled IS NULL) as unreconciled_count

-- Category breakdown (separate query)
SELECT
  COALESCE(category, 'Uncategorized') as category,
  COUNT(*) as count,
  COALESCE(SUM(amount_cents), 0) as total_cents
FROM receipts
WHERE [same date filters]
GROUP BY category
ORDER BY total_cents DESC
LIMIT 10
```

### C2. Search Endpoint Enhancements

**File**: `ClubOSV1-backend/src/routes/receipts-simple.ts`

Add columns to `GET /search` SELECT:
- `r.source`
- `r.hst_cents`
- `r.tax_cents`
- `r.category`
- `r.is_personal_card`

Add filter params:
- `source` — filter by receipt source
- `category` — filter by category
- `sort` + `dir` — sortable columns (purchase_date, vendor, amount_cents, created_at)

### C3. Scan Progress Storage

**File**: `ClubOSV1-backend/src/services/gmail/gmailReceiptScanner.ts`

In-memory Map for scan progress (no Redis dependency):

```typescript
const scanProgressMap = new Map<string, ScanProgress>();

export function getScanProgress(scanId: string): ScanProgress | null {
  return scanProgressMap.get(scanId) || null;
}

// Auto-cleanup after 1 hour
function setScanProgress(scanId: string, progress: ScanProgress) {
  scanProgressMap.set(scanId, progress);
  if (progress.stage === 'complete') {
    setTimeout(() => scanProgressMap.delete(scanId), 3600_000);
  }
}
```

---

## Implementation Order

### Step 1: Backend — Smart Scanner + Progress (Phase A)
1. Add smart pipeline functions to `gmailReceiptScanner.ts`
2. Add scan progress endpoints to `gmail-scan.ts`
3. Update summary endpoint in `receipts-simple.ts` (HST, categories, unreconciled)
4. Update search endpoint in `receipts-simple.ts` (new columns, filters, sort)
5. Run `npx tsc --noEmit` — verify clean

### Step 2: Frontend — Dashboard Components (Phase B)
1. Create `ReceiptFilters.tsx`
2. Create `ReceiptTable.tsx`
3. Create `MonthlySummaryCard.tsx`
4. Create `GmailScanCard.tsx`
5. Rewrite `OperationsReceipts.tsx` to compose everything
6. Test locally on `:3001`

### Step 3: Version Bump + Deploy
1. Update CHANGELOG.md → v1.25.47
2. Update README.md version
3. Commit and push (auto-deploys)

---

## Files Changed / Created

### Backend (Modified)
| File | Change |
|------|--------|
| `src/services/gmail/gmailReceiptScanner.ts` | Add `runSmartMonthScan()`, Stage 2 classifier, Stage 3 triage, progress tracking |
| `src/routes/gmail-scan.ts` | Add `year/month` params, add `GET /scan-progress/:scanId` |
| `src/routes/receipts-simple.ts` | Enhanced summary (HST, categories, unreconciled), enhanced search (new columns, filters, sort) |

### Frontend (Modified/Created)
| File | Change |
|------|--------|
| `src/components/operations/receipts/OperationsReceipts.tsx` | **Rewrite** — full dashboard orchestrator |
| `src/components/operations/receipts/GmailScanCard.tsx` | **New** — scan trigger + progress + stats |
| `src/components/operations/receipts/MonthlySummaryCard.tsx` | **New** — month totals + category bars |
| `src/components/operations/receipts/ReceiptTable.tsx` | **New** — sortable paginated table |
| `src/components/operations/receipts/ReceiptFilters.tsx` | **New** — filter dropdowns |

### No New Dependencies
- GPT-4o-mini already available via existing `openai` package
- No chart libraries — pure CSS bars
- No new npm packages

### No New Migrations
- All needed columns already exist (`source`, `hst_cents`, `category`, etc.)
- `gmail_scanned_messages` already has `from_address` + `receipts_created` for reputation

---

## Cost Analysis

| Operation | Per Month | Cost |
|-----------|-----------|------|
| Gmail metadata fetch (1,200 emails) | 1,200 API calls | Free (quota only) |
| GPT-4o-mini triage (~300 uncertain) | 15 batch calls | ~$0.005 |
| GPT-4o OCR (~80 actual receipts) | 80 calls | ~$2.40 |
| **Total** | | **~$2.41/month** |

vs. WellyBox at $15-30/month, with less control and no location/HST features.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Gmail API rate limits | 500ms delay between messages, metadata-first approach |
| GPT-4o-mini triage accuracy | Conservative — when in doubt, classify as YES (OCR is cheap vs missing a receipt) |
| Large inbox month (3,000+ emails) | Stage 2 rules filter ~70% instantly; progress UI keeps admin informed |
| Scan takes too long | Background processing with progress polling; admin can navigate away |
| False positives (non-receipts processed) | Content hash prevents duplicates; admin can delete from table |
| OAuth token expiry mid-scan | Existing token refresh handler in `getGmailService()` |
