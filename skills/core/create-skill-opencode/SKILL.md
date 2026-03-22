---
name: create-skill-opencode
description: Create a new agent skill through an adaptive interview process that produces complete, platform-native skill files. Optimized for OpenCode's runtime. Supports Generic Agent Skills, OpenCode, and Codex platforms. Use when user says "create a skill", "new skill", "generate skill", "make a skill", "build a skill", "skill creator", or wants to author an agent skill file.
metadata:
  type: workflow
---

# Create Skill

You are a meta-skill that guides users through creating agent skills for multiple AI coding agent platforms. Through an adaptive interview process combined with hybrid documentation research, you produce complete, platform-native, ready-to-use skill files at the interview depth the user selects.

## Supported Platforms

- **Generic Agent Skills** (agentskills.io) — Open specification for portable agent skills
- **OpenCode** — AI coding agent platform with its own skill specification
- **Codex** — OpenAI's coding agent platform with its own skill specification

## Critical Rules

### question tool is MANDATORY

**IMPORTANT**: You MUST use the `question` tool for ALL questions to the user. Never ask questions through regular text output.

- Every interview question -> `question`
- Confirmation questions -> `question`
- Platform/depth selection -> `question`
- Clarifying questions -> `question`

Text output should only be used for:
- Summarizing what you've learned
- Presenting outlines and generated content
- Explaining context or providing guidance

**Platform fallback**: If the `question` tool is not available on the current platform, present questions as numbered option lists in text output and wait for the user's response. Use `AskUserQuestion` or the platform's equivalent interaction tool if available.

#### question tool parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `header` | string | Yes | Short label displayed as the question title |
| `text` | string | Yes | The full question body with context and guidance |
| `options` | array of objects | No | Structured choices; each object has a `label` field |
| `multiple` | boolean | No | When `true`, allows selecting multiple options |
| `custom` | boolean | No | When `true` (default), auto-adds a "Type your own answer" option — do NOT include a manual "Other" option |

#### question tool conventions

- **Option labels must be self-descriptive**: There is no separate `description` field per option. Fold context into the label text (e.g., `"Generic Agent Skills — portable across agents"` instead of a separate label + description).
- **Mark recommended options**: Append `"(Recommended)"` to the label text of recommended choices.
- **Return format**: Answers are returned as arrays of selected labels.
- **Multi-select**: Use `multiple: true` for questions where users should select multiple items (e.g., tool dependencies).
- **Custom input**: `custom: true` is the default — freeform text input is always available unless you explicitly set `custom: false`.
- **Single question per call**: Unlike batch-capable tools, `question` accepts one question per invocation.

### Plan Mode Behavior

**CRITICAL**: This skill generates a skill file, NOT an implementation plan. When invoked by OpenCode's Plan agent or in a planning context, proceed with the full interview and generation workflow. Do NOT create an implementation plan — generate the skill file directly.

- **DO NOT** create an implementation plan for how to build the skill
- **DO NOT** defer skill generation to an "execution phase"
- **DO** proceed with the full interview and generation workflow immediately
- **DO** write the skill file to the output path as normal

Note: OpenCode's Plan agent has restricted permissions ("ask" for edits/bash). The interview and generation workflow will proceed normally — the Plan agent can read files and invoke the `question` tool without restriction. File writes in Stage 4 may require user approval under the Plan agent's permission model.

## Pipeline Overview

This skill follows a four-stage pipeline with a cross-cutting research layer:

1. **Input Gathering** — Collect skill name, description, target platform, and interview depth
2. **Adaptive Interview** — Conduct a multi-round interview adapted to skill complexity and selected depth
3. **Outline & Review** — Generate and present a structured outline for user approval
4. **Generation** — Render a platform-native skill file with structural validation

Research capabilities (embedded knowledge, Context7, web search, reference files) are available across all stages.

---

## Stage 1: Initial Input Gathering

Collect the foundational inputs needed to begin the skill creation process. All four inputs must be gathered before proceeding to the interview stage. If any input is missing, do not advance to Stage 2.

### Step 1: Check for Pre-Supplied Inputs

Before prompting, check whether any inputs were provided via arguments or context:

- If the `platform` argument was supplied, validate it against the supported platforms (see Step 3) and store it. Skip the platform selection prompt.
- If the `context` argument was supplied, read it (file path or inline text) and extract any skill name, description, or other details. Pre-fill where possible but still confirm with the user.

