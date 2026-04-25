#!/usr/bin/env node

/**
 * Railway pre-deploy stub — DO NOT DELETE without first removing the
 * pre-deploy command from the Railway dashboard.
 *
 * History: this used to perform a V3-PLS pattern upgrade on deploy. V3-PLS
 * is no longer the active AI system (ClubAI superseded it), so the actual
 * upgrade logic was retired. This file remains as a stub because Railway's
 * Pre-Deploy command (configured in the dashboard, not in railway.json) is
 * still pointing at `node scripts/railway-pattern-upgrade.js`. Removing
 * this file without first clearing that dashboard setting causes every
 * deploy to fail at the pre-deploy step.
 *
 * To fully retire this file:
 *   1. In Railway dashboard → ClubOSV2 → Settings → Deploy →
 *      Pre-deploy command, clear the field (or set to a no-op).
 *   2. Confirm a deploy succeeds without it.
 *   3. Then delete this file.
 */

console.log('[pre-deploy] No-op stub — see file header for context.');
process.exit(0);
