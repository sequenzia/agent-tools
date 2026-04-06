---
name: execute-tasks
description: >-
  Execute pending SDD tasks in dependency order with wave-based concurrent
  execution and structured verification. Reads task files from .agents/tasks/
  and manages execution sessions in .agents/sessions/. Supports task group
  filtering and configurable parallelism. Use when user says "execute tasks",
  "run tasks", "start execution", "work on tasks", or wants to execute
  generated tasks autonomously.
metadata:
  argument-hint: "[task-id] [--task-group <group>] [--retries <n>] [--max-parallel <n>]"
  type: workflow
  harness-hints:
    prefer-non-streaming: true
    reason: "Long-running autonomous execution with session file accumulation may exceed streaming limits"
  agents:
    - name: task-executor
      file: agents/task-executor.md
      shared: false
allowed-tools: Read Write Glob Grep Bash
---

# Execute Tasks Skill

This skill orchestrates autonomous execution of SDD tasks stored as JSON files in `.agents/tasks/`. It builds a dependency-aware execution plan, dispatches a task-executor agent for each task through a 4-phase workflow (Understand, Implement, Verify, Complete), handles retries with failure context, and shares learnings across tasks through a shared execution context file.

Tasks are managed entirely through file-based operations (Read, Write, Glob) on `.agents/tasks/` directories — no harness-specific task tools required.

## Load Reference Skills

Before starting, load the task schema and file operations:
```
Read: ../sdd-tasks/SKILL.md
```

This provides the task JSON schema, status lifecycle, file-based CRUD operations, dependency patterns, and anti-patterns.

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

Resolve `max_parallel` setting using precedence: `--max-parallel` CLI arg > `.agents/settings.md` value > default 5. Build a dependency graph from pending tasks. Assign tasks to waves using topological levels: Wave 1 = no dependencies, Wave 2 = depends on Wave 1 tasks, etc. Sort within waves by priority (critical > high > medium > low > unprioritized), break ties by "unblocks most others." Cap each wave at `max_parallel` tasks.

### Step 4: Check Settings

Read `.agents/settings.md` if it exists for execution preferences, including `max_parallel` setting. CLI `--max-parallel` argument takes precedence over the settings file value.

### Step 5: Initialize Execution Directory

Generate a `task_execution_id` using three-tier resolution: (1) if `--task-group` provided → `{task_group}-{YYYYMMDD}-{HHMMSS}`, (2) else if all open tasks share the same `metadata.task_group` → `{task_group}-{YYYYMMDD}-{HHMMSS}`, (3) else → `exec-session-{YYYYMMDD}-{HHMMSS}`. Clean any stale `__live_session__/` files by archiving them to `.agents/sessions/interrupted-{YYYYMMDD}-{HHMMSS}/`, resetting any `in_progress` tasks back to `pending` via file moves. Check for and enforce the concurrency guard via `.lock` file. Create `.agents/sessions/__live_session__/` containing:
- `execution_plan.md` — saved execution plan
- `execution_context.md` — initialized with standard template
- `task_log.md` — initialized with table headers
- `tasks/` — subdirectory for archiving completed task files
- `progress.md` — initialized with status template

### Step 6: Present Execution Plan and Confirm

Display the plan showing tasks to execute, blocked tasks, and completed count. Prompt the user to confirm before proceeding. If cancelled, stop without modifying any tasks.

### Step 7: Initialize Execution Context

Read `.agents/sessions/__live_session__/execution_context.md`. If a prior execution context exists in `.agents/sessions/`, merge relevant learnings from the most recent session.

### Step 8: Execute Loop

Execute tasks in waves. For each wave: snapshot `execution_context.md`, move wave tasks from `pending/` to `in-progress/` via file operations, dispatch task-executor agents per the Execution Strategy, poll for result files (subagent path), process results, retry failed tasks with context, merge per-task context files into `execution_context.md`, archive completed task files, refresh unblocked tasks, and form the next wave.

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

Each task is executed by the `task-executor` agent through these phases:

### Phase 1: Understand

Load context and understand scope before writing code.

- Read `.agents/sessions/__live_session__/execution_context.md` for learnings from prior tasks
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

### Phase 4: Complete

Report results and share learnings.

- Determine status (PASS/PARTIAL/FAIL) based on verification
- If PASS: move task file from `in-progress/{group}/` to `completed/{group}/` (read JSON, update `status` to `"completed"`, update `updated_at`, write to new path, delete old file)
- If PARTIAL or FAIL: leave in `in-progress/` for the orchestrator to decide on retry
- Write learnings to `.agents/sessions/__live_session__/context-{id}.md`
- Write compact result to `.agents/sessions/__live_session__/result-{id}.md` — this is the **last** file written and signals completion to the orchestrator
- Return minimal status line: `DONE: [{id}] {title} - {PASS|PARTIAL|FAIL}`

## Shared Execution Context

Tasks within an execution session share learnings through `.agents/sessions/__live_session__/execution_context.md`:

