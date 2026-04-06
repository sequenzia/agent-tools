---
name: create-spec
description: >-
  Create a new specification through an adaptive interview process with proactive
  recommendations and optional research. Supports high-level, detailed, and full
  technical documentation depths. Use when user says "create spec", "new spec",
  "generate spec", "write a spec", "PRD", "product requirements", or wants to
  start a specification document.
metadata:
  argument-hint: "[context-file-or-text]"
  type: workflow
  harness-hints:
    prefer-non-streaming: true
    reason: "Phase 5 generates large markdown documents (400-1200 lines) that may exceed streaming buffer limits"
allowed-tools: Read Write Edit Glob Grep Bash
---

# Create Spec

You are initiating the spec creation workflow. This process gathers requirements through an adaptive, multi-round interview and generates a comprehensive specification document.

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

- **Option labels must be self-descriptive**: There is no separate `description` field per option. Fold context into the label text (e.g., `"OAuth 2.0 with PKCE — secure token handling for public clients"` instead of a separate label + description).
- **Mark recommended options**: Append `"(Recommended)"` to the label text of recommended choices.
- **Return format**: Answers are returned as arrays of selected labels.
- **Multi-select**: Use `multiple: true` for questions where users should select multiple items.
- **Custom input**: `custom: true` is the default — freeform text input is always available unless you explicitly set `custom: false`.
- **Single question per call**: The `question` tool accepts one question per invocation. Ask each question individually using separate calls.

**NEVER do this** (asking via text output):
```
What features are most important to you?
1. Performance
2. Usability
3. Security
```

**ALWAYS do this** (using question tool):
```yaml
question:
  header: "Priority"
  text: "What features are most important to you?"
  options:
    - label: "Performance — Speed and responsiveness"
    - label: "Usability — Ease of use"
    - label: "Security — Data protection"
  multiple: true
```

### Plan Mode Behavior

**CRITICAL**: This skill generates a spec document, NOT an implementation plan. When invoked in a planning context:

- **DO NOT** create an implementation plan for how to build the spec's described features
- **DO NOT** defer spec generation to an "execution phase"
- **DO** proceed with the full interview and spec generation workflow immediately
- **DO** write the spec file to the output path as normal

The spec is a planning artifact itself — generating it IS the planning activity.

### Streaming & Harness Compatibility

This skill's Phase 5 (Spec Compilation) generates large markdown documents that can exceed streaming buffer limits in some coding agent harnesses (Cursor, Cline, Windsurf, etc.), causing EOF errors mid-generation.

**Mitigations built into this skill:**
- Phase 5 writes the spec incrementally across multiple tool calls rather than in a single Write
- For full-tech depth, a compilation checkpoint creates a turn boundary before the largest section
- Each write pass targets ~200-300 filled lines maximum

**Harness configuration recommendation**: If your harness supports it, configure this skill to use non-streaming mode (complete response before rendering) to avoid EOF errors on long generations.

## Load Reference Skills

Before starting the workflow, load the sdd-specs reference for templates, interview questions, and recommendation patterns:

```
Read ../sdd-specs/SKILL.md
```

This reference provides:
- Spec templates (high-level, detailed, full-tech)
- Interview question bank organized by category and depth
- Complexity signal definitions and thresholds
- Recommendation trigger patterns and presentation format
- Codebase exploration procedure for "new feature" type

## Workflow Overview

This workflow has five phases:

1. **Initial Inputs** — Gather spec name, type, depth, and description (includes codebase exploration for "new feature" type)
2. **Adaptive Interview** — Multi-round depth-aware interview with recommendations and optional research
3. **Recommendations Round** — Dedicated round for accumulated best-practice suggestions (if applicable)
4. **Pre-Compilation Summary** — Present gathered requirements for user confirmation
5. **Spec Compilation** — Generate spec from template and write to file

---

## Phase 1: Initial Inputs & Context

### Context Loading

If arguments are provided, load user-supplied context before gathering initial inputs:

1. **Determine input type**:
   - If the argument looks like a file path (ends in `.md`, `.txt`, or `.markdown`; or starts with `/`, `./`, `../`, or `~`; or contains path separators and the file exists) → read the file using the `Read` tool
   - Otherwise → treat the entire argument string as inline context text

2. **Store internally** as "User-Supplied Context" for use throughout the interview

3. **CRITICAL**: User-supplied context makes the interview *smarter*, not shorter. Do NOT pre-fill answers or skip questions based on context. Instead:
   - Ask more targeted, specific questions informed by the context
   - Probe areas the context doesn't cover
   - Confirm implicit assumptions the context makes
   - Reference specific details from the context when asking questions

