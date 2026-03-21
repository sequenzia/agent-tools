---
name: code-architecture
description: >-
  Dispatches a code-architect agent to design an implementation blueprint for a
  feature. Use when another skill needs architectural design — planning files to
  create/modify, data flow, risks, and testing strategy. Accepts a feature
  description, exploration findings, and a design approach.
metadata:
  type: dispatcher
allowed-tools: Read Glob Grep
---

# Code Architecture

Dispatch a code-architect agent to design an implementation blueprint. This skill acts as the canonical entry point for architectural design and is invoked by other skills (feature-dev, codebase-analysis) rather than used standalone.

## Inputs

This skill expects the calling skill to provide:

- **Feature description** — what needs to be built or changed
- **Exploration findings** — relevant files, patterns, and context from prior codebase exploration
- **Design approach** — one of: Minimal (simplicity-focused), Flexible (extensibility-focused), or Project-Aligned (convention-focused)

## Agents

| Agent | File | Dependencies |
|-------|------|--------------|
| code-architect | `agents/code-architect.md` | none |

## Workflow

1. Receive the feature description, exploration findings, and design approach from the calling skill
2. Dispatch the code-architect agent with:
   - The feature description
   - Summary of relevant files and patterns from exploration
   - The specific design approach to use
   - Instructions to return a detailed implementation blueprint
3. Collect and return the architect's blueprint to the calling skill

## Execution Strategy

**If subagent dispatch is available:** Dispatch the code-architect as a subagent, passing the contents of `agents/code-architect.md` as the task instructions along with the design brief. The subagent works independently and returns an implementation blueprint.

**If subagent dispatch is not available:** Read `agents/code-architect.md` and follow its instructions directly. Use the provided feature description, exploration findings, and design approach as input. Produce the implementation blueprint inline before returning control to the calling skill.
