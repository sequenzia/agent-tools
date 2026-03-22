---
name: create-skill
description: >-
  Create a new Generic Agent Skill (GAS) through an adaptive interview
  process that produces a complete, portable SKILL.md file following the
  agentskills.io specification. Use when user says "create a skill",
  "new skill", "generate skill", "make a skill", "build a skill",
  "skill creator", or wants to author a portable agent skill file.
metadata:
  type: workflow
---

# Create Skill

You are a meta-skill that guides users through creating portable Generic Agent Skills (GAS) for any AI coding agent platform. Through an adaptive interview process combined with hybrid documentation research, you produce complete, ready-to-use skill files that follow the agentskills.io specification.

## Critical Rules

### User Interaction

Ask all interview questions, confirmations, and selections directly to the user. Present options as numbered lists when offering choices. Wait for the user's response before proceeding. Use whatever interaction mechanism is available on the current platform.

Text output should only be used for:
- Summarizing what you've learned
- Presenting outlines and generated content
- Explaining context or providing guidance

## Pipeline Overview

This skill follows a four-stage pipeline with a cross-cutting research layer:

1. **Input Gathering** — Collect skill name, description, and interview depth
2. **Adaptive Interview** — Conduct a multi-round interview adapted to skill complexity and selected depth
3. **Outline & Review** — Generate and present a structured outline for user approval
4. **Generation** — Render a portable GAS skill file with structural validation

Research capabilities (embedded knowledge, Context7, web search, reference files) are available across all stages.

---

## Stage 1: Initial Input Gathering

Collect the foundational inputs needed to begin the skill creation process. All three inputs must be gathered before proceeding to the interview stage. If any input is missing, do not advance to Stage 2.

### Step 1: Check for Pre-Supplied Inputs

Before prompting, check whether any inputs were provided via arguments or context:

- If a `context` argument was supplied, read it (file path or inline text) and extract any skill name, description, or other details. Pre-fill where possible but still confirm with the user.

### Step 2: Skill Name

Ask the user what they want to name their skill. If context was provided, suggest a name derived from it.

**Validation**:
- The name must not be empty or whitespace-only
- If the user provides an empty response, re-prompt: explain that a skill name is required and suggest a naming convention (lowercase, hyphenated, descriptive — e.g., `code-reviewer`, `test-generator`)
- Accept the name as-is once non-empty; formatting adjustments happen during generation

**Store**: Save the skill name internally for use in all subsequent stages.

### Step 3: Brief Description

Ask the user to describe what their skill will do — its purpose, main capabilities, and when someone would use it.

**Validation**:
- The description must provide meaningful detail — at minimum, it should convey the skill's purpose and primary behavior
- If the response is empty, a single word, or too vague to understand the skill's purpose (fewer than ~10 words with no clear intent), re-prompt with guidance:
  - Explain that a good description helps generate a better skill
  - Offer a structure: "Try describing: what the skill does, when it should be used, and what it produces"
  - Give a brief example: "e.g., 'Analyzes pull request diffs and generates a concise code review summary focusing on bugs, style issues, and improvement suggestions'"
- If the user provides a second insufficient response, accept it with a note that the interview will gather more detail

**Store**: Save the description internally for use in all subsequent stages.

### Step 4: Interview Depth Selection

Present interview depth options to the user (only these three depth levels are valid):

1. **High-Level Overview** — Minimal questions, cover the essentials, generate quickly
2. **Detailed** — Standard interview coverage with follow-up questions where needed (Recommended)
3. **Deep Dive** — Thorough exploration of every category, edge cases, and advanced configurations

**Validation**:
- Accept the user's selection if it clearly maps to one of the three levels
- If unclear, default to Detailed and inform the user they can request more or less depth at any time

**Store**: Save the interview depth internally. This value controls how many questions are asked and how deeply topics are explored in Stage 2:

**How interview depth affects the interview:**

- **High-Level Overview**: Cover only essential categories. Skip optional topics and accept reasonable defaults where possible. Ask fewer follow-up questions. Aim for the lower end of the round-count range. When a topic has a sensible default, use it rather than asking.

- **Detailed**: Cover all categories at moderate depth. Ask follow-up questions when answers need clarification. Use reasonable defaults for minor details but confirm key decisions. Target the middle of the round-count range.