If no arguments are provided, skip this subsection entirely — the skill behaves exactly as before.

### Complexity Assessment

If user-supplied context was loaded, assess its complexity:

1. **Read** `../sdd-specs/references/complexity-signals.md` for signal definitions and thresholds
2. **Scan** the user-supplied context for complexity signals
3. **If threshold is met** (3+ high-weight signals OR 5+ any-weight signals), present a brief notice via the `question` tool:
   ```yaml
   question:
     header: "Complexity"
     text: "This appears to involve significant complexity (e.g., {top 2-3 complexity areas}). The interview will be more thorough to ensure complete coverage. Ready to proceed?"
     options:
       - label: "Yes, let's be thorough — Use expanded interview budgets for deeper coverage"
       - label: "Keep it brief — Use standard interview budgets"
     custom: false
   ```
4. If user selects "Yes, let's be thorough" → set internal `complexity_detected` flag for expanded budgets
5. If user selects "Keep it brief" → proceed with standard budgets
6. If no context was loaded or threshold was not met → proceed with standard budgets (no alert shown)

### Gather Initial Inputs

Use the `question` tool to gather the essential starting information. Ask each question individually:

**Question 1 - Spec Name:**
```yaml
question:
  header: "Spec Name"
  text: "What would you like to name this spec?"
  options:
    - label: "Provide a descriptive name for your specification"
  custom: true
```

**Question 2 - Type:**
```yaml
question:
  header: "Type"
  text: "What type of product/feature is this?"
  options:
    - label: "New product — A completely new product being built from scratch"
    - label: "New feature — A new feature for an existing product"
  custom: false
```

**Question 3 - Depth:**
```yaml
question:
  header: "Depth"
  text: "How detailed should the spec be?"
  options:
    - label: "High-level overview (Recommended) — Executive summary with key features and goals"
    - label: "Detailed specifications — Standard spec with acceptance criteria and phases"
    - label: "Full technical documentation — Comprehensive specs with API definitions and data models"
  custom: false
```

**Question 4 - Description:**
- If context was loaded:
  ```yaml
  question:
    header: "Description"
    text: "I've loaded the context you provided. Is there anything it doesn't cover, or would you like to highlight specific priorities?"
    options:
      - label: "Context is complete — Proceed with what's provided"
    custom: true
  ```
- If no context:
  ```yaml
  question:
    header: "Description"
    text: "Briefly describe the product/feature and its key requirements."
    options:
      - label: "Describe the problem, main features, and any constraints"
    custom: true
  ```

---

## Phase 2: Adaptive Interview

### Codebase Exploration (New Feature Type)

If the product type is "New feature for existing product":

1. **Read the exploration procedure:** `../sdd-specs/references/codebase-exploration.md`
2. **Follow all 4 steps** (Quick Reconnaissance → Plan Focus Areas → Parallel Exploration → Synthesis)
3. After synthesis, store the merged findings internally as "Codebase Context" for use in subsequent interview rounds and spec compilation
4. Present a brief summary of key findings to the user before starting the interview

**Error handling / fallback:**
If exploration agents fail:
1. If some agents succeeded: continue with partial findings — merge what's available
2. If all agents failed: use the reconnaissance findings from Step 1 as minimal context
3. If reconnaissance also failed, use the `question` tool to offer fallback:
   ```yaml
   question:
     header: "Fallback"
     text: "Codebase exploration encountered an issue. How would you like to proceed?"
     options:
       - label: "Quick exploration — Fall back to basic Glob/Grep/Read exploration"
       - label: "Skip — Continue without codebase analysis"
     custom: false
   ```
4. If quick exploration: use basic Glob/Grep/Read to understand existing patterns, related features, integration points, and data models
5. If skip: continue to the interview with whatever findings were gathered

### Prepare for Interview

Before starting Round 1, read these reference files to load the full question bank and trigger patterns:

1. `../sdd-specs/references/interview-questions.md` — Question bank organized by category and depth level
2. `../sdd-specs/references/recommendation-triggers.md` — Trigger patterns for proactive recommendations across all domains

Use these as your primary source for questions and trigger detection throughout the interview.

### Interview Procedures

Load the full interview strategy, round structure, recommendation handling, research integration, and early exit procedures:

```
Read references/interview-procedures.md
```

---

## Phase 3: Recommendations Round & Phase 4: Pre-Compilation Summary

Load the recommendations presentation format and pre-compilation summary procedures:

```
Read references/recommendations-and-summary.md
```

Phase 3 presents accumulated best-practice recommendations (skip for high-level depth or if no triggers detected). Phase 4 presents a comprehensive requirements summary for user confirmation before compilation.

---

## Phase 5: Spec Compilation

### Template Selection

Choose the appropriate template based on depth level:

| Depth Level | Template | Use Case |
|-------------|----------|----------|
| High-level overview | `../sdd-specs/references/templates/high-level.md` | Executive summaries, stakeholder alignment, initial scoping |
| Detailed specifications | `../sdd-specs/references/templates/detailed.md` | Standard development specs with clear requirements |
| Full technical documentation | `../sdd-specs/references/templates/full-tech.md` | Complex features requiring API specs, data models, architecture |

### Diagram Guidance (Detailed/Full-Tech Only)

For "Detailed specifications" and "Full technical documentation" depth levels, load the technical-diagrams skill before compilation:

```
Read ../technical-diagrams/SKILL.md
```

Apply its styling rules when generating Mermaid diagrams in the spec — use `classDef` with `color:#000` for all node styles. For "High-level overview" depth, skip diagram loading.

### Incremental Compilation Strategy

Phase 5 writes the spec incrementally to avoid streaming timeouts in third-party harnesses. The number of write passes depends on depth level:

| Depth Level | Write Passes | Turn Boundary |
|-------------|-------------|---------------|
| High-level overview | 1 (single Write) | None needed |
| Detailed specifications | 3 passes (Write + 2 Edits) | None needed |
| Full technical documentation | 4 passes (Write + 3 Edits) | Checkpoint after Pass 2 |

**Pass structure:**
1. **Pass 1 (Write)**: Create the file with header metadata and early sections (Executive Summary through User Research)
2. **Pass 2 (Edit)**: Append requirements sections (Functional + Non-Functional Requirements)
3. **Pass 3 (Edit)**: Append technical sections (Architecture/Considerations, Codebase Context)
4. **Pass 4 (Edit, full-tech only)**: Append closing sections (Scope through Appendix)

For high-level depth, all content fits in Pass 1. For detailed depth, Passes 2 and 3 may be combined if the content is manageable.

**Compilation checkpoint (full-tech only):** After completing Pass 2, use the `question` tool to create a turn boundary before the heavy architecture section:

```yaml
question:
  header: "Compilation Progress"
  text: "Requirements sections written successfully. Continuing with technical architecture and remaining sections."
  options:
    - label: "Continue"
  custom: false
```

### Compilation Steps, Writing Guidelines & Core Principles

Load the detailed compilation procedures, requirement formatting templates, and spec structuring principles:

```
Read references/compilation-and-principles.md
```

---

## Agents

This skill invokes the following skills for agent access:

| Skill Invoked | Agent Accessed | Purpose |
|---------------|---------------|---------|
| `code-exploration` | code-explorer | Focused codebase investigation for "new feature" type (Phase 1) |
| `research` | researcher | Best practices, compliance, and technology research (Phase 2) |

## Execution Strategy

**If subagent dispatch is available:** Dispatch each code-exploration invocation as a parallel subagent (Phase 1 codebase exploration). Dispatch the research skill as a subagent when research is triggered (Phase 2).

**If subagent dispatch is not available:** For codebase exploration, read `../code-exploration/SKILL.md` and follow its workflow sequentially for each focus area. For research, read `../research/SKILL.md` and follow its instructions directly inline.

## Agent Coordination

- The lead (you) acts as the interviewer: manages the full interview lifecycle, tracks recommendations, and compiles the final spec
- Codebase exploration is delegated to the `code-exploration` skill, not managed directly
- Research agents work independently and return structured findings
- Handle agent failures gracefully — continue with partial results when possible

---

## Reference Files

- `../sdd-specs/references/interview-questions.md` — Question bank organized by category and depth level (includes expanded budgets for complex projects)
- `../sdd-specs/references/complexity-signals.md` — Signal definitions, thresholds, and assessment format for complexity detection
- `../sdd-specs/references/recommendation-triggers.md` — Trigger patterns for proactive recommendations
- `../sdd-specs/references/recommendation-format.md` — Templates for presenting recommendations
- `../sdd-specs/references/codebase-exploration.md` — Procedure for team-based codebase exploration (new feature type)
- `../sdd-specs/references/templates/high-level.md` — Streamlined executive overview template
- `../sdd-specs/references/templates/detailed.md` — Standard spec template with all sections
- `../sdd-specs/references/templates/full-tech.md` — Extended template with technical specifications
