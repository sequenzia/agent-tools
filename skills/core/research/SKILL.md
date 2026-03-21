---
name: research
description: >-
  Dispatches a researcher agent to investigate best practices, compliance
  requirements, technology comparisons, and domain knowledge. Use when a skill
  needs external research to inform decisions — compliance frameworks (GDPR,
  HIPAA, PCI), technology trade-offs, competitive analysis, or industry best
  practices. Wrapper skill for the researcher agent.
metadata:
  type: dispatcher
allowed-tools: Read Glob Grep Bash
---

# Research

Dispatch a researcher agent to investigate a specific topic and return structured findings. This skill acts as the canonical entry point for research and is invoked by other skills (create-spec, and future skills like analyze-spec) rather than used standalone.

## Inputs

This skill expects the calling skill to provide:

- **Research topic** — the specific subject to investigate (e.g., "GDPR data retention requirements", "WebSocket vs SSE for real-time updates")
- **Context** — why this research is needed, what project or spec it informs
- **Specific questions** — 1-3 focused questions the research should answer
- **Depth level** — how detailed the findings should be (brief summary vs. comprehensive analysis)

## Agents

| Agent | File | Dependencies |
|-------|------|--------------|
| researcher | `agents/researcher.md` | none |

## Workflow

1. Receive the research topic, context, specific questions, and depth level from the calling skill
2. Dispatch the researcher agent with:
   - The topic and specific questions
   - The project context (spec name, feature description, etc.)
   - The desired depth level
   - Instructions to return structured findings when complete
3. Collect and return the researcher's structured findings to the calling skill

## Execution Strategy

**If subagent dispatch is available:** Dispatch the researcher as a subagent, passing the contents of `agents/researcher.md` as the task instructions along with the research context. The subagent works independently and returns structured findings.

**If subagent dispatch is not available:** Read `agents/researcher.md` and follow its instructions directly. Use the provided topic, context, and questions as input. Produce the structured findings inline before returning control to the calling skill.
