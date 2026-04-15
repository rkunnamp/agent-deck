# Agent Deck v1.6.0 Roadmap — Watcher Framework (Waves A + B)

**Milestone:** v1.6.0 — Watcher Framework
**Starting point:** v1.5.4 (local hotfix series, unpushed)
**Wave A initialized:** 2026-04-10
**Wave B initialized:** 2026-04-16
**Source specs:**
- Wave A: `docs/superpowers/specs/2026-04-10-watcher-framework-design.md`
- Wave B: `docs/WATCHER-COMPLETION-SPEC.md`
**Granularity:** Standard
**Parallelization:** Disabled within Wave B (each phase produces a single coherent commit set)

---

## Executive Summary

v1.6.0 adds event-driven automation to agent-deck. **Wave A** (phases 12–18, executed 2026-04-10 → 2026-04-11) shipped the watcher engine, all adapters (webhook, ntfy, GitHub, Slack, Gmail), CLI, TUI, triage sessions, self-improving routing, and the watcher-creator skill. **Wave B** (phases 19–23, this completion milestone) closes the ledger by writing the missing verification docs, implementing the health-alerts bridge, reorganizing on-disk state into the conductor-style folder hierarchy, syncing skills + repo docs to the new layout, shipping an end-to-end integration harness, and locking the framework under a CLAUDE.md test-coverage mandate.

Two release-safety anchors carry forward:
- **Go 1.24.0 toolchain pinned.** Go 1.25 silently breaks macOS TUI.
- **No SQLite schema changes in Wave B.** Wave A added watcher tables (SchemaVersion 5); Wave B touches only filesystem layout and `internal/watcher/health_bridge*.go`.

The v1.5.4 CLAUDE.md mandate at repo root forbids `--no-verify` on source commits (metadata commits exempt when hooks no-op). TDD is non-negotiable for new code in REQ-WF-3 and REQ-WF-6.

---

## Wave A — Phases 12–18 (SHIPPED, ledger closed by Wave B Phase 19)

<details>
<summary>v1.6.0 Wave A — Watcher Framework build (Phases 12–18, code shipped 2026-04-10 → 2026-04-11)</summary>

### Phase 12: Schema & Config

**Status:** Code shipped (SchemaVersion bumped to 5, watcher + watcher_events tables exist with full ALTER TABLE migrations, WatcherSettings on UserConfig, WatcherMeta persisted as `meta.json`).
**Requirements:** SCHEMA-01..06
**Verification:** Ledger lag — closed by Wave B Phase 19 via grep+citation in REQ-WF-1/2 docs.

### Phase 13: Engine Core (VERIFIED)

**Status:** Complete — `13-VERIFICATION.md` exists with 7/7 observable truths.
**Requirements:** ENGINE-01..07

### Phase 14: Simple Adapters (Webhook + ntfy + GitHub)

**Status:** Code shipped (`internal/watcher/{webhook,ntfy,github}.go`, 62 tests pass with `-race`). No verification doc.
**Requirements:** ADAPT-01, ADAPT-02, ADAPT-03
**Verification:** Closed by Wave B Phase 19 (REQ-WF-1).

### Phase 15: Slack Adapter + `watcher import`

**Status:** Code shipped (`internal/watcher/slack.go` 450+ lines, atomic merge in `cmd/agent-deck/watcher_cmd.go` 22KB, 50+ tests). No PLAN/SUMMARY/VERIFICATION docs.
**Requirements:** ADAPT-04, CLI-07
**Verification:** Closed by Wave B Phase 19 (REQ-WF-2).

### Phase 16: Watcher CLI + TUI Integration

**Status:** Code shipped beyond original plan — 8 CLI subcommands + watcher panel in `internal/ui/watcher_panel.go` + health-alert dispatcher hooks. Health alerts bridge itself is the missing piece; tracked as Wave B Phase 20 (REQ-WF-3) rather than Phase 16 backfill.
**Requirements:** CLI-01..06, TUI-01, TUI-02, TUI-04 (CLI/TUI shipped); TUI-03 health alerts deferred to Wave B Phase 20

