---
name: deep-analysis
description: >-
  Deep exploration and synthesis workflow using parallel subagents with dynamic
  planning and hub-and-spoke coordination. Use when asked for "deep analysis",
  "deep understanding", "analyze codebase", "explore and analyze", or
  "investigate codebase". Also use when another skill needs comprehensive
  codebase exploration before proceeding.
metadata:
  argument-hint: "<analysis-context or focus-area>"
  type: workflow
allowed-tools: Read Glob Grep Bash
---

# Deep Analysis Workflow

Execute a structured exploration and synthesis workflow using parallel subagents with hub-and-spoke coordination. The lead performs rapid reconnaissance to generate dynamic focus areas, composes a plan for review, explorer subagents investigate independently, and a synthesizer subagent merges findings with deep investigation.

This skill can be invoked standalone or loaded by other skills as a reusable building block. When loaded by another skill, the plan is auto-approved to avoid unnecessary user interaction.

---

## Phase 1: Reconnaissance & Planning

**Goal:** Map the codebase, generate dynamic focus areas, compose a plan, and get approval.

### Step 1: Determine Analysis Context

- If the user provided input, use it as the analysis context (feature area, question, or general exploration goal)
- If this skill was loaded by another skill, use the calling skill's context
- If standalone with no input, set context to "general codebase understanding"
- Set `PATH = current working directory`
- Inform the user: "Exploring codebase at: `PATH`" with the analysis context

### Step 2: Rapid Codebase Reconnaissance

Use file search, content search, and file reading to quickly map the codebase structure. This should take 1-2 minutes, not deep investigation.

