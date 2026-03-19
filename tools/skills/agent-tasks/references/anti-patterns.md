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
  "blocked_by": [],
  "blocks": ["task-002", "task-003"]
},
{
  "id": "task-002",
  "title": "Create API routes",
  "blocked_by": ["task-001"],
  "blocks": []
},
{
  "id": "task-003",
  "title": "Create request handlers",
  "blocked_by": ["task-001"],
  "blocks": []
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

**Correct Alternative**: Before creating tasks, read the existing task file and check `task_uid` metadata. If a task with a matching `task_uid` exists, update it instead of creating a new one. Skills like `create-tasks` use this merge mode automatically.

---

## AP-06: Summary-Only Consumption

**Description**: Working from task `title` alone without reading the full `description` before starting work.

**Why It's Problematic**: The `title` is a 5-10 word imperative summary. The `description` contains the full specification: acceptance criteria, implementation instructions, edge cases, testing requirements, and spec context. Working from the title alone leads to incomplete implementations that miss key requirements, fail verification, and require retries.

**Correct Alternative**: Always read the full task object including its `description` before starting work. Use the title for overview and filtering; use the description for implementation.

---

## AP-07: Missing task_group Metadata

**Description**: Creating tasks without the `task_group` metadata key, making them invisible to group-filtered execution.

**Why It's Problematic**: The `task_group` key enables filtered execution (e.g., "run only user-auth tasks"). Without it, tasks cannot be selectively executed as a group. In projects with multiple features in flight, ungrouped tasks are either executed with every run or must be manually identified.

**Correct Alternative**: Always include `task_group` in metadata. Derive it from the spec title as a kebab-case slug.

```json
{
  "metadata": {
    "task_group": "user-auth",
    "priority": "high",
    "complexity": "medium"
  }
}
```
