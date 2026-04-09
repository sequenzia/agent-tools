# Orchestration Reference (Inline)

This reference provides the detailed 9-step orchestration loop for executing SDD tasks sequentially in a single context. The execute-tasks-windsurf skill uses this procedure to manage the full execution session.

All task management is file-based: tasks are JSON files in `.agents/tasks/` directories, managed via Read, Write, and Glob per `sdd-tasks/references/operations.md`.

## File Operation Guidelines

All orchestrator writes to session artifacts (`execution_context.md`, `task_log.md`, `progress.md`) MUST use **Write** (full file replacement), never **Edit**. The Edit tool relies on exact string matching which becomes unreliable as these files grow during execution. Instead, use a **read-modify-write** pattern:

1. **Read** the current file contents
2. **Modify** in memory (append rows, update sections, etc.)
3. **Write** the complete updated file

This ensures atomic, reliable updates regardless of file size or content changes.

## Helper Scripts

This skill includes Bash scripts (using python3 for JSON manipulation) that handle the most fragile file operations deterministically. These scripts prevent data loss from context decay — even if the agent forgets the detailed procedure, calling the script with the right arguments produces the correct result.

**`scripts/move-task.sh`** — Atomically move a task JSON between status directories:
```bash
bash {skill_path}/scripts/move-task.sh <source-path> <dest-dir> --status <new-status> [--owner <owner>]
```
- Reads source JSON, updates only specified fields, writes to destination, verifies integrity, deletes source
- Use `--owner null` to clear the owner field
- Outputs `MOVE_RESULT: OK` or `MOVE_RESULT: FAIL` with details

**`scripts/append-task-history.sh`** — Append a task history entry to execution_context.md:
```bash
bash {skill_path}/scripts/append-task-history.sh <execution-context-path> <<'ENTRY'
task_id: {id}
title: {title}
status: {PASS/PARTIAL/FAIL}
files_modified: {comma-separated list}
learnings: {key discoveries}
issues: {problems or "None"}
ENTRY
```
- Reads the file, locates `## Task History`, appends formatted entry, writes complete file
- Outputs `HISTORY_RESULT: OK` or `HISTORY_RESULT: FAIL`

**`scripts/verify-task-file.sh`** — Verify task file integrity:
```bash
bash {skill_path}/scripts/verify-task-file.sh <task-file-path>
```
- Checks for `acceptance_criteria`, `testing_requirements`, `metadata.task_uid`, `active_form`
- Outputs `VERIFY_RESULT: OK` or `VERIFY_RESULT: FAIL`

> **Note on `{skill_path}`**: During initialization (Step 5.5), resolve the actual path to this skill's directory and use it in all script invocations. The path is also written into `task-checklist.md` so it's available for each task.

## Result File Protocol

### Purpose

Provide a persistent record of each task's outcome for session archival and retry context. Unlike the subagent version (where result files serve as completion signals for polling), in inline mode the orchestrator already has the result — the file is written for record-keeping.

### File Format

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

### Usage

- Written after each task for record-keeping and retry context
- For failed tasks being retried, the previous result file provides failure details
- Retained for FAIL tasks in the archived session for post-analysis
- Deleted for PASS tasks during dependency level cleanup

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
- `metadata.priority` for level sorting
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

### 3a: Note on Parallelism

The inline version executes all tasks sequentially regardless of dependency level size. Dependency levels define execution order — all tasks in a level have their dependencies satisfied and can be executed in any order within the level. The `--max-parallel` argument is not supported.

### 3b: Build Dependency Graph

Collect all pending tasks and build a dependency graph from `blocked_by` relationships.

If a specific `task-id` was provided, the plan contains only that task (single-task mode).

### 3c: Assign Tasks to Dependency Levels

Use topological sorting to assign tasks to dependency-based levels:
- **Level 1**: All pending tasks with empty `blocked_by` list (no dependencies)
- **Level 2**: Tasks whose dependencies are ALL in Level 1 or already completed
- **Level 3**: Tasks whose dependencies are ALL in Level 1, Level 2, or already completed
- Continue until all tasks are assigned to levels