### Phase 17: Gmail Adapter

**Status:** Code shipped (`internal/watcher/gmail{,_test}.go` ~60KB) with OAuth2 `ReuseTokenSource`, `users.Watch()` registration, and watch_expiry persistence with 1hr-pre-expiry renewal.
**Requirements:** ADAPT-05, ADAPT-06

### Phase 18: Intelligence (Triage + Self-Improving Routing)

**Status:** Code shipped — triage sessions via `agent-deck launch` with structured output, 5/hr rate limit, atomic write-temp-rename for `clients.json` self-update, watcher-creator skill embedded in binary.
**Requirements:** INTEL-01..04 (mostly Complete in REQ ledger; verification audit confirmed shipped)

</details>

---

## Wave B — Phases 19–23 (THIS MILESTONE)

- [ ] **Phase 19: Verification Docs (Phases 14 + 15)** — Backfill verification docs + Phase 15 PLAN/SUMMARY from shipped code (REQ-WF-1, REQ-WF-2)
- [ ] **Phase 20: Health Alerts Bridge** — Subscribe to engine health signal, fan out to Telegram/Slack/Discord via conductor notification bridge with 15-min debounce (REQ-WF-3)
- [ ] **Phase 21: Watcher Folder Hierarchy** — Reorganize `~/.agent-deck/watchers/` → singular `watcher/` with conductor-style per-instance dirs and atomic legacy migration (REQ-WF-6)
- [ ] **Phase 22: Skills + Docs Sync** — Update embedded watcher-creator SKILL.md, repo README, design-spec addendum, CHANGELOG to new layout; add drift-check test (REQ-WF-7)
- [ ] **Phase 23: Integration Harness + CLAUDE.md Mandate** — `scripts/verify-watcher-framework.sh` end-to-end + CLAUDE.md "Watcher framework: mandatory test coverage" section (REQ-WF-5, REQ-WF-4)

---

## Phase Overview

| # | Phase | Requirements | Plans | Status | TDD? | Depends on |
|---|-------|-------------|-------|--------|------|------------|
| 19 | Verification Docs | REQ-WF-1, REQ-WF-2 | 2 | Planned | No (backfill) | — |
| 20 | Health Alerts Bridge | REQ-WF-3 | 1 (RED+GREEN tasks) | Planned | Yes | 19 |
| 21 | Watcher Folder Hierarchy | REQ-WF-6 | 1 (RED+GREEN+migration tasks) | Planned | Yes | 19 |
| 22 | Skills + Docs Sync | REQ-WF-7 | 1 | Planned | Yes (drift-check test) | 21 |
| 23 | Integration Harness + Mandate | REQ-WF-5, REQ-WF-4 | 2 | Planned | Yes (script + integration) | 20, 21, 22 |

**Total Wave B requirements mapped:** 7 / 7 (100%)

---

## Phase Details

### Phase 19: Verification Docs (Phases 14 + 15)

**Goal:** Close the v1.6.0 verification ledger for shipped Wave A adapters by writing observable-truth docs grounded in `path:line` citations against the actual code and test evidence. No code changes.

**Depends on:** Nothing (pure backfill).

**Requirements:** REQ-WF-1 (Phase 14 verification doc), REQ-WF-2 (Phase 15 PLAN + SUMMARY + VERIFICATION).

**Plans:** 2 plans

Plans:
- [ ] 19-01: Phase 14 verification doc (`14-VERIFICATION.md`) — webhook + ntfy + GitHub adapters with file:line citations for HMAC-SHA256 verify, ntfy backoff timings, integration test wiring; rerun `go test ./internal/watcher/... -race -count=1` to confirm 62-test pass claim
- [ ] 19-02: Phase 15 backfill (`15-01-PLAN.md`, `15-01-SUMMARY.md`, `15-VERIFICATION.md`) — Slack adapter interface, `slack:{CHANNEL_ID}` channel routing, `watcher import` atomic merge with `Lstat` symlink rejection, all with citations

