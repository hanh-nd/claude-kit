# TEST_PLANS.md — Wiki-Inject Correctness Overhaul

> **Plan Source:** `.agent-kit/handoffs/wiki-inject-correctness/plan.md`
> **Date:** 2026-05-17
> **Scope:** Manual verification of AC-1 through AC-11 across three AI provider hook shapes — Claude, Gemini, Codex/GPT.

---

## Background: Provider Hook Shape Differences

The trigger gate is **field-based**, not tool-name-based. Each provider sends PreToolUse events with different field shapes. All three must be tested explicitly.

| Provider | File Write Signal | File Read Signal | Shell Signal |
|---|---|---|---|
| **Claude** | `file_path` + `new_string`/`content` via Edit/Write/MultiEdit | `file_path` via Read | `command` via Bash |
| **Gemini** | `path` + `content` via write_file | `path` via read_file | `command` via run_terminal_cmd |
| **Codex/GPT** | `command` containing `*** Update/Create File:` (apply_patch) | `path` via `str_replace_based_edit` | `command` via shell |

---

## Prerequisites

1. A local wiki root (`.agent-kit/wiki/`) with at least 3 pages:
   - **Page A** (`entities/auth-service.md`): anchors `["scripts/auth/service.ts", "AuthService"]`, status `active`, updated recently.
   - **Page B** (`concepts/bm25-scoring.md`): body-heavy text about "scoring algorithm configuration thresholds", no path/symbol anchors relevant to test queries, status `active`.
   - **Page C** (`glossary/cooldown.md`): anchors `["scripts/wiki/cooldown.ts"]`, status `complete`, updated > 180 days ago.
2. The hook wired into `.claude/hooks/hooks.json`, `.codex/hooks/hooks.json`, `.gemini/hooks/hooks.json`.
3. `settings.wiki.debug: true` enabled for all test runs unless noted.
4. Clear `.agent-kit/wiki/.runtime/cooldown.json` and `injected.json` before each test group.

---

## AC-1 — Trigger Gate: Tool/Field Allow-List

> **AC:** Hook short-circuits before retrieval for tools outside the allow-list, for `Read` with non-code-like extensions and no anchored path-prefix, and for `Bash` matching denylist or with command length < 4.

### Test 1.1 — File-write tools are always allowed (all providers)

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: trigger `Edit` with `file_path: "scripts/auth/service.ts"`, `new_string: "AuthService"` | Hook runs full pipeline, does **not** return `gate-rejected` in debug log |
| 2 | Gemini: trigger `write_file` with `path: "scripts/auth/service.ts"`, `content: "AuthService"` | Same — gate allows, full pipeline runs |
| 3 | Codex: trigger apply_patch with `command: "*** Update File: scripts/auth/service.ts\n..."` | Same — gate allows via patch-format detection |

**Pass criteria:** Debug log contains `decision: 'injected'` or a post-gate rejection (`threshold`, `strong-signal`), never `gate-rejected`.

---

### Test 1.2 — Read with non-code extension is denied (all providers)

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: trigger `Read` with `file_path: "data/report.xlsx"` | Debug log: `gate-rejected`, reason `read-no-code-ext-or-anchor-prefix` |
| 2 | Gemini: trigger `read_file` with `path: "data/report.xlsx"` | Same rejection |
| 3 | Codex: trigger read with `path: "data/report.xlsx"` | Same rejection |

**Pass criteria:** All three providers return `{}`, no corpus loaded (cold cache remains cold).

---

### Test 1.3 — Read with `.ts` extension is allowed (all providers)

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Read` with `file_path: "scripts/auth/service.ts"` | Gate allows, pipeline continues |
| 2 | Gemini: `read_file` with `path: "scripts/auth/service.ts"` | Gate allows |
| 3 | Codex: read with `path: "scripts/auth/service.ts"` | Gate allows |

**Pass criteria:** No `gate-rejected` in debug log.

---

### Test 1.4 — Bash denylist rejects trivial commands (all providers)

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Bash` with `command: "ls"` (length 2) | Debug log: `gate-rejected`, reason `bash-too-short` |
| 2 | Claude: `Bash` with `command: "git status"` | Debug log: `gate-rejected`, reason starts with `bash-denylist:` |
| 3 | Claude: `Bash` with `command: "cd .."` | Debug log: `gate-rejected`, reason starts with `bash-denylist:` |
| 4 | Gemini: `run_terminal_cmd` with `command: "git status"` | Same rejection |
| 5 | Codex: shell with `command: "git status"` | Same rejection |

