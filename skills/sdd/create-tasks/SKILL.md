---
name: create-tasks
description: >-
  Generate implementation tasks from an existing spec. Analyzes specs produced
  by create-spec, decomposes features into atomic tasks using layer patterns,
  infers dependencies, detects producer-consumer relationships, and writes
  tasks to .agents/tasks/ JSON files. Use when user says "create tasks", "generate
  tasks from spec", "spec to tasks", "task generation", or wants to decompose
  a spec into implementation tasks. Also trigger when the user has a spec and
  wants to start building.
metadata:
  argument-hint: "[spec-path] [--phase <phases>]"
  type: workflow
allowed-tools: Read Write Glob Grep Bash
---

# Spec to Tasks

You are an expert at transforming specifications into well-structured, actionable implementation tasks. You analyze specs, decompose features into atomic tasks, infer dependencies, and write tasks to `.agents/tasks/` JSON files with proper metadata and acceptance criteria.

## Critical Rules

### User Interaction via `question` Tool

**IMPORTANT**: Use the `question` tool for ALL questions to the user. Never ask questions through regular text output.

- Confirmation questions → `question` tool
- Preview approval → `question` tool
- Phase selection → `question` tool
- Merge mode decisions → `question` tool

Text output should only be used for:
- Presenting task previews and summaries
- Reporting completion status
- Displaying analysis findings

### Plan Mode Behavior

**CRITICAL**: This skill generates tasks, NOT an implementation plan. When invoked during plan mode:

- **DO NOT** create an implementation plan for how to build the spec's features
- **DO NOT** defer task generation to an "execution phase"
- **DO** proceed with the full task generation workflow immediately
- **DO** write tasks to `.agents/tasks/` as normal

The tasks are planning artifacts themselves — generating them IS the planning activity.

## Load Reference Skills

Before starting the workflow, load the sdd-tasks reference for task schema, conventions, and patterns:

```
Read ../sdd-tasks/SKILL.md
```

This reference provides:
- Task file convention (`.agents/tasks/{status}/{group}/task-NNN.json`)
- Task schema with field reference (id, title, active_form, description, acceptance_criteria, testing_requirements, status, blocked_by, metadata)
- Status lifecycle and transition rules (backlog, pending, in_progress, completed)
- Naming conventions (imperative `title`, present-continuous `active_form`)
- Dependency management with DAG design (blocked_by)
- Standard metadata conventions (priority, complexity, task_group, task_uid)

The SDD-specific extensions to these conventions are documented in the "SDD Task Metadata Extensions" section below.

## Workflow Overview

This workflow has ten phases:

1. **Validate & Load** — Validate spec file, parse `--phase` argument, read content, load reference files
2. **Detect Depth & Check Existing** — Detect spec depth level, check for existing task files
3. **Analyze Spec** — Extract features, requirements, structure, and implementation phases from spec
4. **Select Phases** — Interactive or CLI-driven phase selection for incremental generation
5. **Decompose Tasks** — Phase-filtered hybrid decomposition from features and deliverables
6. **Infer Dependencies** — Phase-aware blocking relationships with cross-phase handling
7. **Detect Producer-Consumer Relationships** — Identify `produces_for` relationships between tasks
8. **Preview & Confirm** — Show summary, get user approval before writing
9. **Create Tasks** — Write tasks to `.agents/tasks/` as individual files (fresh or merge mode)
10. **Error Handling** — Handle spec parsing issues, circular deps, missing info, phase errors

---

## Phase 1: Validate & Load

### Parse Arguments

1. **Extract spec path**: The first positional argument is the spec file path
2. **Check for `--phase` flag**: If `--phase` is present, parse the comma-separated integers that follow (e.g., `--phase 1,2` → `[1, 2]`)
3. Store as `selected_phases_cli` (empty list if `--phase` not provided)

### Validate Spec File

Verify the spec file exists at the provided path.

