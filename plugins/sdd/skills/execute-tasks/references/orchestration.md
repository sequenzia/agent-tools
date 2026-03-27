# Orchestration Reference

This reference provides the detailed 9-step orchestration loop for executing SDD tasks in dependency order. The execute-tasks skill uses this procedure to manage the full execution session.

All task management is file-based: tasks are JSON files in `.agents/tasks/` directories, managed via Read, Write, and Glob per `sdd-tasks/references/operations.md`.

## File Operation Guidelines

All orchestrator writes to session artifacts (`execution_context.md`, `task_log.md`, `progress.md`) MUST use **Write** (full file replacement), never **Edit**. The Edit tool relies on exact string matching which becomes unreliable as these files grow during execution. Instead, use a **read-modify-write** pattern:

1. **Read** the current file contents
2. **Modify** in memory (append rows, update sections, etc.)
3. **Write** the complete updated file

This ensures atomic, reliable updates regardless of file size or content changes.

## Result File Protocol

### Purpose

Reduce orchestrator context consumption by moving agent result data to disk. Instead of embedding full agent output (~100+ lines per task) into the orchestrator's context window, agents write a compact result file (~18 lines) as their **very last action**. The orchestrator reads these files after polling for completion.

### File Format (Standard)

Agents write `result-{id}.md` in `.agents/sessions/__live_session__/`:

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

### Ordering Invariant

Agents MUST write files in this order:
1. `context-{id}.md` FIRST (learnings for context merge)
2. `result-{id}.md` LAST (completion signal for orchestrator polling)

The result file's existence serves as the completion signal. If it exists, the context file is guaranteed to exist (or the agent intentionally skipped it).

### Fallback

If an agent crashes before writing its result file, the orchestrator treats the task as FAIL with reason "Agent did not produce result file." The task stays in `in-progress/` for retry.

## Step 1: Load Task List

Scan `.agents/tasks/` directories using Glob and Read to build the complete task index.

### If --task-group was provided:

1. Glob `.agents/tasks/pending/{group}/*.json` to find pending tasks
2. Glob `.agents/tasks/in-progress/{group}/*.json` to find in-progress tasks
3. Glob `.agents/tasks/completed/{group}/*.json` to find completed tasks
4. Glob `.agents/tasks/backlog/{group}/*.json` to find backlog tasks
5. Read each discovered file to build the task list

### If no --task-group:

1. Glob `.agents/tasks/pending/**/*.json` for all pending tasks
2. Glob `.agents/tasks/in-progress/**/*.json` for all in-progress tasks
3. Glob `.agents/tasks/completed/**/*.json` for all completed tasks
4. Glob `.agents/tasks/backlog/**/*.json` for all backlog tasks
5. Read each discovered file to build the task list

### If specific task-id was provided:

1. Glob `.agents/tasks/*/*/task-{id}.json` to locate the task across all status directories
2. If not found, inform the user and stop

### Build Task Index

For each task file read, extract:
- `id` from the JSON
- `title` for display
- `status` from the JSON (must match the directory it lives in)
- `blocked_by` array for dependency resolution
- `metadata.priority` for wave sorting
- `metadata.task_group` for group filtering
- `acceptance_criteria` for verification
- Full file path for later read/move operations

## Step 2: Validate State

Handle edge cases before proceeding:

- **Empty task list**: Report "No tasks found. Use `/create-tasks` to generate tasks from a spec." and stop.
- **All completed**: Report a summary of completed tasks and stop.
- **Specific task-id is blocked**: Report which tasks are blocking it and stop.
- **No unblocked tasks**: Report which tasks exist and what's blocking them. Detect circular dependencies and report if found.

## Step 3: Build Execution Plan

### 3a: Resolve Max Parallel

Determine the maximum number of concurrent tasks per wave using this precedence:
1. `--max-parallel` CLI argument (highest priority)
2. `max_parallel` setting in `.agents/settings.md`
3. Default: 5

### 3b: Build Dependency Graph

Collect all pending tasks and build a dependency graph from `blocked_by` relationships.

If a specific `task-id` was provided, the plan contains only that task (single-task mode, effectively `max_parallel = 1`).

### 3c: Assign Tasks to Waves

Use topological sorting to assign tasks to dependency-based waves:
- **Wave 1**: All pending tasks with empty `blocked_by` list (no dependencies)
- **Wave 2**: Tasks whose dependencies are ALL in Wave 1 or already completed
- **Wave 3**: Tasks whose dependencies are ALL in Wave 1, Wave 2, or already completed
- Continue until all tasks are assigned to waves

