---
name: execute-tasks-windsurf
description: >-
  Execute pending SDD tasks sequentially in Windsurf with direct context
  management and script-based file operations. Optimized for Windsurf's
  context behavior — uses deterministic Bash scripts for task file moves
  and history updates to prevent data loss from context decay. Tasks
  execute inline through a 4-phase workflow (Understand, Implement, Verify,
  Complete) with file-based external memory for cross-task knowledge sharing.
  Reads task files from .agents/tasks/ and manages execution sessions in
  .agents/sessions/. Supports task group filtering. Use when user says
  "execute tasks", "run tasks", "start execution", "work on tasks", or
  wants to execute generated tasks autonomously in Windsurf.
metadata:
  argument-hint: "[task-id] [--task-group <group>] [--retries <n>]"
  type: workflow
  harness-hints:
    prefer-non-streaming: true
    reason: "Long-running autonomous execution with session file accumulation may exceed streaming limits"
allowed-tools: Read Write Glob Grep Bash
---

# Execute Tasks (Windsurf)

This skill orchestrates autonomous sequential execution of SDD tasks stored as JSON files in `.agents/tasks/`. It builds a dependency-aware execution plan, then executes each task inline through a 4-phase workflow (Understand, Implement, Verify, Complete), sharing learnings across tasks through a file-based external memory pattern.

Optimized for Windsurf and similar harnesses without subagent dispatch. Unlike `execute-tasks` (which dispatches parallel subagent executors), this skill executes all tasks sequentially within a single context. It uses `execution_context.md` as external memory — re-reading it before each task and updating it directly after — to maintain cross-task knowledge without relying on subagent isolation.

Tasks are managed entirely through file-based operations (Read, Write, Glob) on `.agents/tasks/` directories — no harness-specific task tools required.

## Load Reference Skills

Before starting, load the task schema and file operations:
```
Read: ../sdd-tasks/SKILL.md
```

This provides the task JSON schema, status lifecycle, file-based CRUD operations, dependency patterns, and anti-patterns.

For the 4-phase task workflow details and verification patterns, reference these shared files as needed during execution:
```
Read: ../execute-tasks/references/execution-workflow.md
Read: ../execute-tasks/references/verification-patterns.md
```

> When following `execution-workflow.md`, skip Phase 1 Step 1 (Load Knowledge) — you already have the full context from this skill. For Phase 4, follow the inline-specific instructions in this skill instead of the shared reference's context/result file protocol.

## Helper Scripts

This skill includes Bash scripts (using python3) for file operations that must be atomic and reliable. These scripts prevent data loss even when Windsurf's context compression has evicted the detailed procedure from context.

- **`scripts/move-task.sh`** — Move task files between status directories with full field preservation and integrity verification. The agent never touches JSON fields directly — the script handles fresh reads, field-level updates, and post-write verification.
- **`scripts/append-task-history.sh`** — Append task history entries to `execution_context.md` via deterministic read-modify-write. Ensures every task's history is recorded regardless of context decay.
- **`scripts/verify-task-file.sh`** — Verify task file integrity after writes. Safety net callable after any task file operation.

See `references/orchestration.md` for full script invocation patterns.

## Core Principles

### 1. Understand Before Implementing

Never write code without first understanding:
- What the task requires (structured acceptance criteria)
- What code already exists (read before modify)
- What conventions the project follows (existing patterns)
- What earlier tasks discovered (shared execution context)

### 2. Follow Existing Patterns

Match the codebase's established patterns:
- Coding style, naming conventions, file organization
- Error handling approach, logging patterns
- Test framework, test structure, assertion style
- Import ordering, module organization

### 3. Verify Against Criteria

Do not assume implementation is correct. Verify by:
- Walking through each acceptance criterion category
- Running tests and linters
- Confirming the core change works as intended
- Checking for regressions in existing functionality

### 4. Report Honestly

Produce accurate verification results:
- PASS only when all Functional criteria pass and tests pass
- PARTIAL when non-critical criteria fail but core works
- FAIL when Functional criteria or tests fail
- Never mark a task complete if verification fails

## Orchestration Workflow

This skill orchestrates task execution through a 9-step loop. See `references/orchestration.md` for the full detailed procedure.

### Step 1: Load Task List

Scan `.agents/tasks/` directories using Glob and Read to build the task index. If `--task-group` was provided, scan only that group's subdirectories. If a specific `task-id` was provided, locate and validate it exists.

For each task file found, read the JSON and extract: `id`, `title`, `status`, `blocked_by`, `metadata.priority`, `metadata.task_group`, `acceptance_criteria`, and the full file path.

### Step 2: Validate State

Handle edge cases: empty task list, all completed, specific task blocked, no unblocked tasks, circular dependencies.