**Success Criteria** (what must be TRUE):
1. `.planning/phases/14-simple-adapters-webhook-ntfy-github/14-VERIFICATION.md` exists with at least one observable-truth row per shipped adapter (Webhook, Ntfy, GitHub)
2. Every claim in 14-VERIFICATION.md cites a `path:line` reference that resolves in current code
3. `.planning/phases/15-slack-adapter-and-import/{15-01-PLAN.md, 15-01-SUMMARY.md, 15-VERIFICATION.md}` all exist following GSD templates
4. Rerunning `go test ./internal/watcher/... -race -count=1 -timeout 120s` reproduces the pass claim cited in 14-VERIFICATION.md
5. No speculation: `grep -E "TODO|might|probably|likely" .planning/phases/14-*/14-VERIFICATION.md .planning/phases/15-*/*.md` returns zero matches

---

### Phase 20: Health Alerts Bridge

**Goal:** Implement `internal/watcher/health_bridge.go` to subscribe to the engine's health signal and fan out alerts to the conductor notification bridge (Telegram + Slack + Discord). TDD per the v1.5.4 mandate.

**Depends on:** Phase 19 (verification docs lock the engine surface contract that the bridge subscribes to).

**Requirements:** REQ-WF-3.

**Plans:** 1 plan with explicit RED → GREEN tasks.

Plans:
- [ ] 20-01: Health alerts bridge — Task A (RED) writes six failing unit tests in `internal/watcher/health_bridge_test.go` (silence-triggers-one-alert, error-threshold-triggers-one-alert, debounce-within-15-min, disabled-config-zero-alerts, downstream-failure-noncrash, teardown-cancels-pending) + one integration test wiring a mock adapter with forced silence; Task B (GREEN) implements `health_bridge.go`, wires `[watcher.alerts]` opt-in config, threads health signal from engine, applies 15-min per-(watcher×trigger) debounce; Task C verifies `grep "watcher.alerts" CHANGELOG.md` matches

**Success Criteria** (what must be TRUE):
1. `internal/watcher/health_bridge.go` exists; subscribes to engine health signal (existing `HealthCh()` or newly added)
2. Six unit tests + one integration test all green under `go test ./internal/watcher/... -race -count=1`
3. Disabled config (`[watcher.alerts] enabled = false`) emits zero notifications and logs exactly one startup line
4. Debounce window proven: forcing two silence events within 15 min produces exactly one alert
5. Downstream notification failure does not crash the engine (resilience test green)

---

### Phase 21: Watcher Folder Hierarchy

**Goal:** Reorganize on-disk watcher state to mirror `~/.agent-deck/conductor/`. New singular `~/.agent-deck/watcher/` root with shared `CLAUDE.md`/`POLICY.md`/`LEARNINGS.md`/`clients.json` and per-watcher `meta.json`/`state.json`/`task-log.md`/`LEARNINGS.md`. Atomic legacy migration with one-cycle compatibility symlink. TDD.

**Depends on:** Phase 19 (verification docs lock current code paths that migration code reads from).

**Requirements:** REQ-WF-6.

**Plans:** 1 plan with RED → GREEN → migration tasks.

Plans:
- [ ] 21-01: Watcher folder hierarchy — Task A (RED) writes six failing tests in `internal/watcher/layout_test.go` (fresh-install-creates-layout, legacy-migration-atomic, symlink-resolves, state-roundtrip, event-log-append-atomic, hot-reload-safe) + one integration test (three events → three task-log lines + three state.json updates); Task B (GREEN) creates `internal/watcher/{layout,state,event_log}.go`, updates `engine.go:134` ClientsPath default, updates `cmd/agent-deck/watcher_cmd.go:562,614` `session.WatcherDir()` to singular path, threads `AppendEventLog` + `SaveState` into the engine event-handling loop; Task C scaffolds `assets/watcher-templates/{CLAUDE.md, POLICY.md, LEARNINGS.md}`; Task D verifies `agent-deck watcher list --json` exposes `last_event_ts`/`error_count`/`health_status`

