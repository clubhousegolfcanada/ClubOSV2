#!/bin/bash

# Set working dir to ClubOS
PROJECT_DIR="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"
LOG_FILE="$PROJECT_DIR/logs/claude_session_log.md"

cd "$PROJECT_DIR" || exit 1

# Ensure logs dir exists
mkdir -p "$(dirname "$LOG_FILE")"

# Timestamp header
echo "## 🧠 Claude Dev Session — $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Preload Claude with project context
echo "Injecting session context..."

cat <<EOF >> "$LOG_FILE"
**Context:**
- Project: ClubOSV1
- Stack: Vercel (Next.js), Railway (Postgres), modular folders (Assistants, Router, UI, etc)
- Claude has read/write access to all files
- This session starts at: $(date)

---

EOF

# Start Claude Code
claude code | tee -a "$LOG_FILE"
