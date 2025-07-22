# Slack Signature Verification Implementation

## Overview
Implemented secure Slack webhook signature verification to ensure incoming requests are from Slack.

## What Was Added

### 1. Middleware: `slackSignature.ts`
Located at: `/src/middleware/slackSignature.ts`

Features:
- Verifies `X-Slack-Signature` header
- Validates request timestamp to prevent replay attacks (5-minute window)
- Uses HMAC-SHA256 for signature verification
- Handles raw body parsing for signature calculation
- Returns 403 for invalid signatures

### 2. Route Updates: `slack.ts`
- Applied signature verification middleware to webhook endpoint
- Handles both Slack events and slash commands
- Proper error handling for verification failures

### 3. Environment Configuration
Added `SLACK_SIGNING_SECRET` to:
- `.env.template` - Documentation
- `.env` - Actual configuration
- `envValidator.ts` - Runtime validation

### 4. Server Configuration
Updated `index.ts` to:
- Use `express.raw()` for `/api/slack/webhook` route
- Preserve raw body for signature verification

## Setup Instructions

1. **Get Your Slack Signing Secret**:
   - Go to your Slack App settings: https://api.slack.com/apps
   - Navigate to "Basic Information"
   - Find "Signing Secret" under "App Credentials"
   - Copy the signing secret

2. **Configure Environment**:
   ```bash
   # Edit your .env file
   SLACK_SIGNING_SECRET=your_actual_signing_secret_here
   ```

3. **Restart Server**:
   ```bash
   npm run dev
   ```

## Security Benefits

- **Request Authentication**: Only processes webhooks from verified Slack sources
- **Replay Attack Prevention**: 5-minute timestamp validation window
- **No Hardcoded Secrets**: Uses environment variables
- **Proper Error Handling**: Returns appropriate error codes without exposing details

## Testing

To test the signature verification:

1. Use Slack's Event Subscriptions test feature
2. Or send a test event from your Slack workspace
3. Check logs for verification success/failure

## Troubleshooting

If signature verification fails:
- Ensure `SLACK_SIGNING_SECRET` is correctly set
- Check that the secret matches your Slack app
- Verify the webhook URL in Slack matches your server
- Check server logs for detailed error messages
