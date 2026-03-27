---
name: inverted-spec
description: >-
  Reverse-engineer a specification from an existing codebase through deep
  analysis, interactive curation, and gap-filling interview. Produces specs
  compatible with the SDD pipeline (analyze-spec, create-tasks, execute-tasks).
  Use when user says "inverted spec", "reverse engineer spec", "spec from code",
  "document existing codebase", "create spec from existing code", "reverse PRD",
  "generate spec from implementation", "extract spec", or wants to generate a
  specification document from an existing implementation rather than from scratch.
metadata:
  argument-hint: "<path to codebase or directory>"
  type: workflow
allowed-tools: Read Write Glob Grep Bash
---

# Inverted Spec

You are initiating the inverted spec workflow. This process analyzes an existing codebase, lets the user curate what to include, fills in context that code cannot reveal, and generates a specification document compatible with the full SDD pipeline.

The key difference from `create-spec`: instead of gathering requirements from scratch via interview, this skill extracts structure and behavior from code, then interviews to curate and supplement. Code is the primary source — the interview fills gaps.

## Critical Rules

### question tool is MANDATORY

**IMPORTANT**: You MUST use the `question` tool for ALL questions to the user. Never ask questions through regular text output.

- Every interview question -> `question`
- Confirmation questions -> `question`
- Yes/no consent questions -> `question`
- Clarifying questions -> `question`

Text output should only be used for:
- Summarizing what you've learned
- Presenting information
- Explaining context

If you need the user to make a choice or provide input, use `question`.

**Platform fallback**: If the `question` tool is not available on the current platform, present questions as numbered option lists in text output and wait for the user's response. Use `AskUserQuestion` or the platform's equivalent interaction tool if available.

#### question tool parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `header` | string | Yes | Short label displayed as the question title |
| `text` | string | Yes | The full question body with context and guidance |
| `options` | array of objects | No | Structured choices; each object has a `label` field |
| `multiple` | boolean | No | When `true`, allows selecting multiple options |
| `custom` | boolean | No | When `true` (default), auto-adds a freeform text input option — do NOT include a manual "Other" option |

#### question tool conventions

- **Option labels must be self-descriptive**: There is no separate `description` field per option. Fold context into the label text (e.g., `"User Authentication — Login/logout with session management (src/auth/)"` instead of a separate label + description).
- **Mark recommended options**: Append `"(Recommended)"` to the label text of recommended choices.
- **Return format**: Answers are returned as arrays of selected labels.
- **Multi-select**: Use `multiple: true` for questions where users should select multiple items.
- **Custom input**: `custom: true` is the default — freeform text input is always available unless you explicitly set `custom: false`.
- **Single question per call**: The `question` tool accepts one question per invocation. Ask each question individually using separate calls.

### Plan Mode Behavior

**CRITICAL**: This skill generates a spec document, NOT an implementation plan. When invoked in a planning context:

- **DO NOT** create an implementation plan for how to build the spec's described features
- **DO NOT** defer spec generation to an "execution phase"
- **DO** proceed with the full analysis, interview, and spec generation workflow immediately
- **DO** write the spec file to the output path as normal

The spec is a planning artifact itself — generating it IS the planning activity.

## Load Reference Skills

Before starting the workflow, load the sdd-specs reference for templates and interview questions:

```
Read ../sdd-specs/SKILL.md
```

This reference provides:
- Spec templates (high-level, detailed, full-tech)
- Interview question bank organized by category and depth (used for gap-filling)
- Codebase exploration procedure (used internally by deep-analysis)

## Workflow Overview

This workflow has five phases:

| Phase | Purpose |
|-------|---------|
| 1. Input & Context | Gather codebase path, scope, depth, spec name, and initial context |
| 2. Deep Analysis | Invoke deep-analysis for comprehensive codebase understanding |
| 3. Interactive Curation Interview | Feature selection, gap-filling, optional research, assumption validation |
| 4. Summary & Approval | Present compiled findings for user review |
| 5. Spec Generation | Compile spec from template with provenance annotations |

---

## Phase 1: Input & Context

### Parse Arguments

If arguments are provided, determine the codebase path:

1. **If the argument looks like a path** (starts with `/`, `./`, `../`, or `~`; or contains path separators and the directory/file exists) → use it as the codebase path
2. **If no argument is provided** → use the `question` tool to ask:
   ```yaml
   question:
     header: "Codebase Path"
     text: "What codebase or directory should I analyze to generate the spec?"
     options:
       - label: "Current directory — Analyze the full project at the current path"
     custom: true
   ```

### Validate Path

Verify the path exists using `Glob` or `Bash`. If the path does not exist, inform the user and ask for correction.

### Scope Selection

Ask whether to analyze the entire codebase or focus on specific directories:

```yaml
question:
  header: "Scope"
  text: "Should I analyze the entire codebase, or focus on specific directories?"
  options:
    - label: "Entire codebase (Recommended) — Analyze everything at the provided path"
    - label: "Specific directories — I'll specify which parts to focus on"
  custom: false
```

