# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-03-20 |
| **Time** | 16:03 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | 9a789b2 |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: Kanban-style task management restructure

**Summary**: Restructured the `agent-tasks` and `create-tasks` skills from a single-file-per-group model (`.tasks/{group}.json`) to a Kanban-style directory layout (`.agent-tasks/{status}/{group}/task-NNN.json`). Added `backlog` status, structured `acceptance_criteria` and `testing_requirements` fields, manifest files, and removed the computed `blocks` field and `deleted` status.

## Overview

Major rewrite of the task management system's reference documentation, migrating from schema v1.0 to v2.0 with a fundamentally different storage model: individual task files organized by status directories instead of all tasks in a single JSON file per group.

- **Files affected**: 7
- **Lines added**: +567
- **Lines removed**: -389
- **Commits**: 0 (all changes uncommitted)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `skills/agent-tasks/SKILL.md` | Modified | +161 changes | Rewritten for Kanban directory layout, manifests, backlog status |
| `skills/agent-tasks/references/task-schema.md` | Modified | +344 changes | New v2.0 schema with structured AC, testing, per-task timestamps |
| `skills/agent-tasks/references/operations.md` | Modified | +255 changes | File-per-task CRUD with move, delete, directory-based queries |
| `skills/agent-tasks/references/anti-patterns.md` | Modified | +40 changes | Removed blocks references, added AP-08 status/directory mismatch |
| `skills/create-tasks/SKILL.md` | Modified | +146 changes | Updated for .agent-tasks/ paths, structured fields, backlog handling |
| `skills/README.md` | Modified | +4 / -4 | Path references .tasks/ → .agent-tasks/ |
| `internal/reports/generic-task-skills-2026-03-19.md` | Modified | +6 / -6 | Updated historical references to reflect new schema |

## Change Details

### Modified

- **`skills/agent-tasks/SKILL.md`** — Full rewrite of the main reference skill. Changed directory structure from `.tasks/{group}.json` to `.agent-tasks/{status}/{group}/task-NNN.json`. Added manifest file convention (`_manifests/{group}.json`). Updated schema overview to include `acceptance_criteria` (structured object), `testing_requirements` (typed array), and per-task `created_at`/`updated_at` timestamps. Replaced `description` field definition from "contains AC and testing" to "pure description only". Added `backlog` as a new status for future-phase tasks. Removed `deleted` status (files are deleted from disk). Removed `blocks` computed field and the "Recompute Blocks" section. Updated dependency management to derive downstream dependents on-the-fly. Rewrote execution patterns (claim-work-complete, find-next-available) to use directory scanning.

- **`skills/agent-tasks/references/task-schema.md`** — Complete schema rewrite from v1.0 to v2.0. Replaced top-level file structure (single file with tasks array) with separate manifest and individual task file schemas. Added field definitions for `acceptance_criteria` (object with `functional`, `edge_cases`, `error_handling`, `performance` arrays), `testing_requirements` (array of `{type, target}` objects), `created_at`, and `updated_at`. Removed `blocks` field definition. Updated `status` values to `backlog`, `pending`, `in_progress`, `completed` (removed `deleted`). Added status-directory consistency validation rule and acceptance criteria structure validation. Rewrote all examples to use v2.0 schema format including new minimal task, phased task, backlog task, and manifest examples.

- **`skills/agent-tasks/references/operations.md`** — Major rewrite for file-per-task operations. Initialize now creates full directory tree (`_manifests/`, `backlog/`, `pending/`, `in-progress/`, `completed/`) plus manifest file. Add Task writes individual JSON files to status directories. Update Task reads/modifies/writes individual files. Added new Move Task operation for status transitions (moves file between directories + updates `status` field). Delete Task removes file from disk. Query Tasks uses Glob patterns across directories. Find Next Available scans `pending/{group}/` and checks `completed/{group}/` for blocker resolution. Merge Mode scans all status directories for existing tasks. Removed Recompute Blocks section entirely. Batch Task Creation writes individual files to `pending/` or `backlog/` based on phase rules.

- **`skills/agent-tasks/references/anti-patterns.md`** — Removed `blocks` field references from AP-01 correct alternative example. Updated AP-05 and AP-06 to reference scanning across directories and reading full task files. Updated AP-07 to note `task_group` also determines directory path. Added new AP-08 (Status/Directory Mismatch) for the Kanban-specific anti-pattern where a task's `status` field disagrees with its directory location.

- **`skills/create-tasks/SKILL.md`** — Updated all `.tasks/` path references to `.agent-tasks/`. Updated skill description frontmatter. Updated reference skill loading section to reflect new schema fields. Phase 2 (Check Existing) now scans `_manifests/` for manifest and globs `*/{group}/*.json` for task files across status directories. Phase 5 (Decompose Tasks) restructured task template: `description` is now pure text, `acceptance_criteria` is a structured object with four category arrays, `testing_requirements` is a typed array. Added phase-based status assignment section (selected phases → `pending/`, future phases → `backlog/`). Phase 8 preview updated with pending/backlog directory annotations. Phase 9 (Create Tasks) rewritten: fresh mode writes manifest + individual task files to `pending/` or `backlog/`; merge mode reads from all status directories; completion report shows directory paths. Removed all `blocks` computation and references throughout.

- **`skills/README.md`** — Updated two path references from `.tasks/` to `.agent-tasks/` in the Knowledge Skills and Utility Skills tables.

- **`internal/reports/generic-task-skills-2026-03-19.md`** — Updated 3 historical references: file convention path, schema field list (added `acceptance_criteria`/`testing_requirements`, replaced `blocks` removal, updated status list), and task writing description.

## Git Status

### Unstaged Changes

- `M` — `internal/reports/generic-task-skills-2026-03-19.md`
- `M` — `skills/README.md`
- `M` — `skills/agent-tasks/SKILL.md`
- `M` — `skills/agent-tasks/references/anti-patterns.md`
- `M` — `skills/agent-tasks/references/operations.md`
- `M` — `skills/agent-tasks/references/task-schema.md`
- `M` — `skills/create-tasks/SKILL.md`

## Session Commits

No commits in this session. All changes are uncommitted.
