#!/bin/bash
# launch-subagent.sh - Launch a sub-agent, optionally linked to current session
#
# Usage: launch-subagent.sh "Title" "Prompt" [options]
#
# Options:
#   --mcp <name>     Attach MCP (can repeat)
#   --profile <name> Use the given agent-deck profile (default: current/default)
#   --tool <type>    Agent tool: claude, codex, gemini (default: claude)
#   --path <dir>     Working directory for the agent (default: parent path or cwd)
#   --wait           Poll until complete, return output
#   --timeout <sec>  Wait timeout (default: 300)
#
# Examples:
#   launch-subagent.sh "Research" "Find info about X"
#   launch-subagent.sh "Task" "Do Y" --mcp exa --mcp firecrawl
#   launch-subagent.sh "Query" "Answer Z" --wait --timeout 120
#   launch-subagent.sh "Consult" "Review this approach" --tool codex --wait
#   launch-subagent.sh "Review" "Review the session_cmd.go" --tool codex --path /path/to/project --wait

set -euo pipefail

TITLE=""
PROMPT=""
TOOL="claude"
WORK_PATH=""
MCPS=()
WAIT=false
TIMEOUT=300
PROFILE_OVERRIDE=""

while [ $# -gt 0 ]; do
    case "$1" in
        --mcp)
            MCPS+=("$2")
            shift 2
            ;;
        --profile)
            PROFILE_OVERRIDE="$2"
            shift 2
            ;;
        --tool)
            TOOL="$2"
            shift 2
            ;;
        --path)
            WORK_PATH="$2"
            shift 2
            ;;
        --wait)
            WAIT=true
            shift
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        *)
            if [ -z "$TITLE" ]; then
                TITLE="$1"
            elif [ -z "$PROMPT" ]; then
                PROMPT="$1"
            fi
            shift
            ;;
    esac
done

if [ -z "$TITLE" ] || [ -z "$PROMPT" ]; then
    echo 'Usage: launch-subagent.sh "Title" "Prompt" [--tool codex] [--path /dir] [--profile name] [--mcp name] [--wait]' >&2
    exit 1
fi

CURRENT_JSON="$(agent-deck session current --json 2>/dev/null || true)"
PARENT=""
PARENT_PATH=""
PROFILE=""
HAS_PARENT=false

if [ -n "$CURRENT_JSON" ]; then
    CURRENT_SESSION=$(printf '%s\n' "$CURRENT_JSON" | jq -r '.session // empty' 2>/dev/null || true)
    CURRENT_PATH=$(printf '%s\n' "$CURRENT_JSON" | jq -r '.path // empty' 2>/dev/null || true)
    CURRENT_PROFILE=$(printf '%s\n' "$CURRENT_JSON" | jq -r '.profile // empty' 2>/dev/null || true)
    if [ -n "$CURRENT_SESSION" ]; then
        HAS_PARENT=true
        PARENT="$CURRENT_SESSION"
        PARENT_PATH="$CURRENT_PATH"
        PROFILE="$CURRENT_PROFILE"
    fi
fi

if [ -n "$PROFILE_OVERRIDE" ]; then
    PROFILE="$PROFILE_OVERRIDE"
fi

PROFILE_ARGS=()
if [ -n "$PROFILE" ]; then
    PROFILE_ARGS=(-p "$PROFILE")
fi
AGENT_DECK_CMD=(agent-deck "${PROFILE_ARGS[@]}")

if [ -n "$WORK_PATH" ]; then
    WORK_DIR="$WORK_PATH"
elif [ -n "$PARENT_PATH" ] && [ "$PARENT_PATH" != "null" ]; then
    WORK_DIR="$PARENT_PATH"
else
    WORK_DIR="$(pwd)"
fi
mkdir -p "$WORK_DIR"