- **Write-based updates**: All orchestrator writes to session artifacts (`execution_context.md`, `task_log.md`, `progress.md`) use Write (full file replacement) via a read-modify-write pattern, never Edit
- **Snapshot before wave**: The orchestrator snapshots `execution_context.md` before each wave — all agents in a wave read the same baseline
- **Per-task writes**: Each agent writes to `context-{id}.md` instead of the shared file, eliminating write contention
- **Result file protocol**: Each agent writes a compact `result-{id}.md` (~18 lines) as its very last action. The orchestrator polls for these files instead of consuming full agent output
- **Merge after wave**: After all agents complete, the orchestrator appends all `context-{id}.md` content to `execution_context.md` and deletes the per-task files. PASS result files are deleted; FAIL result files are retained for post-analysis
- **Sections**: Project Patterns, Key Decisions, Known Issues, File Map, Task History

## Key Behaviors

- **Autonomous execution loop**: After the user confirms the execution plan, no further prompts occur between tasks. The loop runs without interruption once started.
- **Result file protocol**: Each agent writes a compact `result-{id}.md` (~18 lines) as its very last action. The orchestrator polls for these files via `scripts/poll-for-results.sh`, then reads them for processing.
- **Batched session file updates**: All updates to `task_log.md` and `progress.md` are batched into a single read-modify-write cycle per file per wave.
- **Wave-based parallelism**: Tasks at the same dependency level run simultaneously (when subagent dispatch is available), up to `max_parallel` concurrent agents per wave.
- **One agent per task, multiple per wave**: Each task gets a fresh agent invocation with isolated context.
- **Per-task context isolation**: Each agent writes to `context-{id}.md`. The orchestrator merges these after each wave.
- **Within-wave retry**: Failed tasks with retries remaining are re-dispatched with failure context from the previous result file.
- **Configurable parallelism**: Default 5 concurrent tasks, configurable via `--max-parallel` argument or `.agents/settings.md`. Set to 1 for sequential execution.
- **Configurable retries**: Default 3 attempts per task, configurable via `--retries` argument.
- **Dynamic unblocking**: After each wave completes, the dependency graph is refreshed and newly unblocked tasks join the next wave.
- **Honest failure handling**: After retries exhausted, tasks stay `in_progress` (not completed), and execution continues with the next wave.
- **Circular dependency detection**: If all remaining tasks block each other, break at the weakest link and log a warning.
- **Single-session invariant**: Only one execution session can run at a time per project. A `.lock` file prevents concurrent invocations.
- **Interrupted session recovery**: Stale sessions are detected and archived; tasks left `in_progress` are automatically reset to `pending` via file moves.

## Example Usage

### Execute all unblocked tasks
```
/execute-tasks
```

### Execute a specific task
```
/execute-tasks task-005
```

### Execute tasks for a specific group
```
/execute-tasks --task-group user-authentication
```

### Execute with custom retry limit
```
/execute-tasks --retries 1
```

### Execute with limited parallelism
```
/execute-tasks --max-parallel 2
```

### Execute sequentially (no concurrency)
```
/execute-tasks --max-parallel 1
```

### Execute group with custom parallelism and retries
```
/execute-tasks --task-group payments --max-parallel 3 --retries 1
```

## Agents

| Agent | File | Dependencies |
|-------|------|--------------|
| task-executor | `agents/task-executor.md` | none |

## Execution Strategy

Execute agents respecting the wave-based dependency graph.

**If subagent dispatch is available:** For each wave, dispatch one task-executor subagent per task in the wave, passing the contents of `agents/task-executor.md` as the task instructions along with the task JSON content, session paths (context write path, result write path), and retry context if applicable. Dispatch all wave agents in parallel in a single message turn. After dispatch, poll for result files using `scripts/poll-for-results.sh` via a single Bash invocation (with `timeout: 2760000`). When polling completes, process results as described in `references/orchestration.md` Step 7d.

**If subagent dispatch is not available:** For each wave, execute tasks sequentially. For each task: read `agents/task-executor.md` and follow its 4-phase workflow inline using the task's details. Write the same context and result files as the subagent path. After completing each task inline, process its result immediately before moving to the next task in the wave. Skip the polling step — result files are written synchronously.

## Agent Coordination

- The orchestrator manages the full execution lifecycle: task loading, wave planning, agent dispatch, result processing, context merging, and session archival
- Task-executor agents work independently — no cross-agent communication within a wave (hub-and-spoke topology)
- Context sharing happens between waves via the orchestrator's merge step, not during execution
- Each agent reads the wave's snapshot of `execution_context.md` and writes to isolated per-task files

## Reference Files

- `references/orchestration.md` — 9-step orchestration loop with execution plan, retry handling, and session summary
- `references/execution-workflow.md` — Detailed phase-by-phase procedures for the 4-phase workflow
- `references/verification-patterns.md` — Criterion verification, pass/fail rules, and failure reporting format
