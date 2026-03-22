# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-03-21 |
| **Time** | 20:28 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | `08ee2e9` |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: Subagent reorganization — fix naming collision, standardize terminology, add agent metadata to frontmatter

**Summary**: Reorganized the skill subagent system by resolving the `code-quality` agent/skill name collision, standardizing documentation terminology from "Wrapper Skills" to "Agent Skills", adding structured agent metadata to all 9 SKILL.md frontmatter blocks, and documenting the agent placement rule (private-by-default, promote to dispatcher when shared).

## Overview

Metadata and documentation changes across 11 files to make the agent ecosystem explicit and discoverable without restructuring directories or changing paths.

- **Files affected**: 11
- **Lines added**: +85
- **Lines removed**: -26

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `skills/core/mr-reviewer/agents/mr-code-quality.md` | Renamed | +1 / -1 | Renamed from `code-quality.md`, updated `name` frontmatter to `mr-code-quality` |
| `skills/core/mr-reviewer/SKILL.md` | Modified | +16 / -4 | Updated 3 agent path references to `mr-code-quality.md`, added `agents` metadata block with 3 private agents |
| `skills/README.md` | Modified | +50 / -26 | Renamed section headers, enhanced agents table with Shared/Consumers columns, added Agent Placement Rule |
| `skills/core/code-exploration/SKILL.md` | Modified | +10 / -0 | Added agents metadata: `code-explorer` (shared, 5 consumers) |
| `skills/core/code-architecture/SKILL.md` | Modified | +7 / -0 | Added agents metadata: `code-architect` (shared, 2 consumers) |
| `skills/core/research/SKILL.md` | Modified | +6 / -0 | Added agents metadata: `researcher` (shared, 1 consumer) |
| `skills/core/deep-analysis/SKILL.md` | Modified | +4 / -0 | Added agents metadata: `code-synthesizer` (private) |
| `skills/core/feature-dev/SKILL.md` | Modified | +4 / -0 | Added agents metadata: `code-reviewer` (private) |
| `skills/core/bug-killer/SKILL.md` | Modified | +4 / -0 | Added agents metadata: `bug-investigator` (private) |
| `skills/core/docs-manager/SKILL.md` | Modified | +4 / -0 | Added agents metadata: `docs-writer` (private) |
| `skills/core/release-python-package/SKILL.md` | Modified | +4 / -0 | Added agents metadata: `changelog-manager` (private) |

## Change Details

### Renamed

- **`skills/core/mr-reviewer/agents/mr-code-quality.md`** — Renamed from `code-quality.md` to resolve naming collision with the `code-quality` reference skill. The agent's frontmatter `name` field was updated from `code-quality` to `mr-code-quality`.

### Modified

- **`skills/core/mr-reviewer/SKILL.md`** — Updated all 3 references to the renamed agent (`agents/code-quality.md` → `agents/mr-code-quality.md` at the Agents table, execution strategy, and Section 2.2). Added `agents` metadata block listing all 3 private agents (codebase-understanding, mr-code-quality, git-history).

- **`skills/README.md`** — Renamed "Orchestrator Skills" → "Workflow Skills (orchestrate agents and phases)". Renamed "Wrapper Skills" → "Agent Skills (shared agent dispatch)". Updated `code-quality` agent reference to `mr-code-quality` in Workflow Skills table. Added `create-spec` to code-exploration's Used By column. Restructured Agents table with Shared (Yes/No) and Consumers columns, grouped shared agents first. Added "Agent Placement Rule" section documenting the private-by-default promotion pattern. Updated directory tree comments from "(wrapper: ...)" to "(agent skill: ...)" and renamed `code-quality.md` to `mr-code-quality.md`.

- **`skills/core/code-exploration/SKILL.md`** — Added `agents` metadata to frontmatter: `code-explorer` agent marked as shared with 5 consumers (deep-analysis, bug-killer, docs-manager, codebase-analysis, create-spec).

- **`skills/core/code-architecture/SKILL.md`** — Added `agents` metadata: `code-architect` marked as shared with 2 consumers (feature-dev, codebase-analysis).

- **`skills/core/research/SKILL.md`** — Added `agents` metadata: `researcher` marked as shared with 1 consumer (create-spec).

- **`skills/core/deep-analysis/SKILL.md`** — Added `agents` metadata: `code-synthesizer` marked as private (not shared).

- **`skills/core/feature-dev/SKILL.md`** — Added `agents` metadata: `code-reviewer` marked as private.

- **`skills/core/bug-killer/SKILL.md`** — Added `agents` metadata: `bug-investigator` marked as private.

- **`skills/core/docs-manager/SKILL.md`** — Added `agents` metadata: `docs-writer` marked as private.

- **`skills/core/release-python-package/SKILL.md`** — Added `agents` metadata: `changelog-manager` marked as private.

## Git Status

### Staged Changes

| File | Status |
|------|--------|
| `skills/core/mr-reviewer/agents/code-quality.md` → `skills/core/mr-reviewer/agents/mr-code-quality.md` | Renamed |

### Unstaged Changes

| File | Status |
|------|--------|
| `skills/README.md` | Modified |
| `skills/core/bug-killer/SKILL.md` | Modified |
| `skills/core/code-architecture/SKILL.md` | Modified |
| `skills/core/code-exploration/SKILL.md` | Modified |
| `skills/core/deep-analysis/SKILL.md` | Modified |
| `skills/core/docs-manager/SKILL.md` | Modified |
| `skills/core/feature-dev/SKILL.md` | Modified |
| `skills/core/mr-reviewer/SKILL.md` | Modified |
| `skills/core/mr-reviewer/agents/mr-code-quality.md` | Modified |
| `skills/core/release-python-package/SKILL.md` | Modified |
| `skills/core/research/SKILL.md` | Modified |

## Session Commits

No commits in this session. All changes are uncommitted.
