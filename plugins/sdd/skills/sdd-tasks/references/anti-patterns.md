# Task Anti-Patterns

Common mistakes when working with tasks and their correct alternatives. Each anti-pattern includes what it looks like, why it causes problems, and how to do it right.

---

## AP-01: Circular Dependencies

**Description**: Creating tasks where A is blocked by B, and B is blocked by A (directly or through a chain), causing a deadlock where no task in the cycle can ever start.

```json
{
  "id": "task-001",
  "blocked_by": ["task-002"]
},
{
  "id": "task-002",
  "blocked_by": ["task-001"]
}
```

Longer chains are harder to spot: task-001 → task-002 → task-003 → task-001.

**Why It's Problematic**: Tasks caught in a cycle will remain `pending` forever. No task in the cycle can transition to `in_progress` because each one is waiting for another task in the same cycle to complete. Orchestrators will detect this as a deadlock and either break the cycle heuristically or halt execution.

**Correct Alternative**: Before adding a dependency, trace the chain to confirm it does not loop back. If two tasks genuinely share information, extract the shared artifact into a third task that both depend on.

```json
{
  "id": "task-001",
  "title": "Define shared request/response types",
  "blocked_by": []
},
{
  "id": "task-002",
  "title": "Create API routes",
  "blocked_by": ["task-001"]
},
{
  "id": "task-003",
  "title": "Create request handlers",
  "blocked_by": ["task-001"]
}
```

To detect cycles: walk the `blocked_by` chain from each task. If you revisit a task already seen, a cycle exists. Break it at the weakest link — the dependency with the least coupling.

---

## AP-02: Too-Granular Tasks

**Description**: Creating a separate task for every minor code change — individual imports, single type annotations, one-line config edits — instead of grouping related changes into coherent units.

```
task-001: "Add import for UserSchema"
task-002: "Add type annotation to create_user"
task-003: "Add UserSchema to __init__.py exports"
task-004: "Update type-checking config"
```

**Why It's Problematic**: Each task carries overhead — agent initialization, context loading, file reading, verification, and result reporting. Five trivial tasks consume roughly 5x the resources of one well-scoped task. Overly granular tasks also create unnecessary dependency chains that serialize work that could be done in a single pass.

**Correct Alternative**: Scope tasks to 1-3 files of cohesive work. A good task represents a logical unit that can be implemented, tested, and verified independently.

```json
{
  "id": "task-001",
  "title": "Add type annotations to user module",
  "description": "Add type hints to all public functions:\n- Import UserSchema and related types\n- Annotate create_user, get_user, update_user\n- Export types from __init__.py\n- Update type-checking config if needed"
}
```

**Right-sizing heuristic**: If a task can be described in a single imperative sentence and touches 1-3 files, it is likely the right size. If it needs 10+ bullet points across 8 files, split it.

---

## AP-03: Missing active_form

**Description**: Creating tasks without the `active_form` field, leaving execution UIs without progress text.

```json
{
  "id": "task-001",
  "title": "Implement rate limiting middleware",
  "active_form": ""
}
```

**Why It's Problematic**: The `active_form` field provides real-time feedback during execution. Without it, orchestrators and UIs display a generic status instead of describing what is actively happening. In multi-task executions, missing `active_form` makes it difficult to distinguish what each task is doing.

**Correct Alternative**: Always provide `active_form` as the present-continuous form of the imperative `title`.

| title | active_form |
|-------|-------------|
| "Create user schema" | "Creating user schema" |
| "Fix login timeout bug" | "Fixing login timeout bug" |
| "Add JWT authentication" | "Adding JWT authentication" |
| "Refactor payment module" | "Refactoring payment module" |

---

## AP-04: Batch Status Updates

**Description**: Marking multiple tasks as `in_progress` simultaneously, either by updating several tasks before starting work on any of them.

**Why It's Problematic**: The `in_progress` status signals that a task is actively being worked on. If a single agent marks three tasks as `in_progress` but can only work on one at a time, the other two are falsely reporting active progress. This confuses orchestrators that use status to track occupied tasks, and if the agent crashes, all three tasks are left in a dirty state requiring cleanup.

**Correct Alternative**: Follow the sequential claim-work-complete pattern. Only mark a task `in_progress` when you are about to start working on it. Complete it (or reset it) before claiming the next one.

The exception is multi-agent orchestration where each agent claims exactly one task. Even then, each individual agent only marks one task `in_progress` at a time.

---

## AP-05: Duplicate Task Creation

**Description**: Adding tasks without first checking whether an equivalent task already exists, resulting in duplicates that cause double work.

