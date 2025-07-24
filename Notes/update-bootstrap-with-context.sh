#!/bin/bash
# === Config ===
NOTES_DIR="../Notes"
CONTINUITY_FILE="$NOTES_DIR/_chat_continuity.md"
BOOTSTRAP_FILE="$NOTES_DIR/_bootstrap.md"
TEMP_FILE="$NOTES_DIR/_bootstrap.tmp"
LINES=40  # Number of lines to include from continuity log

# === Check files exist ===
if [[ ! -f "$CONTINUITY_FILE" ]]; then
  echo "❌ No continuity log found at: $CONTINUITY_FILE"
  exit 1
fi

if [[ ! -f "$BOOTSTRAP_FILE" ]]; then
  echo "❌ No bootstrap file found at: $BOOTSTRAP_FILE"
  exit 1
fi

# === Split bootstrap at Code Context section ===
awk '
  BEGIN { found = 0 }
  /## 📄 Code Context/ { found = 1; print; print ""; next }
  found == 0 { print }
' "$BOOTSTRAP_FILE" > "$TEMP_FILE"

echo '```' >> "$TEMP_FILE"
tail -n $LINES "$CONTINUITY_FILE" >> "$TEMP_FILE"
echo '```' >> "$TEMP_FILE"

# === Add rest of bootstrap file ===
awk '
  BEGIN { found = 0 }
  /## 📄 Code Context/ { found = 1; next }
  found == 1 && /^## / { found = 2 }
  found == 2 { print }
' "$BOOTSTRAP_FILE" >> "$TEMP_FILE"

# === Replace bootstrap ===
mv "$TEMP_FILE" "$BOOTSTRAP_FILE"

echo "✅ _bootstrap.md updated with last $LINES lines from _chat_continuity.md"
