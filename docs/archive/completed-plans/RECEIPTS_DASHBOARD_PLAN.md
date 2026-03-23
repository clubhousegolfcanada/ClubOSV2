# Receipts Dashboard — Implementation Plan

**Version**: v1.25.48
**Date**: 2026-03-08
**Status**: Ready for implementation

---

## Goal

Replace the single ReceiptExportCard with a full receipts management dashboard in the Operations > Receipts tab. Browse receipts by month, see totals, filter, sort, bulk reconcile, export, and trigger Gmail scans.

---

## Pre-Implementation Conflict Check

### Verified: No Conflicts

| Concern | Status | Notes |
|---------|--------|-------|
| ReceiptExportCard still imported elsewhere? | Safe | Only imported by OperationsReceipts.tsx |
| Search endpoint sort param conflicts? | Safe | Currently hardcoded `ORDER BY r.created_at DESC` — adding param is backwards-compatible |
| Summary endpoint response shape change? | Safe | Adding new fields; existing `totalReceipts`, `totalAmount`, `totalTax`, `dateRange`, `lastExport` all preserved |
| Search endpoint adding columns breaks frontend? | Safe | New columns are additive — existing consumers ignore unknown fields |
| Gmail status endpoint — does it work without Gmail configured? | Verified | Query on empty `gmail_scanned_messages` returns zeros — no crash |
| Bulk reconcile endpoint format? | Verified | `POST /receipts/reconcile` expects `{ receiptIds: [uuid...] }` — frontend will match |
| Export endpoint — works with month params? | Verified | Already accepts `year` + `month` query params |
| All DB columns exist? | Verified | `source`, `hst_cents`, `category`, `is_personal_card`, `tax_cents` all confirmed in schema |
| TypeScript imports — lucide-react icons available? | Verified | Already using Receipt, DollarSign, Calendar, MapPin, Check, Edit2, etc. |
| Lazy loading pattern — named export? | Verified | operations.tsx expects `{ OperationsReceipts }` named export via `.then(m => ({ default: m.OperationsReceipts }))` |

---

## Step 1: Backend — Enhance Summary Endpoint

**File**: `ClubOSV1-backend/src/routes/receipts-simple.ts`
**Endpoint**: `GET /api/receipts/summary`
**Lines**: 29-113

### Current SQL (line 72-80):
```sql
SELECT
  COUNT(*) as total_receipts,
  COALESCE(SUM(amount_cents), 0) as total_amount_cents,
  COALESCE(SUM(tax_cents), 0) as total_tax_cents,
  MIN(created_at) as earliest_receipt,
  MAX(created_at) as latest_receipt
FROM receipts
${dateFilter}
```

### Changes:

**1a. Add to existing SELECT:**
```sql
COALESCE(SUM(hst_cents), 0) as total_hst_cents,
COUNT(*) FILTER (WHERE reconciled = false OR reconciled IS NULL) as unreconciled_count
```

**1b. Add second query — category breakdown (same dateFilter, same queryParams):**
```sql
SELECT
  COALESCE(category, 'Uncategorized') as category,
  COUNT(*) as count,
  COALESCE(SUM(amount_cents), 0) as total_cents
FROM receipts
${dateFilter}
GROUP BY category
ORDER BY total_cents DESC
LIMIT 10
```

**1c. Add to response JSON (preserving all existing fields):**
```json
{
  "totalReceipts": 47,
  "totalAmount": 12340.56,
  "totalTax": 1234.05,
  "totalHst": 1604.27,
  "unreconciled": 12,
  "categories": [
    { "category": "Supplies", "count": 18, "total": 4560.00 }
  ],
  "dateRange": { "from": "...", "to": "..." },
  "lastExport": null
}
```

**Risk**: ReceiptExportCard.tsx reads `totalReceipts`, `totalAmount`, `totalTax`, `dateRange`, `lastExport`. All preserved — new fields are additive. No conflict.

---

## Step 2: Backend — Enhance Search Endpoint

**File**: `ClubOSV1-backend/src/routes/receipts-simple.ts`
**Endpoint**: `GET /api/receipts/search`
**Lines**: 726-861

### 2a. Add columns to SELECT (line 754-765):

Add after `r.created_at`:
```sql
r.source,
r.hst_cents,
r.tax_cents,
r.category,
r.is_personal_card
```

