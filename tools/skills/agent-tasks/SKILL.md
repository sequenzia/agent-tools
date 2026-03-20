---
name: agent-tasks
description: >-
  Define and manage implementation tasks using a harness-independent JSON file
  format. Provides task schema, file-based CRUD operations, state management,
  dependency tracking, and execution patterns. Use as a reference skill when
  creating, executing, or managing tasks from specs. Load this skill whenever
  working with .agent-tasks/ files, decomposing specs into tasks, or coordinating
  multi-agent task execution.
---

# Agent Tasks Reference

This skill is a shared reference for harness-independent task management. Load it when your skill or agent needs to create, manage, or coordinate tasks stored as JSON files.

It covers:
- Task file conventions, directory structure, and manifest files
- Complete task schema with field reference
- Status lifecycle, transition rules, and completion rules
- Naming conventions (imperative `title`, present-continuous `active_form`)
- Dependency management with DAG design principles
- Standard metadata conventions for categorization and tracking
- File-based CRUD operations (create, read, update, move, delete, query, merge)
- Execution patterns (claim-work-complete, wave-based grouping, find-next-available)

For deeper content, load the reference files listed at the end of this document.

---

## Task File Convention

Tasks are stored as individual JSON files in an `.agent-tasks/` directory at the project root. Tasks are organized by status and group:

```
.agent-tasks/
├── _manifests/
│   ├── user-authentication.json
│   └── payment-flow.json
├── backlog/
│   └── user-authentication/
│       └── task-005.json
├── pending/
│   └── user-authentication/
│       ├── task-001.json
│       └── task-002.json
├── in-progress/
│   └── user-authentication/
│       └── task-003.json
└── completed/
    └── user-authentication/
        └── task-004.json
```

**Status directories**: `backlog/`, `pending/`, `in-progress/`, `completed/` — each task lives in the directory matching its current status.

**Group subdirectories**: Within each status directory, tasks are organized by group (e.g., `user-authentication/`). The group name is a kebab-case slug derived from the spec title or feature name.

**Manifest files**: Group-level metadata is stored in `_manifests/{group}.json`. Each manifest tracks version, group name, spec path, and timestamps.

**File naming**: `task-NNN.json` where NNN is a zero-padded 3-digit sequential number.

**Discovery**: To find all tasks for a group, search with `.agent-tasks/*/{group}/*.json`. To find all tasks in a status, search with `.agent-tasks/{status}/**/*.json`.

**Creation**: If the `.agent-tasks/` directory does not exist, create it with all subdirectories (`_manifests/`, `backlog/`, `pending/`, `in-progress/`, `completed/`) before writing the first task.

---

## Task Schema Overview

Each task is an individual JSON file. Group-level metadata is stored separately in manifest files.

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Schema version: `"2.0"` |
| `task_group` | string | Yes | Kebab-case identifier for this task group |
| `spec_path` | string | Yes | Path to the source specification file |
| `created_at` | string | Yes | ISO 8601 timestamp of manifest creation |
| `updated_at` | string | Yes | ISO 8601 timestamp of most recent group modification |

### Task Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Sequential identifier (e.g., `task-001`) |
| `title` | string | Yes | Short imperative description of the task (5-10 words) |
| `active_form` | string | Yes | Present-continuous text shown during execution |
| `description` | string | Yes | Pure description of what needs to be done (no AC/testing) |
| `acceptance_criteria` | object | Yes | Structured criteria with `functional`, `edge_cases`, `error_handling`, `performance` arrays |
| `testing_requirements` | array | Yes | Array of `{type, target}` objects specifying required tests |
| `status` | string | Yes | Current state: `backlog`, `pending`, `in_progress`, `completed` |
| `blocked_by` | string[] | Yes | Array of task IDs this task depends on (empty if none) |
| `owner` | string\|null | No | Agent or session that claimed this task |
| `created_at` | string | Yes | ISO 8601 timestamp of task creation |
| `updated_at` | string | Yes | ISO 8601 timestamp of most recent task modification |
| `metadata` | object | Yes | Key-value pairs for categorization, tracking, and deduplication |

The task's `status` field is kept in sync with the directory the file lives in. Both must always match.

See `references/task-schema.md` for the complete JSON schema definition with field-level documentation, validation rules, and examples.

---

## Status Lifecycle

Tasks follow a four-state lifecycle:

```
backlog ──→ pending ──→ in_progress ──→ completed
                             │
                             ▼
                          pending (reset on failure)
```

### States

| Status | Meaning | Entry Condition |
|--------|---------|-----------------|
| `backlog` | Future phase, not yet active | Tasks from non-selected/future phases |
| `pending` | Ready to be started | Default for current-phase tasks; promoted from backlog |
| `in_progress` | Actively being worked on | Set when an agent begins work |
| `completed` | Finished — all acceptance criteria met | Set after verification passes |

### Transition Rules

