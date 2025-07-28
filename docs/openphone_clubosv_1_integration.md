# OpenPhone Integration Plan for ClubOSv1

## Objective
Integrate OpenPhone SMS and voicemail message data into ClubOSv1 in a way that enables future LLM-assisted SOP updates and knowledge base generation, while keeping implementation simple, clean, and low-noise.

---

## Phase 1: Passive Ingestion & Thread Resolution

### Webhook Setup
- Create a webhook endpoint in ClubOSv1 to receive OpenPhone messages.
- OpenPhone webhook URL:
  ```
POST /api/openphone/inbound
  ```

### Data Storage
- Store incoming messages in a thread-based structure:

```sql
TABLE openphone_threads (
  id UUID,
  phone_number TEXT,
  messages JSONB, -- list of {sender, timestamp, body}
  last_message_at TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  parsed BOOLEAN DEFAULT FALSE
)
```

### Resolution Rule (Simple + Automatable)
- Every 5 minutes, check:
```sql
WHERE resolved = false AND last_message_at < NOW() - INTERVAL '30 minutes'
```
- Mark those threads as `resolved = true`
- No distinction between who sent the last message

---

## Phase 2: Log All Resolved Threads (Don’t Filter Yet)

### Logging Destination
```sql
TABLE openphone_resolved_threads (
  id UUID,
  phone_number TEXT,
  resolved_at TIMESTAMP,
  messages JSONB, -- full thread
  exported BOOLEAN DEFAULT FALSE
)
```
- Each row = 1 full conversation thread
- Messages stored compactly as JSON
- Thread is frozen once resolved, not updated further

### Rationale
- Avoid complexity of in-line vector comparisons
- Store everything, then filter downstream
- Gives full visibility and enables retroactive improvements

---

## Phase 3: Offline Filtering & LLM Parsing

### Daily/Hourly Export
- Export all `resolved = true AND exported = false` threads
- Dump as JSON to temp storage or pipe to Claude

### Claude Parsing Prompt (Initial Pass)
```text
You are reviewing a batch of resolved customer support threads.
Each thread contains a full conversation.

Your job:
- Extract any thread that contains a new issue, question, or request not already covered by existing SOPs.
- Ignore anything repetitive, already answered, or not useful.
- Output a list of insights with summaries, tags, and where they should be added (if at all).
```

### Claude Output Schema
```json
{
  "source": "openphone",
  "summary": "New refund type: promo code booking on holiday",
  "action": "Add edge case to refund SOP",
  "category": "Refund",
  "sop_target": "Refunds > Promo Codes",
  "confidence": "high"
}
```

---

## Optional Future Enhancements

### Manual Resolved Override
- In ClubOSv1 `/support` tab, allow staff to manually mark thread as resolved
- Adds control for edge cases or high-value interactions

### LLM Response Drafting (Phase 4+)
- After filtering is proven useful, use Claude to draft suggested SOP or vector DB entries
- Eventually escalate to LLM auto-response or auto-tagging once quality is consistent

---

## Design Priorities
- Keep core system clean (append-only logging)
- Avoid premature automation or reply logic
- Defer filtering to trusted downstream LLMs
- Favor clarity, not complexity

---

## Claude Instructions
Claude should:
- Use this document as the architectural base
- Propose any needed adjustments to fit ClubOSv1 code conventions
- Begin implementing webhook, DB migrations, and export logic
- Defer all message analysis until export phase