If task group filtering is active, only include tasks matching the specified group.

### 3d: Sort Within Levels

Within each dependency level, sort by priority:
1. `critical` tasks first
2. `high` tasks next
3. `medium` tasks next
4. `low` tasks last
5. Tasks without priority metadata last

Break ties by "unblocks most others" — tasks that appear in the most `blocked_by` lists of other tasks execute first.

### 3e: Circular Dependency Detection

Detect circular dependencies: if any tasks remain unassigned after topological sorting, they form a cycle. Report the cycle to the user and attempt to break at the weakest link (task with fewest blockers).

## Step 4: Check Settings

Read `.agents/settings.md` if it exists, for any execution preferences.

Expected format:
```markdown
# Agent Settings

## Execution
- default_retries: 3
```

This is optional — proceed without settings if the file is not found.

## Step 5: Present Execution Plan and Confirm

Display the execution plan:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTION PLAN (Sequential)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tasks to execute: {count}
Retry limit: {retries} per task
Execution: Sequential (inline)

DEPENDENCY LEVEL 1 ({n} tasks):
  1. [{id}] {title} ({priority})
  2. [{id}] {title} ({priority})
  ...

DEPENDENCY LEVEL 2 ({n} tasks):
  3. [{id}] {title} ({priority}) — after [{dep_ids}]
  4. [{id}] {title} ({priority}) — after [{dep_ids}]
  ...

