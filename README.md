# ClubOSV1

Autonomous backend for golf simulator operations. Multi-agent LLM routing. Slack fallback. Zero human bottlenecks.

## 🚀 Quick Start

### Requirements
- Node.js 18+
- OpenAI API key (for LLMs)
- Slack webhook URL (for fallback routing)

### Installation

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### Configuration

Backend `.env`:
```
OPENAI_API_KEY=sk-...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
PORT=3001
```

Frontend `.env`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Run

```bash
# Backend
cd backend
npm run dev

# Frontend (in new terminal)
cd frontend
npm run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

---

## 🧠 Features (Live)

### LLM System
- Multi-agent routing:
  - `BookingLLM`
  - `EmergencyLLM`
  - `TechSupportLLM`
  - `ResponseToneLLM`
- Manual or auto route selection
- Slack fallback if LLM fails or times out

### UI
- Clean dark/light UI
- LLM toggle (Smart Assist on/off)
- Route selector with contextual helper
- Demo flow for TrackMan troubleshooting
- Confidence score, status badges, metadata

### API
- `POST /api/llm/request` – LLM command routing
- `POST /api/slack/message` – Slack fallback
- `GET /api/bookings` – Booking access
- `POST /api/access/request` – Unlock trigger
- `GET /api/history` – Static user history (placeholder)

---

## 🔜 Roadmap (Planned)

### LLM Layer
- ✅ Agent router abstraction with confidence scoring
- 🧠 Memory/context threading per user
- 🔁 Streaming support for LLM responses
- 🔒 Key/usage quota per user/operator

### Auth & Roles
- ✅ JWT + login
- 🔐 Role-based access: admin, operator, support
- ⏳ Token refresh + session enforcement

### Database & Storage
- 🗃️ Migrate to Mongo/Postgres
- 🧾 Full request/response logging
- 📅 Queryable history & audit trails

### Slack Ops
- ✅ Fallback on LLM failure
- 🧵 Response threading into Slack
- ✅ Structured payload with route metadata
- 🔐 Signature verification

### Frontend
- 📊 Route recommendations on low confidence
- 🧠 Command memory (replay or continue request)
- ⏱️ Live status polling
- 🧪 Admin-only dashboard

### DevOps
- 🚦 Healthcheck endpoints
- 🧵 Log routing (Winston)
- 🧲 Rate limiting per route
- 🚀 CI/CD, Vercel + Railway deploy

---

## 🧱 Project Structure

```
ClubOSV1/
├── frontend/       # Next.js app
│   ├── components/
│   ├── pages/
│   └── ...
└── backend/        # Express API
    ├── routes/
    ├── services/
    ├── middleware/
    └── ...
```

---

## ⚡ Usage Flow

1. Enter request (e.g., “Customer says TrackMan is frozen”)
2. Pick location if needed (optional)
3. Enable Smart Assist (or fallback to Slack)
4. Select LLM route (or auto)
5. Submit → receive structured response

Keyboard shortcuts:
- `Ctrl + Enter` = submit
- `Esc` = reset
- `Ctrl + D` = demo trigger

---

## 🛠️ Dev Commands

### Frontend
```bash
npm run dev       # Dev server
npm run build     # Build
npm run lint      # Linting
```

### Backend
```bash
npm run dev       # Dev server with TSX
npm run build     # Compile TS
npm start         # Prod build
npm run lint      # Linting
```

---

## 🧯 Troubleshooting

| Problem               | Fix                                      |
|-----------------------|-------------------------------------------|
| Frontend won't start  | Ensure Node 18+, reinstall deps           |
| Backend errors        | Check `.env`, API key, port config        |
| No LLM response       | Validate OpenAI key, test fallback route  |
| CORS issues           | Ensure ports + headers are aligned        |

---

## 🧾 License

Internal use only. Not open source.

---

Built for autonomous golf infrastructure. System, not service.
# Trigger deployment Thu 24 Jul 2025 21:55:33 ADT