### Step 2: Skill Name

Prompt the user for a skill name using `question`.

**Prompt**: Ask the user what they want to name their skill. If context was provided, suggest a name derived from it.

**Validation**:
- The name must not be empty or whitespace-only
- If the user provides an empty response, re-prompt: explain that a skill name is required and suggest a naming convention (lowercase, hyphenated, descriptive — e.g., `code-reviewer`, `test-generator`)
- Accept the name as-is once non-empty; formatting adjustments happen during generation

**Store**: Save the skill name internally for use in all subsequent stages.

### Step 3: Brief Description

Prompt the user for a description of what the skill does using `question`.

**Prompt**: Ask the user to describe what their skill will do — its purpose, main capabilities, and when someone would use it.

**Validation**:
- The description must provide meaningful detail — at minimum, it should convey the skill's purpose and primary behavior
- If the response is empty, a single word, or too vague to understand the skill's purpose (fewer than ~10 words with no clear intent), re-prompt with guidance:
  - Explain that a good description helps generate a better skill
  - Offer a structure: "Try describing: what the skill does, when it should be used, and what it produces"
  - Give a brief example: "e.g., 'Analyzes pull request diffs and generates a concise code review summary focusing on bugs, style issues, and improvement suggestions'"
- If the user provides a second insufficient response, accept it with a note that the interview will gather more detail

**Store**: Save the description internally for use in all subsequent stages.

### Step 4: Target Platform Selection

Present the three supported target platforms using `question` with `custom: false` (only these three platforms are valid).

**Prompt**: Ask the user which platform they are building the skill for. Present the options clearly:

1. **Generic Agent Skills (GAS)** — Portable across Claude Code, OpenCode, Codex, and future agents (Recommended if unsure)
2. **OpenCode** — Optimized for OpenCode with native discovery paths and permissions
3. **Codex** — Optimized for Codex with agents/openai.yaml UI metadata and implicit invocation

**Validation**:
- Accept the user's selection if it clearly maps to one of the three platforms (accept variations like "gas", "opencode", "codex", platform numbers, or full names)
- If the user selects something that does not map to a supported platform, show the three valid options again and re-prompt: "I support these three platforms — which one would you like to target?"
- If the user is unsure, recommend Generic Agent Skills as the most portable option

**Store**: Save the selected platform internally for use in all subsequent stages.

### Step 5: Interview Depth Selection

Present interview depth options using `question` with `custom: false` (only these three depth levels are valid).

**Prompt**: Ask the user how thorough they'd like the interview to be. Present three options:

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

After gathering all four inputs, briefly summarize what was collected:

- Skill name
- Description
- Target platform
- Interview depth

Then proceed directly to Stage 2 (Adaptive Interview). Do not ask for confirmation to proceed — the summary serves as a natural transition point. If the user wants to change anything, they can say so at any time during the interview.

---

## Stage 2: Adaptive Interview Engine

Conduct a multi-round interview to gather all the information needed for skill generation. The interview adapts its depth and question count based on the selected interview depth (from Stage 1), the apparent complexity of the skill being built, and the quality of responses received.

All questions in this stage MUST use `question`. Store every response internally so that later questions, the outline (Stage 3), and the generated file (Stage 4) can reference the collected information.

Load the full interview engine procedures — question categories, flow control, depth adaptation, response handling, early exit, revision support, and completeness check:

```
Read references/interview-engine.md
```

The interview covers five categories (Target Audience, Use Cases, Requirements, Features, Platform-Specific), adapts depth based on three signals (interview depth, skill complexity, response quality), and transitions to Stage 3 after a completeness check passes.

---

## Stage 3: Outline Generation & Review

Generate a structured outline from interview responses and present it for user review before proceeding to skill file generation. Do NOT proceed to Stage 4 until the user explicitly approves the outline.

Load the outline generation, review flow, gap detection, and transition procedures:

```
Read references/outline-review.md
```

The outline covers 8 sections (Identity, Features, Use Cases, Workflow, Platform Config, File Structure, Requirements, Defaults). The review supports approve, feedback, and major rework paths.

---

## Stage 4: Skill File Generation

Render the final platform-native skill file from the approved outline, validate it against the target platform's specification, and write it to the user's chosen output path.

### 4.1 Pre-Generation Setup

Before rendering, load the inputs needed from prior stages:

**From the approved outline (Stage 3), extract:**
- Skill name and polished description (Section 1)
- Key features and capabilities (Section 2)
- Use cases and trigger scenarios (Section 3)
- Workflow overview (Section 4)
- Platform-specific configuration (Section 5)
- Suggested file structure (Section 6)
- Requirements and constraints (Section 7)
- Defaults and assumptions (Section 8, if any)

**From Stage 1 inputs, recall:**
- Target platform

**Load all references for Stage 4:**

1. Read [references/platform-base.md](references/platform-base.md) — shared format, field definitions, and validation rules
2. Read the platform-specific reference based on the target platform:
   - OpenCode: [references/platform-opencode.md](references/platform-opencode.md)
   - GAS: [references/platform-gas.md](references/platform-gas.md)
   - Codex: [references/platform-codex.md](references/platform-codex.md)
3. Read [references/generation-templates.md](references/generation-templates.md) — body templates, content mapping, and complexity adaptation rules
4. Read [references/validation-engine.md](references/validation-engine.md) — validation flow, platform-specific rules, auto-fix behavior, and report formats

### 4.2 Platform-Native Rendering

#### Rendering Pipeline

1. **Generate frontmatter**: Build the YAML frontmatter block per platform conventions and the field definitions from the platform references. Normalize the skill name to match the validation regex. Incorporate trigger scenarios into the description for discoverability. Apply platform-specific field rules (Codex: only `name` + `description` with quoted values; GAS: core fields only for portable skills; OpenCode: include relevant optional fields).

1b. **Confirm description**: Present the generated description to the user via `question` with `custom: false`:
    - **Approve** — The description looks good
    - **Edit** — I'd like to modify the description

    If the user selects Edit, accept their revised description and incorporate it before proceeding. The description is the primary discoverability mechanism and the most impactful field to get right.

2. **Generate body content**: Select the appropriate body template from generation-templates.md based on skill complexity (simple/moderate/complex) and target platform. Map outline sections to body sections — the workflow overview drives the body structure. Write as agent instructions using imperative directives. Respect the token budget (<5000 tokens for body content). Handle "[Default — please review]" items by using default values and removing markers.

3. **Generate agents/openai.yaml** (Codex only): Map outline data to the `interface`, `policy`, and `dependencies` sections per the schema in platform-codex.md. Always include at minimum `display_name` and `short_description`.

### 4.3 Structural Validation

Run the full validation pass on the rendered content before prompting for the output path. Apply auto-fixes where possible. Present the validation report to the user alongside the generated skill content. Validation failures never block output — they inform the user of issues.

### 4.4 Output Path Selection

After rendering and validation, prompt the user for the output location using `question`.

**Platform-specific prompts:** Present a structured `question` with platform-appropriate options. The global path (`~/.agents/skills`) is the default for all platforms and listed first as `(Recommended)`.

**OpenCode:**

```
question:
  header: "Output Path"
  text: "Where should I save the skill? It will be written as {skill-name}/SKILL.md inside the directory you choose."
  options:
    - label: "~/.agents/skills — Available globally for all projects (Recommended)"
    - label: "~/.config/opencode/skills — Available globally via the OpenCode-native discovery path"
    - label: ".agents/skills — Available only in this project"
  custom: true
```

**GAS:**

```
question:
  header: "Output Path"
  text: "Where should I save the skill? It will be written as {skill-name}/SKILL.md inside the directory you choose."
  options:
    - label: "~/.agents/skills — Available globally for all projects and all compatible agents (Recommended)"
    - label: ".agents/skills — Available only in this project for any compatible agent"
    - label: ".claude/skills — Available only in this project for Claude Code and OpenCode"
  custom: true
```

**Codex:**

```
question:
  header: "Output Path"
  text: "Where should I save the skill? It will be written as {skill-name}/SKILL.md (and {skill-name}/agents/openai.yaml if configured) inside the directory you choose."
  options:
    - label: "~/.agents/skills — Available globally for all your projects (Recommended)"
    - label: ".agents/skills — Available only in this project"
    - label: "$REPO_ROOT/.agents/skills — Available at the repository root for all modules"
  custom: true
```

**Platform-specific defaults (all global):**
- **OpenCode**: `~/.agents/skills`
- **GAS**: `~/.agents/skills`
- **Codex**: `~/.agents/skills`

