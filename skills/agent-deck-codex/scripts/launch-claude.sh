#!/bin/bash
# Launch a Claude Code agent via agent-deck with managed Codex notification state.
#
# Usage:
#   launch-claude.sh <session-name> <repo-path> <prompt> [model] [effort]
#
# Arguments:
#   session-name  Unique name for this agent session (used to check status/output later)
#   repo-path     Path to the repository Claude should work in
#   prompt        The task for Claude to perform
#   model         Optional: opus (default), sonnet, haiku, or a full model name
#   effort        Optional: high (default), low, medium, max
#
# This script:
#   1. Launches an agent-deck session in the codex-tasks group
#   2. Starts Claude with --dangerously-skip-permissions and sends the prompt
#   3. Starts a background watcher that records completion for managed Codex hooks
#   4. Returns immediately so Codex can continue working
#
# Managed Codex hooks keep idle-notification state for agent-deck and can either
# inject immediately into an idle Codex tmux pane or queue the completion for
# the next Stop hook, depending on safety checks.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SCRIPT="$SCRIPT_DIR/agent-deck-hook.py"

if [ $# -lt 3 ]; then
  echo "Usage: launch-claude.sh <session-name> <repo-path> <prompt> [model] [effort]" >&2
  echo "" >&2
  echo "Examples:" >&2
  echo "  launch-claude.sh review-auth /home/ubuntu/project \"Review auth.ex\"" >&2
  echo "  launch-claude.sh fix-bug /repo \"Fix the login bug\" sonnet high" >&2
  echo "  launch-claude.sh deep-review /repo \"Full security audit\" opus max" >&2
  exit 1
fi

SESSION="$1"
REPO="$2"
PROMPT="$3"
MODEL="${4:-opus}"
EFFORT="${5:-high}"
SAFE_SESSION="$(printf '%s' "$SESSION" | tr -c 'A-Za-z0-9._-' '_')"
WATCH_LOG="/tmp/watch-agent-${SAFE_SESSION}.log"
WATCH_PID_FILE="/tmp/watch-agent-${SAFE_SESSION}.pid"

# Validate repo path exists
if [ ! -d "$REPO" ]; then
  echo "Error: repository path does not exist: $REPO" >&2
  exit 1
fi

# Ensure the Codex Stop hook is registered before launching the watcher.
# This keeps the skill self-contained instead of depending on prior manual setup.
if ! python3 "$SCRIPT_DIR/install-codex-hooks.py" >/dev/null; then
  echo "Error: failed to install the managed Codex hook for agent-deck" >&2
  exit 1
fi

# Launch the agent-deck session
# -g codex-tasks: required for the notification system to track it
# -c: Claude command with full-auto permissions
# -m: the prompt to send immediately
echo "Launching Claude agent '$SESSION' in $REPO..."
agent-deck launch "$REPO" \
  -t "$SESSION" \
  -g codex-tasks \
  -c "claude --dangerously-skip-permissions --effort $EFFORT --model $MODEL" \
  -m "$PROMPT"

LAUNCH_EXIT=$?
if [ $LAUNCH_EXIT -ne 0 ]; then
  echo "Error: agent-deck launch failed (exit $LAUNCH_EXIT)" >&2
  exit $LAUNCH_EXIT
fi

if ! python3 "$HOOK_SCRIPT" register-wait --session-name "$SESSION" --pane-id "${TMUX_PANE:-}" >/dev/null; then
  echo "Warning: failed to register agent-deck wait state for tmux injection" >&2
fi

# Start background watcher for completion notification
rm -f "$WATCH_PID_FILE"

if command -v setsid >/dev/null 2>&1; then
  setsid -f bash -lc '
    echo $$ > "$1"
    exec ~/.codex/hooks/watch-agent.sh "$2"
  ' _ "$WATCH_PID_FILE" "$SESSION" >>"$WATCH_LOG" 2>&1 < /dev/null
else
  nohup bash -lc '
    echo $$ > "$1"
    exec ~/.codex/hooks/watch-agent.sh "$2"
  ' _ "$WATCH_PID_FILE" "$SESSION" >>"$WATCH_LOG" 2>&1 < /dev/null &
fi

sleep 0.2

if [ -s "$WATCH_PID_FILE" ]; then
  WATCHER_PID="$(cat "$WATCH_PID_FILE")"
else
  WATCHER_PID="unknown"
fi

echo "Background watcher started (PID $WATCHER_PID, log $WATCH_LOG)"
echo ""
echo "Agent '$SESSION' is running. You will be notified when it completes."
echo "Check status anytime:  agent-deck session show \"$SESSION\""
echo "Read output anytime:   agent-deck session output \"$SESSION\""
