# Step 4: Configure Webhook in OpenAI - Detailed Guide

## Prerequisites
Before starting, ensure you have:
- [ ] Created all 4 Custom GPT Assistants in OpenAI
- [ ] Filled in the assistant IDs in your `.env` file
- [ ] Your webhook URL ready (production or ngrok URL)

## Webhook Configuration Steps

### 1. Access OpenAI Platform
1. Go to https://platform.openai.com/assistants
2. You should see your 4 assistants:
   - Booking & Access Bot
   - Emergency Bot
   - Tech Support Bot
   - Brand & Marketing Bot

### 2. Configure Webhook for Each Assistant

For **EACH** assistant, follow these steps:

1. **Click on the assistant** to open its configuration
2. **Scroll to "Functions"** section
3. **Enable "Use functions"** toggle
4. **Add each function** for that assistant (copy from the artifacts provided)
5. **Scroll to "Code Interpreter & Functions"** section
6. **Find "Webhook"** configuration
7. **Enter your webhook URL**:
   ```
   https://your-domain.com/api/gpt-webhook
   ```
   **Note**: The URL path is `/api/gpt-webhook` (not `/api/gpt-functions/webhook`)

8. **Click "Save"** or "Update Assistant"
9. **Copy the webhook secret** that appears after saving

### 3. Webhook URLs by Environment

#### For Production:
```
https://your-domain.com/api/gpt-webhook
```

#### For Local Development with ngrok:
```bash
# First, start ngrok on port 3001 (your backend port)
ngrok http 3001

# You'll see something like:
# Forwarding https://abc123def456.ngrok.io -> http://localhost:3001

# Use this URL in OpenAI:
https://abc123def456.ngrok.io/api/gpt-webhook
```

### 4. Update Your .env File

After configuring the webhook, update your `.env` file:

```env
# This is the webhook secret from OpenAI (same for all assistants)
OPENAI_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx

# Update your webhook URL if using ngrok
GPT_FUNCTION_WEBHOOK_URL=https://abc123def456.ngrok.io/api/gpt-webhook
```

## Important Notes

### Webhook Secret
- You'll get **ONE webhook secret** that works for all assistants
- It starts with `whsec_`
- Keep it secure - it's used to verify requests are from OpenAI

### URL Path Correction
The correct webhook path in our implementation is:
```
/api/gpt-webhook
```
NOT `/api/gpt-functions/webhook`

### Testing Your Webhook

1. **Check webhook is reachable**:
   ```bash
   curl https://your-webhook-url/api/gpt-webhook/webhook/health
   ```

2. **Check configuration in your app**:
   ```bash
   curl http://localhost:3001/api/gpt-webhook/webhook/health
   ```

   Should return:
   ```json
   {
     "status": "healthy",
     "timestamp": "...",
     "configured": true
   }
   ```

### Troubleshooting

#### Webhook not working?
1. Ensure URL is HTTPS (required by OpenAI)
2. Check no typos in the URL
3. Verify your backend is running
4. Check ngrok is still active (if using for development)

#### Getting 401 Unauthorized?
1. Verify `OPENAI_WEBHOOK_SECRET` in `.env` matches OpenAI
2. Ensure no extra spaces in the secret
3. Restart your backend after updating `.env`

#### Functions not appearing?
1. Make sure you added the function definitions to each assistant
2. Ensure "Use functions" is enabled
3. Save/Update the assistant after adding functions

## Verification Checklist

After configuration, verify:
- [ ] All 4 assistants have webhook URL configured
- [ ] Webhook secret is in your `.env` file
- [ ] Backend server is running
- [ ] Health endpoint returns `configured: true`
- [ ] No errors in backend logs when saving assistants

## Next Step

Once webhooks are configured, test each GPT:
1. Go to the assistant's playground
2. Send a message that would trigger a function
3. Watch your backend logs for incoming webhook calls
4. Verify functions execute correctly

## Example Test Messages

**Booking Bot**: "What times are available tomorrow?"
**Emergency Bot**: "Someone fell in bay 3"
**Tech Support Bot**: "The screen is frozen in bay 2"
**Brand Bot**: "What membership options do you have?"
