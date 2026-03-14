---
name: codebase-analysis
description: >-
  Produce a structured codebase analysis report with architecture overview,
  critical files, patterns, and actionable recommendations. Use when asked to
  "analyze codebase", "explore codebase", "understand this codebase",
  "map the codebase", "give me an overview of this project", "what does this
  codebase do", "codebase report", "project analysis", "audit this codebase",
  or "how is this project structured".
metadata:
  argument-hint: "<analysis-context or feature-description>"
allowed-tools: Read Write Edit Glob Grep Bash
---

# Codebase Analysis Workflow

Execute a structured 3-phase codebase analysis workflow to gather insights.

**CRITICAL: Complete ALL 3 phases.** The workflow is not complete until Phase 3: Post-Analysis Actions is finished. After completing each phase, immediately proceed to the next phase without waiting for user prompts.

## Phase Overview

1. **Deep Analysis** — Explore and synthesize codebase findings via deep-analysis skill
2. **Reporting** — Present structured analysis to the user
3. **Post-Analysis Actions** — Save, document, or retain analysis insights

---

## Phase 1: Deep Analysis

**Goal:** Explore the codebase and synthesize findings.

1. **Determine analysis context:**
   - If the user's input is provided, use it as the analysis context
   - If no arguments, set context to "general codebase understanding"

2. **Run the deep-analysis workflow:**
   - Read `../deep-analysis/SKILL.md` and follow its workflow
   - Pass the analysis context from step 1
   - This handles reconnaissance, team planning, approval, subagent creation, parallel exploration, and synthesis

3. **Verify results and capture metadata:**
   - Ensure the synthesis covers the analysis context adequately
   - If critical gaps remain, use Glob/Grep to fill them directly
   - Record analysis metadata for Phase 2 reporting: the number of explorer subagents used and the scope of analysis

---

## Phase 2: Reporting

**Goal:** Present a structured analysis to the user.

1. **Load diagram guidance:**
   - Read `../technical-diagrams/SKILL.md`
   - Use Mermaid diagrams in the Architecture Overview and Relationship Map sections

2. **Load report template:**
   - Read `references/report-template.md`
   - Use it to structure the presentation

3. **Present the analysis:**
   Structure the report with these sections:
   - **Executive Summary** — Lead with the most important finding
   - **Architecture Overview** — How the codebase is structured
   - **Tech Stack** — Core technologies, frameworks, and tools detected
   - **Critical Files** — The 5-10 most important files with details
   - **Patterns & Conventions** — Recurring patterns and coding conventions
   - **Relationship Map** — How components connect to each other
   - **Challenges & Risks** — Technical risks and complexity hotspots
   - **Recommendations** — Actionable next steps, each citing the challenge it addresses
   - **Analysis Methodology** — Subagents used, scope, and duration

4. **IMPORTANT: Proceed immediately to Phase 3.**
   Do NOT stop here. Do NOT wait for user input. The report is presented, but the workflow requires Post-Analysis Actions. Continue directly to Phase 3 now.

---

## Phase 3: Post-Analysis Actions

**Goal:** Let the user save, document, or retain analysis insights from the report through a multi-step interactive flow.

### Step 1: Select actions

Ask the user to select from the available actions (multiple selections allowed):

