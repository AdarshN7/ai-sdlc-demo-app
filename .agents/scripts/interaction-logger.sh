#!/bin/sh
# interaction-logger.sh — Append-only JSONL interaction logger for Antigravity IDE hooks.
#
# Usage: echo '{"hookType":"PreToolUse",...}' | sh interaction-logger.sh [hookType]
#
# This script is invoked by Antigravity lifecycle hooks or log-manual-entry.sh.
# It delegates to interaction-logger.py when python3 is available for high-fidelity
# parsing, redaction, and user prompt extraction, with a POSIX sh fallback.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$REPO_ROOT/.ai-sdlc"
LOG_FILE="$LOG_DIR/interaction-log.jsonl"
DEDUP_DIR="$LOG_DIR/.seen-events"

mkdir -p "$LOG_DIR" "$DEDUP_DIR"

PAYLOAD="$(cat)"

if [ -z "$PAYLOAD" ]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Fast-path: use Python 3 if available for full JSON robustness & rich context
# ---------------------------------------------------------------------------
if command -v python3 >/dev/null 2>&1; then
  if printf '%s' "$PAYLOAD" | python3 "$SCRIPT_DIR/interaction-logger.py" "$1" 2>/dev/null; then
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Shell Fallback (POSIX sh + grep + sed + tr)
# ---------------------------------------------------------------------------

extract_field() {
  printf '%s' "$PAYLOAD" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed "s/\"$1\"[[:space:]]*:[[:space:]]*\"//;s/\"$//"
}

extract_number() {
  printf '%s' "$PAYLOAD" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*[0-9][0-9]*" | head -1 | sed "s/\"$1\"[[:space:]]*:[[:space:]]*//"
}

HOOK_TYPE="$(extract_field hookType)"
[ -z "$HOOK_TYPE" ] && HOOK_TYPE="${1:-unknown}"

CONVERSATION_ID="$(extract_field conversationId)"
MODEL_NAME="$(extract_field modelName)"
TOOL_NAME="$(extract_field name)"
[ -z "$TOOL_NAME" ] && TOOL_NAME="$(extract_field toolName)"
STEP_IDX="$(extract_number stepIdx)"
INVOCATION_NUM="$(extract_number invocationNum)"
EXECUTION_NUM="$(extract_number executionNum)"
TERMINATION_REASON="$(extract_field terminationReason)"
ERROR_MSG="$(extract_field error)"

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
STEP_IDX_STR="$(extract_field stepIdx)"
ID_SUFFIX="${STEP_IDX:-${STEP_IDX_STR:-${INVOCATION_NUM:-${EXECUTION_NUM:-0}}}}"
EVENT_ID="${CONVERSATION_ID:-unknown}-${HOOK_TYPE:-unknown}-${ID_SUFFIX}"

DEDUP_FILE="$DEDUP_DIR/$EVENT_ID"
if [ -f "$DEDUP_FILE" ]; then
  exit 0
fi

COMMAND_LINE=""
FILE_REF=""
SUMMARY="$(extract_field summary)"
CONTENT="$(extract_field content)"
CAPTURE_STATUS="$(extract_field captureStatus)"

case "$HOOK_TYPE" in
  PreToolUse)
    case "$TOOL_NAME" in
      view_file|list_dir|grep_search|read_resource|list_resources|read_url_content|schedule|manage_task)
        exit 0
        ;;
    esac

    EVENT_TYPE="tool_execution_start"
    ACTOR="agent"
    COMMAND_LINE="$(extract_field CommandLine)"
    TARGET_FILE="$(extract_field TargetFile)"
    TARGET_FILE_ALT="$(extract_field AbsolutePath)"
    FILE_REF="${TARGET_FILE:-$TARGET_FILE_ALT}"
    
    # Extract rich summary and content from tool args
    [ -z "$SUMMARY" ] && SUMMARY="$(extract_field toolSummary)"
    [ -z "$SUMMARY" ] && SUMMARY="$(extract_field toolAction)"
    [ -z "$SUMMARY" ] && SUMMARY="$(extract_field TaskSummary)"
    [ -z "$SUMMARY" ] && SUMMARY="$(extract_field Description)"
    [ -z "$SUMMARY" ] && [ -n "$COMMAND_LINE" ] && SUMMARY="Run: $COMMAND_LINE"
    [ -z "$SUMMARY" ] && [ -n "$FILE_REF" ] && SUMMARY="$TOOL_NAME: $(basename "$FILE_REF")"
    [ -z "$SUMMARY" ] && SUMMARY="Execute $TOOL_NAME"

    [ -z "$CONTENT" ] && CONTENT="$(extract_field Description)"
    [ -z "$CONTENT" ] && CONTENT="$(extract_field Instruction)"
    [ -z "$CONTENT" ] && CONTENT="$(extract_field CommandLine)"
    [ -z "$CONTENT" ] && CONTENT="$(extract_field Query)"
    [ -z "$CONTENT" ] && CONTENT="$(extract_field Prompt)"
    [ -z "$CONTENT" ] && CONTENT="$(extract_field toolAction)"
    [ -z "$CONTENT" ] && CONTENT="$SUMMARY"
    ;;
  PostToolUse)
    # Only record if there was an error
    [ -z "$ERROR_MSG" ] && exit 0
    EVENT_TYPE="tool_error"
    ACTOR="agent"
    [ -z "$SUMMARY" ] && SUMMARY="${TOOL_NAME:-Tool} failed: $ERROR_MSG"
    [ -z "$CONTENT" ] && CONTENT="$ERROR_MSG"
    ;;
  PreInvocation)
    # Internal model invocations are noisy; only log when explicit user prompt content is present
    [ -z "$CONTENT" ] && exit 0
    EVENT_TYPE="user_request"
    ACTOR="human"
    [ -z "$SUMMARY" ] && SUMMARY="$CONTENT"
    ;;
  PostInvocation)
    exit 0
    ;;
  Stop)
    EVENT_TYPE="task_termination"
    ACTOR="system"
    [ -z "$SUMMARY" ] && SUMMARY="Task stopped: ${TERMINATION_REASON:-finished}"
    [ -z "$CONTENT" ] && CONTENT="Termination reason: ${TERMINATION_REASON:-none}"
    ;;
  ManualEntry)
    EVENT_TYPE="$(extract_field eventType)"
    ACTOR="$(extract_field actor)"
    [ -z "$ACTOR" ] && ACTOR="human"
    [ -z "$SUMMARY" ] && SUMMARY="$CONTENT"
    [ -z "$CONTENT" ] && CONTENT="$SUMMARY"
    CAPTURE_STATUS="manual"
    ;;
  *)
    EVENT_TYPE="$(extract_field eventType)"
    [ -z "$EVENT_TYPE" ] && EVENT_TYPE="unknown"
    ACTOR="$(extract_field actor)"
    [ -z "$ACTOR" ] && ACTOR="unknown"
    [ -z "$SUMMARY" ] && SUMMARY="$CONTENT"
    [ -z "$CONTENT" ] && CONTENT="$SUMMARY"
    ;;
