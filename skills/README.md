# Claude Alchemy Skills (Universal / Cline-Compatible)

Standalone, distributable skills that work in **both Cline and Claude Code** without subagent dependencies. All multi-agent orchestration from the original plugin has been converted to single-context sequential workflows.

## Installation

Copy the skills you want into your project's `.claude/skills/` directory (per-project) or `~/.claude/skills/` (global):

```bash
# Per-project (recommended)
cp -r skills/<skill-name> /path/to/your/project/.claude/skills/

# Global
cp -r skills/<skill-name> ~/.claude/skills/
```

## Available Skills

### User-Invocable Skills

| Skill | Description |
|-------|-------------|
| `git-commit` | Commit staged changes with conventional commit message |
| `feature-dev` | Full feature development workflow: exploration, architecture, implementation, review |
| `deep-analysis` | Deep codebase exploration and synthesis |
| `codebase-analysis` | Structured codebase analysis with reporting and actionable insights |
| `docs-manager` | Documentation management for MkDocs sites and standalone markdown files |

### Support Skills (Referenced by Other Skills)

| Skill | Description |
|-------|-------------|
| `architecture-patterns` | Architectural pattern knowledge (MVC, event-driven, CQRS, etc.) |
| `language-patterns` | Language-specific patterns for TypeScript, Python, and React |
| `project-conventions` | Guides discovery and application of project-specific conventions |
| `code-quality` | Code quality principles (SOLID, DRY, testing strategies) |
| `changelog-format` | Keep a Changelog format guidelines |

## Cross-Skill References

Skills reference each other using relative paths:

```markdown
Read `../deep-analysis/SKILL.md` and follow its workflow.
Read `../architecture-patterns/SKILL.md` and apply its guidance.
```

For this to work, keep the skill directories as siblings under a common parent (e.g., `.claude/skills/`).

## Differences from Plugin Version

These skills are adapted from the Claude Alchemy Tools plugin. Key differences:

- **No subagent dependencies** — All multi-agent orchestration is replaced with sequential single-context workflows
- **No plugin-specific features** — No `${CLAUDE_PLUGIN_ROOT}`, `model`, `allowed-tools`, or `agent` frontmatter fields
- **Relative path references** — Skills reference siblings via `../` paths instead of plugin root variables
- **Universal frontmatter** — Only `name`, `description`, `user-invocable`, `disable-model-invocation`, and `argument-hint` fields
