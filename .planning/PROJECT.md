# Agent Deck

## What This Is

Terminal session manager for AI coding agents. Go + Bubble Tea TUI that manages tmux sessions for Claude Code, Gemini CLI, Codex, OpenCode, and other AI tools. Ships as a single static binary with CLI, TUI, and an embedded web server (Preact SPA + WebSocket terminal bridge) for remote access over localhost, LAN, or Tailscale.

## Core Value

Reliable session management for AI coding agents: users can create, monitor, and control many concurrent agent sessions from anywhere (desktop terminal, mobile browser, web) without losing work or context.

## Current Milestone: v1.6.0 — Watcher Framework Completion

**Starting point:** v1.5.4 (local, unpushed — 2026-04-16). v1.5.0 shipped premium web app polish (Phase 11 release pending). v1.5.1–v1.5.4 are local hotfixes (web-terminal resize, underscore input, Ctrl+C detach regression, scrollback contamination, session-persistence, feedback-closeout, per-group claude config). v1.5.4 introduced a CLAUDE.md mandate at repo root forbidding `--no-verify` on source commits.

**Goal:** Close out the watcher framework. Wave A (phases 12–18) shipped the core engine, adapters, CLI, TUI, triage, self-improving routing, and Gmail watcher across 2026-04-10 → 2026-04-11. **Wave B (this milestone, phases 19–23)** adds the missing verification docs for phases 14+15, implements the health alerts bridge (phase 16 from the design spec), reorganizes on-disk state into the conductor-style folder hierarchy, syncs the watcher-creator skill + repo docs to the new layout, ships an end-to-end integration harness, and locks the framework under a CLAUDE.md test-coverage mandate.

**Source specs:**
- `docs/superpowers/specs/2026-04-10-watcher-framework-design.md` (Wave A, original design)
- `docs/WATCHER-COMPLETION-SPEC.md` (Wave B, this milestone)

**Wave A delivered (phases 12–18, code shipped, ledger to be reconciled):**
- Watcher engine core (adapter/router/health/event+dedup) — Phase 13
- Webhook + ntfy + GitHub adapters — Phase 14 (no verification doc yet)
- Slack adapter + `watcher import` migration — Phase 15 (no verification doc yet)
- CLI (8 subcommands) and TUI watcher panel — Phase 16 (code shipped beyond original plan)
- Gmail adapter with OAuth2 + Pub/Sub watch renewal — Phase 17
- Triage sessions, self-improving routing, watcher-creator skill — Phase 18

**Wave B target (this milestone, phases 19–23):**
- Phase 19 — Verification docs for phases 14+15 (REQ-WF-1, REQ-WF-2)
- Phase 20 — Health alerts bridge over conductor notification channels (REQ-WF-3)
- Phase 21 — Watcher folder hierarchy mirroring conductor pattern, with legacy migration (REQ-WF-6)
- Phase 22 — Skills + docs sync to the new singular `~/.agent-deck/watcher/` layout (REQ-WF-7)
- Phase 23 — Visual verification harness + CLAUDE.md watcher-test mandate (REQ-WF-5, REQ-WF-4)

## Requirements

### Validated

<!-- Shipped and confirmed valuable across v0.x-v1.4.x -->

