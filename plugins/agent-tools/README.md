# Agent Tools

Developer tools for working with Coding Agents — a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) plugin providing 10 composable skills for commit workflows, feature development, codebase analysis, and documentation generation.

## Installation

```bash
claude plugin add sequenzia/agent-tools
```

## Skills

### User-Invocable

| Skill | Command | Description |
|-------|---------|-------------|
| `git-commit` | `/git-commit <optional message override>` | Commit staged changes with conventional commit message |
| `feature-dev` | `/feature-dev <feature-description>` | Feature development workflow with exploration, architecture, implementation, and review phases |
| `deep-analysis` | `/deep-analysis <analysis-context or focus-area>` | Reusable deep codebase exploration and synthesis |
| `codebase-analysis` | `/codebase-analysis <analysis-context or feature-description>` | Structured codebase analysis with reporting and actionable insights |
| `docs-manager` | `/docs-manager <action-or-description>` | Documentation management for MkDocs sites and standalone markdown files |

### Support

Loaded automatically by other skills via relative path references — not invoked directly.

| Skill | Description |
|-------|-------------|
| `architecture-patterns` | Architectural pattern knowledge (MVC, event-driven, CQRS, microservices) |
| `language-patterns` | Language-specific patterns for TypeScript, Python, and React |
| `project-conventions` | Discovery and application of project-specific conventions |
| `code-quality` | Code quality principles (SOLID, DRY, testing strategies) |
| `changelog-format` | Keep a Changelog format guidelines and entry writing best practices |

## Skill Composition

Skills load other skills at runtime via relative path references. `deep-analysis` serves as the core reusable building block:

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

## Plugin Structure

```
.claude-plugin/
  plugin.json                              # Plugin manifest (v0.1.0)
skills/
  git-commit/SKILL.md
  feature-dev/SKILL.md
  feature-dev/resources/
    adr-template.md
    changelog-entry-template.md
  deep-analysis/SKILL.md
  codebase-analysis/SKILL.md
  codebase-analysis/resources/
    report-template.md
    actionable-insights-template.md
  docs-manager/SKILL.md
  docs-manager/resources/
    mkdocs-config-template.md
    markdown-file-templates.md
    change-summary-templates.md
  architecture-patterns/SKILL.md
  language-patterns/SKILL.md
  project-conventions/SKILL.md
  code-quality/SKILL.md
  changelog-format/SKILL.md
  changelog-format/resources/
    entry-examples.md
```

## License

MIT