- **Deep Dive**: Cover all categories thoroughly. Probe for edge cases, error handling details, and advanced configurations. Explore alternative approaches and trade-offs. Ask about secondary use cases and extensibility. Aim for the upper end of the round-count range.

### Pre-Interview Confirmation

After gathering all three inputs, briefly summarize what was collected:

- Skill name
- Description
- Interview depth

Then proceed directly to Stage 2 (Adaptive Interview). Do not ask for confirmation to proceed — the summary serves as a natural transition point. If the user wants to change anything, they can say so at any time during the interview.

---

## Stage 2: Adaptive Interview Engine

Conduct a multi-round interview to gather all the information needed for skill generation. The interview adapts its depth and question count based on the selected interview depth (from Stage 1), the apparent complexity of the skill being built, and the quality of responses received.

Store every response internally so that later questions, the outline (Stage 3), and the generated file (Stage 4) can reference the collected information.

Load the full interview engine procedures — question categories, flow control, depth adaptation, response handling, early exit, revision support, and completeness check:

```
Read references/interview-engine.md
```

The interview covers five categories (Target Audience, Use Cases, Requirements, Features, GAS Skill Considerations), adapts depth based on three signals (interview depth, skill complexity, response quality), and transitions to Stage 3 after a completeness check passes.

---

## Stage 3: Outline Generation & Review

Generate a structured outline from interview responses and present it for user review before proceeding to skill file generation. Do NOT proceed to Stage 4 until the user explicitly approves the outline.

Load the outline generation, review flow, gap detection, and transition procedures:

```
Read references/outline-review.md
```

The outline covers 8 sections (Identity, Features, Use Cases, Workflow, GAS Config, File Structure, Requirements, Defaults). The review supports approve, feedback, and major rework paths.

---

## Stage 4: Skill File Generation

Render the final GAS skill file from the approved outline, validate it against the specification, and write it to the user's chosen output path.

### 4.1 Pre-Generation Setup

Before rendering, load the inputs needed from prior stages:

**From the approved outline (Stage 3), extract:**
- Skill name and polished description (Section 1)
- Key features and capabilities (Section 2)
- Use cases and trigger scenarios (Section 3)
- Workflow overview (Section 4)
- GAS configuration (Section 5)
- Suggested file structure (Section 6)
- Requirements and constraints (Section 7)
- Defaults and assumptions (Section 8, if any)

**Load all references for Stage 4:**

1. Read [references/platform-knowledge.md](references/platform-knowledge.md) — GAS spec, field definitions, portability rules, and validation checklists
2. Read [references/generation-engine.md](references/generation-engine.md) — body templates, content mapping, portability rendering rules, and complexity adaptation
3. Read [references/validation-engine.md](references/validation-engine.md) — validation flow, rules, auto-fix behavior, and report formats

### 4.2 Skill Rendering

#### Rendering Pipeline

1. **Generate frontmatter**: Build the YAML frontmatter block per GAS conventions and the field definitions from platform-knowledge.md. Normalize the skill name to match the validation regex. Incorporate trigger scenarios into the description for discoverability. Use only core GAS fields — no extension fields.

1b. **Confirm description**: Present the generated description to the user:
    - **Approve** — The description looks good
    - **Edit** — I'd like to modify the description

    If the user selects Edit, accept their revised description and incorporate it before proceeding. The description is the primary discoverability mechanism and the most impactful field to get right.

2. **Generate body content**: Select the appropriate body template from generation-engine.md based on skill complexity (simple/moderate/complex). Map outline sections to body sections — the workflow overview drives the body structure. Write as agent instructions using imperative directives. Use generic tool references for portability. Respect the token budget (<5000 tokens for body content). Handle "[Default — please review]" items by using default values and removing markers.

### 4.3 Structural Validation

Run the full validation pass on the rendered content before prompting for the output path. Apply auto-fixes where possible. Present the validation report to the user alongside the generated skill content. Validation failures never block output — they inform the user of issues.

### 4.4 Output Path Selection

After rendering and validation, ask the user where to save the skill file.

Present the user with output path options:

1. `~/.agents/skills` — Available globally for all projects and all compatible agents (Recommended)
2. `.agents/skills` — Available only in this project for any compatible agent
3. A custom path

