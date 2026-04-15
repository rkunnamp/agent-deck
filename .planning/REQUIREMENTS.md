# Requirements: Agent Deck v1.6.0 — Watcher Framework (Waves A + B)

**Defined:** 2026-04-10 (Wave A); 2026-04-16 (Wave B completion)
**Core Value:** Reliable session management for AI coding agents: users can create, monitor, and control many concurrent agent sessions from anywhere without losing work or context.
**Milestone target:** v1.6.0
**Starting point:** v1.5.4 (local hotfix series, unpushed)
**Source specs:**
- Wave A: `docs/superpowers/specs/2026-04-10-watcher-framework-design.md`
- Wave B: `docs/WATCHER-COMPLETION-SPEC.md`
**Research:** Wave A research absent from `.planning/research/`; Wave B is brownfield completion (no new research needed)

## v1.6.0 Wave B Completion Requirements

Wave B closes out v1.6.0 by adding the verification ledger, the health-alerts bridge, the conductor-style folder hierarchy, the skill-and-docs sync, the integration harness, and the CLAUDE.md test-coverage mandate. Each maps to exactly one Wave B phase (19–23).

### Verification Docs

- [ ] **REQ-WF-1**: Phase 14 verification doc at `.planning/phases/14-simple-adapters-webhook-ntfy-github/14-VERIFICATION.md` covers WebhookAdapter Setup/Listen/Teardown/HealthCheck, NtfyAdapter backoff reconnect (2s/2x/30s), GitHubAdapter HMAC-SHA256 constant-time verification, integration test wiring 3 adapters through engine + dedup + routing, and 62 watcher tests passing with `-race`. Every claim cites `path:line`.
- [ ] **REQ-WF-2**: Phase 15 backfill: `.planning/phases/15-slack-adapter-and-import/{15-01-PLAN.md, 15-01-SUMMARY.md, 15-VERIFICATION.md}` reconstructed from `slack.go` + `watcher_cmd.go` + test evidence. Verification covers Slack adapter interface implementation, event normalization, `slack:{CHANNEL_ID}` channel routing, and `watcher import` atomic merge with `Lstat` symlink rejection.

### Health Alerts Bridge

- [ ] **REQ-WF-3**: `internal/watcher/health_bridge.go` subscribes to engine health signal and fans alerts to the conductor notification bridge (Telegram/Slack/Discord). Triggers: `silence_detected`, `error_threshold_exceeded`, `adapter_teardown_unexpected`. Debounce: ≤1 alert per (watcher × trigger) per 15 min. Opt-in via `[watcher.alerts]` config (`enabled` bool + `channels` list). Six unit tests in `internal/watcher/health_bridge_test.go` (silence, error-threshold, debounce, disabled, downstream-failure-resilience, teardown-cancels-pending) plus one integration test wiring a mock adapter with forced silence.

### Folder Hierarchy

- [ ] **REQ-WF-6**: Reorganize watcher state to mirror conductor pattern. New layout: `~/.agent-deck/watcher/{CLAUDE.md, POLICY.md, LEARNINGS.md, clients.json, <name>/{meta.json, state.json, task-log.md, LEARNINGS.md}}`. New files: `internal/watcher/layout.go` (LayoutDir, WatcherDir, MigrateLegacyWatchersDir), `internal/watcher/state.go` (WatcherState struct, LoadState, SaveState), `internal/watcher/event_log.go` (AppendEventLog). Atomic `os.Rename` migration of legacy `~/.agent-deck/watchers/` → `watcher/` with one-cycle compatibility symlink. `agent-deck watcher list --json` exposes new per-watcher state fields (`last_event_ts`, `error_count`, `health_status`). Six unit tests in `layout_test.go` plus one integration test asserting three events produce three `task-log.md` lines and three `state.json` updates.

### Skills + Docs Sync

