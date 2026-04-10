# Phase 13: Watcher Engine Core - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-10
**Phase:** 13-watcher-engine-core
**Mode:** assumptions
**Areas analyzed:** Package Structure, WatcherAdapter Interface, Event Struct, Router, Event Dedup Engine, Single-Writer Goroutine, Health Tracker, Engine Lifecycle, Testing Strategy

## Assumptions Presented

### Package Structure
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| New `internal/watcher/` package with adapter.go, engine.go, router.go, health.go | Confident | .planning/research/ARCHITECTURE.md lines 17-29; matches codebase convention (internal/costs/, internal/mcppool/, internal/sysinfo/) |

### Single-Writer Goroutine
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Buffered channel capacity 64, single writer drains and calls SaveWatcherEvent() | Confident | internal/session/event_watcher.go line 51 (make(chan StatusEvent, 64)); internal/costs/watcher.go line 58 (make(chan RawCostEvent, 64)) |

### Router clients.json
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Load from ~/.agent-deck/watchers/clients.json at startup, exact > wildcard matching | Likely | docs/superpowers/specs/2026-04-10-watcher-framework-design.md lines 213-225; .planning/research/ARCHITECTURE.md line 252; internal/session/watcher_meta.go WatcherDir() |

### Health Tracker
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Passive struct queried every 30s, tracks event rate + last-event time + error count | Likely | internal/session/userconfig.go lines 2150-2183 (MaxSilenceMinutes=60, HealthCheckIntervalSeconds=30); internal/session/conductor.go HeartbeatInterval pattern |

## Corrections Made

No corrections — all assumptions confirmed (--auto mode).

## Auto-Resolved

- Router clients.json: auto-selected "load once at startup, no hot-reload" (simplest for Phase 13 scope; hot-reload can be added later)
- Health tracker: auto-selected "passive struct, periodic query" (no per-watcher goroutine; sufficient for testing pipeline)

## External Research

- **goleak for Go 1.24.0:** go.uber.org/goleak not in go.mod. Well-known Uber library, compatible with all modern Go versions. Need to add as test-only dependency and filter any modernc.org/sqlite internal goroutines in leak detection.
