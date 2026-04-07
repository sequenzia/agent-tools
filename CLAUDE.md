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
- `apps/task-manager/` — React + Vite + Node.js web app for SDD task management

## Task Manager App (`apps/task-manager/`)

React 19 + Vite + Node.js/Express + TypeScript web app for visualizing and managing SDD tasks.

### Tech Stack
- **Backend**: Node.js + Express 5 + WebSocket (ws), chokidar v4 for file watching
- **Frontend**: React 19, TypeScript 5.8, Zustand v5, Zod v4, dnd-kit v6, react-markdown
- **Tooling**: Vite 7.x, vitest, ESLint 9 (pinned, not 10), Tailwind CSS v4, tsx (dev runner)
- **Testing**: vitest + jsdom + @testing-library/react

### Architecture
- Two-tier: Node.js backend (file I/O, watchers) + React frontend (visualization) via REST + WebSocket
- Filesystem is source of truth — `.agents/tasks/{status}/{group}/task-N.json`
- REST API (17 endpoints across 6 route modules) + WebSocket for real-time events
- Dual file watcher (tasks + sessions) via chokidar with 100ms debounce
- Zustand v5 stores (8 total, no middleware) with selector pattern for re-render optimization
- Optimistic concurrency control via mtime-based conflict detection
- Vite proxy forwards `/api/*` and `/ws` to Express during development

### Key Patterns
- **Dual validation**: Zod `.passthrough()` (frontend) + JSON schema validation (backend) for forward compatibility
- **Derived board columns**: "blocked" and "failed" computed from task metadata, not filesystem dirs
- **Atomic writes**: temp file + rename in Node.js prevents partial write corruption
- **Batch mutations**: `task-store.applyBatch()` applies multiple file events in single state update
- **Service layer**: all HTTP/WS calls wrapped in typed services via `api-client.ts` — components should not call `fetch()` directly

### Project Structure
- `src/` — React frontend (components, services, stores, hooks, types)
- `server/` — Node.js/Express backend (routes, watcher, file-utils, session-parser)
- `src/services/api-client.ts` — HTTP + WebSocket client abstraction
- Tests in `__tests__/` dirs alongside source

### Critical Files
- `src/components/KanbanBoard.tsx` — Main view — DnD, keyboard nav, lazy panels
- `src/stores/task-store.ts` — Core state with optimistic updates, locking, batch mutations
- `server/routes/tasks.ts` — Task file I/O with conflict detection
- `server/watcher.ts` — Dual file watcher (chokidar) with WebSocket broadcast
- `src/services/api-client.ts` — HTTP + WebSocket client (replaces Tauri IPC)
- `src/services/task-service.ts` — API bridge with Zod validation
- `src/types/task.ts` — Zod schemas as source of truth for task types
- `src/services/transition-validation.ts` — Derived column logic (blocked/failed)

### Key Commands
- `npm run dev` — Starts both Vite + Express server (concurrently)
- `npm run dev:server` — Start only the Express backend
- `npm run dev:client` — Start only the Vite frontend
- `npm run build` — Build frontend + compile server TypeScript
- `npm run start` — Run production server (after build)
- `npm test` — Run vitest test suite
- `npm run lint` — ESLint check (src/ + server/)
