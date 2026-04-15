# Agent Deck v1.5.4 Roadmap

**Milestone:** v1.5.4 — Per-group Claude Config
**Starting point:** v1.5.3 (`ee7f29e` on `fix/feedback-closeout`)
**Branch:** `fix/per-group-claude-config-v154` (worktree-isolated, forked from `fa9971e` — PR #578 HEAD by @alec-pinson)
**Created:** 2026-04-15
**Granularity:** Small patch (3 phases)
**Estimated duration:** 60–90 minutes
**Parallelization:** None — phases are sequential along TDD seams and dependency order

---

## Executive Summary

v1.5.4 accepts external PR #578 (`feat/per-group-config` by @alec-pinson) as the base and closes the gaps that block adoption for the user's conductor use case. Core value: one agent-deck profile can host groups that authenticate against different Claude config dirs without splitting into more profiles.

Three release-safety anchors apply:

- **Go 1.24.0 toolchain pinned.** Go 1.25 silently breaks macOS TUI (carried from v1.5.0).
- **No `--no-verify`.** Repo-root `CLAUDE.md` mandate from v1.5.3 (commit `ee7f29e`) forbids bypassing pre-commit hooks.
- **No SQLite schema changes.** This milestone touches `internal/session/*` only — no `statedb` migrations.

TDD is non-negotiable: every test in `pergroupconfig_test.go` must be written and must FAIL before the implementation or verification change that makes it pass.

Attribution: at least one commit must carry `Base implementation by @alec-pinson in PR #578.` in the body. No Claude attribution. Sign as "Committed by Ashesh Goplani".

No `git push`, no tags, no PR create, no merge — this is local-only work for review at milestone end.

---

## Phases

- [ ] **Phase 1: Custom-command injection + core regression tests** (~25–35 min) — Prove that custom-command (conductor) sessions receive per-group `CLAUDE_CONFIG_DIR`. Write four TDD regression tests (CFG-04 tests 1, 2, 3, 6), run them red, fix any injection gap, run green. Close CFG-01 by keeping PR #578's unit tests green. [REQ mapping: CFG-01, CFG-02, CFG-04 (subset)]

- [ ] **Phase 2: env_file source semantics + observability + conductor E2E** (~25–30 min) — Prove `env_file` is `source`d before `claude` exec in the spawn pipeline. Write two TDD regression tests (CFG-04 tests 4, 5). Add the observability log line (CFG-07). All Go tests green under `-race -count=1`. [REQ mapping: CFG-03, CFG-04 (remainder), CFG-07]

- [ ] **Phase 3: Visual harness + documentation + attribution commit** (~15–25 min) — Ship `scripts/verify-per-group-claude-config.sh` (CFG-05), the README / CLAUDE.md / CHANGELOG updates (CFG-06), and an attribution commit referencing @alec-pinson. Run the harness on the conductor host and capture its output. [REQ mapping: CFG-05, CFG-06]

---

## Phase Details

### Phase 1: Custom-command injection + core regression tests

**Goal:** Prove per-group `CLAUDE_CONFIG_DIR` is injected into the tmux spawn env for custom-command (conductor) sessions, and lock that behavior with four regression tests.

**Requirements covered:**
- CFG-01 — PR #578 schema + lookup (verify existing tests stay green; no code changes required here unless Phase 1 uncovers a gap)
- CFG-02 — custom-command sessions receive the override
- CFG-04 (tests 1, 2, 3, 6) — `CustomCommandGetsGroupConfigDir`, `GroupOverrideBeatsProfile`, `UnknownGroupFallsThroughToProfile`, `CacheInvalidation`

**Approach (TDD, in order):**
1. Create `internal/session/pergroupconfig_test.go` with tests 1, 2, 3, 6 — red first (tests compile but fail because either assertions don't hold or helper seams don't exist yet).
2. Run `go test ./internal/session/... -run TestPerGroupConfig_ -race -count=1` — confirm RED.
3. Investigate whether `buildBashExportPrefix` actually exports `CLAUDE_CONFIG_DIR` for custom-command sessions today (spec hints it does, but no test proves it). If the path is live, the tests go green immediately and the phase becomes pure test-authoring. If there's a genuine gap — the prefix isn't applied to custom commands — the minimal fix is to route the export through the tmux pane env injection so it lands before `exec` regardless of `Instance.Command`.
4. Re-run tests — confirm GREEN.
5. Run the full PR #578 test suite (`TestGetClaudeConfigDirForGroup_GroupWins`, `TestIsClaudeConfigDirExplicitForGroup`) — confirm no regressions.

**Scope (files touched):** `internal/session/pergroupconfig_test.go` (new), potentially `internal/session/env.go` and/or `internal/session/instance.go` (minimal injection fix if gap found). No changes to PR #578's existing code unless a test requires it.

**Success criteria:**
1. `internal/session/pergroupconfig_test.go` exists and contains the four named tests listed above.
2. `go test ./internal/session/... -run TestPerGroupConfig_ -race -count=1` — all 4 GREEN.
3. PR #578's existing unit tests (`TestGetClaudeConfigDirForGroup_GroupWins`, `TestIsClaudeConfigDirExplicitForGroup`) remain GREEN.
4. At least one atomic commit per logical change (test addition commit; fix commit if needed); all commits signed "Committed by Ashesh Goplani".
5. `make ci` (or equivalent) passes.

**Dependencies:** None (phase entry point). The branch is already at `fa9971e` which contains PR #578's implementation.

---

### Phase 2: env_file source semantics + observability + conductor E2E

**Goal:** Prove `env_file` is sourced in the tmux spawn pipeline before `claude` exec, add the observability log line, and close the custom-command restart loop with an end-to-end test.

**Requirements covered:**
- CFG-03 — `env_file` sourced before `claude` exec
- CFG-04 (tests 4, 5) — `EnvFileSourcedInSpawn`, `ConductorRestartPreservesConfigDir`
- CFG-07 — observability log line

**Approach (TDD, in order):**
1. Add test 4 (`TestPerGroupConfig_EnvFileSourcedInSpawn`) — write a throwaway `/tmp/envrc-*` file in the test that exports a sentinel var; assert the built spawn prefix contains a `source "<path>"` line or the sentinel var appears in the environment yielded by the prefix pipeline.
2. Add test 5 (`TestPerGroupConfig_ConductorRestartPreservesConfigDir`) — create a custom-command instance with a group override, build the spawn command, stop, rebuild the spawn command (simulated restart), assert the override is present in both.
3. Run tests — confirm RED (expect `env_file` support may already exist in PR #578; if so, test 4 goes green immediately and we proceed to observability).
4. If `env_file` isn't wired through to the prefix: add the source line in `internal/session/env.go` (the spec calls out 4 added lines in that file from PR #578 — extend minimally if needed). Missing file → warning log, not a spawn failure.
5. Add the CFG-07 observability log line in the spawn path: `claude config resolution: session=<id> group=<g> resolved=<path> source=<env|group|profile|global|default>`. Emit at spawn, once per session.
6. Re-run the full `TestPerGroupConfig_*` suite — all 6 GREEN under `go test ./internal/session/... -run TestPerGroupConfig_ -race -count=1`.

**Scope (files touched):** `internal/session/pergroupconfig_test.go` (extend), `internal/session/env.go` (env_file sourcing if needed; observability log). Possibly `internal/session/claude.go` or `internal/session/instance.go` for the log-line placement.

**Success criteria:**
1. All 6 `TestPerGroupConfig_*` tests GREEN under `-race -count=1`.
2. `env_file` with `.envrc` or flat `KEY=VALUE` format has its exports visible in the spawn env. Missing file logs a warning and does not block.
3. Observability log line is emitted on every session spawn with the correct `source=` attribution.
4. Atomic commits per logical change, signed "Committed by Ashesh Goplani".
5. `make ci` passes.

**Dependencies:** Phase 1 complete (shared test file; Phase 2 extends it).

---

### Phase 3: Visual harness + documentation + attribution commit

**Goal:** Ship the human-watchable verification script, update all three doc surfaces (README, CLAUDE.md, CHANGELOG), and record attribution to @alec-pinson in at least one commit.

**Requirements covered:**
- CFG-05 — visual harness `scripts/verify-per-group-claude-config.sh`
- CFG-06 — README subsection, CLAUDE.md one-liner, CHANGELOG bullet, attribution commit

**Approach (ordered):**
1. Write `scripts/verify-per-group-claude-config.sh`. Structure:
   - `set -euo pipefail`; capture original `~/.agent-deck/config.toml` to a temp backup (or use a dedicated test config via `AGENT_DECK_CONFIG` if supported).
   - Create two throwaway groups `verify-group-a` (config_dir `~/.claude`) and `verify-group-b` (config_dir `~/.claude-work`).
   - Launch one session per group — one normal `claude`, one custom-command (e.g. `bash -c 'exec claude'` wrapper).
   - `agent-deck session send <id> "echo CLAUDE_CONFIG_DIR=\$CLAUDE_CONFIG_DIR"`; capture output via `agent-deck session output`.
   - Print a pass/fail table (aligned columns, color for TTY, plain for redirect).
   - Exit 0 iff both sessions show expected values; exit 1 otherwise.
   - `trap` cleanup: stop both sessions, restore config backup. Use `trash` not `rm`.
2. Run the harness once on the conductor host; capture stdout into the phase artifact (not the commit).
3. Update `README.md` — add subsection "Per-group Claude config" under Configuration with the example from PR #578 and a pointer to `scripts/verify-per-group-claude-config.sh`.
4. Update repo-root `CLAUDE.md` — one-line entry under the session-persistence mandate block: "Per-group config dir applies to custom-command sessions too; `TestPerGroupConfig_*` suite enforces this."
5. Update `CHANGELOG.md` — `[Unreleased] > Added` bullet: `Per-group Claude config overrides ([groups."<name>".claude]).`
6. Finalize with an attribution commit — either a dedicated commit or inserted in the body of the CHANGELOG commit — carrying: `Base implementation by @alec-pinson in PR #578.` Sign "Committed by Ashesh Goplani".

**Scope (files touched):** `scripts/verify-per-group-claude-config.sh` (new, `chmod +x`), `README.md`, `CLAUDE.md` (repo root), `CHANGELOG.md`.

**Success criteria:**
1. `bash scripts/verify-per-group-claude-config.sh` exits 0 on conductor host with a visible pass/fail table for both sessions.
2. `README.md` has the new "Per-group Claude config" subsection with the `[groups."conductor".claude]` TOML example.
3. Repo-root `CLAUDE.md` has the one-line `TestPerGroupConfig_*` enforcement entry under the session-persistence mandate block.
4. `CHANGELOG.md` has the `[Unreleased] > Added` bullet for per-group Claude config overrides.
5. `git log main..HEAD --grep "@alec-pinson"` returns at least one commit. Sign "Committed by Ashesh Goplani"; no Claude attribution.
6. No `git push`, `git tag`, `gh release`, `gh pr create`, `gh pr merge` executed during this milestone.

**Dependencies:** Phases 1 and 2 complete (tests and implementation must exist before the harness can prove end-to-end behavior and before CLAUDE.md can claim `TestPerGroupConfig_*` enforcement).

---

## Milestone Verification (runs at `/gsd-complete-milestone`)

Recap of the six success criteria from the spec — the audit step will confirm all six:

1. PR #578 unit tests remain GREEN.
2. `go test ./internal/session/... -run TestPerGroupConfig_ -race -count=1` — all 6 GREEN.
3. `bash scripts/verify-per-group-claude-config.sh` exits 0 on conductor host.
4. Manual conductor proof: `ps -p <pane_pid>` env shows the overridden `CLAUDE_CONFIG_DIR` after restart.
5. Commit log includes README + CHANGELOG + CLAUDE.md commits and at least one `@alec-pinson` attribution commit.
6. No push / tag / PR / merge performed.

---

## Carry-forward notes

- **v1.5.3 mandate (repo-root `CLAUDE.md`):** No `--no-verify`. Every commit goes through pre-commit hooks.
- **Commit signature:** "Committed by Ashesh Goplani". No Claude attribution.
- **Scope discipline:** Any change outside the spec's scope list is escalation-worthy, not drift-worthy.
- **Rebase posture:** `fa9971e` is behind current `main`. Rebase is a merge-time concern — NOT this milestone's scope.

---

*Roadmap created: 2026-04-15*
*Last updated: 2026-04-15 — initial v1.5.4 creation*
