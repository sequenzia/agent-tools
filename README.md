# Agent Tools

A collection of **Claude Alchemy Skills** — standalone, distributable AI agent skill definitions that work in both [Cline](https://github.com/cline/cline) and [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

No build system, no package manager, no tests. The deliverables are Markdown files (`SKILL.md`) with YAML frontmatter and optional `resources/` directories.

## Quick Start

Copy the skills you want into your skills directory:

```bash
# Per-project (recommended)
cp -r cline/skills/<skill-name> /path/to/your/project/.claude/skills/

# Global
cp -r cline/skills/<skill-name> ~/.claude/skills/
```

See [`cline/README.md`](cline/README.md) for full installation details and usage.

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

Skills load other skills at runtime via relative path references (`../sibling-skill/SKILL.md`). `deep-analysis` serves as the core building block:

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
```

For cross-skill references to resolve, skill directories must remain as siblings under a common parent (e.g., `.claude/skills/`).

## Repository Structure

```
cline/
  README.md                          # Installation and usage details
  skills/
    <skill-name>/
      SKILL.md                       # Skill definition (frontmatter + workflow)
      resources/                     # Optional templates/examples used at runtime
```

## Contributing

When adding or modifying skills:

- **Frontmatter** — Use only universal fields: `name`, `description`, `user-invocable`, `disable-model-invocation`, `argument-hint`
- **Phase numbering** — Keep sequential and consistent with the Phase Overview section
- **Cross-skill references** — If a skill references another (e.g., `Read ../deep-analysis/SKILL.md`), verify the referenced skill still supports that usage
- **Resource files** — Templates in `resources/` are shared at runtime; changes affect all skills that reference them
