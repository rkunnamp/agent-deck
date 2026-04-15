---
phase: 04-conductor-schema-docs-refresh-mandate-clarification
verified: 2026-04-15T23:45:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Manual conductor-host proof for issue #602 (milestone success criterion #8)"
    expected: "Add `[conductors.gsd-v154.claude] config_dir = \"~/.claude-work\"` to `~/.agent-deck/config.toml` (NO matching `[groups.*]` entry). Restart the `gsd-v154` conductor. Run `agent-deck session send <id> \"echo CLAUDE_CONFIG_DIR=\\$CLAUDE_CONFIG_DIR\"`. Output MUST be `CLAUDE_CONFIG_DIR=/home/<user>/.claude-work` (or equivalent absolute expansion)."
    why_human: "Requires live tmux server + running conductor session on the target host. Automated test 6c (`buildClaudeResumeCommand` sub-assertion) covers the code path, but the end-to-end proof that a real restart of the `gsd-v154` conductor emits the overridden env var cannot be scripted inside Go unit tests."
---

# Phase 4: Conductor schema + docs refresh + mandate clarification — Verification Report

**Phase Goal:** Add a top-level `[conductors.<name>]` config block (with `config_dir` + `env_file`) and a loader seam in `GetClaudeConfigDirForGroup` so conductor-tagged sessions inherit Claude config from the conductor block. Refresh README and the agent-deck skill SKILL.md to document the new schema. Clarify the repo-root `CLAUDE.md` `--no-verify` mandate so metadata-only commits don't pay hook latency for zero verification value.

**Verified:** 2026-04-15T23:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                             | Status     | Evidence                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | `internal/session/conductorconfig_test.go` exists with exactly 8 `TestConductorConfig_*` tests    | VERIFIED   | `grep -c "^func TestConductorConfig_"` returns 8; test names match CFG-11 canonical list                             |
| 2   | All 8 `TestConductorConfig_*` GREEN under `-race -count=1`                                        | VERIFIED   | Ran `go test ./internal/session/... -run TestConductorConfig_ -race -count=1`: 8/8 PASS (~1.05s)                     |
| 3   | All 8 `TestPerGroupConfig_*` still GREEN (Phase 1-2 regression gate)                              | VERIFIED   | Ran `go test ./internal/session/... -run TestPerGroupConfig_ -race -count=1`: PASS (~1.07s)                          |
| 4   | `[conductors.foo.claude] config_dir` resolves for `conductor-foo` Instance                       | VERIFIED   | Test `PrecedenceConductorBeatsGroup` GREEN; loader reads `cfg.Conductors[name].Claude.ConfigDir`                     |
| 5   | Group-only config (no conductor block) still resolves — backward compat with PR #578             | VERIFIED   | Test `FallsThroughToGroupOverride` GREEN; `GetGroupClaudeConfigDir` fallback preserved in loader chain               |
| 6   | `[conductors.foo.claude] env_file` is sourced on normal-claude AND custom-command spawn paths    | VERIFIED   | Test `EnvFileSourced` GREEN; env.go:254-258 `getToolEnvFile` has conductor branch before group branch                |
| 7   | Source label `"conductor"` returned by `GetClaudeConfigDirSourceForInstance`                     | VERIFIED   | Test `SourceLabelIsConductor` GREEN; claude.go emits `return conductorDir, "conductor"`                              |
| 8   | Resume path (`buildClaudeResumeCommand` L4172) consults Instance-aware loader                    | VERIFIED   | Test 6c sub-assertion GREEN; instance.go:4172-4173 uses `GetClaudeConfigDirForInstance(i)` + `IsClaudeConfigDirExplicitForInstance(i)` |
| 9   | README documents nested `[conductors.<name>.claude]` schema with precedence + backward-compat + #602 link | VERIFIED | README.md:114-139 contains `#### Per-conductor Claude config (v1.5.4)`, nested form, 6-step precedence, backward compat note, `issues/602` link |
| 10  | CLAUDE.md establishes `--no-verify` ban + scope clarification                                    | VERIFIED   | CLAUDE.md:57 `No \`--no-verify\`` bullet + L61 `--no-verify scope clarification (v1.5.4+)` sub-section with metadata paths, positive/negative examples |
| 11  | Both SKILL.md surfaces handled (canonical updated; pool absence documented)                      | VERIFIED   | Canonical at `~/.claude/plugins/cache/agent-deck/agent-deck/12c0a65dfb13/skills/agent-deck/SKILL.md` contains `[conductors.<name>.claude]` + `Per-conductor` + `issues/602`; pool absence recorded in SKILL_MD_DIFF.md with canonical skip string |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact                                                 | Expected                                                | Status     | Details                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `internal/session/conductorconfig_test.go`               | 8 TestConductorConfig_* tests, nested TOML fixtures     | VERIFIED   | Exists; 8 test funcs at lines 65/109/128/148/165/185/216/269; all fixtures use `[conductors.<name>.claude]` nested form     |
| `internal/session/userconfig.go`                         | ConductorOverrides + ConductorClaudeSettings + Conductors map + 2 helpers | VERIFIED   | Types at L234/L243; `Conductors map[string]ConductorOverrides` at L78; `GetConductorClaudeConfigDir`, `GetConductorClaudeEnvFile` helpers present |
| `internal/session/claude.go`                             | Instance-aware loader triplet                           | VERIFIED   | `GetClaudeConfigDirForInstance` (L361), `GetClaudeConfigDirSourceForInstance` (L397), `IsClaudeConfigDirExplicitForInstance` (L432), `conductorNameFromInstance` helper |
| `internal/session/instance.go`                           | 4 callsites swapped (L501, L606, L624, L4172)           | VERIFIED   | `IsClaudeConfigDirExplicitForInstance(i)` / `GetClaudeConfigDirForInstance(i)` / `GetClaudeConfigDirSourceForInstance(i)` appear at exactly L501, L502, L606, L607, L624, L4172, L4173. **ZERO `*ForGroup` callsites remain in instance.go** |
| `internal/session/env.go`                                | Conductor env_file branch in `getToolEnvFile`           | VERIFIED   | L254-255: `if name := conductorNameFromInstance(i); name != "" { if conductorEnv := config.GetConductorClaudeEnvFile(name)` |
| `README.md`                                              | `#### Per-conductor Claude config` block               | VERIFIED   | L114-139: nested `[conductors.gsd-v154.claude]` example + 6-step precedence + backward-compat + #602 link                   |
| `CLAUDE.md`                                              | `--no-verify` bullet + scope clarification              | VERIFIED   | L57 bullet + L61 sub-section header + L65 Metadata-only paths + L72 Source-modifying + L78 Negative + L80 Positive          |
| Canonical plugin-cache SKILL.md                          | Conductor-block paragraph                               | VERIFIED   | `~/.claude/plugins/cache/agent-deck/agent-deck/12c0a65dfb13/skills/agent-deck/SKILL.md:284-296` has `### Per-conductor Claude config (v1.5.4+)` |
| Pool SKILL.md (`~/.agent-deck/skills/pool/agent-deck/SKILL.md`) | Conductor-block paragraph (if present)                  | VERIFIED (absent) | Confirmed absent via `ls`; SKILL_MD_DIFF.md records canonical skip string. Per CFG-09 "pool path if present" language — absence is not a gap |
| `.planning/phases/04-.../SKILL_MD_DIFF.md`               | Repo-visible audit artifact                             | VERIFIED   | 80 lines; BOTH `Canonical plugin-cache SKILL.md` + `Pool SKILL.md` sections populated (diff + canonical skip string)        |

