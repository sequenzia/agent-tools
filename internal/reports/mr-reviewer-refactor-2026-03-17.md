# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-03-17 |
| **Time** | 20:50 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | `b5ed12c` |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: mr-reviewer skill refactor for cross-harness portability

**Summary**: Comprehensive restructuring of the `mr-reviewer` skill to align with the project's cross-harness portability patterns. Extracted inline agent prompts into standalone agent files, replaced all Claude Code-specific patterns (subagent types, `@skills/` references, Handlebars templates) with harness-agnostic equivalents, and reduced SKILL.md from 2,298 to 386 lines.

## Overview

Major architectural refactor of the mr-reviewer skill to make it compatible with OpenCode, Codex, and Windsurf harnesses in addition to Claude Code. The work resolved 6 cross-harness blockers, restructured files to match ecosystem conventions, and improved finding quality with confidence scoring and smarter deduplication.

- **Files affected**: 9 (3 created, 4 modified, 1 deleted, 1 new report)
- **Lines added**: +321
- **Lines removed**: -2,651
- **Commits**: 0 (all changes uncommitted)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `tools/skills/mr-reviewer/SKILL.md` | Modified | +386 / -2,298 | Complete rewrite: added frontmatter fields, agent table, execution strategy; removed inline prompts; replaced Claude Code-specific patterns |
| `tools/skills/mr-reviewer/agents/codebase-understanding.md` | Added | +133 | New agent file: convention violations, architectural issues, integration risks |
| `tools/skills/mr-reviewer/agents/code-quality.md` | Added | +172 | New agent file: bugs, code quality, best practices, error handling; expanded language coverage |
| `tools/skills/mr-reviewer/agents/git-history.md` | Added | +146 | New agent file: regression risks, high-churn areas, historical context |
| `tools/skills/mr-reviewer/references/finding-schema.md` | Modified | +158 / -92 | Added confidence field, category-aware deduplication, structured sub-findings format, merge examples |
| `tools/skills/mr-reviewer/references/gitlab-api-patterns.md` | Modified | +1 / -1 | Replaced `@skills/glab` references with relative paths |
| `tools/skills/mr-reviewer/references/subagent-prompts.md` | Deleted | -497 | Content moved to agents/ directory; eliminated triple duplication |
| `tools/skills/README.md` | Modified | +13 | Added mr-reviewer to orchestrator skills table, agents table, and directory structure |

## Change Details

### Added

- **`tools/skills/mr-reviewer/agents/codebase-understanding.md`** -- Standalone agent file extracted from SKILL.md section 2.1. Analyzes MR changed files and surrounding codebase context for convention, architecture, and integration-risk findings. Uses plain-text placeholders instead of Handlebars syntax. Includes confidence scoring guidelines.

- **`tools/skills/mr-reviewer/agents/code-quality.md`** -- Standalone agent file extracted from SKILL.md section 2.2. Performs bug detection, code quality analysis, best practice checking, and error handling review. Expanded language coverage: detailed rules for Python/TypeScript/JavaScript plus general heuristics for Go, Rust, Java, C#, and other languages.

- **`tools/skills/mr-reviewer/agents/git-history.md`** -- Standalone agent file extracted from SKILL.md section 2.3. Examines git history for regression risks, high-churn patterns, and historical context. Uses plain-text placeholders for orchestrator-injected context.

### Modified

- **`tools/skills/mr-reviewer/SKILL.md`** -- Complete rewrite from 2,298 to 386 lines (83% reduction). Key changes:
  - Added `allowed-tools: Read Glob Grep Bash` and `metadata.argument-hint` to frontmatter
  - Added `## Agents` table listing all three agents with files, tools, and descriptions
  - Added `## Execution Strategy` with dual-path pattern (parallel subagent dispatch OR sequential inline execution)
  - Added `## Platform Requirements` with graceful degradation when glab is unavailable
  - Added `## Configuration Parameters` table with `--deep`, `--report-only`, `--comments-only` flags
  - Replaced all inline agent prompts (~900 lines) with 10-15 line summaries pointing to agent files
  - Replaced all `@skills/glab` references with relative paths (`../glab/SKILL.md`)
  - Removed all `subagent_type` directives (Claude Code-specific)
  - Changed default depth from `feature-scoped` to `mr-scoped` for faster default experience
  - Reduced interactive prompts from 5 to 0 for the common case
  - Added automatic large MR detection with auto-applied focused mode
  - Consolidated error handling sections to eliminate duplication

