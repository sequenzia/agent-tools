# Task File Operations

Detailed procedures for file-based CRUD operations on `.agents/tasks/` task files. All operations use the `Read`, `Write`, and `Glob` tools — no harness-specific task tools required.

---

## Initialize Task Group

Create the directory structure and manifest for a new task group.

**Procedure:**

1. Check if `.agents/tasks/` directory exists. If not, create it with all subdirectories:
   ```
   .agents/tasks/_manifests/
   .agents/tasks/backlog/
   .agents/tasks/pending/
   .agents/tasks/in-progress/
   .agents/tasks/completed/
   ```
2. Write the manifest file at `.agents/tasks/_manifests/{group}.json`:

```json
{
  "version": "2.0",
  "task_group": "{task-group-slug}",
  "spec_path": "{path-to-spec}",
  "created_at": "{ISO-8601-timestamp}",
  "updated_at": "{ISO-8601-timestamp}",
  "total_tasks": 0,
  "pending_count": 0,
  "backlog_count": 0,
  "dependency_count": 0,
  "producer_consumer_count": 0,
  "complexity_breakdown": {},
  "priority_breakdown": {}
}
```

3. The `task_group` should be a kebab-case slug (e.g., `user-authentication`).
4. The `created_at` and `updated_at` timestamps should be set to the current time.

---

## Add Task

Write a new task as an individual JSON file.

**Procedure:**

1. Determine the next sequential ID:
   - Glob `.agents/tasks/*/{group}/*.json` to find all existing task files for this group
   - Find the highest numeric suffix among existing filenames (e.g., `task-015` → 15)
   - Increment by 1 and zero-pad to 3 digits (→ `task-016`)
   - If no tasks exist, start at `task-001`
2. Determine the target status directory:
   - Tasks from the current/selected phase → `pending/`
   - Tasks from future/non-selected phases → `backlog/`
   - Tasks with no phase (phaseless specs) → `pending/`
3. Create the group subdirectory if it doesn't exist:
   ```
   .agents/tasks/{status}/{group}/
   ```
4. Construct the task JSON with all required fields:
   - Set `status` to match the target directory
   - Set `owner` to `null`
   - Set `created_at` and `updated_at` to the current time
5. Write the task file: `.agents/tasks/{status}/{group}/task-NNN.json`
6. Update the manifest's `updated_at` timestamp

---

## Update Task

Modify an existing task's fields.

**Procedure:**

1. Read the task file from its current location
2. Modify only the specified fields — omitted fields remain unchanged
3. Update the `updated_at` timestamp
4. If `status` was changed, perform a **Move** (see below) instead of writing back to the same location
5. Write the updated task file
6. Update the manifest's `updated_at` timestamp

### Metadata Updates

When updating `metadata`, merge the new keys with existing metadata:
- Keys provided in the update are added or overwritten
- Keys not mentioned in the update remain unchanged
- To remove a key, set it to `null` in the update, then strip `null` values before writing

```
Existing metadata: { "priority": "high", "task_group": "auth" }
Update metadata:   { "complexity": "medium" }
Result:            { "priority": "high", "task_group": "auth", "complexity": "medium" }

Update metadata:   { "task_group": null }
Result:            { "priority": "high", "complexity": "medium" }
```

---

## Move Task (Status Transition)

Transition a task's status by moving its file between status directories.

**Procedure:**

1. Validate the transition is allowed (see Status Lifecycle in SKILL.md)
2. Read the task file from its current location
3. Update the `status` field to the new status
4. Update the `updated_at` timestamp
5. Create the target group subdirectory if it doesn't exist:
   ```
   .agents/tasks/{new-status}/{group}/
   ```
6. Write the task file to the new location:
   ```
   .agents/tasks/{new-status}/{group}/task-NNN.json
   ```
7. Delete the file from the old location
8. Update the manifest's `updated_at` timestamp

**Example — claiming a task:**
```
Source:      .agents/tasks/pending/user-auth/task-001.json
Destination: .agents/tasks/in-progress/user-auth/task-001.json

Update:
  status: "pending" → "in_progress"
  owner: null → "agent-worker-1"
  updated_at: "{current-time}"
```

**Example — completing a task:**
```
Source:      .agents/tasks/in-progress/user-auth/task-001.json
Destination: .agents/tasks/completed/user-auth/task-001.json

Update:
  status: "in_progress" → "completed"
  updated_at: "{current-time}"
```

---

## Delete Task

Remove a task file from disk.

**Procedure:**

1. Locate the task file across status directories:
   ```
   Glob: .agents/tasks/*/{group}/task-NNN.json
   ```
