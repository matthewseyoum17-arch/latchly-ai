#!/bin/bash
# openclaw-run.sh — Quick launcher for the OpenClaw pipeline
#
# Usage:
#   ./scripts/openclaw-run.sh                    # Full pipeline (live)
#   ./scripts/openclaw-run.sh dry                # Dry run (preview only)
#   ./scripts/openclaw-run.sh scout              # Scout only
#   ./scripts/openclaw-run.sh outreach           # Outreach only (skip scout/audit/demo)
#   ./scripts/openclaw-run.sh closer             # Run closer (check inbox)
#   ./scripts/openclaw-run.sh target "Austin,TX" "plumber"  # Scout a specific city+niche
#
# Before first run:
#   1. Set RESEND_API_KEY in .env
#   2. Set ANTHROPIC_API_KEY in .env
#   3. Run migrations: node -e "require('./scripts/migrations/run-all')" (or manually)

cd "$(dirname "$0")/.."

case "${1:-full}" in
  dry)
    echo "=== DRY RUN ==="
    DRY_RUN=true node scripts/openclaw-pipeline.js
    ;;
  scout)
    echo "=== SCOUT ONLY ==="
    node scripts/openclaw-scout.js
    ;;
  audit)
    echo "=== AUDIT ONLY ==="
    node scripts/openclaw-audit.js
    ;;
  demo)
    echo "=== DEMO BUILD ONLY ==="
    node scripts/openclaw-demo-builder.js
    ;;
  outreach)
    echo "=== OUTREACH ONLY ==="
    SKIP_SCOUT=1 SKIP_AUDIT=1 SKIP_DEMO=1 node scripts/openclaw-pipeline.js
    ;;
  closer)
    echo "=== CLOSER ==="
    node scripts/openclaw-closer.js
    ;;
  target)
    CITY="${2:-Austin,TX}"
    NICHE="${3:-plumber}"
    echo "=== TARGETED RUN: ${NICHE} in ${CITY} ==="
    SCOUT_CITIES="${CITY}" SCOUT_NICHES="${NICHE}" SCOUT_MAX_PER_NICHE=50 node scripts/openclaw-pipeline.js
    ;;
  full)
    echo "=== FULL PIPELINE ==="
    node scripts/openclaw-pipeline.js
    ;;
  status)
    echo "=== PIPELINE STATUS ==="
    echo ""
    echo "Last 5 runs:"
    tail -5 leads/openclaw/pipeline-log.jsonl 2>/dev/null | node -e "
      const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\n');
      lines.forEach(l => {
        const d = JSON.parse(l);
        console.log('  ' + d.timestamp.slice(0,16) + ' | ' + d.mode.padEnd(7) + ' | scout:' + d.scout + ' audit:' + d.audit + ' demo:' + d.demo + ' sent:' + d.outreach);
      });
    " 2>/dev/null || echo "  No runs yet."
    echo ""
    if [ -f leads/openclaw/audited.json ]; then
      COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('leads/openclaw/audited.json','utf8')).length)")
      WITH_EMAIL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('leads/openclaw/audited.json','utf8')).filter(l=>l.email).length)")
      echo "Audited leads: ${COUNT} (${WITH_EMAIL} with email)"
    fi
    if [ -f leads/openclaw/needs-email.json ]; then
      NEED=$(node -e "console.log(JSON.parse(require('fs').readFileSync('leads/openclaw/needs-email.json','utf8')).length)")
      echo "Need email:    ${NEED}"
    fi
    ;;
  *)
    echo "Usage: $0 {full|dry|scout|audit|demo|outreach|closer|target|status}"
    echo ""
    echo "  full      Run full pipeline (scout→audit→demo→outreach)"
    echo "  dry       Preview what would happen without sending"
    echo "  scout     Scout new leads only"
    echo "  audit     Audit + enrich existing scouted leads"
    echo "  demo      Build demos for audited leads"
    echo "  outreach  Send emails only (uses existing audited leads)"
    echo "  closer    Check inbox and auto-respond to replies"
    echo "  target    Target a specific city+niche"
    echo "  status    Show pipeline status and stats"
    exit 1
    ;;
esac