- [ ] **REQ-WF-7**: Update every user-facing surface to the new singular `~/.agent-deck/watcher/` path. Surfaces: `cmd/agent-deck/assets/skills/watcher-creator/SKILL.md` (≥6 known references at lines 38, 44, 168, 169, 215, 231, 258), `cmd/agent-deck/assets/skills/watcher-creator/README.md`, `skills/agent-deck/SKILL.md`, top-level `README.md`, `CHANGELOG.md` v1.6.0 entry, `docs/superpowers/specs/2026-04-10-watcher-framework-design.md` postscript "v1.6.0 layout addendum". New test `TestSkillDriftCheck_WatcherCreator` in `cmd/agent-deck/watcher_cmd_test.go` reads embedded SKILL.md and asserts no `watchers/` matches. CLAUDE.md mandate (REQ-WF-4) extended with "any PR touching layout.go or path resolution MUST also update SKILL.md and README in the same commit."

### Integration Harness + Mandate

- [ ] **REQ-WF-5**: `scripts/verify-watcher-framework.sh` boots a webhook adapter on an ephemeral port, posts a synthetic event, asserts router reaches the right group, prints `[PASS]` per step, exits non-zero on any failure. Runs end-to-end on macOS + Linux in <60s.
- [ ] **REQ-WF-4**: CLAUDE.md (repo root) "Watcher framework: mandatory test coverage" section. Pinned commands: `go test ./internal/watcher/... -race -count=1 -timeout 120s` and `go test ./cmd/agent-deck/... -run "Watcher" -race -count=1` on every PR touching `internal/watcher/**`, `cmd/agent-deck/watcher_cmd*.go`, `internal/ui/watcher_panel.go`, or `internal/statedb/statedb.go` watcher rows. Removing health alerts, disabling dedup, or weakening HMAC verification requires an RFC.

## Wave B Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-WF-1 | Phase 19 | Pending |
| REQ-WF-2 | Phase 19 | Pending |
| REQ-WF-3 | Phase 20 | Pending |
| REQ-WF-6 | Phase 21 | Pending |
| REQ-WF-7 | Phase 22 | Pending |
| REQ-WF-5 | Phase 23 | Pending |
| REQ-WF-4 | Phase 23 | Pending |

**Wave B coverage:** 7 / 7 mapped. 0 unmapped.

---

## v1.6.0 Wave A — Watcher Framework (original requirements, retained for history)

**Defined:** 2026-04-10
**Source spec:** `docs/superpowers/specs/2026-04-10-watcher-framework-design.md`

**Note (2026-04-16):** Wave A code is fully shipped per `docs/WATCHER-COMPLETION-SPEC.md` audit (engine, all adapters including Gmail, CLI, TUI, triage, self-improving routing, watcher-creator skill). The Pending statuses below reflect the verification *ledger* lag — code exists, but per-requirement verification entries were not closed before this completion milestone began. Wave B Phase 19 (REQ-WF-1, REQ-WF-2) writes the verification docs that close phases 14 and 15. Phase 16's CLI/TUI requirements ledger is similarly closed by code-evidence references in those docs.

Requirements for the watcher framework milestone. Each maps to exactly one phase.

### Schema & Config

- [ ] **SCHEMA-01**: Watchers table exists in statedb with full ALTER TABLE migration path (SchemaVersion bumped to 5)
- [ ] **SCHEMA-02**: Watcher events table exists with UNIQUE(watcher_id, dedup_key) constraint and session_id column for thread reply routing
- [ ] **SCHEMA-03**: Existing databases upgrade cleanly (TestMigrate_OldSchema_WatcherTablesUpgrade in same PR)
- [ ] **SCHEMA-04**: Watcher events pruned to 500 rows per watcher on insert with (watcher_id, created_at DESC) index
- [ ] **SCHEMA-05**: WatcherSettings added to UserConfig with defaults applied in LoadConfig()
- [ ] **SCHEMA-06**: WatcherMeta struct persisted as meta.json in ~/.agent-deck/watchers/<name>/

