# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

This is a collection of **Claude Alchemy Skills** — standalone, distributable AI agent skill definitions packaged as a Claude Code plugin. There is no build system, no package manager, no tests — the deliverables are Markdown files (SKILL.md) with YAML frontmatter and optional `resources/` directories.

## Repository Structure

```
plugins/agent-tools/               # Claude Code plugin
  .claude-plugin/
    plugin.json                    # Plugin manifest (v0.1.0)
  skills/
    <skill-name>/
      SKILL.md                     # Skill definition (frontmatter + workflow)
      resources/                   # Optional templates/examples used by the skill

.claude-plugin/
  marketplace.json                 # Root marketplace manifest

skills/                            # Standalone skill copies (Cline-compatible)
  <skill-name>/
    SKILL.md
    resources/
```

### Skill Categories

**User-invocable skills** (can be triggered directly):
- `git-commit` — Conventional commit workflow
- `feature-dev` — 7-phase feature development (discovery → exploration → questions → architecture → implementation → review → summary)
- `deep-analysis` — 3-phase codebase exploration and synthesis (reconnaissance → systematic exploration → synthesis)
- `codebase-analysis` — Structured analysis with reporting and post-analysis actions
- `docs-manager` — Documentation generation for MkDocs sites and standalone markdown

**Support skills** (loaded by other skills via relative path references):
- `architecture-patterns` — Architectural pattern catalog (layered, MVC, repository, event-driven, CQRS, hexagonal, microservices)
- `language-patterns` — TypeScript, Python, and React idioms
- `project-conventions` — Convention discovery and application guidance
- `code-quality` — SOLID, DRY, testing strategies, code review checklists
- `changelog-format` — Keep a Changelog specification and entry guidelines

## Key Architectural Concepts

- **Dual distribution.** Skills are packaged as a Claude Code plugin under `plugins/agent-tools/` and also available as standalone copies under `skills/` for Cline compatibility.
- **No subagent dependencies.** All multi-agent orchestration from the original plugin is replaced with sequential single-context workflows.
- **Cross-skill references use relative paths.** Skills reference siblings via `../sibling-skill/SKILL.md`. Skills must remain as siblings under a common parent directory for references to resolve.
- **Universal frontmatter only.** Valid fields: `name`, `description`, `user-invocable`, `disable-model-invocation`, `argument-hint`. No plugin-specific fields (`${CLAUDE_PLUGIN_ROOT}`, `model`, `allowed-tools`, `agent`).
- **Composable skill chains.** `feature-dev` loads `deep-analysis`, which loads `project-conventions` and `language-patterns`. `codebase-analysis` also chains through `deep-analysis`. `docs-manager` also chains through `deep-analysis` and loads `changelog-format`. `feature-dev` additionally loads `architecture-patterns`, `code-quality`, and `changelog-format`.
- **`deep-analysis` is the core building block.** Used by `feature-dev`, `codebase-analysis`, and `docs-manager`.

## Editing Skills

When modifying a skill:
- Preserve the YAML frontmatter format exactly
- Keep phase numbering sequential and consistent with the Phase Overview section
- If a skill references another skill (e.g., `Read ../deep-analysis/SKILL.md`), verify the referenced skill still supports that usage
- Resource files in `resources/` are templates loaded by skills at runtime — changes affect all skills that reference them
- Skills that say "CRITICAL: Complete ALL N phases" enforce that the workflow must auto-continue without waiting for user input between phases (except where `AskUserQuestion` is explicitly called)
- When editing skills in `plugins/agent-tools/skills/`, keep the standalone `skills/` copies in sync
