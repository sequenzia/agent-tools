---
name: analyze-spec
description: >-
  Analyze an existing specification for requirements completeness, risks,
  quality issues, and strategic gaps. Generates a scored report with
  actionable findings and supports auto-fix or interactive review modes.
  Use when user says "analyze spec", "review spec", "spec analysis",
  "audit spec", "check spec", "validate requirements", "spec quality",
  or wants to evaluate, improve, or validate an existing specification.
metadata:
  argument-hint: "[spec-path]"
  type: workflow
allowed-tools: Read Write Edit Glob Grep Bash
---

# Analyze Spec

You are initiating the spec analysis workflow. This process analyzes an existing specification across four dimensions — requirements, risk, quality, and completeness — generates a scored report, and offers the user resolution paths to improve the spec.

## Critical Rules

### question tool is MANDATORY

**IMPORTANT**: You MUST use the `question` tool for ALL questions to the user. Never ask questions through regular text output.

- Every decision question -> `question`
- Confirmation questions -> `question`
- Yes/no consent questions -> `question`
- Clarifying questions -> `question`

Text output should only be used for:
- Presenting analysis results and summaries
- Explaining findings and context
- Showing progress updates

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

- **Option labels must be self-descriptive**: Fold context into the label text (e.g., `"Accept recommendation — Apply this fix"` instead of a separate label + description).
- **Mark recommended options**: Append `"(Recommended)"` to the label text.
- **Return format**: Answers are returned as arrays of selected labels.
- **Single question per call**: Ask each question individually using separate calls.

### Plan Mode Behavior

**CRITICAL**: This skill analyzes and potentially modifies a spec document. When invoked in a planning context:

- **DO NOT** create a plan for how to analyze — proceed with the analysis immediately
- **DO** perform the full analysis workflow and write the report file
- **DO** pause for user decisions at Phase 4 (resolution path choice)

### Deduplication Rule

If the same underlying issue surfaces in multiple analysis dimensions, create one finding tagged with the primary dimension. Note the cross-dimension impact in the finding's Issue or Impact field.

## Load Reference Skills

Before starting analysis, load the sdd-specs reference for depth templates and completeness criteria:

```
Read ../sdd-specs/SKILL.md
```

This provides depth-level templates for structural validation and completeness thresholds.

## Workflow Overview

| Phase | Purpose |
|-------|---------|
| 1. Input & Setup | Validate spec, detect depth, load references |
| 2. Analysis | Four-dimension inline analysis |
| 3. Report Generation | Create scored `.analysis.md` report |
| 4. Presentation & Decision | Present summary, offer resolution path |
| 5. Resolution | Auto-implement (5A) or interactive review (5B) |

---

## Phase 1: Input & Setup

### Step 1: Resolve Spec Path

If an argument was provided, verify the file exists using `Read`. If the file is not found, use `Glob` to search for similar filenames (`**/*{argument}*.md`). If no argument was provided:

```yaml
question:
  header: "Spec Path"
  text: "Which specification would you like to analyze? Provide the file path."
  custom: true
```

### Step 2: Read Spec Content

Read the full spec file. Store the content for analysis.

### Step 3: Detect Depth Level

Apply the detection algorithm:
1. Search for `API Specifications` section OR endpoint patterns (`POST /api/`, `GET /api/`) → **Full-Tech**
2. Search for numbered sections (`## 1.`, `### 2.1`) AND `Technical Architecture` section → **Detailed**
3. Search for Feature/Priority table OR executive summary focus → **High-Level**
4. Default: **Detailed**

Confirm with the user:

```yaml
question:
  header: "Depth Level"
  text: "Detected this as a {depth} spec. Is that correct?"
  options:
    - label: "{detected-level} — Confirmed"
    - label: "High-Level — Executive overview with feature priorities"
    - label: "Detailed — User stories, acceptance criteria, technical constraints"
    - label: "Full-Tech — API specs, data models, deployment plans"
  custom: false
```

### Step 4: Load Analysis References

Read these files to prepare for analysis:
1. `references/analysis-dimensions.md` — scoring criteria and dimension checklists
2. `references/common-findings.md` — pattern library for issue detection
3. The matching sdd-specs template: `../sdd-specs/references/templates/{high-level|detailed|full-tech}.md`

---

## Phase 2: Analysis

Perform the analysis inline across all four dimensions. For each dimension, apply the depth-appropriate criteria from `references/analysis-dimensions.md` and patterns from `references/common-findings.md`.

### Dimension 1: Requirements Extraction

- Parse functional requirements (features, user stories, acceptance criteria)
- Parse non-functional requirements (performance, security, scalability)
- Detect gaps: features mentioned but unspecified, implied requirements, missing NFRs for critical features
- Detect conflicts: contradictory requirements, scope-timeline tensions

### Dimension 2: Risk & Feasibility

