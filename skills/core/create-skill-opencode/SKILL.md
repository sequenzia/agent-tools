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

### 2.1 Question Categories

The interview must cover these five topic areas. Not every category needs a dedicated question — combine or skip topics when previous answers already provide the information.

#### Category A: Target Audience

Who will use the skill and in what context?

- **Who is the primary user** — individual developer, team, open-source community, or internal tooling?
- **What is their skill level** — beginner developers, senior engineers, mixed?
- **What environment** — specific language/framework, general-purpose, CI/CD pipeline?

*Prompt example:*
> Who will be using this skill and in what context?
> 1. Just me, for my own projects
> 2. My team
> 3. The open-source community / public sharing
>
> Feel free to describe the audience and usage context in your own words instead.

#### Category B: Use Cases and Workflows

What will the skill actually do, step by step?

- **Primary use case** — the single most important thing the skill does
- **Secondary use cases** — additional capabilities or modes
- **Trigger scenarios** — when should the agent invoke this skill? (critical for description quality)
- **Workflow shape** — single-shot prompt, multi-step pipeline, conversational loop, or hybrid?
- **Inputs and outputs** — what does the skill receive and what does it produce?

*Prompt example:*
> How does your skill work? Pick the closest pattern, or describe the workflow in your own words:
> 1. **Single action** — The agent does one thing and returns a result (e.g., "format this code")
> 2. **Multi-step pipeline** — Several steps run in sequence (e.g., "read file, analyze, generate report")
> 3. **Conversational** — Back-and-forth with the user to refine a result (e.g., "interview then generate")
> 4. **Hybrid** — Combination of the above
>
> What are the main steps, inputs, and expected output?

#### Category C: Requirements and Constraints

What rules or limitations apply?

- **Hard requirements** — things the skill MUST do or MUST NOT do
- **Tool dependencies** — does it need specific tools (file read/write, web search, terminal access)?
- **Security or safety constraints** — data sensitivity, network access restrictions, permission boundaries
- **Scope boundaries** — what is explicitly out of scope?

*Prompt example:*
> What capabilities does your skill need? Select all that apply, or describe requirements in your own words:
> 1. Read files from the project
> 2. Write or create files
> 3. Run terminal commands
> 4. Search the web
> 5. Ask the user questions during execution
> 6. None of the above / not sure
>
> Also mention any hard constraints, scope boundaries, or security considerations.

#### Category D: Key Features and Capabilities

What specific features make this skill valuable?

- **Core features** — the minimum set of capabilities for the skill to be useful
- **Nice-to-have features** — enhancements that add value but are not essential
- **Error handling** — how should the skill behave when things go wrong?
- **Configuration or customization** — does the user need to adjust behavior per invocation?

*Prompt example:*
> What are the core features of this skill? List the must-have capabilities, and optionally any nice-to-have features or error handling considerations.
>
> Start with the single most important thing the skill should accomplish, then add any additional capabilities.

#### Category E: Platform-Specific Considerations

Considerations specific to the selected target platform. **Only ask questions for the platform the user selected in Stage 1.** If the selected platform is not recognized, fall back to the shared questions only (treat as Generic Agent Skills).

##### Shared Questions (All Platforms)

These questions apply regardless of the selected platform:

- Should the skill use `references/` files for progressive disclosure?
- Does it need scripts in `scripts/`?
- Should this skill be available in all projects or just specific ones? (project-local vs global)

##### Platform-Specific Questions

**Load platform reference**: Based on the selected platform, read the corresponding file for platform-specific interview questions:
- OpenCode: [references/platform-opencode.md](references/platform-opencode.md) — see "Interview Questions" section (shared questions are sufficient; no additional questions needed)
- GAS: [references/platform-gas.md](references/platform-gas.md) — see "Interview Questions" section
- Codex: [references/platform-codex.md](references/platform-codex.md) — see "Interview Questions" section

If the selected platform does not match any of the three supported platforms, ask only the shared questions and use Generic Agent Skills conventions as the default.

