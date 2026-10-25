---
description: "Use when reviewing pull requests or proposed code changes in this invoice approval app."
applyTo: "**"
---

# Pull Request Review Guidelines

- Report only actionable issues introduced by the changes. Prioritize correctness, authorization, security, invoice lifecycle rules, and API contract regressions.
- Verify role restrictions, state transitions, and error handling against the existing domain and route-handler conventions.
- Include the affected file and line, explain the concrete impact, and suggest a minimal fix for each finding.
- Do not report style preferences, speculative risks, or missing tests unless they expose a specific regression.
- If no actionable issues are found, say so clearly.
