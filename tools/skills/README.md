# Skills & Agents

Reusable skills and agents for codebase analysis, feature development, debugging, documentation, and git workflows.

## Skills

| Skill | Description |
|-------|-------------|
| `deep-analysis` | Hub-and-spoke analysis with dynamic planning. Performs reconnaissance, spawns explorer subagents, and synthesizes findings. |
| `codebase-analysis` | Structured 3-phase workflow: deep analysis, reporting, and post-analysis actions (save report, update docs, address insights). |
| `feature-dev` | 7-phase feature development: Discovery, Exploration, Questions, Architecture, Implementation, Review, Summary. |
| `bug-killer` | Hypothesis-driven debugging: Triage & Reproduction, Investigation, Root Cause Analysis, Fix & Verify, Wrap-up & Report. Supports `--deep` flag. |
| `docs-manager` | Documentation management with MkDocs integration. Generates markdown files, updates navigation, handles change summaries. |
| `document-changes` | Generate a markdown report documenting session changes -- files affected, change details, and commit history. |
| `release-python-package` | Python package release automation workflow. |
| `git-commit` | Automates git commits following Conventional Commits format. |
| `language-patterns` | TypeScript, Python, and React patterns, idioms, and best practices. |
| `project-conventions` | Discovers and applies project-specific conventions (naming, structure, patterns). |
| `technical-diagrams` | Mermaid diagram syntax, styling, and best practices for flowcharts, sequence, class, state, ER, and C4 diagrams. |
| `architecture-patterns` | Design patterns and architectural approaches. |
| `code-quality` | Quality criteria and review guidelines. |
| `project-learnings` | Captures project-specific patterns and anti-patterns into the project's AGENTS.md. |
| `changelog-format` | Keep a Changelog format guidelines with entry examples. |

## Agents

| Agent | Purpose |
|-------|---------|
| `code-explorer` | Focused area exploration worker. Reads files, searches patterns, produces structured reports. |
| `code-synthesizer` | Merges exploration findings into unified analysis. Has bash access for git history, dependency trees, and static analysis. |
| `code-architect` | Designs implementation blueprints with minimal, flexible, and project-aligned approaches. |
| `code-reviewer` | Quality review with confidence-scored findings. |
| `bug-investigator` | Diagnostic investigation agent for testing debugging hypotheses. |
| `changelog-manager` | Manages CHANGELOG.md entries following Keep a Changelog format. |
| `docs-writer` | Generates and updates documentation files. |

## Directory Structure

```
tools/
├── agents/
│   ├── code-architect.md
│   ├── code-explorer.md
│   ├── code-synthesizer.md
│   ├── code-reviewer.md
│   ├── bug-investigator.md
│   ├── changelog-manager.md
│   └── docs-writer.md
└── skills/
    ├── codebase-analysis/
    ├── deep-analysis/
    ├── language-patterns/
    ├── project-conventions/
    ├── technical-diagrams/
    ├── architecture-patterns/
    ├── bug-killer/
    ├── changelog-format/
    ├── code-quality/
    ├── docs-manager/
    ├── document-changes/
    ├── feature-dev/
    ├── project-learnings/
    ├── release-python-package/
    ├── git-commit/
    └── README.md
```
