# 🧠 RemoteOpsController – NinjaOne Integration Plan (ClubOSV1)

This file defines the implementation plan for the `RemoteOpsController` module inside **ClubOSV1**, specifically for integrating with **NinjaOne** to allow remote command execution (e.g. restarting TrackMan) from the ClubOS UI or routed LLM triggers.

---

## 📦 Full Claude Context (Required for Any Work)

### 🔧 ClubOSV1 System Summary

ClubOSV1 is a modular operating system built to run fully automated golf simulator locations. It handles:

- Internal LLM routing to Assistants (Booking, TechSupport, Emergency, etc.)
- Slack fallback and escalation logic
- SOP editing via Claude with Google Drive mirroring
- Admin-facing UI (Mission Control) for operations
- Remote command execution via NinjaOne and Splashtop

---

### ⚙️ Infrastructure Stack (ClubOSV1)

| Layer        | Tool                 | Notes                             |
| ------------ | -------------------- | --------------------------------- |
| Frontend     | Next.js (Vercel)     | Admin UI                          |
| Backend      | Node.js / Python     | API routes, routing logic         |
| Database     | PostgreSQL (Railway) | Ticketing, logging, users         |
| Hosting      | Railway.app          | Hosts backend + DB                |
| File System  | Google Drive         | SOPs and Assistant prompt source  |
| LLMs         | GPT-4o + Claude Opus | LLM routing + Claude file updates |
| Remote Tools | NinjaOne + Splashtop | PC automation and manual override |

---

### 🚀 Deployment Preferences

You prefer Claude to:

- Generate complete implementation-ready code
- Output `git` commit commands for terminal-based deployment
- Include `.env` key notes for any config changes
- Avoid breaking existing working systems
- Match file structure in your **local **``** root directory**

Deployment Script Example:

```bash
git add .
git commit -m "Add NinjaOne integration to RemoteOpsController"
git push origin main
```

---

## 🧩 Objective

Build a `RemoteOpsController` module that:

- Lets operators manually trigger bay-specific actions (e.g. restart TrackMan)
- Uses NinjaOne API to execute those commands
- Logs success/failure responses in ClubOS UI
- Prepares for future upgrade to LLM-triggered automation

---

## 🗂 Folder Layout (ClubOSV1)

```
ClubOSV1/
└── RemoteOpsController/
    ├── config/
    │   ├── device_map.json
    │   └── action_map.json
    ├── scripts/
    │   ├── restart_trackman.ps1
    │   └── restart_obs.ps1
    ├── routes/
    │   └── trigger_command.py
    ├── services/
    │   └── ninjaone_client.py
    ├── ui/
    │   └── command_buttons.jsx
    └── RemoteOpsController_ClubOSv1_Plan.md
```

---

## ✅ Phase 1 – External Setup (Pre-Reqs)

-

---

## ✅ Phase 2 – Configuration Files

### `config/device_map.json`

```json
{
  "bay_1": "CLUBHOUSE-BAY-1",
  "bay_2": "CLUBHOUSE-BAY-2",
  "bay_3": "CLUBHOUSE-BAY-3"
}
```

### `config/action_map.json`

```json
{
  "restart_trackman": {
    "script_id": "a1b2c3d4",
    "description": "Restart TrackMan software"
  },
  "restart_obs": {
    "script_id": "e5f6g7h8",
    "description": "Restart OBS"
  }
}
```

---

## ✅ Phase 3 – API Route

### `routes/trigger_command.py`

- POST `/remoteops/trigger`

```json
{
  "bay": "2",
  "action": "restart_trackman"
}
```

- Looks up bay in `device_map`
- Looks up action in `action_map`
- Sends command to NinjaOne via `ninjaone_client.py`
- Returns success/failure to the frontend

---

## ✅ Phase 4 – NinjaOne API Client

### `services/ninjaone_client.py`

- Auth with stored API key
- Endpoint: `POST /v1/device-scripts/run`

```json
{
  "device_id": "CLUBHOUSE-BAY-2",
  "script_id": "a1b2c3d4",
  "parameters": {}
}
```

- Handles HTTP call, retry, error logging
- Returns confirmation to API route

---

## ✅ Phase 5 – UI Buttons

### `ui/command_buttons.jsx`

Button layout for Operations page:

```
[ Bay 1 ]
[Restart TrackMan]   [Restart OBS]

[ Bay 2 ]
[Restart TrackMan]   [Restart OBS]
```

Each button sends POST to `/remoteops/trigger` with `{ bay, action }`.

---

## 🔐 Security & Control

- Admin-only button visibility
- Cooldown between repeated restarts (per bay)
- Logs every attempt with timestamp
- `.env` stores NinjaOne API key

---

## 🔜 Phase 6 – Future Expansion

- Allow Claude Assistants to auto-trigger command via SOP match (e.g., “TrackMan frozen”)
- Monitoring-based command triggers from NinjaOne alerts
- Feedback sent to Slack threads + customer view

---

This file replaces the previous `ninjaone_plan.md` and is correctly scoped for **ClubOSV1**. All build work should use this as the source plan.

