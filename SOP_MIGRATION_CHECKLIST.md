# SOP Migration Pre-Deployment Checklist

## 🔍 Verification Commands

Run these commands to ensure everything is ready:

```bash
# 1. Verify SOP system setup
cd ClubOSV1-backend
npm run verify:sop

# 2. Test OpenPhone integration
npm run test:openphone

# 3. Check database migrations
# Look for all green checkmarks in the output
```

## ✅ Database Readiness

The verification script checks:
- [ ] Database connection
- [ ] All required tables exist:
  - openphone_conversations
  - extracted_knowledge
  - sop_shadow_comparisons
  - sop_embeddings
  - sop_metrics
- [ ] Migrations are up to date

## 🧠 SOP Module Status

The verification confirms:
- [ ] SOP module is initialized
- [ ] Document embeddings are created
- [ ] All 4 assistants have documents loaded
- [ ] Test queries return responses with confidence scores

## 🔧 Configuration

### Environment Variables Required:
```env
# Database (already configured)
DATABASE_URL=your-postgres-url

# OpenAI (already configured)
OPENAI_API_KEY=sk-your-key

# SOP Feature Flags
USE_INTELLIGENT_SOP=false        # Keep false initially
SOP_SHADOW_MODE=true            # Start with shadow mode
SOP_CONFIDENCE_THRESHOLD=0.75   # Minimum confidence

# OpenPhone (configure when ready)
OPENPHONE_API_KEY=your-api-key
OPENPHONE_WEBHOOK_SECRET=your-secret
```

## 📱 OpenPhone Setup (When Ready)

1. **Get API Key**:
   - OpenPhone Dashboard → Settings → API
   - Generate and copy key

2. **Configure Webhook**:
   - URL: `https://your-backend.railway.app/api/openphone/webhook`
   - Events: message.created, conversation.updated, call.completed
   - Secret: Match your env variable

3. **Import Historical Data**:
   - Use the UI: Operations → Knowledge → Extract
   - Or API: Import Last 7/30 Days buttons

## 🚀 Deployment Steps

### Local Testing First:
1. Run `npm run verify:sop` - All should be green
2. Run `npm run test:openphone` - Tests should pass
3. Check UI: Operations → Knowledge shows correctly

### Deploy When Ready:
```bash
# Only after local verification!
git add -A
git commit -m "feat: Add SOP migration with OpenPhone integration"
git push origin main
```

### Post-Deployment:
1. Set environment variables in Railway/Vercel
2. Run verification on production
3. Enable shadow mode
4. Monitor for 24-48 hours
5. Switch to SOP mode when confident

## 📊 Monitoring

### Shadow Mode Metrics:
- Check shadow comparison statistics
- Monitor confidence scores
- Compare response times
- Review extracted knowledge quality

### Success Criteria:
- [ ] 80%+ requests have >0.75 confidence
- [ ] Response times <1 second
- [ ] No increase in user complaints
- [ ] $750/month savings visible

## 🔄 Rollback Plan

If issues occur:
```env
# Instant rollback - just change these:
USE_INTELLIGENT_SOP=false
SOP_SHADOW_MODE=false
```

No code changes needed - just environment variables!