### Step 3: Build Execution Plan

Build a dependency graph from pending tasks. Assign tasks to dependency levels using topological sorting: Level 1 = no dependencies, Level 2 = depends on Level 1 tasks, etc. Sort within levels by priority (critical > high > medium > low > unprioritized), break ties by "unblocks most others."

### Step 4: Check Settings

Read `.agents/settings.md` if it exists for `default_retries` setting.

### Step 5: Initialize Execution Directory

Generate a `task_execution_id` using three-tier resolution: (1) if `--task-group` provided, (2) if all open tasks share a group, (3) generic session ID. Clean stale sessions, check concurrency guard, create session files.

### Step 6: Present Execution Plan and Confirm

Display the plan showing tasks to execute by dependency level, blocked tasks, and completed count. Prompt the user to confirm before proceeding. If cancelled, stop without modifying any tasks.

### Step 7: Initialize Execution Context

Read `.agents/sessions/__live_session__/execution_context.md`. If a prior execution context exists in `.agents/sessions/`, merge relevant learnings from the most recent session.

### Step 8: Execute Loop

Execute tasks sequentially through dependency levels. For each level: execute tasks one at a time. For each task: re-read `execution_context.md` (context refresh), execute the 4-phase workflow inline, write `result-{id}.md` for record-keeping, update `execution_context.md` directly with learnings, update session logs. After every ~5 tasks, compact the Task History section. Retry failed tasks inline with failure context.

### Step 9: Session Summary

Display execution results with pass/fail counts, failed task list, and newly unblocked tasks. Save `session_summary.md`. Archive the session by moving all contents from `__live_session__/` to `.agents/sessions/{task_execution_id}/`.

## SDD Verification

All tasks executed by this skill are expected to have structured `acceptance_criteria` objects (produced by the `create-tasks` skill). The `acceptance_criteria` field in the task JSON contains four arrays:

```json
{
  "acceptance_criteria": {
    "functional": ["criterion 1", "criterion 2"],
    "edge_cases": ["criterion 3"],
    "error_handling": ["criterion 4"],
    "performance": []
  }
}
```

Verification walks each category:
- **Functional**: All must pass for a PASS result
- **Edge Cases**: Failures flagged as PARTIAL, don't block completion
- **Error Handling**: Failures flagged as PARTIAL, don't block completion
- **Performance**: Failures flagged as PARTIAL, don't block completion

**Fallback**: If a task lacks `acceptance_criteria` (safety net), infer requirements from the `description` and `title` fields.

## 4-Phase Workflow

Each task is executed inline through these phases. See `../execute-tasks/references/execution-workflow.md` for detailed per-phase procedures (skipping Phase 1 Step 1 and using inline Phase 4 below).

### Phase 1: Understand

Load context and understand scope before writing code.

- Re-read `.agents/sessions/__live_session__/execution_context.md` (context refresh — places cross-task learnings at top of recency window)
- Read the task JSON file from `.agents/tasks/in-progress/{group}/task-{id}.json`
- Parse `acceptance_criteria` object and `testing_requirements` array
- Explore affected files via Glob/Grep
- Read project conventions

### Phase 2: Implement

Execute the code changes following project patterns.

- Read all target files before modifying them
- Follow implementation order (data → service → interface → tests)
- Match existing coding patterns and conventions
- Write tests if specified in `testing_requirements`
- Run mid-implementation checks (linter, existing tests) to catch issues early

### Phase 3: Verify

Verify implementation against the structured `acceptance_criteria`.

- Walk each category: Functional, Edge Cases, Error Handling, Performance
- Check `testing_requirements`
- Run tests and linter
- See `../execute-tasks/references/verification-patterns.md` for detailed pass/fail rules

### Phase 4: Complete (Inline-Specific)

Report results and update context. Use the helper scripts for file operations — see the `task-checklist.md` in the session directory for exact invocation patterns.

- Determine status (PASS/PARTIAL/FAIL) based on verification
- If PASS: `bash {skill_path}/scripts/move-task.sh <in-progress-path> <completed-dir> --status completed`
- If PARTIAL or FAIL: leave in `in-progress/` for the orchestrator to decide on retry
- Record history: `bash {skill_path}/scripts/append-task-history.sh <execution-context-path> <<'ENTRY' ...`
- Write compact result to `.agents/sessions/__live_session__/result-{id}.md` for record-keeping
- Update `execution_context.md` sections (Project Patterns, Key Decisions, Known Issues, File Map) as relevant
- Update `task_log.md` and `progress.md` immediately
- Check for context compaction (every ~5 tasks)

## Context Management