- **backlog -> pending**: Phase becomes active, or task is manually prioritized.
- **pending -> in_progress**: An agent begins working on the task. All blockers must be completed.
- **in_progress -> completed**: The task is verified as done. Only mark complete after all acceptance criteria are met.
- **in_progress -> pending**: Reset after a failed attempt or interrupted session.
- **Any status -> deleted**: Remove the file from disk. No soft-delete status — git history preserves the record.
- **Blocked tasks**: A task with non-empty `blocked_by` (where blockers are not yet completed) should not be started. Orchestration logic must check dependencies before transitioning to `in_progress`.

### Status Transitions as File Moves

When a task's status changes, the file physically moves between directories. For example, transitioning task-001 from `pending` to `in_progress`:
- Source: `.agent-tasks/pending/user-auth/task-001.json`
- Destination: `.agent-tasks/in-progress/user-auth/task-001.json`

The `status` field inside the JSON is updated to match the new directory.

### Backlog Rules

- Tasks from **non-selected / future phases** start in `backlog/`
- Tasks from the **current/selected phase(s)** start in `pending/`
- When a phase completes (all its tasks completed), the next phase's backlog tasks can be promoted to `pending/`
- Tasks with **no phase** (phaseless specs) go directly to `pending/`

### Completion Rules

These rules prevent premature completion, which wastes execution resources on retries:

- Only mark `completed` when the task is **fully** accomplished — all acceptance criteria met
- If errors or blockers are encountered, keep the task as `in_progress` and address them
- Never mark completed if: tests are failing, implementation is partial, errors are unresolved, or dependencies are missing
- Always read the latest task file state before updating (staleness check)

---

## Naming Conventions

### Title (Imperative)

The `title` field uses **imperative mood** — a command that describes what the task will accomplish:

| Good | Bad |
|------|-----|
| "Create user schema" | "Creating user schema" |
| "Add JWT authentication" | "JWT authentication addition" |
| "Fix login timeout bug" | "Login timeout bug" |
| "Implement rate limiting" | "Rate limiting implementation" |

### active_form (Present-Continuous)

The `active_form` field uses **present-continuous tense** — describing what is happening while the task runs:

| title | active_form |
|-------|-------------|
| "Create user schema" | "Creating user schema" |
| "Add JWT authentication" | "Adding JWT authentication" |
| "Fix login timeout bug" | "Fixing login timeout bug" |
| "Implement rate limiting" | "Implementing rate limiting" |

The conversion is mechanical — change the imperative verb to its `-ing` form.

---

## Dependency Management

Tasks support dependency tracking via the `blocked_by` field, forming a **Directed Acyclic Graph (DAG)**.

### Fields

- **`blocked_by`**: Array of task IDs that must reach `completed` status before this task can start. Set explicitly when creating or updating tasks.

Dependencies are resolved across directories — a task in `pending/group-a/` can depend on a task in `completed/group-a/` or any other status directory.

### DAG Design Principles

1. **No cycles**: Never create circular dependencies. This causes deadlock where no task in the cycle can proceed.
2. **Minimize depth**: Prefer wider, shallower dependency graphs. Deep chains serialize execution and slow throughput.
3. **Depend on producers, not peers**: A task should depend on the task that produces what it needs, not on unrelated tasks at the same level.
4. **One-way information flow**: Dependencies should follow the data flow — upstream tasks produce artifacts that downstream tasks consume.
5. **Independent tasks run in parallel**: Tasks at the same dependency level (no dependencies between them) can execute concurrently.

### Common Dependency Patterns

| Pattern | Structure | Use Case |
|---------|-----------|----------|
| **Linear chain** | A -> B -> C | Sequential steps where each builds on the previous |
| **Fan-out** | A -> [B, C, D] | One task produces input for multiple parallel tasks |
| **Fan-in** | [A, B, C] -> D | Multiple tasks must complete before a merge/integration task |
| **Diamond** | A -> [B, C] -> D | Fan-out followed by fan-in; most common real-world pattern |

### Deriving Downstream Dependents

To find which tasks depend on a given task (the inverse of `blocked_by`), scan all task files across all status directories and collect tasks that list the given task ID in their `blocked_by` array. This is derived on-the-fly when needed rather than stored as a field.

### Combining Patterns into Waves

Real workflows combine patterns. Execution waves are formed by topological level:

```
A --> [B, C] --> D --> [E, F, G] --> H

Wave 1: A          (no dependencies)
Wave 2: B, C       (both depend on A, run in parallel)
Wave 3: D          (depends on B and C)
Wave 4: E, F, G    (all depend on D, run in parallel)
Wave 5: H          (depends on E, F, and G)
```

---

## Metadata Conventions

The `metadata` field holds typed key-value pairs for categorization, tracking, and deduplication. Unlike harness-specific task tools that restrict values to strings, this file-based format supports typed values (integers, arrays, strings).

### Standard Keys

