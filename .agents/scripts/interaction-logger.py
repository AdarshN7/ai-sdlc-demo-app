#!/usr/bin/env python3
"""
interaction-logger.py — Robust JSONL interaction logger for Antigravity IDE lifecycle hooks.

Parses incoming hook JSON from stdin, extracts tool parameters, summaries,
content, user prompts (from transcript when available), redacts secrets,
and appends a JSONL entry to .ai-sdlc/interaction-log.jsonl.
"""

import os
import sys
import json
import time
import re
from datetime import datetime, timezone
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
LOG_DIR = REPO_ROOT / ".ai-sdlc"
LOG_FILE = LOG_DIR / "interaction-log.jsonl"
DEDUP_DIR = LOG_DIR / ".seen-events"
LOCK_DIR = LOG_DIR / ".lock"

LOG_DIR.mkdir(parents=True, exist_ok=True)
DEDUP_DIR.mkdir(parents=True, exist_ok=True)

# Sensitive patterns for redaction
REDACTION_PATTERNS = [
    (re.compile(r'password\s*=\s*[^ "]+', re.IGNORECASE), 'password=***REDACTED***'),
    (re.compile(r'token\s*=\s*[^ "]+', re.IGNORECASE), 'token=***REDACTED***'),
    (re.compile(r'secret\s*=\s*[^ "]+', re.IGNORECASE), 'secret=***REDACTED***'),
    (re.compile(r'Authorization\s*:\s*Bearer\s+[^ "]+', re.IGNORECASE), 'Authorization: Bearer ***REDACTED***'),
    (re.compile(r'Bearer\s+[A-Za-z0-9._-]+', re.IGNORECASE), 'Bearer ***REDACTED***'),
    (re.compile(r'api[_-]key\s*=\s*[^ "]+', re.IGNORECASE), 'api_key=***REDACTED***'),
    (re.compile(r'ChangeMe123!'), '***REDACTED***'),
]


