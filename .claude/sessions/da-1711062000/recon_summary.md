## Reconnaissance Summary

### Project Overview
- **Name:** agent-tools
- **Type:** AI agent skill & agent library (markdown-based plugin ecosystem)
- **Primary format:** Markdown (SKILL.md, agent .md files, reference .md files) + JSON (manifest.json)
- **No compiled code:** Pure markdown/JSON — no source code, no tests, no build system

### Codebase Size
- **26 SKILL.md files** across 2 categories (21 core + 5 SDD)
- **12 agent definitions** (markdown files in agents/ subdirectories)
- **~50 reference files** (templates, schemas, patterns, examples)
- **3 JSON files** (manifest.json, settings.json, settings.local.json)
- **3 installer scripts** (bash, cmd, powershell) + 1 polling script
- **11 internal reports** documenting recent refactoring decisions
- **1 ecosystem analysis** document (internal/docs/)

### Directory Structure
```
agent-tools/
├── skills/
│   ├── core/           # 21 general-purpose skills
│   │   ├── deep-analysis/       (workflow, owns: code-synthesizer)
│   │   ├── feature-dev/         (workflow, owns: code-reviewer)
│   │   ├── bug-killer/          (workflow, owns: bug-investigator)
│   │   ├── mr-reviewer/         (workflow, owns: 3 agents)
│   │   ├── codebase-analysis/   (workflow, no owned agents)
│   │   ├── docs-manager/        (workflow, owns: docs-writer)
│   │   ├── code-exploration/    (dispatcher, wraps: code-explorer)
│   │   ├── code-architecture/   (dispatcher, wraps: code-architect)
│   │   ├── research/            (dispatcher, wraps: researcher)
│   │   ├── release-python-package/ (workflow, owns: changelog-manager)
│   │   ├── create-skill-opencode/  (workflow, cross-platform skill creator)
│   │   └── [10 more: knowledge & utility skills]
│   ├── sdd/            # 5 Spec-Driven Development skills
│   │   ├── create-spec/         (workflow)
│   │   ├── create-tasks/        (utility)
│   │   ├── execute-tasks/       (workflow, owns: task-executor)
│   │   ├── sdd-specs/           (reference)
│   │   └── sdd-tasks/           (reference)
│   ├── manifest.json   # Skill registry with types
│   └── README.md       # Architecture docs
├── internal/
│   ├── reports/        # 11 decision/refactoring reports
│   ├── docs/           # Ecosystem analysis
│   └── agents/         # Agent inventory (empty)
├── scripts/
│   └── installers/     # Cross-platform install scripts
├── .claude/            # Settings and session data
├── README.md           # Minimal (1 line)
└── AGENTS.md           # Minimal (1 line)
```

### Key Architectural Patterns
1. **4-type skill taxonomy:** workflow, utility, reference, dispatcher
2. **Agent nesting:** Agents live inside owning skills; promoted to dispatcher skills when shared
3. **Hub-and-spoke coordination:** Lead orchestrates, workers explore independently, synthesizer merges
4. **Harness-agnostic design:** Skills include execution strategy sections for different AI platforms
5. **Cross-skill composition:** Workflow skills invoke other skills (deep-analysis, code-exploration, etc.)
6. **Reference lazy-loading:** Reference files loaded on-demand, not upfront

### Active Development History
- 11 reports in internal/reports/ spanning March 6-21, 2026
- Recent major refactors: agent reorganization, skill categorization, SDD restructure, kanban task restructure
- Project is actively evolving architecture and patterns