If the file is not found:
1. Check if user provided a relative path — try resolving against common locations
2. Try common spec locations:
   - `specs/SPEC-{name}.md`
   - `docs/SPEC-{name}.md`
   - `{name}.md` in current directory
3. Use Glob to search for similar filenames:
   - `**/SPEC*.md`
   - `**/*spec*.md`
   - `**/*requirements*.md`
4. If multiple matches found, use `question` tool to let user select
5. If no matches found, inform user and ask for correct path

### Read Spec Content

Read the entire spec file.

### Load Reference Files

Read the reference files for task decomposition patterns, dependency rules, and testing requirements:

1. `references/decomposition-patterns.md` — Feature decomposition patterns by type
2. `references/dependency-inference.md` — Automatic dependency inference rules
3. `references/testing-requirements.md` — Test type mappings and acceptance criteria patterns

---

## Phase 2: Detect Depth & Check Existing

### Detect Depth Level

Analyze the spec content to determine its depth level. Check in priority order:

1. If spec contains `**Spec Depth**:` metadata field, use that value directly
2. **Full-Tech Indicators** (check first):
   - Contains `API Specifications` section or `### 7.4 API` or similar
   - Contains API endpoint definitions (`POST /api/`, `GET /api/`, etc.)
   - Contains `Testing Strategy` section
   - Contains data model schemas with field definitions
3. **Detailed Indicators**:
   - Uses numbered sections (`## 1.`, `### 2.1`)
   - Contains `Technical Architecture` or `Technical Considerations` section
   - Contains user stories (`**US-001**:` or similar)
   - Contains acceptance criteria (`- [ ]` checkboxes)
   - Contains feature prioritization (P0, P1, P2, P3)
4. **High-Level Indicators**:
   - Contains feature table with Priority column
   - Executive summary focus
   - No user stories or acceptance criteria
   - Shorter document (~50-100 lines)
5. Default → Detailed

### Check for Existing Tasks

Derive the expected `task_group` slug from the spec (see Phase 3) and check if tasks already exist by scanning for the manifest and task files:

1. Check if `.agents/tasks/_manifests/{task-group}.json` exists
2. Glob `.agents/tasks/*/{task-group}/*.json` to find existing task files across all status directories

If tasks exist:
- Read each task file and categorize by status
- Count by status (backlog, pending, in_progress, completed)
- Extract `spec_phase` metadata to build `existing_phases_map`: `{phase_number → {backlog, pending, in_progress, completed, total, phase_name}}`
- Report to user about merge behavior with phase-aware detail:

```
Found {n} existing tasks for this spec:
- {backlog} backlog
- {pending} pending
- {in_progress} in progress
- {completed} completed

Previously generated phases:
- Phase {N}: {phase_name} — {total} tasks ({completed} completed, {pending} pending)

New tasks will be merged. Completed tasks will be preserved.
```

---

## Phase 3: Analyze Spec

### Extract Spec Name

Parse the spec title to extract the spec name for use as `task_group`:
- Look for `# {name} PRD` title format on line 1
- Extract `{name}` as the spec name (e.g., `# User Authentication PRD` → `User Authentication`)
- Convert to slug format for `task_group` (e.g., `user-authentication`)
- If title does not match the PRD format, derive from filename: strip `SPEC-` prefix, strip `.md` extension, lowercase, replace spaces/underscores with hyphens

**Important**: `task_group` MUST be set on every task. Execution skills rely on `metadata.task_group` for filtered execution. Tasks without `task_group` are invisible to group-filtered runs.

### Section Mapping

Extract information from each spec section:

| Spec Section | Extract |
|-------------|---------|
| **1. Overview** | Project name, description for task context |
| **5.x Functional Requirements** | Features, priorities (P0-P3), user stories |
| **6.x Non-Functional Requirements** | Constraints, performance requirements → Performance acceptance criteria |
| **7.x Technical Considerations** | Tech stack, architecture decisions |
| **7.3 Data Models** (Full-Tech) | Entity definitions → data model tasks |
| **7.4 API Specifications** (Full-Tech) | Endpoints → API tasks |
| **8.x Testing Strategy** | Test types, coverage targets → Testing Requirements section |
| **9.x Implementation Plan** | Phases, deliverables, completion criteria, checkpoint gates |
| **10.x Dependencies** | Explicit dependencies → blocked_by relationships |