### 2b. Add filter params (after line 744):

Extract from query:
```typescript
const { q, vendor, date_from, date_to, location, reconciled, source, category,
        sort = 'created_at', dir = 'desc', page = 1, limit = 20 } = req.query;
```

Add filter blocks (after reconciled filter, before ORDER BY):
```typescript
if (source) {
  queryStr += ` AND r.source = $${paramIndex}`;
  params.push(source);
  paramIndex++;
}
if (category) {
  queryStr += ` AND r.category = $${paramIndex}`;
  params.push(category);
  paramIndex++;
}
```

### 2c. Add sort support (replace line 820):

```typescript
// Validate sort column to prevent SQL injection
const allowedSorts: Record<string, string> = {
  'created_at': 'r.created_at',
  'purchase_date': 'r.purchase_date',
  'vendor': 'r.vendor',
  'amount_cents': 'r.amount_cents',
};
const sortColumn = allowedSorts[sort as string] || 'r.created_at';
const sortDirection = (dir as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
queryStr += ` ORDER BY ${sortColumn} ${sortDirection}`;
```

**Risk**: Sort column is validated against a whitelist — no SQL injection. Direction is forced to ASC/DESC. Backwards-compatible (defaults to `created_at DESC`).

---

## Step 3: Frontend — Create ReceiptFilters Component

**File**: `ClubOSV1-frontend/src/components/operations/receipts/ReceiptFilters.tsx` (NEW)
**~60 lines**

### Props:
```typescript
interface ReceiptFiltersProps {
  filters: {
    category: string;
    location: string;
    source: string;
    reconciled: string;
  };
  onChange: (filters: ReceiptFiltersProps['filters']) => void;
}
```

### UI:
- 4 `<select>` elements in a responsive row (`grid grid-cols-2 lg:grid-cols-4 gap-3`)
- Options:
  - Category: All, Supplies, Equipment, Services, Food, Office, Utilities, Fuel, Software, Other
  - Location: All, Bedford, Dartmouth, Bayers Lake, Truro, Stratford, River Oaks
  - Source: All, Terminal, Gmail
  - Status: All, Reconciled, Unreconciled
- Styling: matches existing `ReceiptExportCard` select pattern (`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm`)

---

## Step 4: Frontend — Create ReceiptTable Component

**File**: `ClubOSV1-frontend/src/components/operations/receipts/ReceiptTable.tsx` (NEW)
**~220 lines**

### Props:
```typescript
interface ReceiptTableProps {
  receipts: any[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  selectedIds: Set<string>;
  onSort: (column: string) => void;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  monthLabel: string;
}
```

### Columns:
| Header | Field | Sortable | Format |
|--------|-------|----------|--------|
| ☐ | checkbox | No | Select all / individual |
| Date | `purchase_date` | Yes | `Mar 2` (short month + day) |
| Vendor | `vendor` | Yes | Truncated 30ch |
| Amount | `amount_cents` | Yes | `$234.56` |
| HST | `hst_cents` | No | `$30.49` or `—` |
| Category | `category` | No | Small badge |
| Location | `club_location` | No | Abbreviated: Bed, Dart, BL, Tru, Strat, RO |
| Source | `source` | No | Icon: Mail for gmail, Smartphone for terminal |
| Status | `reconciled` | No | CheckCircle green or Circle gray |

### Sort:
- Click header → toggle asc/desc
- Active column shows ChevronUp or ChevronDown icon
- Calls `onSort(columnName)` which parent handles

### Pagination:
- `Showing {start}-{end} of {total}` text
- Prev/Next buttons, disabled at bounds
- Standard pattern matching existing codebase

### Empty state:
- "No receipts found for {monthLabel}" with subtle icon

### Styling:
- Table: `w-full text-sm`
- Header cells: `text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2`
- Body cells: `px-3 py-2.5 text-sm`
- Row hover: `hover:bg-gray-50 transition-colors`
- Selected row: `bg-blue-50`

---

## Step 5: Frontend — Create MonthlySummaryCard Component

**File**: `ClubOSV1-frontend/src/components/operations/receipts/MonthlySummaryCard.tsx` (NEW)
**~90 lines**

### Props:
```typescript
interface MonthlySummaryCardProps {
  summary: {
    totalReceipts: number;
    totalAmount: number;
    totalTax: number;
    totalHst: number;
    unreconciled: number;
    categories: Array<{ category: string; count: number; total: number }>;
  } | null;
  loading: boolean;
}
```