### Key Link Verification

| From                                                | To                                               | Via                                                                    | Status | Details                                                                                   |
| --------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `claude.go GetClaudeConfigDirForInstance`           | `userconfig.go GetConductorClaudeConfigDir`      | `UserConfig.Conductors[name]` lookup                                   | WIRED  | `conductorNameFromInstance` derives name; helper returns `ExpandPath(...ConfigDir)`       |
| `instance.go` L501/L606/L4172                       | `GetClaudeConfigDirForInstance`                  | Instance-aware loader call on spawn + resume                           | WIRED  | Three callsites pass `i`; L624 passes `i` to `GetClaudeConfigDirSourceForInstance`        |
| `env.go buildEnvSourceCommand` → `getToolEnvFile`   | `UserConfig.GetConductorClaudeEnvFile`           | Conductor branch consulted for `case "claude":` when Title matches     | WIRED  | L254-258; comments document layering with meta.json-backed `getConductorEnv` (step 6)     |
| README "Per-conductor Claude config"                | issue #602                                       | Markdown link `https://github.com/asheshgoplani/agent-deck/issues/602` | WIRED  | L139                                                                                      |
| CLAUDE.md `## General rules`                        | metadata-only paths + examples                   | Rule-then-scope layout: L57 bullet + L61 sub-section                   | WIRED  | `awk '/^## General rules/,/^## /' CLAUDE.md` confirms bullet + sub-section co-located     |

### Data-Flow Trace (Level 4)