**Success Criteria** (what must be TRUE):
1. Fresh install creates `~/.agent-deck/watcher/{CLAUDE.md, POLICY.md, LEARNINGS.md, clients.json}`
2. Existing user with `~/.agent-deck/watchers/` is migrated atomically on first run; symlink `~/.agent-deck/watchers -> watcher/` exists; one log line records the migration
3. After receiving an event, `<name>/task-log.md` has one new line and `state.json.last_event_ts` is updated
4. Six unit tests + one integration test all green under `go test ./internal/watcher/... -race`
5. `agent-deck watcher list --json` output includes `last_event_ts`, `error_count`, `health_status` per watcher
6. Legacy `~/.agent-deck/issue-watcher/` is **not** auto-migrated (out of scope; logged in migration line)

---

### Phase 22: Skills + Docs Sync

**Goal:** Update every user-facing surface that mentions the old flat `~/.agent-deck/watchers/` path to the new singular `~/.agent-deck/watcher/` hierarchy from Phase 21. Add a build-time drift-check test so embedded skills cannot silently drift again.

**Depends on:** Phase 21 (the new layout must exist before docs reference it).

**Requirements:** REQ-WF-7.

**Plans:** 1 plan.

Plans:
- [ ] 22-01: Skills + docs sync — Update embedded `cmd/agent-deck/assets/skills/watcher-creator/{SKILL.md, README.md}` (≥6 known references at SKILL.md lines 38, 44, 168, 169, 215, 231, 258), repo `skills/agent-deck/SKILL.md`, top-level `README.md`, `CHANGELOG.md` v1.6.0 entry calling out the migration + symlink fallback, `docs/superpowers/specs/2026-04-10-watcher-framework-design.md` postscript "v1.6.0 layout addendum"; add `TestSkillDriftCheck_WatcherCreator` in `cmd/agent-deck/watcher_cmd_test.go` that reads the embedded SKILL.md and asserts no `watchers/` substrings; verify `agent-deck watcher install-skill watcher-creator` writes the updated SKILL.md to `~/.agent-deck/skills/pool/watcher-creator/SKILL.md`

**Success Criteria** (what must be TRUE):
1. `grep -rn "watchers/" cmd/ internal/ skills/ docs/ README.md CHANGELOG.md` returns zero data-dir matches (test fixtures + migration code annotated with `// legacy migration` are exempt)
2. `TestSkillDriftCheck_WatcherCreator` is green and fails loudly if `watchers/` reappears in the embedded SKILL.md
3. Installing the skill produces `~/.agent-deck/skills/pool/watcher-creator/SKILL.md` with singular paths
4. CHANGELOG.md v1.6.0 entry contains an explicit migration callout
5. `docs/superpowers/specs/2026-04-10-watcher-framework-design.md` has a "v1.6.0 layout addendum" postscript section

---

### Phase 23: Integration Harness + CLAUDE.md Mandate

**Goal:** Ship the end-to-end visual verification harness and the CLAUDE.md "Watcher framework: mandatory test coverage" section that locks the framework against future regressions. This is the milestone-closing phase.

**Depends on:** Phases 20, 21, 22 (the harness exercises health bridge + new layout + installed skill; the mandate references all three).

**Requirements:** REQ-WF-5 (harness), REQ-WF-4 (mandate).

**Plans:** 2 plans.

