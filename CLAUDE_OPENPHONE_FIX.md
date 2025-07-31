
# TASK: Fix Incoming OpenPhone Message Parsing (Claude)

## 🎯 Objective

Ensure Claude Opus 4 receives complete, structured information from OpenPhone webhooks in order to correctly classify and respond to incoming SMS messages.

---

## ✅ Step-by-Step Instructions

### 1. Always Provide the Full Webhook Payload

Pass the **raw message event**, not summaries like "known sender / unknown message". Use this format:

```json
{
  "type": "message.received",
  "data": {
    "object": {
      "id": "msg_abc123",
      "from": "+19025551234",
      "to": "+19029998888",
      "body": "Hey, I’m having trouble with my PIN.",
      "media": [],
      "direction": "inbound",
      "phoneNumberId": "pn_0123",
      "conversationId": "conv_abc999"
    }
  }
}
```

---

### 2. Reformat Into Markdown When Passing to Claude

Claude understands this better than raw JSON:

```markdown
### Incoming Message Event

**From:** +19025551234  
**To:** +19029998888  
**Body:** Hey, I’m having trouble with my PIN.  
**Type:** message.received  
**Direction:** inbound  
**Conversation ID:** conv_abc999  
```

---

### 3. Use the Following Prompt Template

```markdown
# Claude Task

You are the intelligence engine for ClubOS. You’ve received the following message from OpenPhone via webhook. Extract the meaning and route it to the correct assistant.

## Message Details

- From: +19025551234
- To: +19029998888
- Body: "Hey, I’m having trouble with my PIN."
- Type: message.received
- Direction: inbound

## Instructions

1. Determine the correct assistant based on message intent.
2. If body is vague or empty, classify as fallback.
3. Log the contact and reason in the system.
```

---

### 4. If `body` is Empty or Missing

Claude must still process the request:

- Replace empty body with:
  ```text
  No message text received.
  ```
- Still include `from`, `to`, `direction`, `conversationId`.

---

### 5. DO NOT Use Summarized Inputs Like:

```json
{
  "sender": "known",
  "message": "unknown"
}
```

This lacks context and causes Claude to misroute or fail silently.

---

## 🧠 Claude Behavior Reminder

Claude should:
- Parse the full payload
- Classify by intent
- Route to correct assistant
- Log fallback events if message body is blank or ambiguous
