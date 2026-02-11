# Agent Tools

A collection of **Claude Alchemy Skills** — standalone, distributable AI agent skill definitions packaged as a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin, also usable standalone with [Cline](https://github.com/cline/cline).

No build system, no package manager, no tests. The deliverables are Markdown files (`SKILL.md`) with YAML frontmatter and optional `resources/` directories.

## Quick Start

### As a Claude Code Plugin (Recommended)

Install the plugin directly from this repository:

```bash
claude plugin add sequenzia/agent-tools
```

### As Standalone Skills

Copy individual skills into your skills directory:

```bash
# Per-project
cp -r skills/<skill-name> /path/to/your/project/.claude/skills/

# Global
cp -r skills/<skill-name> ~/.claude/skills/
```

See [`skills/README.md`](skills/README.md) for standalone usage details.

## Skills at a Glance

### User-Invocable Skills

| Skill | Description |
|-------|-------------|
| `git-commit` | Commit staged changes with conventional commit message |
| `feature-dev` | Feature development workflow with exploration, architecture, implementation, and review phases |
| `deep-analysis` | Reusable deep codebase exploration and synthesis |
| `codebase-analysis` | Structured codebase analysis with reporting and actionable insights |
| `docs-manager` | Documentation management for MkDocs sites and standalone markdown files |

### Support Skills

Loaded by other skills via relative path references — not invoked directly.

| Skill | Description |
|-------|-------------|
| `architecture-patterns` | Architectural pattern knowledge (MVC, event-driven, CQRS, microservices, etc.) |
| `language-patterns` | Language-specific patterns for TypeScript, Python, and React |
| `project-conventions` | Discovery and application of project-specific conventions |
| `code-quality` | Code quality principles (SOLID, DRY, testing strategies) |
| `changelog-format` | Keep a Changelog format guidelines and entry writing best practices |

## How Skills Work

### Single-Context Sequential Workflows

All skills run as sequential workflows within a single conversation context — no subagent dependencies. Each skill defines numbered phases that execute in order.

### Composable Skill Chains

Skills load other skills at runtime via relative path references (`../sibling-skill/SKILL.md`). `deep-analysis` serves as the core reusable building block:

```
feature-dev
├── deep-analysis
│   ├── project-conventions
│   └── language-patterns
├── architecture-patterns
├── code-quality
└── changelog-format

codebase-analysis
└── deep-analysis
    ├── project-conventions
    └── language-patterns

docs-manager
├── deep-analysis
│   ├── project-conventions
│   └── language-patterns
└── changelog-format
```

For cross-skill references to resolve, skill directories must remain as siblings under a common parent.

## Repository Structure

```
plugins/agent-tools/                   # Claude Code plugin
  .claude-plugin/
    plugin.json                        # Plugin manifest (v0.1.0)
  skills/
    <skill-name>/
      SKILL.md                         # Skill definition (frontmatter + workflow)
      resources/                       # Optional templates/examples used at runtime

.claude-plugin/
  marketplace.json                     # Root marketplace manifest

skills/                                # Standalone copies (Cline-compatible)
  README.md                            # Installation and usage details
  <skill-name>/
    SKILL.md
    resources/
```

## Contributing

When adding or modifying skills:

- **Frontmatter** — Use only universal fields: `name`, `description`, `user-invocable`, `disable-model-invocation`, `argument-hint`
- **Phase numbering** — Keep sequential and consistent with the Phase Overview section
- **Cross-skill references** — If a skill references another (e.g., `Read ../deep-analysis/SKILL.md`), verify the referenced skill still supports that usage
- **Resource files** — Templates in `resources/` are shared at runtime; changes affect all skills that reference them
