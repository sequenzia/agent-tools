---
name: codebase-analysis-lite
description: >
  Fast, lightweight codebase analysis producing a structured report with
  architecture overview, critical files, patterns, and recommendations.
  Use when asked to "analyze codebase", "explore codebase", "quick codebase overview",
  "understand this codebase", "map the codebase", "give me an overview of this project",
  "what does this codebase do", "codebase report", "project analysis", or
  "how is this project structured". Prefer this over the full codebase-analysis
  skill when speed matters more than deep investigation depth.
dependencies:
  - technical-diagrams
---

# Codebase Analysis Lite

Execute a streamlined 3-phase codebase analysis: reconnaissance with parallel exploration, inline synthesis, and structured reporting.

## Phase 1: Reconnaissance & Exploration

**Goal:** Map the codebase structure and dispatch parallel explorers.

### Step 1: Determine Analysis Context

- If arguments are provided, use them as the analysis context
- If no arguments, set context to "general codebase understanding"
- Set `PATH = current working directory`
- Inform the user: "Analyzing codebase at: `PATH`" with the analysis context

### Step 2: Rapid Codebase Reconnaissance

Search for files and scan content to quickly map the codebase structure:

- **Directory structure:** Search for top-level directories to understand the project layout
- **Language and framework detection:** Read config files (`package.json`, `tsconfig.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.) to identify primary language(s) and framework(s)
- **File distribution:** Search for source files by pattern to gauge size and shape of different areas
- **Key documentation:** Read `README.md`, `CLAUDE.md`, or similar docs if they exist for project context
- For feature-focused analysis: search file contents for feature-related terms to find hotspot directories
- For general analysis: identify the 3-5 largest or most architecturally significant directories

### Step 3: Generate Dynamic Focus Areas

Based on reconnaissance findings, create 2-3 focus areas tailored to the actual codebase (adjust: 2 for small projects, up to 4 for large ones).

Each focus area includes:
- **Label:** Short description (e.g., "API layer in src/api/")
- **Directories:** Specific directories to explore
- **Starting files:** 2-3 key files to read first
- **Search terms:** Patterns to find related code

### Step 4: Spawn Explorer Team

1. Create a team named `codebase-lite-{timestamp}`
2. Spawn one code-explorer-lite agent per focus area (use a lightweight/fast model):
   - Named: `explorer-1`, `explorer-2`, etc.
   - Instruct each with their focus area details, the analysis context, and the codebase path
3. Create a task per focus area with the exploration instructions
4. Assign tasks to the corresponding explorers
5. Wait for all exploration tasks to complete

---

## Phase 2: Synthesis & Reporting

**Goal:** Merge explorer findings and present a structured report.

### Step 1: Collect and Synthesize Findings

1. Read completed exploration task results from all explorers
2. Synthesize findings inline:
   - Merge and deduplicate findings across explorers
   - Read critical files identified as high-relevance (if not already read during recon)
   - Map relationships between components
   - Identify cross-cutting patterns, conventions, and risks

### Step 2: Present the Report

Load the technical-diagrams skill conventions for Mermaid diagram styling, then structure the report using the template below.

### Step 3: Team Cleanup

1. Send shutdown to all explorer agents
2. Delete the team

---

## Phase 3: Save Report

**Goal:** Offer to save the report.

Prompt the user: "Would you like to save this report to a file?"

- **If yes:** Save to `codebase-analysis-{YYYY-MM-DD}.md` in the project root (or a user-specified path)
- **If no:** Workflow complete

---

## Error Handling

If any phase fails:
1. Explain what went wrong
2. Ask the user how to proceed: retry the phase, continue with partial results, or abort

If an individual explorer fails:
- Continue with partial results from the other explorers
- Note the gap in the Analysis Methodology section

---

## Report Template

```markdown
# Codebase Analysis Report

**Analysis Context**: {What was analyzed and why}
**Codebase Path**: {Path analyzed}
**Date**: {YYYY-MM-DD}

---

## Executive Summary

{Lead with the most important finding. 2-3 sentences covering: what was analyzed, the key architectural insight, and the primary recommendation or risk.}

---

## Architecture Overview

{2-3 paragraphs describing:}
- How the codebase is structured (layers, modules, boundaries)
- The design philosophy and architectural style
- Key architectural decisions and their rationale

{Include a Mermaid architecture diagram (flowchart or C4 Context) showing the major layers/components. Use classDef with color:#000 for all node styles.}

---

## Tech Stack

| Category | Technology | Version (if detected) | Role |
|----------|-----------|----------------------|------|
| Language | {e.g., TypeScript} | {e.g., 5.x} | Primary language |
| Framework | {e.g., Next.js} | {e.g., 16} | Web framework |

{Include only technologies actually detected in config files or code. Omit categories that don't apply.}

---

## Critical Files

{Limit to 5-10 most important files}

| File | Purpose | Relevance |
|------|---------|-----------|
| path/to/file | Brief description | High/Medium |

### File Details

#### path/to/critical-file
- **Key exports**: What this file provides to others
- **Core logic**: What it does
- **Connections**: What depends on it and what it depends on

---

## Patterns & Conventions

### Code Patterns
- **Pattern**: Description and where it's used

### Naming Conventions
- **Convention**: Description and examples

### Project Structure
- **Organization**: How files and directories are organized

---

## Relationship Map

{Describe how key components connect -- limit to 15-20 most significant connections. Use Mermaid flowcharts with classDef color:#000 for readability.}

---

## Challenges & Risks

| Challenge | Severity | Impact |
|-----------|----------|--------|
| {Description} | High/Medium/Low | {What could go wrong} |

---

## Recommendations

1. **{Recommendation}** _(addresses: {Challenge name})_: {Brief rationale}
2. **{Recommendation}** _(addresses: {Challenge name})_: {Brief rationale}

---

## Analysis Methodology

- **Exploration agents**: {Number} agents with focus areas: {list}
- **Synthesis**: Findings merged and critical files read in depth
- **Scope**: {What was included and what was intentionally excluded}
- **Config files detected**: {List of config files found during reconnaissance}
```
