# TODO Audit - November 2025

This document tracks all TODOs found in the codebase, categorized by status and priority.

## Summary
- **Total TODOs found**: 41
- **Can remove (stale/completed)**: 7
- **Known issues (documented)**: 3
- **Feature requests**: 15
- **Keep as-is (implementation notes)**: 16

---

## 🗑️ Can Remove - Stale or Completed

| File | Line | TODO | Reason |
|------|------|------|--------|
| `migrations/201_pattern_learning_system.sql` | 284-286 | "Run migration", "Verify tables", "Check config" | Migration already run in production |
| `patternLearningService.ts` | 173 | "Remove in production" | Debug log, but logger already handles this |
| `index.ts` | 374 | "Move imports to top" | Not important, doesn't affect function |

---

## 📝 Known Issues - Already Documented

| File | Line | TODO | Status |
|------|------|------|--------|
| `auth.ts` | 239 | "Generate reset token and send email" | ⚠️ README notes password reset is non-functional |
| `AuthService.ts` | 242 | "Send reset email" | Same as above |
| `gptWebhook.ts` | 52, 149, 162 | "Re-enable when GPT function handler is fixed" | GPT functions disabled - needs investigation |

---

## 🚀 Feature Requests - Create GitHub Issues

### Notifications & Email
| File | Line | Description |
|------|------|-------------|
| `AuthService.ts` | 181 | Send welcome email with verification link |
| `auth.ts` | 895 | Send approval email to user |
| `UserService.ts` | 174 | Send approval email |
| `UserService.ts` | 193 | Send rejection email |
| `friends.ts` | 299 | Send email/SMS invitation |
| `friends.ts` | 367 | Send push notification to target user |
| `friends.ts` | 412 | Send notification to requester |
| `seasonalReset.ts` | 346 | Send actual notification |
| `slack.ts` | 976 | Trigger real-time notification (WebSocket/SSE) |

### Integration Features
| File | Line | Description |
|------|------|-------------|
| `webhooks.ts` | 194 | Implement HubSpot contact update |
| `hubspotBookings.ts` | 41 | Re-enable after confirming HubSpot webhook format |
| `integrations.ts` | 194 | Actually test the webhook |
| `integrations.ts` | 214 | Actually test the API connection |

### Background Jobs
| File | Line | Description |
|------|------|-------------|
| `messages.ts` | 215 | Implement background job to enrich conversations |
| `llm.ts` | 805 | Implement request logs in database |

---

## ✅ Keep As-Is - Implementation Notes

These are legitimate TODOs that serve as implementation reminders or future enhancement notes:

| File | Line | Description |
|------|------|-------------|
| `patternLearningService.ts` | 10 | File setup instructions |
| `patternLearningService.ts` | 103-104 | Set up daily confidence decay/promotion jobs |
| `patternLearningService.ts` | 1156 | Implement pattern merging logic |
| `patternLearningService.ts` | 1654 | Next steps documentation |
| `aiAutomationService.ts` | 1541 | Get device ID from bay number mapping |
| `aiAutomationService.ts` | 1549 | Monitor job status |
| `smartUpsellService.ts` | 5 | Replace with actual notification service |
| `customer-interactions.ts` | 383 | Implement conversation knowledge extraction |
| `messages.ts` | 187 | Re-enable filtering once phone extraction fixed |
| `messages.ts` | 1183 | Extract actions taken |
| `openphone.ts` | 994 | Extract actions taken |
| `privacy.ts` | 180 | Track last retention run |
| `AuthController.ts` | 326, 343, 360 | AuthService feature implementations |
| `index.ts` | 253 | Uncomment when refactored routes ready |

---

## Recommended Actions

1. **Remove stale TODOs** from migration files (already run)
2. **Create GitHub issue** for email/notification system (covers 9 TODOs)
3. **Create GitHub issue** for GPT function handler fix
4. **Create GitHub issue** for HubSpot integration testing
5. **Keep password reset issue** documented in README (already noted)

---

*Audit performed: November 25, 2025*
