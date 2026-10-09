#!/usr/bin/env bash
# scripts/demo-verify.sh — manual verification before filming the Lights Out demo.
#
# Exercises the demo-critical paths landed in the demo-prep diff:
#   1. Server health
#   2. d3 vendored locally + served at /vendor/d3.min.js
#   3. Service worker bumped to v3 + precaches d3
#   4. concept-map.js has the d3 undefined guard
#   5. utils.js exports escapeHtml (XSS render path is wired)
#   6. agent/models.js loads cleanly + exports the helpers
#   7. /chat smoke test (Ollama is up, streaming works)
#   8. smartCache concurrent-write race (queue serializes)
#   9. progress.json corruption recovery + .corrupted-<ts> backup (D5)
#  10. Demo-topic cache pre-warm
#
# Usage:
#   bash scripts/demo-verify.sh
#   PORT=4000 DEMO_TOPIC="newton's laws" bash scripts/demo-verify.sh
#
# Exit code: 0 if every check passes, 1 otherwise. Run before EVERY filming
# session — Ollama state and progress.json drift between takes.

set -uo pipefail

# ─── config ─────────────────────────────────────────────────────────────
PORT=${PORT:-3000}
HOST="http://localhost:$PORT"
DEMO_TOPIC=${DEMO_TOPIC:-photosynthesis}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$PROJECT_ROOT/data"

# ─── output helpers ─────────────────────────────────────────────────────
if [ -t 1 ]; then
  GREEN=$'\033[32m'; RED=$'\033[31m'; YELLOW=$'\033[33m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  GREEN=""; RED=""; YELLOW=""; BOLD=""; RESET=""