### Display:
- Card with same styling as ReceiptExportCard: `bg-white rounded-lg shadow-sm border border-gray-200 p-6`
- Header: Receipt icon + "Monthly Summary"
- Stats grid (2 cols):
  - Receipts: count (bold number)
  - Total: `$12,340.56`
  - Tax: `$1,234.05`
  - HST: `$1,604.27`
  - Unreconciled: count with orange text if > 0
- Category bars (top 5):
  - Each: label + percentage bar (div with dynamic width) + dollar amount
  - Bar color: `bg-[var(--accent)]` with `bg-opacity-20` track
  - Percentage calculated from total

### Loading state:
- 4 skeleton `div` elements with `animate-pulse bg-gray-200`

---

## Step 6: Frontend — Create GmailScanCard Component

**File**: `ClubOSV1-frontend/src/components/operations/receipts/GmailScanCard.tsx` (NEW)
**~120 lines**

### Props:
```typescript
interface GmailScanCardProps {
  year: number;
  month: number;
  onScanComplete: () => void;
}
```

### Behavior:
- On mount: fetches `GET /api/gmail/status` for stats
- "Scan {Month Year}" button → calls `POST /api/gmail/scan` with body `{ startDate: 'after:YYYY/MM/01 before:YYYY/MM+1/01' }`
- While scanning: button disabled, shows spinner + "Scanning..."
- On complete: shows result toast ("Found X receipts"), calls `onScanComplete()` to refresh parent data
- Stats section: last scan time, total scanned, total receipts created, top 3 senders

### Error handling:
- If Gmail not configured (returns error): show "Gmail scanning not configured" info message
- If scan fails: show error alert, re-enable button

### Card styling:
- Same as MonthlySummaryCard: `bg-white rounded-lg shadow-sm border border-gray-200 p-6`
- Header: Mail icon + "Gmail Scanner"

---

## Step 7: Frontend — Rewrite OperationsReceipts Component

**File**: `ClubOSV1-frontend/src/components/operations/receipts/OperationsReceipts.tsx` (REWRITE)
**~180 lines**

### State:
```typescript
const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
const [receipts, setReceipts] = useState<any[]>([]);
const [summary, setSummary] = useState<any>(null);
const [page, setPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const [total, setTotal] = useState(0);
const [sortBy, setSortBy] = useState('purchase_date');
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [filters, setFilters] = useState({ category: '', location: '', source: '', reconciled: '' });
const [loadingReceipts, setLoadingReceipts] = useState(false);
const [loadingSummary, setLoadingSummary] = useState(false);
const [exporting, setExporting] = useState(false);
```

### Data fetching:

**fetchReceipts()** — called when year, month, page, sortBy, sortDir, or filters change:
```typescript
const dateFrom = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
const dateTo = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]; // last day of month

const params = new URLSearchParams({
  date_from: dateFrom,
  date_to: dateTo,
  page: String(page),
  limit: '20',
  sort: sortBy,
  dir: sortDir,
});
if (filters.category) params.append('category', filters.category);
if (filters.location) params.append('location', filters.location);
if (filters.source) params.append('source', filters.source);
if (filters.reconciled) params.append('reconciled', filters.reconciled);

const response = await http.get(`receipts/search?${params}`);
```

**fetchSummary()** — called when year or month change:
```typescript
const response = await http.get(`receipts/summary?period=month&year=${selectedYear}&month=${selectedMonth}`);
```

### Month navigation:
```
← prev    March 2026    next →
```
- Left arrow: go to previous month (wraps year)
- Right arrow: go to next month (disabled if current or future month)
- Center: "{Month Name} {Year}" text

### Layout:
```
┌─────────────────────────────────────────────────────────┐
│     ← prev         March 2026           next →          │
├──────────────────────────┬──────────────────────────────┤
│    Gmail Scan Card       │    Monthly Summary Card       │
├──────────────────────────┴──────────────────────────────┤
│  [Category ▼] [Location ▼] [Source ▼] [Status ▼]       │
├─────────────────────────────────────────────────────────┤
│  ☐ Date  Vendor  Amount  HST  Cat  Loc  Src  Status    │
│  ☐ Mar 2 Home..  $234    $30  Sup  Bed  📧   ✓        │
│  ...                                                    │
│  Showing 1-20 of 47     [Prev] Page 1/3 [Next]         │
├─────────────────────────────────────────────────────────┤
│  [Reconcile (3)]                 [CSV] [ZIP]            │
└─────────────────────────────────────────────────────────┘
```

