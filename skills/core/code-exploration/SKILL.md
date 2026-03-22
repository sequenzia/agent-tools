---
name: code-exploration
description: >-
  Dispatches a code-explorer agent to investigate a specific focus area of a
  codebase. Use when another skill needs focused codebase exploration — finding
  relevant files, tracing execution paths, and mapping architecture for a
  defined area. Accepts a focus area assignment and analysis context.
metadata:
  type: dispatcher
  agents:
    - name: code-explorer
      file: agents/code-explorer.md
      shared: true
      consumers:
        - deep-analysis
        - bug-killer
        - docs-manager
        - codebase-analysis
        - create-spec
allowed-tools: Read Glob Grep Bash
---

# Code Exploration

Dispatch a code-explorer agent to investigate a specific focus area of a codebase. This skill acts as the canonical entry point for focused codebase exploration and is invoked by other skills (deep-analysis, bug-killer, docs-manager, codebase-analysis) rather than used standalone.

## Inputs

This skill expects the calling skill to provide:

- **Focus area assignment** — label, directories to explore, starting files, search patterns
- **Codebase path** — root directory of the project
- **Analysis context** — the broader goal driving the exploration (feature description, bug context, documentation scope, etc.)

## Agents

| Agent | File | Dependencies |
|-------|------|--------------|
| code-explorer | `agents/code-explorer.md` | none |

## Workflow

1. Receive the focus area assignment, codebase path, and analysis context from the calling skill
2. Dispatch the code-explorer agent with:
   - The focus area (label, directories, starting files, search patterns)
   - The codebase path
   - The analysis context
   - Instructions to return structured findings when complete
3. Collect and return the explorer's structured findings to the calling skill

## Execution Strategy

**If subagent dispatch is available:** Dispatch the code-explorer as a subagent, passing the contents of `agents/code-explorer.md` as the task instructions along with the focus area context. The subagent works independently and returns structured findings.

**If subagent dispatch is not available:** Read `agents/code-explorer.md` and follow its instructions directly. Use the provided focus area, codebase path, and analysis context as input. Produce the structured findings inline before returning control to the calling skill.
