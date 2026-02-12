# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

This is a collection of **Claude Alchemy Skills** — standalone, distributable AI agent skill definitions packaged as a Claude Code plugin. There is no build system, no package manager, no tests — the deliverables are Markdown files (SKILL.md) with YAML frontmatter and optional `resources/` directories.

## Repository Structure

```
plugins/dev-tools/                   # Claude Code plugin (v0.1.0)
  .claude-plugin/
    plugin.json                      # Plugin manifest
  .mcp.json                          # MCP server config (Context7)
  README.md                          # Plugin documentation
  skills/
    README.md                        # Standalone usage guide
    <skill-name>/
      SKILL.md                       # Skill definition (frontmatter + workflow)
      resources/                     # Optional templates/examples

.claude-plugin/
  marketplace.json                   # Root marketplace manifest

CLAUDE.md                            # AI agent instructions (this file)
README.md                            # User-facing documentation
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

### Resource Files

Four skills include `resources/` directories with templates and examples:

| Skill | Resources |
|-------|-----------|
| `changelog-format` | `entry-examples.md` |
| `codebase-analysis` | `report-template.md`, `actionable-insights-template.md`, `readme-template.md`, `claude-md-template.md`, `agents-md-template.md` |
| `feature-dev` | `adr-template.md`, `changelog-entry-template.md` |
| `docs-manager` | `mkdocs-config-template.md`, `markdown-file-templates.md`, `change-summary-templates.md` |

Resource files use kebab-case with `-template.md` or `-examples.md` suffixes. They are loaded by skills via `Read resources/filename.md`.

## Key Architectural Concepts

- **Plugin-based distribution.** Skills are packaged as a Claude Code plugin under `plugins/dev-tools/`. Skills can also be copied individually for standalone use — they must remain as siblings under a common parent directory for cross-references to resolve.
- **No subagent dependencies.** All multi-agent orchestration from the original plugin is replaced with sequential single-context workflows.
- **Cross-skill references use relative paths.** Skills reference siblings via `../sibling-skill/SKILL.md`. Skills must remain as siblings under a common parent directory for references to resolve.
- **Universal frontmatter only.** Valid fields: `name`, `description`, `user-invocable`, `disable-model-invocation`, `argument-hint`. No plugin-specific fields (`${CLAUDE_PLUGIN_ROOT}`, `model`, `allowed-tools`, `agent`).
- **Composable skill chains.** `feature-dev` loads `deep-analysis`, which loads `project-conventions` and `language-patterns`. `codebase-analysis` also chains through `deep-analysis`. `docs-manager` also chains through `deep-analysis` and loads `changelog-format`. `feature-dev` additionally loads `architecture-patterns`, `code-quality`, and `changelog-format`.
- **`deep-analysis` is the core building block.** Used by `feature-dev`, `codebase-analysis`, and `docs-manager`. Has a dual-mode completion: returns control silently when called by another skill, presents results when invoked standalone.
- **MCP integration.** The plugin includes a Context7 MCP server (`.mcp.json`) for fetching external library documentation at runtime.

### Skill Dependency Graph

```
feature-dev ──────┬── deep-analysis ──┬── project-conventions
                  │                   └── language-patterns
                  ├── architecture-patterns
                  ├── code-quality
                  └── changelog-format

codebase-analysis ─── deep-analysis ──┬── project-conventions
                  │                   └── language-patterns
                  └── architecture-patterns  (conditional, for complex fixes)

docs-manager ─────┬── deep-analysis ──┬── project-conventions
                  │                   └── language-patterns
                  └── changelog-format

git-commit (standalone, no dependencies)
```

## Editing Skills

When modifying a skill:
- Preserve the YAML frontmatter format exactly
- Keep phase numbering sequential and consistent with the Phase Overview section
- If a skill references another skill (e.g., `Read ../deep-analysis/SKILL.md`), verify the referenced skill still supports that usage
- Resource files in `resources/` are templates loaded by skills at runtime — changes affect all skills that reference them
- Skills that say "CRITICAL: Complete ALL N phases" enforce that the workflow must auto-continue without waiting for user input between phases (except where `AskUserQuestion` is explicitly called)
- Changes to `deep-analysis` have the widest blast radius — it is loaded by 3 other user-invocable skills
