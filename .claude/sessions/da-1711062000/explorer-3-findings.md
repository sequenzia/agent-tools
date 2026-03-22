## Explorer 3 Findings: Shared Agents, Knowledge Skills & Infrastructure

### Dispatcher Skill Pattern
Three dispatchers with identical template:
- code-exploration → code-explorer (5 consumers)
- code-architecture → code-architect (2 consumers)
- research → researcher (1 consumer — technically should stay private per placement rule)

Template: metadata.type: dispatcher, metadata.agents[].shared: true, consumers list, Inputs → Agents → Workflow → Execution Strategy

### Agent File Format
Consistent across all 12 agents:
```yaml
name, description, tools: [...]
```
Body: Role → Mission → Strategy → Output Format → Guidelines
On-activation dependencies: load specific skill references

### Execution Strategy (Harness-Agnostic Mechanism)
Universal pattern in every skill with agents:
- If subagent dispatch available → dispatch as subagent
- If not → read agent file, execute inline
Single mechanism enabling portability across platforms

### Knowledge/Reference Skills
Two variants:
- Monolithic: all content in SKILL.md (language-patterns)
- Hub + references: core SKILL.md + references/*.md loaded on demand (technical-diagrams: 6 files, glab: 11 files)

### Manifest.json Taxonomy
- workflow (10), utility (3), reference (9), dispatcher (3)
- Two categories: core (21) and sdd (5)

### Installation Scripts
Three cross-platform installers: .sh, .ps1, .cmd
11-step process: validate → detect OS/arch → resolve version → download → install → verify
URL template system supporting GitLab and GitHub

### Architecture Timeline (Internal Reports)
- 2026-03-17: nest-agents-into-skills (seminal restructure)
- 2026-03-21: agent-reorganization (naming collision fix, Agent Placement Rule)
- 2026-03-21: skill-type-categorization (metadata.type, manifest.json)
- 2026-03-21: generic-execute-tasks (file-based task execution)

### create-skill-opencode
Multi-platform skill creation for Generic Agent Skills, OpenCode, Codex
4-stage pipeline with mandatory question tool
8 reference files for platform formats and validation

### Concerns
- agent-inventory.md is empty
- create-skill-opencode SKILL.md exceeds progressive disclosure limit
- research dispatcher has only 1 consumer (violates Agent Placement Rule)
- consumers lists manually maintained, could drift