If the user selects "Specific directories", ask a follow-up:
```yaml
question:
  header: "Directories"
  text: "Which directories or areas should I focus on? (comma-separated paths)"
  options:
    - label: "Provide directory paths relative to the codebase root"
  custom: true
```

### Depth Selection

Ask the user which spec depth to generate:

```yaml
question:
  header: "Spec Depth"
  text: "How detailed should the generated specification be?"
  options:
    - label: "High-level overview (Recommended) — Executive summary with key features and architecture"
    - label: "Detailed specifications — User stories, acceptance criteria, and technical architecture"
    - label: "Full technical documentation — API specs, data models, testing strategy, and deployment"
  custom: false
```

### Spec Name

```yaml
question:
  header: "Spec Name"
  text: "What should this spec be named? This determines the output filename (specs/SPEC-{name}.md)."
  options:
    - label: "Provide a descriptive name for the specification"
  custom: true
```

### Initial Context

Gather context that code alone cannot reveal — this seeds the gap-filling interview:

```yaml
question:
  header: "Context"
  text: "Is there any context about this project that the code alone doesn't capture? For example: the problem it solves, who the users are, business goals, or planned changes."
  options:
    - label: "No additional context — The code speaks for itself"
    - label: "I'll provide context in the interview — Ask me during the curation process"
  custom: true
```

Store all Phase 1 inputs internally for use throughout the workflow.

---

## Phase 2: Deep Analysis

Invoke the `deep-analysis` skill to comprehensively analyze the codebase. This skill manages its own explorers and synthesizer — treat it as a black box.

### Invoke Deep Analysis

1. Read `../../core/deep-analysis/SKILL.md`
2. Set the analysis context to: "Reverse-engineer a {depth} specification from this codebase{scope details}. Focus on discovering: features and capabilities, architecture and patterns, integration points, data models, user-facing workflows, and technical risks."
3. **Auto-approve** the exploration plan — deep-analysis supports this when loaded by another skill
4. Execute the full deep-analysis workflow (reconnaissance → parallel exploration → synthesis)

### Store Analysis Findings

The synthesis output includes:
- **Architecture overview** — 2-3 paragraphs with optional Mermaid diagram
- **Critical files table** — file, purpose, relevance, connections
- **File details** — key exports, core logic, notable patterns per file
- **Relationship map** — component dependencies and data flow
- **Patterns & conventions** — recurring patterns, naming, shared abstractions
- **Challenges & risks** — technical risks, complexity hotspots, coupling
- **Recommendations** — actionable items with citations
- **Open questions** — areas not fully covered

Store these findings internally as "Analysis Findings" for use in Phase 3 and Phase 5.

### Present Analysis Summary

After analysis completes, present a brief summary to the user before starting the interview:

```
I've completed the codebase analysis. Here's what I found:

**Architecture:** {1-2 sentence summary}
**Features discovered:** {count} distinct features/capabilities
**Tech stack:** {key technologies}
**Key patterns:** {2-3 patterns}
**Areas of concern:** {challenges count}

Now let's curate these findings and fill in any gaps.
```

---

## Phase 3: Interactive Curation Interview

This is the distinctive phase that separates inverted-spec from create-spec. Instead of open-ended requirements gathering, it presents discovered facts and asks the user to confirm, adjust, or supplement them.

Load the full interview procedures:

```
Read references/curation-interview.md
```

The interview has four stages:

1. **Stage A — Feature Curation** (1-2 rounds): Present discovered features as a multi-select checklist. The user selects which to include. Deselected features become "Out of Scope."
2. **Stage B — Gap-Filling** (1-3 rounds): Ask questions about things code cannot reveal — problem statement, users, success metrics, business value. Depth-dependent budgets.
3. **Stage C — Optional Research** (0-1 rounds): Offer to research topics surfaced during analysis or interview (compliance, best practices). Uses the `research` dispatcher skill.
4. **Stage D — Assumption Validation** (1 round): Confirm inferences from analysis — architecture choices, patterns, technology selections.

### Early Exit

If the user signals they want to wrap up early ("that's enough", "let's wrap up", "skip the rest"):

1. Acknowledge the request
2. Present a truncated summary (Phase 4 format)
3. Confirm via `question`:
   ```yaml
   question:
     header: "Early Exit"
     text: "Here's what I've gathered so far. Should I generate the spec with this, or add more?"
     options:
       - label: "Generate spec — Proceed with current information"
       - label: "Add more — Continue the interview"
     custom: false
   ```
4. If generating, set `**Status**: Draft (Partial)` in the spec header
5. Proceed to Phase 5

---

## Phase 4: Summary & Approval

Present the compiled findings for user review before generating the spec.

### Summary Format