fi
ok()    { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
fail()  { printf '%s✗%s %s\n' "$RED"   "$RESET" "$*" >&2; FAILS=$((FAILS+1)); }
warn()  { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
section() { printf '\n%s── %s ──%s\n' "$BOLD" "$*" "$RESET"; }

FAILS=0

# ─── 1. server reachable ────────────────────────────────────────────────
section "1. Server health"
if ! curl -fsS --max-time 5 "$HOST/" -o /dev/null 2>&1; then
  fail "Server not reachable at $HOST"
  printf '  %sStart it first:%s npm start\n' "$BOLD" "$RESET"
  exit 1
fi
ok "Server up at $HOST"

# ─── 2. d3 vendored + served ────────────────────────────────────────────
section "2. d3.min.js served from /vendor (offline-mode prerequisite)"
status=$(curl -o /dev/null -s -w '%{http_code}' "$HOST/vendor/d3.min.js")
if [ "$status" = "200" ]; then
  ok "/vendor/d3.min.js → 200"
else
  fail "/vendor/d3.min.js → $status (expected 200)"
fi

bytes=$(curl -fsS "$HOST/vendor/d3.min.js" 2>/dev/null | wc -c | tr -d ' ' || echo 0)
if [ "$bytes" -gt 100000 ]; then
  ok "d3.min.js is $bytes bytes (looks like the full minified library)"
else
  fail "d3.min.js is only $bytes bytes — file may be a 404 page or truncated"
fi

# Chart.js for the teacher dashboard
status=$(curl -o /dev/null -s -w '%{http_code}' "$HOST/vendor/chart.umd.min.js")
if [ "$status" = "200" ]; then
  ok "/vendor/chart.umd.min.js → 200"
else
  fail "/vendor/chart.umd.min.js → $status (teacher dashboard charts fail offline)"
fi
bytes=$(curl -fsS "$HOST/vendor/chart.umd.min.js" 2>/dev/null | wc -c | tr -d ' ' || echo 0)
if [ "$bytes" -gt 100000 ]; then
  ok "chart.umd.min.js is $bytes bytes (looks like the full library)"
else
  fail "chart.umd.min.js is only $bytes bytes — file may be a 404 page or truncated"
fi

# ─── 3. service worker cache version + vendor precache ─────────────────
section "3. Service worker cache version + vendor precache"
sw_content=$(curl -fsS "$HOST/sw.js" 2>/dev/null || echo "")
sw_version=$(printf %s "$sw_content" | sed -nE "s/.*CACHE_VERSION[[:space:]]*=[[:space:]]*['\"](studybuddy-v[0-9]+)['\"].*/\1/p" | head -1)
if [ -n "$sw_version" ]; then
  ok "sw.js has CACHE_VERSION = $sw_version"
else
  fail "sw.js missing a studybuddy-v<N> CACHE_VERSION — clients will not refresh on next install"
fi
if printf %s "$sw_content" | grep -q "/vendor/d3.min.js"; then
  ok "sw.js precaches /vendor/d3.min.js"
else
  fail "sw.js does not precache d3 — first offline load will fail"
fi
if printf %s "$sw_content" | grep -q "/vendor/chart.umd.min.js"; then
  ok "sw.js precaches /vendor/chart.umd.min.js"
else
  fail "sw.js does not precache Chart.js — teacher dashboard fails offline"
fi

# ─── 4. concept-map d3 guard ────────────────────────────────────────────
section "4. concept-map.js handles missing d3"
if curl -fsS "$HOST/scripts/concept-map.js" 2>/dev/null | grep -q "typeof d3 === 'undefined'"; then
  ok "concept-map.js has d3 undefined guard"
else
  fail "concept-map.js missing d3 undefined guard — will throw if d3 not loaded"
fi

# ─── 5. escapeHtml exported ─────────────────────────────────────────────
section "5. escapeHtml available on the client"
utils=$(curl -fsS "$HOST/scripts/utils.js" 2>/dev/null || echo "")
if printf %s "$utils" | grep -q "function escapeHtml"; then
  ok "utils.js declares escapeHtml"
else
  fail "utils.js missing escapeHtml — XSS render paths broken"
fi
# Sanity: the canonical version escapes 5 chars (& < > ' ")
if printf %s "$utils" | grep -q "&#039;"; then
  ok "escapeHtml escapes single quotes (canonical 5-char version)"
else
  warn "escapeHtml may be the older 3-char version — verify it escapes ' and \""
fi

# ─── 6. agent/models.js loads ───────────────────────────────────────────
section "6. agent/models.js exports the right shape"
models_out=$(node -e '
  const m = require("./agent/models");
  const want = ["REASONING","CLASSIFIER","SPECULATIVE_DRAFT","reasoningWithDraft","classifier"];
  const missing = want.filter(k => !(k in m));
  if (missing.length) { console.error("missing:", missing.join(",")); process.exit(1); }
  const r = m.reasoningWithDraft();
  if (!r.model || !r.speculative_model) { console.error("reasoningWithDraft shape wrong:", r); process.exit(1); }
  const c = m.classifier();
  if (!c.model) { console.error("classifier shape wrong:", c); process.exit(1); }
  console.log("REASONING=" + m.REASONING + ", DRAFT=" + m.SPECULATIVE_DRAFT + ", CLASSIFIER=" + m.CLASSIFIER);
' 2>&1)
models_rc=$?
if [ "$models_rc" = "0" ]; then
  ok "models.js OK ($(printf %s "$models_out" | tail -1))"
else
  fail "models.js failed to load — $(printf %s "$models_out" | tail -1)"
fi

# ─── 7. /chat smokes ────────────────────────────────────────────────────
# Cold model ≈ 50-90s before first token on a 4B reasoning model. Demo
# topic should already be warm by check 10, but a fresh server restart
# means this runs cold — give it room.
section "7. /chat streams a token (Ollama up + reasoning model loaded)"
chat_body='{"message":"What is 2+2? One sentence.","level":"beginner","language":"English"}'
chat_out=$(curl -sS --max-time 120 -N -X POST "$HOST/chat" \
  -H "Content-Type: application/json" -d "$chat_body" 2>/dev/null | head -c 4000 || true)
if printf %s "$chat_out" | grep -q '"token"'; then
  ok "/chat streamed at least one token (within 120s)"
else
  fail "/chat did not stream a token within 120s — Ollama may be down or model unloaded"
  printf '  %sFirst 300 chars of response:%s %s\n' "$YELLOW" "$RESET" "$(printf %s "$chat_out" | head -c 300)"
fi

# ─── 8. smartCache concurrent-write race ────────────────────────────────
section "8. smartCache write queue handles concurrent writes"
# Use a per-run unique tool prefix so keys don't collide with prior runs
# (otherwise smartSet just overwrites existing entries and memEntries
# doesn't grow, giving a false "lost writes" reading).
cache_check=$(node -e '
  const c = require("./agent/smartCache");
  const N = 25;
  const before = c.getCacheStats().memEntries || 0;
  const TOOL = "verify-" + process.pid + "-" + Date.now();
  for (let i = 0; i < N; i++) {
    c.smartSet(TOOL, "race-key-" + i, "beginner", { value: i });
  }
  // Allow setImmediate-driven write queue to drain
  setTimeout(() => {
    const after = c.getCacheStats().memEntries || 0;
    const got = after - before;
    if (got >= N) {
      console.log("OK " + got + " entries written");
      process.exit(0);
    } else {
      console.error("LOST " + (N - got) + " of " + N + " entries (" + got + " landed)");
      process.exit(1);
    }
  }, 500);
' 2>&1 | grep -E "^(OK|LOST)" | tail -1)
case "$cache_check" in
  OK*) ok "Cache write queue: $cache_check" ;;
  *)   fail "Cache write queue dropped writes — ${cache_check:-no result}" ;;
esac

# ─── 9. progress.json corruption recovery + D5 backup ───────────────────
section "9. Corrupt progress.json → /progress recovers + .corrupted-<ts> backup"
PROGRESS_FILE="$DATA_DIR/progress.json"
backup_existed_before=0
if ls "$PROGRESS_FILE".corrupted-* >/dev/null 2>&1; then
  backup_existed_before=$(ls "$PROGRESS_FILE".corrupted-* | wc -l | tr -d ' ')
fi

# Save the real file so we can restore after the test
if [ -f "$PROGRESS_FILE" ]; then
  cp "$PROGRESS_FILE" "$PROGRESS_FILE.demoverify.bak"
fi
printf '%s' '{not-valid-json' > "$PROGRESS_FILE"

prog_status=$(curl -o /dev/null -s -w '%{http_code}' --max-time 10 "$HOST/progress")
if [ "$prog_status" = "200" ]; then
  ok "/progress returned 200 despite corrupt input"
else
  fail "/progress returned $prog_status (expected 200) on corrupt input"
fi

backup_count_after=0
if ls "$PROGRESS_FILE".corrupted-* >/dev/null 2>&1; then
  backup_count_after=$(ls "$PROGRESS_FILE".corrupted-* | wc -l | tr -d ' ')
fi
new_backups=$(( backup_count_after - backup_existed_before ))
if [ "$new_backups" -ge 1 ]; then
  latest=$(ls -t "$PROGRESS_FILE".corrupted-* 2>/dev/null | head -1)
  ok "$new_backups new corrupted-backup file(s) created (latest: $(basename "$latest"))"
else
  fail "No new progress.json.corrupted-* backup created — D5 not active"
fi

# Restore real progress.json
if [ -f "$PROGRESS_FILE.demoverify.bak" ]; then
  mv "$PROGRESS_FILE.demoverify.bak" "$PROGRESS_FILE"
fi

# ─── 10. Pre-warm cache for the demo topic ─────────────────────────────
section "10. Pre-warm cache for DEMO_TOPIC=\"$DEMO_TOPIC\""
warm_status=$(curl -o /dev/null -s -w '%{http_code}' --max-time 300 -X POST "$HOST/quiz" \
  -H 'Content-Type: application/json' \
  -d "{\"topic\":\"$DEMO_TOPIC\",\"level\":\"intermediate\",\"numQuestions\":5}")
if [ "$warm_status" = "200" ]; then
  ok "/quiz pre-warmed for '$DEMO_TOPIC' (status 200)"
else
  warn "/quiz returned $warm_status — cache may not be warmed for '$DEMO_TOPIC'"
fi

stats=$(curl -fsS --max-time 5 "$HOST/cache-stats" 2>/dev/null || echo "")
if printf %s "$stats" | grep -q '"memEntries"'; then
  count=$(printf %s "$stats" | sed -n 's/.*"memEntries":[[:space:]]*\([0-9]*\).*/\1/p')
  ok "cache-stats shows memEntries=$count"
else
  warn "cache-stats unreachable — could not confirm cache state"
fi

# ─── summary ────────────────────────────────────────────────────────────
section "Result"
if [ "$FAILS" = "0" ]; then
  printf '%s%sAll demo-critical checks passed.%s Ready to film.\n' "$BOLD" "$GREEN" "$RESET"
  exit 0
else
  printf '%s%s%d check(s) failed.%s Demo NOT verified.\n' "$BOLD" "$RED" "$FAILS" "$RESET"
  exit 1
fi