| Artifact                         | Data Variable                  | Source                                                                | Produces Real Data | Status                                                                                                                 |
| -------------------------------- | ------------------------------ | --------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `GetClaudeConfigDirForInstance`  | `conductorDir` string          | `UserConfig.Conductors[name].Claude.ConfigDir` (TOML-loaded)          | YES                | Tests 2, 3, 6 (all sub-assertions), 7 assert non-empty rendered value. Not hardcoded; flows from live TOML fixtures.  |
| `buildClaudeCommandWithMessage`  | `configDirPrefix`              | `GetClaudeConfigDirForInstance(i)` returning loaded TOML value        | YES                | Test 6a: `CLAUDE_CONFIG_DIR=/tmp/x` substring present in rendered command.                                             |
| `buildBashExportPrefix`          | `prefix` (export CLAUDE_CONFIG_DIR) | Same loader, custom-command path                                      | YES                | Test 6b: `export CLAUDE_CONFIG_DIR=/tmp/x;` substring present.                                                         |
| `buildClaudeResumeCommand`       | `configDirPrefix` (resume)     | Same loader, resume/restart path                                      | YES                | Test 6c: `CLAUDE_CONFIG_DIR=/tmp/x` substring present in rendered resume command.                                      |
| `env.go getToolEnvFile`          | conductor envfile path         | `UserConfig.GetConductorClaudeEnvFile(name)`                          | YES                | Test 7: `source "<tmpfile>"` substring present in rendered command for both spawn paths.                               |

All five data-flow checks show real data flowing from TOML config through the loader to the rendered spawn/resume command strings. No HOLLOW or DISCONNECTED artifacts.

### Behavioral Spot-Checks