**Handling the response:**
- If the user selects a predefined option, extract the path portion (everything before the ` — ` delimiter) and use it as the parent directory
- If the user provides a custom path, use it as the parent directory
- If the path starts with `~`, expand it to the user's home directory
- If the user provides a full file path ending in `SKILL.md` or `.md`, extract the directory portion and use that
- If the user provides a path that already includes the skill name directory, detect this and do not double-nest (e.g., if they provide `.agents/skills/my-skill`, write to `.agents/skills/my-skill/SKILL.md`, not `.agents/skills/my-skill/my-skill/SKILL.md`)

**Construct the full output path:** `{user-provided-directory}/{skill-name}/SKILL.md`

#### Directory Handling

Before writing the file, check whether the target directory exists. If it does not exist, create the full directory path. If directory creation fails (permissions, invalid path), report the error and re-prompt the user for a different path.

#### Overwrite Protection

Before writing, check if a file already exists at the target path. If it does, ask the user:

> A file already exists at `{full-path}`. What would you like to do?
> 1. **Overwrite** — Replace the existing file with the new skill
> 2. **Choose a different path** — Specify a new output location
> 3. **Cancel** — Do not write the file (I'll show you the content so you can copy it manually)

Handle: Overwrite proceeds to writing; Different path returns to the path prompt; Cancel displays the content as text and skips writing.

### 4.5 File Writing

Write the generated skill file to the resolved output path.

**Before writing:**
1. Read the target file if it exists (required for overwrites on some platforms)
2. Assemble the complete file content: frontmatter block + blank line + body content

**Write SKILL.md** to the full absolute path.

If the write fails, report the error, display the full generated content as text for manual copy, and provide error details for troubleshooting.

### 4.6 Post-Generation Summary

After writing the file (or displaying it for manual copy), present a summary to the user.

**Summary content:**

1. **File location**: The full path where the file was written (or note that it was displayed for manual copy)

2. **Additional files to create**: If the outline specified `references/`, `scripts/`, `assets/` directories, list each file the user should create manually with a brief description of its intended content

3. **Installation path guidance**: Explain where to place the skill for agent discovery. If the chosen output path matches the standard discovery path (`.agents/skills/`), note that it is already correctly placed. Otherwise, suggest the recommended path for broadest compatibility.

4. **Validation note**: Include the validation status (PASS, PASS with fixes, or WARNING) from the validation report. Summarize any auto-fixes applied or unfixable warnings. Include quality suggestions from the validation report.

5. **Research sources**: List which research sources were used during generation (see research-procedures.md > Quality Indicators). Include the research quality label and the embedded knowledge `spec_last_verified` date.

6. **Next steps**: Test the skill by invoking it, review and customize the generated content, create any follow-up files listed above

Always present a thorough summary with clear next steps.

---

## Research Layer

Cross-cutting research capabilities available to all pipeline stages.

**Load reference**: Read [references/research-procedures.md](references/research-procedures.md) for complete research procedures including dynamic documentation fetching (Context7 MCP tools), web search, reference file reading, result integration, fallback handling, quality indicators, and spec version tracking.

### Embedded Platform Knowledge

GAS specification knowledge is stored in a dedicated reference file loaded on demand:

- **GAS spec and rules**: [references/platform-knowledge.md](references/platform-knowledge.md)

When dynamic documentation (Context7, web search) is available and conflicts with embedded knowledge, prefer the dynamically fetched version and note the discrepancy to the user. See research-procedures.md for detailed integration and conflict-resolution rules.

### Research Summary

The research layer provides four sources in priority order:

1. **Context7 MCP** — Live, versioned GAS docs (highest quality)
2. **Web search** — Current community knowledge and examples
3. **Reference files** — User-provided examples and templates
4. **Embedded knowledge** — Always-available baseline (platform-knowledge.md)

Skill generation always succeeds regardless of which sources are accessible. See research-procedures.md for the fallback chain, quality indicators, and spec version tracking.

---

## Structural Validation

**Load reference**: Read [references/validation-engine.md](references/validation-engine.md) for the complete validation flow, rules, auto-fix behavior, and report formats.

Validation runs automatically in Stage 4 between rendering and output path selection. Every generated skill file is validated against the GAS specification. Auto-fixes are applied where possible. Validation failures are reported as warnings but never block output.
