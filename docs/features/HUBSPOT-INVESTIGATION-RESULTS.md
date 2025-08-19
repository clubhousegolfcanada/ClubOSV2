# HubSpot Integration Investigation Results

## Summary
Names are not persisting because the HubSpot service uses in-memory caching instead of the database `hubspot_cache` table.

## Key Findings

### 1. Roger Kugler Test Case
- **Phone**: +19024998318
- **HubSpot Status**: ✅ Found as "Roger Kugler" with mobilephone: +19024998318
- **Database Cache**: ❌ Not cached (cache table is empty)
- **Conversation Display**: Shows phone number instead of name

### 2. Root Cause
The `hubspotService.ts` uses an in-memory Map for caching:
```typescript
private cache = new Map<string, CacheEntry>();
private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

This means:
- Cache is lost on every server restart/deployment
- The `hubspot_cache` database table isn't used
- Names only persist for 5 minutes in memory

### 3. Failed Lookups
Some numbers legitimately don't exist in HubSpot:
- +19028778656 - Not found
- +19024788262 - Not found  
- +18005550100 - Not found (likely a toll-free number)

### 4. Phone Format Handling
The service correctly tries multiple formats:
- 19025551234 (1 + 10 digits)
- +19025551234 (+1 + 10 digits)
- 9025551234 (10 digits)
- 902-555-1234 (formatted)

### 5. Success Rate Issue
The 5% success rate was likely due to:
- In-memory cache expiring after 5 minutes
- Server restarts clearing the cache
- Multiple formats being tried for each lookup (counted as failures)

## Solution
Implement database caching in `hubspotService.ts` to:
1. Store successful lookups in `hubspot_cache` table
2. Store "not found" results to avoid repeated API calls
3. Set reasonable expiry (24 hours suggested)
4. Survive server restarts

## Impact on Chat Status
The HubSpot "open/done" chat toggle doesn't affect contact lookups - contacts are found regardless of their chat status.