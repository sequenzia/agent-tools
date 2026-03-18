# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-03-18 |
| **Time** | 13:55 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | 776a0f0 |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: Port `create-spec` skill from Claude Code plugin to generic/harness-agnostic format

**Summary**: Ported the `create-spec` specification creation skill from `agent-alchemy/claude/sdd-tools` to the `agent-tools` repository as a harness-agnostic skill. Created a new `research` wrapper skill following the shared-agent pattern, and registered both skills in the README.

## Overview

This change ports a Claude Code-specific skill into the generic agent-tools framework, making it usable across any coding agent harness (Claude Code, OpenCode, Codex, etc.). All platform-specific elements (AskUserQuestion, TeamCreate/TeamDelete, SendMessage, CLAUDE_PLUGIN_ROOT paths, subagent_type dispatching) were replaced with generic equivalents (question tool, Execution Strategy pattern, relative paths, wrapper skill invocations).

- **Files affected**: 12
- **Lines added**: +2932
- **Lines removed**: -0
- **Commits**: 0 (all changes uncommitted)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `tools/skills/research/SKILL.md` | Added | +45 | Wrapper skill for research agent dispatch |
| `tools/skills/research/agents/researcher.md` | Added | +106 | Research agent with tiered methodology |
| `tools/skills/create-spec/SKILL.md` | Added | +772 | Main orchestrator skill — full interview workflow |
| `tools/skills/create-spec/references/codebase-exploration.md` | Added | +143 | Exploration procedure using code-exploration skill |
| `tools/skills/create-spec/references/complexity-signals.md` | Added | +62 | Complexity detection definitions (verbatim copy) |
| `tools/skills/create-spec/references/interview-questions.md` | Added | +351 | Question bank with tool name updates |
| `tools/skills/create-spec/references/recommendation-format.md` | Added | +222 | Recommendation templates in question tool format |
| `tools/skills/create-spec/references/recommendation-triggers.md` | Added | +251 | Trigger patterns for proactive recommendations (verbatim copy) |
| `tools/skills/create-spec/references/templates/high-level.md` | Added | +97 | Executive overview spec template (verbatim copy) |
| `tools/skills/create-spec/references/templates/detailed.md` | Added | +262 | Standard spec template (verbatim copy) |
| `tools/skills/create-spec/references/templates/full-tech.md` | Added | +602 | Full technical spec template (verbatim copy) |
| `tools/skills/README.md` | Modified | +19 / -0 | Registered both new skills in all tables |

## Change Details

### Added

- **`tools/skills/research/SKILL.md`** — New wrapper skill following the `code-exploration` and `code-architecture` pattern. Provides a canonical entry point for research dispatch, enabling any skill to invoke research without duplicating the agent definition.

- **`tools/skills/research/agents/researcher.md`** — Research agent with a tiered methodology: Tier 1 (documentation & standards via web search), Tier 2 (codebase & project context), Tier 3 (built-in knowledge as fallback). Covers compliance, technology, best practices, and competitive analysis. Includes graceful degradation when web search tools are unavailable.

- **`tools/skills/create-spec/SKILL.md`** — The main orchestrator skill (772 lines). Implements a 5-phase adaptive interview workflow: Initial Inputs, Adaptive Interview, Recommendations Round, Pre-Compilation Summary, and Spec Compilation. Key transformations from the source:
  - `AskUserQuestion` (batched) → `question` tool (one per call) with full parameter table
  - `TeamCreate`/`SendMessage` → Execution Strategy pattern with code-exploration skill
  - `Task` with `subagent_type: researcher` → research wrapper skill invocation
  - `${CLAUDE_PLUGIN_ROOT}` → relative `../` paths
  - Settings phase removed; sensible defaults with question-based confirmation
  - Plan Mode section genericized from Claude Code-specific language

- **`tools/skills/create-spec/references/codebase-exploration.md`** — Rewritten exploration procedure replacing team-based parallel dispatch (TeamCreate, SendMessage, TeamDelete) with `code-exploration` wrapper skill invocations. Follows the same pattern used by `deep-analysis`. Includes Execution Strategy for parallel vs. sequential dispatch.

- **`tools/skills/create-spec/references/interview-questions.md`** — Question bank with minor edits: ~5 references to `AskUserQuestion` replaced with `question` tool. All question content (57 questions across 4 categories, 3 depth levels, expanded budgets) preserved intact.

- **`tools/skills/create-spec/references/recommendation-format.md`** — All recommendation presentation templates rewritten from `AskUserQuestion` YAML format to `question` tool format. Key mapping: `question` → `text`, `options[].label + description` → combined `options[].label`, `multiSelect` → `multiple`, batched → single question per call.

- **`tools/skills/create-spec/references/complexity-signals.md`** — Copied verbatim from source. Defines 11 complexity signals (4 high-weight, 5 medium-weight, 2 low-weight) with threshold rules and assessment guidelines. No harness-specific content.

- **`tools/skills/create-spec/references/recommendation-triggers.md`** — Copied verbatim from source. Defines 9 trigger categories with keywords, recommendation areas, and detection guidelines. No harness-specific content.

- **`tools/skills/create-spec/references/templates/high-level.md`** — Copied verbatim. Executive overview spec template.

- **`tools/skills/create-spec/references/templates/detailed.md`** — Copied verbatim. Standard development spec template with user stories and acceptance criteria.

- **`tools/skills/create-spec/references/templates/full-tech.md`** — Copied verbatim. Comprehensive technical spec template with API definitions, data models, Mermaid diagrams, and deployment strategy.

### Modified

- **`tools/skills/README.md`** — Added entries to four sections:
  - Orchestrator Skills table: `create-spec` (invokes code-exploration and research)
  - Wrapper Skills table: `research` (wraps researcher agent, used by create-spec)
  - Agents table: `researcher` (located in research/agents/)
  - Directory Structure: both new skill directories with full file trees

## Git Status

### Unstaged Changes

- `M tools/skills/README.md`

### Untracked Files

- `tools/skills/create-spec/` (9 files)
- `tools/skills/research/` (2 files)

## Session Commits

No commits in this session. All changes are uncommitted.