Plans:
- [ ] 23-01: Integration harness — `scripts/verify-watcher-framework.sh` boots a webhook adapter on an ephemeral port, posts a synthetic event, asserts the event reaches the router and lands in the right group, prints `[PASS]` per step, exits non-zero on any failure; runs in <60s on macOS + Linux; one shell-test fixture validates the script's exit codes
- [ ] 23-02: CLAUDE.md watcher mandate — Append "Watcher framework: mandatory test coverage" section to repo-root `CLAUDE.md` with copy-pasteable test commands (`go test ./internal/watcher/... -race -count=1 -timeout 120s` + `go test ./cmd/agent-deck/... -run "Watcher" -race -count=1`), explicit list of paths that trigger the mandate (`internal/watcher/**`, `cmd/agent-deck/watcher_cmd*.go`, `internal/ui/watcher_panel.go`, `internal/statedb/statedb.go` watcher rows), RFC requirement for removing health bridge / disabling dedup / weakening HMAC, and the REQ-WF-7 addendum requiring `SKILL.md` + README updates in any commit touching `internal/watcher/layout.go` or path-resolution code

**Success Criteria** (what must be TRUE):
1. `bash scripts/verify-watcher-framework.sh` exits 0 with all `[PASS]` banners on macOS and Linux
2. Total runtime under 60 seconds
3. Repo `CLAUDE.md` has a "Watcher framework: mandatory test coverage" section with the two pinned test commands
4. The mandate names every required path and references the harness from REQ-WF-5
5. `go test ./internal/watcher/... -race -count=1 -timeout 120s` passes (~70 tests after Wave B additions)
6. `go test ./cmd/agent-deck/... -run "Watcher" -race -count=1` passes
7. Wave B verification docs (Phase 19) still grep-match against current code

---

## Out of Scope (Wave B)

- No refactoring of shipped Wave A watcher code
- No new adapter types (no Discord inbound, no IMAP, no RSS — separate future milestone)
- No changes to triage session behavior
- No changes to `clients.json` schema (path moves; format unchanged)
- No Gmail OAuth scope changes
- No auto-migration of legacy `~/.agent-deck/issue-watcher/` bash directory (separate task)
- No web UI watcher panel (deferred to v1.7+)
- No removal of the `~/.agent-deck/watchers/` compatibility symlink (removed in v1.7.0+ after one user-visible cycle)

## Hard Rules (Wave B)

- No `git push`, `git tag`, `gh pr create`, `gh pr merge` — user owns release actions
- No `rm` (use `trash`)
- TDD per new code in Phases 20 + 21: tests in RED first, then impl to GREEN
- Sign commits "Committed by Ashesh Goplani". No Claude attribution
- Docs phases (19, 22, 23-02) are backfill/sync — TDD optional, but Phase 22 ships a drift-check test as a regression guard
- Repo CLAUDE.md mandate at `/CLAUDE.md` (added in v1.5.4) forbids `--no-verify` on source commits; metadata commits to `.planning/` are exempt when hooks no-op
- No scope creep — if Phase 20 wants to touch code outside `internal/watcher/health_bridge*.go`, stop and escalate
- Conductor owns phase planning — this milestone roadmap stops here; do NOT auto-spawn phase plans

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 19. Verification Docs | 0/2 | Not started | — |
| 20. Health Alerts Bridge | 0/1 | Not started | — |
| 21. Watcher Folder Hierarchy | 0/1 | Not started | — |
| 22. Skills + Docs Sync | 0/1 | Not started | — |
| 23. Integration Harness + Mandate | 0/2 | Not started | — |

**Wave B totals:** 0 / 7 plans complete, 0 / 7 requirements complete.

---

*Wave A roadmap created: 2026-04-10 (since superseded by code-first execution; ledger reconciled by Wave B Phase 19)*
*Wave B roadmap created: 2026-04-16 from `docs/WATCHER-COMPLETION-SPEC.md`*
*Last updated: 2026-04-16 — milestone bootstrap complete, awaiting conductor to spawn `gsd-v160-plan-1` for Phase 19 planning*