- ✓ TUI session management (create, start, stop, restart, fork, delete) — v0.x
- ✓ Group hierarchy (path-based, drag-to-reorder) — v0.x
- ✓ MCP attach/detach per session with LOCAL vs GLOBAL scope — v0.x
- ✓ Cost tracking for Claude Code sessions — v0.x
- ✓ Multi-profile support (isolated state.db per profile) — v0.x
- ✓ Conductor workflow (multi-agent orchestration) — v0.x
- ✓ Git worktree integration — v0.x
- ✓ Global search across conversations — v0.x
- ✓ Web app with Preact + HTM + Tailwind + xterm.js — v1.3.x
- ✓ Session CRUD from web — v1.3.x
- ✓ SSE menu snapshots + WebSocket terminal bridge — v1.3.x
- ✓ Responsive layout framework (desktop/tablet/mobile) — v1.3.4
- ✓ Tokyo Night dark/light/auto theme toggle — v1.3.4
- ✓ Playwright E2E suite (25 specs across desktop + mobile) — v1.4.0
- ✓ Tailwind v4 precompile via `go generate` — v1.4.0 Phase 1
- ✓ Critical web bug fixes (CONDUCTOR vanish, JS errors, 0-width names) — v1.4.0 Phase 2
- ✓ UX polish (button overlap, keyboard hints, search placeholder, chart colors) — v1.4.0 Phase 4
- ✓ Cosmetic fixes (focus flicker, full-page screenshots, clean-build suffix) — v1.4.0 Phase 4
- ✓ 6 critical regressions fixed (CSI u, tmux scrollback, mousewheel, heartbeat, PATH, bash -c) — v1.4.1
- ✓ WEB-P0-1: mobile hamburger clickable across all viewports via systematic 7-level z-index scale (Tailwind v4 `--z-index-*` namespace) — v1.5.0 Phase 6
- ✓ WEB-P0-2: profile switcher shipped as Option B read-only label (single-profile `role="status"`, multi-profile `aria-disabled` listbox) — decision gate resolved: `server.go:79` binds `cfg.Profile` once at `NewServer()`, per-request override out of scope — v1.5.0 Phase 6
- ✓ WEB-P0-3: session title truncation eliminated (action toolbar converted from in-flow flex to `absolute right-2 top-1/2` overlay, title width 82px → 184px at 1280x800; row height stable at 44px for PERF-K) — v1.5.0 Phase 6
- ✓ WEB-P0-4 + POL-7: toast stack capped at 3, errors sticky, `ToastHistoryDrawer` persists last 50 to localStorage; prevention layer hides write buttons + `CreateSessionDialog` when `webMutations=false` — v1.5.0 Phase 6
- ✓ Watcher engine core: `WatcherAdapter` interface (Setup/Listen/Teardown/HealthCheck), `Event` with `DedupKey`, single-writer engine goroutine, `INSERT OR IGNORE` dedup, `HealthTracker` with rolling rate + silence detection — v1.6.0 Wave A Phase 13
- ✓ Webhook + ntfy + GitHub adapters: `internal/watcher/{webhook,ntfy,github}.go` with HMAC-SHA256 verification, ntfy backoff (2s/2x/30s), 62 tests pass with `-race` — v1.6.0 Wave A Phase 14 (verification doc owed by Wave B Phase 19)
- ✓ Slack adapter + `watcher import` migration: `internal/watcher/slack.go` 450+ lines, `cmd/agent-deck/watcher_cmd.go` 22KB, atomic merge with `Lstat` symlink rejection, 50+ tests — v1.6.0 Wave A Phase 15 (verification doc owed by Wave B Phase 19)
- ✓ Watcher CLI (8 subcommands) + TUI panel: `cmd/agent-deck/watcher_cmd.go` covering create/start/stop/list/status/test/routes/import + `install-skill`; `internal/ui/watcher_panel.go` with status indicators and quick actions — v1.6.0 Wave A Phase 16 (shipped beyond original plan)
- ✓ Gmail adapter: OAuth2 with `ReuseTokenSource`, Pub/Sub `users.Watch()`, watch_expiry persistence + 1hr-pre-expiry renewal — v1.6.0 Wave A Phase 17
- ✓ Triage sessions + self-improving routing + watcher-creator skill: `internal/watcher/{triage,triage_reaper,triage_prompt,clients_writer}.go`, embedded `watcher-creator` skill, 5/hr rate limit — v1.6.0 Wave A Phase 18

### Active (v1.6.0 Wave B — completion scope)

Detailed requirements in `.planning/REQUIREMENTS.md` § "v1.6.0 Wave B Completion Requirements".