### 2.2 Interview Flow Control

#### Round Structure

The interview proceeds in rounds. Each round consists of one `question` call and the processing of the user's response. There is no fixed number of rounds — the interview continues until all required information is gathered or the user signals early exit.

**Typical round counts by interview depth and complexity:**

| | Simple Skill | Moderate Skill | Complex Skill |
|---|---|---|---|
| **High-Level Overview** | 2-4 rounds | 3-5 rounds | 4-6 rounds |
| **Detailed** | 3-5 rounds | 5-7 rounds | 6-9 rounds |
| **Deep Dive** | 4-6 rounds | 6-9 rounds | 8-12 rounds |

These are guidelines, not hard limits. End the interview when you have enough information, not when you hit a target number.

#### Question Ordering

Follow this recommended order, but skip or reorder categories based on what was already learned:

1. **Use cases and workflows** (Category B) — Start here because the workflow shape determines which other questions are relevant. The user's description from Stage 1 often provides a starting point.
2. **Target audience** (Category A) — Understanding the audience clarifies requirements and feature scope. Skip if the user's description and use case answers already make the audience obvious.
3. **Key features** (Category D) — Define specific capabilities based on the use cases and audience.
4. **Requirements and constraints** (Category C) — Gather hard rules and tool dependencies after features are established.
5. **Platform-specific considerations** (Category E) — Cover last because platform details are most useful when the skill's content is already understood.

#### Building on Previous Answers

Every question after the first MUST reference context from prior answers. Techniques:

- **Summarize before asking**: "You mentioned the skill will analyze PR diffs and produce review summaries. For that workflow..."
- **Connect to prior context**: "Since this is a multi-step pipeline that reads files and generates reports, which of these tools will it need?"
- **Narrow the scope**: "You've described the core analysis step. Are there any additional features beyond the diff analysis you mentioned?"
- **Reflect understanding**: "So the skill targets senior engineers working in TypeScript monorepos. Given that audience..."

Never ask a question that ignores what the user has already told you.

#### Skipping Irrelevant Questions

Skip questions when the answer is already known or the topic is not applicable:

- If the user described a simple single-action skill, skip questions about multi-step workflows, complex error handling, and reference file splitting
- If the description from Stage 1 was detailed and specific, skip broad "what does it do" questions and move directly to clarifying details
- If the user already mentioned tools or constraints in passing, confirm rather than re-ask: "You mentioned needing file read access — any other tools?"
- If target audience is obvious from context (e.g., "a skill for my personal use"), acknowledge it and skip the audience category entirely

#### Combining Questions

When appropriate, combine related topics into a single prompt to reduce round count:

- Combining related topics (e.g., features + error handling, audience + environment) is always allowed regardless of depth level
- **Interview depth affects scope, not style**: At High-Level Overview, fewer topics need covering so there are naturally fewer opportunities to combine. At Deep Dive, more topics are explored but combining keeps the round count manageable.
- **Rule of thumb**: Never combine more than 2-3 related topics in a single question

### 2.3 Depth Adaptation

The interview dynamically adjusts its depth based on three signals.

#### Signal 1: Interview Depth (from Stage 1)

This is the primary depth control. See Step 5 of Stage 1 for the depth level definitions.

**High-Level Overview adjustments during interview:**
- Cover only essential categories — skip optional topics where reasonable defaults exist
- Accept brief answers without follow-up probing
- Use reasonable defaults for unaddressed topics and confirm at the end
- Aim for the lower end of the round-count range

**Detailed adjustments during interview:**
- Cover all categories at moderate depth
- Ask follow-up questions when answers lack clarity for generation
- Combine related topics when natural (no more than 2 topics per question)

**Deep Dive adjustments during interview:**
- Cover all categories thoroughly — do not skip any topic area
- Probe for edge cases, error handling specifics, and advanced configurations
- Explore alternative approaches and ask about extensibility
- Ask about secondary use cases and configuration options
- Use the upper end of the round-count range

#### Signal 2: Skill Complexity Assessment