- **Save Codebase Analysis Report** — Write the structured report to a markdown file
- **Save a custom report** — Generate a report tailored to your specific goals (you'll provide instructions next)
- **Update project documentation** — Add/update README.md or AGENTS.md with analysis insights
- **Keep a condensed summary in memory** — Retain a quick-reference summary in conversation context

If the user selects no actions, the workflow is complete. Thank the user and end.

### Step 2: Execute selected actions

Process selected actions in the following fixed order. Complete all sub-steps for each action before moving to the next.

#### Action: Save Codebase Analysis Report

**Step 2a-1: Prompt for file location**

- Check if an `internal/docs/` directory exists in the project root
  - If yes, suggest default path: `internal/docs/codebase-analysis-report-{YYYY-MM-DD}.md`
  - If no, suggest default path: `codebase-analysis-report-{YYYY-MM-DD}.md` in the project root
- Ask the user to confirm or customize the file path

**Step 2a-2: Generate and save the report**

- Use the report template already loaded in Phase 2 Step 1
- Generate the full structured report using the Phase 2 analysis findings and the template structure
- Write the report to the confirmed path using the Write tool
- Confirm the file was saved

#### Action: Save Custom Report

**Step 2b-1: Gather report requirements**

- Ask the user to describe the goals and requirements for their custom report — what it should focus on, what questions it should answer, and any format preferences

**Step 2b-2: Prompt for file location**

- Check if an `internal/docs/` directory exists in the project root
  - If yes, suggest default path: `internal/docs/custom-report-{YYYY-MM-DD}.md`
  - If no, suggest default path: `custom-report-{YYYY-MM-DD}.md` in the project root
- Ask the user to confirm or customize the file path

**Step 2b-3: Generate and save the custom report**

- Generate a report shaped by the user's requirements from Step 2b-1, drawing from the Phase 2 analysis data — this is a repackaging of existing findings, not a re-analysis
- Write the report to the confirmed path using the Write tool
- Confirm the file was saved

#### Action: Update Project Documentation

**Step 2c-1: Select documentation files and gather directions**

Ask the user to select which documentation files to update (multiple selections allowed):

- **README.md** — Add architecture, structure, and tech stack information
- **AGENTS.md** — Add patterns, conventions, critical files, architectural decisions, agent descriptions, capabilities, and coordination patterns

Then ask the user for update directions for all selected files: "What content from the analysis should be added or updated? Provide general directions or specific sections to focus on (applies across all selected files, or specify per-file directions)."

**Step 2c-2: Generate and approve documentation drafts**

For each selected file, read the existing file and generate a draft based on the user's directions and Phase 2 analysis data:

- **README.md**: Read existing file at project root. If no README.md exists, skip and inform the user. Draft updates focusing on architecture, project structure, and tech stack.
- **AGENTS.md**: Read existing file at project root. If none exists, ask if one should be created (if declined, skip). Draft updates focusing on patterns, conventions, critical files, architectural decisions, agent inventory (name, model, purpose), capabilities and tool access, coordination patterns, skill-agent mappings, and model tiering rationale.

Present **all drafts together** in a single output, clearly labeled by file. Then ask the user:

- **Apply all** — Apply all drafted updates
- **Modify** — Specify which file(s) to revise and what to change (max 3 revision cycles, then must Apply or Skip)
- **Skip all** — Skip all documentation updates

If approved, apply updates using Edit tool (existing files) or Write tool (new files).

#### Action: Keep Insights in Memory

- Present a condensed **Codebase Quick Reference** inline in the conversation:
  - **Architecture** — 1-2 sentence summary of how the codebase is structured
  - **Key Files** — 3-5 most critical files with one-line descriptions
  - **Conventions** — Important patterns and naming conventions
  - **Tech Stack** — Core technologies and frameworks
  - **Watch Out For** — Top risks or complexity hotspots
- No file is written — this summary stays in conversation context for reference during the session

### Step 3: Actionable Insights Follow-up

**Condition:** This step always executes after Step 2 completes. The Phase 2 analysis is available in conversation context regardless of whether a report file was saved.

Ask the user:
- **Address actionable insights** — Fix challenges and implement recommendations from the report
- **Skip** — No further action needed

If the user selects "Skip", proceed to Step 4.

If the user selects "Address actionable insights":

**Step 3a: Extract actionable items from the report**

Parse the Phase 2 report (in conversation context) to extract items from:
- **Challenges & Risks** table rows — title from Challenge column, severity from Severity column, description from Impact column
- **Recommendations** section — each numbered item with an _(addresses: {Challenge name})_ citation; inherit the cited challenge's severity (High/Medium/Low). If no citation is present, default to Medium.
- **Other findings** with concrete fixes — default to Low severity

If no actionable items are found, inform the user and skip to Step 4.

**Step 3b: Present severity-ranked item list**

- Load reference template from `references/actionable-insights-template.md`
- Present items sorted High → Medium → Low, each showing:
  - Title
  - Severity (High / Medium / Low)
  - Source section (Challenges & Risks, Recommendations, or Other)
  - Brief description
- Ask the user to select which items to address (multiple selections allowed)
- If no items selected, skip to Step 4

**Step 3c: Process each selected item in priority order (High → Medium → Low)**

For each item:

1. **Assess complexity:**
   - **Simple** — Single file, clear fix, localized change
   - **Complex** — Multi-file, architectural impact, requires investigation

2. **Plan the fix:**
   - Simple: Read the target file, propose changes directly
   - Complex (architectural): Spawn a subagent using the code-architect instructions from `../../agents/code-architect.md` with context: the item title, severity, description, the relevant report section text (copy the specific Challenges/Recommendations entry), and any files or components mentioned. The subagent designs the fix and returns a proposal.
   - Complex (needs investigation): Spawn a subagent using the code-explorer instructions from `../../agents/code-explorer.md` with context: the item title, description, suspected files/components, and what needs investigation. The subagent explores and returns findings for you to formulate a fix proposal.
   - If a subagent launch fails, fall back to direct investigation using Read/Glob/Grep and propose a simpler fix based on available information.

3. **Present proposal:** Show files to modify, specific changes, and rationale

4. **User approval** — ask the user:
   - **Apply** — Execute changes with Edit/Write tools, confirm success
   - **Skip** — Record the skip, move to next item
   - **Modify** — User describes adjustments, re-propose the fix (max 3 revision cycles, then must Apply or Skip)

**Step 3d: Summarize results**

Present a summary covering:
- Items addressed (with list of files modified per item)
- Items skipped
- Total files modified table

### Step 4: Complete the workflow

Summarize which actions were executed and confirm the workflow is complete.

---

## Error Handling

### General

If any phase fails:
1. Explain what went wrong
2. Ask the user how to proceed:
   - Retry the phase
   - Skip to next phase (with partial results)
   - Abort the workflow

### Documentation Update Failures (Step 2c)

If an Edit or Write call fails when applying documentation updates:
1. Retry the operation once
2. If still failing, present the drafted content to the user inline and suggest they apply it manually
3. Continue with the remaining selected files

### Subagent Failures (Step 3c)

If a code-architect or code-explorer subagent fails during actionable insight processing:
1. Fall back to direct investigation using Read, Glob, and Grep
2. Propose a simpler fix based on available information
3. If the item is too complex to address without subagent assistance, inform the user and offer to skip

---

## Subagent Coordination

Exploration and synthesis coordination is handled by the `deep-analysis` skill in Phase 1, which uses a hub-and-spoke subagent model. The orchestrator performs reconnaissance, composes a team plan (auto-approved when invoked by another skill), spawns subagents for parallel exploration and synthesis, and manages their lifecycle. See the deep-analysis skill for subagent setup, approval flow, model tiers, and failure handling details.

For actionable insight processing in Phase 3, subagents are spawned individually as needed:
- **code-architect** subagent (from `../../agents/code-architect.md`) -- designs fixes for architectural issues
- **code-explorer** subagent (from `../../agents/code-explorer.md`) -- investigates complex issues requiring deeper exploration

---

## Additional Resources

- For report structure, see [references/report-template.md](references/report-template.md)
- For actionable insights format, see [references/actionable-insights-template.md](references/actionable-insights-template.md)