def redact(text: str) -> str:
    if not text:
        return ""
    for pattern, replacement in REDACTION_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def extract_user_request_from_transcript(transcript_path: str) -> tuple[str, str]:
    """Extract latest user prompt from transcript.jsonl."""
    if not transcript_path or not os.path.exists(transcript_path):
        return "", ""

    last_user_content = ""
    try:
        with open(transcript_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if entry.get("type") == "USER_INPUT":
                        content = entry.get("content", "")
                        if content:
                            last_user_content = content
                except Exception:
                    continue
    except Exception:
        return "", ""

    if not last_user_content:
        return "", ""

    # Check for <USER_REQUEST>...</USER_REQUEST> tags
    req_match = re.search(r"<USER_REQUEST>(.*?)</USER_REQUEST>", last_user_content, re.DOTALL)
    if req_match:
        req_text = req_match.group(1).strip()
    else:
        req_text = last_user_content.strip()

    # Create a 1-line summary
    first_line = req_text.splitlines()[0] if req_text else ""
    summary = f"User request: {first_line[:120]}"

    return summary, req_text


def process_payload(raw_data: str, hook_arg: str = ""):
    if not raw_data.strip():
        return

    try:
        payload = json.loads(raw_data)
    except Exception:
        return

    hook_type = payload.get("hookType") or hook_arg or "unknown"
    conversation_id = payload.get("conversationId", "")
    model_name = payload.get("modelName", "")
    step_idx = payload.get("stepIdx")
    invocation_num = payload.get("invocationNum")
    execution_num = payload.get("executionNum")
    termination_reason = payload.get("terminationReason", "")
    error_msg = payload.get("error", "")
    transcript_path = payload.get("transcriptPath", "")

    # Tool call data
    tool_call = payload.get("toolCall") or {}
    tool_name = payload.get("name") or tool_call.get("name") or payload.get("toolName", "")
    tool_args = tool_call.get("args") or {}

    command_line = (
        payload.get("CommandLine")
        or tool_args.get("CommandLine")
        or tool_args.get("command")
        or ""
    )
    target_file = (
        payload.get("TargetFile")
        or tool_args.get("TargetFile")
        or tool_args.get("AbsolutePath")
        or tool_args.get("SearchPath")
        or tool_args.get("DirectoryPath")
        or ""
    )

    capture_status = payload.get("captureStatus") or "auto"
    content = payload.get("content", "")
    summary = payload.get("summary", "")

    # Determine event type & actor
    if hook_type == "PreToolUse":
        event_type = "tool_execution_start"
        actor = "agent"

        # Determine summary if not provided
        if not summary:
            summary = (
                tool_args.get("toolSummary")
                or tool_args.get("toolAction")
                or tool_args.get("TaskSummary")
                or tool_args.get("Description")
                or tool_args.get("Instruction")
                or ""
            )
        if not summary:
            if command_line:
                summary = f"Run: {command_line[:100]}"
            elif target_file:
                basename = Path(target_file).name
                summary = f"{tool_name}: {basename}"
            else:
                summary = f"Execute {tool_name}" if tool_name else "Tool execution"

        # Determine content if not provided
        if not content:
            content = (
                tool_args.get("Description")
                or tool_args.get("Instruction")
                or tool_args.get("Task")
                or tool_args.get("Prompt")
                or tool_args.get("Query")
                or tool_args.get("CommandLine")
                or (tool_args.get("toolAction") if tool_args.get("toolAction") != summary else "")
                or (f"{tool_name} on {target_file}" if target_file else "")
                or summary
            )

    elif hook_type == "PostToolUse":
        event_type = "tool_execution_end"
        actor = "agent"
        if error_msg:
            summary = summary or f"{tool_name or 'Tool'} failed: {error_msg[:100]}"
            content = content or error_msg
        else:
            summary = summary or f"{tool_name or 'Tool'} completed successfully"
            content = content or "success"

    elif hook_type == "PreInvocation":
        event_type = "model_invocation_start"
        actor = "system"
        req_sum, req_cnt = extract_user_request_from_transcript(transcript_path)
        if req_sum and not summary:
            summary = req_sum
        if req_cnt and not content:
            content = req_cnt
        if not summary:
            summary = f"Model invocation #{invocation_num or 0} started"
        if not content:
            content = f"Invoking {model_name or 'model'}"

    elif hook_type == "PostInvocation":
        event_type = "model_invocation_end"
        actor = "system"
        if not summary:
            summary = f"Model invocation #{invocation_num or 0} completed"
        if not content:
            content = "Model response completed"

    elif hook_type == "Stop":
        event_type = "task_termination"
        actor = "system"
        if not summary:
            summary = f"Task stopped: {termination_reason or 'finished'}"
        if not content:
            content = f"Termination reason: {termination_reason or 'none'}. Error: {error_msg or 'none'}"

    elif hook_type == "ManualEntry":
        event_type = payload.get("eventType") or "manual_entry"
        actor = payload.get("actor") or "human"
        capture_status = "manual"
        if not summary and content:
            summary = content.splitlines()[0][:120]
        elif not content and summary:
            content = summary

    else:
        event_type = payload.get("eventType") or "unknown"
        actor = payload.get("actor") or "unknown"
        if not summary and content:
            summary = content.splitlines()[0][:120]
        elif not content and summary:
            content = summary

    # Suffix & Event ID
    if step_idx is not None and str(step_idx) != "":
        id_suffix = str(step_idx)
    elif invocation_num is not None:
        id_suffix = str(invocation_num)
    elif execution_num is not None:
        id_suffix = str(execution_num)
    else:
        id_suffix = f"{int(time.time())}"

    event_id = f"{conversation_id or 'unknown'}-{hook_type}-{id_suffix}"

    # Deduplication
    dedup_file = DEDUP_DIR / event_id
    if dedup_file.exists():
        return

    # Redactions
    tool_name = redact(str(tool_name))
    command_line = redact(str(command_line))
    target_file = redact(str(target_file))
    content = redact(str(content))
    summary = redact(str(summary))
    error_msg = redact(str(error_msg))
    termination_reason = redact(str(termination_reason))

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    entry = {
        "eventId": event_id,
        "timestamp": now_iso,
        "sessionId": conversation_id,
        "actor": actor,
        "eventType": event_type,
        "toolName": tool_name,
        "stepIdx": id_suffix,
        "commandLine": command_line,
        "fileChanged": target_file,
        "content": content,
        "summary": summary,
        "error": error_msg,
        "terminationReason": termination_reason,
        "modelName": model_name,
        "captureStatus": capture_status,
    }

    # Atomic-ish append with directory lock
    locked = False
    for _ in range(5):
        try:
            LOCK_DIR.mkdir(exist_ok=False)
            locked = True
            break
        except FileExistsError:
            time.sleep(0.05)

    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        try:
            dedup_file.touch()
        except Exception:
            pass
    finally:
        if locked:
            try:
                LOCK_DIR.rmdir()
            except Exception:
                pass


if __name__ == "__main__":
    raw_input = sys.stdin.read()
    hook_arg = sys.argv[1] if len(sys.argv) > 1 else ""
    process_payload(raw_input, hook_arg)