Assess complexity dynamically from the user's description (Stage 1) and early interview responses:

**Simple skill indicators:**
- Single action or short pipeline
- No tool dependencies beyond basic file operations
- Narrow, focused purpose (e.g., "format import statements")
- No user interaction during execution

**Complex skill indicators:**
- Multi-step workflow with branching logic
- Multiple tool dependencies (file I/O, web search, terminal, user interaction)
- Broad scope or multiple modes of operation
- Conversational or interactive execution
- Configuration or customization requirements

**Complexity affects depth:**
- **Simple skills**: Shorten the interview. Skip features/capabilities deep-dive if the use case is clear. Skip platform-specific questions if defaults suffice. Aim for the lower end of the round-count range.
- **Complex skills**: Extend the interview. Ask detailed questions about each workflow step. Probe for edge cases and error handling. Cover platform-specific considerations thoroughly. Aim for the upper end of the round-count range.

#### Signal 3: Response Quality

Adjust based on the depth and quality of the user's answers:

- **Detailed, comprehensive responses**: Skip follow-up questions on the same topic. Reduce remaining question count. Consider jumping ahead to later categories.
- **Average responses**: Proceed normally through the question sequence.
- **Terse or vague responses**: Ask targeted follow-up questions (see Section 2.4). Do not move on until the topic has enough detail for generation.

### 2.4 Response Handling

#### Handling Terse Responses

When a user gives a very short or vague answer (a few words, no detail, or "I don't know" variants):

1. **Do not accept and move on.** The information is needed for a quality skill file.
2. **Ask a targeted follow-up** that narrows the scope and makes it easier to answer:
   - Instead of re-asking the same question, rephrase it with specific options
   - Break a broad question into smaller, concrete parts
   - Offer examples the user can react to ("Something like X, Y, or Z?")
3. **If the user remains terse after one follow-up**, accept the response and note the information gap internally. Fill the gap with reasonable defaults during outline generation and flag it for the user's review in Stage 3.

*Example:*
> **Question**: What are the core features of this skill?
> **User**: It reviews code.
> **Follow-up**: Got it — it reviews code. To make the skill effective, I need a bit more detail:
> - What aspects does it review? (bugs, style, security, performance, all of the above?)
> - Does it review entire files or just diffs/changes?
> - What format is the output? (inline comments, summary report, checklist?)

#### Handling Contradictory Answers

When a user provides information that conflicts with something they said earlier:

1. **Flag the inconsistency explicitly** — do not silently pick one answer
2. **Quote both statements** so the user can see the contradiction
3. **Ask for clarification** with a neutral tone — do not assume which answer is correct
4. **Store the clarified answer** and update any derived understanding

*Example:*
> Earlier you said the skill is "for my personal use only," but just now you mentioned it should "work across different team members' environments." Could you clarify — is this skill for your personal projects, or should it support team usage? That will affect how I structure the configuration and documentation.

### 2.5 Early Exit Support

The user may signal they want to wrap up the interview before all categories are covered. Recognize these signals:

- Explicit statements: "that's enough", "let's move on", "I think you have what you need", "skip the rest", "wrap up"
- Impatience indicators: increasingly terse responses after previously detailed ones, responses like "sure", "whatever works", "you decide"

**When early exit is detected:**

1. **Acknowledge the signal**: "Understood — let's move on to the outline."
2. **Perform a quick gap check** (see Section 2.6) before proceeding
3. If critical information is missing, ask at most **one** final consolidated question covering only the gaps: "Before I generate the outline, I just need to know: [specific missing items]"
4. If the user declines the gap-fill question, accept reasonable defaults for all gaps and note them in the outline for review
5. Proceed to Stage 3

### 2.6 Revision Support

The user may want to change a previous answer at any point during the interview.

**Recognizing revision requests:**
- "Actually, I want to change..." / "Go back to..." / "I changed my mind about..."
- "The audience is actually..." (contradicts a stored answer without explicitly saying "change")
- "Wait, not X — I meant Y"

**Handling revisions:**

