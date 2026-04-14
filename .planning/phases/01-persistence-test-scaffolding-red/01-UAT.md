---
status: complete
phase: 01-persistence-test-scaffolding-red
source: [01-SUMMARY.md, 02-SUMMARY.md, 03-SUMMARY.md]
started: 2026-04-14T11:55:00Z
updated: 2026-04-14T11:55:00Z
verification_mode: automated
---

## Current Test

[testing complete]

## Tests

### 1. Suite compiles and runs
expected: `go test -run TestPersistence_ ./internal/session/... -race -count=1` produces test output (not a build error). All 8 verbatim TestPersistence_* names exist as top-level funcs in internal/session/session_persistence_test.go.
result: pass
evidence: |
  `go vet` exit 0, `go build` exit 0. `grep -c "^func TestPersistence_"` = 8.
  Suite emitted RUN/PASS/FAIL/SKIP lines for all 8 tests in 1.6s.

### 2. TEST-02 TmuxDiesWithoutUserScope (pinning opt-out failure)
expected: PASS green — proves that without user-scope launching, tmux landed in the fake-login transient scope and dies when that scope is removed (the inverse pin documenting why REQ-1 mitigation matters).
result: pass
evidence: |
  --- PASS: TestPersistence_TmuxDiesWithoutUserScope (0.18s)
  Logged: cgroup="0::/user.slice/.../app.slice/fake-login-0fddb37e.scope"
  Note: SUMMARY documented this as SKIP on the executor host (nested-scope concern).
  This run lands in the fake-login scope cleanly — observable truth = PASS.

### 3. TEST-01 TmuxSurvivesLoginSessionRemoval (RED, non-vacuous)
expected: FAIL RED with diagnostic referencing the cgroup default. Message must point at GetLaunchInUserScope() returning false on Linux+systemd and explicitly cite Phase 2 as the fix locus. Not a compile error, not a vacuous skip.
result: pass
evidence: |
  --- FAIL at session_persistence_test.go:347
  "TEST-01 RED: GetLaunchInUserScope() default is false on Linux+systemd;
   simulated teardown would kill production tmux. Phase 2 must flip the default;
   rerun this test after the flip to exercise real cgroup survival."
  Diagnostic non-vacuous (real assertion, real ref to upstream fix).

### 4. TEST-03 LinuxDefaultIsUserScope (RED, non-vacuous)
expected: FAIL RED with diagnostic referencing the cgroup default — same locus as TEST-01, asserts directly on GetLaunchInUserScope() default for Linux+systemd hosts.
result: pass
evidence: |
  --- FAIL at session_persistence_test.go:158
  "TEST-03 RED: GetLaunchInUserScope() returned false on a Linux+systemd host
   with no config; expected true. Phase 2 must flip the default. systemd-run
   present, no config override."

### 5. TEST-04 MacOSDefaultIsDirect (host-conditional skip)
expected: SKIP cleanly on Linux+systemd host (this executor) with diagnostic explaining test only asserts non-systemd behavior. Same test would PASS on macOS / non-systemd hosts.
result: pass
evidence: |
  --- SKIP at session_persistence_test.go:176
  "systemd-run available; TEST-04 only asserts non-systemd behavior — see
   TEST-03 for Linux+systemd default"

### 6. TEST-06 StartAfterSIGKILLResumesConversation (RED, non-vacuous, captured argv)
expected: FAIL RED. Diagnostic must reference resume path — concretely: captured stub-claude argv shows `--session-id <uuid>` instead of the required `--resume <uuid>`. Must cite instance.go:1883 / buildClaudeResumeCommand as Phase 3 fix locus. This is the core REQ-2 proof.
result: pass
evidence: |
  --- FAIL at session_persistence_test.go:868
  "TEST-06 RED: ... captured claude argv must contain '--resume <uuid>'.
   Got argv: [--session-id 9243c585-... --dangerously-skip-permissions].
   This is the 2026-04-14 incident REQ-2 root cause: Start() dispatches through
   buildClaudeCommand (instance.go:1883) instead of buildClaudeResumeCommand."
  Real argv captured via stub claude — not a vacuous failure.

### 7. TEST-07 ClaudeSessionIDSurvivesHookSidecarDeletion (RED, non-vacuous, captured argv)
expected: FAIL RED with same Start()-bypass root cause as TEST-06, independently pinning the docs/session-id-lifecycle.md invariant (instance JSON authoritative, sidecar non-authoritative). Diagnostic must show sidecar was actually written and deleted before the assertion.
result: pass
evidence: |
  --- FAIL at session_persistence_test.go:933
  "TEST-07 RED: after deleting hook sidecar at /tmp/.../.agent-deck/hooks/test-b0aaa147.sid,
   inst.Start() must still spawn 'claude --resume <uuid>' because ClaudeSessionID
   lives in instance storage, not the sidecar. Got argv: [--session-id <uuid> ...].
   Root cause: Start() bypasses buildClaudeResumeCommand — same as TEST-06.
   Phase 3 fix will make both tests GREEN."

