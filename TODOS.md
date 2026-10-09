# StudyBuddy — TODOS

Captured by /plan-eng-review on 2026-05-07. Post-Kaggle items.

---

## 1. Make `scripts/demo-seed.js` idempotent

**What:** Add an "Aisha already exists with N sessions, exiting 0" guard at
the top of `scripts/demo-seed.js` so re-running the script doesn't duplicate
seeded sessions.

**Why:** `progressStore.saveProgress()` appends to a sessions array. Running
the seed twice gives Aisha 6 photosynthesis sessions instead of 3. Cosmetic
for the dashboard demo, but the script is messy as-is.

**Pros:**
- Re-runnable without manual `data/progress.json` cleanup.
- Better hygiene if the seed is repurposed for other demos.

**Cons:**
- ~15 min, low value. If the seed is truly one-shot, this is over-engineering.

**Context:** Discovered in the /plan-eng-review session for the Kaggle
submission. The seed script is sketched in the design doc's E3 section.

**Depends on / blocked by:** Nothing.

---

## 2. Set up Jest + critical-path test coverage

**What:** Install `jest` and `supertest` as devDependencies. Write 6 tests covering
the security/correctness paths added in the demo-prep diff:

1. `escapeHtml` round-trip — all 5 escaped chars (& < > " '), non-string inputs return ''
2. `smartCache` concurrent write — 5 parallel `saveToDisk()` calls all land
3. `progressStore` corruption recovery — corrupt fixture triggers backup + reset (post D5 fix)
4. `sm2()` interval[1]=3 for grade>=3, reps=1 (per D2 documented change); reps reset on grade<3
5. `routes/chat` `/history` parsing — string, array, null, malformed-string all handled
6. `routes/quiz` 110s timeout — abort path returns graceful 200 fallback, not 500

**Why:** This diff added a security fix (XSS escape), a race fix (cache write
queue), and a corruption-recovery path (progressStore). All three are exactly the
kind of code that breaks silently. Without a regression test, the next refactor in
that area can re-introduce the bug and no one notices until production.

**Pros:**
- Real safety net for the next change to escapeHtml, smartCache, progressStore.
- Writeup-able as "tested core" if Kaggle has a follow-up round.
- Catches the next regression before users hit it.

**Cons:**
- ~30-45 min Jest setup + ~30 min for 6 tests.
- Adds dev-dependency tree (jest, supertest) — judges running `npm install` see
  more output but no runtime impact.
- Risk of Node-version-compatibility issues (Jest's babel-jest sometimes fights
  CommonJS projects).

**Context:** Discovered in /plan-eng-review for the Kaggle submission on 2026-05-07.
Project has no test framework today; only `benchmark.js` and `benchmark.quick.js`
(perf scripts, not assertion suites). The interim verification path is
`scripts/demo-verify.sh` (bash + curl, manually run before filming).

**Depends on / blocked by:** Nothing. Best done after Kaggle deadline to avoid
competing for filming time.
