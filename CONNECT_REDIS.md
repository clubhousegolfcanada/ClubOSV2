# Connect Redis to ClubOSV2

## Step 1: Link Redis to Your App

In Railway Dashboard:
1. Click on your **ClubOSV2** service
2. Go to "Variables" tab
3. Click "Add Variable Reference"
4. Select **Redis** from the dropdown
5. Choose `REDIS_URL` 
6. Railway will automatically add the connection string

## Step 2: Verify Environment Variables

Your ClubOSV2 should now have:
- `DATABASE_URL` (PostgreSQL - already connected)
- `REDIS_URL` (Redis - newly added)
- All your other env vars (OPENAI_API_KEY, etc.)

## Step 3: Redeploy

The app will automatically redeploy when you add the variable. 
Watch the logs for:
```
✅ "Redis cache connected"
🚀 "Caching enabled for LLM services"
```

## Step 4: Test Redis is Working

```bash
# Check health endpoint
curl https://clubosv2-production.up.railway.app/api/llm/health

# Should show:
{
  "status": "ok",
  "cacheEnabled": true,
  "cacheStats": {
    "hits": 0,
    "misses": 0,
    "hitRate": 0
  }
}

# Make a test request twice
curl -X POST https://clubosv2-production.up.railway.app/api/llm/process \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "What are the hours?"}'

# Second request should be INSTANT and show X-Cache: HIT header
```

## What You Get With Redis:

| Feature | Before (In-Memory) | After (Redis) |
|---------|-------------------|---------------|
| Cache Persistence | Lost on restart | Survives restarts |
| Cache Sharing | Per instance | Shared across all |
| Max Cache Size | ~100MB | 512MB+ |
| Concurrent Users | ~100 | 1000+ |
| Cache TTL | Working | Working |
| Hit Rate Tracking | Working | Working |

## Monitor Cache Performance:

```bash
# View cache statistics
curl https://clubosv2-production.up.railway.app/api/llm/cache/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# View usage tracking
curl https://clubosv2-production.up.railway.app/api/llm/usage \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Expected Performance:

- **First Request**: 6-8 seconds (OpenAI API call)
- **Cached Request**: <100ms (from Redis)
- **Cache Hit Rate**: 70-80% after warm-up
- **Cost Reduction**: 80-90% on API calls

## Troubleshooting:

If Redis doesn't connect:
1. Check Railway logs for connection errors
2. Ensure Redis service is running (green check)
3. Verify REDIS_URL is in ClubOSV2 variables
4. Check Redis connection settings (should be automatic)

## Redis Memory Management:

Railway Redis includes:
- Auto-eviction when memory full (LRU policy)
- 512MB default memory
- Persistence to disk
- Automatic backups

Your cache will automatically manage itself!