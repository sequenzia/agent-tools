## Synthesized Analysis: agent-tools Codebase

### Architecture Overview

The agent-tools repository is a **pure markdown/JSON skill and agent library** — a plugin ecosystem for AI coding agents with no compiled code, no tests, and no build system. It provides 26 reusable skills and 12 agent definitions that orchestrate AI-powered software development workflows across multiple phases: codebase analysis, feature development, debugging, documentation, code review, and spec-driven development.

The architecture follows a **layered composition model** built on three key design principles:

1. **Skill Taxonomy**: A 4-type classification system (workflow, utility, reference, dispatcher) that separates orchestration concerns from knowledge concerns and agent dispatch concerns.
2. **Agent Nesting with Promotion**: Agents live inside their owning skills. When a second skill needs the same agent, it's "promoted" to a dispatcher skill — a thin wrapper that becomes the single source of truth.
3. **Harness-Agnostic Portability**: Every skill with agents includes a dual "Execution Strategy" section: parallel subagent dispatch when available, sequential inline fallback when not.

The project is in an active architecture stabilization phase, with 46 commits across 16 days (March 6–21, 2026).

### Skill Taxonomy

| Type | Count | Purpose |
|------|-------|---------|
| workflow | 10 | Multi-phase orchestrations with agents, user-invocable |
| utility | 3 | Single-purpose tools (git-commit, document-changes, project-learnings) |
| reference | 9 | Knowledge bases loaded on-demand by other skills |
| dispatcher | 3 | Thin wrappers for shared agent dispatch |

Categories: core (21 skills) and sdd (5 skills)

### Agent Coordination Models

| Skill | Topology | Agent Count | Parallelism |
|-------|----------|-------------|-------------|
| deep-analysis | Hub-and-spoke | 2-4 explorers + 1 synthesizer | Explorers parallel; synthesizer sequential |
| feature-dev | Sequential phases, parallel within | 2-3 architects + 3 reviewers | Architects parallel; reviewers parallel |
| bug-killer | Track-based branching | 2-3 explorers + 1-3 investigators | Per-focus parallel |
| codebase-analysis | Full delegation | 0 direct agents | Inherited from deep-analysis |
| mr-reviewer | Pure parallel batch | 3 fixed agents | All 3 simultaneous |
| docs-manager | Sequential phases, parallel gen | N docs-writers | Independent pages parallel |

### SDD Pipeline

Three-stage: create-spec → create-tasks → execute-tasks
- Entirely file-based (.agents/tasks/ JSON files)
- Wave-based parallelism with topological sorting
- File-as-state-machine (directory = status)
- Result file protocol for completion signaling
- Context sharing via execution_context.md

### Key Patterns

- Dual execution strategy (subagent vs inline) — universal portability mechanism
- Hub-and-spoke topology — workers never communicate directly
- Progressive disclosure — core in SKILL.md, detail in references/
- Read-only agents — no Write/Edit access; lead handles all modifications
- Model tiering — opus for synthesis, sonnet for exploration, haiku for procedural
- question tool mandate for interactive skills

### Challenges

| Challenge | Severity |
|-----------|----------|
| produces_for dead metadata (generated but never consumed) | Medium |
| Consumer list drift (manually maintained) | Medium |
| Progressive disclosure violations (create-skill-opencode, create-spec) | Medium |
| question tool portability gap (no fallback for non-supporting platforms) | Medium |
| research dispatcher premature promotion (1 consumer) | Low |
| Empty agent-inventory.md placeholder | Low |
| Auto-approval via prose, not mechanical enforcement | Low |
| No validation tooling for manifest/cross-references | Low |

### Recommendations

1. Implement produces_for consumption in execute-tasks
2. Add manifest validation script
3. Refactor oversized SKILL.md files into references
4. Add question tool fallback for portability
5. Resolve research dispatcher placement
6. Clean up empty placeholder files
