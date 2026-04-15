---
status: partial
phase: 04-conductor-schema-docs-refresh-mandate-clarification
source: [04-VERIFICATION.md]
started: 2026-04-15T23:50:00Z
updated: 2026-04-15T23:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Manual conductor-host proof for issue #602 (milestone success criterion #8)
expected: After adding `[conductors.gsd-v154.claude] config_dir = "~/.claude-work"` to `~/.agent-deck/config.toml` (with NO matching `[groups.conductor.claude]` block) and restarting the `gsd-v154` conductor, `agent-deck session send <id> "echo CLAUDE_CONFIG_DIR=\$CLAUDE_CONFIG_DIR"` followed by `agent-deck session output <id>` MUST emit `CLAUDE_CONFIG_DIR=/home/<user>/.claude-work` (or equivalent absolute expansion). Automated test 6c covers the code path but cannot exercise a live tmux + running conductor on the target host.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
