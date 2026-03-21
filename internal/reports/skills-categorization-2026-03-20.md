# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-03-20 |
| **Time** | 21:06 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | `06fb046` |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: Organize skills into `core/` and `sdd/` category subdirectories

**Summary**: Reorganized all 24 skills from a flat `skills/` directory into two category subdirectories — `skills/core/` (21 general-purpose skills) and `skills/sdd/` (3 Spec-Driven Development skills) — for better repo-level organization. Updated `skills/README.md` to reflect the new directory structure and agent locations.

## Overview

Pure structural reorganization with no content changes to skill files. All moves tracked as `R100` renames preserving full git history.

- **Files affected**: 87
- **Lines added**: +97
- **Lines removed**: -91
- **Commits**: 0 (all changes uncommitted)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `skills/README.md` | Modified | +97 / -91 | Updated agents table locations and directory structure tree |
| `skills/{21 core skills}/*` | Renamed | 0 | Moved from `skills/` to `skills/core/` (69 files) |
| `skills/{3 sdd skills}/*` | Renamed | 0 | Moved from `skills/` to `skills/sdd/` (17 files) |

## Change Details

### Modified

- **`skills/README.md`** — Updated the Agents table to prefix all location paths with `core/` (e.g., `code-exploration/agents/` → `core/code-exploration/agents/`). Rewrote the Directory Structure section to show the two-level `core/` and `sdd/` hierarchy. Added a note explaining that skills are flattened at deployment time.

### Renamed (skills/core/)

21 skill directories moved from `skills/` to `skills/core/`, totaling 69 files:

- **`architecture-patterns`** — Architectural pattern knowledge (MVC, event-driven, CQRS, etc.)
- **`bug-killer`** — Hypothesis-driven debugging workflow (SKILL.md + 1 agent + 3 references)
- **`changelog-format`** — Keep a Changelog format guidelines (SKILL.md + 1 reference)
- **`code-architecture`** — Shared agent wrapper for code-architect (SKILL.md + 1 agent)
- **`code-exploration`** — Shared agent wrapper for code-explorer (SKILL.md + 1 agent)
- **`code-quality`** — Code quality principles and review guidelines
- **`codebase-analysis`** — Structured codebase analysis workflow (SKILL.md + 2 references)
- **`create-skill-opencode`** — Skill generation for OpenCode framework (SKILL.md + 7 references)
- **`deep-analysis`** — Hub-and-spoke analysis with dynamic planning (SKILL.md + 1 agent)
- **`docs-manager`** — MkDocs documentation management (SKILL.md + 1 agent + 3 references)
- **`document-changes`** — Session change report generation
- **`feature-dev`** — 7-phase feature development workflow (SKILL.md + 1 agent + 2 references)
- **`git-commit`** — Conventional commit automation
- **`glab`** — GitLab CLI patterns and reference (SKILL.md + 11 references)
- **`language-patterns`** — TypeScript, Python, and React patterns
- **`mr-reviewer`** — Automated MR review with 3 parallel agents (SKILL.md + 3 agents + 2 references)
- **`project-conventions`** — Project convention discovery and application
- **`project-learnings`** — Pattern capture to AGENTS.md
- **`release-python-package`** — Python package release automation (SKILL.md + 1 agent)
- **`research`** — Shared agent wrapper for researcher (SKILL.md + 1 agent)
- **`technical-diagrams`** — Mermaid diagram syntax and styling (SKILL.md + 6 references)

### Renamed (skills/sdd/)

3 skill directories moved from `skills/` to `skills/sdd/`, totaling 17 files:

- **`agent-tasks`** — Task schema, CRUD operations, and management patterns (SKILL.md + 3 references)
- **`create-spec`** — Adaptive interview-driven spec creation (SKILL.md + 5 references + 3 templates)
- **`create-tasks`** — Spec-to-task decomposition (SKILL.md + 3 references)

## Git Status

### Staged Changes

86 files renamed via `git mv`:

| Status | From | To |
|--------|------|----|
| R100 | `skills/architecture-patterns/` | `skills/core/architecture-patterns/` |
| R100 | `skills/bug-killer/` | `skills/core/bug-killer/` |
| R100 | `skills/changelog-format/` | `skills/core/changelog-format/` |
| R100 | `skills/code-architecture/` | `skills/core/code-architecture/` |
| R100 | `skills/code-exploration/` | `skills/core/code-exploration/` |
| R100 | `skills/code-quality/` | `skills/core/code-quality/` |
| R100 | `skills/codebase-analysis/` | `skills/core/codebase-analysis/` |
| R100 | `skills/create-skill-opencode/` | `skills/core/create-skill-opencode/` |
| R100 | `skills/deep-analysis/` | `skills/core/deep-analysis/` |
| R100 | `skills/docs-manager/` | `skills/core/docs-manager/` |
| R100 | `skills/document-changes/` | `skills/core/document-changes/` |
| R100 | `skills/feature-dev/` | `skills/core/feature-dev/` |
| R100 | `skills/git-commit/` | `skills/core/git-commit/` |
| R100 | `skills/glab/` | `skills/core/glab/` |
| R100 | `skills/language-patterns/` | `skills/core/language-patterns/` |
| R100 | `skills/mr-reviewer/` | `skills/core/mr-reviewer/` |
| R100 | `skills/project-conventions/` | `skills/core/project-conventions/` |
| R100 | `skills/project-learnings/` | `skills/core/project-learnings/` |
| R100 | `skills/release-python-package/` | `skills/core/release-python-package/` |
| R100 | `skills/research/` | `skills/core/research/` |
| R100 | `skills/technical-diagrams/` | `skills/core/technical-diagrams/` |
| R100 | `skills/agent-tasks/` | `skills/sdd/agent-tasks/` |
| R100 | `skills/create-spec/` | `skills/sdd/create-spec/` |
| R100 | `skills/create-tasks/` | `skills/sdd/create-tasks/` |

### Unstaged Changes

| Status | File |
|--------|------|
| Modified | `skills/README.md` |

## Notes

- All `git mv` operations registered as `R100` (100% content similarity), preserving full git history via `git log --follow`
- Inter-skill relative path references (`../other-skill/SKILL.md`) were intentionally left unchanged — deployment flattens the directory structure
- No files outside `skills/` were affected; internal reports and config files remain untouched
