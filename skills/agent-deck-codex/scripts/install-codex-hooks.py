#!/usr/bin/env python3
"""Install the managed Codex hooks used by the agent-deck skill."""

from __future__ import annotations

import json
import shutil
from pathlib import Path


MANAGED_MARKER = "--managed-by agent-deck-skill"
SESSION_STATUS_MESSAGE = "Agent-deck is registering the Codex session"
STOP_STATUS_MESSAGE = "Agent-deck is checking background Claude sessions"
PROMPT_STATUS_MESSAGE = "Agent-deck is updating idle notification state"


def ensure_codex_hooks_feature(config_text: str) -> str:
    has_trailing_newline = config_text.endswith("\n")
    lines = config_text.split("\n")

    try:
        features_index = next(
            index for index, line in enumerate(lines) if line.strip() == "[features]"
        )
    except StopIteration:
        trimmed = config_text.rstrip("\n")
        suffix = "\n\n" if trimmed else ""
        return f"{trimmed}{suffix}[features]\ncodex_hooks = true\n"

    block_end_index = len(lines)
    for index in range(features_index + 1, len(lines)):
        line = lines[index]
        if line and line.strip().startswith("[") and line.strip().endswith("]"):
            block_end_index = index
            break

    next_block_lines = [
        line
        for line in lines[features_index + 1 : block_end_index]
        if not line.lstrip().startswith("codex_hooks")
    ]
    next_block_lines.append("codex_hooks = true")

    next_lines = (
        lines[: features_index + 1] + next_block_lines + lines[block_end_index:]
    )
    next_config = "\n".join(next_lines)
    if has_trailing_newline or not next_config:
        return f"{next_config.rstrip()}\n"
    return next_config


def load_hooks_document(hooks_path: Path) -> dict:
    if not hooks_path.exists():
        return {"hooks": {}}

    try:
        return json.loads(hooks_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        backup_path = hooks_path.with_name(
            f"{hooks_path.name}.corrupt.{hooks_path.stat().st_mtime_ns}"
        )
        shutil.copy2(hooks_path, backup_path)
        return {"hooks": {}}


def remove_managed_hooks(document: dict, hook_script_path: Path) -> None:
    next_hooks: dict[str, list[dict]] = {}
    hook_script = str(hook_script_path)

    for event_name, groups in (document.get("hooks") or {}).items():
        next_groups = []
        for group in groups or []:
            next_handlers = [
                hook
                for hook in (group.get("hooks") or [])
                if MANAGED_MARKER not in str(hook.get("command", ""))
                and hook_script not in str(hook.get("command", ""))
            ]
            if next_handlers:
                next_group = dict(group)
                next_group["hooks"] = next_handlers
                next_groups.append(next_group)
        if next_groups:
            next_hooks[event_name] = next_groups

    document["hooks"] = next_hooks


def main() -> int:
    home = Path.home()
    codex_dir = home / ".codex"
    hooks_dir = codex_dir / "hooks"
    hook_script_path = hooks_dir / "check-agent-deck.sh"
    hooks_path = codex_dir / "hooks.json"
    config_path = codex_dir / "config.toml"

    if not hook_script_path.exists():
        raise SystemExit(f"Missing hook script: {hook_script_path}")

    codex_dir.mkdir(parents=True, exist_ok=True)
    hooks_dir.mkdir(parents=True, exist_ok=True)

    current_config = config_path.read_text(encoding="utf-8") if config_path.exists() else ""
    next_config = ensure_codex_hooks_feature(current_config)
    if next_config != current_config:
        config_path.write_text(next_config, encoding="utf-8")

    document = load_hooks_document(hooks_path)
    if not isinstance(document, dict):
        document = {"hooks": {}}
    if not isinstance(document.get("hooks"), dict):
        document["hooks"] = {}

    remove_managed_hooks(document, hook_script_path)

    def add_hook(event_name: str, command: str, timeout: int, status_message: str) -> None:
        event_hooks = list(document["hooks"].get(event_name) or [])
        event_hooks.append(
            {
                "hooks": [
                    {
                        "type": "command",
                        "command": command,
                        "timeout": timeout,
                        "statusMessage": status_message,
                    }
                ]
            }
        )
        document["hooks"][event_name] = event_hooks

    base_command = f"{hook_script_path} --managed-by agent-deck-skill"
    add_hook(
        "SessionStart",
        f"{base_command} --event SessionStart",
        15,
        SESSION_STATUS_MESSAGE,
    )
    add_hook(
        "Stop",
        f"{base_command} --event Stop",
        15,
        STOP_STATUS_MESSAGE,
    )
    add_hook(
        "UserPromptSubmit",
        f"{base_command} --event UserPromptSubmit",
        15,
        PROMPT_STATUS_MESSAGE,
    )

    hooks_path.write_text(f"{json.dumps(document, indent=2)}\n", encoding="utf-8")
    print(f"Installed managed agent-deck hooks in {hooks_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