**Pass criteria:** All return `{}`.

---

### Test 1.5 — Bash allowlist passes meaningful commands

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Bash` with `command: "node scripts/wiki-inject-context.ts"` | Gate allows (not in default denylist) |
| 2 | Gemini: same command shape | Gate allows |

**Pass criteria:** Pipeline proceeds past gate (may still reject later via threshold/strong-signal).

---

### Test 1.6 — Unknown/unsupported tools are denied

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `WebSearch` with `query: "auth service scoring"` | `gate-rejected`, reason `tool-not-in-allowlist` |
| 2 | Claude: `Glob` with `pattern: "**/*.ts"` | `gate-rejected` |
| 3 | Gemini: any tool with no recognized fields | `gate-rejected` |

**Pass criteria:** All return `{}`.

---

## AC-2 — Tokenizer: camelCase, snake_case, Stopwords, Cap

> **AC:** Tokenizer splits camelCase/PascalCase and snake_case, applies light plural stemming, filters stopwords, and caps free-text contribution to top-20 unique tokens.

### Test 2.1 — camelCase splitting reaches correct page

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `file_path: "scripts/auth/getUserProfile.ts"` | Query symbols include `get`, `user`, `profile` (split from filename) |
| 2 | Verify debug log `top3` shows Page A scored on `user` + `profile` tokens | Page A (`auth-service.md`) appears in top3 with non-zero `filenameBM25` or `headingBM25` |

**Pass criteria:** Page A is scored, not skipped.

---

### Test 2.2 — Stopwords filtered from free text

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `new_string: "the and for with from this"` (only stopwords) | `freeTextTokens` is empty; `terms` falls back to symbols only |
| 2 | If `file_path` is also generic (e.g. `data.bin`), `terms.length < minQueryTokens` → early exit | Debug log: `min-query-tokens` |

**Pass criteria:** No injection from stopword-only free text.

---

### Test 2.3 — Light plural stemming

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `new_string: "services authentication tokens"` | Tokens include `service`, `authentication`, `token` (stripped trailing `s` where applicable) |
| 2 | Ensure this matches a page with singular form in its body | Page A scored on `service` term |

**Pass criteria:** Stemmed terms match corpus entries.

---

### Test 2.4 — Free-text cap at 20 unique tokens

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `new_string` containing 30 unique non-stopword tokens | Debug log shows `terms.length ≤ 20` (inspect via `top3[0].breakdown`) |

**Pass criteria:** `terms` never exceeds 20 unique free-text contributions.

---

## AC-3 — Anchor Matching: Path (+5.0) and Symbol (+3.0)

> **AC:** Anchors classified by shape; path-anchors matched via exact path-prefix (+5.0), symbol-anchors via exact token (+3.0). Both feed strong-signal gate.

### Test 3.1 — Path anchor match produces strong signal (all providers)

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `file_path: "/abs/scripts/auth/service.ts"` | Page A (anchor: `scripts/auth/service.ts`) gets `breakdown.anchorExactPath ≥ 5.0`, `strongSignal: true` |
| 2 | Gemini: `write_file` with `path: "/abs/scripts/auth/service.ts"` | Same result |
| 3 | Codex: apply_patch targeting `scripts/auth/service.ts` | Same result |

**Pass criteria:** `breakdown.anchorExactPath ≥ 5.0` in debug log for all three providers.

---

### Test 3.2 — Symbol anchor match produces strong signal

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `file_path: "src/AuthService.ts"` | `AuthService` tokenized to `authservice`; Page A (anchor: `AuthService`) gets `breakdown.anchorExactSymbol ≥ 3.0` |
| 2 | Verify `strongSignal: true` in debug log breakdown | Both path and symbol route to strong-signal = true |

**Pass criteria:** `anchorExactSymbol ≥ 3.0`, page injected.

---

### Test 3.3 — Page with no relevant anchors does not benefit from anchor scoring

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `file_path: "scripts/unrelated/file.ts"` targeting Page B | Page B has no matching path/symbol anchors; `anchorExactPath = 0`, `anchorExactSymbol = 0` |
| 2 | If Page B only matches on body terms → `strongSignal: false` | Page B filtered by strong-signal gate |

**Pass criteria:** Page B is rejected with `decision: 'strong-signal-gate'` when body-only match.

---

## AC-4 — BM25 Replaces Raw Term-Count Scoring

> **AC:** BM25 (k1=1.5, b=0.75) replaces raw term-count for slug, title+anchor-text, key-decisions, body. Single corpus-wide IDF.

### Test 4.1 — Rare term outscores common term via IDF

**Setup:** Page B contains the word `config` in every paragraph (common), and `acquirelock` once (rare).

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `new_string: "acquirelock"` | Page B's `bodyBM25` for `acquirelock` > `bodyBM25` for `config` |
| 2 | Verify via debug `top3[0].breakdown` | `bodyBM25` reflects IDF — `acquirelock` scores higher per-occurrence |

**Pass criteria:** Rare term produces measurably higher per-term BM25 contribution than common term.

---

### Test 4.2 — Long document does not unfairly dominate (length normalization)

**Setup:** Add a Page D with a very long body and `auth` appearing 50 times. Page A has `auth` appearing 3 times in a short body.

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `new_string: "auth"` | Page D's `bodyBM25` for `auth` is **not** 16× Page A's (TF saturation via k1=1.5 kicks in) |
| 2 | Inspect debug `top3` breakdown | Scores should be comparable, not a 50:3 raw ratio |

**Pass criteria:** `bodyBM25(PageD) / bodyBM25(PageA) < 3.0` despite 50:3 TF ratio.

---

## AC-5 — Strong-Signal Gate

> **AC:** A hit with only body / key-decision matches is rejected before threshold check.

### Test 5.1 — Body-only match is always rejected (all providers)

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `new_string: "scoring algorithm configuration thresholds"` (terms only in Page B's body, not slug/title) | All pages score 0 on `filenameBM25`, `headingBM25`, `anchorExactPath`, `anchorExactSymbol`; `strongSignal: false` → gate rejects |
| 2 | Debug log: `decision: 'strong-signal-gate'` | No injection |
| 3 | Gemini: same content field | Same rejection |
| 4 | Codex: same content in patch | Same rejection |

**Pass criteria:** `{}` returned for all three providers, debug confirms `strong-signal-gate`.

---

### Test 5.2 — Key-decision-only match is rejected (no file/heading signal)

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` targeting a page whose only match is in `keyDecisions` field | `keyDecisionBM25 > 0`, but `strongSignal: false` → gate rejects |