```markdown
## Inverted Spec Summary

### Source
- **Codebase:** {path}
- **Scope:** {entire / specific directories}
- **Depth:** {selected depth}

### Architecture (from analysis)
{Summary of discovered architecture}

### Included Features
| Feature | Source | Description |
|---------|--------|-------------|
| {name} | Analysis | {brief description} |
| {name} | User-provided | {brief description} |

### Excluded Features (Out of Scope)
| Feature | Reason |
|---------|--------|
| {name} | {deselected during curation / user request} |

### User-Provided Context
- **Problem:** {problem statement}
- **Users:** {personas}
- **Success Metrics:** {metrics}
- **Business Value:** {value}

### Technical Details (from analysis)
- **Tech Stack:** {discovered}
- **Patterns:** {validated patterns}
- **Integration Points:** {discovered}

### Risks & Challenges (from analysis)
{curated list}

### Open Questions
{unresolved items}
```

### Confirmation

```yaml
question:
  header: "Summary Review"
  text: "Does this summary accurately capture what should be in the spec? You can request changes before I generate the final document."
  options:
    - label: "Looks good — Generate the spec"
    - label: "Needs changes — I'll specify what to adjust"
  custom: true
```

If the user requests changes, apply them and re-present the summary. Iterate up to 3 times, then proceed.

---

## Phase 5: Spec Generation

### Template Selection

Choose the template based on the depth selected in Phase 1:

| Depth Level | Template |
|-------------|----------|
| High-level overview | `../sdd-specs/references/templates/high-level.md` |
| Detailed specifications | `../sdd-specs/references/templates/detailed.md` |
| Full technical documentation | `../sdd-specs/references/templates/full-tech.md` |

### Load Compilation References

```
Read references/analysis-to-spec-mapping.md
Read references/compilation-guide.md
```

The mapping reference details how analysis findings transform into spec sections. The compilation guide defines the header format, provenance annotations, and step-by-step compilation procedure.

### Diagram Guidance (Detailed/Full-Tech Only)

For "Detailed specifications" and "Full technical documentation" depth levels, load the technical-diagrams skill before compilation:

```
Read ../../core/technical-diagrams/SKILL.md
```

Apply its styling rules when generating Mermaid diagrams — use `classDef` with `color:#000` for all node styles. Skip for "High-level overview" depth.

### Compilation Steps

1. Read the appropriate template
2. Apply the inverted-spec header format (from `compilation-guide.md`)
3. Map analysis findings to template sections (from `analysis-to-spec-mapping.md`)
4. Weave in user-provided context from the interview
5. Add provenance annotations: `[Inferred]` for code-derived, `[Stated]` for user-provided
6. Fill gaps by inferring logical requirements (flag assumptions clearly)
7. Add acceptance criteria for functional requirements
8. Define implementation phases with completion criteria
9. Review for completeness

### Confirm Output Path

```yaml
question:
  header: "Output Path"
  text: "Where should I save the spec? Default: specs/SPEC-{name}.md"
  options:
    - label: "Use default path"
  custom: true
```

### Write the Spec

Write the compiled spec to the confirmed output path. Present the completed spec location to the user.

---

## Skills Invoked

This skill invokes the following skills for agent access:

| Skill Invoked | Agent Accessed | Purpose | Phase |
|---------------|---------------|---------|-------|
| `deep-analysis` | code-explorer, code-synthesizer | Comprehensive codebase analysis | Phase 2 |
| `research` | researcher | Best practices, compliance research | Phase 3 Stage C |
| `technical-diagrams` | — (reference) | Mermaid diagram styling | Phase 5 |

## Execution Strategy

**If subagent dispatch is available:** Dispatch the `deep-analysis` skill as a subagent for Phase 2 — it manages its own sub-agent spawning internally. If research is triggered during the interview (Phase 3 Stage C), dispatch the `research` skill as a subagent.

**If subagent dispatch is not available:** For deep analysis, read `../../core/deep-analysis/SKILL.md` and follow its workflow sequentially (it handles its own inline execution of code-exploration). For research, read `../research/SKILL.md` and follow its instructions directly inline.

## Agent Coordination

- The lead (you) acts as the interviewer: manages all phases, curates findings, and compiles the final spec
- Deep analysis is delegated entirely — do not manage explorers or the synthesizer directly
- Research agents work independently and return structured findings
- Handle agent failures gracefully — continue with partial analysis results when possible

---

## Reference Files

| File | When to Load | Purpose |
|------|-------------|---------|
| `../sdd-specs/SKILL.md` | Phase 1 (before workflow starts) | Templates, question bank, exploration patterns |
| `references/curation-interview.md` | Phase 3 (before interview) | Full interview procedures for all 4 stages |
| `references/analysis-to-spec-mapping.md` | Phase 5 (before compilation) | How analysis findings map to spec sections |
| `references/compilation-guide.md` | Phase 5 (before compilation) | Header format, provenance rules, compilation steps |
| `../../core/deep-analysis/SKILL.md` | Phase 2 (analysis invocation) | Analysis workflow to invoke |
| `../research/SKILL.md` | Phase 3 Stage C (if research triggered) | Research dispatcher for domain investigation |
| `../../core/technical-diagrams/SKILL.md` | Phase 5 (detailed/full-tech only) | Mermaid diagram styling rules |