- **`tools/skills/mr-reviewer/references/finding-schema.md`** -- Updated from 261 to 327 lines. Key changes:
  - Added `confidence` field (0-100) to the schema definition (now 10 fields)
  - Replaced line-overlap-only deduplication with category-aware merging (merge only if findings share a category, have >50% overlap, or come from the same source)
  - Replaced pipe-separated merged finding format with structured sub-findings format (labeled bullets per source)
  - Added confidence to all example findings
  - Moved and expanded the merge example from SKILL.md sections 3.5-3.6 into this file
  - Updated validation rules for 10-field schema

- **`tools/skills/mr-reviewer/references/gitlab-api-patterns.md`** -- Replaced 2 occurrences of `@skills/glab` with relative path `../glab/` equivalents.

- **`tools/skills/README.md`** -- Added mr-reviewer to the orchestrator skills table with its 3 agents and glab dependency. Added all 3 agents to the agents table. Added mr-reviewer to the directory structure tree with its agents/ and references/ subdirectories.

### Deleted

- **`tools/skills/mr-reviewer/references/subagent-prompts.md`** -- Removed because its 497 lines of content were a duplicate of the agent prompts that also appeared inline in SKILL.md. The canonical source for agent instructions is now the `agents/*.md` files, eliminating triple duplication.

## Git Status

### Unstaged Changes

```
M  tools/skills/README.md
M  tools/skills/mr-reviewer/SKILL.md
M  tools/skills/mr-reviewer/references/finding-schema.md
M  tools/skills/mr-reviewer/references/gitlab-api-patterns.md
D  tools/skills/mr-reviewer/references/subagent-prompts.md
```

### Untracked Files

```
tools/skills/mr-reviewer/agents/codebase-understanding.md
tools/skills/mr-reviewer/agents/code-quality.md
tools/skills/mr-reviewer/agents/git-history.md
```

## Session Commits

No commits in this session. All changes are uncommitted.

## Cross-Harness Blockers Resolved

| # | Blocker | Resolution |
|---|---------|------------|
| 1 | No execution strategy pattern | Added dual-path section: parallel dispatch OR sequential inline execution |
| 2 | Claude Code-specific `subagent_type` directives | Removed entirely; agent tools declared in individual frontmatter |
| 3 | `@skills/glab` references (11 occurrences) | Replaced with relative paths (`../glab/SKILL.md`) |
| 4 | Handlebars template syntax (`{{#if}}`, `{{#each}}`, `{{variable}}`) | Replaced with plain-text placeholders and natural-language conditionals |
| 5 | Missing `allowed-tools` frontmatter | Added `allowed-tools: Read Glob Grep Bash` |
| 6 | No agents/ directory | Created with 3 standalone agent files matching ecosystem pattern |

## Architecture Comparison

### Before

```
mr-reviewer/                          (2,298 + 497 + 261 + 248 = 3,304 lines)
├── SKILL.md                          (2,298 lines -- 5x ecosystem norm)
└── references/
    ├── finding-schema.md             (261 lines)
    ├── gitlab-api-patterns.md        (248 lines)
    └── subagent-prompts.md           (497 lines -- duplicate of SKILL.md content)
```

### After

```
mr-reviewer/                          (386 + 451 + 327 + 248 = 1,412 lines)
├── SKILL.md                          (386 lines -- within 265-472 ecosystem norm)
├── agents/
│   ├── codebase-understanding.md     (133 lines)
│   ├── code-quality.md               (172 lines)
│   └── git-history.md                (146 lines)
└── references/
    ├── finding-schema.md             (327 lines)
    └── gitlab-api-patterns.md        (248 lines)
```
