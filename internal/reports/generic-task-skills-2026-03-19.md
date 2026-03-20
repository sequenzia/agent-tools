# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-03-19 |
| **Time** | 11:56 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | f4c0b0b |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: Create generic, harness-independent `agent-tasks` and `create-tasks` skills

**Summary**: Created two new skills in `tools/skills/` that provide harness-independent task management. `agent-tasks` defines a JSON-based task schema with file-based CRUD operations, dependency patterns, and execution guidance. `create-tasks` provides a 10-phase spec-to-task decomposition workflow that analyzes specs from `create-spec` and generates `.agent-tasks/` JSON files. Both skills were ported from the Claude Code-specific `create-tasks` skill in agent-alchemy, replacing native Task tools with file-based operations and generic tool references.

## Overview

Two new skills were added to the `tools/skills/` directory, along with an update to the skills README to register them. The `agent-tasks` knowledge skill serves as a shared reference for task schema, state management, and execution patterns. The `create-tasks` utility skill consumes specs and produces structured task files with dependency inference and producer-consumer detection.

- **Files affected**: 9
- **Lines added**: +2707
- **Lines removed**: -0
- **Commits**: 0 (all changes uncommitted)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `tools/skills/agent-tasks/SKILL.md` | Added | +320 | Knowledge skill defining task schema, lifecycle, dependency management, and execution patterns |
| `tools/skills/agent-tasks/references/task-schema.md` | Added | +340 | Complete JSON schema definition with field docs, validation rules, and examples |
| `tools/skills/agent-tasks/references/operations.md` | Added | +247 | File-based CRUD procedures: init, add, update, query, merge, recompute blocks |
| `tools/skills/agent-tasks/references/anti-patterns.md` | Added | +153 | 7 anti-patterns adapted from Claude Code's claude-code-tasks reference |
| `tools/skills/create-tasks/SKILL.md` | Added | +695 | 10-phase spec-to-task workflow: validate, analyze, decompose, infer deps, write tasks |
| `tools/skills/create-tasks/references/decomposition-patterns.md` | Added | +318 | 6 feature decomposition patterns (Standard, Auth, CRUD, Integration, Job, Migration) |
| `tools/skills/create-tasks/references/dependency-inference.md` | Added | +227 | Layer, phase, cross-feature, and spec-based dependency inference rules |
| `tools/skills/create-tasks/references/testing-requirements.md` | Added | +393 | Test type mappings, acceptance criteria categories, and worked examples |
| `tools/skills/README.md` | Modified | +14 | Added agent-tasks to Knowledge Skills, create-tasks to Utility Skills, both to directory structure |

## Change Details

### Added

- **`tools/skills/agent-tasks/SKILL.md`** — Knowledge skill providing the harness-independent task management reference. Defines `.agent-tasks/{status}/{group}/task-NNN.json` file convention, task schema (id, title, active_form, description, acceptance_criteria, testing_requirements, status, blocked_by, owner, metadata), status lifecycle (backlog/pending/in_progress/completed), naming conventions, DAG dependency patterns (linear, fan-out, fan-in, diamond), metadata conventions with typed values, and execution patterns (claim-work-complete, wave-based grouping, find-next-available).

- **`tools/skills/agent-tasks/references/task-schema.md`** — Complete JSON schema reference for task files. Documents the top-level file structure (version, task_group, spec_path, timestamps, tasks array) and per-task field definitions with types, constraints, and defaults. Includes ID generation rules (sequential task-NNN format), validation rules (referential integrity, acyclicity, status constraints), and three worked examples at different complexity levels.

- **`tools/skills/agent-tasks/references/operations.md`** — Detailed file-based CRUD procedures using Read/Write tools. Covers: initializing task files, adding tasks with sequential ID generation, updating tasks with metadata merge semantics, querying by status/metadata/phase, finding next available task with priority sorting, merge mode with task_uid matching and status-based rules, recomputing the blocks inverse field, and batch task creation with atomic writes.

- **`tools/skills/agent-tasks/references/anti-patterns.md`** — Seven anti-patterns adapted from Claude Code's claude-code-tasks reference for file-based operations: circular dependencies, too-granular tasks, missing active_form, batch status updates, duplicate task creation, summary-only consumption, and missing task_group metadata.

- **`tools/skills/create-tasks/SKILL.md`** — Utility skill implementing a 10-phase spec-to-task workflow: (1) validate & load spec and references, (2) detect spec depth and check existing tasks, (3) analyze spec sections for features/phases/requirements, (4) interactive phase selection, (5) decompose features using layer patterns, (6) infer dependencies (layer, phase, cross-feature, explicit), (7) detect producer-consumer relationships, (8) preview and confirm with user, (9) write tasks to .agent-tasks/ as individual files (fresh or merge mode), (10) error handling. Replaces Claude Code TaskCreate/TaskUpdate with file-based operations and AskUserQuestion with generic question tool.

- **`tools/skills/create-tasks/references/decomposition-patterns.md`** — Six feature decomposition patterns ported from the original: Standard Feature (6 layers), Authentication, CRUD, Integration, Background Job, and Migration/Refactoring. Updated field names (subject to title, activeForm to active_form). Includes task title guidelines, description template, testing suggestions per pattern, and complexity indicators (XS through XL).

- **`tools/skills/create-tasks/references/dependency-inference.md`** — Dependency inference rules ported from the original: core principles (data flows down, tests depend on implementation), layer-based automatic inference, pattern-based chains (auth, CRUD, integration), spec-based dependencies (Section 9 phase mapping with 3 scenarios, Section 10 explicit deps, user story deps), cross-feature dependencies, detection signals, and validation rules (circular detection, excessive/orphan warnings).

- **`tools/skills/create-tasks/references/testing-requirements.md`** — Testing requirements reference ported from the original: test type mapping by task layer, test suggestions for 8 task types, spec extraction patterns (Sections 6.x, 7.4, 8.x, user stories), categorized acceptance criteria (Functional, Edge Cases, Error Handling, Performance), task description template, test type definitions, inference rules (layer-based, keyword-based, spec extraction, priority-based), and three worked examples.

### Modified

- **`tools/skills/README.md`** — Added `agent-tasks` entry to the Knowledge Skills table, `create-tasks` entry to the Utility Skills table, and both skill directory structures to the directory tree diagram.

## Git Status

### Unstaged Changes

- `M` — `tools/skills/README.md`

### Untracked Files

- `tools/skills/agent-tasks/`
- `tools/skills/create-tasks/`

## Session Commits

No commits in this session. All changes are uncommitted.