{Additional levels...}

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
     5. For each task to reset, use the move script:
        ```bash
        bash {skill_path}/scripts/move-task.sh .agents/tasks/in-progress/{group}/task-{id}.json \
          .agents/tasks/pending/{group}/ --status pending --owner null
        ```
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
   Execution: Sequential (inline)
   Dependency Level: 0 of {total_levels}
   Updated: {ISO 8601 timestamp}

   ## Active Task

   ## Completed This Session
   ```
6. **`task-checklist.md`** — Write the per-task checklist with the resolved `{skill_path}`:
   ```markdown
   # Per-Task Checklist

   Re-read this file before starting each task. It contains the critical
   post-task steps that ensure results are recorded and task files are preserved.

   ## Before Task
   1. Read this checklist (you're doing it now)
   2. Read .agents/sessions/__live_session__/execution_context.md for cross-task learnings
   3. Read the task JSON from in-progress/{group}/task-{id}.json

   ## Execute Task
   4. Phase 1 (Understand): Review context, read task JSON, explore codebase
   5. Phase 2 (Implement): Follow project patterns, write tests
   6. Phase 3 (Verify): Walk acceptance_criteria categories, run tests
   7. Determine status: PASS | PARTIAL | FAIL

   ## After Task — CRITICAL (follow these steps exactly)

   ### 8. Move task file (if PASS):
   ```
   bash {skill_path}/scripts/move-task.sh \
     .agents/tasks/in-progress/{group}/task-{id}.json \
     .agents/tasks/completed/{group}/ \
     --status completed
   ```
   If PARTIAL or FAIL, leave the task in in-progress/ (do not move it).

   ### 9. Record task history:
   ```
   bash {skill_path}/scripts/append-task-history.sh \
     .agents/sessions/__live_session__/execution_context.md <<'ENTRY'
   task_id: {id}
   title: {title}
   status: {PASS/PARTIAL/FAIL}
   files_modified: {comma-separated list of files changed}
   learnings: {key patterns, conventions, file locations discovered}
   issues: {problems encountered or "None"}
   ENTRY
   ```

   ### 10. Write result file
   Write result-{id}.md to .agents/sessions/__live_session__/ with verification summary.

   ### 11. Update session logs
   - Append row to task_log.md (read-modify-write with Write tool)
   - Update progress.md (move task from Active to Completed)

   ### 12. Update execution_context.md sections (optional)
   If the task revealed new Project Patterns, Key Decisions, Known Issues, or File Map
   entries, also update those sections in execution_context.md (read-modify-write).

   ## Then proceed to next task (go back to step 1)
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

Execute tasks sequentially through dependency levels. No user interaction between tasks. Track a running task count for context compaction.

### Context Refresh Protocol

Before each task, Read BOTH of these files:
1. **`task-checklist.md`** — Refreshes the per-task procedure (combats instruction decay from context compression)
2. **`execution_context.md`** — Refreshes cross-task knowledge (patterns, decisions, file map, history)

This dual-refresh ensures the agent always has fresh instructions AND fresh context, even after Windsurf compresses earlier conversation turns.

### 7a: Initialize Dependency Level

1. Find all unblocked tasks: Glob `.agents/tasks/pending/{group}/*.json` (or all groups if no filter), Read each, check `blocked_by` against the completed set (Glob `.agents/tasks/completed/{group}/*.json`, collect IDs from filenames)
2. Filter: keep tasks where every ID in `blocked_by` exists in the completed set
3. Sort by priority (same rules as Step 3d)
4. If no unblocked tasks remain, exit the loop

### 7b: Execute Tasks Sequentially

For each task in the current dependency level:

1. **Mark task in_progress** using the move script:
   ```bash
   bash {skill_path}/scripts/move-task.sh \
     .agents/tasks/pending/{group}/task-{id}.json \
     .agents/tasks/in-progress/{group}/ \
     --status in_progress --owner {task_execution_id}
   ```

2. **Update progress.md** using Write (read-modify-write pattern):
   ```markdown
   # Execution Progress
   Status: Executing
   Execution: Sequential (inline)
   Dependency Level: {current_level} of {total_levels}
   Updated: {ISO 8601 timestamp}

   ## Active Task
   - [{id}] {title} — {active_form}

   ## Completed This Session
   {accumulated completed tasks from prior levels}
   ```

3. **Context refresh** (follow Context Refresh Protocol above):
   - Re-read `.agents/sessions/__live_session__/task-checklist.md` — refreshes the per-task procedure
   - Re-read `.agents/sessions/__live_session__/execution_context.md` — refreshes cross-task knowledge

4. **Check for producer context**: If any of the task's `blocked_by` tasks have a `produces_for` array containing this task's ID, read the completed producer's result file (`result-{producer_id}.md`) from the session directory.

5. **Execute 4-phase workflow inline**:

   **Phase 1 — Understand:**
   - `execution_context.md` was just read (step 3) — review Project Patterns, Key Decisions, Known Issues, File Map, and recent Task History
   - Read task JSON from `in-progress/{group}/task-{id}.json`
   - Parse `acceptance_criteria` and `testing_requirements`
   - Read project conventions (CLAUDE.md, AGENTS.md, or similar)
   - Explore affected files via Glob/Grep
   - Read key files that will be modified
   - If retry: read previous result file, assess codebase state (run linter/tests), decide whether to build on partial work or revert

   **Phase 2 — Implement:**
   - Read target files before modifying
   - Follow implementation order (data → service → interface → tests)
   - Match existing patterns and conventions
   - Run mid-implementation checks (linter, existing tests)
   - Write tests per `testing_requirements`

   **Phase 3 — Verify:**
   - Walk each `acceptance_criteria` category (Functional, Edge Cases, Error Handling, Performance)
   - Check `testing_requirements`
   - Run tests and linter
   - Apply pass threshold rules per `../execute-tasks/references/verification-patterns.md`

   **Phase 4 — Complete (Inline-Specific):**
   - Determine status (PASS/PARTIAL/FAIL)
   - If PASS — move task file using the script:
     ```bash
     bash {skill_path}/scripts/move-task.sh \
       .agents/tasks/in-progress/{group}/task-{id}.json \
       .agents/tasks/completed/{group}/ \
       --status completed
     ```
   - If PARTIAL or FAIL: leave in `in-progress/`

6. **Write result file**: Write `result-{id}.md` to `.agents/sessions/__live_session__/` using the standard format (see Result File Protocol above). This is for record-keeping and retry context.

7. **Record task history** using the script:
   ```bash
   bash {skill_path}/scripts/append-task-history.sh \
     .agents/sessions/__live_session__/execution_context.md <<'ENTRY'
   task_id: {id}
   title: {title}
   status: {PASS/PARTIAL/FAIL}
   files_modified: {comma-separated list of files created or changed}
   learnings: {patterns discovered, conventions noted, useful file locations}
   issues: {problems hit, workarounds applied, or "None"}
   ENTRY
   ```

   Also update Project Patterns, Key Decisions, Known Issues, and File Map sections in `execution_context.md` as relevant (read-modify-write with Write tool).

8. **Update task_log.md**: Read the current file, append the task row, Write the complete file:
   ```markdown
   | {id} | {title} | {PASS/PARTIAL/FAIL} | {attempt}/{max_retries} | {duration} |
   ```

9. **Update progress.md**: Read the current file, move the task from Active to Completed, Write the complete file:
   ```markdown
   ## Active Task

   ## Completed This Session
   - [{id}] {title} — {PASS|PARTIAL|FAIL} ({duration})
   {prior completed entries}
   ```

10. **Context compaction check**: Increment the running task count. If `count % 5 == 0`, compact `execution_context.md`:
    - Read the file
    - Count Task History entries
    - If more than 5 entries: keep the last 5 in full, summarize all older entries into a "Prior Tasks Summary" paragraph at the top of the Task History section
    - Keep Project Patterns, Key Decisions, Known Issues, File Map sections in full
    - Write the compacted file

### 7c: Inline Retry

After executing a task, if the result is FAIL and retries remain:

1. Read the failure details from `result-{id}.md` (Issues section and Verification section)
2. Delete the old `result-{id}.md`
3. Follow the Context Refresh Protocol: re-read `task-checklist.md` and `execution_context.md`
4. Re-execute the 4-phase workflow inline with retry context:
   - Phase 1 includes: read previous failure details, assess codebase state (run linter/tests to see what previous attempt left behind), decide whether to build on partial work or revert and try differently
5. Process the retry result using steps 6-10 from 7b
6. If retries exhausted for a task:
   - Leave task as `in_progress` (do not move to `pending/` or `completed/`)
   - Log final failure
   - Retain the result file for post-analysis
   - Continue to next task

### 7d: Complete Dependency Level and Archive

After ALL tasks in the current dependency level have been processed (including retries):

1. **Archive completed task files**: For each PASS task in this level, copy the task JSON from `.agents/tasks/completed/{group}/` to `.agents/sessions/__live_session__/tasks/` (the task was already moved to `completed/` in Phase 4)
2. **Clean up result files**: Delete `result-{id}.md` for PASS tasks. Retain `result-{id}.md` for FAIL tasks (available for post-session analysis in the archived session folder)
3. **Re-scan for unblocked tasks**: Glob `.agents/tasks/pending/{group}/*.json` (or all groups), Read each, check `blocked_by` against the updated completed set
4. If newly unblocked tasks found, form the next dependency level using priority sort from Step 3d
5. If no unblocked tasks remain, exit the loop
6. Loop back to 7a

## Step 8: Session Summary

Write the complete `progress.md` with final status using Write:
```markdown
# Execution Progress
Status: Complete
Execution: Sequential (inline)
Dependency Level: {total_levels} of {total_levels}
Updated: {ISO 8601 timestamp}

## Active Task

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

Dependency levels completed: {level_count}
Execution: Sequential (inline)

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
- Each task is executed inline within the orchestrator's context
- The execution context file enables knowledge sharing across task boundaries via the "File as External Memory" pattern
- Context compaction (every ~5 tasks) prevents the execution context from growing unbounded
- Failed tasks remain as `in_progress` for manual review or re-execution
- Run the execute-tasks-windsurf skill again to pick up where you left off — it will execute any remaining unblocked tasks