2. Delete the file
3. Update the manifest's `updated_at` timestamp

There is no soft-delete status. Git history preserves the record of deleted tasks.

---

## Query Tasks

Scan directories with Glob patterns to find and filter tasks.

### By Status

```
All pending tasks for a group:    .agents/tasks/pending/{group}/*.json
All in-progress across groups:    .agents/tasks/in-progress/**/*.json
All completed tasks:              .agents/tasks/completed/**/*.json
All backlog tasks:                .agents/tasks/backlog/**/*.json
```

### All Tasks for a Group

```
.agents/tasks/*/{group}/*.json
```

This scans all status directories. Exclude `_manifests/` from results (it doesn't have group subdirectories with task files).

### By Metadata Field

After globbing task files, read each and filter by metadata:
```
Filter: task.metadata.task_group == "user-auth"
Filter: task.metadata.spec_phase == 1
Filter: task.metadata.priority == "critical"
```

### By Phase

```
Filter: task.metadata.spec_phase == 2
Sort by: task.metadata.priority (critical > high > medium > low)
```

### By Unblocked Status

Find tasks ready to execute:
```
1. Glob .agents/tasks/completed/{group}/*.json
2. Build set: completed_ids = { filename stem for each file }
3. Glob .agents/tasks/pending/{group}/*.json
4. Read each pending task
5. Filter: every id in task.blocked_by is in completed_ids
6. Sort by: priority (critical first), then spec_phase (lower first), then id
```

---

## Find Next Available

Locate the highest-priority task that is ready to execute.

**Algorithm:**

```
1. Glob .agents/tasks/pending/{group}/*.json
2. Read each task file
3. Glob .agents/tasks/completed/{group}/*.json
4. Build completed set:
     completed_ids = { stem of filename | e.g., "task-001" from "task-001.json" }
5. Filter candidates:
     candidates = [
       t for t in pending_tasks
       where all(dep in completed_ids for dep in t.blocked_by)
     ]
6. Sort candidates:
     - By priority: critical > high > medium > low
     - By spec_phase: lower phase first (if present)
     - By id: task-001 before task-002 (tiebreaker)
7. Return first candidate, or null if none available
```

**Priority ordering map:**
```
critical: 0
high:     1
medium:   2
low:      3
```

---

## Merge Mode

Handle re-running task generation against an existing task group. Match tasks by `task_uid` across all status directories and apply merge rules.

**Procedure:**

1. Glob `.agents/tasks/*/{group}/*.json` to find all existing tasks
2. Read each task file
3. Build a UID-to-task mapping: `{ task.metadata.task_uid: { task, file_path } }`
4. For each new task to merge:
   a. Look up by `task_uid` in the mapping
   b. Apply merge rules based on existing status (see table below)
   c. If no match, this is a new task — write it with a new sequential ID
5. Handle potentially obsolete tasks: existing tasks with no matching `task_uid` in the new set
6. Update the manifest's `updated_at` timestamp

### Merge Rules by Status

| Existing Status | Action |
|-----------------|--------|
| `pending` | Update `description`, `title`, `active_form`, `acceptance_criteria`, `testing_requirements`, and metadata. Preserve `id`, `status`, and file location. |
| `backlog` | Same as `pending` — update content, preserve identity and status. |
| `in_progress` | Preserve `status`, `owner`, and file location. Optionally update `description` if content changed. |
| `completed` | **Never modify.** Skip entirely. |

### Handling New Tasks in Merge

New tasks (no matching `task_uid`) are added with:
- A new sequential ID (continuing from the highest existing ID across all status directories)
- Status `pending` or `backlog` based on phase rules
- File written to the appropriate status directory

### Handling Obsolete Tasks

Existing tasks with no matching `task_uid` in the new generation may be obsolete. Present them to the user with options:
- **Keep**: Requirements may still be relevant outside the current spec
- **Delete**: Remove the file from disk

---

## Batch Task Creation

When creating many tasks at once (e.g., from a spec), build all tasks in memory before writing:

**Procedure:**

1. Build the complete task list in memory
2. Assign sequential IDs: `task-001`, `task-002`, ...
3. Set all `blocked_by` references using the assigned IDs
4. Set `produces_for` metadata where detected
5. Determine target directory for each task:
   - Current/selected phase tasks → `pending/{group}/`
   - Future/non-selected phase tasks → `backlog/{group}/`
6. Create group subdirectories as needed
7. Write each task as an individual file in a single batch
8. Write the manifest file to `.agents/tasks/_manifests/{group}.json`

This atomic approach ensures all relationships are resolved before any file I/O. Each task is written as its own file, enabling independent reads and updates.