esac

# Redactions
redact() {
  printf '%s' "$1" | sed \
    -e 's/[Pp]assword[[:space:]]*=[[:space:]]*[^ "]*/password=***REDACTED***/g' \
    -e 's/[Tt]oken[[:space:]]*=[[:space:]]*[^ "]*/token=***REDACTED***/g' \
    -e 's/[Ss]ecret[[:space:]]*=[[:space:]]*[^ "]*/secret=***REDACTED***/g' \
    -e 's/[Aa]uthorization[[:space:]]*:[[:space:]]*[^ "]*/Authorization: ***REDACTED***/g' \
    -e 's/Bearer [A-Za-z0-9._-]*/Bearer ***REDACTED***/g' \
    -e 's/[Aa]pi[_-][Kk]ey[[:space:]]*=[[:space:]]*[^ "]*/api_key=***REDACTED***/g' \
    -e 's/ChangeMe123!/***REDACTED***/g'
}

TOOL_NAME="$(redact "$TOOL_NAME")"
COMMAND_LINE="$(redact "$COMMAND_LINE")"
FILE_REF="$(redact "$FILE_REF")"
CONTENT="$(redact "$CONTENT")"
SUMMARY="$(redact "$SUMMARY")"
ERROR_MSG="$(redact "$ERROR_MSG")"
TERMINATION_REASON="$(redact "$TERMINATION_REASON")"

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' ' | tr '\t' ' '
}

TOOL_NAME_ESC="$(json_escape "$TOOL_NAME")"
COMMAND_LINE_ESC="$(json_escape "$COMMAND_LINE")"
FILE_REF_ESC="$(json_escape "$FILE_REF")"
CONTENT_ESC="$(json_escape "$CONTENT")"
SUMMARY_ESC="$(json_escape "$SUMMARY")"
ERROR_MSG_ESC="$(json_escape "$ERROR_MSG")"
TERMINATION_REASON_ESC="$(json_escape "$TERMINATION_REASON")"

[ -z "$CAPTURE_STATUS" ] && CAPTURE_STATUS="auto"

LOG_ENTRY="{\"eventId\":\"$EVENT_ID\",\"timestamp\":\"$TIMESTAMP\",\"sessionId\":\"$CONVERSATION_ID\",\"actor\":\"$ACTOR\",\"eventType\":\"$EVENT_TYPE\",\"toolName\":\"$TOOL_NAME_ESC\",\"stepIdx\":\"$ID_SUFFIX\",\"commandLine\":\"$COMMAND_LINE_ESC\",\"fileChanged\":\"$FILE_REF_ESC\",\"content\":\"$CONTENT_ESC\",\"summary\":\"$SUMMARY_ESC\",\"error\":\"$ERROR_MSG_ESC\",\"terminationReason\":\"$TERMINATION_REASON_ESC\",\"modelName\":\"$MODEL_NAME\",\"captureStatus\":\"$CAPTURE_STATUS\"}"

LOCK_DIR="$LOG_DIR/.lock"
LOCK_ACQUIRED=0

for attempt in 1 2 3 4 5; do
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    LOCK_ACQUIRED=1
    break
  fi
  sleep 0.05 2>/dev/null || sleep 1
done

printf '%s\n' "$LOG_ENTRY" >> "$LOG_FILE"
touch "$DEDUP_FILE" 2>/dev/null || true

if [ "$LOCK_ACQUIRED" -eq 1 ]; then
  rmdir "$LOCK_DIR" 2>/dev/null || true
fi

exit 0