### Actions (bottom bar):

**Bulk reconcile**:
```typescript
await http.post('receipts/reconcile', { receiptIds: [...selectedIds] });
```
Then refresh receipts + summary.

**Export CSV / ZIP**:
```typescript
const params = new URLSearchParams({
  period: 'month',
  format: 'csv', // or 'zip'
  year: String(selectedYear),
  month: String(selectedMonth),
});
const response = await http.get(`receipts/export?${params}`, { responseType: 'blob' });
// blob download logic (same pattern as ReceiptExportCard)
```

### Responsive:
- Month nav: always full width
- Cards: `grid grid-cols-1 lg:grid-cols-2 gap-4`
- Filters: `grid grid-cols-2 lg:grid-cols-4 gap-3`
- Table: horizontal scroll on mobile (`overflow-x-auto`)
- Action bar: stack on mobile (`flex-col sm:flex-row`)

---

## Step 8: Verify & Test

### TypeScript:
```bash
cd ClubOSV1-backend && npx tsc --noEmit
cd ClubOSV1-frontend && npx tsc --noEmit
```

### Manual checks:
1. Summary endpoint returns new fields (totalHst, unreconciled, categories)
2. Search endpoint returns new columns (source, hst_cents, tax_cents, category)
3. Search endpoint respects sort + new filters
4. ReceiptExportCard still works (response shape preserved)
5. New components render without errors
6. Month navigation works (prev/next, year boundary)
7. Filters update the table
8. Sort toggles correctly
9. Checkbox select + bulk reconcile works
10. Export CSV/ZIP downloads correctly
11. Gmail scan card shows status + triggers scan
12. Mobile layout doesn't break

---

## Step 9: Version Bump & Deploy

1. CHANGELOG.md → v1.25.48
2. README.md version → v1.25.48
3. git add, commit, push

---

## Files Changed / Created

### Backend (1 file modified)
| File | Lines Changed | Change |
|------|--------------|--------|
| `src/routes/receipts-simple.ts` | ~40 lines | Summary: add HST + unreconciled + categories. Search: add columns + filters + sort |

### Frontend (5 files: 1 rewrite, 4 new)
| File | Lines | Purpose |
|------|-------|---------|
| `src/components/operations/receipts/OperationsReceipts.tsx` | ~180 | **Rewrite** — orchestrator with month nav, state, data fetching |
| `src/components/operations/receipts/ReceiptFilters.tsx` | ~60 | **New** — 4 filter dropdowns |
| `src/components/operations/receipts/ReceiptTable.tsx` | ~220 | **New** — sortable, selectable, paginated table |
| `src/components/operations/receipts/MonthlySummaryCard.tsx` | ~90 | **New** — totals, HST, categories |
| `src/components/operations/receipts/GmailScanCard.tsx` | ~120 | **New** — scan trigger + stats |

### Not Changed
| File | Reason |
|------|--------|
| `ReceiptExportCard.tsx` | Kept as-is — export moved to action bar, but card remains importable |
| `operations.tsx` | No changes — lazy load + tab config already correct |
| `gmail-scan.ts` | No changes — existing endpoints sufficient for V1 dashboard |
| `gmailReceiptScanner.ts` | No changes — smart pipeline is a separate future phase |

### No New Dependencies
- All icons from existing `lucide-react`
- All API calls via existing `http` client
- No chart libraries — pure CSS percentage bars
- No new npm packages

### No New Migrations
- All columns already exist in production

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Summary response shape breaks ReceiptExportCard | Very Low | High | All existing fields preserved, new fields are additive |
| Search sort injection | None | High | Column whitelist + forced ASC/DESC — no raw user input in SQL |
| Gmail status endpoint fails (not configured) | Medium | Low | Card shows friendly "not configured" message, catches errors |
| Empty month (no receipts) | Certain | Low | Empty state in table, summary shows zeros |
| Large month (500+ receipts) | Low | Medium | Paginated at 20/page, no performance issue |
| Mobile layout overflow | Medium | Medium | `overflow-x-auto` on table, responsive grid on cards |
