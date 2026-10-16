#!/bin/sh
# interaction-logger.sh — Append-only JSONL interaction logger for Antigravity IDE hooks.
#
# Usage: echo '{"hookType":"PreToolUse",...}' | sh interaction-logger.sh
#
# This script is invoked by Antigravity lifecycle hooks. It reads a JSON
# payload from stdin, enriches it with a timestamp and event ID, redacts
# secrets, and appends a single JSON line to the interaction log.
#
# Dependencies: Only POSIX sh + grep + sed + tr. No jq required.

set -e

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$REPO_ROOT/.ai-sdlc"
LOG_FILE="$LOG_DIR/interaction-log.jsonl"
DEDUP_DIR="$LOG_DIR/.seen-events"

mkdir -p "$LOG_DIR" "$DEDUP_DIR"

# ---------------------------------------------------------------------------
# Read stdin payload
# ---------------------------------------------------------------------------

PAYLOAD="$(cat)"

if [ -z "$PAYLOAD" ]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Extract fields from JSON payload using grep/sed (no jq dependency).
# Uses grep -o to isolate "key":"value" pairs from single-line JSON.
# ---------------------------------------------------------------------------

extract_field() {
  printf '%s' "$PAYLOAD" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed "s/\"$1\"[[:space:]]*:[[:space:]]*\"//;s/\"$//"
}

extract_number() {
  printf '%s' "$PAYLOAD" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*[0-9][0-9]*" | head -1 | sed "s/\"$1\"[[:space:]]*:[[:space:]]*//"
}

HOOK_TYPE="$(extract_field hookType)"
CONVERSATION_ID="$(extract_field conversationId)"
MODEL_NAME="$(extract_field modelName)"
TOOL_NAME="$(extract_field name)"
STEP_IDX="$(extract_number stepIdx)"
INVOCATION_NUM="$(extract_number invocationNum)"
EXECUTION_NUM="$(extract_number executionNum)"
TERMINATION_REASON="$(extract_field terminationReason)"
ERROR_MSG="$(extract_field error)"

# ---------------------------------------------------------------------------
# Generate event ID and timestamp
# ---------------------------------------------------------------------------

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# For manual entries, stepIdx is a string (e.g. "m1729064147"), not a number.
# Fall back to extracting it as a string field when extract_number fails.
STEP_IDX_STR="$(extract_field stepIdx)"
ID_SUFFIX="${STEP_IDX:-${STEP_IDX_STR:-${INVOCATION_NUM:-${EXECUTION_NUM:-0}}}}"
EVENT_ID="${CONVERSATION_ID:-unknown}-${HOOK_TYPE:-unknown}-${ID_SUFFIX}"

# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

DEDUP_FILE="$DEDUP_DIR/$EVENT_ID"
if [ -f "$DEDUP_FILE" ]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Determine event type and extract tool-specific fields
# ---------------------------------------------------------------------------

case "$HOOK_TYPE" in
  PreToolUse)
    EVENT_TYPE="tool_execution_start"
    ACTOR="agent"
    COMMAND_LINE="$(extract_field CommandLine)"
    TARGET_FILE="$(extract_field TargetFile)"
    TARGET_FILE_ALT="$(extract_field AbsolutePath)"
    FILE_REF="${TARGET_FILE:-$TARGET_FILE_ALT}"
    ;;
  PostToolUse)
    EVENT_TYPE="tool_execution_end"
    ACTOR="agent"
    COMMAND_LINE=""
    FILE_REF=""
    ;;
  PreInvocation)
    EVENT_TYPE="model_invocation_start"
    ACTOR="system"
    COMMAND_LINE=""
    FILE_REF=""
    ;;
  PostInvocation)
    EVENT_TYPE="model_invocation_end"
    ACTOR="system"
    COMMAND_LINE=""
    FILE_REF=""
    ;;
  Stop)
    EVENT_TYPE="task_termination"
    ACTOR="system"
    COMMAND_LINE=""
    FILE_REF=""
    ;;
  ManualEntry)
    EVENT_TYPE="$(extract_field eventType)"
    ACTOR="$(extract_field actor)"
    COMMAND_LINE=""
    FILE_REF=""
    ;;
  *)
    EVENT_TYPE="unknown"
    ACTOR="unknown"
    COMMAND_LINE=""
    FILE_REF=""
    ;;
esac

CONTENT="$(extract_field content)"
SUMMARY="$(extract_field summary)"
CAPTURE_STATUS="$(extract_field captureStatus)"

# ---------------------------------------------------------------------------
# Redact secrets and sensitive values
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# Escape for safe JSON embedding (BSD-sed compatible, no GNU extensions)
# ---------------------------------------------------------------------------

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

# ---------------------------------------------------------------------------
# Build JSON log entry
# ---------------------------------------------------------------------------

if [ -z "$CAPTURE_STATUS" ]; then
  CAPTURE_STATUS="auto"
fi

LOG_ENTRY="{\"eventId\":\"$EVENT_ID\",\"timestamp\":\"$TIMESTAMP\",\"sessionId\":\"$CONVERSATION_ID\",\"actor\":\"$ACTOR\",\"eventType\":\"$EVENT_TYPE\",\"toolName\":\"$TOOL_NAME_ESC\",\"stepIdx\":\"$ID_SUFFIX\",\"commandLine\":\"$COMMAND_LINE_ESC\",\"fileChanged\":\"$FILE_REF_ESC\",\"content\":\"$CONTENT_ESC\",\"summary\":\"$SUMMARY_ESC\",\"error\":\"$ERROR_MSG_ESC\",\"terminationReason\":\"$TERMINATION_REASON_ESC\",\"modelName\":\"$MODEL_NAME\",\"captureStatus\":\"$CAPTURE_STATUS\"}"

# ---------------------------------------------------------------------------
# Append to log file (atomic-ish write with directory-based lock)
# ---------------------------------------------------------------------------

LOCK_DIR="$LOG_DIR/.lock"
LOCK_ACQUIRED=0

for attempt in 1 2 3 4 5; do
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    LOCK_ACQUIRED=1
    break
  fi
  sleep 0.1 2>/dev/null || sleep 1
done

if [ "$LOCK_ACQUIRED" -eq 1 ]; then
  printf '%s\n' "$LOG_ENTRY" >> "$LOG_FILE"
  touch "$DEDUP_FILE"
  rmdir "$LOCK_DIR" 2>/dev/null || true
else
  printf '%s\n' "$LOG_ENTRY" >> "$LOG_FILE"
  touch "$DEDUP_FILE"
fi

exit 0