Wave A scope (originally tracked as Active) has shipped as code; verification ledger is closed by Wave B Phase 19. Wave A items are listed under Validated below.

- [ ] **REQ-WF-1**: Phase 14 verification doc — webhook + ntfy + GitHub adapters, observable truths with `path:line` citations
- [ ] **REQ-WF-2**: Phase 15 backfill (PLAN, SUMMARY, VERIFICATION) — Slack adapter + `watcher import`
- [ ] **REQ-WF-3**: Health alerts bridge (`internal/watcher/health_bridge.go`) — silence/error/teardown triggers, 15-min debounce, opt-in via `[watcher.alerts]` config, six unit tests + integration test
- [ ] **REQ-WF-6**: Watcher folder hierarchy mirroring `~/.agent-deck/conductor/` — singular `watcher/` dir with per-instance `meta.json`/`state.json`/`task-log.md`/`LEARNINGS.md`, atomic legacy migration with one-cycle symlink fallback
- [ ] **REQ-WF-7**: Skills + docs sync — embedded `watcher-creator` SKILL.md, repo SKILL.md, README, design-spec addendum, CHANGELOG; new `TestSkillDriftCheck_WatcherCreator` to lock against future drift
- [ ] **REQ-WF-5**: `scripts/verify-watcher-framework.sh` end-to-end harness — boots ephemeral webhook, posts synthetic event, asserts routing, exits non-zero on failure, runs in <60s on macOS/Linux
- [ ] **REQ-WF-4**: CLAUDE.md "Watcher framework: mandatory test coverage" section — pinned commands for `internal/watcher/...` + `cmd/agent-deck/... -run "Watcher"`, RFC requirement for removing health bridge / dedup / HMAC verification

### Out of Scope

- **Managed Agents / Agent SDK** — Both require API key billing, incompatible with subscription-based Claude Code sessions. All intelligence runs via agent-deck session launch.
- **Always-on LLM router** — Config-driven routing handles 95%+ of cases; triage session fallback for unknowns. No persistent LLM process for routing.
- **Web UI for watcher management** — v1.6.0 focuses on TUI + CLI. Web watcher panel deferred to v1.7+.
- **IMAP IDLE adapter** — Requires always-running TCP connection. Gmail Pub/Sub is the recommended path for Google accounts. IMAP deferred.
- **End-user watcher marketplace** — Community adapters are a future possibility but not v1.6.0 scope.
- **Windows native support** — Carried from v1.5.0. Tailscale covers remote access.
- **iOS/Android native apps** — Carried from v1.5.0. PWA via web app remains the mobile path.

## Context

**Brownfield:** Mature codebase at v1.5.0. Architecture is a layered Go monolith: `cmd/agent-deck` → `internal/ui` (Bubble Tea TUI, ~12K lines) + `internal/web` (HTTP/WS/SSE server) + `internal/session` (data model) + `internal/tmux` (tmux abstraction) + `internal/statedb` (SQLite via `modernc.org/sqlite`, no CGO).

**Conductor subsystem (blueprint for watchers):** `internal/session/conductor.go` defines ConductorMeta, `cmd/agent-deck/conductor_cmd.go` handles CLI dispatch (setup/teardown/status/list). Conductors have `~/.agent-deck/conductor/<name>/meta.json`, TUI rendering, and Telegram/Slack/Discord notification bridge. Watchers follow this exact pattern with `~/.agent-deck/watchers/<name>/meta.json`.

**Existing watcher infrastructure (bash, production-validated):** `~/.agent-deck/issue-watcher/` handles GitHub issues and Slack bug reports via Cloudflare Worker → ntfy.sh → bash handler → `agent-deck launch`. Config-driven routing via `channels.json`. Thread-reply routing back to original sessions. v1/v2 payload versioning for ntfy 4KB limit. Per-channel dedup, logging, and user filtering.

