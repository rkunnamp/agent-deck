# Phase 13: Watcher Engine Core - Context

**Gathered:** 2026-04-10 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the watcher engine core: WatcherAdapter interface, Event struct, config-driven router, event dedup engine, single-writer goroutine, and health tracker. Full event-to-routing pipeline tested without real external sources. No actual adapter implementations (those are Phase 14+). No CLI or TUI integration (Phase 16).

</domain>

<decisions>
## Implementation Decisions

### Package Structure
- **D-01:** New `internal/watcher/` package with separate files: `adapter.go` (WatcherAdapter interface + Event struct), `engine.go` (goroutine lifecycle, event loop, dedup), `router.go` (clients.json loading + rule matching), `health.go` (rolling rate + silence detection), `config.go` (watcher.toml loading if needed beyond WatcherMeta).
- **D-02:** Import direction: `internal/watcher/` imports `internal/statedb/` and `internal/session/`. `internal/ui/` and `cmd/agent-deck/` import `internal/watcher/`. No circular dependency risk.

### WatcherAdapter Interface (ENGINE-01)
- **D-03:** WatcherAdapter interface with four methods: `Setup(ctx context.Context, config AdapterConfig) error`, `Listen(ctx context.Context, events chan<- Event) error`, `Teardown() error`, `HealthCheck() error`. AdapterConfig holds adapter-type-specific configuration loaded from watcher.toml.
- **D-04:** Each adapter's `Listen()` runs as a goroutine, receiving a derived context from the engine. Context cancellation is the shutdown mechanism.

### Event Struct (ENGINE-02)
- **D-05:** Event struct with fields: Source (watcher type, e.g. "webhook"), Sender (normalized email or identifier), Subject (short summary), Body (full payload text), Timestamp (time.Time), RawPayload (json.RawMessage for adapter-specific data). `DedupKey() string` method generates a deterministic key for INSERT OR IGNORE dedup.
- **D-06:** JSON serialization via standard `encoding/json` struct tags. No custom marshal/unmarshal needed.

### Router (ENGINE-03)
- **D-07:** Router loads `clients.json` from `~/.agent-deck/watchers/clients.json` (single shared file at watchers root, not per-watcher). Uses `WatcherDir()` from Phase 12 to resolve path.
- **D-08:** Matching priority: exact email match first, then wildcard `*@domain` match. If no match, event is flagged as "unrouted" for triage (Phase 18 scope; Phase 13 just returns nil/empty conductor).
- **D-09:** Router loads clients.json once at engine startup. No hot-reload in Phase 13 scope (acceptable for testing phase; hot-reload can be added in a later phase if needed).

### Event Dedup Engine (ENGINE-04)
- **D-10:** Engine event loop reads from the single-writer channel, calls `StateDB.SaveWatcherEvent()` which uses INSERT OR IGNORE + rows-affected. If rows-affected == 0, the event is a duplicate and is dropped silently. If rows-affected > 0, the event is routed.
- **D-11:** Dedup is database-level via UNIQUE(watcher_id, dedup_key) constraint from Phase 12. No application-level dedup cache needed.

### Single-Writer Goroutine (ENGINE-05)
- **D-12:** Buffered channel with capacity 64, matching the codebase convention from StatusEventWatcher (`make(chan StatusEvent, 64)`) and CostEventWatcher (`make(chan RawCostEvent, 64)`).
- **D-13:** A single writer goroutine drains the channel and calls `SaveWatcherEvent()` for each event. This serializes all SQLite writes, avoiding SQLITE_BUSY contention with the pure-Go modernc.org/sqlite driver.
- **D-14:** The writer goroutine also triggers health tracker updates (event received timestamps, error counts) after each write attempt.

### Health Tracker (ENGINE-06)
- **D-15:** Health tracker is a passive struct (no dedicated goroutine) with per-watcher state: rolling event count (events in the last hour), last event timestamp, consecutive error count, and computed status (healthy/warning/error).
- **D-16:** Engine queries health tracker periodically at the interval from `WatcherSettings.GetHealthCheckIntervalSeconds()` (default 30s). Silence detection fires when `time.Since(lastEvent) > MaxSilenceMinutes`.
- **D-17:** Health state transitions: healthy (events flowing) -> warning (silence threshold crossed OR 3+ consecutive errors) -> error (adapter HealthCheck() fails OR 10+ consecutive errors). Transition events pushed to a `HealthCh()` channel for TUI consumption in Phase 16.

### Engine Lifecycle (ENGINE-07)
- **D-18:** Engine struct holds `context.Context` + `cancel func()`. `Stop()` calls `cancel()`, which propagates to all adapter `Listen()` goroutines via derived contexts. Then waits for all goroutines to exit via `sync.WaitGroup`.
- **D-19:** Goroutine leak test using `go.uber.org/goleak` in `engine_test.go`. Filter modernc.org/sqlite internal goroutines if they exist. goleak is not in go.mod yet; add as test-only dependency.
- **D-20:** Engine exposes `EventCh() <-chan Event` for the TUI channel-listener pattern (Phase 16) and `HealthCh() <-chan HealthState` for health state changes.