| Key | Type | Required | Purpose |
|-----|------|----------|---------|
| `priority` | string | Yes | Execution ordering: `critical`, `high`, `medium`, `low` |
| `complexity` | string | Yes | Effort estimate: `XS`, `S`, `M`, `L`, `XL` |
| `task_group` | string | Yes | Groups related tasks; matches the directory name |
| `task_uid` | string | Yes | Composite key for idempotent merge mode |
| `spec_path` | string | Yes | Path to the source specification file |
| `feature_name` | string | Yes | Associates task with a feature for tracking |
| `source_section` | string | Yes | Links to the spec section that defined this task |
| `spec_phase` | integer | Conditional | Phase number from spec (omit if no phases) |
| `spec_phase_name` | string | Conditional | Phase name from spec (omit if no phases) |
| `produces_for` | string[] | Optional | IDs of downstream tasks that consume this task's output |

### task_uid for Deduplication

The `task_uid` enables idempotent task creation. When re-running task generation, matching UIDs trigger updates to existing tasks instead of creating duplicates.

Format: `{spec_path}:{feature_slug}:{task_type}:{sequence}`

```
specs/SPEC-Auth.md:user-auth:model:001
specs/SPEC-Auth.md:user-auth:api-login:001
```

### produces_for for Context Injection

The `produces_for` field is an optional array of task IDs identifying tasks that directly consume this task's output. Execution orchestrators can use this to inject the producer's result into the dependent task's prompt, giving downstream agents richer context.

- **Omit** if the task has no direct producer-consumer relationship
- **Include** when the task's deliverable is directly referenced in another task's description
- Conservative: omit when uncertain — false positives add unnecessary context; false negatives are harmless

---

## Operations

For detailed file-based CRUD procedures, load `references/operations.md`. It covers:

- **Initialize**: Create `.agent-tasks/` directory structure and write manifest file
- **Add task**: Write individual task JSON file to the appropriate status directory
- **Update task**: Read individual file, modify fields, update `updated_at`, write back
- **Move task**: Transition status by moving file between status directories, updating `status` field
- **Delete task**: Remove file from disk
- **Query tasks**: Scan directories with Glob patterns for flexible filtering
- **Find next available**: Scan `pending/{group}/`, check blockers against `completed/{group}/`, sort by priority
- **Merge mode**: Match by `task_uid` across all status directories, apply merge rules

---

## Execution Patterns

These patterns describe how agents coordinate work through the task files.

### Claim-Work-Complete Cycle

The standard workflow for any agent working through tasks:

1. Scan `pending/{group}/` to find all pending tasks
2. For each pending task, check if all `blocked_by` tasks exist in `completed/{group}/`
3. Select the highest-priority unblocked task
4. Claim the task: move to `in-progress/{group}/`, set `status` to `in_progress`, set `owner`
5. Execute the task
6. Mark `completed`: move to `completed/{group}/`, set `status` to `completed` (or reset to `pending/` on failure)
7. Repeat from step 1

Only claim one task at a time. Complete or reset the current task before claiming the next.

### Find-Next-Available Algorithm

```
1. Glob .agent-tasks/pending/{group}/*.json
2. Read each task file
3. Glob .agent-tasks/completed/{group}/*.json to build completed set:
     completed_ids = { filename stem (e.g., "task-001") for each file }
4. Filter candidates:
   - every ID in blocked_by is in the completed set
5. Sort candidates by:
   - priority (critical > high > medium > low)
   - spec_phase (lower phase first, if present)
   - id (sequential order as tiebreaker)
6. Return the first candidate (or null if none available)
```

### Wave-Based Execution

Tasks grouped by their dependency level form waves. All tasks in a wave have their dependencies satisfied and can run in parallel.

**Wave formation:**
- **Wave 1**: Tasks with empty `blocked_by` (or all blockers already completed)
- **Wave 2**: Tasks whose blockers are all in Wave 1
- **Wave N**: Tasks whose blockers are all in waves 1 through N-1

**Execution loop:**
1. Form next wave from unblocked pending tasks
2. Launch agents for wave tasks (up to max parallelism)
3. Wait for all agents in wave to complete
4. Move completed task files to `completed/{group}/`
5. Repeat until no pending tasks remain

### Task Right-Sizing

| Size | Files | Assessment |
|------|-------|------------|
| Too small | <1 file (partial) | Merge with a related task |
| Optimal | 1-3 files | Good size for one agent |
| Acceptable | 4-5 files | OK if files are tightly coupled |
| Too large | >5 files | Split into smaller tasks |

---

## Reference Files

### Task Schema

Complete JSON schema definition with field-level documentation, validation rules, ID generation conventions, and example tasks at different complexity levels.

```
Read references/task-schema.md
```

### Operations

Detailed file-based CRUD procedures for every operation: initialization, adding, updating, moving, deleting, querying, merging, and batch creation.

```
Read references/operations.md
```

### Anti-Patterns

Common mistakes when working with tasks: circular dependencies, over-granular tasks, missing active_form, batch status updates, duplicate creation, summary-only consumption, missing task_group, and status/directory mismatch. Each anti-pattern includes the problem, why it matters, and the correct alternative.

```
Read references/anti-patterns.md
```