- **Directory structure:** Search for top-level directories (e.g., `*/` pattern) to understand the project layout
- **Language and framework detection:** Read config files (`package.json`, `tsconfig.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.) to identify primary language(s) and framework(s)
- **File distribution:** Search with patterns like `src/**/*.ts`, `**/*.py` to gauge the size and shape of different areas
- **Key documentation:** Read `README.md`, `AGENTS.md`, or similar docs if they exist for project context
- **For feature-focused analysis:** Search for feature-related terms (function names, component names, route paths) to find hotspot directories
- **For general analysis:** Identify the 3-5 largest or most architecturally significant directories

**Fallback:** If reconnaissance fails (empty project, unusual structure, errors), use static focus area templates from Step 3b.

### Step 3: Generate Dynamic Focus Areas

Based on reconnaissance findings, create focus areas tailored to the actual codebase. Default to 3 focus areas, but adjust based on codebase size and complexity (2 for small projects, up to 4 for large ones).

**a) Dynamic focus areas (default):**

Each focus area should include:
- **Label:** Short description (e.g., "API layer in src/api/")
- **Directories:** Specific directories to explore
- **Starting files:** 2-3 key files to read first
- **Search terms:** Patterns to find related code
- **Complexity estimate:** Low/Medium/High based on file count and apparent structure

For feature-focused analysis, focus areas should track the feature's actual footprint:
```
Example:
Focus 1: "API routes and middleware in src/api/ and src/middleware/" (auth-related endpoints, request handling)
Focus 2: "React components in src/pages/profile/ and src/components/user/" (UI layer for user profiles)
Focus 3: "Data models and services in src/db/ and src/services/" (persistence and business logic)
```

For general analysis, focus areas should map to the codebase's actual structure:
```
Example:
Focus 1: "Next.js app layer in apps/web/src/" (pages, components, app router)
Focus 2: "Shared library in packages/core/src/" (utilities, types, shared logic)
Focus 3: "CLI and tooling in packages/cli/" (commands, configuration, build)
```

**b) Static fallback focus areas** (only if recon failed):

For feature-focused analysis:
```
Focus 1: Explore entry points and user-facing code related to the context
Focus 2: Explore data models, schemas, and storage related to the context
Focus 3: Explore utilities, helpers, and shared infrastructure
```

For general codebase understanding:
```
Focus 1: Explore application structure, entry points, and core logic
Focus 2: Explore configuration, infrastructure, and shared utilities
Focus 3: Explore shared utilities, patterns, and cross-cutting concerns
```

### Step 4: Compose the Plan

Assemble a structured plan from the reconnaissance and focus area findings:

```markdown
## Exploration Plan

### Analysis Context
[context from Step 1]

### Reconnaissance Summary
- **Project:** [name/type]
- **Primary language/framework:** [detected]
- **Codebase size:** [file counts, key directories]
- **Key observations:** [2-3 bullets]

### Focus Areas

#### Focus Area 1: [Label]
- **Directories:** [list]
- **Starting files:** [2-3 files]
- **Search patterns:** [patterns]
- **Complexity:** [Low/Medium/High]

#### Focus Area 2: [Label]
[... same structure]

### Agent Composition
| Role | Count | Purpose |
|------|-------|---------|
| Explorer | [N] | Independent focus area exploration |
| Synthesizer | 1 | Merge findings, deep investigation |
```

### Step 5: Review & Approval

**If loaded by another skill:** Auto-approve the plan. Note: "Auto-approving exploration plan (invoked by parent skill). Proceeding with [N] explorers and 1 synthesizer."

**If invoked directly:** Present the plan to the user and ask for approval:
- **"Approve"** — Proceed to Phase 2
- **"Modify"** — User describes changes; apply and re-present (up to 3 cycles)
- **"Regenerate"** — Re-run reconnaissance with feedback (up to 2 cycles)

If cycles are exhausted, offer "Approve current plan" or "Abort analysis".

---

## Phase 2: Parallel Exploration

**Goal:** Spawn explorer subagents to investigate focus areas independently.

### Step 1: Spawn Explorers

For each focus area in the approved plan, invoke the `code-exploration` skill by reading `../code-exploration/SKILL.md` and following its workflow. Each explorer receives:

- The focus area assignment (label, directories, starting files, search patterns)
- The codebase path
- The analysis context
- Instructions to return structured findings when complete

Spawn all explorers in parallel — they work independently without communicating with each other (hub-and-spoke topology).

### Step 2: Collect Results

Wait for all explorer subagents to complete and collect their structured findings. Each explorer should return:

- Key files found (with purpose and relevance)
- Code patterns observed
- Important functions/classes with file:line references
- Integration points
- Potential challenges and recommendations

**If an explorer fails:** Note the gap and either:
- Spawn a replacement explorer for the missed focus area
- Proceed with partial results and flag the gap for the synthesizer

---

## Phase 3: Synthesis

**Goal:** Merge explorer findings into a unified analysis with deep investigation.

### Step 1: Launch Synthesizer

Spawn a subagent using the code-synthesizer instructions from `agents/code-synthesizer.md`. Provide it with:

- All explorer findings collected in Phase 2
- The reconnaissance summary from Phase 1
- The analysis context
- Instructions to merge findings, investigate gaps directly using its tools (git history, dependency analysis, static analysis), and produce a comprehensive synthesis

The synthesizer should investigate gaps and conflicts directly rather than sending messages back to explorers — it has full tool access including bash for git history, dependency trees, and static analysis.

### Step 2: Collect Synthesis

Wait for the synthesizer to complete and collect its output, which should include:

- Architecture overview (2-3 paragraphs with diagram)
- Critical files table with connections
- File details (exports, logic, patterns)
- Relationship map (component dependencies, data flow)
- Patterns & conventions catalog
- Challenges & risks assessment
- Recommendations with challenge citations
- Open questions for areas not fully covered

---

## Phase 4: Completion

**Goal:** Present results to the user or return them to the calling skill.

1. **Collect the synthesis output** from Phase 3

2. **Present or return results:**
   - **Standalone invocation:** Present the synthesized analysis to the user. The results remain in conversation for follow-up questions.
   - **Loaded by another skill:** The synthesis is complete. Return results to the calling workflow — do not present a standalone summary.

---

## Error Handling

### Planning Phase Failure
- If reconnaissance fails (errors, empty results, unusual structure): fall back to static focus area templates (Phase 1 Step 3b)
- If the codebase appears empty: inform the user and ask how to proceed

### Approval Phase Failure
- If maximum modification or regeneration cycles are reached: offer "Approve current plan" or "Abort analysis"

### Partial Worker Failure
- If one explorer fails: spawn a replacement targeting the missed focus area, or proceed with partial results
- If multiple explorers fail: attempt replacements, but if they also fail, instruct the synthesizer to work with partial results
- If all explorers fail: inform the user and offer to retry or abort

### Synthesizer Failure
- If the synthesizer fails: present the raw exploration results to the user directly
- Offer to retry synthesis or let the user work with partial results

### General Failures
If any phase fails:
1. Explain what went wrong
2. Ask the user how to proceed: retry the phase, continue with partial results, or abort

---

## Agents

This skill uses the following agents directly:

| Agent | File | Dependencies |
|-------|------|--------------|
| code-synthesizer | `agents/code-synthesizer.md` | code-explorer (via code-exploration skill) |

Additionally, this skill invokes the following skills for agent access:
- `code-exploration` — dispatches code-explorer agents for focused area investigation

## Execution Strategy

Execute agents respecting their dependency graph.

**If subagent dispatch is available:** Dispatch each code-exploration invocation as a parallel subagent via the code-exploration skill. Once all explorers complete, dispatch the code-synthesizer as a subagent, passing the contents of `agents/code-synthesizer.md` as the task instructions along with all explorer findings. Wait for synthesis to complete before returning results.

**If subagent dispatch is not available:** For each focus area, read `../code-exploration/SKILL.md` and follow its workflow sequentially, writing findings to output before proceeding to the next area. After all exploration is complete, read `agents/code-synthesizer.md` and follow its instructions to merge all findings into a unified analysis.

## Agent Coordination

- The lead (you) acts as the planner: performs recon, composes the plan, handles approval
- Explorer subagents work independently — no cross-explorer communication (hub-and-spoke topology)
- Explorers are dispatched via the `code-exploration` skill, not directly
- The synthesizer investigates gaps directly using its own tools rather than messaging explorers
- The synthesizer has bash access for deep investigation (git history, dependency trees, static analysis)
- Handle subagent failures gracefully — continue with partial results when possible
- Agent count and focus area details come from the approved plan, not hardcoded values
- Use a high-capability model for the synthesizer (complex reasoning) and a standard model for explorers (parallel breadth)