1. **Acknowledge the change**: "Got it — I've updated [topic] from [old value] to [new value]."
2. **Update the stored answer** internally
3. **Assess cascade impact**: If the changed answer affects subsequent questions or answers (e.g., changing from simple to complex skill), re-evaluate any derived decisions but do NOT re-ask questions whose answers are still valid
4. **Continue from the current point** — do not restart the interview
5. If the revision changes the skill's complexity classification, adjust depth for remaining questions accordingly

### 2.7 Completeness Check

Before transitioning to Stage 3, verify that enough information has been collected to generate a meaningful outline. Walk through this checklist internally (do not present it to the user):

**Required information (must have at least a basic answer or reasonable default):**
- [ ] Primary use case / what the skill does (Category B)
- [ ] Workflow shape — single-shot, multi-step, conversational (Category B)
- [ ] Core inputs and outputs (Category B)
- [ ] At least one core feature or capability (Category D)
- [ ] Target platform considerations addressed or defaults acceptable (Category E)
- [ ] For Codex: `agents/openai.yaml` decisions made or defaults acceptable (invocation policy, UI metadata)

**Recommended information (improves quality but can use defaults):**
- [ ] Target audience identified (Category A)
- [ ] Trigger scenarios defined — when should the agent invoke this skill? (Category B)
- [ ] Tool dependencies identified (Category C)
- [ ] Hard constraints or scope boundaries noted (Category C)
- [ ] Error handling approach (Category D)
- [ ] For GAS: Portability scope decided (cross-agent vs single target) (Category E)
- [ ] For Codex: MCP dependencies identified if applicable (Category E)
- [ ] For Codex: Description optimized for implicit invocation matching (Category E)

**If required information is missing:**
- Ask up to 2 targeted questions to fill the gaps
- If the user has signaled early exit, fill gaps with reasonable defaults and flag them in the Stage 3 outline with a note: "[Default — please review]"

**If recommended information is missing:**
- Fill with reasonable defaults derived from other answers
- Note the defaults in the outline so the user can adjust during Stage 3

