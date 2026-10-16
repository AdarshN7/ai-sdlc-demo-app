---
name: interaction-audit
description: >-
  Use this skill when you need to record a human decision, summarize a user
  prompt, summarize an assistant response, or log any interaction event that
  the automatic hooks cannot capture. Activate this skill whenever you
  complete a significant task, the user makes a design decision, or you need
  to document an uncaptured interaction for the AI interaction log.
---

# Interaction Audit Skill

This skill documents how to record AI interaction events that the Antigravity
IDE lifecycle hooks **cannot** automatically capture.

## What Is Automatically Captured

The hooks in [hooks.json](../hooks.json) automatically log:

- **Tool executions** — tool name, arguments, step index, file paths, commands
- **Tool completions** — success/failure, error messages
- **Model invocations** — invocation number, start/end
- **Task termination** — reason, idle state

These events are marked with `"captureStatus": "auto"` in the log.

## What Requires Manual Logging

The hook payloads do **not** expose:

1. **User prompts** — the text the human typed
2. **Assistant final responses** — the model's reply text
3. **Human decisions** — accept/reject/modify actions
4. **Sub-agent task summaries** — what a spawned sub-agent accomplished

These must be recorded using the manual entry script below.

---

## How to Record a Manual Entry

Run the script from the repository root:

```bash
sh .agents/scripts/log-manual-entry.sh \
  --event-type "<type>" \
  --actor "<actor>" \
  --content "<full text or details>" \
  --summary "<one-line summary>" \
  --session-id "<optional conversation id>"
```

### Event Types

| `--event-type` | `--actor` | When to Use |
|---|---|---|
| `prompt_summary` | `human` | Summarize what the user asked |
| `response_summary` | `agent` | Summarize the agent's response (since full text is not in hooks) |
| `human_decision` | `human` | Record an accept, reject, or modify decision |
| `task_summary` | `agent` | Summarize a completed task or sub-agent work |

### Examples

**Record a user prompt summary:**
```bash
sh .agents/scripts/log-manual-entry.sh \
  --event-type "prompt_summary" \
  --actor "human" \
  --summary "Asked agent to implement bulk approval endpoint"
```

**Record a human decision:**
```bash
sh .agents/scripts/log-manual-entry.sh \
  --event-type "human_decision" \
  --actor "human" \
  --content "Accepted the proposed ApprovalService changes with minor naming fix" \
  --summary "Approved bulk approval service implementation"
```

**Record an assistant response summary:**
```bash
sh .agents/scripts/log-manual-entry.sh \
  --event-type "response_summary" \
  --actor "agent" \
  --summary "Created BulkApprovalController with POST endpoint and tests"
```

**Record a sub-agent task summary:**
```bash
sh .agents/scripts/log-manual-entry.sh \
  --event-type "task_summary" \
  --actor "agent" \
  --summary "Sub-agent completed Playwright E2E test for login flow"
```

---

## Where the Log Lives

- **Log file**: `.ai-sdlc/interaction-log.jsonl` (repository root)
- **Format**: One JSON object per line (JSONL)
- **Dedup cache**: `.ai-sdlc/.seen-events/` (temporary, gitignored)
- **Lock file**: `.ai-sdlc/.lock/` (temporary, gitignored)

## Inspecting the Log

```bash
# View all entries
cat .ai-sdlc/interaction-log.jsonl

# Pretty-print (if python3 available)
python3 -m json.tool --no-ensure-ascii < .ai-sdlc/interaction-log.jsonl

# Count entries by event type
grep -o '"eventType":"[^"]*"' .ai-sdlc/interaction-log.jsonl | sort | uniq -c

# Show only human decisions
grep '"human_decision"' .ai-sdlc/interaction-log.jsonl

# Validate JSONL (each line must be valid JSON)
while IFS= read -r line; do
  echo "$line" | python3 -m json.tool > /dev/null 2>&1 || echo "INVALID: $line"
done < .ai-sdlc/interaction-log.jsonl
```

## Privacy Policy

The logger automatically redacts:
- Passwords (`password=...`)
- Tokens (`token=...`, `Bearer ...`)
- Secrets (`secret=...`)
- API keys (`api_key=...`, `api-key=...`)
- Known demo credentials (`ChangeMe123!`)

Manual entries should **never** include real credentials, tokens, or PII.

## Capture Status Field

Every log entry includes a `captureStatus` field:

| Value | Meaning |
|---|---|
| `auto` | Captured automatically by lifecycle hooks |
| `manual` | Entered via the manual logging script or skill |

This makes it clear which entries are verbatim hook data vs. human-written summaries.