**Existing Go watcher patterns:** `internal/session/event_watcher.go` (fsnotify + channel), `internal/ui/storage_watcher.go` (polling + channel), `internal/costs/watcher.go`. All use context cancellation, goroutine lifecycle, and buffered channels.

**Key files to create:**
- New package: `internal/watcher/` (adapter.go, router.go, webhook.go, engine.go, config.go, health.go)
- CLI: `cmd/agent-deck/watcher_cmd.go`
- DB: new tables in `internal/statedb/statedb.go`
- Config: `WatcherSettings` in `internal/session/userconfig.go`
- TUI: watcher panel additions in `internal/ui/home.go`

**Key files to modify:**
- `cmd/agent-deck/main.go` (add `case "watcher"` dispatch)
- `internal/statedb/statedb.go` (add watchers + watcher_events tables)
- `internal/session/userconfig.go` (add WatcherSettings to UserConfig)

**GitHub issues still tracked:** #391 (per-session colors), #434 (Ctrl+Q), #447 (reorg groups) — deferred to v1.7+.

## Constraints

- **Go toolchain**: Pinned to 1.24.0 via `GOTOOLCHAIN=go1.24.0` in `Makefile` and `.goreleaser.yml`. Go 1.25 silently breaks macOS TUI (2026-03-26 incident). Non-negotiable.
- **SQLite schema changes require ALTER TABLE migration**: Every new column in CREATE TABLE MUST also have a corresponding ALTER TABLE in the alterMigrations slice. PR #385 incident: missing migration broke all existing users.
- **Subscription-only intelligence**: No API key billing. All LLM work runs in Claude Code sessions launched via `agent-deck launch` (subscription-based). Watcher layer and router are pure Go (no LLM calls).
- **Batch sizing**: 3-5 PRs per batch with `make ci` + macOS TUI test between each batch. Never merge 15+ PRs at once (the v0.27.0 anti-pattern).
- **Release builds**: Must verify `vcs.modified=false` via `go version -m ./build/agent-deck`. Dirty builds never ship.
- **Visual verification**: Mandatory before every release. `scripts/visual-verify.sh` must pass for all 5 TUI states.
- **Testing philosophy**: Every shipped bug is a missing test. Regression test must be written *before* the fix, and must fail without the fix.
- **Conductor pattern compliance**: Watchers must follow conductor patterns: meta.json filesystem layout, statedb persistence, TUI panel rendering, CLI subcommand dispatch. No divergent infrastructure.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep Preact + HTM + Tailwind + xterm.js stack | v1.4.0 research validated against ttyd, PocketBase, syncthing, code-server | ✓ Locked (carried from v1.4.0) |
| Introduce esbuild JS bundling (PERF-H) | 24 separate ES module fetches on cold load — bundling cuts request count and enables effective caching | — Pending |
| Enable gzip on static files (PERF-A) | Biggest single win — ~518 KB saved on wire per cold load. Simple `gziphandler.GzipHandler` wrap. | — Pending |
| Profile switcher: fix via reload OR remove | Current dropdown lies (clicks do nothing). Runtime profile switch would require re-architecting profile isolation; page reload with `?profile=X` is the pragmatic path. If that's too invasive, remove dropdown and show read-only label. | ✓ Resolved Phase 6 plan 06-01 (Option B — read-only multi-profile listbox, single-profile `role="status"`, always-visible HELP_TEXT). POL-3 (Phase 9 plan 09-02) extended with `_*` filter and `max-h-[300px] overflow-y-auto`. |
| Session title truncation fix via absolute-positioned action buttons | v1.4.0 Phase 3's `min-w-0` propagation did not solve it — 76% still truncated. Root cause is buttons reserving 90px even when hidden. Absolute overlay fixes reservation. | ✓ Resolved Phase 6 plan 06-03 (title span ratio 0.30 → 0.66). |
| Toast auto-dismiss + stack cap | 403 errors when mutations disabled currently spawn infinite undismissable toasts. Auto-dismiss 5s + cap 3 is the pragmatic fix. | ✓ Resolved Phase 6 plan 06-04 (eviction-with-history pattern, visible stack cap 3, error-FIFO, info/success 5s auto-dismiss, errors preserved + ToastHistoryDrawer). POL-7 shipped early with WEB-P0-4. Phase 9 plan 09-03 locked a regression guard. |
| Visual regression in CI with committed baselines | v1.4.0 user testing revealed 4 P0 bugs slipped through manual review. Automated visual diff prevents regression recurrence. | — Pending (Phase 10 TEST-A) |
| Lighthouse CI perf budgets | Premium feel is a binary outcome — either the budgets hold or they don't. CI enforcement prevents slow drift. | — Pending (Phase 10 TEST-B) |
| SessionList virtualization (PERF-K) | 876 DOM nodes before any session is too high. Virtual scrolling via @tanstack/virtual OR hand-rolled is the industry standard answer. | ✓ Resolved Phase 8 plan 08-04 (useVirtualList hook + feature-flagged SessionList integration). |
| esbuild JS bundling (PERF-H) | 24 separate ES module fetches on cold load — bundling cuts request count and enables effective caching. | ✓ Resolved Phase 8 plan 08-05 (esbuild via `go generate` + assets manifest). |
| Light theme WCAG AA audit (POL-6) | Plans 06-03 and 06-04 flagged `text-gray-400` (2.6:1) and translucent backgrounds as "POL-6 territory" — needed a single pass across all surfaces after the final layout landed. | ✓ Resolved Phase 9 plan 09-04 (18 Playwright tests green; 11 axe-core + 7 luminance; `text-gray-400` → `text-gray-600` across 8 components; 17 → 0 violations). |
| Locale-aware currency formatting (POL-5) | `'$' + v.toFixed(2)` ignores user locale; premium apps format per `navigator.language`. | ✓ Resolved Phase 9 plan 09-02 (module-level `Intl.NumberFormat(navigator.language, {style: 'currency', currency: 'USD'})` memoized; both `fmt()` and chart y-axis tick callback delegate to the same instance). |
| Skeleton loader matching final layout (POL-1) | Users see "No sessions" flicker during the cold-load gap before `/api/menu` returns. Linear/Vercel pattern: render a layout-matched skeleton stack. | ✓ Resolved Phase 9 plan 09-01 (new `sessionsLoadedSignal`, tri-state render in SessionList.js, `animate-pulse motion-reduce:animate-none`). |
| auto_advance disabled in GSD config | User explicitly requested each stage in a separate session for context hygiene | ✓ Enforced |
| Pure Go watcher layer (no LLM in routing) | Managed Agents and Agent SDK require API key billing, incompatible with Max subscription. Config-driven routing handles 95%+ of cases at zero cost. | — Pending (v1.6.0) |
| Extend issue-watcher pattern into Go subsystem | Existing bash scripts (handle-issue.sh, handle-slack-channel.sh) prove the architecture works. Go subsystem adds type safety, atomicity, TUI visibility, and health monitoring. | — Pending (v1.6.0) |
| Conductor pattern as blueprint for watchers | Watchers follow conductor's filesystem layout (meta.json), statedb persistence, CLI dispatch, and TUI rendering. 65-70% infrastructure reuse. | — Pending (v1.6.0) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-16 after v1.6.0 Wave B (Watcher Framework Completion) milestone bootstrap. Wave A (phases 12–18) shipped 2026-04-10 → 2026-04-11 with code complete and partial verification ledger. Wave B scope defined from `docs/WATCHER-COMPLETION-SPEC.md`: 7 REQ-WF requirements across 5 new phases (19–23). v1.5.4 CLAUDE.md mandate applies (no `--no-verify` on source commits; metadata commits exempt when hooks no-op).*