### Testing Strategy
- **D-21:** Mock adapter implementing WatcherAdapter that sends synthetic events on Listen(). Used to test the full pipeline without external dependencies.
- **D-22:** TestWatcherEngine_Stop_NoLeaks: start engine with 3 mock adapters, stop, verify no goroutine leaks via goleak.
- **D-23:** TestWatcherEngine_Dedup: send two events with identical DedupKey(), verify only one reaches the router.
- **D-24:** TestRouter_ExactOverWildcard: exact email match takes priority over wildcard *@domain match.
- **D-25:** TestRouter_UnroutedEvent: event from unknown sender returns nil conductor (not routed).
- **D-26:** TestHealthTracker_SilenceDetection: simulate no events for > MaxSilenceMinutes, verify warning state.

### Claude's Discretion
- Internal health tracker data structure (sliding window implementation details)
- clients.json struct field names and JSON parsing approach
- Whether to split config.go from the Phase 12 WatcherMeta or extend it
- Exact DedupKey format (hash of source+sender+subject vs concatenation)
- Test helper mock adapter naming and organization

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12 foundation (already shipped)
- `internal/statedb/statedb.go` -- WatcherRow struct, watchers + watcher_events tables DDL (lines 277-313), SaveWatcher, LoadWatchers, SaveWatcherEvent, pruneWatcherEvents (lines 918-978), SchemaVersion=5
- `internal/session/watcher_meta.go` -- WatcherMeta struct, WatcherDir(), WatcherNameDir(), SaveWatcherMeta, LoadWatcherMeta
- `internal/session/userconfig.go` -- WatcherSettings struct (line 2150), getter methods: GetMaxEventsPerWatcher(500), GetMaxSilenceMinutes(60), GetHealthCheckIntervalSeconds(30)

### Goroutine lifecycle patterns (blueprint)
- `internal/session/event_watcher.go` -- StatusEventWatcher with fsnotify + channel (64-buffer), context cancellation, goroutine lifecycle
- `internal/costs/watcher.go` -- CostEventWatcher with buffered channel (64), event processing loop
- `internal/session/conductor.go` -- ConductorMeta struct, lifecycle pattern, HeartbeatInterval

### Architecture research
- `.planning/research/ARCHITECTURE.md` -- Goroutine lifecycle management (lines 84-124), TUI state change propagation (lines 103-124), process model (lines 126-138), adapter auth (lines 140-152)
- `.planning/research/SUMMARY.md` -- Phase 2 Engine Core section (lines 100-106), pitfalls 2/4/5

### Design spec
- `docs/superpowers/specs/2026-04-10-watcher-framework-design.md` -- clients.json format, event schema, router matching rules, health tracking spec

### Pitfalls research
- `.planning/research/PITFALLS.md` -- Pitfall 2 (goroutine leak), Pitfall 4 (SQLite writer contention), Pitfall 5 (dedup TOCTOU)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StatusEventWatcher` in `event_watcher.go` -- Direct blueprint for Engine goroutine lifecycle (start/stop/channel pattern)
- `CostEventWatcher` in `costs/watcher.go` -- Another channel-based event processing pattern with 64-buffer convention
- `SaveWatcherEvent` in `statedb.go` -- INSERT OR IGNORE dedup already implemented in Phase 12; engine just calls it
- `pruneWatcherEvents` in `statedb.go` -- Automatic pruning after insert, no engine-side pruning needed
- `WatcherDir()` in `watcher_meta.go` -- Path resolver for clients.json location
- `WatcherSettings` getters in `userconfig.go` -- Health check interval and silence threshold already configurable

### Established Patterns
- Buffered channel capacity 64 for async event delivery (StatusEventWatcher, CostEventWatcher)
- Context cancellation for goroutine shutdown (all existing watchers)
- sync.WaitGroup for goroutine completion tracking
- Component loggers via `logging.ForComponent(logging.CompXxx)` -- need to add `CompWatcher`
- Struct with `mu sync.RWMutex` for thread-safe state access (Instance pattern)

### Integration Points
- `internal/statedb/` -- Phase 12 watcher CRUD methods (SaveWatcher, LoadWatchers, SaveWatcherEvent)
- `internal/session/userconfig.go` -- WatcherSettings for health check configuration
- `internal/session/watcher_meta.go` -- WatcherMeta for filesystem metadata
- `internal/logging/` -- New component constant `CompWatcher` for structured logging
- Future: `internal/ui/home.go` will import `internal/watcher/Engine` and wire `EventCh()`/`HealthCh()` channels (Phase 16)
- Future: `cmd/agent-deck/watcher_cmd.go` will import engine for CLI lifecycle (Phase 16)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches following established watcher and conductor patterns. The engine mirrors StorageWatcher/StatusEventWatcher lifecycle exactly per research SUMMARY.md.

</specifics>

<deferred>
## Deferred Ideas

None -- analysis stayed within phase scope.

</deferred>

---

*Phase: 13-watcher-engine-core*
*Context gathered: 2026-04-10*
