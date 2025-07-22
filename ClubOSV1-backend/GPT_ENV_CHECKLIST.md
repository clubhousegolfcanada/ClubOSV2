# GPT Configuration Checklist

## Environment Variables to Update in .env

### 1. OpenAI API Key
- [ ] Replace `OPENAI_API_KEY=sk-demo-key-for-testing-only` with your actual OpenAI API key
- Get it from: https://platform.openai.com/api-keys

### 2. Assistant IDs (After Creating GPTs)
Fill these in after creating each Custom GPT in OpenAI:
- [ ] `BOOKING_ACCESS_GPT_ID=` → Add your Booking & Access Bot assistant ID
- [ ] `EMERGENCY_GPT_ID=` → Add your Emergency Bot assistant ID  
- [ ] `TECH_SUPPORT_GPT_ID=` → Add your Tech Support Bot assistant ID
- [ ] `BRAND_MARKETING_GPT_ID=` → Add your Brand & Marketing Bot assistant ID

### 3. Webhook Configuration
- [ ] `OPENAI_WEBHOOK_SECRET=` → You'll get this after configuring webhook in OpenAI
- [ ] `GPT_FUNCTION_WEBHOOK_URL=` → Update with your production URL or ngrok URL

### 4. Emergency Contacts
- [ ] `FACILITY_MANAGER_PHONE=` → Replace with actual facility manager phone
- [ ] `FIRST_AID_TEAM_PHONE=` → Replace with actual first aid team phone

### 5. Slack Webhook (Optional but Recommended)
- [ ] `SLACK_WEBHOOK_URL=` → Add your Slack webhook for emergency alerts

## Example Filled Configuration

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-abc123xyz789...
OPENAI_WEBHOOK_SECRET=whsec_1234567890abcdef...

# Custom GPT Assistant IDs
BOOKING_ACCESS_GPT_ID=asst_AbC123XyZ789...
EMERGENCY_GPT_ID=asst_DeF456UvW012...
TECH_SUPPORT_GPT_ID=asst_GhI789RsT345...
BRAND_MARKETING_GPT_ID=asst_JkL012MnO678...

# For Production
GPT_FUNCTION_WEBHOOK_URL=https://clubos.yourdomain.com/api/gpt-webhook

# For Local Development
# GPT_FUNCTION_WEBHOOK_URL=https://a1b2c3d4.ngrok.io/api/gpt-webhook

# Emergency Contacts
FACILITY_MANAGER_PHONE=+1-902-555-0123
FIRST_AID_TEAM_PHONE=+1-902-555-0456
```

## Where to Find These Values

1. **OpenAI API Key**: 
   - Go to https://platform.openai.com/api-keys
   - Create a new secret key

2. **Assistant IDs**:
   - After creating each assistant at https://platform.openai.com/assistants
   - The ID looks like: `asst_xxxxxxxxxxxxxxxxxx`

3. **Webhook Secret**:
   - Configure webhook in your assistant settings
   - OpenAI will provide the secret

4. **Webhook URL**:
   - Production: Your domain + `/api/gpt-webhook`
   - Development: Use ngrok to expose local server

## Next Steps

After filling in all values:
1. Save the .env file
2. Restart your backend server
3. Test the webhook health endpoint: `GET /api/gpt-webhook/webhook/health`
4. Configure webhook URL in each OpenAI assistant
