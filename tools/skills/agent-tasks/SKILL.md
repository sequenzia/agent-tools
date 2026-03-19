---
name: agent-tasks
description: >-
  Define and manage implementation tasks using a harness-independent JSON file
  format. Provides task schema, file-based CRUD operations, state management,
  dependency tracking, and execution patterns. Use as a reference skill when
  creating, executing, or managing tasks from specs. Load this skill whenever
  working with .tasks/ files, decomposing specs into tasks, or coordinating
  multi-agent task execution.
---

# Agent Tasks Reference

This skill is a shared reference for harness-independent task management. Load it when your skill or agent needs to create, manage, or coordinate tasks stored as JSON files.

It covers:
- Task file conventions and storage location
- Complete task schema with field reference
- Status lifecycle, transition rules, and completion rules
- Naming conventions (imperative `title`, present-continuous `active_form`)
- Dependency management with DAG design principles
- Standard metadata conventions for categorization and tracking
- File-based CRUD operations (create, read, update, query, merge)
- Execution patterns (claim-work-complete, wave-based grouping, find-next-available)

For deeper content, load the reference files listed at the end of this document.

---

## Task File Convention

Tasks are stored as JSON files in a `.tasks/` directory at the project root, with one file per task group:

```
.tasks/
├── user-authentication.json
├── payment-flow.json
└── onboarding.json
```

**File naming**: `{task-group}.json` where `task-group` is the kebab-case slug derived from the spec title or feature name.

**Discovery**: To find task files, search for `.tasks/*.json` using Glob.

**Creation**: If the `.tasks/` directory does not exist, create it before writing the first task file.

---

## Task Schema Overview

Each task file contains a top-level object with metadata and a `tasks` array. Each task in the array has these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Sequential identifier within the file (e.g., `task-001`) |
| `title` | string | Yes | Short imperative description of the task (5-10 words) |
| `active_form` | string | Yes | Present-continuous text shown during execution |
| `description` | string | Yes | Full specification with acceptance criteria (markdown) |
| `status` | string | Yes | Current state: `pending`, `in_progress`, `completed`, `deleted` |
| `blocked_by` | string[] | Yes | Array of task IDs this task depends on (empty if none) |
| `blocks` | string[] | Yes | Computed inverse — task IDs that depend on this task |
| `owner` | string\|null | No | Agent or session that claimed this task |
| `metadata` | object | Yes | Key-value pairs for categorization, tracking, and deduplication |

The `blocks` field is always a **computed inverse** of all `blocked_by` relationships across the file. It is recomputed on every write — never set manually.

See `references/task-schema.md` for the complete JSON schema definition with field-level documentation, validation rules, and examples.

---

## Status Lifecycle

Tasks follow a three-state lifecycle with an additional terminal state:

```
pending ──→ in_progress ──→ completed
  │              │
  │              │
  ▼              ▼
deleted        deleted
```

### States

| Status | Meaning | Entry Condition |
|--------|---------|-----------------|
| `pending` | Waiting to be started | Default on creation |
| `in_progress` | Actively being worked on | Set when an agent begins work |
| `completed` | Finished — all acceptance criteria met | Set after verification passes |
| `deleted` | Soft-deleted, no longer needed | Set from any state |

### Transition Rules

- **pending -> in_progress**: An agent begins working on the task.
- **in_progress -> completed**: The task is verified as done. Only mark complete after all acceptance criteria are met.
- **in_progress -> pending**: Reset after a failed attempt or interrupted session.
- **pending -> deleted**: Task is no longer needed.
- **in_progress -> deleted**: Cancel in-flight work.
- **Blocked tasks**: A task with non-empty `blocked_by` (where blockers are not yet completed) should not be started. Orchestration logic must check dependencies before transitioning to `in_progress`.

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

Tasks support dependency tracking via `blocked_by` and `blocks` fields, forming a **Directed Acyclic Graph (DAG)**.

### Fields

- **`blocked_by`**: Array of task IDs that must complete before this task can start. Set explicitly when creating or updating tasks.
- **`blocks`**: Array of task IDs that are waiting on this task. This is the computed inverse of `blocked_by` — recomputed automatically on every file write.

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
| `task_group` | string | Yes | Groups related tasks for filtered execution |
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

- **Initialize**: Create `.tasks/` directory and write initial file structure
- **Add task**: Read file, generate next ID, append to tasks array, recompute `blocks`, write file
- **Update task**: Read file, find by ID, modify fields, recompute `blocks` if deps changed, write file
- **Query tasks**: Filter by status, metadata fields, phase, priority
- **Find next available**: Filter pending tasks with all blockers completed, sort by priority then phase
- **Merge mode**: Match by `task_uid`, apply merge rules (pending→update, in_progress→preserve, completed→never modify)
- **Recompute blocks**: Iterate all tasks, invert all `blocked_by` relationships

---

## Execution Patterns

These patterns describe how agents coordinate work through the task file.

### Claim-Work-Complete Cycle

The standard workflow for any agent working through tasks:

1. Read the task file to see all tasks
2. Filter for tasks where `status == "pending"` and all `blocked_by` tasks have `status == "completed"`
3. Select the highest-priority unblocked task
4. Claim the task: update `status` to `in_progress`, set `owner`
5. Execute the task
6. Mark `completed` (or reset to `pending` on failure)
7. Repeat from step 1

Only claim one task at a time. Complete or reset the current task before claiming the next.

### Find-Next-Available Algorithm

```
1. Read .tasks/{task-group}.json
2. Build set of completed task IDs: { t.id for t in tasks where t.status == "completed" }
3. Filter candidate tasks:
   - status == "pending"
   - every ID in blocked_by is in the completed set
4. Sort candidates by:
   - priority (critical > high > medium > low)
   - spec_phase (lower phase first, if present)
   - id (sequential order as tiebreaker)
5. Return the first candidate (or null if none available)
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
4. Update task statuses in the file
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

Detailed file-based CRUD procedures for every operation: initialization, adding, updating, querying, merging, and recomputing computed fields.

```
Read references/operations.md
```

### Anti-Patterns

Common mistakes when working with tasks: circular dependencies, over-granular tasks, missing active_form, batch status updates, duplicate creation, summary-only consumption, and missing task_group. Each anti-pattern includes the problem, why it matters, and the correct alternative.

```
Read references/anti-patterns.md
```
