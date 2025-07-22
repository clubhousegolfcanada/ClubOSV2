# GPT Function Integration Setup

This guide explains how to set up Custom GPT functions for ClubOS.

## Overview

The GPT function integration allows your Custom GPTs to:
- Check booking availability and create reservations
- Handle emergency alerts
- Create support tickets
- Provide membership information and promotions

## Setup Steps

### 1. Install Dependencies

```bash
cd ClubOSV1-backend
npm install
```

### 2. Configure Environment Variables

Copy the example configuration to your `.env` file:

```bash
cp .env.gpt.example .env
```

Then update with your actual values:
- `OPENAI_API_KEY`: Your OpenAI API key
- `BOOKING_ACCESS_GPT_ID`: Assistant ID for Booking & Access Bot
- `EMERGENCY_GPT_ID`: Assistant ID for Emergency Bot
- `TECH_SUPPORT_GPT_ID`: Assistant ID for Tech Support Bot
- `BRAND_MARKETING_GPT_ID`: Assistant ID for Brand & Marketing Bot

### 3. Set Up Webhook URL

For production:
```
https://your-domain.com/api/gpt-webhook
```

For local development with ngrok:
```bash
ngrok http 3000
# Use the HTTPS URL provided by ngrok
```

### 4. Configure Each GPT in OpenAI

1. Go to the OpenAI Assistant configuration
2. Add the function definitions from the artifacts
3. Set the webhook URL
4. Copy the webhook secret to your `.env` file

### 5. Test the Integration

Test each function using the development endpoint:

```bash
# Test booking availability
curl -X POST http://localhost:3000/api/gpt-webhook/test-function \
  -H "Content-Type: application/json" \
  -d '{
    "function_name": "check_availability",
    "arguments": {
      "date": "2024-01-25",
      "duration": 60
    },
    "assistant_id": "YOUR_BOOKING_GPT_ID"
  }'
```

### 6. Monitor Function Calls

View metrics in development:
```bash
curl http://localhost:3000/api/gpt-webhook/metrics
```

Check health status:
```bash
curl http://localhost:3000/api/gpt-webhook/webhook/health
```

## Function Reference

### Booking & Access Bot Functions
- `get_booking_status` - Check bay availability
- `check_availability` - Find available time slots
- `create_booking` - Create a new reservation
- `modify_booking` - Change existing booking
- `cancel_booking` - Cancel a reservation

### Emergency Bot Functions
- `create_emergency_alert` - Report an emergency
- `get_emergency_procedures` - Get emergency protocols

### Tech Support Bot Functions
- `create_support_ticket` - Create technical support ticket
- `check_equipment_status` - Check equipment status

### Brand & Marketing Bot Functions
- `get_membership_info` - Get membership options
- `check_current_promotions` - View active promotions

## Security Features

- **Webhook signature verification** - Ensures requests are from OpenAI
- **Assistant ID authorization** - Each GPT can only call its assigned functions
- **Rate limiting** - Prevents abuse
- **Audit logging** - All function calls are logged
- **Parameter validation** - Required parameters are enforced

## Troubleshooting

### Webhook not receiving calls
1. Check SSL certificate is valid
2. Verify webhook URL is exact
3. Check OpenAI webhook logs
4. Use ngrok for local testing

### Function calls failing
1. Check assistant ID in `.env` matches OpenAI
2. Verify all required parameters are provided
3. Check rate limits haven't been exceeded
4. Review audit logs in `data/gpt-audit-log.json`

### Signature verification failing
1. Ensure `OPENAI_WEBHOOK_SECRET` is correct
2. Check webhook is using raw body parsing
3. Verify timestamp is within 5 minutes

## Production Checklist

- [ ] SSL certificate configured
- [ ] All assistant IDs in environment variables
- [ ] Webhook secret configured
- [ ] Rate limiting configured appropriately
- [ ] Monitoring and alerting set up
- [ ] Audit log rotation configured
- [ ] Emergency contacts configured
- [ ] Slack webhook configured for alerts

## Support

For issues or questions:
1. Check the audit logs: `data/gpt-audit-log.json`
2. View application logs for detailed errors
3. Test functions using the development endpoints
4. Verify GPT configuration in OpenAI dashboard
