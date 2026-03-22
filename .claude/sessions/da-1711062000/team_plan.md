## Team Plan: Deep Analysis

### Analysis Context
General codebase understanding

### Reconnaissance Summary
- **Project:** agent-tools — AI agent skill & agent library (markdown-based plugin ecosystem)
- **Primary format:** Markdown + JSON (no compiled code)
- **Codebase size:** 26 skills, 12 agents, ~50 reference files, 11 internal reports
- **Key observations:**
  - Pure markdown/JSON project with 4-type skill taxonomy (workflow, utility, reference, dispatcher)
  - Agent nesting pattern with promotion to dispatcher skills when shared
  - Active development with recent major architecture refactors
  - SDD pipeline: create-spec → create-tasks → execute-tasks

### Focus Areas

#### Focus Area 1: Core Workflow Skills & Agent Orchestration
- **Directories:** `skills/core/deep-analysis/`, `skills/core/feature-dev/`, `skills/core/bug-killer/`, `skills/core/codebase-analysis/`, `skills/core/mr-reviewer/`, `skills/core/docs-manager/`
- **Starting files:** `skills/core/deep-analysis/SKILL.md`, `skills/core/feature-dev/SKILL.md`, `skills/core/mr-reviewer/SKILL.md`
- **Search patterns:** "Phase", "agent", "dispatch", "hub-and-spoke", "coordination", "workflow"
- **Complexity:** High
- **Assigned to:** explorer-1 (sonnet)

#### Focus Area 2: SDD Pipeline & Task Execution
- **Directories:** `skills/sdd/create-spec/`, `skills/sdd/create-tasks/`, `skills/sdd/execute-tasks/`, `skills/sdd/sdd-specs/`, `skills/sdd/sdd-tasks/`
- **Starting files:** `skills/sdd/create-spec/SKILL.md`, `skills/sdd/create-tasks/SKILL.md`, `skills/sdd/execute-tasks/SKILL.md`
- **Search patterns:** "spec", "task", "wave", "dependency", "execution", "verification"
- **Complexity:** High
- **Assigned to:** explorer-2 (sonnet)

#### Focus Area 3: Shared Agents, Knowledge Skills & Infrastructure
- **Directories:** `skills/core/code-exploration/`, `skills/core/code-architecture/`, `skills/core/research/`, `skills/core/technical-diagrams/`, `skills/core/language-patterns/`, `skills/core/create-skill-opencode/`, `scripts/`, `internal/`
- **Starting files:** `skills/core/code-exploration/SKILL.md`, `skills/core/code-exploration/agents/code-explorer.md`, `skills/manifest.json`
- **Search patterns:** "dispatcher", "shared", "reference", "manifest", "install", "harness"
- **Complexity:** Medium
- **Assigned to:** explorer-3 (sonnet)

### Agent Composition
| Role | Count | Model | Purpose |
|------|-------|-------|---------|
| Explorer | 3 | sonnet | Independent focus area exploration |
| Synthesizer | 1 | opus | Merge findings, deep investigation |

### Task Dependencies
- Exploration Tasks 1-3: parallel (no dependencies)
- Synthesis Task: blocked by all exploration tasks