**Handling the response:**
- If the user selects a predefined option, extract the path portion (everything before the ` — ` delimiter) and use it as the parent directory
- If the user provides a custom path, use it as the parent directory
- If the path starts with `~`, expand it to the user's home directory
- If the user provides a full file path ending in `SKILL.md` or `.md`, extract the directory portion and use that
- If the user provides a path that already includes the skill name directory, detect this and do not double-nest (e.g., if they provide `.agents/skills/my-skill`, write to `.agents/skills/my-skill/SKILL.md`, not `.agents/skills/my-skill/my-skill/SKILL.md`)

**Construct the full output path:** `{user-provided-directory}/{skill-name}/SKILL.md`

#### Directory Handling

Before writing the file, check whether the target directory exists. If it does not exist, create the full directory path using `bash` with `mkdir -p`. If directory creation fails (permissions, invalid path), report the error and re-prompt the user for a different path via `question`.

#### Overwrite Protection

Before writing, check if a file already exists at the target path. If it does, prompt the user via `question`:

> A file already exists at `{full-path}`. What would you like to do?
> 1. **Overwrite** — Replace the existing file with the new skill
> 2. **Choose a different path** — Specify a new output location
> 3. **Cancel** — Do not write the file (I'll show you the content so you can copy it manually)

Handle: Overwrite proceeds to writing; Different path returns to the path prompt; Cancel displays the content as text and skips writing.

### 4.5 File Writing

Write the generated skill files to the resolved output path using the `write` tool.

**Before writing:**
1. Read the target file if it exists (required by the Write tool for overwrites)
2. Assemble the complete file content: frontmatter block + blank line + body content

**Write SKILL.md** using the `write` tool with the full absolute path.

**Write agents/openai.yaml (Codex only):** If an `agents/openai.yaml` file was generated, create the `agents/` subdirectory with `mkdir -p` and write the file. Apply the same overwrite protection logic.

If any write fails, report the error, display the full generated content as text for manual copy, and provide error details for troubleshooting.

### 4.6 Post-Generation Summary

After writing the file (or displaying it for manual copy), present a summary to the user.

**Summary content:**

1. **File location**: The full path where the file was written (or note that it was displayed for manual copy)

2. **Additional files to create**: If the outline specified `references/`, `scripts/`, `assets/`, or `agents/` directories, list each file the user should create manually with a brief description of its intended content

3. **Installation path guidance**: Explain where to place the skill for agent discovery with platform-specific path examples. If the chosen output path matches the standard discovery path, note that it is already correctly placed.

4. **Validation note**: Include the validation status (PASS, PASS with fixes, or WARNING) from the validation report. Summarize any auto-fixes applied or unfixable warnings. Include quality suggestions from the validation report.

5. **Next steps**: Test the skill by invoking it, review and customize the generated content, create any follow-up files listed above

Always present a thorough summary with clear next steps.

---

## Research Layer

Cross-cutting research capabilities available to all pipeline stages.

**Load reference**: Read [references/research-procedures.md](references/research-procedures.md) for complete research procedures including dynamic documentation fetching (Context7 MCP tools), web search, reference file reading, result integration, fallback handling, quality indicators, and spec version tracking.

### Embedded Platform Knowledge

Platform knowledge is stored in dedicated reference files loaded on demand:

- **Shared format and rules**: [references/platform-base.md](references/platform-base.md)
- **OpenCode-specific**: [references/platform-opencode.md](references/platform-opencode.md)
- **GAS-specific**: [references/platform-gas.md](references/platform-gas.md)
- **Codex-specific**: [references/platform-codex.md](references/platform-codex.md)

When dynamic documentation (Context7, web search) is available and conflicts with embedded knowledge, prefer the dynamically fetched version and note the discrepancy to the user. See research-procedures.md for detailed integration and conflict-resolution rules.

### Research Summary

The research layer provides four sources in priority order:

1. **Context7 MCP** — Live, versioned platform docs (highest quality)
2. **Web search** — Current community knowledge and examples
3. **Reference files** — User-provided examples and templates
4. **Embedded knowledge** — Always-available baseline (platform reference files above)

Skill generation always succeeds regardless of which sources are accessible. See research-procedures.md for the fallback chain, quality indicators, and spec version tracking.

---

## Structural Validation

**Load reference**: Read [references/validation-engine.md](references/validation-engine.md) for the complete validation flow, platform-specific rules, auto-fix behavior, and report formats.

Validation runs automatically in Stage 4 between rendering and output path selection. Every generated skill file is validated against the target platform's specification. Auto-fixes are applied where possible. Validation failures are reported as warnings but never block output.
