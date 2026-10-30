# AI in SDLC Assignment: Role-Based Invoice Approval Limits

**Author:** Adarsh Nishad

**Repository:** [AdarshN7/ai-sdlc-demo-app](https://github.com/AdarshN7/ai-sdlc-demo-app)

**Feature:** Role based approval limits and two approvers for high value invoices

**Stack:** Next.js 14 App Router, TypeScript, Vitest, Playwright, StrykerJS, OpenSpec

## 1. Overview

This assignment implements role based approval limits in the invoice approval service. This file collects the requirements, design, implementation evidence, specification, tests, mutation results, review findings, AI setup, run instructions, limitations, and remaining deliverables.

**Rules:** A Manager may approve invoices up to 50,000 inclusive. A Director may approve invoices up to 500,000 inclusive as sole approver. An invoice above 500,000 needs two distinct approvers, and the second must be a Director (the implementation also permits Admin for the second approval). Distinctness compares stable user IDs carried through login and sessions; usernames and roles are not identity keys. A rejected attempt returns a clear standardized reason and message and changes nothing about the invoice.

**Assumptions:** The two limits are inclusive; for amounts over 500,000 the first approver may be Manager, Director, or Admin; the implementation marks the invoice `PartiallyApproved` after the first approval; amounts are numeric currency values and may be decimal because the application does not enforce integer-only values. No currency conversion is implemented. The checked-in OpenSpec delta spec describes the first high-value approval as transitioning from `PendingApproval` to `PartiallyApproved`.

## 2. Deliverables checklist

|   # | Deliverable                                              | Where to find it                                                                                                                                                                                                                                                                                                                                                                             |
| --: | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | PR with at least three standalone implementation commits | [Total PRs: 9](https://github.com/AdarshN7/ai-sdlc-demo-app/pulls) \| [Closed PRs](https://github.com/AdarshN7/ai-sdlc-demo-app/pulls?q=is%3Apr+state%3Aclosed)                                                                                                                                                                                                                              |
|   2 | Updated agent instructions                               | [`AGENTS.md`](AGENTS.md)                                                                                                                                                                                                                                                                                                                                                                     |
|   3 | OpenSpec: Specification artifacts                        | `openspec/changes/approval-limits/{proposal.md,design.md,specs/approval-limits/spec.md,tasks.md}`                                                                                                                                                                                                                                                                                            |
|   4 | Unit tests for all rules, including both negative rules  | `tests/unit/approval-limits-step1.test.ts`, `tests/unit/approval-limits-step2.test.ts`                                                                                                                                                                                                                                                                                                       |
|   5 | Playwright test for rejected over-limit approval         | `e2e/tests/app.spec.ts`                                                                                                                                                                                                                                                                                                                                                                      |
|   6 | Mutation scores before and after hardening               | `docs/mutation/before.txt`, `docs/mutation/after.txt`                                                                                                                                                                                                                                                                                                                                        |
|   7 | PR description with every review finding and verdict     | `docs/pull-request-description.md`                                                                                                                                                                                                                                                                                                                                                           |
|   8 | AI interaction log                                       | `.ai-sdlc/interaction-log.jsonl`                                                                                                                                                                                                                                                                                                                                                             |
|   9 | Assignment write-up                                      | `ASSIGNMENT.md`                                                                                                                                                                                                                                                                                                                                                                              |
|  10 | Demo video link (8–10 minute)                            | [SharePoint demo](https://nagarro-my.sharepoint.com/:v:/p/adarsh_nishad/IQB6jBdTbAQTR4h4ktDyaUFQAZwdRZHWrCDhOUTE--jP3Ek?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D&e=KUSdKP) \| [YouTube demo](https://youtu.be/zLCP96YUih0?si=QcW8l4_XqvpLx4ae) |

## 3. Key decisions

| Decision               | Options considered                                     | Choice                                                                                                     | Why                                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language and framework | Reference repo is .NET; brief permits another language | Next.js 14 App Router and TypeScript                                                                       | Gives one TypeScript full stack, with API Route Handlers and a server enforced domain layer.                                                                                                                                                                          |
| Architecture           | Rules in UI/routes or domain layer                     | Pure `src/domain`; repository interface; in-memory implementation on `globalThis`; Route Handlers; thin UI | Keeps business rules testable without React or HTTP and makes the server authoritative.                                                                                                                                                                               |
| Redux                  | Redux client state or server-side decisions            | Not used                                                                                                   | Redux was not needed for this feature; approval enforcement belongs on the server. State lives in memory and resets on process restart. `POST /api/test/reset` supports test isolation and returns 404 in production unless `ALLOW_TEST_RESET=true`.                  |
| Rejection handling     | Mutate then roll back, or validate before persistence  | Validate first and save only on success                                                                    | A failed domain result becomes `ApprovalRejectedError`; repository update occurs only after successful evaluation, preserving state.                                                                                                                                  |
| Specification tool     | OpenSpec or an alternative spec workflow               | OpenSpec (`@fission-ai/openspec`)                                                                          | OpenSpec setup and change commands are captured in `.ai-sdlc/interaction-log.jsonl`. The change proposal, design, delta spec, and task breakdown are checked in.                                                                                                      |
| AI tool                | GitHub Copilot or another AI development environment   | Google Antigravity, primarily using Gemini 3.8 Flash Medium according to the interaction log               | Antigravity extension in VS code used as AI agent in this project and was selected in the OpenSpec tool setup. The log also contains two Claude Opus 4 entries, so this documents the primary environment/model, not exclusive model use. Antigravity is not Copilot. |
| Testing stack          | .NET Stryker pin or JavaScript stack                   | Vitest, Playwright, StrykerJS                                                                              | The current application is TypeScript; `.NET Stryker` settings do not apply. Stryker uses the Vitest runner and mutates `src/domain/**/*.ts`.                                                                                                                         |

## 4. Architecture and repository layout

```text
src/domain/                 Entities, pure approval rules, service, repository interface
src/infrastructure/         In-memory repository, auth/session, HTTP error mapping
src/app/api/                Next.js Route Handlers
src/app/                    App Router page, layout, global CSS
src/components/              UI components (where present)
tests/unit/                  Domain unit tests
tests/integration/           API, auth, error mapping tests
e2e/pages/                   Playwright page objects
e2e/tests/                   Playwright user workflows
docs/                        Use cases, cold/context notes, mutation output, PR description
openspec/                    Configuration, approval change proposal/design/delta spec/task breakdown
.agents/                     OpenSpec/interaction skills, hook definitions and scripts
.ai-sdlc/interaction-log.jsonl JSONL interaction history
```

The `openspec/` folder contains `config.yaml` and the approval change's `.openspec.yaml`, `proposal.md`, `design.md`, `tasks.md`, and delta spec. There is no synced main spec under `openspec/specs/`; the checked-in change artifacts do include a task breakdown.

| Technology                           | Purpose in architecture                   | Key considerations                                                                                |
| ------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Next.js 14 App Router / React 18     | UI pages and server-side Route Handlers   | Rules stay in `src/domain`; handlers authenticate, orchestrate, and map errors.                   |
| TypeScript 5                         | Application and domain language           | Shared types across API and domain; no .NET runtime or Redux layer.                               |
| Vitest 2                             | Domain unit and API integration tests     | `npm test` runs five files and covers boundary and rejection behavior.                            |
| Playwright                           | Browser end-to-end tests                  | `npm run test:e2e` starts a production server on port 3001; local socket binding is required.     |
| StrykerJS 10 with Vitest runner      | Mutation testing for `src/domain/**/*.ts` | Score depends on current source/test set; archived before/after outputs and the fresh run differ. |
| OpenSpec                             | Feature specification workflow            | Config, proposal, design, delta spec, and task breakdown are checked in for this change.          |
| In-memory repository on `globalThis` | Demo persistence                          | Process restart resets state; not durable or multi-instance safe.                                 |

`POST /api/approvals/[id]/approve` authenticates a session with one of `Approver`, `Admin`, `Manager`, or `Director`; passes the session's stable `userId`, username, and role to `ApprovalService`; evaluates the approval in the domain; persists only a successful result; and maps errors through `handleApiError`. Demo users have explicit IDs in `src/infrastructure/auth/user-session.ts`, and login includes the ID in the session. Duplicate approval checks compare only `ApproverIdentity.id` against stored `InvoiceApproval.userId`. Domain rejection codes map to HTTP 422.

| Reason code                    | Meaning                                                          |
| ------------------------------ | ---------------------------------------------------------------- |
| `LIMIT_EXCEEDED`               | Amount is above the role’s single-approver limit.                |
| `SAME_APPROVER`                | This user ID already appears in prior approvals.                 |
| `SECOND_APPROVER_NOT_DIRECTOR` | Second approver is neither Director nor Admin in implementation. |
| `ROLE_NOT_ALLOWED`             | The role cannot perform this approval.                           |
| `INVOICE_NOT_PENDING`          | Invoice is not `PendingApproval` or `PartiallyApproved`.         |

## 5. How the AI was set up

### `AGENTS.md` sections

| Section                                | One-line content                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| Layout & Folder Map                    | Layer boundaries and locations for app, domain, tests, docs, logs, and agents.        |
| The 5 Business Rules & Approval Limits | Inclusive ceilings, dual approval, distinct user IDs, and atomic rejection.           |
| Standardized Rejection Reason Codes    | Canonical codes and meanings.                                                         |
| Conventions & Layering                 | Pure domain logic, validation-first ordering, API/auth/repository expectations.       |
| Commands                               | Dev, Vitest, Playwright, Stryker, and lint commands.                                  |
| Test Expectations                      | Boundary matrix, named negative tests, deep equality, and route integration contract. |
| Review Expectations & Rubric           | Review axes and required Fixed/Dismissed/Deferred verdicts.                           |
| Commit Rules                           | One atomic step per commit and message format.                                        |
| Demo accounts                          | Local-only roles for demo/testing.                                                    |
| Never                                  | No secrets, weakened tests, premature mutation, or business logic in UI/routes.       |

### Cold versus context

The identical Step 1 prompt and comparative notes are in `docs/cold-vs-context.md`. It reports that the cold run put checks in the route handler, used magic numbers/ad-hoc errors, and had shallow tests; the context run used pure domain evaluation, named inclusive constants, standardized `LIMIT_EXCEEDED`, validate-before-save sequencing, and boundary/deep-equality tests. The notes contain illustrative code comparisons and concrete reported differences. Separate cold-run and context-run transcripts or repository patches were not retained, so the examples should be treated as documented observations rather than replayable raw output.

### Skills

| Skill                     | Location                                                                                      | Purpose                                                      | Trigger                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `interaction-audit`       | `.agents/skills/interaction-audit/SKILL.md`                                                   | Explain/manual-log interaction events not captured by hooks. | Significant task, human decision, response/sub-agent summary missing from hooks. |
| `openspec-propose`        | `.agents/skills/openspec-propose/SKILL.md` (also `.claude` and `.github` skill copies)        | Create proposal/spec/tasks in experimental flow.             | New feature/change request.                                                      |
| `openspec-explore`        | `.agents/skills/openspec-explore/SKILL.md` (also `.claude` and `.github` skill copies)        | Investigate and clarify an idea.                             | Explore request before/during proposal.                                          |
| `openspec-apply-change`   | `.agents/skills/openspec-apply-change/SKILL.md` (also `.claude` and `.github` skill copies)   | Implement tasks from an OpenSpec change.                     | Apply/continue implementation.                                                   |
| `openspec-update-change`  | `.agents/skills/openspec-update-change/SKILL.md` (also `.claude` and `.github` skill copies)  | Revise planning artifacts, not code.                         | Requirements or plan change.                                                     |
| `openspec-sync-specs`     | `.agents/skills/openspec-sync-specs/SKILL.md` (also `.claude` and `.github` skill copies)     | Sync delta spec to main specs.                               | Sync request.                                                                    |
| `openspec-archive-change` | `.agents/skills/openspec-archive-change/SKILL.md` (also `.claude` and `.github` skill copies) | Finalize/archive completed change.                           | Archive request after implementation.                                            |

The OpenSpec skill copies also exist under `.claude`, `.github`, and `.agents`; `.agents/skills/.openspec-target` is the selection marker.

### Hooks and interaction log

`.agents/hooks.json` registers `PreInvocation`, `PreToolUse`, `PostToolUse`, and `Stop`, dispatched by `.agents/scripts/hook-dispatch.sh` to `.agents/scripts/interaction-logger.sh` and its Python logger. Tool starts, failures, prompts, and task termination are recorded in `.ai-sdlc/interaction-log.jsonl`; successful tool completion chatter and passive reads are filtered. Entries are JSONL with `captureStatus` `auto` or `manual`. Example actual entry:

```json
{
  "eventId": "test-final-PreToolUse-1",
  "timestamp": "2026-10-16T07:53:49Z",
  "sessionId": "test-final",
  "actor": "agent",
  "eventType": "tool_execution_start",
  "toolName": "run_command",
  "stepIdx": "1",
  "commandLine": "dotnet test backend/InvoiceApp.sln",
  "fileChanged": "",
  "content": "dotnet test backend/InvoiceApp.sln",
  "summary": "Run: dotnet test backend/InvoiceApp.sln",
  "error": "",
  "terminationReason": "",
  "modelName": "claude-opus-4",
  "captureStatus": "auto"
}
```

An earlier inspection recorded 413 lines: 367 tool starts, 1 tool completion/error event, 11 task terminations, 8 prompt summaries, 8 user requests, 5 response summaries, 11 task summaries, and 2 human decisions. Most recorded model entries were `gemini-3.8-flash-medium` (383) with two `claude-opus-4` entries. These are historical counts; the log grows with future sessions. The hooks recorded this audit and the repository's manual-entry script appended a completion summary.

### Agents and sub-agents

| Name                                  | Role                                                                                                                | Allowed files                                                                                 | Forbidden files                 | Output                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| Documentation agent (this assignment) | Assemble verified project evidence                                                                                  | `ASSIGNMENT.md`, `README.md`, `docs/pull-request-description.md`, and interaction-log summary | Application logic and tests     | Final documentation and evidence-gap list                                      |
| Historical implementation agent       | The interaction log identifies Gemini 3.8 Flash Medium in most tool events; Antigravity was the primary environment | Repository files and tools used by logged sessions; exact per-agent allowlist not recorded    | Per-agent denylist not recorded | Implementation commits and artifacts listed in 7; no per-agent output manifest |
| Browser sub-agent                     | One `browser_subagent` invocation is present in the log; the task role is not described beyond the tool name        | Not recorded                                                                                  | Not recorded                    | Invocation is logged; result/artifact mapping is not recorded                  |
| Other sub-agents                      | No additional named sub-agent roster found                                                                          | Not recorded                                                                                  | Not recorded                    | Not recorded                                                                   |

## 6. Specification

**Tool:** OpenSpec; configuration at `openspec/config.yaml` (`schema: spec-driven`), dependency `@fission-ai/openspec` in `package.json`.

**Commands recorded in the interaction log:** `npm install -D @fission-ai/openspec`; `npx openspec init --tools antigravity,claude,github-copilot,agents --no-animation`; `npx openspec new change approval-limits`; `npx openspec status --change approval-limits`; `npx openspec instructions proposal --change approval-limits`; `npx openspec instructions specs --change approval-limits`; `npx openspec instructions design --change approval-limits`; `npx openspec instructions tasks --change approval-limits`; `npx openspec validate --strict approval-limits`. Help, templates, and intermediate validation commands also appear in `.ai-sdlc/interaction-log.jsonl`. Workflow definitions are in `.agents/workflows/opsx-*.md` and `.agents/skills/openspec-*/SKILL.md`.

**Files actually present:** `openspec/config.yaml`, `openspec/changes/approval-limits/.openspec.yaml`, `proposal.md`, `design.md`, `tasks.md`, and `specs/approval-limits/spec.md`. The delta spec and task breakdown are present in the change. No synced main spec exists under `openspec/specs/` (that directory contains only `.gitkeep`).

`docs/cold-vs-context.md` records manual boundary, reason-code, immutability, and high-value workflow refinements. It reports that the context run corrected route-layer logic, magic numbers, ad-hoc errors, and shallow tests. The document contains illustrative comparisons, not original run transcripts or patches; it does not establish exactly which generated test case a human corrected.

| Rule                                                  | Spec scenario                                                                                                                                 | Unit test name                                                                                                                                                                                                                                                                                                 | E2E                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Manager/Director limits and boundaries                | “Boundary test matrix execution”; “Manager approves invoice at or below limit”; “Director approves invoice at or below single-approver limit” | Step 1 suite: `Manager approves 49,999 (below limit)`, `Manager approves 50,000 (exact inclusive limit)`, `Manager rejected for 50,001 (exceeds limit by 1)`, `Manager rejected for 499,999`, `Manager rejected for 500,000`, `Director cannot sole-approve 500,001...`; corresponding Director boundary tests | Manager rejection at $75,000 in `e2e/tests/app.spec.ts`               |
| First high-value approval and final Director approval | “First approval on high-value invoice by Manager or Director”; “Second approval on high-value invoice by Director”                            | Step 2: `1st approval by Manager leaves invoice partially approved awaiting second approver`; `1st approval by Director leaves invoice partially approved awaiting second approver`; `2nd approval by distinct Director marks it Approved`                                                                     | None                                                                  |
| Same user cannot approve twice by ID                  | “Same user attempts second approval on high-value invoice”                                                                                    | `rejects with SAME_APPROVER when the same user attempts second approval`; `validates distinctness using userId, not display name or role`                                                                                                                                                                      | None                                                                  |
| Non-Director cannot be second approver                | “Non-director user attempts second approval on high-value invoice”                                                                            | `rejects with SECOND_APPROVER_NOT_DIRECTOR when second approver is a Manager`                                                                                                                                                                                                                                  | None                                                                  |
| Rejection immutability / state eligibility / role     | “Rejected attempt preserves deep equality of invoice”; “Attempting to approve an invoice that is not pending”                                 | Step 1: `Preserves deep equality of invoice on Manager limit rejection`; Step 2 same-user and non-Director tests snapshot and deep-compare input; plus invalid-role/non-pending tests                                                                                                                          | E2E verifies status remains pending in queue, table, and after reload |

The checked-in design, delta spec, and task breakdown contain the scenarios, reason codes, and implementation tasks aligned with the implemented status transitions and eligible roles.

## 7. Development steps

The following are relevant feature and deliverable commits in chronological order; automated interaction-log-only commits and merge commits are omitted. Commit IDs/messages come from `git log`. The current `docs-update` branch also has four commits beyond `origin/main` (`a00678a`, `6d7d0f1`, `2f7e4ad`, `505119c`); their messages describe the documentation/ESLint updates but do not include an explicit why clause.

### Specification and mutation tooling

- **Commit:** `ad85a0a` — “feat: add Stryker mutation testing config, expand approval roles, and update UI demo accounts”
- **Changed/why:** Adds mutation-test configuration and role/demo support needed to exercise approval rules; the message states the changes but not an explicit why clause.
- **Commit:** `ca12e6c` — “chore: initialize OpenSpec CLI tooling and agent skills”
- **Changed/why:** Sets up OpenSpec and agent workflow files so the approval work can follow a spec workflow; no explicit why clause in the message.
- **Commit:** `7f6f830` — “feat(spec): add approval limits spec and task breakdown”
- **Changed/why:** Adds the approval change proposal, design, delta spec, and tasks; these files are present in the current checkout. The message describes the change but does not include an explicit why clause.

### Step 1 — single-approver limits

- **Commit:** `c4648c93d937c02b0b1d59cdc2d03bc5614431aa` — “Enforce manager and director approval limits”
- **Changed/why:** Added pure approval limits, service integration, route error mapping, and boundary/integration tests. Establishes Step 1 before Step 2.
- **Prompt:** Summarized from OpenSpec task 1: implement Manager/Director thresholds and rejection contract.
- **Correction:** The cold/context report describes route-layer logic, magic constants, and weak tests as cold-run failures; context implementation uses the domain layer and tests. No separate correction note tied to this exact commit was found.
- **Verification:** Commit task checklist records `npm test` and route integration checks; current run passed 80 tests.

### Step 2 — two distinct approvers

- **Commit:** `8c713ca8305a964639ac9e07237624b74f510920` — “Require two distinct approvers above 500,000”
- **Changed/why:** Adds approvals tracking and high-value two-approver evaluation with duplicate-ID and second-role rejection.
- **Prompt:** Summarized from OpenSpec task 2: >500,000 requires two distinct approvals; second approver Director.
- **Correction:** `AGENTS.md` requires user-ID comparison; tests exercise distinct users with the same role and duplicate IDs. The original prompt summary is recoverable from the OpenSpec Step 2 task; a verbatim transcript was not retained.
- **Verification:** Step 2 unit/integration tests are present; current `npm test` passed.

### Partially approved items in UI

- **Commit:** `61a71e6677dba31da4e819fff79d8adb828048bb` — “feat: show partially approved invoices in pending approvals list”
- **Changed/why:** Makes the first high-value approval visible as waiting for its second approver.
- **Prompt/correction:** The commit and adjacent approval workflow describe the intended UI behavior. No separate prompt or correction transcript is retained.
- **Verification:** UI workflows and unit/integration suites; current unit/integration run passed.

### Mutation hardening

- **Commit:** `a8b31385e5c62db17bc7a19ddd575477b392fd51` — “Harden approval tests after mutation run”
- **Changed/why:** Strengthened tests after initial Stryker survivors; see before/after artifacts in 10.
- **Prompt:** Address uncovered/surviving mutants after Step 2.
- **What was corrected:** Added stronger identity, validation, boundary, and invariant assertions; the after run records 232 killed and 0 survivors/no-coverage.
- **Verification:** The recorded after artifact reports 232 killed, 0 survivors/no coverage. A fresh run after the stable-ID follow-up is 214/215 killed with 0 survivors and 1 no-coverage display-name fallback mutant; see 8 and 10.

### AI constraints and cold/context notes

- **Commit:** `3568b35885a8ae3e9ae8aacd913e157158b11ddf` — “docs: expand AGENTS.md with approval rules and add cold-vs-context evidence”
- **Changed/why:** Added project-specific rules and comparative notes used to constrain and evaluate AI output.
- **Prompt/correction/verification:** The prompt is summarized by the commit message and the notes in `docs/cold-vs-context.md`; exact per-commit transcript and correction attribution were not retained.

### Rejected over-limit E2E

- **Commit:** `24de9456eaf8c8f419e9201f243728763f36d9ef` — “Add E2E test for rejected over-limit approval. Why: verify Manager over-limit rejection, UI error display, and state immutability across page reloads”
- **Changed/why:** Adds the Playwright scenario, reset guard configuration, UI reason display, and page object selectors.
- **Prompt:** Summarized from commit message: verify Manager’s $75,000 rejection and persistent unchanged state.
- **Correction:** PR description records reset endpoint production guard and status text locator corrections in this commit.
- **Verification:** Current E2E run passed 7/7 after `npm run build`.

### Assignment write-up

- **Commit:** `121bc1e3662d1047f231882cb55ce440a0d47cd0` — “Add ASSIGNMENT.md with write-up, Stryker scores, and review triage. Why: deliver complete assignment documentation, cold-vs-context audit, and review findings table”
- **Changed/why:** Added the first assignment write-up and PR description.
- **Correction:** The PR narrative refers to a demo script file that is absent. Current documentation includes the supplied SharePoint and YouTube links, but their reachability and the recording duration could not be independently verified.
- **Verification:** Current deliverables and command outcomes are recorded in this file; this specific new write-up has not been independently linted.

### Follow-up implementation and specification commit

- **Commit:** `a5bae3e534457cc73e978eabf256b188d9b38fe8` — “feat: implement dual-approval workflow for invoices over 500,000”
- **Changed/why:** The commit changes approval identity propagation to stable user IDs, strengthens deep-equality and identity tests, and updates OpenSpec text to describe the implemented high-value workflow. The why is inferred from those changes and the earlier rules: make duplicate detection use stable identity and keep rejected attempts atomic. The spec planning files it changed are no longer in the current tree.
- **Verification:** Current tests and route code confirm stable-ID propagation and rejection immutability; the committed OpenSpec files are present and align the first approval status and second-approver eligibility with implementation.

### Demo and documentation follow-ups

- **Commit:** `3d0bbde` — “docs: remove demo video script section from assignment and update interaction log”; removes the script section, explaining why the PR narrative's script link is stale.
- **Commit:** `1e58c70` — “docs: update README with comprehensive architecture, business rules, and project layout”; documents the migrated app and its architecture.
- **Commit:** `2e65819` — “docs: enhance demo video script with detailed production guidance and recording steps”; the script was later outside the current checkout.
- **Commit:** `0c9b179` — “feat: add user request for updating demo video script and AI agent details”; adds the recorded follow-up request to the project history.

### Current documentation branch commits (after `origin/main`)

| Hash      | Commit message                                                                   | Change and reason                                                                                                             |
| --------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `a00678a` | `docs: update assignment and README to include author information`               | Adds author attribution to the deliverables.                                                                                  |
| `6d7d0f1` | `docs: fix links and improve formatting in cold vs context evaluation document`  | Repairs links and formatting so the context comparison is readable.                                                           |
| `2f7e4ad` | `chore: add eslint and eslint-config-next for code quality`                      | Adds the lint packages used by the Next.js repository; lint remains unconfigured and was not run for this documentation pass. |
| `505119c` | `docs: update ASSIGNMENT.md to improve table formatting and clarity of findings` | Improves table readability and review-finding explanations.                                                                   |

These messages state the change but do not each state the rationale explicitly. None of the four current-branch commit messages satisfies the requested “what + why” format.

### Implementation and specification follow-up (current worktree)

- **Changes recorded in the interaction history:** Added deep-equality assertions to rejection tests and stable IDs to users/sessions; the current source and tests support these claims. The commit also corrects the OpenSpec design/proposal/spec/task text, which is present in the current checkout.
- **Why:** Enforces `AGENTS.md`'s ID-only distinctness and atomic-rejection expectations, removes documentation drift, and preserves username only for display/audit while using the stable ID for identity.
- **Prompt summary:** User asked to complete the implementation and then update this assignment.
- **Review correction:** The PR narrative's finding 1 says `requireAuth` guarantees a valid `userId` before approval. Inspection showed `requireAuth` only validates that a session exists and its role is allowed; the prior session model carried only username and role. The follow-up now explicitly creates and propagates `userId`; a unit test checks stable ID use and an integration test checks IDs through two approvals. The PR narrative remains a historical review record and its old finding verdict has not been rewritten as a commit-based resolution.
- **Verification:** `npm test` 80/80; `npm run build` passed; strict OpenSpec validation passed; `git diff --check` passed. This review reran Playwright and Stryker against the stable-ID changes; see the final checklist for their results. The prior headed Playwright result was 7/7 before the stable-ID follow-up.
- **Commit:** Not committed in this worktree.

**Commit count note:** These are separate commits, and feature Step 1 precedes Step 2.

## 8. How to set up, run and test

### Prerequisites

- Node.js **v24.19.0** and npm **11.17.0** were present during this run. The README documents Node.js 18.17+ or Node.js 20+; CI uses Node 20.
- Install Playwright Chromium once: `cd e2e && npx playwright install chromium && cd ..`.

### Commands, in order

```bash
npm install
npm --prefix e2e install
cd e2e && npx playwright install chromium && cd ..
npm run dev
```

The dev server opens at `http://localhost:3000`. In another terminal, run:

```bash
npm test
npm run build
npm run test:e2e
npm --prefix e2e run test:headed
npm run mutate
npm run lint
```

`npm run test:e2e` starts the production server on port 3001, so it needs a build first. E2E test execution requires local port binding; the sandboxed attempt failed with `EPERM` binding `0.0.0.0:3001`, then succeeded when run with local server permission.

### Outcomes observed during this assignment run

| Command                            | Result                                                                                                                                                                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                           | Passed: installed 542 root packages from the lockfile.                                                                                                                                                                                                         |
| `npm test`                         | Passed: 5 files, 80 tests.                                                                                                                                                                                                                                     |
| `npm run build` (E2E prerequisite) | Passed: Next.js compiled, type checking and static generation completed.                                                                                                                                                                                       |
| `npm run test:e2e`                 | Passed after stable-ID changes: 7 Playwright tests. The sandboxed attempt failed on `EPERM`; approved local server run passed.                                                                                                                                 |
| `npm --prefix e2e run test:headed` | Passed: 7 Playwright tests in headed Chromium mode.                                                                                                                                                                                                            |
| `npm run mutate`                   | Fresh run passed: 99.53% mutation score, 214 killed, 0 survived, 1 no coverage. The no-coverage mutant changes only the display-name fallback from `'unknown'` to an empty string. Historical checked-in after output is a separate 232-mutant run at 100.00%. |
| `npm run lint`                     | Did not complete. Next.js opened its first-run ESLint configuration prompt because the repository has no ESLint config. Adding lint configuration is outside this approval-rule implementation follow-up.                                                      |

The `npm ci`, `npm test`, `npm run mutate`, and `npm run test:e2e` commands above were run for this documentation pass. Stryker and Playwright initially failed to bind local sockets in the sandbox (`EPERM`); both passed after approved reruns that allowed the required local ports. The fresh mutation summary, copied from that command output, is:

```text
All files               |  99.53 |  100.00 |      214 |         0 |          0 |        1 |        0 |
 approval-limits.ts     |  99.22 |  100.00 |      128 |         0 |          0 |        1 |        0 |
 approval-service.ts    | 100.00 |  100.00 |       56 |         0 |          0 |        0 |        0 |
 discount-calculator.ts | 100.00 |  100.00 |       29 |         0 |          0 |        0 |        0 |
 errors.ts              | 100.00 |  100.00 |        1 |         0 |          0 |        0 |        0 |
```

The before/after files preserve earlier output: **82.04% (201 killed, 19 survived, 25 no coverage)** before hardening and **100.00% (232 killed, 0 survived, 0 no coverage)** after that hardening. The archived after score is not the result of the fresh run; both values are retained with their run context. The fresh run has no surviving mutants. Its one no-coverage mutation is the fallback display string in `src/domain/approval-limits.ts`, not a missed approval-rule mutant.

**Troubleshooting:** If dev server port 3000 or Playwright port 3001 is occupied, stop the process using it or change the configured port and URL together. If Chromium is missing, run the Playwright install command above. Stryker may need local port binding for its logging server. In-memory state resets on server restart; use `POST /api/test/reset` in local/test mode for deterministic fixtures (production returns 404 unless explicitly enabled).

## 9. Testing strategy

| Rule / amount       | Expected behavior                                               | Tests                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 49,999              | Manager and Director approve                                    | Step 1: `Manager approves 49,999 (below limit)` and `Director approves 49,999 (below limit)`                                                          |
| 50,000              | Manager and Director approve inclusive limit                    | Step 1: `Manager approves 50,000 (exact inclusive limit)` and Director exact Manager limit test                                                       |
| 50,001              | Manager rejected `LIMIT_EXCEEDED`; Director approves            | Step 1 Manager rejection and Director within Director limit tests                                                                                     |
| 499,999             | Manager rejected; Director approves                             | Step 1 tests for both roles                                                                                                                           |
| 500,000             | Manager rejected; Director approves inclusive limit             | Step 1 tests for both roles                                                                                                                           |
| 500,001             | One approval is not final; distinct eligible approvers required | Step 1 `Director cannot sole-approve 500,001...`; Step 2 first approval, second Director tests                                                        |
| Same user twice     | `SAME_APPROVER`, compare ID                                     | Step 2 `rejects with SAME_APPROVER when the same user attempts second approval`; also `validates distinctness using userId, not display name or role` |
| Non-Director second | `SECOND_APPROVER_NOT_DIRECTOR`                                  | Step 2 `rejects with SECOND_APPROVER_NOT_DIRECTOR when second approver is a Manager`                                                                  |

**Review of generated tests:** `docs/cold-vs-context.md` reports that a context-free generation produced shallow HTTP-status checks without boundary cases or immutability assertions. The contextual implementation added the boundary matrix, reason-code checks, and deep-equality assertions mapped above. The report has no raw transcripts or generated-test patch, so a specific agent-authored test and its human correction cannot be independently identified from repository evidence.

**Playwright rejection scenario:** `e2e/tests/app.spec.ts` signs in as `demo.manager`, attempts to approve `INV-1002` ($75,000), checks the `LIMIT_EXCEEDED` code and readable message, verifies the pending status in the queue and invoice table, reloads, and verifies the state remained pending. The full E2E run passed 7/7.
| Invalid role/status | `ROLE_NOT_ALLOWED` / `INVOICE_NOT_PENDING` | Step 1 invalid-role and non-pending tests; Step 2 unauthorized first approver test |

### Negative rules and unchanged state

The rejection tests now snapshot and deep-compare invoice state for limit failures at 50,001, 499,999, and 500,000; invalid status and role; duplicate user ID variants; and non-Director second approval. Service integration tests compare repository snapshots immediately after `LIMIT_EXCEEDED`, `SAME_APPROVER`, and `SECOND_APPROVER_NOT_DIRECTOR`; route integration checks repository equality after limit, duplicate-user, and non-Director rejection. General service rejection tests also verify stored invoice equality for invalid lifecycle/reason cases.

### Playwright rejected-over-limit flow

The test `Manager is rejected when attempting to approve over-limit invoice ($75,000)` in `e2e/tests/app.spec.ts` posts `/api/test/reset`, signs in as Manager, opens Approvals, attempts `INV-1002`, checks the `#approval-error` / `data-testid="approval-error"` alert contains `LIMIT_EXCEEDED` and the Manager limit message, verifies pending status in queue and invoices table, reloads, and verifies the server state remains pending. Other relevant selectors include `#user-switcher`, approval buttons named by invoice ID, and table row/cell accessible names. Reset is called directly by Playwright’s request fixture before the workflow. The endpoint has a production guard.

### Review of generated tests

The cold/context notes describe shallow cold-run tests that missed boundaries, standardized reason codes, and immutability. The initial Step 2 Stryker run captured 19 surviving and 25 no-coverage mutants; commit `a8b3138` hardened tests, yielding 0 survivors and 0 no-coverage mutants. The interaction log records an agent task summary for the hardening phase, but does not label authorship per assertion or line.

## 10. Mutation testing

`stryker.config.json` uses `@stryker-mutator/vitest-runner`, mutates `src/domain/**/*.ts`, and reports clear text, HTML, and JSON. Command: `npm run mutate`.

“Before” means the recorded run on unreviewed agent-generated tests after Step 2; “after” means the recorded run after test hardening. The checked-in text reports are pasted below in full, with terminal color control codes removed for plain-text readability.

### Before output (`docs/mutation/before.txt`)

```text

> ai-sdlc-demo-app@1.0.0 mutate
> stryker run

19:34:03 (31702) WARN ProjectReader Glob pattern "!src/**/*.test.ts" did not exclude any files.
19:34:03 (31702) INFO ProjectReader Found 6 of 1201 file(s) to be mutated.
19:34:03 (31702) INFO Instrumenter Instrumented 6 source file(s) with 245 mutant(s)
19:34:04 (31702) INFO ConcurrencyTokenProvider Creating 9 test runner process(es).
19:34:04 (31702) INFO DryRunExecutor Starting initial test run (vitest test runner with "perTest" coverage analysis). This may take a while.
19:34:05 (31702) INFO DryRunExecutor Initial test run succeeded. Ran 62 tests in 0 seconds (net 18.563126000000125 ms, overhead 572.4368739999999 ms).

All tests
  integration/api-routes.test.ts
    ✘ API Route Handlers Integration Auth Routes login returns 200 with token and role for valid credentials [line 48] (covered 0)
    ✘ API Route Handlers Integration Auth Routes login returns 401 for invalid credentials [line 60] (covered 0)
    ✘ API Route Handlers Integration Auth Routes login returns 200 with Manager and Director roles [line 70] (covered 0)
    ✘ API Route Handlers Integration Auth Routes logout returns 204 and clears session [line 88] (covered 0)
    ~ API Route Handlers Integration Invoices Routes GET /api/invoices requires authentication [line 97] (covered 1)
    ✘ API Route Handlers Integration Invoices Routes GET /api/invoices returns all seed invoices for authenticated user [line 103] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes GET /api/invoices filters by status [line 111] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes GET /api/invoices returns 400 for unknown status [line 119] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes POST /api/invoices validates required customer name [line 127] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes POST /api/invoices validates amount > 0 [line 138] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes POST /api/invoices creates a new draft invoice [line 149] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes GET /api/invoices/[id] returns invoice if found or 404 [line 164] (covered 0)
    ~ API Route Handlers Integration Invoices Routes DELETE /api/invoices/[id] returns 403 for non-Admin [line 174] (covered 1)
    ✘ API Route Handlers Integration Invoices Routes DELETE /api/invoices/[id] returns 204 for Admin [line 180] (covered 0)
    ✓ API Route Handlers Integration Approvals Routes POST /api/invoices/[id]/submit moves draft to PendingApproval [line 192] (killed 8)
    ✓ API Route Handlers Integration Approvals Routes POST /api/invoices/[id]/submit returns 409 if invoice is not Draft [line 200] (killed 3)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve approves pending invoice [line 208] (killed 28)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve returns 422 with LIMIT_EXCEEDED when Manager approves over 50k and leaves repo invoice unchanged [line 218] (killed 14)
    ~ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve returns 200 when Manager approves invoice <= 50k [line 236] (covered 54)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve returns 200 when Director approves invoice <= 500k [line 246] (killed 7)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices [line 256] (killed 32)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/reject requires non-empty reason [line 295] (killed 7)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/reject rejects pending invoice with reason [line 306] (killed 7)
    ✘ API Route Handlers Integration Test Reset Route POST /api/test/reset restores default seed invoices and counter [line 321] (covered 0)
    ✘ API Route Handlers Integration Test Reset Route POST /api/test/reset returns 404 when NODE_ENV is production [line 339] (covered 0)
  unit
    approval-limits-step1.test.ts
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Manager approves 49,999 (below limit) [line 25] (covered 40)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 49,999 (below limit) [line 36] (covered 44)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Manager approves 50,000 (exact inclusive limit) [line 47] (killed 1)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 50,000 (exact Manager limit) [line 58] (covered 44)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Manager rejected for 50,001 (exceeds limit by 1) [line 68] (covered 40)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 50,001 (within Director limit) [line 78] (covered 44)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Manager rejected for 499,999 [line 88] (covered 40)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 499,999 [line 98] (covered 44)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Manager rejected for 500,000 [line 108] (killed 1)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 500,000 (exact inclusive limit) [line 118] (covered 44)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director cannot sole-approve 500,001 to Approved status (held for dual approval) [line 129] (covered 45)
      ✘ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Exports expected constants: MANAGER_APPROVAL_LIMIT is 50,000 and DIRECTOR_APPROVAL_LIMIT is 500,000 [line 140] (covered 0)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Deep Equality & Immutability when Validation Fails Preserves deep equality of invoice on Manager limit rejection [line 147] (covered 40)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Deep Equality & Immutability when Validation Fails Preserves deep equality of invoice on duplicate Director approval rejection [line 157] (covered 47)
      ~ Phase 4: Step 1 - Single-Approver Role Limits ApprovalService Integration throws ApprovalRejectedError with reason LIMIT_EXCEEDED when Manager approves over 50,000 [line 175] (covered 61)
      ~ Phase 4: Step 1 - Single-Approver Role Limits ApprovalService Integration successfully approves when Manager approves invoice <= 50,000 [line 197] (covered 54)
      ~ Phase 4: Step 1 - Single-Approver Role Limits ApprovalService Integration successfully approves when Director approves invoice <= 500,000 [line 210] (covered 58)
      ~ Phase 4: Step 1 - Single-Approver Role Limits ApprovalService Integration throws ApprovalRejectedError with reason SAME_APPROVER when Director approves > 500,000 twice [line 223] (covered 86)
    approval-limits-step2.test.ts
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) First Approval on High-Value Invoices (> 500,000) 1st approval by Manager leaves invoice partially approved awaiting second approver [line 22] (killed 10)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) First Approval on High-Value Invoices (> 500,000) 1st approval by Director leaves invoice partially approved awaiting second approver [line 40] (killed 1)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval by distinct Director marks it Approved [line 60] (killed 15)
      ~ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval completes approval when 1st approver was a Manager [line 91] (covered 61)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 1: Duplicate Approver (SAME_APPROVER) rejects with SAME_APPROVER when the same user attempts second approval [line 119] (killed 6)
      ~ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 1: Duplicate Approver (SAME_APPROVER) validates distinctness using userId, not display name or role [line 146] (covered 47)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 2: Non-Director Second Approver (SECOND_APPROVER_NOT_DIRECTOR) rejects with SECOND_APPROVER_NOT_DIRECTOR when second approver is a Manager [line 174] (killed 4)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) ApprovalService Integration for High-Value Invoices executes the full dual-approval workflow via ApprovalService [line 203] (killed 13)
    approval-service.test.ts
      ~ ApprovalService Submit_MovesDraftToPendingApproval [line 19] (covered 10)
      ✓ ApprovalService Submit_RejectsInvoiceThatIsNotADraft [line 26] (killed 1)
      ✓ ApprovalService Approve_SetsStatusApproverAndTimestamp [line 32] (killed 1)
      ✓ ApprovalService Approve_RejectsInvoiceThatIsStillADraft [line 41] (killed 9)
      ✓ ApprovalService Approve_ThrowsWhenInvoiceDoesNotExist [line 47] (killed 2)
      ✓ ApprovalService Reject_RecordsReasonAndApprover [line 53] (killed 1)
      ✓ ApprovalService Reject_RequiresAReason [line 63] (killed 1)
    discount-calculator.test.ts
      ✓ DiscountCalculator calculates quantity discount tiers [line 7] (killed 13)
      ✓ DiscountCalculator calculates loyalty discount capped at 10% [line 17] (killed 3)
      ✓ DiscountCalculator calculates combined discount with optional nonprofit bonus [line 23] (killed 8)
      ✓ DiscountCalculator applies discount correctly with rounding [line 28] (killed 5)

[NoCoverage] StringLiteral
src/domain/approval-limits.ts:40:58
-     const approverId = approver.id || approver.username || 'unknown';
+     const approverId = approver.id || approver.username || "";

[NoCoverage] StringLiteral
src/domain/approval-limits.ts:41:60
-     const approverName = approver.username || approver.id || 'unknown';
+     const approverName = approver.username || approver.id || "";

[NoCoverage] ConditionalExpression
src/domain/approval-limits.ts:57:56
-         if (role !== 'Manager' && role !== 'Director' && role !== 'Admin') {
+         if (role !== 'Manager' && role !== 'Director' && true) {

[NoCoverage] EqualityOperator
src/domain/approval-limits.ts:57:56
-         if (role !== 'Manager' && role !== 'Director' && role !== 'Admin') {
+         if (role !== 'Manager' && role !== 'Director' && role === 'Admin') {

[NoCoverage] StringLiteral
src/domain/approval-limits.ts:57:65
-         if (role !== 'Manager' && role !== 'Director' && role !== 'Admin') {
+         if (role !== 'Manager' && role !== 'Director' && role !== "") {

[NoCoverage] BlockStatement
src/domain/approval-limits.ts:57:74
-         if (role !== 'Manager' && role !== 'Director' && role !== 'Admin') {
-           return {
-             ok: false,
-             reason: 'ROLE_NOT_ALLOWED',
-             message: `Role ${role} is not permitted to approve invoices.`,
-           };
-         }
+         if (role !== 'Manager' && role !== 'Director' && role !== 'Admin') {}

[NoCoverage] ObjectLiteral
src/domain/approval-limits.ts:58:16
-           return {
-             ok: false,
-             reason: 'ROLE_NOT_ALLOWED',
-             message: `Role ${role} is not permitted to approve invoices.`,
-           };
+           return {};

[NoCoverage] BooleanLiteral
src/domain/approval-limits.ts:59:15
-             ok: false,
+             ok: true,

[NoCoverage] StringLiteral
src/domain/approval-limits.ts:60:19
-             reason: 'ROLE_NOT_ALLOWED',
+             reason: "",

[NoCoverage] StringLiteral
src/domain/approval-limits.ts:61:20
-             message: `Role ${role} is not permitted to approve invoices.`,
+             message: ``,

[NoCoverage] ConditionalExpression
src/domain/approval-limits.ts:126:37
-     } else if (role === 'Director' || role === 'Admin') {
+     } else if (role === 'Director' || false) {

[NoCoverage] EqualityOperator
src/domain/approval-limits.ts:126:37
-     } else if (role === 'Director' || role === 'Admin') {
+     } else if (role === 'Director' || role !== 'Admin') {

[NoCoverage] StringLiteral
src/domain/approval-limits.ts:126:46
-     } else if (role === 'Director' || role === 'Admin') {
+     } else if (role === 'Director' || role === "") {

[NoCoverage] BlockStatement
src/domain/approval-limits.ts:128:10
-     } else {
-       return {
-         ok: false,
-         reason: 'ROLE_NOT_ALLOWED',
-         message: `Role ${role} is not permitted to approve invoices.`,
-       };
-     }
+     } else {}

[NoCoverage] ObjectLiteral
src/domain/approval-limits.ts:129:12
-       return {
-         ok: false,
-         reason: 'ROLE_NOT_ALLOWED',
-         message: `Role ${role} is not permitted to approve invoices.`,
-       };
+       return {};

[NoCoverage] BooleanLiteral
src/domain/approval-limits.ts:130:11
-         ok: false,
+         ok: true,

[NoCoverage] StringLiteral
src/domain/approval-limits.ts:131:15
-         reason: 'ROLE_NOT_ALLOWED',
+         reason: "",

[NoCoverage] StringLiteral
src/domain/approval-limits.ts:132:16
-         message: `Role ${role} is not permitted to approve invoices.`,
+         message: ``,

[Survived] StringLiteral
src/domain/approval-limits.ts:35:16
-         message: `Invoice ${invoice.id} is ${invoice.status}; only pending invoices can be approved.`,
+         message: ``,
Tests ran:
    ApprovalService Approve_RejectsInvoiceThatIsStillADraft


[Survived] ConditionalExpression
src/domain/approval-limits.ts:57:11
-         if (role !== 'Manager' && role !== 'Director' && role !== 'Admin') {
+         if (false) {
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) First Approval on High-Value Invoices (> 500,000) 1st approval by Manager leaves invoice partially approved awaiting second approver
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) First Approval on High-Value Invoices (> 500,000) 1st approval by Director leaves invoice partially approved awaiting second approver
  and 3 more tests!


[Survived] ConditionalExpression
src/domain/approval-limits.ts:82:12
-             (approver.id && a.userId === approver.id) ||
+             (false) ||
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval by distinct Director marks it Approved
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval completes approval when 1st approver was a Manager
  and 2 more tests!


[Survived] LogicalOperator
src/domain/approval-limits.ts:81:11
-             a.userId === approverId ||
-             (approver.id && a.userId === approver.id) ||
+             a.userId === approverId && approver.id && a.userId === approver.id ||
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval by distinct Director marks it Approved
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval completes approval when 1st approver was a Manager
  and 6 more tests!


[Survived] ConditionalExpression
src/domain/approval-limits.ts:81:11
-             a.userId === approverId ||
+             false ||
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval by distinct Director marks it Approved
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval completes approval when 1st approver was a Manager
  and 6 more tests!


[Survived] ConditionalExpression
src/domain/approval-limits.ts:83:12
-             (approver.username && a.userId === approver.username)
+             (false)
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval by distinct Director marks it Approved
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval completes approval when 1st approver was a Manager
  and 2 more tests!


[Survived] MethodExpression
src/domain/approval-limits.ts:79:30
-         const isSameApprover = priorApprovals.some(
-           (a) =>
-             a.userId === approverId ||
-             (approver.id && a.userId === approver.id) ||
-             (approver.username && a.userId === approver.username)
-         );
+         const isSameApprover = priorApprovals.every(a => a.userId === approverId || approver.id && a.userId === approver.id || approver.username && a.userId === approver.username);
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval by distinct Director marks it Approved
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval completes approval when 1st approver was a Manager
  and 6 more tests!


[Survived] ConditionalExpression
src/domain/approval-limits.ts:94:34
-         if (role !== 'Director' && role !== 'Admin') {
+         if (role !== 'Director' && true) {
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 2: Non-Director Second Approver (SECOND_APPROVER_NOT_DIRECTOR) rejects with SECOND_APPROVER_NOT_DIRECTOR when second approver is a Manager
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) ApprovalService Integration for High-Value Invoices executes the full dual-approval workflow via ApprovalService


[Survived] StringLiteral
src/domain/approval-limits.ts:89:20
-             message: 'The same user cannot approve an invoice twice.',
+             message: "",
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 1: Duplicate Approver (SAME_APPROVER) rejects with SAME_APPROVER when the same user attempts second approval
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 1: Duplicate Approver (SAME_APPROVER) validates distinctness using userId, not display name or role
  and 3 more tests!


[Survived] StringLiteral
src/domain/approval-limits.ts:94:43
-         if (role !== 'Director' && role !== 'Admin') {
+         if (role !== 'Director' && role !== "") {
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 2: Non-Director Second Approver (SECOND_APPROVER_NOT_DIRECTOR) rejects with SECOND_APPROVER_NOT_DIRECTOR when second approver is a Manager
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) ApprovalService Integration for High-Value Invoices executes the full dual-approval workflow via ApprovalService


[Survived] StringLiteral
src/domain/approval-limits.ts:98:20
-             message: 'Second approval requires a Director.',
+             message: "",
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 2: Non-Director Second Approver (SECOND_APPROVER_NOT_DIRECTOR) rejects with SECOND_APPROVER_NOT_DIRECTOR when second approver is a Manager
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) ApprovalService Integration for High-Value Invoices executes the full dual-approval workflow via ApprovalService


[Survived] ConditionalExpression
src/domain/approval-limits.ts:126:14
-     } else if (role === 'Director' || role === 'Admin') {
+     } else if (true) {
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve returns 200 when Director approves invoice <= 500k
    Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 49,999 (below limit)
    Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 50,000 (exact Manager limit)
  and 4 more tests!


[Survived] ArrayDeclaration
src/domain/approval-limits.ts:142:16
-       approvals: [...priorApprovals, newApproval],
+       approvals: [],
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve approves pending invoice
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve returns 200 when Manager approves invoice <= 50k
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve returns 200 when Director approves invoice <= 500k
  and 10 more tests!


[NoCoverage] StringLiteral
src/domain/approval-service.ts:43:59
-               username: approver.username || approver.id || 'unknown',
+               username: approver.username || approver.id || "",

[NoCoverage] StringLiteral
src/domain/approval-service.ts:45:44
-               role: approver.role ?? role ?? 'Approver',
+               role: approver.role ?? role ?? "",

[NoCoverage] ConditionalExpression
src/domain/approval-service.ts:86:49
-       if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') {
+       if (invoice.status !== 'PendingApproval' && true) {

[NoCoverage] EqualityOperator
src/domain/approval-service.ts:86:49
-       if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') {
+       if (invoice.status !== 'PendingApproval' && invoice.status === 'PartiallyApproved') {

[NoCoverage] StringLiteral
src/domain/approval-service.ts:86:68
-       if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') {
+       if (invoice.status !== 'PendingApproval' && invoice.status !== "") {

[NoCoverage] BlockStatement
src/domain/approval-service.ts:86:89
-       if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') {
-         throw new ConflictError(
-           `Invoice ${invoice.id} is ${invoice.status}; only pending invoices can be decided.`
-         );
-       }
+       if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') {}

[NoCoverage] StringLiteral
src/domain/approval-service.ts:88:9
-           `Invoice ${invoice.id} is ${invoice.status}; only pending invoices can be decided.`
+           ``

[Survived] ConditionalExpression
src/domain/approval-service.ts:44:17
-               id: approver.id || approver.username,
+               id: false,
Tests ran:
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) ApprovalService Integration for High-Value Invoices executes the full dual-approval workflow via ApprovalService


[Survived] LogicalOperator
src/domain/approval-service.ts:44:17
-               id: approver.id || approver.username,
+               id: approver.id && approver.username,
Tests ran:
    Phase 5: Step 2 – Two-Approver Rule (> 500,000) ApprovalService Integration for High-Value Invoices executes the full dual-approval workflow via ApprovalService


[Survived] CallExpression
src/domain/approval-service.ts:67:5
-       this.ensurePending(invoice);
+       ;
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/reject rejects pending invoice with reason
    ApprovalService Reject_RecordsReasonAndApprover


[Survived] StringLiteral
src/domain/approval-service.ts:80:31
-         throw new NotFoundError(`Invoice ${invoiceId} was not found.`);
+         throw new NotFoundError(``);
Tests ran:
    ApprovalService Approve_ThrowsWhenInvoiceDoesNotExist


[Survived] BlockStatement
src/domain/approval-service.ts:85:49
-     private ensurePending(invoice: Invoice): void {
-       if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') {
-         throw new ConflictError(
-           `Invoice ${invoice.id} is ${invoice.status}; only pending invoices can be decided.`
-         );
-       }
-     }
+     private ensurePending(invoice: Invoice): void {}
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/reject rejects pending invoice with reason
    ApprovalService Reject_RecordsReasonAndApprover


[Survived] ConditionalExpression
src/domain/approval-service.ts:86:9
-       if (invoice.status !== 'PendingApproval' && invoice.status !== 'PartiallyApproved') {
+       if (false) {
Tests ran:
    API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/reject rejects pending invoice with reason
    ApprovalService Reject_RecordsReasonAndApprover


Ran 1.81 tests per mutant on average.
------------------------|------------------|----------|-----------|------------|----------|----------|
                        | % Mutation score |          |           |            |          |          |
File                    |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
------------------------|--------|---------|----------|-----------|------------|----------|----------|
All files               |  82.04 |   91.36 |      201 |         0 |         19 |       25 |        0 |
 approval-limits.ts     |  78.62 |   89.76 |      114 |         0 |         13 |       18 |        0 |
 approval-service.ts    |  81.43 |   90.48 |       57 |         0 |          6 |        7 |        0 |
 discount-calculator.ts | 100.00 |  100.00 |       29 |         0 |          0 |        0 |        0 |
 errors.ts              | 100.00 |  100.00 |        1 |         0 |          0 |        0 |        0 |
------------------------|--------|---------|----------|-----------|------------|----------|----------|
19:34:11 (31702) INFO JsonReporter Your report can be found at: file:///Users/adarsh.nishad/Workspace/NAGP/ai-sdlc-demo-app/reports/mutation/mutation.json
19:34:11 (31702) INFO HtmlReporter Your report can be found at: file:///Users/adarsh.nishad/Workspace/NAGP/ai-sdlc-demo-app/reports/mutation/mutation.html
19:34:11 (31702) INFO MutationTestExecutor Done in 7 seconds.
```

### After output (`docs/mutation/after.txt`)

```text

> ai-sdlc-demo-app@1.0.0 mutate
> stryker run

19:43:06 (40099) WARN ProjectReader Glob pattern "!src/**/*.test.ts" did not exclude any files.
19:43:06 (40099) INFO ProjectReader Found 6 of 1212 file(s) to be mutated.
19:43:06 (40099) INFO Instrumenter Instrumented 6 source file(s) with 232 mutant(s)
19:43:07 (40099) INFO ConcurrencyTokenProvider Creating 9 test runner process(es).
19:43:07 (40099) INFO DryRunExecutor Starting initial test run (vitest test runner with "perTest" coverage analysis). This may take a while.
19:43:08 (40099) INFO DryRunExecutor Initial test run succeeded. Ran 80 tests in 0 seconds (net 18.13991699999997 ms, overhead 576.860083 ms).

All tests
  integration/api-routes.test.ts
    ✘ API Route Handlers Integration Auth Routes login returns 200 with token and role for valid credentials [line 48] (covered 0)
    ✘ API Route Handlers Integration Auth Routes login returns 401 for invalid credentials [line 60] (covered 0)
    ✘ API Route Handlers Integration Auth Routes login returns 200 with Manager and Director roles [line 70] (covered 0)
    ✘ API Route Handlers Integration Auth Routes logout returns 204 and clears session [line 88] (covered 0)
    ~ API Route Handlers Integration Invoices Routes GET /api/invoices requires authentication [line 97] (covered 1)
    ✘ API Route Handlers Integration Invoices Routes GET /api/invoices returns all seed invoices for authenticated user [line 103] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes GET /api/invoices filters by status [line 111] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes GET /api/invoices returns 400 for unknown status [line 119] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes POST /api/invoices validates required customer name [line 127] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes POST /api/invoices validates amount > 0 [line 138] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes POST /api/invoices creates a new draft invoice [line 149] (covered 0)
    ✘ API Route Handlers Integration Invoices Routes GET /api/invoices/[id] returns invoice if found or 404 [line 164] (covered 0)
    ~ API Route Handlers Integration Invoices Routes DELETE /api/invoices/[id] returns 403 for non-Admin [line 174] (covered 1)
    ✘ API Route Handlers Integration Invoices Routes DELETE /api/invoices/[id] returns 204 for Admin [line 180] (covered 0)
    ✓ API Route Handlers Integration Approvals Routes POST /api/invoices/[id]/submit moves draft to PendingApproval [line 192] (killed 8)
    ✓ API Route Handlers Integration Approvals Routes POST /api/invoices/[id]/submit returns 409 if invoice is not Draft [line 200] (killed 3)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve approves pending invoice [line 208] (killed 23)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve returns 422 with LIMIT_EXCEEDED when Manager approves over 50k and leaves repo invoice unchanged [line 218] (killed 12)
    ~ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve returns 200 when Manager approves invoice <= 50k [line 236] (covered 55)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve returns 200 when Director approves invoice <= 500k [line 246] (killed 8)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/approve supports two-approver rule for > 500k invoices [line 256] (killed 29)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/reject requires non-empty reason [line 295] (killed 8)
    ✓ API Route Handlers Integration Approvals Routes POST /api/approvals/[id]/reject rejects pending invoice with reason [line 306] (killed 4)
    ✘ API Route Handlers Integration Test Reset Route POST /api/test/reset restores default seed invoices and counter [line 321] (covered 0)
    ✘ API Route Handlers Integration Test Reset Route POST /api/test/reset returns 404 when NODE_ENV is production [line 339] (covered 0)
  unit
    approval-limits-step1.test.ts
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Manager approves 49,999 (below limit) [line 25] (killed 10)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 49,999 (below limit) [line 39] (covered 45)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Manager approves 50,000 (exact inclusive limit) [line 53] (killed 1)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 50,000 (exact Manager limit) [line 66] (covered 45)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Manager rejected for 50,001 (exceeds limit by 1) [line 78] (killed 2)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 50,001 (within Director limit) [line 89] (covered 45)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Manager rejected for 499,999 [line 101] (covered 41)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 499,999 [line 112] (covered 45)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Manager rejected for 500,000 [line 124] (killed 1)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director approves 500,000 (exact inclusive limit) [line 135] (covered 45)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Director cannot sole-approve 500,001 to Approved status (held for dual approval) [line 148] (killed 4)
      ✘ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Exports expected constants: MANAGER_APPROVAL_LIMIT is 50,000 and DIRECTOR_APPROVAL_LIMIT is 500,000 [line 161] (covered 0)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Rejects non-pending invoice with INVOICE_NOT_PENDING and descriptive message [line 166] (killed 6)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Rejects single approval when user has unauthorized role [line 177] (killed 7)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Allows Admin to approve invoice <= 500,000 [line 188] (killed 2)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Boundary Value Thresholds (evaluateApproval pure function) Defaults unknown approver id/name and Approver role when approver identity is blank [line 199] (killed 3)
      ~ Phase 4: Step 1 - Single-Approver Role Limits Deep Equality & Immutability when Validation Fails Preserves deep equality of invoice on Manager limit rejection [line 214] (covered 41)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits Deep Equality & Immutability when Validation Fails Preserves deep equality of invoice on duplicate Director approval rejection [line 224] (killed 1)
      ~ Phase 4: Step 1 - Single-Approver Role Limits ApprovalService Integration throws ApprovalRejectedError with reason LIMIT_EXCEEDED when Manager approves over 50,000 [line 242] (covered 62)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits ApprovalService Integration successfully approves when Manager approves invoice <= 50,000 [line 264] (killed 1)
      ~ Phase 4: Step 1 - Single-Approver Role Limits ApprovalService Integration successfully approves when Director approves invoice <= 500,000 [line 277] (covered 59)
      ✓ Phase 4: Step 1 - Single-Approver Role Limits ApprovalService Integration throws ApprovalRejectedError with reason SAME_APPROVER when Director approves > 500,000 twice [line 290] (killed 1)
    approval-limits-step2.test.ts
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) First Approval on High-Value Invoices (> 500,000) 1st approval by Manager leaves invoice partially approved awaiting second approver [line 22] (killed 6)
      ~ Phase 5: Step 2 – Two-Approver Rule (> 500,000) First Approval on High-Value Invoices (> 500,000) 1st approval by Director leaves invoice partially approved awaiting second approver [line 40] (covered 45)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) First Approval on High-Value Invoices (> 500,000) 1st approval by unauthorized role is rejected with ROLE_NOT_ALLOWED [line 58] (killed 7)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) First Approval on High-Value Invoices (> 500,000) 1st approval by Admin leaves invoice partially approved [line 72] (killed 2)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval by distinct Director marks it Approved [line 88] (killed 6)
      ~ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval completes approval when 1st approver was a Manager [line 119] (covered 50)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Second Approval by Distinct Director 2nd approval by distinct Admin completes approval to Approved [line 145] (killed 3)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 1: Duplicate Approver (SAME_APPROVER) rejects with SAME_APPROVER when the same user attempts second approval [line 172] (killed 7)
      ~ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 1: Duplicate Approver (SAME_APPROVER) validates distinctness using userId, not display name or role [line 200] (covered 44)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 1: Duplicate Approver (SAME_APPROVER) rejects with SAME_APPROVER when prior approvals list has multiple entries and first approver re-approves [line 226] (killed 1)
      ~ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 1: Duplicate Approver (SAME_APPROVER) rejects with SAME_APPROVER when user is identified by username fallback [line 255] (covered 44)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) Negative Rule 2: Non-Director Second Approver (SECOND_APPROVER_NOT_DIRECTOR) rejects with SECOND_APPROVER_NOT_DIRECTOR when second approver is a Manager [line 281] (killed 3)
      ✓ Phase 5: Step 2 – Two-Approver Rule (> 500,000) ApprovalService Integration for High-Value Invoices executes the full dual-approval workflow via ApprovalService [line 311] (killed 10)
    approval-service.test.ts
      ~ ApprovalService Submit_MovesDraftToPendingApproval [line 19] (covered 10)
      ✓ ApprovalService Submit_RejectsInvoiceThatIsNotADraft [line 26] (killed 1)
      ✓ ApprovalService Approve_SetsStatusApproverAndTimestamp [line 32] (killed 1)
      ✓ ApprovalService Approve_RejectsInvoiceThatIsStillADraft [line 41] (killed 4)
      ✓ ApprovalService Approve_ThrowsWhenInvoiceDoesNotExist [line 47] (killed 3)
      ~ ApprovalService Reject_ThrowsWhenInvoiceDoesNotExist [line 55] (covered 15)
      ✓ ApprovalService Reject_RejectsInvoiceThatIsStillADraft [line 63] (killed 7)
      ~ ApprovalService Reject_RejectsInvoiceThatIsAlreadyApproved [line 71] (covered 26)
      ✓ ApprovalService Reject_AllowsRejectingPartiallyApprovedInvoice [line 79] (killed 4)
      ✓ ApprovalService Reject_RecordsReasonAndApprover [line 88] (killed 1)
      ~ ApprovalService Reject_RequiresAReason [line 98] (covered 11)
      ~ ApprovalService Approve_SupportsApproverIdentityObjectWithExplicitId [line 104] (covered 62)
      ~ ApprovalService Approve_SupportsApproverIdentityObjectWithExplicitUsernameOnly [line 112] (covered 62)
      ✓ ApprovalService Approve_SupportsApproverWithBothIdAndUsernamePreservingIdAsUserId [line 120] (killed 2)
      ✓ ApprovalService Approve_DefaultsRoleToApproverWhenNoneProvided [line 133] (killed 1)
      ~ ApprovalService Approve_DefaultsUsernameToUnknownWhenNeitherUsernameNorIdProvided [line 141] (covered 64)
    discount-calculator.test.ts
      ✓ DiscountCalculator calculates quantity discount tiers [line 7] (killed 13)
      ✓ DiscountCalculator calculates loyalty discount capped at 10% [line 17] (killed 3)
      ✓ DiscountCalculator calculates combined discount with optional nonprofit bonus [line 23] (killed 8)
      ✓ DiscountCalculator applies discount correctly with rounding [line 28] (killed 5)

Ran 1.77 tests per mutant on average.
------------------------|------------------|----------|-----------|------------|----------|----------|
                        | % Mutation score |          |           |            |          |          |
File                    |  total | covered | # killed | # timeout | # survived | # no cov | # errors |
------------------------|--------|---------|----------|-----------|------------|----------|----------|
All files               | 100.00 |  100.00 |      232 |         0 |          0 |        0 |        0 |
 approval-limits.ts     | 100.00 |  100.00 |      135 |         0 |          0 |        0 |        0 |
 approval-service.ts    | 100.00 |  100.00 |       67 |         0 |          0 |        0 |        0 |
 discount-calculator.ts | 100.00 |  100.00 |       29 |         0 |          0 |        0 |        0 |
 errors.ts              | 100.00 |  100.00 |        1 |         0 |          0 |        0 |        0 |
------------------------|--------|---------|----------|-----------|------------|----------|----------|
19:43:14 (40099) INFO JsonReporter Your report can be found at: file:///Users/adarsh.nishad/Workspace/NAGP/ai-sdlc-demo-app/reports/mutation/mutation.json
19:43:14 (40099) INFO HtmlReporter Your report can be found at: file:///Users/adarsh.nishad/Workspace/NAGP/ai-sdlc-demo-app/reports/mutation/mutation.html
19:43:14 (40099) INFO MutationTestExecutor Done in 7 seconds.
```

### Survivor triage

| Surviving mutant in before run                                               | Triage                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approval-limits.ts`: role gate mutant                                       | `1st approval by unauthorized role is rejected with ROLE_NOT_ALLOWED` and the corresponding single-approver unauthorized-role test assert the rejection code and message.                                                             |
| `approval-limits.ts`: duplicate-identity predicate/method mutants            | `rejects with SAME_APPROVER when the same user attempts second approval`, `validates distinctness using userId, not display name or role`, and service/API dual-approval cases distinguish ID equality from same-role distinct users. |
| `approval-limits.ts`: second-approver role and rejection-message mutants     | `rejects with SECOND_APPROVER_NOT_DIRECTOR when second approver is a Manager` asserts both code and message; Director/Admin completion tests check permitted outcomes.                                                                |
| `approval-limits.ts`: limit, decision, status, and approval-record mutants   | Boundary cases at 50,000/50,001/499,999/500,000/500,001 assert acceptance/rejection, status, IDs, roles, and approval counts; limit-rejection cases assert reason and message.                                                        |
| `approval-service.ts`: pending-state, identity extraction, and error mutants | `ApprovalService Approve_RejectsInvoiceThatIsStillADraft`, explicit-ID/username identity tests, and missing-invoice/error assertions cover service behavior. The after report shows all service mutants killed.                       |

The recorded score rose from **82.04% (201 killed, 19 survived, 25 no coverage)** to **100.00% (232 killed, 0 survived, 0 no coverage)**. The current stable-ID follow-up run scored **99.53% (214/215 killed; 0 survived; 1 no coverage)** because Stryker generated a no-coverage mutant for the display-name fallback from the user ID to `unknown`. It does not affect approval identity or authorization. The checked-in before/after reports preserve the earlier runs.

## 11. Pull request and AI review

**PR:** [#8](https://github.com/AdarshN7/ai-sdlc-demo-app/pull/8); see the repository's [closed PR index](https://github.com/AdarshN7/ai-sdlc-demo-app/pulls?q=is%3Apr+state%3Aclosed) for the complete list. The checked-in PR narrative is `docs/pull-request-description.md`. Review prompt: `.github/instructions/pull-request-review.instructions.md` (evaluate boundary operators, user-ID distinctness, validate-first order, layering, and mutation-resistant tests).

|   # | Finding                                                                                                                                                  | Severity | Verdict   | Reason or fix commit                                                                                                                      |
| --: | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Default identity fallback `approver.id \|\| approver.username \|\| 'unknown'` may accept an unverified identity when domain function is called directly. | Low      | Dismissed | PR description says `requireAuth` guarantees authenticated identity before route invocation; domain fallback is defensive.                |
|   2 | High-value dual approval permits Manager or Director as first approver.                                                                                  | Low      | Dismissed | Explicitly allowed by requirements; second approval is still constrained.                                                                 |
|   3 | Rejected attempts do not create an audit trail/decision note.                                                                                            | Low      | Deferred  | Valid follow-up; durable failed-attempt audit logging deferred to database audit phase.                                                   |
|   4 | Test reset endpoint could be triggered inadvertently in production.                                                                                      | Medium   | Fixed     | Added `ALLOW_TEST_RESET=true` production guard and Playwright environment in `24de945`.                                                   |
|   5 | UI formats `PendingApproval` as `Pending Approval`, confusing selectors.                                                                                 | Low      | Fixed     | Normalized page object and E2E assertions in `24de945`.                                                                                   |
|   6 | Could append more approvals to already Approved invoice.                                                                                                 | High     | Dismissed | Domain eligibility guard rejects nonpending/non-partially-approved status; unit tests cover it.                                           |
|   7 | USD formatting is hardcoded.                                                                                                                             | Low      | Deferred  | Multi-currency presentation is outside this approval-limit change; currency selection and conversion need a separate product requirement. |
|   8 | Concurrent Director approvals could conflict in memory.                                                                                                  | Medium   | Deferred  | The in-memory repository has no transaction or version check. Concurrency protection is deferred to durable persistence.                  |

The checked-in PR narrative includes all eight findings and verdicts. Disagreement is documented for findings 1, 2, and 6 based on the authenticated route boundary, explicit first-approver requirements, and lifecycle guard. The PR narrative's previous finding 7 reason incorrectly called integer amounts and single currency assignment assumptions; current source and overview document numeric amounts that may be decimal. Its revised rationale is scope, not an assignment requirement. Finding 8 is deferred because the in-memory repository has no transaction/version mechanism; the event loop alone does not prevent races across asynchronous operations.

## 12. AI interaction log

Log: `.ai-sdlc/interaction-log.jsonl`. Format: one JSON object per line. Hooks in `.agents/hooks.json` dispatch through `.agents/scripts/hook-dispatch.sh` to shell/Python logging. The log has tool start/error events, user requests/prompt summaries, task termination, response/task summaries, and human decisions. Passive reads and successful tool completion chatter are filtered by the logger. The earlier manual entries include prompt summaries, response summaries, and human decisions. The automatic hooks recorded this audit; a manual completion summary is added through the repository's interaction-audit script.

## 13. Demo video

**Recordings:**

- [SharePoint demo](https://nagarro-my.sharepoint.com/:v:/p/adarsh_nishad/IQB6jBdTbAQTR4h4ktDyaUFQAZwdRZHWrCDhOUTE--jP3Ek?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D&e=KUSdKP)
- [YouTube demo](https://youtu.be/zLCP96YUih0?si=QcW8l4_XqvpLx4ae)

## 14. Limitations, risks and next steps

- Repository is in memory; server restart resets data.
- The test reset endpoint is available outside production and requires `ALLOW_TEST_RESET=true` in production; a production environment could enable it deliberately.
- Authentication is a demo user switcher/session mechanism, not a production identity system.
- Concurrency control is not implemented; durable storage should add transactional locking or version checks.
- Deferred review findings: rejected-attempt audit records, multi-currency formatting, and concurrency-safe persistence.
- Demo links are present, but their reachability and the actual video duration remain unverified.
- `npm run lint` remains unverified because the repository lacks an ESLint config; setting one up is a separate project configuration change.

## 15. Requirements-to-evidence traceability

| Requirement                                                       | Evidence in repository / history                                                                                                                                                                                                                                                                                                                                                                | Audit result                                                                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| PR with at least three standalone commits and what + why messages | [Total PRs: 9](https://github.com/AdarshN7/ai-sdlc-demo-app/pulls), [closed PRs ](https://github.com/AdarshN7/ai-sdlc-demo-app/pulls?q=is%3Apr+state%3Aclosed),                                                                                                                                                                                                                                 | Multiple separate commits are present. The message audit found fewer than three with explicit what-and-why phrasing; gap remains. |
| `AGENTS.md` approval rules, layering, tests, review expectations  | [`AGENTS.md`](AGENTS.md)                                                                                                                                                                                                                                                                                                                                                                        | Present. `docs/cold-vs-context.md` describes changed outputs, but is not backed by raw transcripts or patches.                    |
| Spec tool files and task breakdown                                | [`openspec/config.yaml`](openspec/config.yaml), [`openspec/changes/approval-limits/proposal.md`](openspec/changes/approval-limits/proposal.md), [`design.md`](openspec/changes/approval-limits/design.md), [`tasks.md`](openspec/changes/approval-limits/tasks.md), and delta spec                                                                                                              | Present and committed.                                                                                                            |
| Unit coverage of all rules and negative rules                     | [`tests/unit/approval-limits-step1.test.ts`](tests/unit/approval-limits-step1.test.ts), [`tests/unit/approval-limits-step2.test.ts`](tests/unit/approval-limits-step2.test.ts)                                                                                                                                                                                                                  | Present; `npm test` passed 80/80.                                                                                                 |
| UI rejection E2E                                                  | [`e2e/tests/app.spec.ts`](e2e/tests/app.spec.ts)                                                                                                                                                                                                                                                                                                                                                | Present; `npm run test:e2e` passed 7/7.                                                                                           |
| Mutation scores, before and after                                 | [`docs/mutation/before.txt`](docs/mutation/before.txt), [`docs/mutation/after.txt`](docs/mutation/after.txt), fresh summary in 10                                                                                                                                                                                                                                                               | Archived output is pasted; fresh run 99.53%, 0 survivors, 1 no coverage.                                                          |
| PR description with a verdict for each finding                    | [`docs/pull-request-description.md`](docs/pull-request-description.md), 11                                                                                                                                                                                                                                                                                                                      | Eight findings are listed with Fixed, Dismissed, or Deferred verdicts and reasons.                                                |
| Structured AI interaction log                                     | [`.ai-sdlc/interaction-log.jsonl`](.ai-sdlc/interaction-log.jsonl), [`.agents/hooks.json`](.agents/hooks.json)                                                                                                                                                                                                                                                                                  | JSONL and hook dispatch are present.                                                                                              |
| Root assignment write-up                                          | [`ASSIGNMENT.md`](ASSIGNMENT.md)                                                                                                                                                                                                                                                                                                                                                                | This file.                                                                                                                        |
| 8–10 minute demo with working link                                | [SharePoint](https://nagarro-my.sharepoint.com/:v:/p/adarsh_nishad/IQB6jBdTbAQTR4h4ktDyaUFQAZwdRZHWrCDhOUTE--jP3Ek?nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D&e=KUSdKP), [YouTube](https://youtu.be/zLCP96YUih0?si=QcW8l4_XqvpLx4ae), outline in 13 | Links are present, but automated link checking could not access either URL; duration not confirmed.                               |
| Install, unit, mutation, and E2E commands verified                | 8                                                                                                                                                                                                                                                                                                                                                                                               | `npm ci`, `npm test`, `npm run mutate`, and `npm run test:e2e` were run; see exact results there.                                 |