If task group filtering is active, only include tasks matching the specified group.

### 3d: Sort Within Waves

Within each wave, sort by priority:
1. `critical` tasks first
2. `high` tasks next
3. `medium` tasks next
4. `low` tasks last
5. Tasks without priority metadata last

Break ties by "unblocks most others" — tasks that appear in the most `blocked_by` lists of other tasks execute first.

If a wave contains more tasks than `max_parallel`, split into sub-waves of `max_parallel` size, maintaining the priority ordering.

### 3e: Circular Dependency Detection

Detect circular dependencies: if any tasks remain unassigned after topological sorting, they form a cycle. Report the cycle to the user and attempt to break at the weakest link (task with fewest blockers).

## Step 4: Check Settings

Read `.agents/settings.md` if it exists, for any execution preferences.

Expected format:
```markdown
# Agent Settings

## Execution
- max_parallel: 5
- default_retries: 3
```

This is optional — proceed without settings if the file is not found.

## Step 5: Present Execution Plan and Confirm

Display the execution plan:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTION PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tasks to execute: {count}
Retry limit: {retries} per task
Max parallel: {max_parallel} per wave

WAVE 1 ({n} tasks):
  1. [{id}] {title} ({priority})
  2. [{id}] {title} ({priority})
  ...

WAVE 2 ({n} tasks):
  3. [{id}] {title} ({priority}) — after [{dep_ids}]
  4. [{id}] {title} ({priority}) — after [{dep_ids}]
  ...

{Additional waves...}

BLOCKED (unresolvable dependencies):
  [{id}] {title} — blocked by: {blocker ids}
  ...

COMPLETED:
  {count} tasks already completed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Also display the session directory path (`.agents/sessions/__live_session__/`) and the files that will be created.

After displaying the plan, prompt the user to confirm before proceeding. If the user cancels, report "Execution cancelled. No tasks were modified." and stop. Do not proceed to Step 5.5 or any subsequent steps.

## Step 5.5: Initialize Execution Directory

Generate a unique `task_execution_id` using three-tier resolution:
1. IF `--task-group` was provided → `{task_group}-{YYYYMMDD}-{HHMMSS}` (e.g., `user-auth-20260321-143022`)
2. ELSE IF all open tasks (pending + in_progress) share the same non-empty `metadata.task_group` → `{task_group}-{YYYYMMDD}-{HHMMSS}`
3. ELSE → `exec-session-{YYYYMMDD}-{HHMMSS}` (e.g., `exec-session-20260321-143022`)

### Clean Stale Live Session

Before creating new files, check if `.agents/sessions/__live_session__/` contains leftover files from a previous session (e.g., due to interruption):

1. Check if `.agents/sessions/__live_session__/` exists and contains any files
2. If files are found:
   - Create `.agents/sessions/interrupted-{YYYYMMDD}-{HHMMSS}/` using the current timestamp
   - Move all contents from `__live_session__/` to the interrupted archive folder
   - Log: `Archived stale session to .agents/sessions/interrupted-{YYYYMMDD}-{HHMMSS}/`
   - **Recover interrupted tasks**:
     1. Glob `.agents/tasks/in-progress/**/*.json` to find all in-progress tasks
     2. Read each task file
     3. If an archived `task_log.md` exists, cross-reference: only reset tasks that appear in the log (they were part of the interrupted session)
     4. If no `task_log.md` available in the archive, reset ALL `in_progress` tasks (conservative approach)
     5. For each task to reset: Read the JSON, update `status` to `"pending"`, update `updated_at`, Write to `.agents/tasks/pending/{group}/task-{id}.json`, delete from `in-progress/{group}/`
     6. Log each reset: `Reset interrupted task [{id}] "{title}" from in_progress to pending`
     7. Log: `Recovered {n} interrupted tasks (reset to pending)`
3. If `__live_session__/` is empty or doesn't exist, proceed normally

### Concurrency Guard

Check for an active execution session before proceeding:

1. Check if `.agents/sessions/__live_session__/.lock` exists
2. If lock exists, read its timestamp:
   - If timestamp is **less than 4 hours old**: another session may be active. Prompt the user:
     - "Force start (remove lock)" — delete the lock and proceed
     - "Cancel" — abort execution
   - If timestamp is **more than 4 hours old**: treat as stale, delete the lock, and proceed