### Feature Extraction

For each feature in Section 5.x:
1. Note feature name and description
2. Extract priority (P0/P1/P2/P3)
3. List user stories (US-XXX)
4. Collect acceptance criteria and categorize by type (Functional, Edge Cases, Error Handling, Performance)
5. Identify implied sub-features

### Testing Extraction

From Section 8.x (Testing Strategy) if present:
1. Note test types specified (unit, integration, E2E)
2. Extract coverage targets
3. Identify critical paths requiring E2E tests
4. Note any performance testing requirements

From Section 6.x (Non-Functional Requirements):
1. Extract performance targets → Performance acceptance criteria
2. Extract security requirements → Security testing requirements
3. Extract reliability requirements → Integration test requirements

### Depth-Based Granularity

| Depth | Tasks per Feature | Decomposition Level | Example |
|-------|------------------|---------------------|---------|
| High-Level | 1-2 | Feature-level deliverables | "Implement user authentication" |
| Detailed | 3-5 | Functional decomposition | "Implement login endpoint", "Add password validation" |
| Full-Tech | 5-10 | Technical decomposition | "Create User model", "Implement POST /auth/login", "Add auth middleware" |

### Phase Extraction

Extract implementation phases from Section 9 if present:

1. **Detect Section 9**: Look for `## 9. Implementation Plan` or `## Implementation Phases`
2. **Extract phase headers**: Pattern `### 9.N Phase N: {Name}` or `### Phase N: {Name}`
3. **For each phase, extract**:
   - `number` — Phase number (integer)
   - `name` — Phase name
   - `completion_criteria` — Text after `**Completion Criteria**:`
   - `deliverables` — Parsed table rows (columns: Deliverable, Description, Dependencies; optionally Technical Tasks)
   - `checkpoint_gate` — Items after `**Checkpoint Gate**:`
4. **Cross-reference deliverables to Section 5 features**: Scan descriptions for feature name references. Build mapping: `{phase_number → [feature_names]}`
5. If no Section 9 found, set `spec_phases = []`

---

## Phase 4: Select Phases

Select which implementation phases to generate tasks for.

### Path A — `--phase` argument provided

Skip interactive selection. Validate that each phase number exists in `spec_phases`. If any phase number is invalid, report the valid range and stop.

### Path B — No `--phase`, spec has 2-3 phases

Use a single `question` with multiple selection:

```
header: "Phases"
question: "Which implementation phases should I generate tasks for?"
options:
  - "All phases" — Generate tasks for all {N} phases at once
  - "Phase 1: {name}" — {deliverable_count} deliverables
  - "Phase 2: {name}" — {deliverable_count} deliverables
  - "Phase 3: {name}" — {deliverable_count} deliverables
multiple: true
```

### Path C — No `--phase`, spec has 4+ phases

Two-step selection:
1. Ask "All phases or select specific?"
2. If "Select specific", show individual phases with multiple selection

### Path D — No Section 9 / no phases

Skip selection entirely. Log: "No implementation phases found in spec. Generating tasks from features only." Set `selected_phases = []`.

### Path E — Merge mode with existing phases

When existing tasks with `spec_phase` metadata were found in Phase 2:

```
header: "Phases"
question: "Previously generated phases detected. Which phases should I generate tasks for?"
options:
  - "Remaining phases only" — Generate tasks for phases not yet created
  - "All phases (merge)" — Re-generate all phases, merging with existing tasks
  - "Select specific phases" — Choose which phases to generate
```

---

## Phase 5: Decompose Tasks

### Phase-Aware Feature Mapping

When `spec_phases` is non-empty and phases were selected:

1. **Map features to phases** using the cross-reference from Phase Extraction:
   - Features explicitly referenced in phase deliverables → map to that phase
   - Features not referenced → assign to the earliest plausible phase (data models → Phase 1, UI → last phase)
2. **Filter to selected phases**: Only decompose features mapping to selected phases
3. **Deliverables as additional input**: Check if phase deliverables have technical tasks not covered by Section 5 features. Create additional tasks from uncovered deliverables with `source_section: "9.{N}"`
4. **Assign phase metadata**: Every task gets `spec_phase` (integer) and `spec_phase_name` (string)

When `spec_phases = []`: Decompose all features without phase assignment. Omit `spec_phase` and `spec_phase_name` entirely.

### Phase-Based Status Assignment

When phases are selected:
- Tasks from **selected/current phases** → status `pending`, written to `pending/{group}/`
- Tasks from **non-selected/future phases** → status `backlog`, written to `backlog/{group}/`
- Tasks with **no phase** (phaseless specs) → status `pending`, written to `pending/{group}/`

### Standard Layer Pattern

For each feature, apply the standard layer pattern. See `references/decomposition-patterns.md` for the full set of patterns (Standard Feature, Authentication, CRUD, Integration, Background Job, Migration).

```
1. Data Model Tasks      → "Create {Entity} data model"
2. API/Service Tasks     → "Implement {endpoint} endpoint"
3. Business Logic Tasks  → "Implement {feature} business logic"
4. UI/Frontend Tasks     → "Build {feature} UI component"
5. Test Tasks            → "Add tests for {feature}"
```

### Task Structure

Each task follows the sdd-tasks schema (imperative `title`, present-continuous `active_form`). Acceptance criteria and testing requirements are structured as top-level fields:

```json
{
  "id": "task-NNN",
  "title": "Create User data model",
  "active_form": "Creating User data model",
  "description": "{What needs to be done}\n\n{Technical details if applicable}\n\nSource: {spec_path} Section {number}",
  "acceptance_criteria": {
    "functional": [
      "Core behavior criterion"
    ],
    "edge_cases": [
      "Boundary condition criterion"
    ],
    "error_handling": [
      "Error scenario criterion"
    ],
    "performance": []
  },
  "testing_requirements": [
    { "type": "unit", "target": "What to test" },
    { "type": "integration", "target": "What to test" }
  ],
  "status": "pending",
  "blocked_by": [],
  "owner": null,
  "created_at": "{ISO-8601}",
  "updated_at": "{ISO-8601}",
  "metadata": { ... }
}
```

### SDD Task Metadata Extensions

In addition to the standard metadata keys from sdd-tasks (`priority`, `complexity`, `task_group`, `task_uid`), SDD tasks use these spec-specific keys:

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `source_section` | string | Yes | Spec section reference (e.g., "7.3 Data Models") |
| `spec_path` | string | Yes | Path to the source spec file |
| `feature_name` | string | Yes | Parent feature name from spec |
| `task_uid` | string | Yes | Composite key: `{spec_path}:{feature}:{type}:{seq}` |
| `task_group` | string | Yes | Slug derived from spec title — REQUIRED |
| `spec_phase` | integer | Conditional | Phase number (omit if no phases) |
| `spec_phase_name` | string | Conditional | Phase name (omit if no phases) |
| `produces_for` | string[] | Optional | IDs of downstream tasks that consume this task's output |

### Acceptance Criteria Categories

| Category | What to Include |
|----------|-----------------|
| **Functional** | Core behavior, expected outputs, state changes |
| **Edge Cases** | Boundaries, empty/null, max values, concurrent operations |
| **Error Handling** | Invalid input, failures, timeouts, graceful degradation |
| **Performance** | Response times, throughput, resource limits (if applicable) |

### Testing Requirements Generation

Generate testing requirements by combining:

1. **Inferred from task type** (see `references/testing-requirements.md`):
   - Data Model → Unit + Integration tests
   - API Endpoint → Integration + E2E tests
   - UI Component → Component + E2E tests
   - Business Logic → Unit + Integration tests

