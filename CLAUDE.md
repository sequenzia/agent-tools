# Agent Tools - Project Guide

## Project Overview

This is a pure markdown/JSON skill and agent library — no compiled code, no tests, no build system. Skills are markdown instructions executed by AI agent platforms at runtime.

## Key Patterns

- **SKILL.md** is always the entry point for a skill (uppercase filename)
- **Agents** live in `agents/` subdirectories within their owning skill
- **References** live in `references/` subdirectories, loaded on demand
- **Execution Strategy** section required in every skill with agents (dual path: subagent dispatch vs inline fallback)
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
- `skills/core/code-exploration/SKILL.md` — Canonical dispatcher pattern
- `skills/sdd/sdd-tasks/SKILL.md` — Task schema (file-based state machine)

## Categories

- `skills/core/` — 20 general-purpose skills (flattened at deployment)
- `skills/sdd/` — 5 spec-driven development skills
- `skills/meta/` — 1 skill-authoring skill
- `internal/reports/` — Architecture decision reports (not deployed)
