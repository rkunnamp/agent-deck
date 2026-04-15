---
phase: 04-conductor-schema-docs-refresh-mandate-clarification
reviewed: 2026-04-15T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - internal/session/conductorconfig_test.go
  - internal/session/userconfig.go
  - internal/session/claude.go
  - internal/session/instance.go
  - internal/session/env.go
  - README.md
  - CLAUDE.md
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-15
**Depth:** standard
**Files Reviewed:** 7
**Status:** clean (2 informational notes, no blockers)

## Summary

Phase 04 introduces the `[conductors.<name>.claude]` TOML block, threads it through `*Instance`-aware resolver helpers, and updates user-facing docs (README/CLAUDE.md) along with the repo's `--no-verify` mandate clarification. The review focused on correctness of the priority chain, backward-compat for pre-existing group-based helpers, edge cases on conductor-name derivation, coexistence of the new TOML env_file branch with the legacy meta.json env mechanism, and doc fact-checking for schema shape and mandate classification.

**Findings at a glance:**
- The priority chain `env > conductor > group > profile > global > default` is implemented consistently across three helpers (`GetClaudeConfigDirForInstance`, `GetClaudeConfigDirSourceForInstance`, `IsClaudeConfigDirExplicitForInstance`) and is faithfully mirrored in docs (`README.md:126-133`).
- All four `*ForGroup -> *ForInstance` callsite swaps in `instance.go` (lines 501, 606, 623, 4172) are consistent. The resume path (line 4172) is covered by the new test 6c.
- Legacy `*ForGroup` helpers in `claude.go` (lines 228-326) are unchanged, preserving backward compat for non-Instance callers such as `GetMCPInfo`, `GetClaudeConfigDir`, and `pergroupconfig_test.go`.
- Empty-conductor-name handling (`Title == "conductor-"`) is correctly guarded in both `conductorNameFromInstance` (`claude.go:337`) and `getConductorEnv` (`env.go:279`).
- The TOML `env_file` conductor branch (returned via `getToolEnvFile` at `env.go:254-258`, consumed in `buildEnvSourceCommand` step 4) cleanly coexists with the meta.json-backed `getConductorEnv` (step 6, highest priority). The explicit comment at `env.go:248-253` documents the layering. Values from both sources are sourced on the same shell chain with meta.json later (winning on env-var conflicts), which matches the documented precedence.
- `[conductors.<name>.claude]` is consistently a **nested** table in both README (line 118) and the test fixture (line 68) — no flat-schema drift.
- CLAUDE.md's `--no-verify` clarification correctly classifies repo-root `CLAUDE.md` and `README.md` as source-modifying (line 76), so the Phase 4 docs commit still triggers hooks — consistent with the stated rule.
- No new diagnostic warnings are introduced. `slicescontains`/`omitempty` patterns in `userconfig.go` are pre-existing.
- All Phase 4 code paths respect the session-persistence mandate: no changes to `launch_in_user_scope`, no removal of persistence tests, no code path that starts a Claude session while ignoring `Instance.ClaudeSessionID` (the resume path at `instance.go:4194` still uses `i.ClaudeSessionID`).

No correctness, security, or mandate-compliance issues were found. The two Info items below are code-quality observations that could be addressed in a later cleanup pass.

## Info

### IN-01: Conductor-name derivation is duplicated between `conductorNameFromInstance` and `getConductorEnv`

**File:** `internal/session/env.go:277-281` (and `internal/session/claude.go:332-341`)
**Issue:** Phase 04 introduces `conductorNameFromInstance` (claude.go) as the documented single source of truth for deriving the conductor name from `Instance.Title`. However, the pre-existing `getConductorEnv` in `env.go:277-281` still inlines the identical derivation:

```go
name := strings.TrimPrefix(i.Title, "conductor-")
if name == "" || name == i.Title {
    return ""
}
```

The two sites are behaviorally identical, so there is no bug. But the docstring on `conductorNameFromInstance` claims it is "single source of truth … mirrors the canonical pattern used in env.go getConductorEnv (line 267)", which is aspirational rather than factual until `getConductorEnv` is refactored to call the helper.

This is pre-existing code (`getConductorEnv` was not touched in Phase 04), and `env.go` is not listed under the session-persistence mandate paths, so this is low-risk.

**Fix:** In a follow-up cleanup, replace the inlined derivation in `getConductorEnv` with a call to `conductorNameFromInstance(i)`:

```go
func (i *Instance) getConductorEnv(ignoreMissing bool) string {
    name := conductorNameFromInstance(i)
    if name == "" {
        return ""
    }
    meta, err := LoadConductorMeta(name)
    // … existing body unchanged
}
```

This eliminates the duplication and makes the "single source of truth" claim enforceable.

### IN-02: Test 6c's resume-path assertion leaves `ClaudeSessionID` unset

**File:** `internal/session/conductorconfig_test.go:206-209`
**Issue:** `TestConductorConfig_PropagatesToConductorGroupSession` sub-assertion 6c calls `inst.buildClaudeResumeCommand()` on an Instance created via `NewInstanceWithGroupAndTool(...)`, which does not set `ClaudeSessionID`. Inside `buildClaudeResumeCommand`, the helper calls `sessionHasConversationData(i.ClaudeSessionID, i.ProjectPath)` with an empty `ClaudeSessionID` and `i.ProjectPath = tmpHome`. The resulting command will contain either `--resume ""` or `--session-id ""` depending on the conversation-data lookup, which is not a realistic production state.

The sub-assertion only checks for the literal substring `CLAUDE_CONFIG_DIR=/tmp/x`, which is emitted before the `--resume` vs `--session-id` branch, so the test passes regardless of the downstream garbage. This is a real observability/protection risk: a future refactor that moves `configDirPrefix` construction AFTER the session-data check would still pass this test even if the prefix were dropped in the no-session-id code path.

This does not affect Phase 04's correctness (the 501/606/623/4172 callsites all emit `configDirPrefix` unconditionally of session data), but the test is weaker than the comment at line 205 ("protects milestone success criterion #8") implies.

**Fix:** Set a realistic `ClaudeSessionID` on the test instance before invoking `buildClaudeResumeCommand`, and assert on the full resume command shape rather than just a substring:

```go
inst.ClaudeSessionID = "00000000-0000-0000-0000-000000000001"
cmdResume := inst.buildClaudeResumeCommand()
if !strings.Contains(cmdResume, "CLAUDE_CONFIG_DIR=/tmp/x") {
    t.Errorf("6c buildClaudeResumeCommand missing CLAUDE_CONFIG_DIR=/tmp/x\ngot: %s", cmdResume)
}
// Also assert the config dir appears BEFORE the claude invocation:
if idx := strings.Index(cmdResume, "CLAUDE_CONFIG_DIR=/tmp/x"); idx < 0 || idx > strings.Index(cmdResume, "--session-id") {
    t.Errorf("6c CLAUDE_CONFIG_DIR must be prefixed before claude invocation\ngot: %s", cmdResume)
}
```

This tightens the test to catch a placement regression and removes the empty-session-id noise from the assertion surface.

---

_Reviewed: 2026-04-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