2. **Extracted from spec** (Section 8 or feature-specific):
   - Explicit test types mentioned
   - Coverage targets
   - Critical path tests

### Priority Mapping

| Spec Priority | Task Priority |
|--------------|---------------|
| P0 (Critical) | `critical` |
| P1 (High) | `high` |
| P2 (Medium) | `medium` |
| P3 (Low) | `low` |

### Complexity Estimation

| Size | Scope |
|------|-------|
| XS | Single simple function (<20 lines) |
| S | Single file, straightforward (20-100 lines) |
| M | Multiple files, moderate logic (100-300 lines) |
| L | Multiple components, significant logic (300-800 lines) |
| XL | System-wide, complex integration (>800 lines) |

### Task UID Format

```
{spec_path}:{feature_slug}:{task_type}:{sequence}

Examples:
- specs/SPEC-Auth.md:user-auth:model:001
- specs/SPEC-Auth.md:user-auth:api-login:001
- specs/SPEC-Auth.md:session-mgmt:test:001
```

---

## Phase 6: Infer Dependencies

Apply automatic dependency rules. See `references/dependency-inference.md` for the complete rule set.

### Layer Dependencies

```
Data Model → API → UI → Tests
```

- API tasks depend on their data models
- UI tasks depend on their APIs
- Tests depend on their implementations

### Phase Dependencies

When tasks have `spec_phase` metadata, apply cross-phase blocking based on three scenarios:

1. **Phase N-1 tasks in current generation**: Normal `blocked_by` — Phase N tasks blocked by Phase N-1 tasks
2. **Phase N-1 tasks from prior generation (merge mode)**: Create `blocked_by` to existing Phase N-1 task IDs from the task files
3. **Phase N-1 not selected and no existing tasks**: Do NOT add `blocked_by` to non-existent tasks. Instead:
   - Add a "Prerequisites" note to task descriptions listing assumed-complete deliverables
   - Emit a one-time warning: "Phase {N} tasks generated without Phase {N-1} predecessor tasks."

### Explicit Spec Dependencies

Map Section 10 dependencies:
- "requires X" → blocked_by X
- "prerequisite for Y" → Y blocked_by this task

### Cross-Feature Dependencies

If features share:
- Data models: both depend on model creation
- Services: both depend on service implementation
- Auth: all protected features depend on auth setup

---

## Phase 7: Detect Producer-Consumer Relationships

After inferring `blocked_by` dependencies, identify which tasks produce output that is directly consumed by other tasks. These relationships become the `produces_for` metadata field.

### Detection Approach

A producer-consumer relationship exists when:
1. Task B is blocked by Task A (`blocked_by`), AND
2. Task A's deliverable is **directly referenced** in Task B's description

**Conservative principle**: When uncertain, omit `produces_for`. False positives add unnecessary context; false negatives are harmless.

### Producer-Consumer Patterns

| Producer Task Type | Consumer Task Type | Signal |
|---|---|---|
| **Data Model** | API/Service using the model | Consumer references entity name, fields, schema |
| **Schema/Type Definition** | Implementation | Consumer implements interfaces, types, contracts |
| **Configuration/Infrastructure** | Tasks consuming config | Consumer reads config values, uses resources |
| **Foundation/Framework** | Tasks building on foundation | Consumer extends base classes, uses utilities |
| **API Endpoint** | UI/Frontend calling it | Consumer calls specific endpoints |
| **Migration/Setup** | Tasks requiring setup | Consumer reads tables, uses created resources |

### Detection Algorithm

For each pair of tasks where Task B has Task A in its `blocked_by`:

1. **Check deliverable reference**: Does Task B's description explicitly reference an artifact Task A creates? (Entity names, endpoint paths, config keys, file/module names)
2. **Check layer relationship**: Is it a direct layer-to-layer producer-consumer? (Data Model → API for that model = YES; Data Model → Unrelated API = NO)
3. **Assign**: If yes, add Task B's ID to Task A's `produces_for` array

