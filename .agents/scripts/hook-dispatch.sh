#!/bin/sh
# hook-dispatch.sh — Thin dispatcher for Antigravity lifecycle hooks.
#
# Usage: echo '<hook_payload>' | sh hook-dispatch.sh <hookType>
#
# Reads the hook payload from stdin, injects the hookType field,
# and pipes to interaction-logger.sh.
#
# This indirection keeps hooks.json clean (one script, parameterized)
# and avoids duplicating the logging logic.

set -e

HOOK_TYPE="${1:-unknown}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOGGER="$SCRIPT_DIR/interaction-logger.sh"

# Read the full stdin payload
PAYLOAD="$(cat)"

if [ -z "$PAYLOAD" ]; then
  PAYLOAD="{}"
fi

# Inject hookType into the payload by prepending it.
# This works because JSON parsers use the last occurrence of duplicate keys,
# but our sed-based parser uses the first — so prepend is correct.
ENRICHED=$(printf '{"hookType":"%s",%s' "$HOOK_TYPE" "$(echo "$PAYLOAD" | sed 's/^{//')")

# Forward to the logger
printf '%s' "$ENRICHED" | sh "$LOGGER" "$HOOK_TYPE"

# Return the expected output for each hook type
case "$HOOK_TYPE" in
  PreToolUse)
    # Allow all tool executions (don't gate anything)
    printf '{"decision":"allow"}'
    ;;
  PostToolUse)
    printf '{}'
    ;;
  PreInvocation)
    printf '{}'
    ;;
  PostInvocation)
    printf '{}'
    ;;
  Stop)
    printf '{"decision":"stop"}'
    ;;
  *)
    printf '{}'
    ;;
esac
