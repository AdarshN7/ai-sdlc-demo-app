#!/bin/sh
# log-manual-entry.sh — Record a manual interaction log entry.
#
# Usage:
#   sh log-manual-entry.sh \
#     --event-type "human_decision" \
#     --actor "human" \
#     --content "Approved the bulk approval feature design" \
#     --summary "Design approval for UC-1" \
#     --session-id "optional-session-id"
#
# This script creates a ManualEntry payload and pipes it to interaction-logger.sh.
# Used by the interaction-audit skill for events that hooks cannot capture:
#   - User prompts (summary only)
#   - Assistant responses (summary only)
#   - Human decisions (accept/reject/modify)
#   - Sub-agent task summaries

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOGGER="$SCRIPT_DIR/interaction-logger.sh"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

EVENT_TYPE=""
ACTOR=""
CONTENT=""
SUMMARY=""
SESSION_ID=""

while [ $# -gt 0 ]; do
  case "$1" in
    --event-type)  EVENT_TYPE="$2";  shift 2 ;;
    --actor)       ACTOR="$2";       shift 2 ;;
    --content)     CONTENT="$2";     shift 2 ;;
    --summary)     SUMMARY="$2";     shift 2 ;;
    --session-id)  SESSION_ID="$2";  shift 2 ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Validate required fields
# ---------------------------------------------------------------------------

if [ -z "$EVENT_TYPE" ]; then
  echo "Error: --event-type is required" >&2
  echo "Valid types: human_decision, prompt_summary, response_summary, task_summary" >&2
  exit 1
fi

if [ -z "$ACTOR" ]; then
  ACTOR="human"
fi

# Generate a unique step index for manual entries.
# Include event type and nanosecond-precision timestamp to avoid collisions.
MANUAL_STEP="m$(date +%s)-${EVENT_TYPE}-$$"

# Use "manual" capture status to distinguish from auto-captured events
CAPTURE_STATUS="manual"

# ---------------------------------------------------------------------------
# Build and send payload
# ---------------------------------------------------------------------------

# Escape double quotes in content and summary for JSON safety
escape_json_value() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

CONTENT_ESC="$(escape_json_value "$CONTENT")"
SUMMARY_ESC="$(escape_json_value "$SUMMARY")"

PAYLOAD=$(cat <<EOF
{"hookType":"ManualEntry","eventType":"$EVENT_TYPE","actor":"$ACTOR","content":"$CONTENT_ESC","summary":"$SUMMARY_ESC","conversationId":"$SESSION_ID","stepIdx":"$MANUAL_STEP","captureStatus":"$CAPTURE_STATUS"}
EOF
)

printf '%s' "$PAYLOAD" | sh "$LOGGER"

echo "Logged: [$EVENT_TYPE] $SUMMARY"
