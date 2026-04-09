# Execution Workflow Reference

This reference provides the detailed 4-phase workflow for executing a single SDD task. Each phase has specific procedures for verifying structured `acceptance_criteria` produced by the `create-tasks` skill.

## Phase 1: Understand

Load context and understand the task scope before writing any code.

### Step 1: Load Knowledge

Read the execute-tasks skill and its references:
```
Read: ../execute-tasks/SKILL.md
Read: ../execute-tasks/references/execution-workflow.md
Read: ../execute-tasks/references/verification-patterns.md
```

### Step 2: Read Execution Context

Check for shared execution context from prior tasks in this session:
```
Read: .agents/sessions/__live_session__/execution_context.md
```

If the file exists, review:
- **Project Patterns** — Coding conventions, tech stack details discovered by earlier tasks
- **Key Decisions** — Architecture choices already made
- **Known Issues** — Problems to avoid, workarounds in place
- **File Map** — Important files and their purposes
- **Task History** — What earlier tasks accomplished and any issues encountered

Use this context to inform your approach. If the file does not exist, proceed without it.

#### Context Size Management

If `execution_context.md` has grown large:

- **200+ lines (~8KB)**: Keep the last 5 Task History entries in full. Summarize older Task History entries into a brief paragraph. Keep Project Patterns, Key Decisions, Known Issues, and File Map sections in full.
- **500+ lines (~20KB)**: Read selectively — always read the top sections (Project Patterns, Key Decisions, Known Issues, File Map) and the last 5 Task History entries. Skip older Task History entries entirely.

#### Retry Context Check

If this is a retry attempt:

1. Read the previous attempt's learnings from `execution_context.md`
2. Assess the current codebase state: run linter and tests to understand what the previous attempt left behind
3. Decide approach: build on the previous attempt's partial work, or revert and try a different strategy

### Step 3: Load Task Details

Read the task JSON file from its location in `.agents/tasks/in-progress/{group}/task-{id}.json`. The full task content is available in this file:

- `id` — Task identifier
- `title` — Imperative description
- `description` — Full description of what to do
- `acceptance_criteria` — Structured object with `functional`, `edge_cases`, `error_handling`, `performance` arrays
- `testing_requirements` — Array of `{type, target}` objects
- `metadata` — Priority, complexity, source_section, spec_path, feature_name, task_group
- `blocked_by` — Dependencies (all should be completed at this point)
- `metadata.produces_for` — IDs of downstream tasks that consume this task's output (informational; the orchestrator handles context injection)

### Step 4: Classify Task

Check for the `acceptance_criteria` object in the task JSON:

- If `acceptance_criteria` exists with non-empty arrays → **SDD task** (structured verification)
- If `acceptance_criteria` is missing or all arrays are empty → check description for `**Acceptance Criteria:**` markdown pattern (legacy format)
- If neither found → **fallback** (infer requirements from title and description)

All tasks from the `create-tasks` skill have structured `acceptance_criteria`, so the primary path handles the standard case.

### Step 5: Parse Requirements

**For SDD tasks (primary path):**
- Read `acceptance_criteria.functional` — each string is a criterion that must pass
- Read `acceptance_criteria.edge_cases` — each string is a criterion that's flagged but doesn't block
- Read `acceptance_criteria.error_handling` — each string is flagged but doesn't block
- Read `acceptance_criteria.performance` — each string is flagged but doesn't block
- Read `testing_requirements` array — each `{type, target}` specifies a test to write/run
- Note `metadata.source_section` and `metadata.spec_path` for spec reference
- If the source spec section is referenced, read it for additional context

**For fallback tasks:**
- Parse the `title` for intent: "Fix X" = bug fix, "Add X" = new feature, "Refactor X" = restructuring, "Update X" = modification
- Extract any "should...", "when...", "must..." statements from `description`
- Infer completion criteria from the description

### Step 6: Explore Codebase

Understand the affected code before making changes:

1. Read project conventions files (CLAUDE.md, AGENTS.md, or similar) if they exist
2. Use `Glob` to find files matching the task scope (e.g., `**/*user*.ts` for a user-related task)
3. Use `Grep` to search for related symbols, functions, or patterns
4. Read the key files that will be modified
5. Identify test file locations and patterns

