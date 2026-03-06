---
phase: 5
slug: status-detection-events
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Go testing + testify v1.11.1 |
| **Config file** | `internal/integration/testmain_test.go` |
| **Quick run command** | `go test -race -v -run "TestDetection\|TestConductor" ./internal/integration/...` |
| **Full suite command** | `go test -race -v ./internal/integration/...` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `go test -race -v -run "TestDetection\|TestConductor" ./internal/integration/... -count=1`
- **After every plan wave:** Run `go test -race -v ./internal/integration/... -count=1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | DETECT-01 | unit | `go test -race -v -run TestDetection_Patterns ./internal/integration/...` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | DETECT-02 | unit | `go test -race -v -run TestDetection_ToolConfig ./internal/integration/...` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | DETECT-03 | integration | `go test -race -v -run TestDetection_StatusCycle ./internal/integration/...` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | COND-01 | integration | `go test -race -v -run TestConductor_Send ./internal/integration/...` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | COND-02 | integration | `go test -race -v -run TestConductor_Event ./internal/integration/...` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `internal/integration/detection_test.go` — stubs for DETECT-01, DETECT-02, DETECT-03
- [ ] `internal/integration/conductor_test.go` — stubs for COND-01, COND-02

*Existing test infrastructure from Phase 4 is sufficient: harness.go, poll.go, fixtures.go, testmain_test.go all exist.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