- Identify technical risk signals (integration density, distributed patterns, compliance mentions)
- Flag implementation challenges (underspecified interfaces, missing error handling, technology unknowns)
- Assess scalability and security risks against stated requirements

### Dimension 3: Quality Audit

- Apply all applicable patterns from `references/common-findings.md`: INC, MISS, AMB, STRUCT categories
- Respect the depth-aware "what NOT to flag" lists from `references/analysis-dimensions.md`

### Dimension 4: Completeness Scoring

- Check each expected section for the depth level against the sdd-specs template
- Calculate per-section scores (0-100%)
- Verify minimum thresholds (sections, features, user stories, metrics)

### Building the Findings List

Track each finding as:
- `FIND-NNN` — sequential ID
- Dimension, category (pattern ID), severity
- Location (section and line reference)
- Issue description, impact, recommendation
- Status: Pending

Calculate dimension scores using the methodology from `references/analysis-dimensions.md`.

---

## Phase 3: Report Generation

Read `references/report-template.md` and generate the analysis report following its exact structure:

1. Header with spec metadata, overall score, and rating
2. Summary Dashboard table (4 dimensions × score + severity counts)
3. Overall Assessment (2-3 sentences)
4. Completeness Scorecard (per-section scores and threshold compliance)
5. Findings grouped by severity: Critical → Warnings → Suggestions
6. Analysis Methodology section

**Save the report** to `{spec-directory}/{spec-basename}.analysis.md`.

---

## Phase 4: Report Presentation & Decision

### Present Summary

Output a condensed version in-conversation:
- Summary Dashboard table
- Overall score and rating
- Completeness threshold compliance
- Top 3-5 critical/warning findings with brief descriptions
- Total finding counts by severity

### Offer Resolution Path

```yaml
question:
  header: "Resolution"
  text: "How would you like to proceed with these findings?"
  options:
    - label: "Auto-implement all — Apply all recommendations as a batch update to the spec"
    - label: "Interactive review — Walk through findings and decide individually"
    - label: "Report only — Keep the analysis report, no spec changes"
  custom: false
```

If **Report only**: Present the report file location. Workflow complete.

---

## Phase 5A: Auto-Implement All

1. Read the current spec fresh (avoid stale data)
2. Apply all recommendations from all findings as a single batch rewrite
3. Validate the updated spec against the depth-level template for structural conformance
4. Write the updated spec in-place using the `Write` tool
5. Update the `.analysis.md` report:
   - Mark all findings as "Resolved"
   - Add the Resolution Summary section with score changes
6. Write the updated report
7. Present a completion summary: findings resolved, sections modified, before/after scores

---

## Phase 5B: Interactive Review

Read `references/interview-guide.md` for detailed question patterns, grouping heuristics, and session management guidance.

### Step 1: Walk Through Findings

Process findings by severity: critical → warning → suggestion. For each finding, present it using the question patterns from the interview guide with options: Accept / Modify / Skip / Tell me more.

Group related findings when they affect the same section or concept. See the interview guide's grouping heuristics for when to group vs. present individually.

### Step 2: Handle Follow-Ups

- **"Tell me more"**: Provide expanded explanation showing exact spec text, then re-present the decision
- **"Modify"**: Ask for the user's preferred approach, incorporate their input
- **Custom text**: Treat as additional context — re-evaluate the finding if the new information changes its validity

### Step 3: Additional Concerns

After all findings are processed:

```yaml
question:
  header: "Additional Concerns"
  text: "Are there any other issues or areas you'd like to address in this spec?"
  options:
    - label: "No, proceed with changes — Apply accepted fixes"
  custom: true
```

If the user raises new concerns: analyze them inline, create new findings, and walk through them.

### Step 4: Apply Accepted Changes

1. Collect all accepted and modified findings
2. Read the current spec fresh
3. Apply changes as a batch rewrite (only accepted/modified findings)
4. Validate against the depth-level template
5. Write updated spec in-place
6. Update the `.analysis.md` report with resolution statuses and score changes
7. Write updated report
8. Present completion summary: resolved count, skipped count, sections modified, before/after scores

---

## Execution Strategy

This skill performs all analysis inline — no subagent dispatch.

**If subagent dispatch is available:** Not applicable. Read references and execute the full workflow in the main conversation.

**If subagent dispatch is not available:** Read references and execute the full workflow in the main conversation.

---

## Reference Files

| File | When to Load | Purpose |
|------|-------------|---------|
| `references/analysis-dimensions.md` | Phase 1, Step 4 | Scoring methodology, dimension checklists, depth-aware criteria |
| `references/common-findings.md` | Phase 1, Step 4 | Pattern library for issue detection (25 patterns, 6 categories) |
| `references/report-template.md` | Phase 3 | Markdown report structure template |
| `references/interview-guide.md` | Phase 5B start | Interactive review question patterns, grouping, session management |