### Multi-Consumer Tasks

A single producer may have multiple consumers:
```json
"produces_for": ["task-005", "task-006"]
```

### Output

Annotate each producer task's metadata with `produces_for`. Tasks with no producer-consumer relationships omit the field entirely (not an empty array).

---

## Phase 8: Preview & Confirm

Before writing tasks, present a summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK GENERATION PREVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Spec: {spec_name}
Depth: {depth_level}
Phases: {selected_count} of {total_count}

SUMMARY:
- Total tasks: {count}
- By priority: {critical} critical, {high} high, {medium} medium, {low} low
- By complexity: {XS} XS, {S} S, {M} M, {L} L, {XL} XL

PHASES:
- Phase {N}: {phase_name} — {n} tasks → pending/
- Phase {M}: {phase_name} — {n} tasks → backlog/

FEATURES:
- {Feature 1} (Phase {N}) → {n} tasks
- {Feature 2} (Phase {M}) → {n} tasks

DEPENDENCIES:
- {n} dependency relationships inferred
- {m} producer-consumer relationships detected
- Longest chain: {n} tasks

FIRST TASKS (no blockers):
- {Task title} ({priority}, Phase {N})
- {Task title} ({priority}, Phase {M})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

When no phases are present, omit `Phases:` sections and phase annotations.

Then use `question` tool to confirm:

```
header: "Confirm"
question: "Ready to create {n} tasks from this spec?"
options:
  - "Yes, create tasks" — Create all tasks with dependencies
  - "Show task details" — See full list before creating
  - "Cancel" — Don't create tasks
```

If "Show task details": list all tasks with title, priority, complexity, grouped by feature with dependency chains. Then ask again for confirmation.

---

## Phase 9: Create Tasks

### Fresh Mode (No Existing Tasks)

Build all tasks in memory and write as individual files:

1. **Build task list**: Construct all task objects with all fields
2. **Assign sequential IDs**: `task-001`, `task-002`, ... using the task_uid-to-ID mapping
3. **Set blocked_by**: Using the internal UID-to-ID mapping from Phase 6
4. **Set produces_for**: Using the detection results from Phase 7
5. **Create directory structure**: If `.agents/tasks/` does not exist, create the full structure:
   ```bash
   mkdir -p .agents/tasks/{_manifests,backlog,pending,in-progress,completed}
   ```
   Always ensure group subdirectories exist before writing task files:
   ```bash
   mkdir -p .agents/tasks/{pending,backlog}/{group}
   ```
6. **Write manifest**: Write `.agents/tasks/_manifests/{group}.json` with task statistics
7. **Write task files**: Write each task as an individual file to the appropriate directory:
   - Current-phase tasks → `.agents/tasks/pending/{group}/task-NNN.json`
   - Future-phase tasks → `.agents/tasks/backlog/{group}/task-NNN.json`

**Manifest structure:**
```json
{
  "version": "2.0",
  "task_group": "{task-group}",
  "spec_path": "{spec-path}",
  "created_at": "{ISO-8601}",
  "updated_at": "{ISO-8601}",
  "total_tasks": "{count}",
  "pending_count": "{count}",
  "backlog_count": "{count}",
  "dependency_count": "{count}",
  "producer_consumer_count": "{count}",
  "complexity_breakdown": { "{level}": "{count}" },
  "priority_breakdown": { "{level}": "{count}" }
}
```

**Computing statistics:**
- `total_tasks`: Count of all task files written
- `pending_count`: Count of tasks written to `pending/{group}/`
- `backlog_count`: Count of tasks written to `backlog/{group}/`
- `dependency_count`: Sum of all `blocked_by` array lengths across all tasks
- `producer_consumer_count`: Sum of all `produces_for` array lengths across all tasks
- `complexity_breakdown`: Group tasks by `metadata.complexity` and count each level
- `priority_breakdown`: Group tasks by `metadata.priority` and count each level

