#!/usr/bin/env python3
"""Managed Codex hook state for the agent-deck skill.

This script serves three roles:
1. Codex hook handler for SessionStart / Stop / UserPromptSubmit
2. Agent wait registration when launch-claude.sh starts a background session
3. Background watcher completion handler with guarded tmux injection
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


STATE_DIR = Path("/tmp/agent-deck-codex")
STATE_PATH = STATE_DIR / "state.json"
LOCK_PATH = STATE_DIR / "state.lock"
STATE_VERSION = 1
DEFAULT_PANE_KEY = "__default__"
INJECTABLE_COMMANDS = {"codex", "node"}
SNAPSHOT_LINE_COUNT = 40


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def ensure_state_dir() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)


@contextmanager
def locked_state() -> Any:
    ensure_state_dir()
    with LOCK_PATH.open("a+", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        state = load_state()
        yield state
        save_state(state)
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


def load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {"version": STATE_VERSION, "panes": {}, "agent_index": {}}

    try:
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        backup = STATE_PATH.with_name(f"{STATE_PATH.name}.corrupt.{STATE_PATH.stat().st_mtime_ns}")
        shutil.copy2(STATE_PATH, backup)
        return {"version": STATE_VERSION, "panes": {}, "agent_index": {}}

    if not isinstance(state, dict):
        return {"version": STATE_VERSION, "panes": {}, "agent_index": {}}

    state.setdefault("version", STATE_VERSION)
    state.setdefault("panes", {})
    state.setdefault("agent_index", {})
    if not isinstance(state["panes"], dict):
        state["panes"] = {}
    if not isinstance(state["agent_index"], dict):
        state["agent_index"] = {}
    return state


def save_state(state: dict[str, Any]) -> None:
    prune_state(state)
    STATE_PATH.write_text(f"{json.dumps(state, indent=2, sort_keys=True)}\n", encoding="utf-8")


def prune_state(state: dict[str, Any]) -> None:
    panes = state.get("panes", {})
    agent_index = state.get("agent_index", {})
    removable = []

    for pane_key, pane in panes.items():
        pending = pane.get("pending_agents") or {}
        completed = pane.get("completed_agents") or {}
        armed = bool(pane.get("armed"))
        if not pending and not completed and not armed:
            removable.append(pane_key)

    for pane_key in removable:
        panes.pop(pane_key, None)

    valid_agents = {
        agent_name
        for pane in panes.values()
        for agent_name in (pane.get("pending_agents") or {}).keys()
    }
    valid_agents.update(
        agent_name
        for pane in panes.values()
        for agent_name in (pane.get("completed_agents") or {}).keys()
    )

    for agent_name in list(agent_index.keys()):
        if agent_name not in valid_agents:
            agent_index.pop(agent_name, None)


def pane_key_from_id(pane_id: str | None) -> str:
    if pane_id and pane_id.strip():
        return pane_id.strip()
    return DEFAULT_PANE_KEY


def ensure_pane(state: dict[str, Any], pane_id: str | None) -> tuple[str, dict[str, Any]]:
    pane_key = pane_key_from_id(pane_id)
    panes = state.setdefault("panes", {})
    pane = panes.setdefault(
        pane_key,
        {
            "pane_id": pane_id.strip() if pane_id else "",
            "pending_agents": {},
            "completed_agents": {},
            "armed": False,
            "armed_snapshot_hash": "",
            "updated_at": now_iso(),
        },
    )
    if pane_id:
        pane["pane_id"] = pane_id.strip()
    pane.setdefault("pending_agents", {})
    pane.setdefault("completed_agents", {})
    pane.setdefault("armed", False)
    pane.setdefault("armed_snapshot_hash", "")
    pane["updated_at"] = now_iso()
    return pane_key, pane


def run_tmux(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["tmux", *args],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


def pane_snapshot_hash(pane_id: str | None) -> str:
    if not pane_id:
        return ""

    result = run_tmux("capture-pane", "-pt", pane_id, "-S", f"-{SNAPSHOT_LINE_COUNT}")
    if result.returncode != 0:
        return ""

    contents = result.stdout
    if not contents:
        return ""

    return hashlib.sha256(contents.encode("utf-8")).hexdigest()


def pane_metadata(pane_id: str | None) -> dict[str, str] | None:
    if not pane_id:
        return None

    fmt = "#{pane_dead}|#{pane_in_mode}|#{pane_current_command}"
    result = run_tmux("display-message", "-p", "-t", pane_id, fmt)
    if result.returncode != 0:
        return None

    parts = result.stdout.strip().split("|")
    if len(parts) != 3:
        return None

    return {
        "pane_dead": parts[0],
        "pane_in_mode": parts[1],
        "pane_current_command": parts[2],
    }


def is_safe_to_inject(pane: dict[str, Any]) -> bool:
    pane_id = pane.get("pane_id") or ""
    if not pane_id:
        return False

    metadata = pane_metadata(pane_id)
    if metadata is None:
        return False

    if metadata["pane_dead"] != "0":
        return False
    if metadata["pane_in_mode"] != "0":
        return False
    if metadata["pane_current_command"] not in INJECTABLE_COMMANDS:
        return False

    expected_hash = pane.get("armed_snapshot_hash") or ""
    current_hash = pane_snapshot_hash(pane_id)
    if not expected_hash or not current_hash:
        return False

    return expected_hash == current_hash


def build_notification_message(completed: dict[str, dict[str, str]]) -> str:
    completed_items: list[str] = []
    errored_items: list[str] = []
    other_items: list[str] = []

    for agent_name in sorted(completed.keys()):
        item = completed[agent_name]
        status = item.get("status", "")
        timestamp = item.get("timestamp", "")
        if status == "completed":
            completed_items.append(f"{agent_name} (at {timestamp})")
        elif status == "error":
            errored_items.append(f"{agent_name} (at {timestamp})")
        else:
            other_items.append(f"{agent_name} ({status} at {timestamp})")

    parts: list[str] = []
    if completed_items:
        parts.append(
            "Agent-deck Claude session(s) completed: "
            + ", ".join(completed_items)
            + '. Read their output with: agent-deck session output "<name>"'
        )
    if errored_items:
        parts.append(
            "Session(s) errored: "
            + ", ".join(errored_items)
            + '. Check with: agent-deck session show "<name>"'
        )
    if other_items:
        parts.append("Session(s) ended: " + ", ".join(other_items) + ".")

    return " | ".join(parts)


def inject_into_pane(pane_id: str, message: str) -> bool:
    literal = run_tmux("send-keys", "-t", pane_id, "-l", message)
    if literal.returncode != 0:
        return False

    # Give Codex a beat to incorporate the injected text before sending submit.
    # Without this, the text can appear in the composer while the enter key is
    # processed too early and effectively ignored.
    time.sleep(0.2)

    submit = run_tmux("send-keys", "-t", pane_id, "C-m")
    return submit.returncode == 0


def hook_response(payload: dict[str, str]) -> None:
    print(json.dumps(payload))


def read_hook_payload() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def handle_hook(event: str | None) -> int:
    payload = read_hook_payload()
    event_name = event or str(payload.get("hook_event_name") or "")
    pane_id = os.environ.get("TMUX_PANE", "").strip()

    with locked_state() as state:
        pane_key, pane = ensure_pane(state, pane_id)

        if event_name == "SessionStart":
            pane["armed"] = False
            pane["armed_snapshot_hash"] = ""
            pane["last_session_start_at"] = now_iso()
            hook_response({})
            return 0

        if event_name == "UserPromptSubmit":
            pane["armed"] = False
            pane["armed_snapshot_hash"] = ""
            pane["last_user_prompt_submit_at"] = now_iso()
            hook_response({})
            return 0

        if event_name != "Stop":
            hook_response({})
            return 0

        completed = pane.get("completed_agents") or {}
        if completed:
            message = build_notification_message(completed)
            pane["completed_agents"] = {}
            pane["armed"] = False
            pane["armed_snapshot_hash"] = ""
            hook_response({"decision": "block", "reason": message})
            return 0

        pending = pane.get("pending_agents") or {}
        if pending:
            pane["armed"] = True
            pane["armed_snapshot_hash"] = pane_snapshot_hash(pane.get("pane_id") or "")
            pane["last_armed_at"] = now_iso()
        else:
            pane["armed"] = False
            pane["armed_snapshot_hash"] = ""

        hook_response({})
        return 0


def handle_register_wait(session_name: str, pane_id: str | None) -> int:
    with locked_state() as state:
        pane_key, pane = ensure_pane(state, pane_id)
        pane["pending_agents"][session_name] = {"registered_at": now_iso()}
        pane["completed_agents"].pop(session_name, None)
        state["agent_index"][session_name] = pane_key
    return 0


def handle_complete(session_name: str, status: str, timestamp: str) -> int:
    with locked_state() as state:
        pane_key = str(state.get("agent_index", {}).get(session_name) or DEFAULT_PANE_KEY)
        pane = state.setdefault("panes", {}).get(pane_key)
        if pane is None:
            _, pane = ensure_pane(state, None)

        pane["pending_agents"].pop(session_name, None)
        pane["completed_agents"][session_name] = {
            "status": status,
            "timestamp": timestamp,
            "updated_at": now_iso(),
        }

        if not pane.get("armed"):
            return 0

        if not is_safe_to_inject(pane):
            pane["armed"] = False
            pane["armed_snapshot_hash"] = ""
            return 0

        message = build_notification_message(pane["completed_agents"])
        pane_id = pane.get("pane_id") or ""
        if inject_into_pane(pane_id, message):
            pane["completed_agents"] = {}
        pane["armed"] = False
        pane["armed_snapshot_hash"] = ""
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    hook_parser = subparsers.add_parser("hook")
    hook_parser.add_argument("--event", default="")

    register_parser = subparsers.add_parser("register-wait")
    register_parser.add_argument("--session-name", required=True)
    register_parser.add_argument("--pane-id", default="")

    complete_parser = subparsers.add_parser("complete")
    complete_parser.add_argument("--session-name", required=True)
    complete_parser.add_argument("--status", required=True)
    complete_parser.add_argument("--timestamp", required=True)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "hook":
        return handle_hook(args.event)
    if args.command == "register-wait":
        return handle_register_wait(args.session_name, args.pane_id)
    if args.command == "complete":
        return handle_complete(args.session_name, args.status, args.timestamp)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