3. If no lock exists, proceed normally

### Create Lock File

After the concurrency check passes, create `.agents/sessions/__live_session__/.lock` with:

```markdown
task_execution_id: {task_execution_id}
timestamp: {ISO 8601 timestamp}
pid: orchestrator
```

This lock is automatically cleaned up in Step 8 when `__live_session__/` contents are archived.

### Create Session Files

Create `.agents/sessions/__live_session__/` (and `.agents/sessions/` parent if needed) with:

1. **`execution_plan.md`** — Save the execution plan displayed in Step 5
2. **`execution_context.md`** — Initialize with standard template:
   ```markdown
   # Execution Context

   ## Project Patterns
   <!-- Discovered coding patterns, conventions, tech stack details -->

   ## Key Decisions
   <!-- Architecture decisions, approach choices made during execution -->

   ## Known Issues
   <!-- Problems encountered, workarounds applied, things to watch out for -->

   ## File Map
   <!-- Important files discovered and their purposes -->

   ## Task History
   <!-- Brief log of task outcomes with relevant context -->
   ```
3. **`task_log.md`** — Initialize with table headers:
   ```markdown
   # Task Execution Log

   | Task ID | Title | Status | Attempts | Duration |
   |---------|-------|--------|----------|----------|
   ```
4. **`tasks/`** — Empty subdirectory for archiving completed task files
5. **`progress.md`** — Initialize with status template:
   ```markdown
   # Execution Progress
   Status: Initializing
   Wave: 0 of {total_waves}
   Max Parallel: {max_parallel}
   Updated: {ISO 8601 timestamp}

   ## Active Tasks

   ## Completed This Session
   ```

## Step 6: Initialize Execution Context

Read `.agents/sessions/__live_session__/execution_context.md` (created in Step 5.5).

If a prior execution session's context exists, look in `.agents/sessions/` for the most recent timestamped subfolder (not `interrupted-*` folders) and merge relevant learnings (Project Patterns, Key Decisions, Known Issues, File Map) into the new execution context.

### Context Compaction

After merging prior learnings, check the Task History section. If it has 10 or more entries from merged sessions, compact older entries:

1. Keep the 5 most recent Task History entries in full
2. Summarize all older entries into a single "Prior Sessions Summary" paragraph at the top of the Task History section
3. Replace the old individual entries with this summary

This prevents the execution context from growing unbounded across multiple execution sessions.

## Step 7: Execute Loop

Execute tasks in waves. No user interaction between waves.

### 7a: Initialize Wave

1. Find all unblocked tasks: Glob `.agents/tasks/pending/{group}/*.json` (or all groups if no filter), Read each, check `blocked_by` against the completed set (Glob `.agents/tasks/completed/{group}/*.json`, collect IDs from filenames)
2. Filter: keep tasks where every ID in `blocked_by` exists in the completed set
3. Sort by priority (same rules as Step 3d)
4. Take up to `max_parallel` tasks for this wave
5. If no unblocked tasks remain, exit the loop

### 7b: Snapshot Execution Context

Read `.agents/sessions/__live_session__/execution_context.md` and hold it as the baseline for this wave. All agents in this wave will read from this same snapshot. This prevents concurrent agents from seeing partial context writes from sibling tasks.

### 7c: Launch Wave

1. **Mark tasks in_progress**: For each task in the wave, move its file from `pending/{group}/` to `in-progress/{group}/`:
   - Read the task JSON
   - Update `status` to `"in_progress"`, set `owner` to `{task_execution_id}`, update `updated_at`
   - Write to `.agents/tasks/in-progress/{group}/task-{id}.json` (create group subdirectory if needed)
   - Delete `.agents/tasks/pending/{group}/task-{id}.json`

2. Record `wave_start_time`

3. Write the complete `progress.md` using Write (read-modify-write pattern):
   ```markdown
   # Execution Progress
   Status: Executing
   Wave: {current_wave} of {total_waves}
   Max Parallel: {max_parallel}
   Updated: {ISO 8601 timestamp}

   ## Active Tasks
   - [{id}] {title} — {active_form}
   - [{id}] {title} — {active_form}
   ...

   ## Completed This Session
   {accumulated completed tasks from prior waves}
   ```