**Pass criteria:** Key-decision match alone is insufficient for injection.

---

## AC-6 — Margin Gate

> **AC:** When hits.length ≥ 2 and hits[0].score / hits[1].score < injectMarginRatio (default 1.5), reject. Skipped when fewer than 2 hits.

### Test 6.1 — Two near-equal top hits → both rejected

**Setup:** Craft an edit touching both Page A and Page C anchors equally.

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `file_path` that matches both Page A and Page C path anchors with nearly equal scores | `hits[0].score / hits[1].score < 1.5` → `applyMarginGate` returns `[]` |
| 2 | Debug log: `decision: 'margin'` | `{}` returned |
| 3 | Gemini: same scenario | Same outcome |

**Pass criteria:** Neither page injected when margin ratio violated.

---

### Test 6.2 — Single hit passes margin gate

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `file_path: "scripts/auth/service.ts"` (only Page A anchored) | Only one hit after strong-signal + threshold gates; margin gate skipped; page injected |

**Pass criteria:** `additionalContext` contains `[WIKI HIT]` for Page A.

---

### Test 6.3 — Clear winner (ratio ≥ 1.5) passes margin gate

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` touching Page A anchor strongly and Page C weakly | `hits[0].score / hits[1].score ≥ 1.5` → margin gate passes; top hit injected |

**Pass criteria:** Page A injected, Page C not injected (bounded by `injectMaxResults: 1`).

---

## AC-7 — injectMaxResults Caps Injections

> **AC:** injectMaxResults (default 1, max 2) caps injections per call; with N=2 the single margin check governs both slots.

### Test 7.1 — Default: only one page injected even with two qualifying hits

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `injectMaxResults: 1` (default), two hits both pass all gates with ratio ≥ 1.5 | Only `hits[0]` injected; `additionalContext` contains exactly **one** `[WIKI HIT]` occurrence |

**Pass criteria:** Single injection confirmed via string count in `additionalContext`.

---

### Test 7.2 — injectMaxResults=2: two injections with clear margin

**Setup:** Configure `settings.wiki.injectMaxResults: 2`.

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with two strong-signal hits, ratio ≥ 1.5 | `additionalContext` contains exactly **two** `[WIKI HIT]` occurrences |
| 2 | Gemini: same event | Same — two injections |
| 3 | Codex: same event | Same — two injections |

**Pass criteria:** Exactly two `[WIKI HIT]` in output for all three providers.

---

### Test 7.3 — injectMaxResults=2, margin fails → zero injections (SEAM 6↔7)

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: two hits with score ratio < 1.5, `injectMaxResults: 2` | `applyMarginGate` returns `[]` → **zero** injections, not partial |
| 2 | Debug log: `decision: 'margin'` | `{}` returned |

**Pass criteria:** Confirm SEAM behavior: one margin check governs both slots.

---

### Test 7.4 — injectMaxResults clamped to 2 max

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Set `settings.wiki.injectMaxResults: 5` in config | `getWikiConfig` returns `injectMaxResults: 2` (clamped) |
| 2 | Even with 5 qualifying hits, only 2 are injected | `additionalContext` contains at most two `[WIKI HIT]` |

**Pass criteria:** Clamp enforced at config layer.

---

## AC-8 — Parsed-Page Cache (mtime-keyed)

> **AC:** Parsed-page cache at `.agent-kit/wiki/.runtime/index.json`, mtime-keyed; only changed pages re-parsed; IDF recomputed on any change; atomic tmp+rename writes.

### Test 8.1 — Cold build writes index.json

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Delete `.agent-kit/wiki/.runtime/index.json` | File absent |
| 2 | Claude: trigger any file-write event that passes the gate | `index.json` created; contains `schemaVersion: 1`, all pages, `idf`, `avgBodyLength` |
| 3 | Check file is valid JSON and parseable | No corruption |

**Pass criteria:** `index.json` created and valid.

---

### Test 8.2 — Warm load reuses unchanged pages

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Warm cache exists from Test 8.1 | `index.json` present |
| 2 | Touch no wiki pages (do not modify) | `loadOrBuildIndex` reads cache; no re-parse (verify via timing: warm < 5ms vs cold > 10ms) |
| 3 | Second hook call with same wiki state | Response faster; same `idf` values as cold build |

**Pass criteria:** Warm load measurably faster; IDF identical to cold build result.

---

### Test 8.3 — Modified page triggers single re-parse + IDF recompute

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Advance mtime of Page A only (`touch .agent-kit/wiki/entities/auth-service.md`) | One page has newer mtime than cache entry |
| 2 | Claude: trigger a hook call | Only Page A re-parsed; Pages B, C reused from cache |
| 3 | If Page A content changed vocabulary, `idf` in new `index.json` differs from previous | IDF updated atomically |

**Pass criteria:** Single page re-parsed; IDF recomputed; other pages untouched.

---

### Test 8.4 — Corrupt cache triggers cold rebuild

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Write invalid JSON to `.agent-kit/wiki/.runtime/index.json` | `{"broken":` (truncated) |
| 2 | Claude: trigger a hook call | Cold rebuild succeeds; valid `index.json` written; no crash |

**Pass criteria:** Hook returns valid response (not `{}`), new `index.json` is valid.

---

### Test 8.5 — cacheEnabled=false bypasses disk I/O

**Setup:** Set `settings.wiki.cacheEnabled: false`.

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Delete `index.json` | File absent |
| 2 | Claude: trigger hook | Hook runs correctly; `index.json` **not** created |
| 3 | Subsequent calls always rebuild in-memory | Correct scoring still occurs |

**Pass criteria:** No `index.json` written; hook still functions.

---

## AC-9 — Session + Cooldown Dedupe Ledger

> **AC:** Session ledger dedupes by slug:queryHash; cross-session cooldown ledger at cooldown.json blocks re-inject for cooldownHours unless page mtime newer than lastPageMtimeMs.

### Test 9.1 — Same (slug, queryHash) second call in same session is deduped

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` with `file_path: "scripts/auth/service.ts"` → Page A injected | `injected.json` contains `auth-service:<hash>` entry |
| 2 | Repeat exact same event in same session | Debug log: `decision: 'all-deduped'`; `{}` returned |

**Pass criteria:** Second identical call returns `{}`.

---

### Test 9.2 — Same slug, different queryHash re-injects within session

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: `Edit` `scripts/auth/service.ts` with `new_string: "getUserById"` → Page A injected | |
| 2 | Claude: `Edit` `scripts/auth/service.ts` with `new_string: "createSession"` (different terms → different hash) | Different `queryHash`; Page A injected again |

**Pass criteria:** Second call with different `new_string` injects (different hash, same slug).

---

### Test 9.3 — Cross-session cooldown blocks re-injection (all providers)

**Setup:** Set `settings.wiki.cooldownHours: 1`.

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: inject Page A (Session 1) | `cooldown.json` written with `lastInjectedAt: now` |
| 2 | Clear `injected.json` to simulate new session | New session ID |
| 3 | Claude: same trigger (Session 2, within cooldown window) | `isOnCooldown` → true; `decision: 'all-deduped'`; `{}` returned |
| 4 | Gemini: same trigger (Session 2) | Same — cooldown blocks regardless of provider |
| 5 | Codex: same trigger (Session 2) | Same |

**Pass criteria:** All three providers blocked by cooldown on second session.

---

### Test 9.4 — Page mtime advancing bypasses cooldown

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Inject Page A (Session 1); cooldown written | |
| 2 | `touch .agent-kit/wiki/entities/auth-service.md` to advance mtime | `currentMtimeMs > lastPageMtimeMs` in cooldown entry |
| 3 | New session: same trigger | `isOnCooldown` → false (mtime bypass); Page A re-injected |

**Pass criteria:** Page A re-injected after mtime advance despite active cooldown.

---

### Test 9.5 — Cooldown entries pruned after 7× window

**Setup:** Manually write a `cooldown.json` with an entry `lastInjectedAt` > `cooldownHours × 7` hours ago.

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Trigger any hook call | `readCooldown` prunes the stale entry on read |
| 2 | Verify pruned entry not present in new `cooldown.json` | Stale slug removed |

**Pass criteria:** Stale entries pruned; no unbounded growth.

---

## AC-10 — Debug Log Enrichment

> **AC:** Debug log records score breakdown per hit, gate-rejection reason, and top-3 candidates.

### Test 10.1 — Injection event logs breakdown + top3

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: trigger injection with `debug: true` | Debug log entry with `decision: 'injected'` contains `breakdown` (all 9 fields populated), `top3` (up to 3 slugs with scores + breakdowns), `injectedSlugs` array |
| 2 | Verify `top3[0].breakdown.strongSignal === true` | All top-3 candidates have their breakdown populated |

**Pass criteria:** All three enrichment fields present and non-empty.

---

### Test 10.2 — Gate rejection events log reason

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | `gate-rejected`: Bash `git status` | Debug log: `{ decision: 'gate-rejected', reason: 'bash-denylist:...' }` |
| 2 | `strong-signal-gate`: body-only query | Debug log: `{ decision: 'strong-signal-gate', reason: non-empty string }` |
| 3 | `threshold`: score below `injectMinScore` | Debug log: `{ decision: 'threshold', score, threshold }` |
| 4 | `margin`: ratio violated | Debug log: `{ decision: 'margin' }` |
| 5 | `all-deduped`: cooldown active | Debug log: `{ decision: 'all-deduped' }` |

**Pass criteria:** Every rejection path produces a specific, non-empty `reason` field in the debug log entry.

---

### Test 10.3 — top3 populated even on rejection (threshold path)

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Claude: query that produces scores but all below `injectMinScore` | Debug log `top3` still lists up to 3 candidate slugs with scores |

**Pass criteria:** `top3` is informational even when nothing is injected.

---

## AC-11 — Settings: 8 New Optional Fields with Defaults

> **AC:** settings.wiki accepts 8 new optional fields with defaults; existing two fields unchanged.

### Test 11.1 — Default values applied when settings.wiki is empty

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Set `settings.wiki: {}` (empty override) | `getWikiConfig` returns all defaults: `injectMarginRatio: 1.5`, `injectMaxResults: 1`, `minQueryTokens: 2`, `cooldownHours: 24`, `cacheEnabled: true`, `triggerAllowlist: ["Edit","MultiEdit","Write","NotebookEdit","Read"]`, `bashAllowlist.mode: 'denylist'`, `stopwords: [...]` |

**Pass criteria:** All 8 new fields have documented defaults; no field is `undefined`.

---

### Test 11.2 — User overrides merge field-by-field

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Set `settings.wiki: { cooldownHours: 48, debug: true }` | `cooldownHours === 48`; `debug === true`; all other fields retain defaults (not reset) |
| 2 | Verify `injectMarginRatio` is still `1.5` | Partial override does not clear unspecified fields |

**Pass criteria:** Only specified fields are overridden; others are defaulted.

---

### Test 11.3 — injectMaxResults clamped at both ends

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | `settings.wiki.injectMaxResults: 0` | Clamped to `1` |
| 2 | `settings.wiki.injectMaxResults: 10` | Clamped to `2` |
| 3 | `settings.wiki.injectMaxResults: 2` | Unchanged: `2` |

**Pass criteria:** Values outside `[1, 2]` are clamped silently.

---

### Test 11.4 — Existing fields (injectMinScore, debug) unchanged

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | Set `settings.wiki.injectMinScore: 8.0` | Custom threshold applied; pages scoring < 8.0 rejected |
| 2 | Set `settings.wiki.debug: false` | No debug log written |

**Pass criteria:** Legacy fields continue working after the 8 new fields were added.

---

## Cross-Provider Matrix Summary

| Test | Claude | Gemini | Codex/GPT |
|---|---|---|---|
| 1.1 File-write always allowed | ✓ | ✓ | ✓ (apply_patch) |
| 1.2 Non-code Read denied | ✓ | ✓ | ✓ |
| 1.4 Bash denylist | ✓ | ✓ (run_terminal_cmd) | ✓ (shell) |
| 3.1 Path anchor strong signal | ✓ | ✓ | ✓ |
| 5.1 Body-only rejected | ✓ | ✓ | ✓ |
| 7.2 injectMaxResults=2 | ✓ | ✓ | ✓ |
| 9.3 Cross-session cooldown | ✓ | ✓ | ✓ |

---

## Bench Verification (AC-Bench)

> **Target:** `p95_cold ≤ 50 ms`, `p95_warm ≤ 10 ms` over 100-page synthetic corpus, 100 iterations.

### Test B.1 — Run bench script

**Steps:**

| # | Action | Expected |
|---|---|---|
| 1 | `npm run bench:wiki-inject` | Output reports cold, warm, and dedupe p95 values |
| 2 | Verify `p95_cold ≤ 50 ms` | Cold-build pass (100-page corpus fully parsed) |
| 3 | Verify `p95_warm ≤ 10 ms` | Warm-cache pass (index.json reused, no re-parse) |
| 4 | Script exits `0` if both thresholds met; non-zero if either violated | CI-safe signal |

**Pass criteria:** Script exits 0; both latency targets met.

---

## AC Coverage Index

| AC | Covered By Tests |
|---|---|
| AC-1 | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6 |
| AC-2 | 2.1, 2.2, 2.3, 2.4 |
| AC-3 | 3.1, 3.2, 3.3 |
| AC-4 | 4.1, 4.2 |
| AC-5 | 5.1, 5.2 |
| AC-6 | 6.1, 6.2, 6.3 |
| AC-7 | 7.1, 7.2, 7.3, 7.4 |
| AC-8 | 8.1, 8.2, 8.3, 8.4, 8.5 |
| AC-9 | 9.1, 9.2, 9.3, 9.4, 9.5 |
| AC-10 | 10.1, 10.2, 10.3 |
| AC-11 | 11.1, 11.2, 11.3, 11.4 |
| Bench | B.1 |
| SEAM(6↔7) | 7.3 |
