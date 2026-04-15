# Requirements: Agent Deck — v1.5.4 Per-group Claude Config

**Defined:** 2026-04-15
**Milestone:** v1.5.4 — Per-group Claude Config
**Branch:** `fix/per-group-claude-config-v154` (forked from `fa9971e`, PR #578 by @alec-pinson)
**Source spec:** `docs/PER-GROUP-CLAUDE-CONFIG-SPEC.md` (commit `4ade7f8`)
**Core Value (milestone-scoped):** A single agent-deck profile can host groups that authenticate against different Claude config dirs — conductor under `~/.claude-work`, personal sessions under `~/.claude` — without fragmenting into more profiles.

---

## v1.5.4 Requirements

Every requirement below is in scope. Mapping: REQ-ID in this file == CFG-NN in PROJECT.md. Priorities match the spec.

### Config schema & lookup

- [ ] **CFG-01** (P0): PR #578 config schema and lookup priority hold. `[groups."<name>".claude] { config_dir, env_file }` parses. `GetClaudeConfigDirForGroup(groupPath)` resolves with priority `env var CLAUDE_CONFIG_DIR > group override > profile override > global [claude].config_dir > ~/.claude`. Empty/missing group name falls through to profile. `config_dir` accepts `~`, absolute paths, and env-var expansion (`$HOME`). Adding/removing a group override at runtime is picked up after `ClearUserConfigCache()`. PR #578's existing unit tests (`TestGetClaudeConfigDirForGroup_GroupWins`, `TestIsClaudeConfigDirExplicitForGroup`) stay GREEN with no assertion changes.

### Custom-command (conductor) session injection

- [ ] **CFG-02** (P0): Custom-command sessions honor per-group `config_dir`. When `Instance.Command` is non-empty (e.g. `~/.agent-deck/conductor/agent-deck/start-conductor.sh`), the tmux spawn environment for that session MUST contain `CLAUDE_CONFIG_DIR=<resolved>` whenever the group or profile sets an override. Closes PR #578's intentional skip in `buildClaudeCommandWithMessage` ("alias handles config dir") for the wrapper-script case where no alias runs. `buildBashExportPrefix` already exports unconditionally — this REQ locks that path under test, or moves the export into the tmux pane env if not. Acceptance: session created via `agent-deck add ./wrapper.sh -t "test-conductor" -g "conductor"` with group override launches with `CLAUDE_CONFIG_DIR=~/.claude-work` visible via `agent-deck session send <id> "echo CLAUDE_CONFIG_DIR=\$CLAUDE_CONFIG_DIR"`. Persists across restart. Conductor restart via `start-conductor.sh` preserves the var — inner `exec claude` uses the overridden dir. Sessions in groups with no override fall through to profile.

### env_file source semantics

- [ ] **CFG-03** (P0): `[groups."<name>".claude] env_file = "/path/to/.envrc"` causes the tmux pane to `source "/path/to/.envrc"` before exec'ing claude or the custom command. Path expansion matches `config_dir` (`~`, env vars). Supports both shell-style `.envrc` and flat `KEY=VALUE` `.env` (bash `source` handles both). Missing file logs a warning and continues — does not block session start. Acceptance: `/tmp/envrc-test` exporting `TEST_ENVFILE_VAR=hello` wired into a group; session launched; `echo $TEST_ENVFILE_VAR` prints `hello`. Non-goal: no direnv layer (hashing, auto-reload).

### Regression tests

- [ ] **CFG-04** (P0): `internal/session/pergroupconfig_test.go` contains six named tests, each independently runnable (`go test -run TestPerGroupConfig_<name> ./internal/session/...`), self-cleaning, no network:
  1. `TestPerGroupConfig_CustomCommandGetsGroupConfigDir` — instance with non-empty `Command`, group `foo` has `config_dir` override; built env/exports include `CLAUDE_CONFIG_DIR=<foo's dir>`.
  2. `TestPerGroupConfig_GroupOverrideBeatsProfile` — both set; group wins.
  3. `TestPerGroupConfig_UnknownGroupFallsThroughToProfile` — instance in non-existent group; falls through to profile override.
  4. `TestPerGroupConfig_EnvFileSourcedInSpawn` — `env_file` set; its exported vars visible in spawn env (via `buildBashExportPrefix` or the prefix pipeline equivalent).
  5. `TestPerGroupConfig_ConductorRestartPreservesConfigDir` — end-to-end: create custom-command session, stop, restart; assert `CLAUDE_CONFIG_DIR` in new spawn matches group's override. Links REQ-2 to v1.5.2's REQ-7 (custom-command resume path).
  6. `TestPerGroupConfig_CacheInvalidation` — add override, resolve; remove override, `ClearUserConfigCache()`, resolve returns new value.
  All six green under `go test ./internal/session/... -run TestPerGroupConfig_ -race -count=1`.

### Visual harness

- [ ] **CFG-05** (P1): `scripts/verify-per-group-claude-config.sh` — human-watchable script that:
  1. Creates two throwaway groups `verify-group-a` and `verify-group-b` with distinct `config_dir` values in a temp config.
  2. Launches one session per group (one normal `claude` session, one custom-command session).
  3. Sends `echo CLAUDE_CONFIG_DIR=$CLAUDE_CONFIG_DIR` to each; captures output.
  4. Prints a pass/fail table. Exit 0 iff both sessions show the expected per-group value.
  5. Cleans up — stops sessions, restores config.

### Documentation & attribution

- [ ] **CFG-06** (P0): Three doc surfaces + attribution:
  - `README.md` — new subsection "Per-group Claude config" under Configuration, including the `[groups."conductor".claude]` example from PR #578.
  - `CLAUDE.md` (repo root) — one-line entry under the session-persistence mandate block: "Per-group config dir applies to custom-command sessions too; `TestPerGroupConfig_*` suite enforces this."
  - `CHANGELOG.md` — `[Unreleased] > Added` bullet: `Per-group Claude config overrides ([groups."<name>".claude]).`
  - At least one commit in this milestone carries: `Base implementation by @alec-pinson in PR #578.`

### Observability

- [ ] **CFG-07** (P2): One log line emitted at session spawn: `claude config resolution: session=<id> group=<g> resolved=<path> source=<env|group|profile|global|default>`. Helps future debugging by surfacing which priority level set the dir for a given session.

---

## Out of Scope (v1.5.4)

Carried verbatim from the spec — documented here to prevent re-adding.

| Item | Reason |
|------|--------|
| Changes to `[profiles.<x>.claude]` profile-level semantics | Profile-level config keeps its current behavior; this milestone only extends to the group level. |
| TUI editor for groups | `config.toml` is hand-edited; editor is out of scope. |
| Per-group `mcp_servers` overrides | `.mcp.json` attach flow already covers this use case. |
| Full direnv `.envrc` (hashing, auto-reload) | Just a `source` line; no direnv layer. |
| Refactors or reverts of PR #578's existing code | Additive only unless a test requires modification. |
| `git push`, `git tag`, `gh release`, `gh pr create`, `gh pr merge` | Locked by milestone hard rules. |
| `rm` | Use `trash`. |
| Claude attribution in own commits | Sign as "Committed by Ashesh Goplani". |
| Touching files outside scope list | Scope: `internal/session/claude.go`, `internal/session/userconfig.go`, `internal/session/instance.go`, `internal/session/env.go`, new `internal/session/pergroupconfig_test.go`, `scripts/verify-per-group-claude-config.sh`, `README.md`, repo-root `CLAUDE.md`, `CHANGELOG.md`, `docs/PER-GROUP-CLAUDE-CONFIG-SPEC.md`. Anything else = escalate. |

---

## Future (not v1.5.4)

- v1.6.0 Watcher Framework — tracked on main, paused on this branch.
- Per-group `mcp_servers` overrides — future milestone (may reuse lookup helpers from CFG-01).
- direnv integration layer — future milestone if demand emerges.

---

## Traceability

Every active REQ maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CFG-01 | Phase 1 | Pending |
| CFG-02 | Phase 1 | Pending |
| CFG-04 (tests 1, 2, 3, 6) | Phase 1 | Pending |
| CFG-03 | Phase 2 | Pending |
| CFG-04 (tests 4, 5) | Phase 2 | Pending |
| CFG-07 | Phase 2 | Pending |
| CFG-05 | Phase 3 | Pending |
| CFG-06 | Phase 3 | Pending |

**Coverage:**
- v1.5.4 requirements: 7 (CFG-01 through CFG-07)
- Mapped to phases: 7
- Unmapped: 0 ✓

---

## Success criteria (milestone-level)

All six below come from the spec's "Success criteria for the milestone" section and gate `/gsd-complete-milestone`:

1. PR #578 unit tests remain GREEN (no assertion changes).
2. `go test ./internal/session/... -run TestPerGroupConfig_ -race -count=1` — all 6 GREEN.
3. `bash scripts/verify-per-group-claude-config.sh` exits 0 on conductor host with a visual pass/fail table.
4. Manual proof on conductor host: add `[groups."conductor".claude] config_dir = "~/.claude-work"` to `~/.agent-deck/config.toml`, restart conductor, `ps -p <pane_pid>` env shows `CLAUDE_CONFIG_DIR=/home/user/.claude-work`, conductor uses the work Claude account.
5. `git log main..HEAD --oneline` ends with README + CHANGELOG + CLAUDE.md commits and at least one commit carrying `@alec-pinson` attribution.
6. No `git push`, `git tag`, `gh release`, `gh pr create`, or `gh pr merge` performed during this milestone.

---

*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 — initial v1.5.4 definition*
