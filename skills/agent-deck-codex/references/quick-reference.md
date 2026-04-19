# Agent-Deck Quick Reference

## Launch

```bash
# One-liner (recommended)
~/.agents/skills/agent-deck/scripts/launch-claude.sh "<name>" "<repo>" "<prompt>" [model] [effort]

# Manual (if you need custom flags)
agent-deck launch <repo> -t "<name>" -g codex-tasks \
  -c "claude --dangerously-skip-permissions --effort <effort> --model <model>" \
  -m "<prompt>"
~/.codex/hooks/watch-agent.sh "<name>" &
```

## Inspect

```bash
agent-deck status                              # All sessions summary
agent-deck session show "<name>" --json        # One session detail
agent-deck session output "<name>"             # Last Claude response
agent-deck list --json                         # All sessions JSON
tmux capture-pane -t "<tmux_session>" -p       # Full terminal output
```

## Interact

```bash
agent-deck session send "<name>" "<message>"   # Send follow-up
agent-deck session fork "<name>" -t "<fork>"   # Branch conversation
```

## Lifecycle

```bash
agent-deck session stop "<name>"               # Stop (preserves state)
agent-deck session start "<name>"              # Restart (resumes conversation)
agent-deck remove "<name>"                     # Delete permanently
```

## Models and Effort

| Model | Flag | Cost |
|-------|------|------|
| Opus | `opus` or `claude-opus-4-6` | Highest |
| Sonnet | `sonnet` or `claude-sonnet-4-6` | Medium |
| Haiku | `haiku` or `claude-haiku-4-5` | Lowest |

| Effort | Flag | Depth |
|--------|------|-------|
| Low | `low` | Minimal reasoning |
| Medium | `medium` | Balanced |
| High | `high` | Deep reasoning (default) |
| Max | `max` | Maximum reasoning |

## Notification Signal Files

```bash
ls /tmp/codex-agent-notifications/             # See which agents finished
cat /tmp/codex-agent-notifications/done-<name> # Read signal details
rm /tmp/codex-agent-notifications/done-<name>  # Manual cleanup
```
