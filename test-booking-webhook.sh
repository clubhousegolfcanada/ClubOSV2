#!/bin/bash

# Test Booking Rewards Webhook
echo "Testing ClubOS Booking Rewards Webhook..."
echo "========================================="

# Get today's date
TODAY=$(date +%Y-%m-%d)

# Test webhook endpoint
echo "Sending test booking to webhook..."
curl -X POST https://clubosv2-production.up.railway.app/api/webhooks/hubspot/booking-completed \
  -H "Content-Type: application/json" \
  -H "X-HubSpot-Signature: test-signature" \
  -d "[{
    \"objectId\": \"test-deal-$(date +%s)\",
    \"properties\": {
      \"dealstage\": \"closedwon\",
      \"booking_date\": \"$TODAY\",
      \"location\": \"Bedford\",
      \"box_number\": \"2\",
      \"contact_id\": \"test-contact-$(date +%s)\",
      \"contact_phone\": \"+1234567890\"
    }
  }]"

echo ""
echo ""
echo "Expected response: {\"success\":true}"
echo ""
echo "Note: This creates a test booking reward that will be queued for 7 days from now."
echo "Since this is a test contact, it won't find a real user, but it tests the webhook is live."