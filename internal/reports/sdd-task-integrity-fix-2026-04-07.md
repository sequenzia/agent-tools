# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-04-07 |
| **Time** | 22:06 EDT |
| **Branch** | worktree-sdd-skills-update |
| **Author** | Stephen Sequenzia |
| **Base Commit** | `f9f92fd` |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: SDD task file integrity — prevent field loss during task execution

**Summary**: Added a "Task File Integrity Rule" to the SDD task operations reference and propagated explicit preservation instructions, post-write validation, and a new anti-pattern (AP-09) across all 10 files involved in task status transitions during `execute-tasks` and `execute-tasks-inline` execution.

## Overview

This change addresses a critical bug where SDD task JSON files lose most of their fields (`description`, `active_form`, `acceptance_criteria`, `testing_requirements`, metadata sub-fields) when moved between status directories during execution. The first task in a session typically survives intact, but subsequent tasks are corrupted because LLM context window decay causes agents to reconstruct the JSON from memory rather than from a fresh read.

The fix uses defense-in-depth across three layers:
1. An authoritative **Task File Integrity Rule** (defined once in `operations.md`, referenced everywhere)
2. **Post-write validation** that re-reads the written file and checks 4 canary fields
3. A new **anti-pattern AP-09** with a concrete before/after example of field loss

- **Files affected**: 10
- **Lines added**: +90
- **Lines removed**: -29
- **Commits**: 0 (all changes uncommitted)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `plugins/sdd/skills/sdd-tasks/references/operations.md` | Modified | +23 / -8 | Added Task File Integrity Rule section; updated Move Task procedure (8→10 steps with validation); updated Update Task cross-reference |
| `plugins/sdd/skills/sdd-tasks/references/anti-patterns.md` | Modified | +39 | Added AP-09: Task Field Loss During Status Transitions with concrete example |
| `plugins/sdd/skills/sdd-tasks/references/task-schema.md` | Modified | +4 | Added Field Preservation subsection under Validation Rules |
| `plugins/sdd/skills/sdd-tasks/SKILL.md` | Modified | +1 | Added cross-reference bullet to Completion Rules |
| `plugins/sdd/skills/execute-tasks/agents/task-executor.md` | Modified | +6 / -5 | Rewrote Phase 4 Move Task File (4→5 steps with fresh read, preservation, validation, delete-after-verify) |
| `plugins/sdd/skills/execute-tasks/references/execution-workflow.md` | Modified | +6 / -5 | Mirrored task-executor Phase 4 changes |
| `plugins/sdd/skills/execute-tasks/references/orchestration.md` | Modified | +4 / -4 | Updated Step 7c (pending→in_progress) and Step 5.5 (interrupted recovery) with preservation language |
| `plugins/sdd/skills/execute-tasks-inline/references/orchestration.md` | Modified | +5 / -5 | Updated Step 7b (pending→in_progress, completion move) and Step 5.5 (interrupted recovery) |
| `plugins/sdd/skills/execute-tasks/SKILL.md` | Modified | +1 / -1 | Updated Phase 4 summary bullet with preservation language |
| `plugins/sdd/skills/execute-tasks-inline/SKILL.md` | Modified | +1 / -1 | Updated Phase 4 summary bullet with preservation language |

## Change Details

### Modified

- **`plugins/sdd/skills/sdd-tasks/references/operations.md`** — Added new "Task File Integrity Rule" section as the authoritative definition for task file preservation. This 4-step procedure (Read fresh → Modify only named fields → Write complete object → Verify canary fields) is referenced by all other files. Also updated the "Move Task" procedure from 8 to 10 steps, inserting a cross-reference to the integrity rule, a post-write verification step, and reordering delete-after-verify. Updated "Update Task" step 2 with cross-reference.

- **`plugins/sdd/skills/sdd-tasks/references/anti-patterns.md`** — Added AP-09: "Task Field Loss During Status Transitions" with a concrete JSON before/after example showing a task reduced from a full object to just `id`, `title`, `status`, and `updated_at`. Explains why field loss breaks retry logic, merge mode, progress UIs, and session archival.

- **`plugins/sdd/skills/sdd-tasks/references/task-schema.md`** — Added "Field Preservation" subsection under Validation Rules, establishing that every field present in the original must survive writes, with 4 canary fields to validate.

- **`plugins/sdd/skills/sdd-tasks/SKILL.md`** — Added one bullet to Completion Rules cross-referencing the Task File Integrity Rule and AP-09.

- **`plugins/sdd/skills/execute-tasks/agents/task-executor.md`** — Rewrote Phase 4 "Move Task File" from 4 steps to 5 steps. Added explicit "read fresh — do not rely on Phase 1 JSON" preamble, "Do NOT reconstruct the JSON from memory" warning, post-write validation of `acceptance_criteria` and `testing_requirements`, and moved delete to after verification.

- **`plugins/sdd/skills/execute-tasks/references/execution-workflow.md`** — Mirrored the task-executor Phase 4 changes for the shared execution workflow reference.

- **`plugins/sdd/skills/execute-tasks/references/orchestration.md`** — Updated Step 7c (mark tasks in_progress) to specify "fresh read", "parsed object", "all other fields remain unchanged", and "Do NOT reconstruct from memory." Updated Step 5.5 (interrupted task recovery) with the same preservation language.

- **`plugins/sdd/skills/execute-tasks-inline/references/orchestration.md`** — Updated Step 7b item 1 (pending→in_progress), Step 7b Phase 4 (in_progress→completed with verification), and Step 5.5 (interrupted task recovery) with preservation language matching the parallel orchestration changes.

- **`plugins/sdd/skills/execute-tasks/SKILL.md`** — Updated Phase 4 summary bullet to include "read JSON fresh", "modify only on parsed object", "all other fields unchanged", and "verify acceptance_criteria present."

- **`plugins/sdd/skills/execute-tasks-inline/SKILL.md`** — Same Phase 4 summary bullet update as the parallel variant.

## Git Status

### Unstaged Changes

```
M  plugins/sdd/skills/execute-tasks-inline/SKILL.md
M  plugins/sdd/skills/execute-tasks-inline/references/orchestration.md
M  plugins/sdd/skills/execute-tasks/SKILL.md
M  plugins/sdd/skills/execute-tasks/agents/task-executor.md
M  plugins/sdd/skills/execute-tasks/references/execution-workflow.md
M  plugins/sdd/skills/execute-tasks/references/orchestration.md
M  plugins/sdd/skills/sdd-tasks/SKILL.md
M  plugins/sdd/skills/sdd-tasks/references/anti-patterns.md
M  plugins/sdd/skills/sdd-tasks/references/operations.md
M  plugins/sdd/skills/sdd-tasks/references/task-schema.md
```

## Session Commits

No commits in this session — all changes are currently uncommitted.