**Transition to Stage 3:**
Once the completeness check passes, summarize the collected information briefly (3-5 sentences covering the skill's purpose, workflow, key features, and any notable decisions) and proceed directly to Stage 3. Do not ask for permission to proceed — the outline review in Stage 3 is the user's opportunity to make changes.

---

## Stage 3: Outline Generation & Review

Generate a structured outline from interview responses and present it for user review before proceeding to skill file generation. Do NOT proceed to Stage 4 until the user explicitly approves the outline.

### 3.1 Outline Generation

Synthesize all information collected from Stage 1 (inputs) and Stage 2 (interview) into a structured outline. The outline serves as a blueprint for the final skill file — it is NOT the skill file itself.

#### Pre-Generation Validation

Before generating the outline, walk through these checks internally:

- [ ] All required information from the Stage 2 completeness check (Section 2.7) is present or has reasonable defaults
- [ ] No contradictory information remains unresolved
- [ ] Platform-specific requirements for the selected target platform are addressed

If any section cannot be populated with collected information or a reasonable default, flag it as an information gap (see Section 3.4).

#### Outline Structure

Generate the outline with these sections. Always present a thorough, detailed outline regardless of interview depth — the depth setting affects only the interview, not the outline or generated output.

**Section 1: Skill Identity**
- **Name**: The skill name from Stage 1 (formatted to platform conventions — lowercase, hyphenated for OpenCode/GAS)
- **Description**: A polished version of the user's description, expanded with interview insights to maximize agent discoverability. Show the full description text that will appear in the frontmatter.
- **Target Platform**: The selected platform with any platform-specific notes

**Section 2: Key Features and Capabilities**
- List each core feature identified during the interview as a bullet point
- Mark any nice-to-have features separately (e.g., with a "Nice-to-have:" prefix) so the user can see what is core vs. optional
- For each feature, include a brief (one-line) description of what it does

**Section 3: Use Cases and Trigger Scenarios**
- **Primary use case**: The main workflow the skill supports
- **Secondary use cases**: Additional modes or capabilities (if any)
- **Trigger scenarios**: Specific phrases or situations that should activate the skill — these feed directly into the description field for agent discoverability

**Section 4: Workflow Overview**
- Describe the step-by-step flow the skill will follow when invoked
- Indicate the workflow shape (single-shot, multi-step pipeline, conversational, hybrid)
- Note inputs the skill receives and outputs it produces
- If the workflow has branching logic or conditional paths, outline each path

**Section 5: Platform-Specific Configuration**

**Load reference**: Read [references/platform-base.md](references/platform-base.md) and the relevant platform-specific reference for field definitions, conventions, and configuration options.

Include platform-specific configuration based on the selected platform:
- Frontmatter fields to include (required + relevant optional fields per platform conventions)
- Platform-specific settings (discovery paths, extension files, tool conventions)
- Whether `references/` or `scripts/` files are needed (and what they would contain)
- Estimated token budget: ~100 tokens metadata, <5000 tokens instructions, reference files as needed
- For Codex: `agents/openai.yaml` configuration summary (interface, policy, dependencies)

**Section 6: Suggested File Structure**

Show the proposed directory layout adapted to the target platform. Include the standard directories (`SKILL.md`, `references/`, `scripts/`, `assets/`) plus platform-specific additions (Codex: `agents/openai.yaml`). If the skill is simple enough for a single SKILL.md with no supporting files, say so explicitly. For each file or directory, include a one-line description of its purpose.

**Section 7: Requirements and Constraints**
- Tool dependencies (file read/write, web search, terminal, user interaction)
- Hard constraints or rules the skill must follow
- Scope boundaries — what the skill explicitly does NOT do
- Error handling approach

**Section 8: Defaults and Assumptions** (include only if applicable)
- List any information gaps that were filled with reasonable defaults during the interview
- Mark each with "[Default — please review]" so the user knows to verify these
- Include the reasoning for each default choice

#### Formatting Guidelines

Present the outline using clear Markdown formatting:

- Use `##` headers for each section and `###` for subsections
- Use bullet lists for features, use cases, and requirements
- Use code blocks for file structure diagrams
- Bold key terms and section labels for scannability
- Keep the overall outline concise — aim for clarity over exhaustiveness. The outline should be reviewable in a single read-through (roughly 40-80 lines depending on skill complexity)

Include brief explanatory notes under technical sections where concepts may not be self-evident (e.g., what `references/` files are for, what `allowed-tools` means).

### 3.2 Outline Presentation and Review Prompt

After generating the outline, present it to the user as regular text output (not via `question` — the outline itself is informational content). Then immediately prompt the user for their review using `question`.

**Review prompt:**

> Here's the outline for your skill. Please review it and let me know:
> 1. **Approve** — Everything looks good, proceed to generating the skill file
> 2. **Suggest changes** — Tell me what you'd like to adjust (I'll update the outline)
> 3. **Major rework** — Something fundamental needs to change (I'll re-ask some interview questions)

### 3.3 Review Flow

Handle the user's response based on the three possible paths.

#### Path A: Approve

The user signals approval — phrases like "looks good", "approve", "let's go", "proceed", "yes", "generate it", or selecting option 1.

**Action:**
1. Acknowledge approval briefly: "Great — generating your skill file now."
2. Proceed to Stage 4 (Skill File Generation)

#### Path B: Provide Feedback / Request Specific Changes

The user wants adjustments to specific parts of the outline — phrases like "change the description", "add a feature", "remove X", "the workflow should be...", or general feedback about specific sections.

**Action:**
1. Parse the feedback to identify which outline sections are affected
2. Apply the requested changes to the affected sections only — do not regenerate unaffected sections
3. If the feedback is ambiguous, ask one clarifying question via `question` before making changes
4. Present the updated outline (show the full outline with changes incorporated, not just a diff)
5. Prompt for review again using the same review prompt from Section 3.2

**Multiple feedback rounds are supported.** Each round follows the same pattern: apply changes, present updated outline, prompt for review. There is no limit on the number of feedback rounds — continue until the user approves or requests major changes.

#### Path C: Major Rework

The user wants fundamental changes that would require revisiting interview topics — phrases like "this is completely wrong", "I want to change the whole approach", "let's start the interview over", "the workflow needs to be totally different", or requesting changes that invalidate multiple interview answers.

**Action:**
1. Identify which interview categories (from Section 2.1) are affected by the requested changes
2. Acknowledge the scope of changes: "That's a significant shift — I'll need to revisit a few questions to make sure the outline reflects your updated vision."
3. Re-run only the relevant interview sections from Stage 2 — do NOT restart the entire interview
   - Use the same depth adaptation as the original interview
   - Carry forward all answers that are still valid
   - Store updated answers, replacing the previous ones
4. After gathering updated information, regenerate the affected outline sections
5. Present the updated outline and prompt for review again

**Distinguishing feedback from major rework:**
- **Feedback**: Changes that can be applied to the outline directly without needing new information (e.g., "rename the skill", "add a bullet about caching", "the description should mention TypeScript")
- **Major rework**: Changes that require information the interview did not cover, or that fundamentally alter the skill's purpose, workflow, or scope (e.g., "actually, make it conversational instead of single-shot", "I want it to target a different audience entirely", "add a whole new workflow branch")

When uncertain, treat the request as feedback first. If applying the feedback reveals that you lack the information needed to make the change, escalate to major rework by telling the user you need to ask a few more questions.

### 3.4 Gap Detection

If the outline generation process reveals information gaps — sections that cannot be populated meaningfully — handle them before presenting the outline.

#### Identifying Gaps

Gaps are detected during the pre-generation validation (Section 3.1) or while writing specific outline sections. Common gap scenarios:

- A workflow step was mentioned but never detailed (e.g., "it processes the files" with no specifics on how)
- A feature was listed without enough context to describe its behavior
- Platform-specific configuration requires a decision the user never made (e.g., whether to use reference files)
- Error handling approach was never discussed for a complex skill
- Trigger scenarios are unclear or too generic for a good description

#### Handling Gaps

**Minor gaps** (can be filled with reasonable defaults):
- Fill with a reasonable default based on the skill's overall context
- Mark the defaulted item in the outline with "[Default — please review]"
- Present the outline normally — the user can adjust during the review step

**Significant gaps** (cannot be reasonably defaulted — the information is critical to the outline):
- Do NOT present an incomplete outline
- Before presenting the outline, prompt the user via `question` for the specific missing information
- Frame the question with context: "While preparing your outline, I realized I need a bit more detail about [specific gap]. [Targeted question]"
- Limit gap-fill questions to at most 2 — if more than 2 significant gaps exist, present the outline with the most critical gaps filled and the rest marked as "[Default — please review]"
- After receiving the answer, incorporate it and then present the complete outline

### 3.5 Incomplete Section Flagging

When any section of the outline is based on incomplete information, limited context, or reasonable assumptions rather than explicit user input, flag it visibly so the user can prioritize their review.

**Flagging format:**

Use an inline marker at the end of the relevant bullet or paragraph:

- For defaulted values: `[Default — please review]`
- For assumptions derived from context: `[Assumed from {source} — please verify]`
- For sections with limited detail: `[Minimal detail collected — consider expanding]`

If an entire section is flagged, add a brief note at the top of that section:

> **Note:** This section is based on limited information from the interview. Please review carefully and provide feedback on anything that should change.

### 3.6 Transition to Stage 4

Only transition to Stage 4 when the user has explicitly approved the outline. Approval signals:

- Direct approval phrases (see Path A in Section 3.3)
- Approval after one or more feedback rounds
- Approval after major rework and re-presentation

After approval:
1. Store the approved outline internally as the blueprint for Stage 4
2. Note any remaining "[Default — please review]" items — these should be handled conservatively during generation (use the default but keep the generated content easy to modify)
3. Proceed to Stage 4

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