print_response() {
    local tmux_session="$1"
    local output_cmd=("${AGENT_DECK_CMD[@]}" session output "$TITLE" -q)
    local attempt
    local output

    for attempt in 1 2 3 4 5; do
        if output="$("${output_cmd[@]}" 2>/dev/null)"; then
            printf '%s\n' "$output"
            return 0
        fi
        sleep 1
    done

    if [ -n "$tmux_session" ] && tmux has-session -t "$tmux_session" 2>/dev/null; then
        tmux capture-pane -t "$tmux_session" -p -S - 2>/dev/null
        return 0
    fi

    return 1
}

LAUNCH_CMD=("${AGENT_DECK_CMD[@]}" launch "$WORK_DIR" -t "$TITLE" -c "$TOOL" -m "$PROMPT")
if [ "$HAS_PARENT" = "true" ]; then
    LAUNCH_CMD+=(--parent "$PARENT")
else
    LAUNCH_CMD+=(--no-parent)
fi
for mcp in "${MCPS[@]}"; do
    LAUNCH_CMD+=(--mcp "$mcp")
done
"${LAUNCH_CMD[@]}"

SESSION_JSON="$("${AGENT_DECK_CMD[@]}" session show "$TITLE" --json 2>/dev/null || true)"
TMUX_SESSION="$(printf '%s\n' "$SESSION_JSON" | jq -r '.tmux_session // empty' 2>/dev/null || true)"

OUTPUT_HINT='agent-deck '
if [ -n "$PROFILE" ]; then
    OUTPUT_HINT+="-p $PROFILE "
fi
OUTPUT_HINT+="session output \"$TITLE\""

echo ""
echo "Sub-agent launched:"
echo "  Title:   $TITLE"
echo "  Tool:    $TOOL"
if [ "$HAS_PARENT" = "true" ]; then
    echo "  Mode:    child session"
    echo "  Parent:  $PARENT"
else
    echo "  Mode:    standalone session"
fi
if [ -n "$PROFILE" ]; then
    echo "  Profile: $PROFILE"
else
    echo "  Profile: default"
fi
echo "  Path:    $WORK_DIR"
if [ ${#MCPS[@]} -gt 0 ]; then
    echo "  MCPs:    ${MCPS[*]}"
fi
echo ""
echo "Check output with: $OUTPUT_HINT"

if [ "$WAIT" = "true" ]; then
    echo ""
    echo "Waiting for completion (timeout: ${TIMEOUT}s)..."

    START_TIME=$(date +%s)
    while true; do
        SESSION_JSON="$("${AGENT_DECK_CMD[@]}" session show "$TITLE" --json 2>/dev/null || true)"
        STATUS="$(printf '%s\n' "$SESSION_JSON" | jq -r '.status // empty' 2>/dev/null || true)"
        if [ -z "$TMUX_SESSION" ]; then
            TMUX_SESSION="$(printf '%s\n' "$SESSION_JSON" | jq -r '.tmux_session // empty' 2>/dev/null || true)"
        fi

        if [ "$STATUS" = "waiting" ]; then
            echo "Complete!"
            echo ""
            echo "=== Response ==="
            if ! print_response "$TMUX_SESSION"; then
                echo "Failed to retrieve session output for \"$TITLE\"" >&2
                exit 1
            fi
            exit 0
        fi

        if [ "$STATUS" = "error" ]; then
            echo "Session entered error state before producing a response." >&2
            if [ -n "$TMUX_SESSION" ] && tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
                echo "" >&2
                echo "=== Session Pane ===" >&2
                tmux capture-pane -t "$TMUX_SESSION" -p -S - 2>/dev/null >&2 || true
            fi
            exit 1
        fi

        ELAPSED=$(($(date +%s) - START_TIME))
        if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
            echo "Timeout after ${TIMEOUT}s (session still running)" >&2
            echo "Check later with: $OUTPUT_HINT" >&2
            exit 1
        fi

        if [ "$ELAPSED" -lt 30 ]; then
            sleep 2
        else
            sleep 5
        fi
    done
fi
