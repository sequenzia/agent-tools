# Task File Operations

Detailed procedures for file-based CRUD operations on `.tasks/{task-group}.json` files. All operations use the `Read` and `Write` tools — no harness-specific task tools required.

---

## Initialize Task File

Create a new task file for a task group.

**Procedure:**

1. Check if `.tasks/` directory exists. If not, create it.
2. Write the initial file structure:

```json
{
  "version": "1.0",
  "task_group": "{task-group-slug}",
  "spec_path": "{path-to-spec}",
  "created_at": "{ISO-8601-timestamp}",
  "updated_at": "{ISO-8601-timestamp}",
  "tasks": []
}
```

3. The `task_group` should be a kebab-case slug (e.g., `user-authentication`).
4. The `created_at` and `updated_at` timestamps should be set to the current time.

---

## Add Task

Append a new task to an existing task file.

**Procedure:**

1. Read the task file with the `Read` tool
2. Parse the JSON content
3. Generate the next sequential ID:
   - Find the highest numeric suffix among existing task IDs
   - Increment by 1, zero-pad to 3 digits
   - Format as `task-NNN`
   - If no tasks exist, start at `task-001`
4. Construct the task object with all required fields:
   - Set `status` to `"pending"`
   - Set `owner` to `null`
   - Set `blocks` to `[]` (will be recomputed)
5. Append the task to the `tasks` array
6. Recompute `blocks` for all tasks (see Recompute Blocks below)
7. Update the `updated_at` timestamp
8. Write the entire file using the `Write` tool

**Important:** The entire file is written atomically. There is no partial update — always read the full file, modify in memory, and write the complete result.

---

## Update Task

Modify an existing task's fields.

**Procedure:**

1. Read the task file
2. Find the task by `id`
3. Modify only the specified fields — omitted fields remain unchanged
4. If `blocked_by` was modified, recompute `blocks` for all tasks
5. If `status` was changed, validate the transition (see Status Lifecycle in SKILL.md)
6. Update the `updated_at` timestamp
7. Write the entire file

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

## Query Tasks

Filter and retrieve tasks matching specific criteria.

### By Status

```
Filter: task.status == "pending"
```

### By Metadata Field

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
1. Build set: completed_ids = { t.id for t in tasks where t.status == "completed" }
2. Filter: t.status == "pending" AND every id in t.blocked_by is in completed_ids
3. Sort by: priority (critical first), then spec_phase (lower first), then id
```

---

## Find Next Available

Locate the highest-priority task that is ready to execute.

**Algorithm:**

```
1. Read .tasks/{task-group}.json
2. Build completed set:
     completed_ids = { t.id | t in tasks, t.status == "completed" }
3. Filter candidates:
     candidates = [
       t for t in tasks
       where t.status == "pending"
       and all(dep in completed_ids for dep in t.blocked_by)
     ]
4. Sort candidates:
     - By priority: critical > high > medium > low
     - By spec_phase: lower phase first (if present)
     - By id: task-001 before task-002 (tiebreaker)
5. Return first candidate, or null if none available
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

Handle re-running task generation against an existing task file. Match tasks by `task_uid` and apply merge rules based on existing task status.

**Procedure:**

1. Read the existing task file
2. Build a UID-to-task mapping: `{ t.metadata.task_uid: t for t in existing_tasks }`
3. For each new task to merge:
   a. Look up by `task_uid` in the mapping
   b. Apply merge rules based on existing status (see table below)
   c. If no match, this is a new task — add it with a new sequential ID
4. Handle potentially obsolete tasks: existing tasks with no matching `task_uid` in the new set
5. Recompute `blocks` for all tasks
6. Update `updated_at` timestamp
7. Write the file

### Merge Rules by Status

| Existing Status | Action |
|-----------------|--------|
| `pending` | Update `description`, `title`, `active_form`, and metadata. Preserve `id` and `status`. |
| `in_progress` | Preserve `status` and `owner`. Optionally update `description` if content changed. |
| `completed` | **Never modify.** Skip entirely. |
| `deleted` | Skip — treat as if no match found (create as new). |

### Handling New Tasks in Merge

New tasks (no matching `task_uid`) are added with:
- A new sequential ID (continuing from the highest existing ID)
- Status `pending`
- Dependencies set using the UID-to-ID mapping for both new and existing tasks

### Handling Obsolete Tasks

Existing tasks with no matching `task_uid` in the new generation may be obsolete. Present them to the user with options:
- **Keep**: Requirements may still be relevant outside the current spec
- **Mark deleted**: Requirements changed, tasks no longer needed

---

## Recompute Blocks

The `blocks` field is the computed inverse of all `blocked_by` relationships. Recompute it whenever `blocked_by` changes on any task.

**Algorithm:**

```
1. Initialize: for every task, set blocks = []
2. For each task T in the file:
   a. For each ID in T.blocked_by:
      b. Find the task with that ID
      c. Add T.id to that task's blocks array
3. Deduplicate each blocks array (should already be unique, but safety check)
```

**Example:**

```
task-001: blocked_by = []
task-002: blocked_by = ["task-001"]
task-003: blocked_by = ["task-001"]
task-004: blocked_by = ["task-002", "task-003"]

After recompute:
task-001: blocks = ["task-002", "task-003"]
task-002: blocks = ["task-004"]
task-003: blocks = ["task-004"]
task-004: blocks = []
```

Always recompute `blocks` for the **entire file** — not just the modified task — because adding a `blocked_by` to one task affects another task's `blocks`.

---

## Batch Task Creation

When creating many tasks at once (e.g., from a spec), build all tasks in memory before writing:

**Procedure:**

1. Build the complete task array in memory
2. Assign sequential IDs: `task-001`, `task-002`, ...
3. Set all `blocked_by` references using the assigned IDs
4. Compute all `blocks` as the inverse of `blocked_by`
5. Set `produces_for` metadata where detected
6. Write the entire `.tasks/{task-group}.json` file in a single operation

This atomic approach eliminates the need for two-pass create-then-update workflows. All relationships are resolved before any file I/O.