### Engine Core

- [x] **ENGINE-01**: WatcherAdapter interface defined (Setup/Listen/Teardown/HealthCheck) with AdapterConfig
- [x] **ENGINE-02**: Event struct with DedupKey(), JSON serialization, source/sender/subject normalization
- [x] **ENGINE-03**: Router loads clients.json, matches exact email and wildcard *@domain, exact takes priority
- [x] **ENGINE-04**: Engine event loop deduplicates via INSERT OR IGNORE + rows-affected (no check-then-insert TOCTOU)
- [x] **ENGINE-05**: Single-writer goroutine serializes all watcher DB writes (buffered channel pattern)
- [x] **ENGINE-06**: Health tracker with rolling event rate, silence detection (max_silence_minutes), consecutive error counting
- [x] **ENGINE-07**: Engine Stop() cancels all adapter contexts without goroutine leaks (goleak test in same PR)

### Adapters

- [ ] **ADAPT-01**: Webhook adapter receives HTTP POST on configurable port, normalizes to Event, responds 202 immediately
- [ ] **ADAPT-02**: ntfy adapter subscribes to topic via SSE stream (bufio.Scanner), auto-reconnects on disconnect
- [ ] **ADAPT-03**: GitHub adapter verifies X-Hub-Signature-256 HMAC-SHA256, rejects invalid signatures with 401
- [x] **ADAPT-04**: Slack adapter routes via ntfy bridge with thread reply routing (session_id lookup by parent dedup_key)
- [ ] **ADAPT-05**: Gmail adapter handles OAuth2 token refresh via ReuseTokenSource, Pub/Sub watch registration via users.Watch()
- [ ] **ADAPT-06**: Gmail watch_expiry persisted in meta.json, renewal scheduled 1hr before expiry, immediate renewal on startup if within 2hr

### CLI

- [ ] **CLI-01**: `agent-deck watcher create` registers watcher in statedb + creates filesystem directory with meta.json
- [ ] **CLI-02**: `agent-deck watcher start/stop` manages watcher lifecycle (starts adapter goroutine or cancels context)
- [ ] **CLI-03**: `agent-deck watcher list` shows all watchers with name, type, status, event rate, health
- [ ] **CLI-04**: `agent-deck watcher status <name>` shows detailed info including recent events and config
- [ ] **CLI-05**: `agent-deck watcher test <name>` sends synthetic event through full pipeline, reports routing decision
- [ ] **CLI-06**: `agent-deck watcher routes` displays all clients.json routing rules with sender patterns and conductors
- [x] **CLI-07**: `agent-deck watcher import <path>` migrates existing bash issue-watcher to Go watcher (reads channels.json, generates watcher.toml + clients.json entries)

### TUI

- [ ] **TUI-01**: Watcher panel toggled with W key showing name, type, status indicator, event rate per hour
- [ ] **TUI-02**: Selecting a watcher shows recent events (last 10), routing decisions, and quick actions (start/stop/test/edit/logs)
- [ ] **TUI-03**: Health alerts sent via conductor notification bridge (Telegram/Slack/Discord) when watcher enters warning/error state
- [ ] **TUI-04**: W key binding audited against all existing single-key bindings in home.go, no conflicts, help overlay updated

### Intelligence

- [x] **INTEL-01**: Triage session spawned (via agent-deck launch) for unknown senders, classifies with structured output: ROUTE_TO, SUMMARY, CONFIDENCE
- [ ] **INTEL-02**: Confirmed triage decisions auto-added to clients.json via atomic write-temp-rename (self-improving routing)
- [x] **INTEL-03**: Triage rate limited to max 5 sessions per hour to prevent subscription usage spikes
- [ ] **INTEL-04**: Watcher-creator skill in agent-deck pool enables conversational watcher setup (creates watcher.toml + clients.json entries + conductor if needed)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Web Integration