### Step 7: Summarize Scope

Before proceeding to implementation, have a clear understanding of:
- What files need to be created or modified
- What the expected behavior change is
- What tests need to be written or updated
- What project conventions to follow

---

## Phase 2: Implement

Do NOT update `progress.md` — the orchestrator manages progress tracking.

Execute the implementation following project patterns and best practices.

### Pre-Implementation Reads

Always read target files before modifying them:
- Read every file you plan to edit (never edit blind)
- Read related test files to understand test patterns
- Read adjacent files for consistency (same directory, same module)

### Implementation Order

Follow a dependency-aware implementation order:

```
1. Data layer (models, schemas, types)
2. Service layer (business logic, utilities)
3. API/Interface layer (endpoints, handlers, UI)
4. Test layer (unit tests, integration tests)
5. Configuration (env vars, config files)
```

### Coding Standards

Apply these standards during implementation:

- **Follow existing patterns**: Match the coding style, naming conventions, and patterns already in the codebase
- **Minimal changes**: Only modify what the task requires; do not refactor surrounding code
- **Self-documenting code**: Use clear naming; add comments only when the "why" isn't obvious
- **Error handling**: Handle errors at appropriate boundaries, not everywhere
- **Type safety**: Follow the project's type conventions

### Mid-Implementation Checks

After completing the core implementation (before tests):
1. Run any existing linter to catch style issues early
2. Run existing tests to make sure nothing is broken
3. Fix any issues before proceeding to write new tests

### Test Writing

If `testing_requirements` specifies tests or the project has test patterns:

1. Follow the existing test framework and patterns
2. Write tests for behavior specified in `acceptance_criteria.functional`
3. Test edge cases from `acceptance_criteria.edge_cases`
4. Ensure tests are independent and can run in any order
5. Use descriptive test names that explain expected behavior

---

## Phase 3: Verify

Do NOT update `progress.md` — the orchestrator manages progress tracking.

Verify the implementation against the task's `acceptance_criteria`. The verification approach adapts based on task classification.

### SDD Task Verification (Primary Path)

Walk through each `acceptance_criteria` category systematically:

**Functional** (`acceptance_criteria.functional`):
- For each criterion string, verify the implementation satisfies it
- Run relevant tests to confirm behavior
- Check that the code path exists and is reachable
- Record: PASS if implemented and tests pass; FAIL if missing or tests fail

**Edge Cases** (`acceptance_criteria.edge_cases`):
- Verify boundary conditions are handled
- Check that edge case scenarios produce correct results
- Run edge case tests if written
- Record: PASS if handled; FAIL if unhandled; SKIP if not applicable

**Error Handling** (`acceptance_criteria.error_handling`):
- Verify error scenarios are handled gracefully
- Check that error messages are clear and actionable
- Confirm error recovery behavior works
- Record: PASS if handled; FAIL if unhandled

**Performance** (`acceptance_criteria.performance`):
- Inspect implementation approach for efficiency
- Check for obvious issues (N+1 queries, unbounded loops, missing indexes)
- Run performance-related tests if specified
- Record: PASS if efficient approach used; FAIL if obvious performance issue

**Testing Requirements** (`testing_requirements`):
- For each `{type, target}` entry, find or create the corresponding test
- Run all tests
- Run the full test suite to check for regressions

### Fallback Verification

For tasks without structured `acceptance_criteria`:

1. **Infer "done" from description**: What does success look like based on the task title and description?
2. **Run existing tests**: Ensure no regressions
3. **Run linter**: Check code quality
4. **Verify core change**: Confirm the primary change works as intended
5. **Spot check**: Read through the changes and verify they make sense

### Pass Threshold Rules

See `verification-patterns.md` for detailed pass/fail criteria.

---

## Phase 4: Complete

Report results and update task status.

### Determine Status

Based on verification results:

| Result | Status | Action |
|--------|--------|--------|
| All Functional criteria pass, tests pass | **PASS** | Move task to `completed/` |
| Some Edge/Error/Performance criteria fail but Functional passes | **PARTIAL** | Leave in `in-progress/` |
| Any Functional criteria fail, or tests fail | **FAIL** | Leave in `in-progress/` |