### 8. TEST-05 RestartResumesConversation (regression guard, PASSES)
expected: Conductor's brief said "fail RED". SUMMARY's design intent says PASS as regression guard for Restart() at instance.go:3789. Observed truth governs.
result: pass
note: |
  Reality matches SUMMARY (PASSING regression guard), not the conductor's expected
  truth list. The test exercises real Restart() dispatch with stub argv capture and
  confirms `buildClaudeResumeCommand()` is correctly routed today. Any future
  regression that breaks Restart's resume routing will flip this to FAIL RED with
  a "TEST-05 RED:" diagnostic. This is by design per Plan 03 key-decisions and
  is a strictly stronger guard than a RED-only test would be.
evidence: |
  --- PASS: TestPersistence_RestartResumesConversation (0.96s)
expectation_mismatch: |
  Conductor: expected RED. Phase design (per 03-SUMMARY.md): PASS as regression
  guard. SUMMARY's design intent honored; not a defect.

### 9. TEST-08 FreshSessionUsesSessionIDNotResume (regression guard, PASSES)
expected: Conductor's brief said "fail RED". SUMMARY's design intent says PASS as regression guard for the `sessionHasConversationData()==false` branch at instance.go:4150. Observed truth governs.
result: pass
note: |
  Same expectation-mismatch pattern as TEST-05. Pure-Go assertion on
  buildClaudeResumeCommand() with no JSONL transcript. PASSES today; will flip
  to RED if buildClaudeResumeCommand stops emitting --session-id when no
  conversation data exists.
evidence: |
  --- PASS: TestPersistence_FreshSessionUsesSessionIDNotResume (0.02s)
expectation_mismatch: |
  Conductor: expected RED. Phase design (per 03-SUMMARY.md): PASS as regression
  guard. SUMMARY's design intent honored; not a defect.

### 10. Skip guards present for non-systemd / non-tmux hosts
expected: All systemd-dependent tests call `requireSystemdRun(t)` first; all dispatch tests call `requireTmux(t)` first. Tests skip cleanly (not crash) on hosts missing those binaries.
result: pass
evidence: |
  requireSystemdRun: defined at line 89, called by tests at lines 146, 338, 464.
  requireTmux: defined at line 767, called by tests at lines 792, 852, 895.
  Skip semantics documented in test comments at lines 143, 335, 454.

### 11. Suite cleans up tmux servers and systemd scopes
expected: After `go test` exits, no stray tmux sessions matching `agentdeck-(persist|test-persist)*` and no stray transient scopes matching `agentdeck-tmux-persist-test*` or `fake-login-*`. All `kill-server` invocations scoped to `-t <name>` or `-L <socket>` (per CLAUDE.md mandate against bare `tmux kill-server`).
result: pass
evidence: |
  `tmux list-sessions | grep agentdeck-(persist|test-persist)` count = 0
  `systemctl --user list-units --type=scope | grep ...` count = 0
  3 real `kill-server` invocations: line 79 (`-t <name>`), line 295 (`-L <socket>`),
  line 402 (`-L <socket>`). Zero bare `kill-server` calls.

### 12. No production-mandate files modified (CLAUDE.md gate)
expected: `git diff --stat internal/tmux/ internal/session/instance.go internal/session/userconfig.go internal/session/storage.go cmd/` produces no output. Phase 1 is test-scaffolding only; production fixes deferred to Phases 2 and 3.
result: pass
evidence: |
  git diff --stat exit code 0, output empty. Test file
  internal/session/session_persistence_test.go is the only modified path
  (per 03-SUMMARY.md: 0 production files touched).

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]

## Notes

Two conductor-stated expectations did not match phase-design reality:

1. **TEST-05 / TEST-08 expected RED, observed PASS.** SUMMARY (03-SUMMARY.md
   key-decisions and patterns-established) explicitly designs both as PASSING
   regression guards. They will flip to RED with unambiguous diagnostics if
   the production code paths they pin (Restart routing at instance.go:3789;
   sessionHasConversationData false-branch at instance.go:4150) ever break.
   This is strictly stronger than a RED-only test would be. No defect.

2. **TEST-02 expected pass; SUMMARY documented SKIP on this executor; observed
   PASS this run.** TEST-02 is environment-sensitive: depends on tmux not
   already being inside a transient scope. This run landed in the fake-login
   scope as designed and PASSED. Conductor's expectation matched reality.

Phase 1 deliverables verified against ground truth (live `go test` run on
2026-04-14T11:55Z, branch `fix/session-persistence`, HEAD `6718439`):

- 8 verbatim TestPersistence_* names present
- TEST-01, 03, 06, 07 FAIL RED with non-vacuous, fix-pointing diagnostics
- TEST-02 PASS green (this host)
- TEST-04 SKIP host-conditional (Linux+systemd)
- TEST-05, 08 PASS as regression guards (per SUMMARY design)
- Skip guards present for non-systemd / non-tmux hosts
- Cleanup invariants honored, mandate against bare `kill-server` honored
- Zero production-mandate files modified

Phase 2 (cgroup-default fix) and Phase 3 (Start() resume routing fix) are
unblocked. Hand back to conductor for `/gsd:plan-phase 2`.