- **WEB-01**: Watcher management panel in web app (start/stop/status/events)
- **WEB-02**: Real-time event stream in web UI via SSE

### Advanced Adapters

- **ADV-01**: Fathom meeting transcript adapter (webhook-based with participant extraction)
- **ADV-02**: Fireflies meeting transcript adapter
- **ADV-03**: IMAP IDLE adapter for non-Gmail providers
- **ADV-04**: Microsoft Graph webhook adapter for Outlook

### Community

- **COMM-01**: Community adapter SDK for third-party adapters
- **COMM-02**: Adapter marketplace or registry

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Always-on LLM router | Config-driven routing handles 95%+ at zero cost; triage fallback for rest |
| IMAP IDLE adapter | Requires persistent TCP connection; Gmail Pub/Sub is recommended for Google |
| Web UI watcher panel | TUI + CLI sufficient for v1.6.0; web integration deferred to v1.7+ |
| Community adapter marketplace | Future possibility after adapter interface stabilizes |
| Windows native support | Tailscale from Mac/iPhone covers remote access; no validated demand |
| Managed Agents / Agent SDK | Require API key billing; incompatible with subscription-based Claude Code |
| Meeting-specific adapters | Generic webhook adapter covers Fathom/Fireflies; specific adapters v1.7+ |
| Storing full payloads in SQLite | Unbounded growth; events store metadata only, raw payloads in filesystem |
| Silence windows config | Field reserved in schema; logic deferred to v1.6.1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 12 | Pending |
| SCHEMA-02 | Phase 12 | Pending |
| SCHEMA-03 | Phase 12 | Pending |
| SCHEMA-04 | Phase 12 | Pending |
| SCHEMA-05 | Phase 12 | Pending |
| SCHEMA-06 | Phase 12 | Pending |
| ENGINE-01 | Phase 13 | Complete |
| ENGINE-02 | Phase 13 | Complete |
| ENGINE-03 | Phase 13 | Complete |
| ENGINE-04 | Phase 13 | Complete |
| ENGINE-05 | Phase 13 | Complete |
| ENGINE-06 | Phase 13 | Complete |
| ENGINE-07 | Phase 13 | Complete |
| ADAPT-01 | Phase 14 | Pending |
| ADAPT-02 | Phase 14 | Pending |
| ADAPT-03 | Phase 14 | Pending |
| ADAPT-04 | Phase 15 | Complete |
| ADAPT-05 | Phase 17 | Pending |
| ADAPT-06 | Phase 17 | Pending |
| CLI-01 | Phase 16 | Pending |
| CLI-02 | Phase 16 | Pending |
| CLI-03 | Phase 16 | Pending |
| CLI-04 | Phase 16 | Pending |
| CLI-05 | Phase 16 | Pending |
| CLI-06 | Phase 16 | Pending |
| CLI-07 | Phase 15 | Complete |
| TUI-01 | Phase 16 | Pending |
| TUI-02 | Phase 16 | Pending |
| TUI-03 | Phase 16 | Pending |
| TUI-04 | Phase 16 | Pending |
| INTEL-01 | Phase 18 | Complete |
| INTEL-02 | Phase 18 | Pending |
| INTEL-03 | Phase 18 | Complete |
| INTEL-04 | Phase 18 | Pending |

**Coverage:**
- Wave A v1.6.0 requirements: 34 total
- Mapped to Wave A phases: 34 (12–18)
- Wave B completion requirements: 7 total (REQ-WF-1..7)
- Mapped to Wave B phases: 7 (19–23)
- **Total v1.6.0 requirements: 41 mapped, 0 unmapped**

---
*Wave A requirements defined: 2026-04-10 from design spec*
*Wave B requirements defined: 2026-04-16 from `docs/WATCHER-COMPLETION-SPEC.md`*
*Last updated: 2026-04-16 after Wave B completion-milestone bootstrap — Wave A code shipped but verification ledger to be closed by Wave B Phase 19*
