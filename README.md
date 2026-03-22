# Agent Tools

Reusable skills and agents for AI coding assistants — a harness-agnostic plugin ecosystem for codebase analysis, feature development, debugging, documentation, code review, and spec-driven development.

## Architecture

Skills are organized into a 4-type taxonomy:

| Type | Count | Purpose |
|------|-------|---------|
| **Workflow** | 10 | Multi-phase orchestrations with agent coordination |
| **Dispatcher** | 3 | Thin wrappers for shared agent dispatch |
| **Reference** | 9 | Knowledge bases loaded on demand by other skills |
| **Utility** | 3 | Standalone single-purpose tools |

Agents are nested inside their owning skills. When a second skill needs the same agent, it's promoted to a dispatcher skill. See `skills/README.md` for the full architecture docs.

## Skills

### Core (21 skills)

**Workflows:** deep-analysis, feature-dev, bug-killer, codebase-analysis, mr-reviewer, docs-manager, create-skill-opencode, release-python-package

**Dispatchers:** code-exploration, code-architecture, research

**Knowledge:** language-patterns, architecture-patterns, technical-diagrams, code-quality, project-conventions, changelog-format, glab, sdd-specs, sdd-tasks

**Utilities:** git-commit, document-changes, project-learnings

### SDD Pipeline (5 skills)

Three-stage spec-driven development: `create-spec` → `create-tasks` → `execute-tasks`

Supported by `sdd-specs` (templates) and `sdd-tasks` (task schema) reference skills.

## Key Design Decisions

- **Harness-agnostic:** Every skill includes a dual Execution Strategy — subagent dispatch when available, sequential inline fallback when not
- **Read-only agents:** No agent has Write/Edit access; the orchestrating lead handles all file modifications
- **Hub-and-spoke coordination:** Workers explore independently; all coordination flows through the lead
- **File-based task management:** SDD tasks use directory position as state (`pending/` → `in-progress/` → `completed/`)

## Structure

```
skills/
├── core/              # 21 general-purpose skills
├── sdd/               # 5 spec-driven development skills
├── manifest.json      # Skill registry
└── README.md          # Full architecture docs
internal/
├── reports/           # Architecture decision reports
└── docs/              # Analysis documents
scripts/
└── installers/        # Cross-platform install scripts
```

## Installation

Cross-platform installers are available in `scripts/installers/` for Bash, PowerShell, and CMD.
