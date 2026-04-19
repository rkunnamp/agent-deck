---
name: agent-deck
description: >
  Launch and manage Claude Code agents via agent-deck. Use when the user asks
  to run Claude on a task in the background, launch a coding agent, review code
  with Claude, orchestrate multiple Claude sessions, check agent status, or read
  agent output. Do NOT use for direct Claude API calls, for Codex's own work, or
  for tasks that don't involve managing external Claude Code sessions.
---

# Agent-Deck: Launch and Manage Claude Code Agents

You can launch Claude Code agents that run in the background via agent-deck.
The user continues interacting with you while Claude works. When Claude finishes,
you are notified automatically.

## Quick Start

Use the launch script to start a Claude agent with background notification:

```bash
~/.agents/skills/agent-deck/scripts/launch-claude.sh "<session-name>" "<repo-path>" "<prompt>"
```

Example:

```bash
~/.agents/skills/agent-deck/scripts/launch-claude.sh "review-auth" "/home/ubuntu/my-project" "Review lib/auth.ex for security vulnerabilities"
```

This does three things in one command:
1. Creates an agent-deck session in the `codex-tasks` group
2. Starts Claude with full-auto permissions and sends the prompt
3. Starts a background watcher that tracks completion state

The launch script also ensures managed Codex `SessionStart`, `Stop`, and
`UserPromptSubmit` hook entries for this skill are present in
`~/.codex/hooks.json` and enables `codex_hooks = true` in `~/.codex/config.toml`.

You get control back immediately. Continue working on other things.

## Recommended Pattern: Codex -> Claude

**This is the recommended way to call Claude from Codex.**

From Codex, launch Claude as a background `agent-deck` session and let the
managed watcher + Codex hook/tmux notification path tell you when Claude is
finished. Do **not** use the Claude-side pattern of running a blocking `--wait`
command in background Bash and reading a harness output file.

Use this pattern for the initial request:

```bash
~/.agents/skills/agent-deck/scripts/launch-claude.sh "review-auth"   "/home/ubuntu/my-project"   "Review lib/auth.ex for security vulnerabilities"
```

Expected behavior:
1. Codex gets control back immediately.
2. Claude works in the background.
3. When Claude finishes, Codex is notified automatically by the managed
   agent-deck hook flow.
4. Then read the result with `agent-deck session output "review-auth"`.

For follow-up prompts, send the message and start a new watcher for that turn:

```bash
agent-deck session send "review-auth" "Now fix the issues you found"
~/.codex/hooks/watch-agent.sh "review-auth" &
```

Expected follow-up behavior:
1. The message is sent to the existing Claude session.
2. Codex continues working normally.
3. When Claude finishes that follow-up turn, Codex is notified again.
4. Then read the result with `agent-deck session output "review-auth"`.

Use `agent-deck session output` for reading results and `agent-deck session show`
for spot checks. The notification path for Codex is the watcher + Codex hook
integration, not Claude Code's background-task completion UI.

## How You Get Notified

When Claude finishes, the background watcher either:
1. injects a notification into the Codex tmux pane immediately if Codex is idle
   and still waiting on agent-deck responses, or
2. leaves the completion queued for the next Codex `Stop` hook if immediate
   injection is not safe.

You will see something like:

> Agent-deck Claude session(s) completed: review-auth (at 2026-04-16 07:15:01).
> Read their output with: agent-deck session output "<name>"

Then read the result:

```bash
agent-deck session output "review-auth"
```

## Choosing a Model and Effort

The launch script accepts optional model and effort parameters:

```bash
# Default: opus model, high effort
~/.agents/skills/agent-deck/scripts/launch-claude.sh "task" "/repo" "prompt"

# Explicit model and effort
~/.agents/skills/agent-deck/scripts/launch-claude.sh "task" "/repo" "prompt" opus max
~/.agents/skills/agent-deck/scripts/launch-claude.sh "task" "/repo" "prompt" sonnet high
~/.agents/skills/agent-deck/scripts/launch-claude.sh "task" "/repo" "prompt" haiku medium
```

Available models: `opus`, `sonnet`, `haiku` (or full names like `claude-opus-4-6`)
Available effort levels: `low`, `medium`, `high`, `max`

## Inspecting Agents

Check on agents at any time without waiting for the notification:

```bash
# Status of all sessions
agent-deck status

# Detailed status of one session (JSON)
agent-deck session show "review-auth" --json

# Read last response (works even while running — shows partial output)
agent-deck session output "review-auth"

# All sessions as JSON
agent-deck list --json
```

### Status values

| Status | Meaning |
|--------|---------|
| `waiting` | Claude finished and is idle — read the output |
| `running` | Claude is actively working |
| `idle` | Session created but not started |
| `error` | Something went wrong |

## Sending Follow-Ups

After reading the output, you can send a follow-up and re-watch:

```bash
agent-deck session send "review-auth" "Now fix the issues you found"
~/.codex/hooks/watch-agent.sh "review-auth" &
```

The first command sends the message (blocks until delivered). The second starts
a new watcher for the follow-up task.

## Multiple Concurrent Agents

Launch several agents in parallel. Each gets its own watcher:

```bash
~/.agents/skills/agent-deck/scripts/launch-claude.sh "review-auth" "/repo" "Review auth module"
~/.agents/skills/agent-deck/scripts/launch-claude.sh "review-api" "/repo" "Review API endpoints"
~/.agents/skills/agent-deck/scripts/launch-claude.sh "fix-tests" "/repo" "Fix failing tests" sonnet high
```

Completions are batched — if multiple agents finish before your next turn ends,
you get one notification listing all of them.

## Git Worktrees (parallel work on same repo)

When multiple agents need to edit the same repo, use worktrees to avoid conflicts:

```bash
agent-deck launch /repo -t "feature-a" -g codex-tasks \
  -c "claude --dangerously-skip-permissions --effort high --model opus" \
  -w feature/a -b -m "Implement feature A"
~/.codex/hooks/watch-agent.sh "feature-a" &
```

The `-w feature/a -b` creates a git worktree on a new branch.

## Forking (branch a conversation)

Fork an existing session to try a different approach with the same context:

```bash
agent-deck session fork "review-auth" -t "review-auth-v2"
```

The fork inherits the full Claude conversation history.

## Session Lifecycle

```bash
# Stop a session (keeps metadata and session ID)
agent-deck session stop "review-auth"

# Restart (resumes with saved conversation)
agent-deck session start "review-auth"

# Remove entirely (stop first)
agent-deck session stop "review-auth"
agent-deck remove "review-auth"
```

## Detailed Documentation

For the full agent-deck feature set, read these reference files:

1. `/home/ubuntu/experiment_projects/pi_elixer/agent-deck_src/llms-full.txt` — Complete feature documentation (1700 lines)
2. `/home/ubuntu/experiment_projects/pi_elixer/agent-deck_src/skills/agent-deck/references/cli-reference.md` — Every CLI command and flag

Only read these if you need capabilities beyond what is documented above.