**Why It's Problematic**: Duplicate tasks waste execution resources — two agents may work on the same change simultaneously, producing merge conflicts. If duplicates have slightly different descriptions, agents may implement conflicting versions. Completed status on one duplicate does not affect the other, so orchestrators may re-execute finished work.

**Correct Alternative**: Before creating tasks, scan existing task files across all status directories and check `task_uid` metadata. If a task with a matching `task_uid` exists, update it instead of creating a new one. Skills like `create-tasks` use this merge mode automatically.

---

## AP-06: Summary-Only Consumption

**Description**: Working from task `title` alone without reading the full task file before starting work.

**Why It's Problematic**: The `title` is a 5-10 word imperative summary. The task file contains the full specification: acceptance criteria, testing requirements, implementation context, and spec references. Working from the title alone leads to incomplete implementations that miss key requirements, fail verification, and require retries.

**Correct Alternative**: Always read the full task JSON file including `description`, `acceptance_criteria`, and `testing_requirements` before starting work. Use the title for overview and filtering; use the full task for implementation.

---

## AP-07: Missing task_group Metadata

**Description**: Creating tasks without the `task_group` metadata key, making them invisible to group-filtered execution.

**Why It's Problematic**: The `task_group` key enables filtered execution (e.g., "run only user-auth tasks") and determines the directory path where tasks are stored. Without it, tasks cannot be selectively executed as a group, and the directory structure breaks down. In projects with multiple features in flight, ungrouped tasks are either executed with every run or must be manually identified.

**Correct Alternative**: Always include `task_group` in metadata. Derive it from the spec title as a kebab-case slug. The `task_group` value must match the group subdirectory name.

```json
{
  "metadata": {
    "task_group": "user-auth",
    "priority": "high",
    "complexity": "medium"
  }
}
```

---

## AP-08: Status/Directory Mismatch

**Description**: A task file's `status` field does not match the directory it lives in. For example, a file at `.agents/tasks/pending/user-auth/task-001.json` has `"status": "in_progress"`.

```
File location: .agents/tasks/pending/user-auth/task-001.json
File content:  { "status": "in_progress", ... }
```

**Why It's Problematic**: The Kanban directory structure relies on the file's physical location as the source of truth for status. Query operations that glob a specific status directory (e.g., `pending/**/*.json`) will include tasks whose `status` field disagrees with their location. This causes incorrect behavior in find-next-available, wave formation, and dependency resolution. The task may be started twice or skipped entirely.

**Correct Alternative**: When changing a task's status, always perform both operations atomically:
1. Update the `status` field in the JSON
2. Move the file to the matching status directory

If you discover a mismatch, trust the directory location and update the `status` field to match it, since the directory move is the visible state change that other operations depend on.

---

## AP-09: Task Field Loss During Status Transitions

**Description**: When moving a task file between status directories (e.g., `pending/` → `in-progress/` → `completed/`), reconstructing the JSON from memory instead of modifying the parsed read output, resulting in lost fields. This typically manifests as the first task in a session being moved correctly while subsequent tasks lose most fields because context window decay causes the agent to retain only core fields.

```
Original (pending/):
{
  "id": "task-003",
  "title": "Add input validation",
  "active_form": "Adding input validation",
  "description": "Validate all user inputs for the registration form...",
  "acceptance_criteria": {
    "functional": ["All required fields validated", "Error messages shown"],
    "edge_cases": ["Empty strings handled", "Unicode input accepted"],
    "error_handling": ["Malformed email rejected"],
    "performance": []
  },
  "testing_requirements": [{"type": "unit", "target": "Validation logic"}],
  "status": "pending",
  "blocked_by": ["task-001"],
  "metadata": { "priority": "high", "task_uid": "...", "task_group": "auth", ... },
  ...
}

After move to completed/ (WRONG — reconstructed from memory):
{
  "id": "task-003",
  "title": "Add input validation",
  "status": "completed",
  "updated_at": "2026-04-07T10:00:00Z"
}
```

**Why It's Problematic**: Task files are the single source of truth for task content. Lost fields break retry logic (no `acceptance_criteria` to verify against), session archival (incomplete records), merge mode (no `task_uid` to match on), progress UIs (no `active_form` to display), and downstream consumer context (no `produces_for` or `source_section`).

**Correct Alternative**: Read the task file immediately before modifying it — not from a cached version earlier in the conversation. Modify only the changed fields (`status`, `updated_at`, `owner`) on the parsed object. Write the complete object. After writing, verify the file contains `acceptance_criteria`, `testing_requirements`, `metadata.task_uid`, and `active_form`. See the Task File Integrity Rule in `operations.md`.