Tasks share learnings through `.agents/sessions/__live_session__/execution_context.md` using a "File as External Memory" strategy. This pattern ensures cross-task knowledge survives harness context compression by persisting it to disk and re-reading it before each task.

- **Instruction refresh**: Before each task, re-read `task-checklist.md` from the session directory. This checklist contains the condensed post-task procedure with exact script commands. Re-reading it combats instruction decay from Windsurf's context compression.
- **Context refresh**: Before each task, re-read `execution_context.md` in full. This places cross-task learnings at the top of the recency window, ensuring they remain available even if the harness has compressed earlier conversation turns.
- **Script-based history updates**: After each task, use `scripts/append-task-history.sh` to record the task history entry deterministically. Also update other sections (Project Patterns, Key Decisions, Known Issues, File Map) via read-modify-write as relevant.
- **Context compaction**: After every ~5 tasks (when the running task count is a multiple of 5), compact the Task History section: keep the last 5 entries in full, summarize all older entries into a brief "Prior Tasks Summary" paragraph at the top of Task History. Keep all other sections in full.
- **Write pattern**: All writes to session artifacts (`execution_context.md`, `task_log.md`, `progress.md`) use Write (full file replacement) via read-modify-write, never Edit.
- **Sections**: Project Patterns, Key Decisions, Known Issues, File Map, Task History

## Key Behaviors

- **Autonomous execution loop**: After the user confirms the execution plan, no further prompts occur between tasks. The loop runs without interruption once started.
- **Sequential execution**: All tasks execute one at a time within the orchestrator's context. Dependency levels define execution order but tasks within a level also run sequentially.
- **File as External Memory**: After each task, write comprehensive learnings to `execution_context.md`. Before each task, re-read the file to refresh context. This ensures cross-task knowledge survives context window compression.
- **Result file for record-keeping**: Write `result-{id}.md` after each task for session archival and retry context, but not as a completion signal.
- **Immediate session file updates**: `task_log.md` and `progress.md` are updated after each task (no batching needed since execution is sequential).
- **Context compaction**: Every ~5 tasks, compact the Task History section in `execution_context.md` to prevent unbounded growth.
- **Inline retry**: Failed tasks with retries remaining are re-executed inline with failure context from the previous result file.
- **Configurable retries**: Default 3 attempts per task, configurable via `--retries` argument.
- **Dynamic unblocking**: After each dependency level completes, the dependency graph is refreshed and newly unblocked tasks join the next level.
- **Honest failure handling**: After retries exhausted, tasks stay `in_progress` (not completed), and execution continues with the next dependency level.
- **Circular dependency detection**: If all remaining tasks block each other, break at the weakest link and log a warning.
- **Single-session invariant**: Only one execution session can run at a time per project. A `.lock` file prevents concurrent invocations.
- **Interrupted session recovery**: Stale sessions are detected and archived; tasks left `in_progress` are automatically reset to `pending` via file moves.
- **Per-task instruction refresh**: Before each task, re-read `task-checklist.md` alongside `execution_context.md`. The checklist refreshes the post-task procedure; the context refreshes cross-task knowledge. This ensures both survive Windsurf's context compression.
- **Script-based file operations**: Task file moves and history appends use deterministic Bash scripts (`scripts/move-task.sh`, `scripts/append-task-history.sh`) rather than inline read-modify-write. This prevents field loss even when the agent's context has decayed.

## Example Usage

### Execute all unblocked tasks
```
/execute-tasks-windsurf
```

### Execute a specific task
```
/execute-tasks-windsurf task-005
```

### Execute tasks for a specific group
```
/execute-tasks-windsurf --task-group user-authentication
```

### Execute with custom retry limit
```
/execute-tasks-windsurf --retries 1
```

### Execute group with custom retries
```
/execute-tasks-windsurf --task-group payments --retries 1
```

## Execution Strategy

Execute tasks sequentially in the orchestrator's own context. For each task in the current dependency level: re-read both `task-checklist.md` (instruction refresh) and `execution_context.md` (knowledge refresh), then follow the 4-phase workflow inline (Understand, Implement, Verify, Complete). After completing each task, use the helper scripts to move the task file and record history, then update logs — before moving to the next task.

No agents are dispatched. No polling is needed. All execution happens in a single continuous context. The helper scripts ensure that critical file operations (task moves, history recording) are deterministic and never lose data, even when context has been compressed.

## Reference Files

- `references/orchestration.md` — 9-step inline orchestration loop with sequential execution, direct context writes, inline retry, and context compaction
- `../execute-tasks/references/execution-workflow.md` — Detailed 4-phase workflow procedures (shared)
- `../execute-tasks/references/verification-patterns.md` — Criterion verification, pass/fail rules, and failure reporting (shared)