### Update Task Status

**If PASS — Move task file (read fresh — do not rely on the task JSON from Phase 1):**
1. Read `.agents/tasks/in-progress/{group}/task-{id}.json` and parse the full JSON object
2. Modify only two fields on the parsed object: set `status` to `"completed"` and `updated_at` to current ISO 8601 timestamp. All other fields (description, acceptance_criteria, testing_requirements, active_form, metadata, blocked_by, etc.) must remain exactly as read. Do NOT reconstruct the JSON from memory.
3. Write the complete object to `.agents/tasks/completed/{group}/task-{id}.json` (create group subdirectory if needed)
4. Verify: Read the written file back and confirm `acceptance_criteria` and `testing_requirements` are present and non-empty. If either is missing, re-read from `in-progress/` and redo steps 2-3.
5. Delete `.agents/tasks/in-progress/{group}/task-{id}.json`

> **Windsurf execution note**: When executing via `execute-tasks-windsurf`, use `scripts/move-task.sh` for task file moves instead of the manual read-modify-write procedure above. The script handles fresh reads, field preservation, integrity verification, and atomic deletes — preventing data loss from context decay.

**If PARTIAL or FAIL:**
Leave task as `in_progress`. Do NOT move the file. The orchestrating skill will decide whether to retry.

### Append to Execution Context

Write learnings to your per-task context file at the `Context Write Path` specified in your prompt (e.g., `.agents/sessions/__live_session__/context-{id}.md`). Do NOT write to `execution_context.md` directly — the orchestrator merges per-task files after each wave.

```markdown
### Task [{id}]: {title} - {PASS/PARTIAL/FAIL}
- Files modified: {list of files created or changed}
- Key learnings: {patterns discovered, conventions noted, useful file locations}
- Issues encountered: {problems hit, workarounds applied, things that didn't work}
```

Include updates to Project Patterns, Key Decisions, Known Issues, and File Map sections as relevant — the orchestrator will merge these into the shared context after the wave.

#### Error Resilience

If the write to the per-task context file fails:

1. **Do not crash** — continue the workflow normally
2. Log a `WARNING: Failed to write learnings to context file` line in the result file Issues section
3. Include the learnings in the result file Issues section as fallback

### Write Result File

As your **VERY LAST action** (after writing the context file), write a compact result file to the `Result Write Path` specified in your prompt (e.g., `.agents/sessions/__live_session__/result-{id}.md`):

```markdown
# Task Result: [{id}] {title}
status: PASS|PARTIAL|FAIL
attempt: {n}/{max}

## Verification
- Functional: {n}/{total}
- Edge Cases: {n}/{total}
- Error Handling: {n}/{total}
- Tests: {passed}/{total} ({failed} failures)

## Files Modified
- {path}: {brief description}

## Issues
{None or brief descriptions}
```

**Ordering**: Context file FIRST, result file LAST. The result file's existence signals completion to the orchestrator.

### Return Status Line

After writing the result file, return ONLY a single minimal status line:

```
DONE: [{id}] {title} - {PASS|PARTIAL|FAIL}
```

### Fallback Report Format

Only used when the result file write fails. Return the full report so the orchestrator can parse it:

```
TASK RESULT: {PASS|PARTIAL|FAIL}
Task: [{id}] {title}

VERIFICATION:
  Functional: {n}/{total} passed
  Edge Cases: {n}/{total} passed
  Error Handling: {n}/{total} passed
  Performance: {n}/{total} passed (or N/A)
  Tests: {passed}/{total} ({failed} failures)

{If PARTIAL or FAIL:}
ISSUES:
  - {criterion that failed}: {what went wrong}

RECOMMENDATIONS:
  - {suggestion for fixing or completing}

FILES MODIFIED:
  - {file path}: {brief description of change}

{If context write also failed:}
LEARNINGS:
  - Files modified: {list}
  - Key learnings: {patterns, conventions, file locations}
  - Issues encountered: {problems, workarounds}
```