4. **Dispatch agents using Execution Strategy:**

   **If subagent dispatch is available:**

   Dispatch one task-executor subagent per task in the wave, all in parallel in a single message turn. For each task, the dispatch prompt includes:
   - The full task JSON content (id, title, description, acceptance_criteria, testing_requirements, metadata)
   - Session path: `.agents/sessions/__live_session__/`
   - Context write path: `.agents/sessions/__live_session__/context-{id}.md`
   - Result write path: `.agents/sessions/__live_session__/result-{id}.md`
   - The task-executor agent instructions from `agents/task-executor.md`
   - Task group name (for file move operations)
   - Retry context if this is a retry attempt
   - Producer context (if applicable): For each task in the wave, check if any of its `blocked_by` tasks have a `produces_for` array containing this task's ID. If so, read the completed producer's result file (`result-{producer_id}.md`) from the session directory. Include the producer task's title and the "Files Modified" section from its result as additional context in the dispatch prompt. This gives the executor knowledge of what artifacts its upstream dependencies created.

   **If subagent dispatch is not available:**

   Execute tasks sequentially within the wave. For each task:
   a. Read `agents/task-executor.md`
   a1. Check for producer context: If any of the task's `blocked_by` tasks have `produces_for` containing this task's ID, read their result files and include the producer titles and files modified as context before starting the workflow.
   b. Follow the 4-phase workflow inline:
      - Phase 1: Read execution_context.md, parse task JSON, explore codebase
      - Phase 2: Implement changes
      - Phase 3: Verify against acceptance_criteria
      - Phase 4: Move task file if PASS, write context file, write result file
   c. After completing the task, proceed to 7d for that single task's result
   d. Then move to the next task in the wave

   Skip the polling step (5) when executing inline — result files are written synchronously.

5. **Poll for completion** (subagent path only):

   After dispatching all agents, poll for result files using the poll script:

   ```bash
   bash {skill_path}/scripts/poll-for-results.sh \
     .agents/sessions/__live_session__ {task_id_1} {task_id_2} ...
   ```

   **IMPORTANT**: Specify `timeout: 2760000` (46 minutes) on the Bash invocation. This must exceed the script's internal 45-minute timeout to ensure the script finishes before the Bash tool kills it.

   Replace `{task_id_N}` with the actual task IDs for this wave (the numeric/string portion, e.g., `task-001`).

   **Parse the output**:
   - `POLL_RESULT: ALL_DONE` — all agents finished. Proceed to 7d.
   - `POLL_RESULT: TIMEOUT` — not all agents finished within the timeout. Log the `Waiting on:` line and proceed to 7d (missing result files are handled as FAIL).
   - Bash tool timeout or no recognizable output — treat as timeout. Proceed to 7d.

### 7d: Process Results (Batch)

After polling completes (or after each inline task), process results:

1. **Read result files**: For each task in the wave, read `.agents/sessions/__live_session__/result-{id}.md`. Parse:
   - `status` line → PASS, PARTIAL, or FAIL
   - `attempt` line → attempt number
   - `## Verification` section → criterion pass counts
   - `## Files Modified` section → changed file list
   - `## Issues` section → failure details

2. **Handle missing result files** (agent crash recovery): If a result file is missing after polling:
   - Check if `context-{id}.md` exists (agent may have crashed between context and result write)
   - Treat as FAIL with reason "Agent did not produce result file"
   - The task stays in `in-progress/` for retry

3. **Measure duration** (best effort):
   - In subagent mode: if the harness provides per-agent timing metadata, use it. Otherwise set to "N/A"
   - In inline mode: measure wall-clock time between task start and result file write

4. Log a status line for each task: `[{id}] {title}: {PASS|PARTIAL|FAIL}`

5. **Batch update `task_log.md`**: Read the current file once, append ALL wave rows, Write the complete file once:
   ```markdown
   | {id} | {title} | {PASS/PARTIAL/FAIL} | {attempt}/{max_retries} | {duration} |
   ```

6. **Batch update `progress.md`**: Read the current file once, move ALL completed tasks from Active to Completed, Write the complete file once:
   ```markdown
   ## Active Tasks
   {only tasks still running, if any}

   ## Completed This Session
   - [{id}] {title} — PASS ({duration})
   - [{id}] {title} — FAIL ({duration})
   {prior completed entries}
   ```

### 7e: Within-Wave Retry

After batch processing identifies failed tasks:

1. Collect all failed tasks with retries remaining
2. For each retriable task:
   - Read the failure details from `result-{id}.md` (Issues section and Verification section)
   - Delete the old `result-{id}.md` file before re-dispatching
   - **Dispatch via Execution Strategy**:
     - Subagent path: dispatch a new task-executor subagent with failure context in the prompt
     - Inline path: re-follow the agent's 4-phase workflow with retry context
   - Update `progress.md` active task entry: `- [{id}] {title} — Retrying ({n}/{max})`
3. If any retry agents were dispatched (subagent path):
   - Poll for retry result files using `scripts/poll-for-results.sh` (same pattern as 7c step 5, with only the retry task IDs)
   - Process retry results using the same batch approach as 7d
   - Repeat 7e if any retries still have attempts remaining
4. If retries exhausted for a task:
   - Leave task as `in_progress` (do not move to `pending/` or `completed/`)
   - Log final failure
   - Retain the result file for post-analysis

### 7f: Merge Context and Clean Up After Wave

After ALL agents in the current wave have completed (including retries):

1. Read `.agents/sessions/__live_session__/execution_context.md`
2. Read all `context-{id}.md` files from `.agents/sessions/__live_session__/` in task ID order
3. Append each file's full content to the end of the `## Task History` section
4. Write the complete updated `execution_context.md` using Write
5. Delete the `context-{id}.md` files
6. **Clean up result files**: Delete `result-{id}.md` for PASS tasks. Retain `result-{id}.md` for FAIL tasks (available for post-session analysis in the archived session folder)

### 7g: Rebuild Next Wave and Archive

1. **Archive completed task files**: For each PASS task in this wave, copy the task JSON from `.agents/tasks/completed/{group}/` to `.agents/sessions/__live_session__/tasks/` (the task-executor already moved the file to `completed/` in Phase 4)
2. **Re-scan for unblocked tasks**: Glob `.agents/tasks/pending/{group}/*.json` (or all groups), Read each, check `blocked_by` against the updated completed set
3. If newly unblocked tasks found, form the next wave using priority sort from Step 3d
4. If no unblocked tasks remain, exit the loop
5. Loop back to 7a

## Step 8: Session Summary

Write the complete `progress.md` with final status using Write:
```markdown
# Execution Progress
Status: Complete
Wave: {total_waves} of {total_waves}
Max Parallel: {max_parallel}
Updated: {ISO 8601 timestamp}

## Active Tasks

## Completed This Session
{all completed task entries}
```

After all tasks in the plan have been processed:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tasks executed: {total attempted}
  Passed: {count}
  Failed: {count} (after {total retries} total retry attempts)

Waves completed: {wave_count}
Max parallel: {max_parallel}

Remaining:
  Pending: {count}
  In Progress (failed): {count}
  Blocked: {count}

{If any tasks failed:}
FAILED TASKS:
  [{id}] {title} — {brief failure reason}
  ...

{If newly unblocked tasks were discovered:}
NEWLY UNBLOCKED:
  [{id}] {title} — unblocked by completion of [{blocker_id}]
  ...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

After displaying the summary:
1. Save `session_summary.md` to `.agents/sessions/__live_session__/` with the full summary content
2. **Archive the session**: Create `.agents/sessions/{task_execution_id}/` and move all contents from `__live_session__/` to the archival folder. The `.lock` file is moved to the archive along with all other session files, releasing the concurrency guard.
3. `__live_session__/` is left as an empty directory (not deleted)

## Step 9: Update Project Documentation (Optional)

Review `.agents/sessions/{task_execution_id}/execution_context.md` for project-wide changes that should be reflected in project documentation.

Update project documentation (CLAUDE.md, AGENTS.md, or similar) if the session introduced:
- New architectural patterns or conventions
- New dependencies or tech stack changes
- New development commands or workflows
- Changes to project structure
- Important design decisions that affect future development

Do NOT update for:
- Internal implementation details
- Temporary workarounds
- Task-specific learnings that don't generalize

If no meaningful project-wide changes occurred, skip this step.

## Notes

- Tasks are managed through file-based operations on `.agents/tasks/` (Read, Write, Glob)
- Each task is handled by the `task-executor` agent in isolation
- The execution context file enables knowledge sharing across task boundaries
- Failed tasks remain as `in_progress` for manual review or re-execution
- Run the execute-tasks skill again to pick up where you left off — it will execute any remaining unblocked tasks