### Report Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK CREATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Created {n} tasks from {spec_name}
Set {m} dependency relationships
Set {p} producer-consumer relationships

Task directory: .agents/tasks/
Manifest: .agents/tasks/_manifests/{group}.json
Pending tasks: .agents/tasks/pending/{group}/ ({x} files)
Backlog tasks: .agents/tasks/backlog/{group}/ ({y} files)

RECOMMENDED FIRST TASKS (no blockers):
- {Task title} ({priority}, {complexity})
- {Task title} ({priority}, {complexity})

Run these tasks first to unblock others.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Merge Mode (Existing Tasks Found)

When tasks already exist for this group:

1. **Read existing tasks**: Glob `.agents/tasks/*/{group}/*.json` and read each file
2. **Match by task_uid**: Build mapping of existing `task_uid` → task
3. **Apply merge rules**:
   | Existing Status | Action |
   |-----------------|--------|
   | `pending` | Update description, title, active_form, acceptance_criteria, testing_requirements, metadata. Preserve id, status, and file location. |
   | `backlog` | Same as pending — update content, preserve identity and status. |
   | `in_progress` | Preserve status and owner. Optionally update description. |
   | `completed` | Never modify. |
4. **Add new tasks**: Tasks with no matching `task_uid` get new sequential IDs and are written as new files
5. **Handle obsolete tasks**: Existing tasks with no matching `task_uid` in the new set — present to user with keep/delete options
6. **Write updates**: Write modified task files back to their locations, write new task files to appropriate directories
7. **Update manifest**: Update the manifest's `updated_at` timestamp and recompute all statistics (`total_tasks`, `pending_count`, `backlog_count`, `dependency_count`, `producer_consumer_count`, `complexity_breakdown`, `priority_breakdown`) by scanning all current task files for the group

Report merge statistics:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK MERGE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- {n} tasks updated
- {m} new tasks created
- {k} tasks preserved (in_progress/completed)
- {j} potentially obsolete tasks (kept/resolved)

Total tasks: {total}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Phase 10: Error Handling

### Spec Parsing Issues

If spec structure is unclear:
1. Note assumptions made
2. Flag uncertain tasks with `needs_review: true` in metadata
3. Continue with available information

### Circular Dependencies

If circular dependency detected:
1. Log warning with the cycle
2. Break at weakest link (least coupling)
3. Flag for human review

### Missing Information

If required information missing from spec:
1. Create task with available information
2. Add `incomplete: true` to metadata
3. Note what's missing in description

### Phase-Related Errors

**`--phase` provided but spec has no Section 9:**
Inform user: "The `--phase` argument was provided but this spec has no Implementation Plan (Section 9). Generating tasks from all features without phase filtering."

**`--phase` references non-existent phase numbers:**
Report valid phase numbers and stop: "Invalid phase number(s): {invalid}. This spec has phases: {list}."

**Section 9 format doesn't match expected patterns:**
Degrade gracefully — if phase headers can't be parsed, log a warning and generate from features only. Set `spec_phases = []` and continue.

---

## Anti-Pattern Validation

Before confirming task creation in Phase 8, validate against common anti-patterns. Load `../sdd-tasks/references/anti-patterns.md` for the full reference if issues are detected.

Check for:
- **AP-01**: Circular dependencies — detect cycles in the dependency graph
- **AP-02**: Too-granular tasks — flag tasks that change fewer than ~10 lines
- **AP-05**: Duplicate task creation — verify task_uid uniqueness
- **AP-07**: Missing task_group — every task MUST have `task_group` metadata

---

## Reference Files

- `references/decomposition-patterns.md` — Feature decomposition patterns by type
- `references/dependency-inference.md` — Automatic dependency inference rules
- `references/testing-requirements.md` — Test type mappings and acceptance criteria patterns
- `../sdd-tasks/SKILL.md` — Task schema, conventions, and patterns (loaded at init)
- `../sdd-tasks/references/anti-patterns.md` — Common task anti-patterns (loaded on validation)
