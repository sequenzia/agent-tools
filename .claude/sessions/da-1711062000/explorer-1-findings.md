## Explorer 1 Findings: Core Workflow Skills & Agent Orchestration

### Workflow Skills Analyzed
6 workflow skills: deep-analysis, feature-dev, bug-killer, codebase-analysis, mr-reviewer, docs-manager

### Orchestration Topologies
| Skill | Topology | Agent Count | Parallelism |
|-------|----------|-------------|-------------|
| deep-analysis | Hub-and-spoke | 2-4 explorers + 1 synthesizer | Explorers parallel; synthesizer sequential after |
| feature-dev | Sequential phases, parallel within | 2-3 architects + 3 reviewers | Phase 4 architects parallel; Phase 6 reviewers parallel |
| bug-killer | Track-based branching | 2-3 explorers + 1-3 investigators | Per-focus parallel |
| codebase-analysis | Full delegation | 0 direct agents | Inherited from deep-analysis |
| mr-reviewer | Pure parallel batch | 3 fixed agents | All 3 dispatched simultaneously |
| docs-manager | Sequential phases, parallel generation | N docs-writers | Independent pages parallel |

### Key Patterns
1. Dual execution strategy (subagent dispatch vs sequential inline fallback) — universal
2. Private vs shared agent ownership via dispatcher skills
3. Auto-approval when skill-invoked (prose-based, not mechanical)
4. Uniform error recovery: retry / continue partial / abort
5. Model tiering: high-capability for synthesis/architecture, standard for exploration
6. No agent has Write/Edit access — all modifications by orchestrating lead

### Cross-Skill Invocation Graph
- feature-dev → deep-analysis, code-architecture, code-quality, architecture-patterns, language-patterns, technical-diagrams
- codebase-analysis → deep-analysis, code-architecture, code-exploration
- bug-killer → code-exploration, code-quality, project-learnings
- docs-manager → deep-analysis, code-exploration
- mr-reviewer → self-contained (3 private agents, no external skill invocations)
- deep-analysis → code-exploration (dispatcher)

### Agent Tool Access
No agent has Write/Edit access. Agents are read-only investigators. The orchestrating lead performs all modifications.

### Concerns
- Auto-approval via prose, not enforced mechanically
- mr-reviewer deduplication algorithm in opaque reference file
- feature-dev ADR dependency on hardcoded path convention
- docs-manager high interactive overhead (6 phases + Q&A)