| Behavior                                                                          | Command                                                                                                     | Result                                   | Status |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------ |
| CFG-11 suite passes                                                               | `go test ./internal/session/... -run "TestConductorConfig_" -race -count=1`                                | `ok` (1.050s), 8/8 PASS in verbose mode | PASS   |
| Phase 1-2 regression suite passes                                                 | `go test ./internal/session/... -run "TestPerGroupConfig_" -race -count=1`                                 | `ok` (1.074s)                            | PASS   |
| Package builds clean                                                              | `go build ./...`                                                                                            | exit 0, no output                        | PASS   |
| Package vet clean                                                                 | `go vet ./internal/session/...`                                                                             | exit 0, no output                        | PASS   |
| Zero `*ForGroup` callsites remain in instance.go                                  | `grep -n "GetClaudeConfigDirForGroup\|IsClaudeConfigDirExplicitForGroup\|GetClaudeConfigDirSourceForGroup" internal/session/instance.go` | No matches                               | PASS   |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                           | Status    | Evidence                                                                                             |
| ----------- | ----------- | ------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| CFG-08      | 04-01       | `[conductors.<name>]` schema + loader + propagation (closes #602)                     | SATISFIED | Schema types (userconfig.go:234/243); loader triplet (claude.go); 4 callsites swapped; env_file branch |
| CFG-09      | 04-02       | README extension + SKILL.md (canonical + pool if present)                             | SATISFIED | README.md:114-139; canonical SKILL.md:284-296; pool absence documented in SKILL_MD_DIFF.md           |
| CFG-10      | 04-02       | Repo-root CLAUDE.md `--no-verify` mandate scope clarification                         | SATISFIED | CLAUDE.md:57 bullet + L61 sub-section + metadata paths + positive/negative examples                 |
| CFG-11      | 04-01       | `internal/session/conductorconfig_test.go` with 8 regression tests                    | SATISFIED | 8 tests at expected names; 8/8 GREEN; nested TOML fixtures throughout                               |

All four requirement IDs are accounted for. REQUIREMENTS.md Traceability table flipped to Complete for all four. No orphaned requirements.

### Anti-Patterns Found

| File                                       | Line | Pattern                                                                 | Severity | Impact                                                                                                                                |
| ------------------------------------------ | ---- | ----------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `internal/session/env.go`                  | 277-281 | Inline conductor-name TrimPrefix duplicates `conductorNameFromInstance` | Info     | Pre-existing; docstring on helper claims "single source of truth" aspirationally. Tracked in 04-REVIEW.md IN-01 as cleanup item.    |
| `internal/session/conductorconfig_test.go` | 205-209 | Test 6c assertion is substring-only; doesn't set `ClaudeSessionID`       | Info     | Doesn't affect current correctness; a future refactor moving `configDirPrefix` past the session-data check would still pass. 04-REVIEW.md IN-02. |

Both are informational (not blockers) and documented in 04-REVIEW.md. Neither prevents goal achievement.

### Commit Hygiene Audit (User-imposed Phase 4 Gates)

| Gate                                                                                 | Result                                                                                                                                                                   | Status |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| All 8 Phase 4 commits (41c9b8e..bbc8826) authored "Ashesh Goplani <ashesh.goplani96@gmail.com>" | `git log --format="%an <%ae>" 41c9b8e^..HEAD | sort -u` → single line: `Ashesh Goplani <ashesh.goplani96@gmail.com>`                                                      | PASS   |
| All 8 Phase 4 commit bodies carry "Committed by Ashesh Goplani"                      | Trailer count: 8                                                                                                                                                         | PASS   |
| Zero `@alec-pinson` attribution in Phase 4 commits                                   | Occurrence count: 1, but it appears ONLY in `bbc8826` as part of the audit-gate description ("no @alec-pinson"). Not an attribution. No authorship or Co-Authored-By use. | PASS (referential) |
| Zero `Co-Authored-By: Claude` in Phase 4 commits                                     | Count: 0                                                                                                                                                                 | PASS   |
| Zero `Generated with Claude` in Phase 4 commits                                      | Count: 0                                                                                                                                                                 | PASS   |
| No `git push`, `git tag`, `gh release`, `gh pr create/merge` during Phase 4          | No evidence of any such operations; branch `fix/per-group-claude-config-v154` has no new tags or pushed state beyond the original PR                                     | PASS   |
| At least one Phase 4 commit body references issue #602                               | `#602|issues/602` grep count: 10 (across 8 commits)                                                                                                                      | PASS   |

**Phase 4 commit list (8 commits):**

| Hash    | Subject                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------ |
| 41c9b8e | test(04): add conductor config regression tests (RED, CFG-11)                                    |
| f0cf791 | feat(04): add [conductors.<name>.claude] schema (CFG-08 partial)                                 |
| 6fdac26 | feat(04): wire conductor-block loader + four callsites (CFG-08)                                  |
| 917c111 | docs(04-01): complete conductor schema + loader + tests plan                                     |
| c230c77 | docs(04): document [conductors.<name>.claude] schema in README (CFG-09)                         |
| 0ac0efe | docs(04): record SKILL.md external-file updates (CFG-09 audit artifact)                         |
| 95f382d | docs(04): add --no-verify ban + scope clarification to CLAUDE.md (CFG-10)                       |
| bbc8826 | docs(04): close Phase 4 — SUMMARY, STATE, REQUIREMENTS, ROADMAP (metadata-only)                 |

### Human Verification Required

#### 1. Manual conductor-host proof for issue #602 (milestone success criterion #8)

**Test:**
1. On the conductor host, add the following to `~/.agent-deck/config.toml`:
   ```toml
   [conductors.gsd-v154.claude]
   config_dir = "~/.claude-work"
   ```
   Do NOT add a matching `[groups.conductor.claude]` block (the point is to prove the conductor-only block works).
2. Restart the `gsd-v154` conductor session (e.g. via `agent-deck session restart gsd-v154` or by stopping and re-starting the conductor process).
3. Run:
   ```bash
   agent-deck session send <session-id> "echo CLAUDE_CONFIG_DIR=\$CLAUDE_CONFIG_DIR"
   ```
4. Capture the output from the tmux pane via `agent-deck session output <session-id>`.

**Expected:** Output contains `CLAUDE_CONFIG_DIR=/home/<user>/.claude-work` (or the equivalent absolute expansion of `~/.claude-work`).

**Why human:** Automated test 6c (`buildClaudeResumeCommand` sub-assertion) covers the code path inside a Go unit test, but end-to-end proof requires a live tmux server, a running conductor process, and the actual `~/.agent-deck/config.toml` on the target host. This is milestone success criterion #8 — explicitly gated on live conductor-host verification.

### Gaps Summary

Zero gaps. Phase 4 achieves its goal:

- **CFG-08** closed: `[conductors.<name>.claude]` schema + Instance-aware loader + four callsite swaps (including resume path at L4172 which protects milestone success criterion #8).
- **CFG-09** closed: README extended with nested-form schema + precedence chain + #602 link; canonical SKILL.md updated; pool absence documented in the repo-visible `SKILL_MD_DIFF.md` audit artifact.
- **CFG-10** closed: Repo-root CLAUDE.md establishes the `--no-verify` ban (new — did not exist pre-Phase 4) and scopes it with a metadata-paths list + positive/negative examples.
- **CFG-11** closed: 8 `TestConductorConfig_*` regression tests land in a dedicated file, all GREEN; Phase 1-2 `TestPerGroupConfig_*` regression gate preserved at 8/8 GREEN.

All four user-imposed commit hygiene gates pass (Ashesh-only authorship, trailer present on all 8 commits, no Claude attribution, no unauthorized push/tag/PR operations, #602 referenced).

The only outstanding item is the human-on-the-conductor-host manual proof for milestone success criterion #8, which is by design gated outside automated verification.

---

_Verified: 2026-04-15T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
