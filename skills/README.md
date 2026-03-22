# Skills & Agents

Reusable skills and agents for codebase analysis, feature development, debugging, documentation, and git workflows.

## Architecture

Agents are nested inside the skills that own them. Each skill with agents has an `agents/` subdirectory containing the agent markdown files and a corresponding **Agents** table and **Execution Strategy** section in its SKILL.md.

**Shared agents** are wrapped in dedicated Agent Skills rather than duplicated. Skills that need a shared agent invoke the Agent Skill, which handles dispatch. This keeps a single source of truth for each agent while enabling cross-skill reuse.

### Execution Strategy Pattern

Every skill that uses agents includes capability-aware execution instructions:

- **If subagent dispatch is available** (e.g., Claude Code): dispatch agents in parallel as subagents
- **If subagent dispatch is not available**: execute agents sequentially, reading each agent file and following its instructions inline

This makes skills portable across harnesses with different capabilities.

## Skills

### Workflow Skills (orchestrate agents and phases)

| Skill | Agents Owned | Skills Invoked | Description |
|-------|-------------|----------------|-------------|
| `deep-analysis` | code-synthesizer | code-exploration | Hub-and-spoke analysis with dynamic planning. Spawns explorers via code-exploration skill, synthesizes findings. |
| `feature-dev` | code-reviewer | deep-analysis, code-architecture | 7-phase feature development: Discovery, Exploration, Questions, Architecture, Implementation, Review, Summary. |
| `bug-killer` | bug-investigator | code-exploration | Hypothesis-driven debugging: Triage, Investigation, Root Cause, Fix & Verify, Wrap-up. Supports `--deep` flag. |
| `docs-manager` | docs-writer | deep-analysis, code-exploration | Documentation management with MkDocs integration. Generates markdown files, updates navigation, handles change summaries. |
| `codebase-analysis` | _(none)_ | deep-analysis, code-exploration, code-architecture | Structured 3-phase workflow: deep analysis, reporting, and post-analysis actions. |
| `release-python-package` | changelog-manager | _(none)_ | Python package release automation workflow. |
| `mr-reviewer` | codebase-understanding, mr-code-quality, git-history | glab | Automated MR review: dispatches 3 parallel agents for codebase, quality, and history analysis. Produces structured reports and/or GitLab line-level comments. |
| `create-spec` | _(none)_ | code-exploration, research, sdd-specs | Adaptive interview-driven spec creation with codebase exploration, proactive recommendations, and research. Supports high-level, detailed, and full technical documentation depths. |
| `execute-tasks` | task-executor | sdd-tasks | Wave-based task execution with dependency resolution, structured verification, and shared execution context. Reads `.agents/tasks/` JSON files, manages sessions in `.agents/sessions/`. |

### Agent Skills (shared agent dispatch)

| Skill | Agent Wrapped | Used By |
|-------|--------------|---------|
| `code-exploration` | code-explorer | deep-analysis, bug-killer, docs-manager, codebase-analysis, create-spec |
| `code-architecture` | code-architect | feature-dev, codebase-analysis |
| `research` | researcher | create-spec _(single-consumer exception)_ |

### Knowledge Skills (no agents)

| Skill | Description |
|-------|-------------|
| `sdd-tasks` | Task schema, file-based CRUD, state management, dependency patterns, and execution guidance for harness-independent task management. Tasks stored as `.agents/tasks/` JSON files. |
| `sdd-specs` | Spec templates, interview question banks, complexity signals, recommendation patterns, and codebase exploration procedures for the SDD spec creation workflow. |
| `language-patterns` | TypeScript, Python, and React patterns, idioms, and best practices. |
| `project-conventions` | Discovers and applies project-specific conventions (naming, structure, patterns). |
| `technical-diagrams` | Mermaid diagram syntax, styling, and best practices for flowcharts, sequence, class, state, ER, and C4 diagrams. |
| `architecture-patterns` | Design patterns and architectural approaches. |
| `code-quality` | Quality criteria and review guidelines. |
| `changelog-format` | Keep a Changelog format guidelines with entry examples. |

### Utility Skills (standalone workflows, no agents)

| Skill | Description |
|-------|-------------|
| `create-tasks` | Spec-to-task decomposition with layer patterns, dependency inference, and producer-consumer detection. Generates `.agents/tasks/` JSON files from `create-spec` output. |
| `document-changes` | Generate a markdown report documenting session changes. |
| `git-commit` | Automates git commits following Conventional Commits format. |
| `project-learnings` | Captures project-specific patterns and anti-patterns into the project's AGENTS.md. |

## Agents

All agents live inside the skill that owns them:

| Agent | Location | Shared | Consumers | Purpose |
|-------|----------|--------|-----------|---------|
| `code-explorer` | `core/code-exploration/agents/` | Yes | deep-analysis, bug-killer, docs-manager, codebase-analysis, create-spec | Focused area exploration worker. Reads files, searches patterns, produces structured reports. |
| `code-architect` | `core/code-architecture/agents/` | Yes | feature-dev, codebase-analysis | Designs implementation blueprints with minimal, flexible, and project-aligned approaches. |
| `researcher` | `core/research/agents/` | Yes | create-spec | Researches best practices, compliance requirements, technology comparisons, and domain knowledge for spec enrichment. |
| `code-synthesizer` | `core/deep-analysis/agents/` | No | deep-analysis | Merges exploration findings into unified analysis. Has bash access for git history and dependency analysis. |
| `code-reviewer` | `core/feature-dev/agents/` | No | feature-dev | Quality review with confidence-scored findings. |
| `bug-investigator` | `core/bug-killer/agents/` | No | bug-killer | Diagnostic investigation agent for testing debugging hypotheses. |
| `docs-writer` | `core/docs-manager/agents/` | No | docs-manager | Generates and updates documentation files in MkDocs or basic markdown format. |
| `codebase-understanding` | `core/mr-reviewer/agents/` | No | mr-reviewer | Analyzes MR changed files and surrounding codebase context for convention, architecture, and integration issues. |
| `mr-code-quality` | `core/mr-reviewer/agents/` | No | mr-reviewer | Analyzes code changes for bugs, quality issues, best practice violations, and missing error handling. |
| `git-history` | `core/mr-reviewer/agents/` | No | mr-reviewer | Examines git history of changed files for regression risks, high-churn areas, and historical context. |
| `changelog-manager` | `core/release-python-package/agents/` | No | release-python-package | Manages CHANGELOG.md entries following Keep a Changelog format. |
| `task-executor` | `sdd/execute-tasks/agents/` | No | execute-tasks | Executes a single SDD task through a 4-phase workflow (Understand, Implement, Verify, Complete). Writes result files as completion signals. |

### Agent Placement Rule

- Agents start **private** — embedded in the owning workflow's `agents/` directory when they have exactly one consumer.
- When a second skill needs the same agent, **promote** it to an Agent Skill (dispatcher). The agent file moves into its own skill directory, and both consumers invoke it via the Agent Skill.
- All Agent Skills follow the same template: Inputs section, Agents table, Workflow section, Execution Strategy section.

## Directory Structure

Skills are organized into two categories for repo organization. At deployment time, all skills are flattened into a single `skills/` directory.

```
skills/
├── core/
│   ├── code-exploration/              (agent skill: code-explorer)
│   │   ├── SKILL.md
│   │   └── agents/
│   │       └── code-explorer.md
│   ├── code-architecture/             (agent skill: code-architect)
│   │   ├── SKILL.md
│   │   └── agents/
│   │       └── code-architect.md
│   ├── deep-analysis/
│   │   ├── SKILL.md
│   │   └── agents/
│   │       └── code-synthesizer.md
│   ├── feature-dev/
│   │   ├── SKILL.md
│   │   ├── agents/
│   │   │   └── code-reviewer.md
│   │   └── references/
│   ├── bug-killer/
│   │   ├── SKILL.md
│   │   ├── agents/
│   │   │   └── bug-investigator.md
│   │   └── references/
│   ├── docs-manager/
│   │   ├── SKILL.md
│   │   ├── agents/
│   │   │   └── docs-writer.md
│   │   └── references/
│   ├── mr-reviewer/
│   │   ├── SKILL.md
│   │   ├── agents/
│   │   │   ├── codebase-understanding.md
│   │   │   ├── mr-code-quality.md
│   │   │   └── git-history.md
│   │   └── references/
│   │       ├── finding-schema.md
│   │       └── gitlab-api-patterns.md
│   ├── codebase-analysis/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── research/                      (agent skill: researcher)
│   │   ├── SKILL.md
│   │   └── agents/
│   │       └── researcher.md
│   ├── release-python-package/
│   │   ├── SKILL.md
│   │   └── agents/
│   │       └── changelog-manager.md
│   ├── architecture-patterns/
│   ├── changelog-format/
│   ├── code-quality/
│   ├── create-skill-opencode/
│   ├── document-changes/
│   ├── git-commit/
│   ├── glab/
│   ├── language-patterns/
│   ├── project-conventions/
│   ├── project-learnings/
│   └── technical-diagrams/
├── sdd/
│   ├── create-spec/
│   │   └── SKILL.md
│   ├── create-tasks/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── decomposition-patterns.md
│   │       ├── dependency-inference.md
│   │       └── testing-requirements.md
│   ├── sdd-specs/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── codebase-exploration.md
│   │       ├── complexity-signals.md
│   │       ├── interview-questions.md
│   │       ├── recommendation-format.md
│   │       ├── recommendation-triggers.md
│   │       └── templates/
│   │           ├── high-level.md
│   │           ├── detailed.md
│   │           └── full-tech.md
│   ├── sdd-tasks/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── task-schema.md
│   │       ├── operations.md
│   │       └── anti-patterns.md
│   └── execute-tasks/
│       ├── SKILL.md
│       ├── agents/
│       │   └── task-executor.md
│       ├── references/
│       │   ├── orchestration.md
│       │   ├── execution-workflow.md
│       │   └── verification-patterns.md
│       └── scripts/
│           └── poll-for-results.sh
└── README.md
```
