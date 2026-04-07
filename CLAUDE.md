# Agent Tools - Project Guide

## Project Overview

This is a pure markdown/JSON skill and agent library — no compiled code, no tests, no build system. Skills are markdown instructions executed by AI agent platforms at runtime.

## Key Patterns

- **SKILL.md** is always the entry point for a skill (uppercase filename)
- **Agents** live in `agents/` subdirectories within their owning skill
- **References** live in `references/` subdirectories, loaded on demand
- **Execution Strategy** section required in every skill with agents
- **Progressive disclosure**: Keep SKILL.md under ~5000 tokens; move detail to references/

## Skill Types

- `workflow`: Multi-phase orchestration with agents (e.g., feature-dev, deep-analysis)
- `dispatcher`: Thin wrapper for a shared agent (e.g., code-exploration wraps code-explorer)
- `reference`: Knowledge base loaded by other skills (e.g., language-patterns, sdd-tasks)
- `utility`: Standalone tool (e.g., git-commit, document-changes)

## Agent Placement Rule

Agents start private (in owning skill's `agents/`). Promote to a dispatcher skill when a second consumer appears. Never duplicate agent files across skills.

## Naming Conventions

- Skill directories: kebab-case (`code-exploration`, `bug-killer`)
- Agent files: kebab-case matching agent name (`code-explorer.md`)
- Reference files: kebab-case describing content (`decomposition-patterns.md`)

## Frontmatter Format

SKILL.md:
```yaml
name: skill-name
description: Trigger-phrase-rich description
metadata:
  type: workflow|utility|reference|dispatcher
  argument-hint: <optional argument description>
  agents: [{name, shared, consumers}]
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
```

Agent .md:
```yaml
name: agent-name
description: Single-line capability summary
tools: [Read, Glob, Grep, Bash]
```

## Critical Files

- `skills/manifest.json` — Authoritative skill registry
- `skills/README.md` — Full architecture documentation
- `skills/core/deep-analysis/SKILL.md` — Hub-and-spoke orchestration pattern
- `skills/core/code-exploration/SKILL.md` — Canonical dispatcher pattern (5 consumers)
- `skills/core/feature-dev/SKILL.md` — 7-phase feature development lifecycle
- `skills/sdd/sdd-tasks/SKILL.md` — Task schema (file-based state machine)
- `skills/sdd/execute-tasks/SKILL.md` — Wave-based parallel task execution (subagent dispatch)
- `skills/sdd/execute-tasks-inline/SKILL.md` — Sequential inline task execution (no subagents)
- `skills/sdd/create-spec/SKILL.md` — SDD pipeline entry point

## Categories

- `skills/core/` — 19 general-purpose skills (flattened at deployment)
- `skills/sdd/` — 9 spec-driven development skills (7 pipeline + research dispatcher + inverted-spec)
- `skills/meta/` — 2 skill-authoring skills
- `internal/reports/` — Architecture decision reports (not deployed)
- `apps/task-manager/` — Tauri 2.x desktop app for SDD task management

## Task Manager App (`apps/task-manager/`)

Tauri 2.x + React 19 + Vite + TypeScript desktop app for visualizing and managing SDD tasks.

### Tech Stack
- **Backend**: Rust (Tauri 2.10.3), chrono, notify-debouncer-mini, serde_json
- **Frontend**: React 19, TypeScript 5.8, Zustand v5, Zod v4, dnd-kit v6, react-markdown
- **Tooling**: Vite 7.x, vitest, ESLint 9 (pinned, not 10), Tailwind CSS v4
- **Testing**: vitest + jsdom + @testing-library/react

### Project Structure
- `src/` — React frontend (components, services, stores, hooks, types)
- `src-tauri/` — Rust backend (tasks.rs, watcher.rs, specs.rs, session.rs, discovery.rs)
- `src-tauri/capabilities/default.json` — Tauri plugin permissions

### Key Commands
- `npm run tauri dev` — Development with HMR
- `npm run tauri build` — macOS .app + .dmg production build
- `npm test` — Run vitest test suite
- `npm run lint` — ESLint check
- Cargo: `~/.cargo/bin/cargo` (not in default PATH)
