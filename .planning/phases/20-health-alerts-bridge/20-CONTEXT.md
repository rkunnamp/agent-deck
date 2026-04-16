# Phase 20: Health Alerts Bridge - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Source:** Deterministic scaffold from `docs/WATCHER-COMPLETION-SPEC.md` (REQ-WF-3). No /gsd-discuss-phase run — spec is authoritative.

<domain>
## Phase Boundary

Implement `internal/watcher/health_bridge.go` to subscribe to the engine's existing health signal (`Engine.HealthCh() <-chan HealthState`) and fan out alerts to a notification sink that abstracts the conductor Telegram/Slack/Discord bridge. Opt-in via `config.toml` `[watcher.alerts]`. Per-(watcher × trigger) 15-minute debounce. Resilient to downstream failure. Clean teardown.

**In scope:**
- New file: `internal/watcher/health_bridge.go`
- New file: `internal/watcher/health_bridge_test.go` (6 unit tests + 1 integration test, TDD RED → GREEN)
- New `[watcher.alerts]` block on `WatcherSettings` (or a sibling struct) in `internal/session/userconfig.go`
- One CHANGELOG.md line mentioning `watcher.alerts`

**Out of scope (explicit):**
- Real Telegram/Slack/Discord wiring — use a `Notifier` interface; tests use a mock. Real wiring deferred to a later phase (notification bridge is the conductor's responsibility, not the watcher's).
- No changes to `internal/watcher/engine.go` other than optionally exposing a subscription surface that already exists (`HealthCh()`). No new behavior inside `engine.go`.
- No changes to `health.go`. The existing `HealthState` struct is sufficient.
- No TUI changes, no CLI changes, no adapter changes.
- No work on REQ-WF-6 (folder hierarchy), REQ-WF-7 (skills sync), or any other requirement — this phase is REQ-WF-3 only.

</domain>

<decisions>
## Implementation Decisions

### File layout (locked)
- `internal/watcher/health_bridge.go` — `HealthBridge` struct, `Notifier` interface, config, Run/Stop.
- `internal/watcher/health_bridge_test.go` — all tests live here.
- `internal/session/userconfig.go` — add `WatcherAlertsSettings` under `WatcherSettings`.

### Public surface (locked)
- `type Notifier interface { Notify(ctx context.Context, alert Alert) error }` — one method, takes a struct, returns error. Simple enough to mock.
- `type Alert struct { WatcherName, Trigger, Message string; Timestamp time.Time }` — trigger is one of `silence_detected`, `error_threshold_exceeded`, `adapter_teardown_unexpected`.
- `type HealthBridge struct { ... }` with constructor `NewHealthBridge(cfg Config, notifier Notifier, source <-chan HealthState) *HealthBridge`.
- `func (b *HealthBridge) Run(ctx context.Context) error` — blocks until ctx is done or source closes; on exit, cancels any pending debounced alerts.
- Config struct: `type Config struct { Enabled bool; Channels []string; DebounceWindow time.Duration }` — `DebounceWindow` defaults to 15 minutes when zero.

### Trigger mapping (locked)
- `HealthStatusWarning` with message containing `"no events"` → `silence_detected`.
- `HealthStatusWarning` or `HealthStatusError` with message containing `"consecutive errors"` → `error_threshold_exceeded`.
- Teardown path: a separate public method `NotifyTeardown(watcherName string, unexpected bool)` emits `adapter_teardown_unexpected` when `unexpected` is true. Engine can optionally call this on unexpected teardown; tests drive it directly.

### Debounce (locked)
- Key: `watcherName + "|" + trigger`.
- Implementation: `map[string]time.Time` protected by a `sync.Mutex`. On each incoming trigger, check last-sent time; if within debounce window, drop; else record and send. One map per bridge instance.
- On `Run` exit (ctx cancel), clear the map so re-starts begin fresh.

### Disabled mode (locked)
- When `cfg.Enabled == false`, `Run` logs one line (`health_bridge: disabled`), then blocks on `ctx.Done()` (or returns immediately and `Start` is a no-op — implementer picks, but behavior must be: zero `notifier.Notify` calls, one log line).

### Resilience (locked)
- `notifier.Notify` errors are logged but never propagate to `Run`. A panicking notifier is recovered (`defer recover()` inside the per-alert goroutine). The engine's health source is never affected by notifier behavior.

### Config (locked)
- New struct on `WatcherSettings`:
  ```go
  Alerts WatcherAlertsSettings `toml:"alerts"`
  ```
  with:
  ```go
  type WatcherAlertsSettings struct {
      Enabled           bool     `toml:"enabled"`
      Channels          []string `toml:"channels"`
      DebounceMinutes   int      `toml:"debounce_minutes"`
  }
  func (a WatcherAlertsSettings) GetDebounceMinutes() int { /* default 15 */ }
  ```

