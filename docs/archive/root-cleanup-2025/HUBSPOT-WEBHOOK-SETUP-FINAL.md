# HubSpot Booking Rewards - Final Setup Steps

## ✅ Implementation Status: CODE COMPLETE - AWAITING CONFIGURATION

### What's Already Done
1. ✅ **Database**: `booking_rewards` table created in production
2. ✅ **Backend Code**: All webhook endpoints deployed and live
3. ✅ **Processing Job**: Hourly job running to award rewards
4. ✅ **Admin Tools**: Monitoring endpoints available
5. ✅ **Webhook Routes**: Mounted at `/api/webhooks/hubspot/*`

### Webhook Endpoints (Live Now)
- **Booking Completed**: `https://clubosv1-backend-production.up.railway.app/api/webhooks/hubspot/booking-completed`
- **Booking Updated**: `https://clubosv1-backend-production.up.railway.app/api/webhooks/hubspot/booking-updated`

## 🔧 Required Setup Steps

### Step 1: Generate Webhook Secret
```bash
# Run this command to generate a secure secret
openssl rand -hex 32

# Example output (DO NOT USE THIS - generate your own):
# a3f2d8e9c1b5a7d3e9f2c8b4a6d2e8f4c1b3a5d7e9f1c3b5a7d9e1f3c5b7a9d1
```

### Step 2: Add Environment Variables to Railway
1. Open [Railway Dashboard](https://railway.app/dashboard)
2. Select your backend service (ClubOSV1-backend)
3. Go to "Variables" tab
4. Add these variables:
   ```
   HUBSPOT_WEBHOOK_SECRET = [paste generated secret from Step 1]
   BOOKING_REWARD_AMOUNT = 25
   BOOKING_REWARD_DELAY_DAYS = 7
   ```
5. Click "Add" and wait for redeploy (~2-3 minutes)

### Step 3: Configure HubSpot Webhooks

#### Option A: Using HubSpot Private App (Recommended)
1. Go to HubSpot → Settings → Integrations → Private Apps
2. Find or create "ClubOS Integration" app
3. Go to "Webhooks" tab
4. Click "Create subscription"
5. Configure webhook:
   - **Object type**: Deal
   - **Event type**: Property change
   - **Property to monitor**: `dealstage`
   - **Webhook URL**: `https://clubosv1-backend-production.up.railway.app/api/webhooks/hubspot/booking-completed`
   - **HTTP Method**: POST
   - **Authentication**: Add header `X-HubSpot-Signature` with webhook secret

#### Option B: Using HubSpot Workflows (Alternative)
1. Go to HubSpot → Automation → Workflows
2. Create new workflow "Booking Rewards"
3. Set trigger: Deal stage = Closed Won
4. Add action: Webhook
5. Configure:
   - **URL**: `https://clubosv1-backend-production.up.railway.app/api/webhooks/hubspot/booking-completed`
   - **Method**: POST
   - **Body**: Include deal properties (booking_date, contact_id, location)

### Step 4: Test the Integration

#### Quick Test with cURL
```bash
# Test webhook endpoint (no auth required for testing)
curl -X POST https://clubosv1-backend-production.up.railway.app/api/webhooks/hubspot/booking-completed \
  -H "Content-Type: application/json" \
  -H "X-HubSpot-Signature: test" \
  -d '[{
    "objectId": "test-deal-001",
    "properties": {
      "dealstage": "closedwon",
      "booking_date": "2025-08-24",
      "location": "Bedford",
      "box_number": "2",
      "contact_id": "test-contact-123"
    }
  }]'

# Expected response:
# {"success":true}
```

#### Verify in Admin Panel
1. Check pending rewards:
   ```
   GET https://clubosv1-backend-production.up.railway.app/api/admin/booking-rewards/pending
   ```

2. View statistics:
   ```
   GET https://clubosv1-backend-production.up.railway.app/api/admin/booking-rewards/stats
   ```

### Step 5: Monitor First Real Booking
1. Create a test booking in HubSpot (or wait for real booking)
2. Check webhook logs in HubSpot for delivery status
3. Monitor Railway logs: `railway logs`
4. Check pending rewards in admin panel
5. After 7 days, verify CC awarded to customer

## 📊 How It Works

```
Customer Books → HubSpot Deal Closed → Webhook Fired → ClubOS Queues Reward
                                                           ↓ (7 days later)
                                                     Hourly Job Awards 25 CC
```

## 🔍 Troubleshooting

### Issue: Webhook not firing
- Check HubSpot webhook logs for errors
- Verify webhook URL is exactly as shown above
- Ensure deal stage is changing to "closedwon"

### Issue: User not found
- Customer must have ClubOS account before booking
- Check if customer email/phone matches between systems
- May need to manually link HubSpot contact ID

### Issue: Rewards not processing
- Check Railway logs: `railway logs | grep booking`
- Verify environment variables are set
- Check job is running: Look for "Processing booking rewards" in logs

### Issue: Double rewards
- System prevents this automatically (unique constraint)
- Check `booking_rewards` table for duplicates

## 📈 Success Metrics
- **Target**: 100% of completed bookings get rewards
- **Processing time**: Within 1 hour of reward date
- **Error rate**: <5% (usually missing user accounts)

## 🚨 Emergency Controls
```bash
# Stop all reward processing
# Remove BOOKING_REWARD_AMOUNT from Railway variables

# Manually award a reward (need auth token)
curl -X POST https://clubosv1-backend-production.up.railway.app/api/admin/booking-rewards/award/[reward-id] \
  -H "Authorization: Bearer [token]"

# Cancel a pending reward
curl -X POST https://clubosv1-backend-production.up.railway.app/api/admin/booking-rewards/cancel/[reward-id] \
  -H "Authorization: Bearer [token]"
```

## ✅ Checklist for Go-Live
- [ ] Generate webhook secret
- [ ] Add environment variables to Railway
- [ ] Configure HubSpot webhook
- [ ] Test with cURL
- [ ] Verify in admin panel
- [ ] Monitor first real booking
- [ ] Document webhook secret securely

## 📝 Notes
- Rewards are awarded 7 days after booking date (not immediately)
- Customers need ClubOS account to receive rewards
- System handles cancellations automatically
- All rewards are tracked in `cc_transactions` table
- Failed rewards marked for manual review

## Support
For issues, check:
1. Railway logs: `railway logs`
2. Admin panel: `/api/admin/booking-rewards/stats`
3. Database: `booking_rewards` and `cc_transactions` tables

---

**Status**: System fully deployed and operational. Only needs HubSpot webhook configuration to start processing bookings.