# agent-tools

## Agent Inventory

12 agents across 28 skills, following a hub-and-spoke coordination model.

### Shared Agents (via Dispatcher Skills)

| Agent | Dispatcher Skill | Consumers | Model Tier | Tools |
|-------|-----------------|-----------|------------|-------|
| code-explorer | code-exploration | deep-analysis, bug-killer, docs-manager, codebase-analysis, create-spec | Sonnet | Read, Glob, Grep, Bash |
| code-architect | code-architecture | feature-dev, codebase-analysis | Sonnet | Read, Glob, Grep |
| researcher | research | create-spec | Sonnet | Read, Glob, Grep, Bash |

### Private Agents (Owned by Workflow Skills)

| Agent | Owning Skill | Model Tier | Tools | Purpose |
|-------|-------------|------------|-------|---------|
| code-synthesizer | deep-analysis | Opus | Read, Glob, Grep, Bash | Merges explorer findings; deep investigation via git/deps |
| code-reviewer | feature-dev | Opus | Read, Glob, Grep | Confidence-scored code review (threshold: 80) |
| bug-investigator | bug-killer | Sonnet | Read, Glob, Grep, Bash | Evidence-gathering diagnostic agent |
| docs-writer | docs-manager | Sonnet | Read, Glob, Grep, Bash | MkDocs + GitHub-flavored markdown generation |
| codebase-understanding | mr-reviewer | Sonnet | Read, Glob, Grep | Convention, architecture, integration-risk analysis |
| mr-code-quality | mr-reviewer | Sonnet | Read, Glob, Grep, Bash | Language-specific bug/quality review |
| git-history | mr-reviewer | Sonnet | Read, Glob, Grep, Bash | Regression risk via git history analysis |
| changelog-manager | release-python-package | Sonnet | Bash, Read, Edit, Glob, Grep | CHANGELOG.md entry management |
| task-executor | execute-tasks | Sonnet | Read, Write, Edit, Glob, Grep, Bash | 4-phase task execution (Understand, Implement, Verify, Complete) |

### Coordination Patterns

**Hub-and-Spoke** — All workflow skills use this topology:
- Lead assigns work to agents
- Agents work independently (no cross-agent communication)
- Results flow back to lead or synthesizer

**Model Tiering:**
- **Opus** — Synthesis, architecture, review (complex cross-cutting reasoning)
- **Sonnet** — Exploration, investigation (parallel breadth)

**Safety Boundary:**
- No agent has Write/Edit access except task-executor and changelog-manager
- All other file modifications are performed by the orchestrating lead

### Orchestration Topologies

| Skill | Topology | Agent Count |
|-------|----------|-------------|
| deep-analysis | Hub-and-spoke | 2-4 explorers + 1 synthesizer |
| feature-dev | Sequential phases, parallel within | 2-3 architects + 3 reviewers |
| bug-killer | Track-based branching | 2-3 explorers + 1-3 investigators |
| mr-reviewer | Pure parallel batch | 3 fixed agents |
| docs-manager | Sequential phases, parallel gen | N docs-writers |
| execute-tasks | Wave-based parallel | N task-executors (up to max_parallel) |