### Tests (locked — six unit + one integration)
1. `TestHealthBridge_SilenceTriggersOneAlert` — emit one warning with "no events" message; assert exactly one `Notify` with trigger `silence_detected`.
2. `TestHealthBridge_ErrorThresholdTriggersOneAlert` — emit one error-threshold state; assert exactly one `Notify` with trigger `error_threshold_exceeded`.
3. `TestHealthBridge_DebounceWithin15Min` — emit two silence events 5 minutes apart (virtual time or short debounce in test); assert exactly one `Notify`.
4. `TestHealthBridge_DisabledConfigZeroAlerts` — `cfg.Enabled=false`, emit five warnings; assert zero `Notify` calls.
5. `TestHealthBridge_DownstreamFailureNoncrash` — notifier returns error and panics on alternating calls; assert `Run` does not return an error and the engine's source channel is drained normally.
6. `TestHealthBridge_TeardownCancelsPending` — start bridge, queue a debounced event, cancel ctx; assert no goroutine leak (use `goleak`-style check or explicit sync) and no further `Notify` calls after cancel.
7. `TestHealthBridge_Integration_MockAdapterForcedSilence` — spin up `Engine` with a mock adapter that never emits, advance `HealthTracker.SetLastEventTimeForTest` to past the silence threshold, tick the engine's health loop once, assert the bridge (attached via `NewHealthBridge` wired to `engine.HealthCh()`) receives exactly one alert with trigger `silence_detected` within 2 minutes (wall clock, but use a short test deadline — 5 seconds is enough with injected time).

### TDD discipline (locked)
- **Wave 1 (RED)**: Task A writes the 6 unit tests + 1 integration test. Compile must fail (types don't exist yet). Commit: `test(20-01): health_bridge RED`.
- **Wave 2 (GREEN)**: Task B implements `health_bridge.go` + `WatcherAlertsSettings`. All 7 tests green under `go test ./internal/watcher/... -race -count=1`. Commit: `feat(20-01): health_bridge GREEN`.
- **Wave 3 (DOCS)**: Task C appends one line to CHANGELOG.md mentioning `watcher.alerts`; `grep "watcher.alerts" CHANGELOG.md` must return a match. Commit: `docs(20-01): CHANGELOG note for watcher.alerts`.

### Commit hygiene (locked)
- Every commit signed `Committed by Ashesh Goplani`. No Claude attribution.
- No `--no-verify` on source commits. Pre-commit hooks must pass.
- Doc-only commits may use `--no-verify` if a tooling hook blocks pure-markdown work — but not the source commits for this phase.
- No `git push`, no `git tag`, no `gh pr`, no merge.

### Claude's Discretion
- Exact goroutine structure inside `Run` (single-goroutine select vs. fan-out). Either works as long as the debounce map is mutex-protected and ctx cancel is honored.
- Logger choice (use the same logger the rest of `internal/watcher` uses — `log.Printf` or the package's logger).
- Whether to inject a clock (`func() time.Time`) for deterministic debounce tests or use short real durations. Injection preferred.
- Whether to accept a `[]Notifier` (fan-out inside bridge) or a single composite `Notifier`. Single interface is simpler; composition can be done by the caller.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec and requirements
- `docs/WATCHER-COMPLETION-SPEC.md` — REQ-WF-3 section (lines 48–57) defines the exact acceptance criteria. Hard rules at lines 166–173.
- `.planning/REQUIREMENTS.md` — REQ-WF-3 entry (line 23) and Phase 20 mapping (line 44).
- `.planning/ROADMAP.md` — Phase 20 section. Depends on Phase 19.

### Existing code to subscribe to
- `internal/watcher/engine.go:88-89,154,205-206,500-525,562-564` — `healthCh`, `HealthCheckInterval`, health check loop, `HealthCh()` accessor. This is the subscription point.
- `internal/watcher/health.go` — `HealthState`, `HealthStatus` constants, `HealthTracker.Check()` logic. The bridge consumes `HealthState` values; do not modify this file.

### Existing config pattern to extend
- `internal/session/userconfig.go:2150-2184` — `WatcherSettings` struct and defaults pattern. New `WatcherAlertsSettings` follows the same "zero-value-safe + getter-with-default" shape.
- `internal/session/userconfig_test.go:1133-1170` — how WatcherSettings defaults are tested. Mirror this shape for `WatcherAlertsSettings` tests (can live in the same file).

### Project rules
- Repository `CLAUDE.md` (root) — watcher test-coverage mandate (once REQ-WF-4 lands). For now: always run `go test ./internal/watcher/... -race -count=1 -timeout 120s` before committing anything that touches watcher code.
- Spec hard rules (lines 166–173): TDD, commit signatures, no push/tag/PR, no scope creep outside `internal/watcher/health_bridge*.go` + config surface + CHANGELOG.

</canonical_refs>

<specifics>
## Specific Ideas

- Use the existing `mock_adapter_test.go` in `internal/watcher/` as the mock for the integration test — it already models an adapter that can be driven in tests.
- `HealthTracker.SetLastEventTimeForTest` (health.go:192) exists specifically for deterministic silence simulation. Use it in the integration test.
- The engine's `healthCh` buffer is 16 (engine.go:154). The bridge must drain faster than that or buffered messages will be dropped by the engine's non-blocking send (engine.go:520-523). The bridge should do minimal work per message (map lookup + optional goroutine spawn).
- For the downstream-failure-noncrash test: use a notifier that returns `errors.New("boom")` once and panics once. The bridge must survive both. Channel must still drain.

</specifics>

<deferred>
## Deferred Ideas

- Real wiring to the conductor Telegram/Slack/Discord bridge — deferred. A follow-up phase (or manual integration) writes a concrete `Notifier` implementation against the conductor's notification path. This phase ships only the interface + opt-in config + debounce + tests.
- Channel-specific routing based on `cfg.Channels` — this phase reads the list and stores it but does not route per-channel. A real notifier implementation does that.
- REQ-WF-4 (CLAUDE.md mandate), REQ-WF-6 (folder hierarchy), REQ-WF-7 (skills sync), REQ-WF-5 (verification harness) — separate phases.

</deferred>

---

*Phase: 20-health-alerts-bridge*
*Context gathered: 2026-04-16 — deterministic scaffold from spec, no discuss-phase.*
*Parent commit: d6305d8*
