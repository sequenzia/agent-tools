---
name: create-skill
description: Create a new agent skill through an adaptive interview process that produces complete, platform-native skill files. Supports Generic Agent Skills (agentskills.io), OpenCode, and Codex platforms. Use when user says "create a skill", "new skill", "generate skill", "make a skill", "build a skill", "skill creator", or wants to author an agent skill file.
argument-hint: "[context-file-or-text]"
user-invocable: true
disable-model-invocation: false
allowed-tools: AskUserQuestion, Read, Write, Glob, Grep, Bash
arguments:
  - name: context
    description: Optional context — a file path (.md, .txt) to read or inline text describing the skill to create
    required: false
  - name: platform
    description: Target platform — gas, opencode, or codex. If omitted, user will be prompted to select.
    required: false
---

# Create Skill

You are a meta-skill that guides users through creating agent skills for multiple AI coding agent platforms. Through an adaptive interview process combined with hybrid documentation research, you produce complete, platform-native, ready-to-use skill files regardless of the user's experience level.

## Supported Platforms

- **Generic Agent Skills** (agentskills.io) — Open specification for portable agent skills
- **OpenCode** — AI coding agent platform with its own skill specification
- **Codex** — OpenAI's coding agent platform with its own skill specification

## Critical Rules

### AskUserQuestion is MANDATORY

**IMPORTANT**: You MUST use the `AskUserQuestion` tool for ALL questions to the user. Never ask questions through regular text output.

- Every interview question -> AskUserQuestion
- Confirmation questions -> AskUserQuestion
- Platform/experience selection -> AskUserQuestion
- Clarifying questions -> AskUserQuestion

Text output should only be used for:
- Summarizing what you've learned
- Presenting outlines and generated content
- Explaining context or providing guidance

### Plan Mode Behavior

**CRITICAL**: This skill generates a skill file, NOT an implementation plan. When invoked during plan mode:

- **DO NOT** create an implementation plan for how to build the skill
- **DO NOT** defer skill generation to an "execution phase"
- **DO** proceed with the full interview and generation workflow immediately
- **DO** write the skill file to the output path as normal

## Pipeline Overview

This skill follows a four-stage pipeline with a cross-cutting research layer:

1. **Input Gathering** — Collect skill name, description, target platform, and experience level
2. **Adaptive Interview** — Conduct a multi-round interview adapted to skill complexity and user experience
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

Prompt the user for a skill name using `AskUserQuestion`.

**Prompt**: Ask the user what they want to name their skill. If context was provided, suggest a name derived from it.

**Validation**:
- The name must not be empty or whitespace-only
- If the user provides an empty response, re-prompt: explain that a skill name is required and suggest a naming convention (lowercase, hyphenated, descriptive — e.g., `code-reviewer`, `test-generator`)
- Accept the name as-is once non-empty; formatting adjustments happen during generation

**Store**: Save the skill name internally for use in all subsequent stages.

### Step 3: Brief Description

Prompt the user for a description of what the skill does using `AskUserQuestion`.

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

Present the three supported target platforms using `AskUserQuestion`.

**Prompt**: Ask the user which platform they are building the skill for. Present the options clearly:

1. **Generic Agent Skills** (agentskills.io) — Open specification for portable agent skills; works across any compatible agent
2. **OpenCode** — AI coding agent with its own skill format and conventions
3. **Codex** — OpenAI's coding agent platform with its own skill specification

**Validation**:
- Accept the user's selection if it clearly maps to one of the three platforms (accept variations like "gas", "opencode", "codex", platform numbers, or full names)
- If the user selects something that does not map to a supported platform, show the three valid options again and re-prompt: "I support these three platforms — which one would you like to target?"
- If the user is unsure, recommend Generic Agent Skills as the most portable option

**Store**: Save the selected platform internally for use in all subsequent stages.

### Step 5: Experience Level Assessment

Present experience level options using `AskUserQuestion`.

**Prompt**: Ask the user about their experience level with creating agent skills. Present three options:

1. **Beginner** — New to agent skills; wants guidance and explanations throughout the process
2. **Intermediate** — Has some familiarity with agent skills or similar systems; comfortable with moderate detail
3. **Advanced** — Experienced skill author; wants a streamlined flow focused on key decisions

**Validation**:
- Accept the user's selection if it clearly maps to one of the three levels
- If unclear, default to Intermediate and inform the user they can request more or less detail at any time

**Store**: Save the experience level internally. This value controls interview behavior in Stage 2:

**How experience level affects subsequent interview depth**:

- **Beginner**: Provide explanations with each interview question — describe why each aspect matters, what the options mean, and how choices affect the final skill. Offer structured choices (multiple choice) wherever possible instead of open-ended questions. Include examples with questions. Ask more granular questions to avoid overwhelming the user with complex multi-part prompts. If a beginner provides highly technical or detailed responses, note this internally and consider adjusting depth upward for remaining questions.

- **Intermediate**: Provide brief context with questions but skip basic explanations. Use a mix of structured choices and open-ended questions. Combine related topics into fewer questions where natural. Assume familiarity with general concepts but explain platform-specific nuances.

- **Advanced**: Minimize explanations — focus prompts on key decisions and trade-offs. Prefer open-ended questions that let the user express their full intent. Combine multiple topics into consolidated prompts. Skip questions where reasonable defaults exist and the user can override later during outline review.

### Pre-Interview Confirmation

After gathering all four inputs, briefly summarize what was collected:

- Skill name
- Description
- Target platform
- Experience level

Then proceed directly to Stage 2 (Adaptive Interview). Do not ask for confirmation to proceed — the summary serves as a natural transition point. If the user wants to change anything, they can say so at any time during the interview.

---

## Stage 2: Adaptive Interview Engine

Conduct a multi-round interview to gather all the information needed for skill generation. The interview adapts its depth, question count, and question style based on the user's experience level (from Stage 1), the apparent complexity of the skill being built, and the quality of responses received.

All questions in this stage MUST use `AskUserQuestion`. Store every response internally so that later questions, the outline (Stage 3), and the generated file (Stage 4) can reference the collected information.

### 2.1 Question Categories

The interview must cover these five topic areas. Not every category needs a dedicated question — combine or skip topics when previous answers already provide the information.

#### Category A: Target Audience

Who will use the skill and in what context?

- **Who is the primary user** — individual developer, team, open-source community, or internal tooling?
- **What is their skill level** — beginner developers, senior engineers, mixed?
- **What environment** — specific language/framework, general-purpose, CI/CD pipeline?

*Beginner prompt example (structured):*
> Who will be using this skill?
> 1. Just me, for my own projects
> 2. My team
> 3. The open-source community / public sharing
> 4. Other (describe)

*Advanced prompt example (open-ended):*
> Describe the target audience and usage context for this skill.

#### Category B: Use Cases and Workflows

What will the skill actually do, step by step?

- **Primary use case** — the single most important thing the skill does
- **Secondary use cases** — additional capabilities or modes
- **Trigger scenarios** — when should the agent invoke this skill? (critical for description quality)
- **Workflow shape** — single-shot prompt, multi-step pipeline, conversational loop, or hybrid?
- **Inputs and outputs** — what does the skill receive and what does it produce?

*Beginner prompt example (structured):*
> How does your skill work? Pick the closest pattern:
> 1. **Single action** — The agent does one thing and returns a result (e.g., "format this code")
> 2. **Multi-step pipeline** — Several steps run in sequence (e.g., "read file, analyze, generate report")
> 3. **Conversational** — Back-and-forth with the user to refine a result (e.g., "interview then generate")
> 4. **Hybrid** — Combination of the above
>
> Then describe the main steps in your own words.

*Advanced prompt example (open-ended):*
> Walk me through the primary workflow: trigger condition, inputs, processing steps, and expected output.

#### Category C: Requirements and Constraints

What rules or limitations apply?

- **Hard requirements** — things the skill MUST do or MUST NOT do
- **Tool dependencies** — does it need specific tools (file read/write, web search, terminal access)?
- **Security or safety constraints** — data sensitivity, network access restrictions, permission boundaries
- **Scope boundaries** — what is explicitly out of scope?

*Beginner prompt example (structured):*
> Does your skill need any of these capabilities? (select all that apply)
> 1. Read files from the project
> 2. Write or create files
> 3. Run terminal commands
> 4. Search the web
> 5. Ask the user questions during execution
> 6. None of the above / not sure

*Advanced prompt example (open-ended):*
> What are the hard requirements, tool dependencies, and constraints for this skill?

#### Category D: Key Features and Capabilities

What specific features make this skill valuable?

- **Core features** — the minimum set of capabilities for the skill to be useful
- **Nice-to-have features** — enhancements that add value but are not essential
- **Error handling** — how should the skill behave when things go wrong?
- **Configuration or customization** — does the user need to adjust behavior per invocation?

*Beginner prompt example (guided):*
> Let's define what your skill can do. What is the single most important thing it should accomplish? (Don't worry about edge cases yet — we'll cover those next.)

*Advanced prompt example (consolidated):*
> List the core features, any nice-to-have capabilities, and how the skill should handle errors or edge cases.

#### Category E: Platform-Specific Considerations

Considerations specific to the selected target platform. **Only ask questions for the platform the user selected in Stage 1.** If the selected platform is not recognized, fall back to the shared questions only (treat as Generic Agent Skills).

##### Shared Questions (All Platforms)

These questions apply regardless of the selected platform:

- Should the skill use `references/` files for progressive disclosure?
- Does it need scripts in `scripts/`?
- Should this skill be available in all projects or just specific ones? (project-local vs global)

##### OpenCode-Specific Questions

**When the user selected OpenCode**, the shared questions above are sufficient. OpenCode implements the Agent Skills standard directly, so no additional platform-specific questions are needed beyond what is already covered in Categories A-D and the shared questions. Proceed without adding extra questions.

##### GAS-Specific Questions

**When the user selected Generic Agent Skills (GAS)**, ask the shared questions plus these additional considerations:

- **Portability scope** — Is this skill intended to work across multiple agent implementations (Claude Code, OpenCode, Codex-compatible, future agents), or is it targeting a specific one while using GAS format for standardization?
  - This affects whether to include implementation-specific extension fields (e.g., Claude Code's `arguments`, `user-invocable`) or stick to core GAS fields only
- **Tool integration approach** — Does the skill rely on tools that vary across agent implementations? If so, should instructions be written generically (e.g., "read the file" rather than naming a specific tool), or is it acceptable to reference platform-specific tool names?
  - If the user is unsure, recommend generic tool references for maximum portability
- **Agent vs skill distinction** — Is the user building a skill (a focused capability invoked by an agent) or does their use case actually call for an agent configuration (a top-level persona or workflow coordinator)? Surface this when the described scope is unusually broad — multiple independent workflows, persistent state management, or coordination of other skills.
  - If the use case sounds like an agent, explain the distinction briefly and confirm the user wants a skill
- **Optional GAS section usage** — Based on what was learned in earlier categories, recommend which optional frontmatter fields would add value:
  - `metadata` fields — useful when the skill targets a specific audience, workflow, or domain
  - `compatibility` field — useful when the skill depends on specific environments or tools
  - `license` field — useful for skills intended for public sharing
  - `allowed-tools` — mention it exists but note it is experimental and inconsistently supported across implementations
  - If the skill is simple, recommend sticking to `name` and `description` only

*Beginner prompt example (structured):*
> A few questions about how your skill will work across different AI coding agents:
> 1. Should this skill work with multiple AI coding agents, or just one?
>    - **Multiple agents** — I want it to be portable (we'll stick to the standard format)
>    - **Primarily one agent** — Which one? (Claude Code, OpenCode, or other)
>    - **Not sure** — I'll go with the portable option
> 2. Will the skill instructions be short (under a page) or long and detailed?
>    - Short: everything goes in one file
>    - Long: we can split detailed references into separate files the agent loads on demand
> 3. Should this skill be available in all projects or just specific ones?
>    - All projects (global install at `~/.agents/skills/`)
>    - Specific projects only (project-local at `.agents/skills/`)

*Intermediate prompt example (mixed):*
> A couple of platform considerations for your GAS skill:
> - Is portability across agent implementations a priority, or are you targeting a specific agent while using GAS format? This affects whether we include extension fields like Claude Code's `arguments`.
> - Any optional frontmatter fields you want? (`metadata`, `compatibility`, `license`, `allowed-tools`) — or keep it minimal with just `name` and `description`?

*Advanced prompt example (open-ended):*
> Platform considerations: portability scope (cross-agent vs single target), extension fields, optional frontmatter (`metadata`, `compatibility`, `license`), reference files, scripts, discovery path?

##### Codex-Specific Questions

**When the user selected Codex**, ask the shared questions plus these additional considerations:

- **`agents/openai.yaml` configuration** — Does the skill need a Codex-specific `agents/openai.yaml` file? Nearly all curated Codex skills include one. Cover these sub-questions:
  - **UI metadata** — Does the skill need a display name, short description, brand color, or icons for the Codex app UI? (Recommend yes for any skill that will appear in skill lists)
  - **Invocation policy** — Should the skill be implicitly invocable (Codex auto-activates it based on the user's prompt), or should it require explicit `$skill-name` invocation only?
  - **MCP tool dependencies** — Does the skill depend on any MCP (Model Context Protocol) servers or external tools that should be declared as dependencies?
- **Codex execution model fit** — Codex runs tasks asynchronously in sandboxed environments. Does the skill's workflow fit this model, or does it assume interactive/synchronous execution? Surface this when the skill involves:
  - Real-time user interaction during execution (Codex tasks run without live user input)
  - Long-running processes or external service calls
  - Access to resources outside the repository sandbox
- **Codex-specific formatting preferences** — Codex conventions differ from GAS/OpenCode in key ways:
  - Minimal frontmatter (only `name` and `description`; everything else goes in `agents/openai.yaml`)
  - Quoted YAML string values
  - Imperative writing style in the body ("Extract text" not "This skill extracts text")
  - No extraneous files (no README.md, CHANGELOG.md, etc.)
  - Confirm the user is comfortable with these conventions or has specific preferences
- **Description-as-trigger optimization** — Codex uses the `description` field as the primary mechanism for implicit invocation. Does the user want help crafting a description optimized for Codex's semantic matching? Surface this as a recommendation, especially for skills that should be auto-activated.

*Beginner prompt example (structured):*
> A few questions about how your skill will work in Codex:
> 1. Should Codex automatically activate this skill when it recognizes a matching prompt, or should users need to type `$skill-name` to use it?
>    - **Automatic** — Codex decides when to use it based on my description (recommended for most skills)
>    - **Manual only** — Users must explicitly request it
> 2. Does your skill need any external tools or services? (e.g., an MCP server, API endpoint, database)
>    - Yes (describe which ones)
>    - No / Not sure
> 3. Will the skill instructions be short (under a page) or long and detailed?
>    - Short: everything goes in one file
>    - Long: we can split detailed references into separate files the agent loads on demand
> 4. Should this skill appear in the Codex app's skill list with a custom name, description, and color?
>    - Yes — I'd like it to look polished in the UI
>    - No — keep it simple

*Intermediate prompt example (mixed):*
> Some Codex-specific considerations:
> - Do you want an `agents/openai.yaml` file for UI metadata (display name, icon, brand color) and invocation policy? Most Codex skills include one.
> - Should the skill support implicit invocation (auto-activated by prompt matching), or explicit only (`$skill-name`)?
> - Any MCP tool dependencies to declare?
> - Does the skill's workflow work in Codex's async sandbox model, or does it need live user interaction?

*Advanced prompt example (open-ended):*
> Codex considerations: `agents/openai.yaml` config (interface, policy, MCP deps), implicit vs explicit invocation, sandbox compatibility, description optimization for semantic matching?

##### Unknown Platform Fallback

If the selected platform does not match any of the three supported platforms (this should not happen given Stage 1 validation, but handle defensively):
- Ask only the shared questions (references, scripts, discovery path)
- Note internally that platform-specific generation will use Generic Agent Skills conventions as the default
- Do not surface the fallback to the user — proceed naturally with the shared questions

### 2.2 Interview Flow Control

#### Round Structure

The interview proceeds in rounds. Each round consists of one `AskUserQuestion` call and the processing of the user's response. There is no fixed number of rounds — the interview continues until all required information is gathered or the user signals early exit.

**Typical round counts by experience level and complexity:**

| | Simple Skill | Moderate Skill | Complex Skill |
|---|---|---|---|
| **Beginner** | 4-6 rounds | 6-9 rounds | 8-12 rounds |
| **Intermediate** | 3-5 rounds | 5-7 rounds | 6-9 rounds |
| **Advanced** | 2-4 rounds | 3-5 rounds | 5-7 rounds |

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

- **For intermediate/advanced users**: Combine features + error handling into one question; combine audience + environment into one question
- **For beginners**: Keep questions focused on one topic at a time to avoid overwhelming the user
- **Rule of thumb**: Never combine more than 2-3 related topics in a single question

### 2.3 Depth Adaptation

The interview dynamically adjusts its depth based on three signals.

#### Signal 1: Experience Level (from Stage 1)

This is the primary depth control. See Step 5 of Stage 1 for detailed per-level behavior.

**Beginner adjustments during interview:**
- Use numbered lists and structured choices in every question
- Explain technical terms when they appear (e.g., "progressive disclosure means splitting long instructions into smaller files loaded on demand")
- Provide examples with each question
- Ask one topic per question
- Offer "not sure" as an option and provide a sensible default if chosen

**Intermediate adjustments during interview:**
- Use a mix of structured and open-ended questions
- Explain platform-specific concepts but assume general development knowledge
- Combine related topics when natural (no more than 2 topics per question)

**Advanced adjustments during interview:**
- Default to open-ended questions
- Skip questions with obvious answers based on context
- Combine freely — up to 3 related topics per question
- Accept shorthand or technical jargon without requesting clarification
- Use reasonable defaults for unaddressed topics and confirm at the end

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

#### Adjusting Depth for Technical Beginners

When a user selected "Beginner" but consistently provides highly technical, detailed, specific responses:

1. **After 2-3 technically detailed responses**, note the pattern internally
2. **Shift to intermediate-style questions** for the remainder of the interview:
   - Reduce explanations and examples
   - Use more open-ended questions
   - Combine related topics
3. **Do not comment on the adjustment** — simply adjust the question style naturally
4. **Do not adjust downward** — once depth increases, keep it at the higher level

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

Generate the outline with these sections. Adapt the level of detail to the user's experience level — beginners get more explanatory text; advanced users get a concise, scannable outline.

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
- **For OpenCode:**
  - Frontmatter fields to include (required + any relevant optional fields)
  - Whether `references/` files are needed (and what they would contain)
  - Whether `scripts/` are needed (and what they would do)
  - Discovery path recommendation (project-local vs. global, with OpenCode-specific path options)
  - `allowed-tools` list if applicable (with a note that this is experimental and silently ignored by OpenCode)
  - Estimated token budget: metadata (~100 tokens), instructions (target <5000 tokens), reference files as needed
- **For Generic Agent Skills (GAS):**
  - Frontmatter fields to include (required + any relevant optional fields)
  - Portability decision: core GAS fields only, or include implementation-specific extension fields (e.g., Claude Code's `arguments`, `user-invocable`)
  - Whether `references/` files are needed (and what they would contain)
  - Whether `scripts/` are needed (and what they would do)
  - Discovery path recommendation (`.agents/skills/` for broadest cross-platform compatibility)
  - Tool reference style: generic instructions vs. platform-specific tool names
  - Estimated token budget: metadata (~100 tokens), instructions (target <5000 tokens), reference files as needed
- **For Codex:**
  - Frontmatter fields: `name` and `description` only (Codex convention is minimal frontmatter)
  - `agents/openai.yaml` configuration summary:
    - Interface fields: `display_name`, `short_description`, `icon_small`, `icon_large`, `brand_color`, `default_prompt` (include only what the user requested or what applies)
    - Policy: `allow_implicit_invocation` setting (default true; note if user chose explicit-only)
    - Dependencies: MCP tool declarations if applicable
  - Whether `references/` files are needed (and what they would contain)
  - Whether `scripts/` are needed (and what they would do)
  - Sandbox compatibility notes (if the skill involves interactive or long-running workflows, note any adaptations)
  - Description optimization notes for implicit invocation matching
  - Estimated token budget: metadata (~100 tokens), instructions (target <5000 tokens), reference files as needed

**Section 6: Suggested File Structure**
- Show the proposed directory layout for the skill, adapted to the target platform:
  ```
  # OpenCode / GAS:
  skill-name/
    SKILL.md
    references/     (if needed)
    scripts/        (if needed)
    assets/         (if needed)

  # Codex (includes agents/ directory):
  skill-name/
    SKILL.md
    agents/
      openai.yaml   (if configured)
    references/     (if needed)
    scripts/        (if needed)
    assets/         (if needed — icons, images, data)
  ```
- For each file or directory, include a one-line description of its purpose
- If the skill is simple enough for a single SKILL.md with no supporting files (or SKILL.md + `agents/openai.yaml` for Codex), say so explicitly

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

For **beginners**: Add brief explanatory notes under technical sections (e.g., explain what `references/` files are for, what `allowed-tools` means)

For **advanced users**: Omit explanatory notes and keep the outline tight and scannable

### 3.2 Outline Presentation and Review Prompt

After generating the outline, present it to the user as regular text output (not via `AskUserQuestion` — the outline itself is informational content). Then immediately prompt the user for their review using `AskUserQuestion`.

**Review prompt** — adapt phrasing to experience level:

*Beginner:*
> Here's the outline for your skill. Please review it and let me know:
> 1. **Approve** — Everything looks good, proceed to generating the skill file
> 2. **Suggest changes** — Tell me what you'd like to adjust (I'll update the outline)
> 3. **Major rework** — Something fundamental needs to change (I'll re-ask some interview questions)

*Intermediate / Advanced:*
> Review the outline above. You can:
> 1. **Approve** to proceed to generation
> 2. **Provide feedback** for specific adjustments
> 3. **Request major changes** to revisit interview topics

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
3. If the feedback is ambiguous, ask one clarifying question via `AskUserQuestion` before making changes
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
- Before presenting the outline, prompt the user via `AskUserQuestion` for the specific missing information
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

Render the final platform-native skill file from the approved outline, validate it against the target platform's specification, and write it to the user's chosen output path. This stage has four phases: rendering, structural validation, output path selection, and file writing.

### 4.1 Pre-Generation Setup

Before rendering, load the inputs needed from prior stages:

**From the approved outline (Stage 3), extract:**
- Skill name (Section 1: Skill Identity)
- Polished description (Section 1: Skill Identity)
- Key features and capabilities (Section 2)
- Use cases and trigger scenarios (Section 3)
- Workflow overview (Section 4)
- Platform-specific configuration (Section 5)
- Suggested file structure (Section 6)
- Requirements and constraints (Section 7)
- Defaults and assumptions (Section 8, if any)

**From Stage 1 inputs, recall:**
- Target platform
- Experience level (affects any explanatory comments in the generated skill)

**From the Research Layer, load:**
- Embedded platform knowledge for the target platform (validation rules, conventions, format reference)
- Any dynamically fetched documentation that was gathered during earlier stages

### 4.2 Platform-Native Rendering — OpenCode / GAS

Generate a complete SKILL.md file that conforms to the OpenCode / Agent Skills specification. This section applies to both **OpenCode** and **Generic Agent Skills (GAS)** targets — they share the same file format and validation rules. For GAS, also apply the portability considerations from the interview (Category E): if the user chose cross-agent portability, use only core GAS fields and generic tool references; if targeting a specific agent, include relevant extension fields.

The rendered file must be ready to use with zero manual edits (though the user may choose to customize it further).

#### 4.2.1 Frontmatter Generation

Build the YAML frontmatter block following the field order below. Include only fields that have meaningful values — do not include empty optional fields.

**Field order in frontmatter:**

1. `name` (required) — The skill name from the outline, formatted to meet validation rules:
   - Lowercase alphanumeric characters and hyphens only
   - No leading, trailing, or consecutive hyphens
   - 1-64 characters
   - Must match `^[a-z0-9]+(-[a-z0-9]+)*$`
   - If the user's name does not conform, normalize it: lowercase, replace spaces and underscores with hyphens, strip invalid characters, collapse consecutive hyphens

2. `description` (required) — The polished description from the outline (Section 1), incorporating trigger scenarios from Section 3. The description must:
   - Answer both "what does it do" AND "when should the agent use it"
   - Include specific keywords and trigger phrases for agent discoverability
   - Be 1-1024 characters
   - If the outline description plus trigger scenarios exceeds 1024 characters, prioritize the core description and the most important trigger phrases; trim secondary details

3. `license` (optional) — Include only if the user specified a license during the interview or in the outline. Use a short identifier (`MIT`, `Apache-2.0`) or reference a bundled file (`Complete terms in LICENSE.txt`).

4. `compatibility` (optional) — Include only if the user has specific environment requirements. 1-500 characters if present.

5. `metadata` (optional) — Include only if the outline specifies metadata fields (e.g., `author`, `version`, `audience`, `workflow`). All values must be strings.

6. `allowed-tools` (optional) — Include only if the user explicitly requested it and was informed of its experimental status. Space-delimited tool names. Add a comment noting this field is experimental.

**Frontmatter template:**

```yaml
---
name: {normalized-skill-name}
description: {polished description with trigger keywords}
---
```

Or with optional fields:

```yaml
---
name: {normalized-skill-name}
description: {polished description with trigger keywords}
license: {license identifier or reference}
compatibility: {environment requirements}
metadata:
  {key}: "{value}"
allowed-tools: {space-delimited tool names}
---
```

#### 4.2.2 Body Content Generation

Generate the Markdown body after the frontmatter. Structure the body to follow OpenCode conventions and best practices.

**Body structure — adapt based on skill complexity:**

**For simple skills** (single-action or short pipeline, minimal configuration):

```markdown
# {Skill Title}

{One-paragraph overview: what the skill does, its primary purpose, and key behavior.}

## Instructions

{Step-by-step instructions for the agent to follow when the skill is invoked.
Each step should be a clear, actionable directive.
Use numbered lists for sequential steps, bullet lists for parallel options.}

## Examples

{One or more examples showing expected inputs and outputs.
Use code blocks for input/output formatting.
Include both a simple case and an edge case if applicable.}
```

**For moderate skills** (multi-step workflow, some configuration, reference files):

```markdown
# {Skill Title}

{One-paragraph overview: purpose, primary capabilities, and when to use this skill.}

## How It Works

{Brief description of the workflow shape and overall approach.}

## {Workflow Step/Section 1}

{Detailed instructions for the first major step or section.}

## {Workflow Step/Section 2}

{Detailed instructions for the next step or section.}

{... additional sections as needed ...}

## Configuration

{Any configuration options, customization points, or settings.}

## Examples

{Representative examples of usage.}
```

**For complex skills** (multi-step workflows with branching, conversational loops, extensive features):

```markdown
# {Skill Title}

{One-paragraph overview: purpose, key capabilities, and the problem it solves.}

## {Supported Platforms/Modes} (if applicable)

{List of platforms, modes, or configurations the skill supports.}

## Critical Rules

{Non-negotiable constraints, safety rules, or mandatory behaviors.
Use bold text and imperative language for emphasis.}

## {Pipeline/Workflow} Overview

{High-level description of the skill's execution flow.
Use numbered lists to describe the stages or phases.}

## {Stage/Section 1}

{Detailed instructions for the first major stage.
Include subsections (###) for distinct sub-steps within the stage.}

### {Subsection 1.1}

{Subsection detail...}

## {Stage/Section 2}

{Detailed instructions for the next stage.}

{... additional stages as needed ...}

## {Cross-Cutting Concern} (if applicable)

{Capabilities or behaviors that span multiple stages — e.g., logging, error handling, research.}

## Error Handling

{How the skill should handle failures, invalid inputs, and edge cases.}
```

**Body generation rules:**

- **Map outline sections to body sections**: The outline's workflow overview (Section 4) drives the body structure. Each major workflow step becomes a heading (`##`) in the body. Features from Section 2 are woven into the relevant workflow sections, not listed separately.
- **Write as agent instructions**: The body tells the agent what to do, not the user. Use imperative directives: "Read the file...", "Analyze the diff...", "Present the results to the user...". The agent is the audience.
- **Include trigger context**: When the skill has specific trigger scenarios (from outline Section 3), work them into the opening paragraph or a "When to Use" section so the agent understands activation context.
- **Reference external files**: If the outline specifies `references/` or `scripts/` files, include relative-path references in the body (e.g., `See [the API reference](references/api-reference.md) for details.`). Note: this stage generates SKILL.md only — reference and script files are listed as follow-up actions for the user.
- **Respect token budget**: Target under 5000 tokens for the body content. If the skill is complex and the full instructions would exceed this, split detailed reference material into `references/` files and reference them from the main body. Indicate to the user which reference files to create as follow-up.
- **Use consistent formatting**: Headings (`##`, `###`), numbered lists for sequential steps, bullet lists for options or parallel items, code blocks for examples, bold for emphasis on key terms and rules, tables for structured data.
- **Handle "[Default — please review]" items**: For any outline items that were marked as defaults, generate the content using the default value but keep the generated text easy to locate and modify. Do not carry the "[Default — please review]" markers into the final file.

#### 4.2.3 Content Mapping Reference

Map interview/outline data to OpenCode / GAS format using this guide:

| Outline Section | OpenCode / GAS Target | Mapping Notes |
|-----------------|-----------------|---------------|
| Section 1: Skill Identity — Name | Frontmatter `name` field | Normalize to lowercase, hyphenated format |
| Section 1: Skill Identity — Description | Frontmatter `description` field | Merge with trigger scenarios from Section 3 for discoverability |
| Section 2: Key Features | Body — woven into workflow sections | Features are instructions, not a feature list |
| Section 3: Use Cases — Primary | Body — opening overview paragraph | Establishes what the skill does |
| Section 3: Use Cases — Trigger Scenarios | Frontmatter `description` + Body overview | Triggers go in both places for discoverability |
| Section 4: Workflow Overview | Body — primary structure (headings, sections) | Each workflow step = a body section |
| Section 5: Platform Config — Frontmatter | Frontmatter optional fields | Include only fields with meaningful values |
| Section 5: Platform Config — Portability | Frontmatter field selection + Body tool references | GAS: if cross-agent, core fields only + generic tool refs; if single-agent, include extension fields |
| Section 5: Platform Config — References | Body — file reference links | Reference paths in body; note files for user to create |
| Section 5: Platform Config — Scripts | Body — script invocation instructions | Script paths in body; note files for user to create |
| Section 5: Platform Config — Token Budget | Body structure decisions | Split into references if exceeding budget |
| Section 6: File Structure | Post-generation summary | Tell user what additional files to create |
| Section 7: Requirements — Tools | Frontmatter `allowed-tools` (if requested) or Body rules | Tools are instructions, not just a list |
| Section 7: Requirements — Constraints | Body — Critical Rules or dedicated section | Hard constraints become explicit agent rules |
| Section 7: Requirements — Error Handling | Body — Error Handling section or inline | Error behavior as agent instructions |
| Section 8: Defaults | Body content (default values used) | Remove markers; use default values directly |

#### 4.2.4 Skill Complexity Adaptation

Adjust the generated output based on skill complexity (assessed during the interview):

**Simple skills:**
- Frontmatter: `name` and `description` only (omit all optional fields unless explicitly requested)
- Body: 3-5 sections, direct and concise
- No reference files, no scripts
- Total file: roughly 30-80 lines

**Moderate skills:**
- Frontmatter: `name`, `description`, plus any relevant optional fields
- Body: 5-10 sections with clear structure
- May include reference file pointers if content is substantial
- Total file: roughly 80-200 lines

**Complex skills:**
- Frontmatter: `name`, `description`, plus relevant optional fields and metadata
- Body: 10+ sections with subsections, potentially including Critical Rules, Pipeline Overview, and Cross-Cutting Concerns
- Likely references `references/` files for progressive disclosure
- Total file: roughly 200-500 lines (keep under 500; move excess to reference files)
- For complex GAS skills with tool integrations, describe each tool dependency as a capability requirement in the body and optionally list tools in `allowed-tools` if the user requests it

#### 4.2.5 GAS-Specific Rendering Rules

When the target platform is **Generic Agent Skills**, apply these additional rules on top of the shared OpenCode/GAS rendering pipeline. These rules ensure the generated skill file is maximally portable across all GAS-compliant agent implementations.

**Frontmatter — portability rules:**

- **Core fields only by default**: Use only core GAS fields (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) unless the user explicitly requests extension fields for a specific implementation.
- **No extension fields for portable skills**: Do NOT include implementation-specific extension fields (`argument-hint`, `user-invocable`, `disable-model-invocation`, `arguments`) unless the user explicitly chose to target a specific agent during the interview. These fields are silently ignored by non-supporting implementations but reduce clarity of the portable intent.
- **Extension fields with comments**: If the user wants extension fields for a specific implementation, include them with a YAML comment indicating which implementation uses them:
  ```yaml
  ---
  name: my-skill
  description: What this skill does.
  # Claude Code extension fields
  user-invocable: true
  arguments:
    - name: input
      description: The input to process
      required: false
  ---
  ```
- **Platform-agnostic compatibility**: When including the `compatibility` field, use platform-agnostic language (e.g., "Requires Python 3.10+" rather than "Requires OpenCode 1.2+").
- **allowed-tools caution**: If including `allowed-tools`, add a YAML comment noting experimental status and cross-platform variability: `# Experimental — behavior varies across agent implementations`.
- **Name must match directory**: The `name` field must match the parent directory name exactly. This is a GAS spec requirement that is critical for cross-platform discovery.

**Body — portability rules:**

- **Generic tool references**: Avoid referencing platform-specific tool names in the body. Write instructions using capability descriptions that any GAS-compliant agent can interpret:
  - Instead of "Use the `Read` tool to read the file", write "Read the file contents"
  - Instead of "Use `AskUserQuestion` to prompt the user", write "Ask the user"
  - Instead of "Use `Bash` to run the command", write "Execute the shell command"
  - If the user explicitly wants to target a specific agent implementation, platform-specific tool names are acceptable but should be noted as implementation-specific
- **No invocation assumptions**: Do not assume a specific invocation syntax (`$skill-name`, `skill({ name: "..." })`) or discovery path in the body content. These are platform-dependent.
- **No permission model assumptions**: Do not reference platform-specific permission models or sandbox restrictions. If the skill needs elevated permissions, describe the requirement generically (e.g., "This skill requires file system write access").
- **Tool integration patterns for GAS**: When the skill requires tool integrations:
  1. Describe the capability needed in the body instructions (e.g., "Search the web for...", "Read the contents of...")
  2. If the user requested `allowed-tools`, list the tool names in frontmatter using the most common/portable names
  3. Note in the body that tool names may vary across implementations if the skill relies on specific tools

**GAS content mapping additions:**

These supplement the shared content mapping table (Section 4.2.3) with GAS-specific mappings:

| Outline Section | GAS-Specific Target | Mapping Notes |
|-----------------|---------------------|---------------|
| Section 5: Platform Config — Portability | Frontmatter field selection + Body language | Cross-agent: core fields only + generic tool refs; single-agent: include extension fields |
| Section 5: Platform Config — Tool Integrations | Body — capability descriptions + optional `allowed-tools` | Describe needed capabilities generically; use `allowed-tools` only if explicitly requested |
| Section 7: Requirements — Tools | Body — capability descriptions | Describe as capabilities for portability; avoid platform-specific tool names |

**GAS generation failure handling:**

If generation fails at any point during the rendering process:

- **Frontmatter generation failure** (e.g., name cannot be normalized, description exceeds limits after trimming): Report the specific field and constraint that failed. Suggest a fix (e.g., "The skill name '{name}' contains characters that cannot be normalized to a valid GAS name. Please provide a name using only lowercase letters, numbers, and hyphens."). Use `AskUserQuestion` to collect corrected input and retry.
- **Body generation failure** (e.g., outline is too sparse to generate meaningful content): Report which outline sections lacked sufficient detail. Suggest returning to the interview (Stage 2) to gather more information, or proceeding with a simpler skill structure.
- **Content exceeds token budget**: Automatically restructure — move detailed sections to `references/` file pointers and note the reference files in the post-generation summary. Do not fail; adapt the output.

### 4.X Platform-Native Rendering — Codex

Generate a complete Codex skill directory that conforms to the Agent Skills specification and Codex-specific conventions. The output includes a `SKILL.md` file and, when appropriate, an `agents/openai.yaml` extension file. The rendered files must be ready to use with zero manual edits (though the user may choose to customize further).

Codex implements the same Agent Skills open standard as OpenCode, but extends it with the `agents/openai.yaml` file for UI metadata, invocation policy, and MCP tool dependencies. The generation approach therefore builds on the same SKILL.md structure while adding Codex-specific conventions and the extension file.

#### 4.X.1 Frontmatter Generation

Build the YAML frontmatter block following Codex conventions. Codex prefers minimal frontmatter — only `name` and `description` — with all other metadata moved to `agents/openai.yaml`.

**Field order in frontmatter:**

1. `name` (required) — The skill name from the outline, formatted to meet validation rules:
   - Lowercase alphanumeric characters and hyphens only
   - No leading, trailing, or consecutive hyphens
   - 1-64 characters
   - Must match `^[a-z0-9]+(-[a-z0-9]+)*$`
   - Must match the parent directory name
   - Prefer short, verb-led phrases that describe the action (e.g., `fix-ci`, `plan-mode`)
   - Namespace by tool when it improves clarity (e.g., `gh-fix-ci`, `gh-address-comments`)
   - If the user's name does not conform, normalize it: lowercase, replace spaces and underscores with hyphens, strip invalid characters, collapse consecutive hyphens

2. `description` (required) — The polished description from the outline (Section 1), enriched with trigger scenarios from Section 3 and explicit scope boundaries. The description must:
   - Answer both "what does it do" AND "when should the agent use it"
   - Include explicit scope boundaries (e.g., "Treat external providers as out of scope and report only the details URL")
   - Include specific keywords and trigger phrases for Codex's implicit invocation matching
   - Be 1-1024 characters
   - If the outline description plus trigger scenarios exceeds 1024 characters, prioritize the core description and the most important trigger phrases; trim secondary details

**Codex frontmatter convention:** Do NOT include optional fields (`license`, `compatibility`, `metadata`, `allowed-tools`) in the SKILL.md frontmatter. Move all extended metadata to `agents/openai.yaml`. This follows the Codex skill-creator's explicit guidance: "Do not include any other fields in YAML frontmatter" beyond `name` and `description`.

**Quote all YAML string values** — Codex skills consistently quote string values in frontmatter.

**Frontmatter template:**

```yaml
---
name: "{normalized-skill-name}"
description: "{polished description with trigger keywords and scope boundaries}"
---
```

#### 4.X.2 Body Content Generation

Generate the Markdown body after the frontmatter. Structure the body to follow Codex conventions and best practices.

**Writing style rules:**
- Use imperative/infinitive form (e.g., "Extract text" not "This skill extracts text")
- Prefer concise examples over verbose explanations
- Only add context Codex doesn't already have — Codex is already a capable model
- Challenge each piece of information: "Does Codex really need this?"
- Include information that is beneficial and non-obvious to the model

**Body structure — adapt based on skill complexity:**

**For simple skills** (single-action or short pipeline, minimal configuration):

```markdown
# {Skill Title}

{One-paragraph overview: what the skill does and its primary purpose.}

## Workflow

{Step-by-step instructions for the agent to follow when the skill is invoked.
Each step should be a clear, imperative directive.
Use numbered lists for sequential steps, bullet lists for parallel options.}

## Tips

{Brief tips for common scenarios and edge cases, if applicable.}
```

**For moderate skills** (multi-step workflow, some configuration, reference files):

```markdown
# {Skill Title}

{One-paragraph overview: purpose and primary capabilities.}

## Prerequisites

{Required tools, authentication, setup, or environment variables.}

## Workflow

{Step-by-step instructions organized by phase.
Use numbered lists for sequential steps.}

### {Phase 1}

{Detailed instructions for the first phase.}

### {Phase 2}

{Detailed instructions for the next phase.}

{... additional phases as needed ...}

## References

{Links to reference files for advanced features, if applicable.}

## Tips

{Common issues and solutions.}
```

**For complex skills** (multi-step workflows with branching, conversational loops, extensive features):

```markdown
# {Skill Title}

{One-paragraph overview: purpose, key capabilities, and the problem it solves.}

## Prerequisites

{Required tools, authentication, environment variables, and setup steps.}

## Quick Start

{Minimal example showing the most common invocation.}

## Workflow

{High-level description of the skill's execution flow.
Use numbered lists to describe the stages or phases.}

### {Stage 1}

{Detailed instructions for the first stage.
Include sub-steps as needed.}

### {Stage 2}

{Detailed instructions for the next stage.}

{... additional stages as needed ...}

## {Cross-Cutting Concern} (if applicable)

{Capabilities or behaviors that span multiple stages — e.g., error handling, research, logging.}

## References

{Links to reference files in references/ with clear navigation.}

## Troubleshooting

{Common issues and solutions.}
```

**Body generation rules:**

- **Map outline sections to body sections**: The outline's workflow overview (Section 4) drives the body structure. Each major workflow step becomes a heading (`##`) in the body. Features from Section 2 are woven into the relevant workflow sections, not listed separately.
- **Write as agent instructions**: The body tells the agent what to do, not the user. Use imperative directives: "Read the file...", "Analyze the diff...", "Present the results to the user...". The agent is the audience.
- **Put trigger context in the description, not the body**: Unlike OpenCode, Codex's implicit invocation matches against the `description` field. All "when to use" information belongs in the description. The body focuses purely on "how to execute."
- **Reference external files**: If the outline specifies `references/` or `scripts/` files, include relative-path references in the body (e.g., `See [the API reference](references/api-reference.md) for details.`). Note: this stage generates SKILL.md and optionally agents/openai.yaml — reference, script, and asset files are listed as follow-up actions for the user.
- **Respect token budget**: Target under 5000 tokens for the body content. Keep the main SKILL.md under 500 lines. If the skill is complex and the full instructions would exceed this, split detailed reference material into `references/` files and reference them from the main body. Indicate to the user which reference files to create as follow-up.
- **Use consistent formatting**: Headings (`##`, `###`), numbered lists for sequential steps, bullet lists for options or parallel items, code blocks for examples, bold for emphasis on key terms and rules, tables for structured data.
- **Handle "[Default — please review]" items**: For any outline items that were marked as defaults, generate the content using the default value but keep the generated text easy to locate and modify. Do not carry the "[Default — please review]" markers into the final file.
- **No extraneous files**: Do NOT include instructions to create README.md, INSTALLATION_GUIDE.md, QUICK_REFERENCE.md, or CHANGELOG.md. Only include files needed for the agent to do the job.

#### 4.X.3 agents/openai.yaml Generation

Generate the Codex-specific `agents/openai.yaml` extension file. This file is recommended for all Codex skills and provides UI metadata, invocation policy, and MCP tool dependencies that the Codex harness reads.

**When to generate agents/openai.yaml:**
- **Always generate** when the target platform is Codex — nearly all curated Codex skills include this file
- Include at minimum the `interface` section with `display_name` and `short_description`
- Add `dependencies` section only when the skill uses MCP tools
- Add `policy` section only when the skill should NOT be implicitly invocable (default is `true`)

**Interface section generation:**

Map outline data to interface fields:

| Outline Data | openai.yaml Field | Mapping Notes |
|-------------|-------------------|---------------|
| Skill name (human-readable) | `display_name` | Title case, spaces allowed (e.g., "GitHub Fix CI") |
| Short summary | `short_description` | 25-64 characters; brief UI blurb for quick scanning |
| Asset references | `icon_small`, `icon_large` | Use `./assets/{name}-small.svg` and `./assets/{name}.png` pattern |
| Brand color (if specified) | `brand_color` | Hex color string (e.g., `"#3B82F6"`) |
| Primary use case | `default_prompt` | Must mention skill as `$skill-name`; describes the default action |

**Policy section generation:**

- Include `allow_implicit_invocation: false` only when the outline explicitly states the skill should require explicit invocation
- Omit the entire `policy` section when using defaults (implicit invocation is enabled by default)

**Dependencies section generation:**

If the outline or interview identified MCP tool dependencies:

```yaml
dependencies:
  tools:
    - type: "mcp"
      value: "{tool-identifier}"
      description: "{human-readable explanation}"
      transport: "streamable_http"
      url: "{mcp-server-url}"
```

- Only `type: "mcp"` is currently supported
- Include all MCP tools the skill depends on
- If the user specified tool integrations during the interview, map them to MCP dependency entries
- If the skill uses external APIs but not through MCP, do not add them to dependencies — mention them in the body's Prerequisites section instead

**YAML formatting rules:**
- Quote all string values
- Keep keys unquoted
- Use consistent indentation (2 spaces)

**Complete agents/openai.yaml template:**

```yaml
interface:
  display_name: "{Human-Facing Skill Title}"
  short_description: "{Brief UI blurb, 25-64 chars}"

policy:
  allow_implicit_invocation: true

dependencies:
  tools:
    - type: "mcp"
      value: "{tool-identifier}"
      description: "{Human-readable explanation}"
      transport: "streamable_http"
      url: "{mcp-server-url}"
```

**Minimal agents/openai.yaml template** (no MCP dependencies, default policy):

```yaml
interface:
  display_name: "{Human-Facing Skill Title}"
  short_description: "{Brief UI blurb, 25-64 chars}"
```

#### 4.X.4 Content Mapping Reference

Map interview/outline data to Codex format using this guide:

| Outline Section | Codex Target | Mapping Notes |
|-----------------|--------------|---------------|
| Section 1: Skill Identity — Name | Frontmatter `name` field | Normalize to lowercase, hyphenated format; prefer verb-led phrases |
| Section 1: Skill Identity — Description | Frontmatter `description` field | Merge with trigger scenarios from Section 3 and add scope boundaries |
| Section 2: Key Features | Body — woven into workflow sections | Features are instructions, not a feature list |
| Section 3: Use Cases — Primary | Frontmatter `description` + Body overview | Primary use case drives the description |
| Section 3: Use Cases — Trigger Scenarios | Frontmatter `description` | All triggers go in the description for implicit invocation matching |
| Section 4: Workflow Overview | Body — primary structure (headings, sections) | Each workflow step = a body section |
| Section 5: Platform Config — Display Name | `agents/openai.yaml` `interface.display_name` | Human-readable title case name |
| Section 5: Platform Config — Short Description | `agents/openai.yaml` `interface.short_description` | 25-64 char UI blurb |
| Section 5: Platform Config — Icons/Branding | `agents/openai.yaml` `interface.icon_*`, `brand_color` | Asset paths and hex color |
| Section 5: Platform Config — References | Body — file reference links | Reference paths in body; note files for user to create |
| Section 5: Platform Config — Scripts | Body — script invocation instructions | Script paths in body; note files for user to create |
| Section 5: Platform Config — Token Budget | Body structure decisions | Split into references if exceeding budget |
| Section 6: File Structure | Post-generation summary | Tell user what additional files to create (including `agents/` directory) |
| Section 7: Requirements — Tools (MCP) | `agents/openai.yaml` `dependencies.tools` | Map MCP tool integrations to dependency entries |
| Section 7: Requirements — Tools (non-MCP) | Body — Prerequisites section | Non-MCP tools described in body |
| Section 7: Requirements — Constraints | Body — dedicated section or inline rules | Hard constraints become explicit agent rules |
| Section 7: Requirements — Error Handling | Body — Troubleshooting section or inline | Error behavior as agent instructions |
| Section 7: Requirements — Env Vars | Body — Prerequisites section | Use Codex env var configuration pattern (e.g., `SENTRY_AUTH_TOKEN`) |
| Section 8: Defaults | Body content (default values used) | Remove markers; use default values directly |

#### 4.X.5 Skill Complexity Adaptation

Adjust the generated output based on skill complexity (assessed during the interview):

**Simple skills:**
- Frontmatter: `name` and `description` only (Codex minimal frontmatter convention)
- Body: 3-5 sections, direct and concise
- agents/openai.yaml: `interface` section only (`display_name` + `short_description`)
- No reference files, no scripts
- Total SKILL.md: roughly 30-80 lines

**Moderate skills:**
- Frontmatter: `name` and `description` only
- Body: 5-10 sections with clear structure, includes Prerequisites
- agents/openai.yaml: `interface` section, possibly `dependencies` if MCP tools are used
- May include reference file pointers if content is substantial
- Total SKILL.md: roughly 80-200 lines

**Complex skills:**
- Frontmatter: `name` and `description` only
- Body: 10+ sections with subsections, including Prerequisites, Quick Start, Workflow stages, and Troubleshooting
- agents/openai.yaml: full `interface`, `policy` (if non-default), and `dependencies` sections
- Likely references `references/` files for progressive disclosure
- May include `scripts/` for deterministic tasks
- Total SKILL.md: roughly 200-500 lines (keep under 500; move excess to reference files)

**Key difference from OpenCode**: Codex always uses minimal frontmatter regardless of complexity. All additional metadata goes to `agents/openai.yaml`. The agents/openai.yaml file grows with complexity, not the frontmatter.

### 4.3 Output Path Selection

After rendering the skill file content in memory, prompt the user for the output location before writing anything to disk.

#### 4.3.1 Path Prompt

Use `AskUserQuestion` to ask the user where to save the skill file.

**Prompt** — adapt phrasing to experience level and target platform:

*Beginner (OpenCode):*
> Your skill file is ready! Where would you like me to save it?
>
> I need a directory path. The skill will be saved as `{skill-name}/SKILL.md` inside the directory you specify. For example:
> - `.opencode/skills` — makes it available in this project for OpenCode
> - `.claude/skills` — makes it available in this project for Claude Code and OpenCode
> - `~/.config/opencode/skills` — makes it available globally for all OpenCode projects
>
> Enter the directory path, or press Enter for the default: `.opencode/skills`

*Beginner (GAS):*
> Your skill file is ready! Where would you like me to save it?
>
> I need a directory path. The skill will be saved as `{skill-name}/SKILL.md` inside the directory you specify. For example:
> - `.agents/skills` — makes it available in this project for any compatible agent (recommended for portability)
> - `.claude/skills` — makes it available in this project for Claude Code and OpenCode
> - `~/.agents/skills` — makes it available globally for all projects
>
> Enter the directory path, or press Enter for the default: `.agents/skills`

*Beginner (Codex):*
> Your skill file is ready! Where would you like me to save it?
>
> I need a directory path. The skill will be saved as `{skill-name}/SKILL.md` (and `{skill-name}/agents/openai.yaml` if configured) inside the directory you specify. For example:
> - `.agents/skills` — makes it available in this project for Codex
> - `~/.agents/skills` — makes it available globally for all your projects
>
> Enter the directory path, or press Enter for the default: `.agents/skills`

*Intermediate / Advanced (OpenCode):*
> Where should I save the skill? Provide the parent directory path (the skill will be written to `{skill-name}/SKILL.md` within it).
>
> Common paths: `.opencode/skills`, `.claude/skills`, `~/.config/opencode/skills`
>
> Default: `.opencode/skills`

*Intermediate / Advanced (GAS):*
> Where should I save the skill? Provide the parent directory path (the skill will be written to `{skill-name}/SKILL.md` within it).
>
> Common paths: `.agents/skills` (cross-platform), `.claude/skills`, `~/.agents/skills` (global)
>
> Default: `.agents/skills`

*Intermediate / Advanced (Codex):*
> Where should I save the skill? Provide the parent directory path (the skill will be written to `{skill-name}/SKILL.md` and `{skill-name}/agents/openai.yaml` within it).
>
> Common paths: `.agents/skills` (project), `~/.agents/skills` (user global)
>
> Default: `.agents/skills`

**Platform-specific defaults:**
- **OpenCode**: `.opencode/skills`
- **GAS**: `.agents/skills`
- **Codex**: `.agents/skills`

**Handling the response:**
- If the user provides a path, use it as the parent directory
- If the user provides an empty response or says "default", use the platform-specific default path relative to the current working directory
- If the user provides a full file path ending in `SKILL.md` or `.md`, extract the directory portion and use that
- If the user provides a path that already includes the skill name directory, detect this and do not double-nest (e.g., if they provide `.agents/skills/my-skill`, write to `.agents/skills/my-skill/SKILL.md`, not `.agents/skills/my-skill/my-skill/SKILL.md`)

**Construct the full output path:**
```
{user-provided-directory}/{skill-name}/SKILL.md
```

Where `{skill-name}` is the normalized name from frontmatter generation.

#### 4.3.2 Directory Handling

Before writing the file, check whether the target directory exists.

**If the directory exists:** Proceed to the overwrite check (4.3.3).

**If the directory does not exist:**
- Create the full directory path (including the `{skill-name}/` subdirectory) using `Bash` with `mkdir -p`
- If directory creation fails (permissions, invalid path), report the error clearly and re-prompt the user for a different path via `AskUserQuestion`:
  > I could not create the directory `{path}`: {error message}. Please provide a different output path.

#### 4.3.3 Overwrite Protection

Before writing, check if a file already exists at the target path using `Bash` to test for file existence.

**If the file does not exist:** Proceed to writing (4.4).

**If the file exists:**

Prompt the user via `AskUserQuestion`:

> A file already exists at `{full-path}`. What would you like to do?
> 1. **Overwrite** — Replace the existing file with the new skill
> 2. **Choose a different path** — Specify a new output location
> 3. **Cancel** — Do not write the file (I'll show you the content so you can copy it manually)

**Handle the response:**
- **Overwrite**: Proceed to writing (4.4). The `Write` tool will overwrite the existing file.
- **Different path**: Return to the path prompt (4.3.1) and repeat the flow with the new path
- **Cancel**: Display the full generated skill file content as text output so the user can copy it manually. Skip the file writing step. Still present the post-generation summary (4.5).

### 4.4 File Writing

Write the generated skill files to the resolved output path using the `Write` tool.

**Before writing:**
1. Read the target file if it exists (required by the Write tool for overwrites)
2. Assemble the complete file content: frontmatter block + blank line + body content

**Write SKILL.md:**
- Use the `Write` tool with the full absolute path
- The content should be the complete SKILL.md file (frontmatter + body) as a single string

**Write agents/openai.yaml (Codex only):**
- If the target platform is Codex and an `agents/openai.yaml` file was generated (see 4.X.3):
  1. Create the `agents/` subdirectory inside the skill directory using `Bash` with `mkdir -p`
  2. Write the `agents/openai.yaml` content using the `Write` tool
  3. The path is `{skill-directory}/agents/openai.yaml`
- If the `agents/` directory or `openai.yaml` file already exists, apply the same overwrite protection logic as SKILL.md (prompt the user)

**If all writes succeed:** Proceed to the post-generation summary (4.5).

**If any write fails:**
- Report the error clearly to the user
- Display the full generated file content as text output so the user can copy it manually
- Provide the error details so the user can troubleshoot (e.g., permissions, disk space)
- If SKILL.md succeeded but agents/openai.yaml failed, note that the skill will still work without the extension file but will lack Codex UI metadata

### 4.5 Post-Generation Summary

After writing the file (or displaying it for manual copy), present a summary to the user.

**Summary content:**

1. **File location**: The full path where the file was written (or note that it was displayed for manual copy)

2. **Additional files to create**: If the outline specified `references/`, `scripts/`, `assets/`, or `agents/` directories, list each file the user should create manually along with a brief description of its intended content:
   > **Follow-up files to create:**
   > - `{skill-name}/references/{filename}` — {description of what this file should contain}
   > - `{skill-name}/scripts/{filename}` — {description of what this script should do}
   > - (Codex only) `{skill-name}/agents/openai.yaml` — generated alongside SKILL.md; note if icon assets need to be created separately
   > - (Codex only) `{skill-name}/assets/{icon-files}` — icon files referenced in `agents/openai.yaml` (if applicable)

3. **Installation path guidance** (adapt to experience level and platform):
   - **OpenCode**: `.opencode/skills/`, `.claude/skills/`, or `~/.config/opencode/skills/` (global)
   - **GAS**: `.agents/skills/` (recommended for cross-platform discovery), or platform-specific paths
   - **Codex**: `.agents/skills/` (Codex scans from CWD up to repo root), or `~/.agents/skills/` (user scope)
   - For beginners: Explain where to place the skill directory for it to be discovered by the agent, with platform-specific path examples
   - For intermediate/advanced: Brief reminder of discovery paths if the chosen output path is non-standard

4. **Validation note**: Reference the structural validation results from the validation engine (see Structural Validation section):
   - Include the validation status (PASS, PASS with fixes, or WARNING) from the validation report
   - If auto-fixes were applied, summarize what was corrected
   - If unfixable warnings exist, reiterate them so the user has a final reminder
   - Platform-specific context:
     - **OpenCode**: Validated against the Agent Skills open standard (agentskills.io)
     - **GAS**: Validated against the Agent Skills open standard with portability checks
     - **Codex**: Validated against the Agent Skills standard for SKILL.md and Codex conventions for `agents/openai.yaml`
   - If any "[Default — please review]" items from the outline were used, note which sections contain defaulted content that may need review
   - Include any quality suggestions from the validation report that the user may want to address

5. **Next steps**: Brief suggestions for what to do next:
   - Test the skill by invoking it in the target agent
   - Review and customize the generated content
   - Create any follow-up files listed above
   - If reference files were specified but not generated, note that the skill will work without them but the reference file links in the body will not resolve until created

**Summary format** — adapt to experience level:

*Beginner:*
> Present a detailed, friendly summary with explanations of each follow-up item and what it means. Include installation instructions.

*Advanced:*
> Present a concise summary — file path, follow-up files (if any), and any notes. Skip explanations of standard concepts.

---

## Research Layer

Cross-cutting research capabilities available to all pipeline stages.

### Embedded Platform Knowledge

Use the platform-specific knowledge sections below as the primary reference when generating skill files. When dynamic documentation (Context7, web search) is available and conflicts with embedded knowledge, prefer the dynamically fetched version and note the discrepancy to the user.

#### OpenCode Platform Knowledge

**Version Metadata:**
- spec_version: "2026-03"
- spec_last_verified: "2026-03-07"
- source_url: https://agentskills.io/specification
- opencode_docs_url: https://opencode.ai/docs/skills
- docs_site_version: "0.0.2611"
- notes: OpenCode implements the Agent Skills open standard (agentskills.io). No formal semantic versioning exists for the spec; use docs-last-updated date as the reference point.

##### Format Reference

**File structure:**

```
skill-name/
  SKILL.md          # Required — YAML frontmatter + Markdown instructions
  scripts/           # Optional — executable scripts the agent can run
  references/        # Optional — additional documentation loaded on demand
  assets/            # Optional — static resources (templates, images, data)
```

**SKILL.md format:**

The file MUST contain YAML frontmatter delimited by `---` on its own line, followed by a Markdown body:

```markdown
---
name: skill-name
description: What this skill does and when to use it.
---

# Skill Title

Instructions in Markdown...
```

**Frontmatter fields — Required:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | 1-64 chars; lowercase alphanumeric + hyphens; no leading, trailing, or consecutive hyphens; must match parent directory name | Unique identifier for the skill |
| `description` | string | 1-1024 chars; non-empty | What the skill does and when to use it; include keywords for agent discoverability |

**Frontmatter fields — Optional:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `license` | string | No length limit specified | License name (e.g., `MIT`, `Apache-2.0`) or reference to bundled license file (e.g., `Complete terms in LICENSE.txt`) |
| `compatibility` | string | 1-500 chars if provided | Environment requirements — target product, system packages, network access (e.g., `opencode`) |
| `metadata` | map[string]string | String keys to string values | Arbitrary key-value pairs for additional properties (e.g., `author`, `version`, `audience`, `workflow`) |
| `allowed-tools` | string | Space-delimited tool names | Pre-approved tools the skill may use. **Experimental** — support varies by agent; OpenCode silently ignores this field |

**Name validation regex:** `^[a-z0-9]+(-[a-z0-9]+)*$`

Note: OpenCode's source code uses `^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$` (allows mixed case), but the agentskills.io spec requires lowercase only. Always generate lowercase names for maximum portability.

**Unknown fields:** Any frontmatter fields not in the spec are silently ignored (not treated as errors).

**File discovery paths (OpenCode-specific):**

OpenCode searches these locations in order (project-local paths walk up from cwd to git worktree root):

| Location | Path Pattern |
|----------|-------------|
| Project OpenCode | `.opencode/skills/<name>/SKILL.md` |
| Global OpenCode | `~/.config/opencode/skills/<name>/SKILL.md` |
| Project Claude-compat | `.claude/skills/<name>/SKILL.md` |
| Global Claude-compat | `~/.claude/skills/<name>/SKILL.md` |
| Project Agent-compat | `.agents/skills/<name>/SKILL.md` |
| Global Agent-compat | `~/.agents/skills/<name>/SKILL.md` |

##### Key Conventions

**How OpenCode skills differ from other platforms:**
- OpenCode adopts the Agent Skills open standard (agentskills.io) directly; it does NOT use a proprietary format
- Skills are cross-compatible with Claude Code and other Agent Skills-compatible platforms
- OpenCode exposes skills through a native `skill` tool that agents call by name
- Skill permissions are configurable via `opencode.json` using glob patterns (allow/deny/ask)
- Per-agent permission overrides are supported in both markdown agent frontmatter and JSON config

**Best practices for OpenCode skill content:**
- **Description quality**: Write long, keyword-rich descriptions that list specific trigger scenarios. The description is the primary mechanism for agent discoverability.
  - Good: "Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction."
  - Poor: "Helps with PDFs."
- **Progressive disclosure**: Keep the main SKILL.md under 500 lines and under 5000 tokens. Move detailed reference material to `references/` files.
- **Body structure**: Start with an overview/purpose section, then provide detailed step-by-step instructions. Use clear Markdown headings, code blocks, and tables.
- **File references**: Use relative paths from the skill root (e.g., `references/REFERENCE.md`, `scripts/extract.py`).
- **Minimal frontmatter**: Only include optional fields when they add value. Most skills need only `name` and `description`.
- **License field**: Use a short identifier (`MIT`, `Apache-2.0`) or reference a bundled file (`Complete terms in LICENSE.txt`).
- **Metadata field**: Use for categorization when needed (e.g., `audience: maintainers`, `workflow: github`), but omit when there is no specific need.

**Common patterns in well-written OpenCode skills:**
1. Description always answers "what does it do" AND "when should the agent use it"
2. Body starts with a brief overview then moves to structured instructions
3. Complex skills use reference files for progressive disclosure
4. Scripts are self-contained with clear error messages
5. Token budget is respected: ~100 tokens for metadata (loaded at startup), <5000 tokens for instructions (loaded on activation), reference/asset files loaded on demand

##### Validation Rules

Use these rules to validate a generated OpenCode skill file before presenting it to the user.

**Required fields checklist:**
- [ ] `name` field is present and non-empty
- [ ] `name` is 1-64 characters
- [ ] `name` matches regex `^[a-z0-9]+(-[a-z0-9]+)*$`
- [ ] `name` matches the parent directory name
- [ ] `description` field is present and non-empty
- [ ] `description` is 1-1024 characters
- [ ] Frontmatter starts with `---` on its own line
- [ ] Frontmatter ends with `---` on its own line
- [ ] Markdown body follows the frontmatter

**Optional field constraints (validate only if present):**
- [ ] `compatibility` is 1-500 characters if provided
- [ ] `metadata` values are all strings (map[string]string)
- [ ] `allowed-tools` is a space-delimited string of tool names if provided

**Format constraints:**
- File must be named `SKILL.md` (all caps)
- File must reside in a directory whose name matches the `name` field
- YAML frontmatter must be valid YAML
- Body content must be valid Markdown

**Common mistakes to avoid:**
- Using uppercase or mixed-case characters in `name` (use lowercase only)
- Starting or ending `name` with a hyphen
- Using consecutive hyphens (`--`) in `name`
- Mismatching the directory name and the `name` field
- Leaving `description` empty or too vague for agent discoverability
- Exceeding the 1024-character limit on `description`
- Exceeding the 500-character limit on `compatibility`
- Omitting frontmatter delimiters (`---`)
- Adding `allowed-tools` expecting it to work reliably (it is experimental and silently ignored by OpenCode)

##### Documentation Gaps

The following areas have limited or ambiguous documentation and may benefit from dynamic fetching:
- The `allowed-tools` field is experimental with no clear specification of supported tool names or behavior across agents
- The `compatibility` field has no standard vocabulary; usage varies (e.g., "opencode", "claude-code" are conventions, not enforced values)
- Body content size limits (500 lines, 5000 tokens) are guidelines, not enforced limits
- The spec has no formal versioning; breaking changes could occur without a version bump
- OpenCode repo transitioned from opencode-ai/opencode (archived) to charmbracelet/crush; documentation at opencode.ai remains authoritative

#### Generic Agent Skills (GAS) Platform Knowledge

**Version Metadata:**
- spec_version: "2026-03"
- spec_last_verified: "2026-03-07"
- source_url: https://agentskills.io/specification
- github_url: https://github.com/agentskills/agentskills
- docs_site_version: "0.0.2611"
- notes: GAS is the open standard for portable agent skills, originally developed by Anthropic. No formal semantic versioning exists for the spec; use the docs-last-updated date as the reference point.

##### Format Reference

**File structure:**

```
skill-name/
  SKILL.md          # Required — YAML frontmatter + Markdown instructions
  scripts/           # Optional — executable scripts the agent can run
  references/        # Optional — additional documentation loaded on demand
  assets/            # Optional — static resources (templates, images, data)
```

**SKILL.md format:**

The file MUST contain YAML frontmatter delimited by `---` on its own line, followed by a Markdown body:

```markdown
---
name: skill-name
description: What this skill does and when to use it.
---

# Skill Title

Instructions in Markdown...
```

**Frontmatter fields — Required:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | 1-64 chars; lowercase alphanumeric + hyphens; no leading, trailing, or consecutive hyphens; must match parent directory name | Unique identifier for the skill |
| `description` | string | 1-1024 chars; non-empty | What the skill does and when to use it; include keywords for agent discoverability |

**Frontmatter fields — Optional (GAS core spec):**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `license` | string | No length limit specified | License name (e.g., `MIT`, `Apache-2.0`) or reference to bundled license file (e.g., `Complete terms in LICENSE.txt`) |
| `compatibility` | string | 1-500 chars if provided | Environment requirements — target product, system packages, network access |
| `metadata` | map[string]string | String keys to string values | Arbitrary key-value pairs for additional properties (e.g., `author`, `version`, `audience`) |
| `allowed-tools` | string | Space-delimited tool names | Pre-approved tools the skill may use. **Experimental** — support varies by agent implementation |

**Implementation-specific extension fields (NOT part of GAS core spec):**

These fields are used by specific agent implementations and are silently ignored by implementations that do not recognize them. They are safe to include without breaking cross-platform compatibility.

| Field | Type | Used By | Description |
|-------|------|---------|-------------|
| `argument-hint` | string | Claude Code | Display hint for skill arguments (e.g., `"[context-file-or-text]"`) |
| `user-invocable` | boolean | Claude Code | Whether users can invoke the skill directly (vs. only agent-invocable) |
| `disable-model-invocation` | boolean | Claude Code | When true, prevents the model from invoking the skill autonomously |
| `arguments` | array of objects | Claude Code | Typed argument definitions with `name`, `description`, and `required` properties |

**Name validation regex:** `^[a-z0-9]+(-[a-z0-9]+)*$`

**Unknown fields:** Any frontmatter fields not defined in the spec are silently ignored by all known implementations. This is the mechanism that enables platform-specific extensions — implementations that do not understand a field simply skip it.

**File naming conventions:**
- The main file MUST be named `SKILL.md` (all uppercase)
- The parent directory name MUST match the `name` frontmatter field
- Directory names follow the same rules as the `name` field (lowercase alphanumeric + hyphens)

**Recommended discovery path:** `.agents/skills/<name>/SKILL.md` (the agent-agnostic standard path, recognized by Claude Code, OpenCode, and other compatible agents)

##### Key Conventions

**How GAS skills differ from OpenCode and Codex:**
- GAS is the base open standard; OpenCode adopts it directly, so GAS and OpenCode skills are structurally identical
- GAS skills are inherently portable across all compliant agent implementations (Claude Code, OpenCode/Crush, and any future adopters)
- Codex does NOT implement the GAS standard; cross-compatibility with Codex requires format translation, not just field mapping
- GAS defines only the file format and metadata schema; invocation mechanisms, permission models, and discovery paths are platform-dependent
- Extension fields (like Claude Code's `arguments`) coexist safely with core fields — unknown fields are silently ignored

**Best practices for GAS skill content:**
- **Description quality**: Write long, keyword-rich descriptions that list specific trigger scenarios. The description is the primary mechanism for agent discoverability across all platforms.
  - Good: "Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction."
  - Poor: "Helps with PDFs."
- **Progressive disclosure**: Keep the main SKILL.md under 500 lines and under 5000 tokens. Move detailed reference material to `references/` files. Token budget: ~100 tokens for metadata (loaded at startup), <5000 tokens for instructions (loaded on activation), reference/asset files loaded on demand.
- **Body structure**: Start with an overview/purpose section, then provide detailed step-by-step instructions. Use clear Markdown headings, code blocks, and tables.
- **File references**: Use relative paths from the skill root (e.g., `references/REFERENCE.md`, `scripts/extract.py`). Keep references one level deep from SKILL.md.
- **Minimal frontmatter**: Only include optional fields when they add value. Most skills need only `name` and `description`.
- **License field**: Use a short identifier (`MIT`, `Apache-2.0`) or reference a bundled file (`Complete terms in LICENSE.txt`).
- **Metadata field**: Use for categorization when needed (e.g., `audience: maintainers`, `workflow: github`), but omit when there is no specific need.

**Portability considerations:**
- Always use lowercase-only names — the spec requires it, even if some implementations tolerate mixed case
- Stick to core GAS fields (`name`, `description`, `license`, `compatibility`, `metadata`) for maximum portability
- Extension fields are safe to include — they are silently ignored by non-supporting implementations
- Do not rely on `allowed-tools` for critical functionality — it is experimental and inconsistently supported
- Place skills in `.agents/skills/<name>/` for broadest cross-platform discovery
- Avoid platform-specific assumptions in the Markdown body (e.g., referencing Claude Code-specific tools by name)

**Common patterns in well-written GAS skills:**
1. Description always answers "what does it do" AND "when should the agent use it"
2. Body starts with a brief overview then moves to structured instructions
3. Complex skills use `references/` subdirectory for progressive disclosure
4. Scripts in `scripts/` are self-contained with clear error messages
5. Token budget is respected across the three tiers (metadata, instructions, resources)
6. Only `name` and `description` in frontmatter unless optional fields add clear value
7. Extension fields are included only when targeting a specific implementation

##### Validation Rules

Use these rules to validate a generated GAS skill file before presenting it to the user.

**Required fields checklist:**
- [ ] `name` field is present and non-empty
- [ ] `name` is 1-64 characters
- [ ] `name` matches regex `^[a-z0-9]+(-[a-z0-9]+)*$`
- [ ] `name` matches the parent directory name
- [ ] `description` field is present and non-empty
- [ ] `description` is 1-1024 characters
- [ ] Frontmatter starts with `---` on its own line
- [ ] Frontmatter ends with `---` on its own line
- [ ] Markdown body follows the frontmatter

**Optional field constraints (validate only if present):**
- [ ] `compatibility` is 1-500 characters if provided
- [ ] `metadata` values are all strings (map[string]string)
- [ ] `allowed-tools` is a space-delimited string of tool names if provided

**Extension field constraints (validate only if targeting a specific platform):**
- [ ] `argument-hint` is a string if provided (Claude Code)
- [ ] `user-invocable` is a boolean if provided (Claude Code)
- [ ] `disable-model-invocation` is a boolean if provided (Claude Code)
- [ ] `arguments` is an array of objects with `name`, `description`, and `required` fields if provided (Claude Code)

**Format constraints:**
- File must be named `SKILL.md` (all caps)
- File must reside in a directory whose name matches the `name` field
- YAML frontmatter must be valid YAML
- Body content must be valid Markdown

**Common mistakes to avoid:**
- Using uppercase or mixed-case characters in `name` (use lowercase only)
- Starting or ending `name` with a hyphen
- Using consecutive hyphens (`--`) in `name`
- Mismatching the directory name and the `name` field
- Leaving `description` empty or too vague for agent discoverability
- Exceeding the 1024-character limit on `description`
- Exceeding the 500-character limit on `compatibility`
- Omitting frontmatter delimiters (`---`)
- Adding `allowed-tools` expecting it to work reliably across all platforms (it is experimental)
- Using Claude Code extension fields and expecting them to be processed by other implementations (they are silently ignored, not errors, but the functionality will not be available)

##### Documentation Gaps

The following areas have limited or ambiguous documentation and may benefit from dynamic fetching:
- The `allowed-tools` field is experimental with no standard vocabulary of tool names; behavior varies between implementations (Claude Code supports it, OpenCode silently ignores it)
- The `compatibility` field has no standard vocabulary; values like "opencode" and "claude-code" are conventions, not enforced or registered values
- Body content size limits (500 lines, 5000 tokens) are guidelines, not enforced limits; real-world skills exceed them
- The spec has no formal versioning scheme; breaking changes could occur without a version bump
- Extension field behavior relies on the "silently ignored" convention; there is no formal extension mechanism, namespacing, or prefix convention to distinguish core from extension fields
- The `allowed-tools` format differs between spec (space-delimited string) and Claude Code implementation (YAML list); both are accepted in practice

#### Codex Platform Knowledge

**Version Metadata:**
- spec_version: "2026-03"
- spec_last_verified: "2026-03-07"
- source_url: https://developers.openai.com/codex/skills
- agent_skills_spec_url: https://agentskills.io/specification
- official_skills_repo: https://github.com/openai/skills
- notes: Codex implements the Agent Skills open standard (agentskills.io) for SKILL.md and extends it with a Codex-specific `agents/openai.yaml` file for UI metadata, invocation policy, and MCP tool dependencies. No formal semantic versioning exists for either the skill format or the openai.yaml schema; use docs-last-verified date as the reference point.

##### Format Reference

**File structure:**

```
skill-name/
  SKILL.md              # Required — YAML frontmatter + Markdown instructions
  agents/
    openai.yaml         # Recommended — Codex-specific UI metadata, invocation policy, and MCP tool dependencies
  scripts/              # Optional — executable scripts (Python, Bash, etc.) for deterministic tasks
  references/           # Optional — additional documentation loaded on demand
  assets/               # Optional — static resources (templates, icons, images, data)
```

The `agents/` directory is the Codex-specific extension. Other platforms ignore it. The `agents/openai.yaml` file provides UI-facing metadata for skill lists and chips in the Codex app.

**SKILL.md format:**

The file MUST contain YAML frontmatter delimited by `---` on its own line, followed by a Markdown body:

```markdown
---
name: skill-name
description: What this skill does and when to use it.
---

# Skill Title

Instructions in Markdown...
```

**Frontmatter fields — Required:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | 1-64 chars; lowercase alphanumeric + hyphens; no leading, trailing, or consecutive hyphens; must match parent directory name | Unique identifier for the skill |
| `description` | string | 1-1024 chars; non-empty | What the skill does and when to use it; this is the primary triggering mechanism for implicit invocation — Codex matches user prompts against descriptions to decide which skill to activate |

**Frontmatter fields — Optional:**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `license` | string | No length limit specified | License name (e.g., `MIT`) or reference to bundled license file (e.g., `Complete terms in LICENSE.txt`) |
| `compatibility` | string | 1-500 chars if provided | Environment requirements — target product, system packages, network access |
| `metadata` | map[string]string | String keys to string values | Arbitrary key-value pairs (e.g., `short-description`). Note: Codex prefers moving metadata to `agents/openai.yaml` instead |
| `allowed-tools` | string | Space-delimited tool names | Pre-approved tools the skill may use. **Experimental** — not actively used by Codex; the Codex skill-creator instructs to not include this field |

**Name validation regex:** `^[a-z0-9]+(-[a-z0-9]+)*$`

Naming conventions from official Codex skills:
- Prefer short, verb-led phrases that describe the action (e.g., `fix-ci`, `plan-mode`)
- Namespace by tool when it improves clarity (e.g., `gh-fix-ci`, `gh-address-comments`)
- Normalize user-provided titles to hyphen-case (e.g., "Plan Mode" -> `plan-mode`)

**Unknown fields:** Any frontmatter fields not in the spec are silently ignored (consistent with Agent Skills spec).

**Codex frontmatter convention:** The Codex skill-creator explicitly instructs: "Do not include any other fields in YAML frontmatter" beyond `name` and `description`. Codex prefers minimal frontmatter with extended metadata moved to `agents/openai.yaml`.

**agents/openai.yaml format:**

```yaml
interface:
  display_name: "Human-Facing Skill Title"
  short_description: "Brief UI blurb for quick scanning"
  icon_small: "./assets/icon-small.svg"
  icon_large: "./assets/icon-large.png"
  brand_color: "#3B82F6"
  default_prompt: "Default prompt snippet; must mention skill as $skill-name"

policy:
  allow_implicit_invocation: true

dependencies:
  tools:
    - type: "mcp"
      value: "tool-identifier"
      description: "Human-readable explanation"
      transport: "streamable_http"
      url: "https://example.com/mcp"
```

**agents/openai.yaml fields — Interface (all optional):**

| Field | Description | Constraints |
|-------|-------------|-------------|
| `display_name` | Human-facing title shown in UI skill lists and chips | Quoted string |
| `short_description` | Short UI blurb for quick scanning | 25-64 chars |
| `icon_small` | Path to small icon asset (relative to skill dir) | Relative path, placed in `assets/` |
| `icon_large` | Path to larger logo asset (relative to skill dir) | Relative path, placed in `assets/` |
| `brand_color` | Hex color for UI accents (badges, chips) | Hex color string (e.g., `"#3B82F6"`) |
| `default_prompt` | Default prompt snippet inserted when invoking | Must mention skill as `$skill-name` |

**agents/openai.yaml fields — Policy (all optional):**

| Field | Default | Description |
|-------|---------|-------------|
| `allow_implicit_invocation` | `true` | When `false`, Codex won't implicitly invoke based on user prompt; explicit `$skill-name` invocation still works |

**agents/openai.yaml fields — Dependencies (optional):**

| Field | Description |
|-------|-------------|
| `tools[].type` | Dependency category; only `mcp` is currently supported |
| `tools[].value` | Identifier of the tool or dependency |
| `tools[].description` | Human-readable explanation of the dependency |
| `tools[].transport` | Connection type (e.g., `streamable_http`) |
| `tools[].url` | MCP server URL |

**YAML formatting rules for openai.yaml:** Quote all string values; keep keys unquoted.

**File discovery paths (Codex-specific):**

Codex scans for skills in multiple scopes, from most specific to broadest:

| Scope | Location | Suggested Use |
|-------|----------|---------------|
| REPO (CWD) | `$CWD/.agents/skills/` | Skills for a specific module or microservice |
| REPO (parent) | `$CWD/../.agents/skills/` | Skills shared across sibling modules |
| REPO (root) | `$REPO_ROOT/.agents/skills/` | Organization-wide repo skills |
| USER | `$HOME/.agents/skills/` | Personal skills across all repos |
| ADMIN | `/etc/codex/skills/` | Machine/container-level default skills (unique to Codex) |
| SYSTEM | Bundled with Codex | OpenAI-provided skills (skill-creator, skill-installer, openai-docs) |

Codex uses `.agents/skills/` exclusively (not `.opencode/skills/` or `.claude/skills/`). Codex supports symlinked skill folders and scans every directory from CWD up to the git repository root. If two skills share the same `name`, Codex does NOT merge them; both appear in skill selectors.

##### Key Conventions

**How Codex skills differ from OpenCode and GAS:**
- Codex extends the Agent Skills standard with `agents/openai.yaml` — a Codex-specific file for UI metadata, invocation policy, and MCP tool dependencies. This extension has no equivalent in GAS or OpenCode.
- Codex uses `.agents/skills/` directory path exclusively; OpenCode supports multiple path patterns (`.opencode/`, `.claude/`, `.agents/`).
- Codex has an admin scope (`/etc/codex/skills/`) and system-bundled skills not found in GAS or OpenCode.
- Codex supports implicit invocation via description-based semantic matching; OpenCode uses explicit `skill()` tool calls.
- Codex uses `$skill-name` syntax for explicit invocation; OpenCode uses a `skill({ name: "..." })` tool call.
- Codex uses TOML config (`~/.codex/config.toml`); OpenCode uses JSON config (`opencode.json`).
- Codex enforces lowercase names (aligned with GAS spec); OpenCode's source allows mixed case.
- Codex has built-in skill management tools: `$skill-installer` (install from GitHub URLs) and `$skill-creator`.
- Codex supports MCP dependency declaration in `agents/openai.yaml`; OpenCode and GAS do not.

**Best practices for Codex skill content:**
- **Description is the trigger**: Include all "when to use" information in the `description` field, not in the body. Codex's implicit invocation matches user prompts against descriptions.
  - Good: "Use when tasks involve reading, creating, or reviewing PDF files where rendering and layout matter; prefer visual checks by rendering pages (Poppler) and use Python tools such as `reportlab`, `pdfplumber`, and `pypdf` for generation and extraction."
  - Poor: "Helps with PDFs."
- **Scope boundaries**: Include explicit scope limits in the description (e.g., "Treat external providers as out of scope and report only the details URL").
- **Minimal frontmatter**: Only include `name` and `description` in YAML frontmatter. Move all other metadata to `agents/openai.yaml`.
- **Quoted YAML values**: Codex skills consistently quote string values in frontmatter.
- **Progressive disclosure**: Keep main SKILL.md under 500 lines and under 5000 tokens. Move detailed reference material to `references/` files. Only add context Codex doesn't already have.
- **Body structure**: Use imperative/infinitive form (e.g., "Extract text" not "This skill extracts text"). Start with an overview, then prerequisites, then step-by-step workflow, then references and tips.
- **Asset conventions**: Icons follow `./assets/{name}-small.svg` and `./assets/{name}.png` pattern.
- **LICENSE.txt**: Bundle license terms as a separate file, not embedded in frontmatter.
- **No extraneous files**: Do NOT create README.md, INSTALLATION_GUIDE.md, QUICK_REFERENCE.md, or CHANGELOG.md. Only include files needed for the agent to do the job.

**Common patterns in well-written Codex skills:**
1. Description always answers "what does it do" AND "when should the agent use it" with explicit scope boundaries
2. Nearly all curated skills include `agents/openai.yaml` with at least `interface` and optionally `dependencies`
3. Body uses imperative writing style with concise examples over verbose explanations
4. Complex skills split into SKILL.md + references/ with clear navigation
5. Scripts are used for deterministic reliability or tasks that would otherwise be repeatedly rewritten
6. Token budget is respected: ~100 tokens for metadata (loaded at startup), <5000 tokens for instructions (loaded on activation), reference/asset files loaded on demand
7. Env var configuration pattern for external services (e.g., `SENTRY_AUTH_TOKEN`)

##### Validation Rules

Use these rules to validate a generated Codex skill file before presenting it to the user.

**Required fields checklist (SKILL.md):**
- [ ] `name` field is present and non-empty
- [ ] `name` is 1-64 characters
- [ ] `name` matches regex `^[a-z0-9]+(-[a-z0-9]+)*$`
- [ ] `name` matches the parent directory name
- [ ] `description` field is present and non-empty
- [ ] `description` is 1-1024 characters
- [ ] Frontmatter starts with `---` on its own line
- [ ] Frontmatter ends with `---` on its own line
- [ ] Markdown body follows the frontmatter

**Optional field constraints (validate only if present):**
- [ ] `compatibility` is 1-500 characters if provided
- [ ] `metadata` values are all strings (map[string]string)
- [ ] `allowed-tools` is a space-delimited string of tool names if provided

**Format constraints:**
- File must be named `SKILL.md` (all caps)
- File must reside in a directory whose name matches the `name` field
- YAML frontmatter must be valid YAML
- Body content must be valid Markdown
- YAML string values should be quoted (Codex convention)

**agents/openai.yaml validation (validate only if present):**
- [ ] File is valid YAML
- [ ] All string values are quoted
- [ ] `interface.short_description` is 25-64 characters if provided
- [ ] `interface.icon_small` and `interface.icon_large` are relative paths if provided
- [ ] `interface.brand_color` is a valid hex color string if provided
- [ ] `interface.default_prompt` mentions the skill as `$skill-name` if provided
- [ ] `policy.allow_implicit_invocation` is a boolean if provided
- [ ] `dependencies.tools[].type` is `mcp` (only supported type)
- [ ] `dependencies.tools[].url` is a valid URL if type is `mcp`

**Common mistakes to avoid:**
- Using uppercase or mixed-case characters in `name` (use lowercase only)
- Starting or ending `name` with a hyphen
- Using consecutive hyphens (`--`) in `name`
- Mismatching the directory name and the `name` field
- Leaving `description` empty or too vague for implicit invocation matching
- Exceeding the 1024-character limit on `description`
- Putting "when to use" information in the body instead of the description
- Including extra frontmatter fields beyond `name` and `description` (move to `agents/openai.yaml`)
- Forgetting to quote string values in YAML
- Creating extraneous files (README.md, CHANGELOG.md, etc.)
- Adding `allowed-tools` expecting it to work (not actively used by Codex)
- Exceeding 500 lines or 5000 tokens in SKILL.md (use `references/` for overflow)
- Missing `$skill-name` reference in `default_prompt` within `agents/openai.yaml`

##### Documentation Gaps

The following areas have limited or ambiguous documentation and may benefit from dynamic fetching:
- The `agents/openai.yaml` schema is not versioned and is documented only through examples and the skill-creator's reference file; it may evolve without notice
- The `allowed-tools` field is experimental and not actively used by Codex; the skill-creator instructs to not include it
- The `metadata` field usage is transitional — some skills use `metadata.short-description` in frontmatter, but the preferred approach is `agents/openai.yaml` `interface.short_description`
- The implicit invocation algorithm (how Codex matches prompts to descriptions) is opaque; thresholds and ranking logic are undocumented
- It is unclear whether Codex blocks skill execution if declared MCP dependencies are unavailable or lets the skill handle the failure
- The `/etc/codex/skills/` admin path availability may depend on installation method and platform
- The Codex skills documentation is actively evolving; features marked as "experimental" may change substantially

### Dynamic Documentation Fetching

Use Context7 MCP tools to fetch the latest platform documentation at runtime. Dynamic fetching supplements embedded knowledge with current information and detects when embedded knowledge has become stale.

#### Platform Documentation Lookup

Each target platform has a corresponding Context7 library. Use `resolve-library-id` to find the correct library ID, then `query-docs` to pull relevant snippets.

**Generic Agent Skills (agentskills.io):**

```
Step 1: resolve-library-id("agentskills agent skills specification")
Step 2: query-docs(library_id, "skill format frontmatter fields required structure")
```

Target keywords by need:
- Skill format/structure: `"skill format frontmatter fields required structure"`
- Frontmatter fields: `"frontmatter YAML name description allowed-tools"`
- Body conventions: `"body content markdown instructions examples"`
- File organization: `"directory structure references scripts assets"`

**OpenCode:**

```
Step 1: resolve-library-id("opencode skills")
Step 2: query-docs(library_id, "skill specification format frontmatter")
```

Target keywords by need:
- Skill format: `"skill specification format frontmatter"`
- Platform-specific fields: `"opencode skill fields compatibility"`
- Skill loading/discovery: `"skill loading discovery user project global"`

**Codex:**

```
Step 1: resolve-library-id("openai codex skills")
Step 2: query-docs(library_id, "codex skill format agents openai.yaml")
```

Target keywords by need:
- SKILL.md format: `"codex skill format frontmatter markdown"`
- agents/openai.yaml: `"agents openai.yaml interface invocation_policy dependencies"`
- Invocation and matching: `"skill invocation implicit explicit description matching"`
- MCP dependencies: `"openai.yaml dependencies tools MCP"`

#### When to Invoke Dynamic Fetching

**On-demand** — User explicitly requests research:
- User says "check the latest docs", "look up the spec", "research this", or similar
- User asks a question about a platform feature you are uncertain about
- User mentions a feature or field not covered in embedded knowledge

**Proactive** — Agent detects uncertainty about platform-specific nuances:
- During the interview, a user describes a capability and you are unsure whether the target platform supports it
- During generation, you encounter a field or structural decision not clearly covered by embedded knowledge
- A documentation gap listed in the platform's "Documentation Gaps" subsection is relevant to the current skill being created
- The user's skill involves features flagged as "experimental" or "evolving" in embedded knowledge

**Startup version comparison** — At the beginning of a session, compare embedded knowledge against fetched docs:
1. Read the `spec_version` and `spec_last_verified` from the relevant platform's Version Metadata in embedded knowledge
2. Use `resolve-library-id` to locate the platform's Context7 library
3. Use `query-docs` with keywords like `"version changelog updated"` to check for version indicators
4. Compare the fetched information against embedded `spec_version` and `spec_last_verified` dates
5. If the fetched docs indicate changes after the `spec_last_verified` date, or if structural differences are detected, flag the embedded knowledge as potentially stale (this feeds into the Spec Version Tracking section)

#### Tool Usage Instructions

**`resolve-library-id`** — Find the correct Context7 library ID for a platform.

Call this once per platform per session. Cache the returned library ID for subsequent `query-docs` calls.

```
resolve-library-id(query: string) -> library_id
```

- Use descriptive queries: `"agentskills agent skills specification"`, `"opencode skills"`, `"openai codex skills"`
- If the first query returns no results or an irrelevant library, try alternative queries:
  - GAS alternatives: `"agentskills.io"`, `"generic agent skills"`
  - OpenCode alternatives: `"opencode ai"`, `"charmbracelet crush opencode"`
  - Codex alternatives: `"openai codex"`, `"codex coding agent"`
- Store the resolved library ID for the duration of the session to avoid redundant lookups

**`query-docs`** — Fetch documentation snippets from a resolved library.

```
query-docs(library_id: string, query: string) -> documentation_snippets
```

- Use targeted, specific keywords — not broad queries. Good: `"frontmatter YAML fields required"`. Bad: `"everything about skills"`.
- Combine multiple related terms in a single query for better results: `"agents openai.yaml interface invocation_policy"`
- If a query returns insufficient results, try narrower or alternative keyword combinations
- Limit to the information you actually need — do not fetch entire specifications when you only need one section

#### Result Integration

When dynamic documentation is fetched, integrate it with embedded knowledge using these rules:

**Supplementing embedded knowledge:**
- If fetched docs provide additional detail on a topic covered by embedded knowledge (e.g., new optional fields, clarified constraints), merge the new information into your working understanding
- If fetched docs cover a topic not present in embedded knowledge (e.g., a newly added feature), treat it as authoritative and apply it

**Overriding embedded knowledge:**
- If fetched docs conflict with embedded knowledge on a factual matter (e.g., a field is now required that was previously optional, a constraint has changed), prefer the fetched version
- When overriding, note the discrepancy to the user: explain what the embedded knowledge stated, what the fetched docs state, and that you are using the more current information
- Example: "Note: The embedded knowledge lists `allowed-tools` as optional, but the latest documentation indicates it is now a recommended field. Using the updated guidance."

**Discrepancy tracking:**
- Record any discrepancies between embedded and fetched documentation during the session
- Include discrepancies in the post-generation summary (Stage 4.5) so the user is aware of potential knowledge drift
- If multiple discrepancies are found for a platform, recommend updating the embedded knowledge

#### Error Handling

**Context7 unavailable or times out:**
- If `resolve-library-id` or `query-docs` fails or times out, fall back to embedded knowledge without interrupting the workflow
- Inform the user: "Context7 documentation fetching is unavailable. Proceeding with embedded platform knowledge (last verified: {spec_last_verified})."
- Do not retry repeatedly — a single retry is acceptable, but if the second attempt fails, proceed with embedded knowledge

**Partial results:**
- If `query-docs` returns results but they seem incomplete or tangential, use what is relevant and supplement with embedded knowledge
- Do not treat partial results as authoritative for topics they do not directly address

**Research status communication:**
- When initiating a dynamic fetch, briefly inform the user: "Checking latest {platform} documentation..."
- When the fetch completes, summarize what was found if it is relevant to the current decision: "Confirmed: the latest docs align with embedded knowledge on {topic}" or "Found updated guidance on {topic}: {brief summary}"
- Keep status updates concise — do not narrate every fetch operation in detail

### Web Search

Use web search to find current best practices, community examples, and platform-specific guidance that supplements embedded knowledge. Web search is especially valuable when embedded knowledge has gaps, the user's skill targets a niche domain, or platform documentation has recently changed.

#### What to Search For

**Best practices for skill creation:**
- Search for best practices and patterns for creating skills on the target platform
- Look for style guides, authoring tips, and recommended approaches from platform maintainers
- Example queries: "best practices for writing OpenCode skills", "agent skill authoring guide agentskills.io", "Codex skill creation tips"

**Community examples and patterns:**
- Search for open-source skill repositories and example skills on the target platform
- Look for community-shared skills that solve problems similar to the user's skill
- Example queries: "example OpenCode skills github", "Codex skill examples repository", "agentskills.io community skills"

**Platform-specific guidance and tutorials:**
- Search for tutorials, walkthroughs, and how-to guides for the target platform
- Look for platform blog posts or changelogs that discuss skill capabilities
- Example queries: "OpenCode skill tutorial getting started", "Codex custom skill walkthrough", "agent skills specification tutorial"

**Recent changes or updates:**
- Search for recent announcements, release notes, or breaking changes to platform specs
- Especially important when the embedded knowledge `spec_version` date is more than 30 days old
- Example queries: "OpenCode skills spec changes 2026", "Codex skill format updates", "agentskills.io specification changelog"

#### When to Invoke Web Search

**On-demand triggers:**
- The user explicitly asks to research something (e.g., "look up how other skills handle X", "search for examples of Y")
- The user mentions a pattern or feature you are uncertain about
- The user asks about recent platform changes or updates

**Proactive triggers:**
- During the interview, the user describes a skill pattern you have limited embedded knowledge about
- The skill targets a niche domain where community examples would improve output quality
- The embedded knowledge `spec_version` is older than 30 days and the user asks about a potentially changed feature
- During generation, you encounter a platform feature not covered by embedded knowledge
- The outline includes capabilities that would benefit from community-validated patterns

**Do not search when:**
- The embedded platform knowledge already covers the topic comprehensively
- The question is about basic skill structure that is well-documented in the embedded knowledge sections
- The user has explicitly said they want to proceed without research

#### Handling Search Results

**Filtering and ranking:**
- Prioritize results from official platform documentation and repositories
- Rank community examples by recency (prefer last 6 months) and quality indicators (stars, forks, maintenance activity)
- Discard results that target a different platform than the user's target
- Discard results that describe deprecated or outdated approaches (check dates)

**When results are irrelevant:**
- If search returns no useful results, inform the user: "Web search did not return relevant results for [topic]. Proceeding with embedded knowledge."
- Do not present irrelevant results to the user or incorporate them into the skill
- Consider refining the search query once before giving up — try more specific terms or alternative phrasing

**When results conflict with embedded knowledge:**
- Prefer the web search result if it is from an official source and more recent than the embedded `spec_last_verified` date
- Note the discrepancy to the user: "Web search found that [X] has changed since the last embedded knowledge update. Using the updated approach."
- If the conflict source is unofficial (blog post, community example), flag it as uncertain and ask the user which approach to follow

#### Search Failure Handling

- If web search is unavailable or fails, notify the user: "Web search is currently unavailable. Continuing with embedded platform knowledge."
- Do not block the workflow — fall back to embedded knowledge and continue
- Log the search intent so the user can manually research later if desired
- If repeated searches fail, stop attempting web search for the remainder of the session and inform the user once

### Reference File Reading

Read existing skill files that the user provides as reference material. This allows the user to share examples, templates, or their own prior skills to inform the creation process.

#### How to Use Reference Files

When the user provides a file path to an existing skill (via the `context` argument, during the interview, or at any stage):

1. **Read the file** using the `Read` tool. Accept any file format — `.md`, `.yaml`, `.yml`, `.txt`, `.json`, or any other text format
2. **Identify the source platform** by examining the file's structure:
   - YAML frontmatter with `name` + `description` + Markdown body → GAS or OpenCode skill
   - `agents/openai.yaml` or YAML with `interface` key → Codex skill
   - Other structured format → Non-skill reference (documentation, spec, example)
3. **Extract useful patterns** from the reference file:
   - Structural patterns: section organization, heading hierarchy, content flow
   - Content patterns: how instructions are written, level of detail, tone
   - Feature patterns: tool usage, error handling approaches, configuration patterns
   - Platform-specific patterns: frontmatter fields used, platform conventions followed

#### Cross-Platform Reference Handling

When the reference file's platform does not match the user's target platform:

- **Warn the user**: "This reference file appears to be a [source platform] skill. Your target platform is [target platform]. I'll extract transferable patterns but will adapt the output to [target platform] conventions."
- **Extract transferable patterns**: Content structure, instruction style, feature design, and workflow patterns are generally transferable across platforms
- **Do not transfer platform-specific elements**: Frontmatter format, file structure conventions, and platform-specific tool references should not be carried over — generate these fresh for the target platform
- **Note differences**: If the reference uses a capability available on its platform but not on the target, inform the user and suggest the closest alternative

#### What to Extract from Reference Files

**For informing interview questions:**
- Identify patterns in the reference that suggest questions to ask (e.g., if the reference has an error handling section, ask about error handling for the new skill)
- Use the reference's scope and complexity to calibrate interview depth

**For enhancing the outline:**
- Suggest sections and structure inspired by the reference
- Incorporate best practices visible in the reference's organization
- Flag areas where the reference is strong and the user's skill could benefit from a similar approach

**For guiding generation:**
- Match the reference's instruction style and level of detail when appropriate
- Use the reference as a quality benchmark for the generated output
- Adopt validated structural patterns from the reference (e.g., progressive disclosure via reference files, clear workflow steps)

#### When to Invoke Reference File Reading

**On-demand triggers:**
- The user provides a file path and says "use this as a reference" or similar
- The user mentions an existing skill they want to base their new skill on
- The `context` argument contains a file path to an existing skill

**Proactive triggers:**
- During the interview, if the user mentions they have existing skills, ask if they would like to provide one as a reference
- If the user's description closely matches a common skill pattern and they seem uncertain about structure, suggest providing a reference

#### Error Handling for Reference Files

**Invalid file paths:**
- If the `Read` tool returns an error (file not found, permission denied), inform the user clearly: "Could not read the file at [path]. Please check the path and try again."
- Do not block the workflow — continue without the reference and offer to try again later

**Unreadable or binary files:**
- If the file content is binary or not human-readable text, inform the user: "The file at [path] does not appear to be a text file. Reference files should be text-based (Markdown, YAML, JSON, or plain text)."
- Skip the file and continue

**Empty files:**
- If the file exists but is empty, inform the user: "The file at [path] is empty. No patterns to extract."
- Continue without incorporating reference patterns

### Research Result Integration

Research findings from web search and reference files are integrated into the pipeline at three points:

**During the interview (Stage 2):**
- Discovered patterns inform follow-up questions — if research reveals a common best practice, ask the user whether they want to adopt it
- Community examples help calibrate question depth — if similar skills typically include error handling sections, ask about error handling
- Platform-specific findings surface relevant options the user might not know about

**During outline generation (Stage 3):**
- Best practice suggestions are incorporated as recommended sections in the outline
- Reference file patterns inform the outline's structure and level of detail
- Research findings are presented as suggestions, not mandates — the user approves the outline before generation

**During generation (Stage 4):**
- Community-validated approaches guide implementation details (instruction style, section organization, progressive disclosure patterns)
- Platform-specific guidance from web search ensures the generated file follows current conventions
- Reference file quality standards serve as a benchmark for the generated output's depth and clarity

### Research Fallback Handling

Graceful degradation when dynamic research sources are unavailable. Skill generation must always succeed regardless of which research sources are accessible. The fallback chain ensures the best available information is used at every stage.

#### Fallback Priority Chain

Research sources are attempted in priority order. When a higher-priority source is unavailable, the system falls through to the next level automatically.

| Priority | Source | Availability | Quality Level |
|----------|--------|-------------|---------------|
| 1 (Primary) | Context7 MCP documentation fetching | Requires Context7 MCP tools | Highest — live, versioned platform docs |
| 2 (Secondary) | Web search for docs, examples, best practices | Requires web search capability | High — current community knowledge |
| 3 (Tertiary) | Reference files provided by user | Requires user-supplied file paths | Medium — relevant but potentially dated |
| 4 (Final) | Embedded platform knowledge | Always available | Baseline — comprehensive but may be stale |

Embedded platform knowledge (Priority 4) is always available and serves as the baseline for every research operation. Higher-priority sources supplement and override embedded knowledge when accessible.

#### Availability Detection

Each research source has specific failure signals. When a failure is detected, the system transitions to the next source in the chain without blocking the workflow.

**Context7 (Priority 1) failure detection:**
- `resolve-library-id` call fails, throws an error, or times out
- `query-docs` call fails, throws an error, or times out
- Context7 MCP tools are not registered or not accessible in the current environment
- A single retry is acceptable; if the second attempt fails, mark Context7 as unavailable for the session

**Web search (Priority 2) failure detection:**
- Web search tool call fails or returns an error
- Web search returns zero results for a well-formed query
- Web search tool is not available in the current environment
- After two consecutive failures across different queries, mark web search as unavailable for the session

**Reference files (Priority 3) failure detection:**
- No reference files were provided by the user (the `context` argument is empty and no files were shared during the interview)
- All provided file paths fail to read (file not found, permission denied, binary content)
- Reference files are empty or contain no extractable patterns

**Embedded knowledge (Priority 4):**
- Always available — this source cannot fail
- Acts as the terminal fallback for every research operation

#### Fallback Transition Behavior

When a source becomes unavailable, the system transitions smoothly to the next level:

**Context7 unavailable — fall through to web search:**
1. Mark Context7 as unavailable for the remainder of the session
2. Attempt the same research intent via web search (translate the Context7 query into appropriate search terms)
3. If web search succeeds, use those results to supplement embedded knowledge

**Web search unavailable — fall through to reference files:**
1. Mark web search as unavailable for the remainder of the session
2. Check whether the user has provided reference files that may contain relevant patterns
3. If reference files exist and contain relevant content, extract patterns to supplement embedded knowledge

**Reference files unavailable — use embedded knowledge only:**
1. No action required — embedded knowledge is already loaded
2. Proceed with embedded platform knowledge as the sole research source

**Partial availability — use what works:**
- If Context7 returns partial or incomplete results, supplement with web search for the missing information
- If Context7 works but web search does not, use Context7 results with embedded knowledge as the supplement
- If only reference files and embedded knowledge are available, use both together
- Any combination of available sources is valid — use all sources that succeed

#### Session Research State

Track the availability of each research source throughout the session. This prevents repeated failed attempts and enables accurate status reporting.

**State tracking:**
- Maintain a per-session availability status for each source: `available`, `unavailable`, or `untested`
- All sources start as `untested` at session begin
- Sources transition to `available` on first successful use or `unavailable` after failure (with retry exhausted)
- Once marked `unavailable`, do not re-attempt that source for the remainder of the session
- Log the reason for unavailability (timeout, tool not found, repeated failures) for user communication

#### User Communication

Inform the user about research source availability at two points: when a fallback occurs and in the post-generation summary.

**When a fallback transition occurs:**
- Inform the user which source failed and which source the system is falling back to
- Keep the message concise and non-alarming — fallbacks are expected behavior, not errors
- Examples:
  - "Context7 documentation fetching is unavailable. Checking web search for current platform guidance..."
  - "Web search did not return results. Proceeding with embedded platform knowledge (last verified: {spec_last_verified})."
  - "No dynamic research sources are available. Generating with embedded platform knowledge, which was last verified on {spec_last_verified}. Consider providing reference files for additional context."

**When all dynamic sources fail:**
- Deliver a single consolidated message (do not stack multiple failure notifications):
  - "Dynamic research sources (Context7, web search) are unavailable for this session. Generating with embedded platform knowledge (last verified: {spec_last_verified}). The generated skill will be structurally correct but may not reflect the latest platform changes. You can provide reference files at any time to supplement the embedded knowledge."

**In the post-generation summary (Stage 4.5):**
- Include a "Research sources" line in the summary listing which sources were used:
  - "Research sources: Context7 (live docs), web search (community examples), embedded knowledge"
  - "Research sources: Embedded knowledge only (Context7 and web search unavailable)"
  - "Research sources: Web search, user reference files, embedded knowledge (Context7 unavailable)"

#### Research Quality Indicators

Track and communicate the quality level of the research backing each generated skill. Quality indicators help the user understand how current and comprehensive the research behind their skill is.

**Quality levels based on sources used:**

| Sources Available | Quality Label | Confidence | Notes |
|-------------------|---------------|------------|-------|
| Context7 + any others | "Dynamic research" | High | Live documentation confirms currency |
| Web search + embedded (no Context7) | "Supplemented research" | Medium-High | Community sources supplement embedded knowledge |
| Reference files + embedded (no dynamic) | "Reference-informed" | Medium | User-provided references augment baseline |
| Embedded knowledge only | "Baseline knowledge" | Baseline | Comprehensive but potentially stale |

**Attribution in generated skill comments:**

Include a research attribution comment in the generated skill file, placed after the frontmatter and before the main body content:

```markdown
<!-- Generated by create-skill | Research: {quality_label} | Platform knowledge last verified: {spec_last_verified} -->
```

Examples:
- `<!-- Generated by create-skill | Research: Dynamic research (Context7 + web search) | Platform knowledge last verified: 2026-03-07 -->`
- `<!-- Generated by create-skill | Research: Baseline knowledge only | Platform knowledge last verified: 2026-03-07 -->`
- `<!-- Generated by create-skill | Research: Reference-informed (user examples + embedded) | Platform knowledge last verified: 2026-03-07 -->`

This comment provides traceability — if a user later encounters an issue with the generated skill, the research attribution helps determine whether stale knowledge may be the cause.

**Staleness indicator:**

When generating with embedded knowledge only (no dynamic sources confirmed the currency of the embedded knowledge), and the `spec_last_verified` date is more than 30 days ago, add a staleness note in the post-generation summary:

- "Note: This skill was generated using embedded knowledge last verified on {spec_last_verified} ({N} days ago) without dynamic research confirmation. Platform specs may have changed since then. Consider running with Context7 available or checking the platform documentation manually."

#### Interaction with Other Research Sections

The fallback chain integrates with the existing research subsections as follows:

- **Dynamic Documentation Fetching** (Context7): The error handling in that section covers individual fetch failures. This fallback section governs the session-level decision to stop attempting Context7 and move to the next source.
- **Web Search**: The search failure handling in that section covers individual search failures. This fallback section governs the session-level decision to stop attempting web search.
- **Reference File Reading**: Reference files are passive — they are available if the user provides them. This fallback section clarifies their role as the third-priority source when dynamic sources fail.
- **Research Result Integration**: Integration rules apply regardless of which source produced the results. Whether information comes from Context7, web search, or reference files, the same integration and conflict-resolution rules from that section apply.

---

## Structural Validation

Validate every generated skill file against the target platform's specification **before** presenting it to the user or writing it to disk. This validation runs automatically as part of Stage 4 — between rendering (4.2 / 4.X) and output path selection (4.3). The user never sees an invalid skill file without an accompanying warning.

### Validation Trigger Point

After the skill content is fully rendered (SKILL.md and, for Codex, `agents/openai.yaml`), run the full validation pass **before** prompting for the output path. This ensures:
- The user reviews a validated skill, not a potentially broken one
- Auto-fixes are applied before the user sees the content
- Any unfixable issues are surfaced with the skill, not discovered after writing

### Validation Flow

```
Rendered content (SKILL.md + openai.yaml)
    |
    v
[1] Run platform-specific validation rules
    |
    v
[2] Any failures? --No--> [5] Report: PASS
    |
   Yes
    |
    v
[3] Auto-fixable? --Yes--> Apply fixes --> [4] Re-validate
    |                                           |
   No                                     Still failing?
    |                                      /          \
    v                                    No            Yes
[5] Report: WARNING                [5] Report: PASS   [5] Report: WARNING
    (unfixable issues)             (issues fixed)      (partial fix applied)
    |
    v
Present skill with validation report
```

### Platform-Specific Validation Rules

Each platform has its own set of validation rules drawn from the embedded platform knowledge. The validation engine applies the rules matching the target platform.

#### Shared Rules (All Platforms)

These rules apply to every generated skill regardless of target platform:

**Frontmatter structure:**
- [ ] File begins with `---` on its own line (frontmatter opening delimiter)
- [ ] Frontmatter closing `---` is present on its own line
- [ ] Content between delimiters is valid YAML
- [ ] Markdown body content follows the closing delimiter

**Required fields:**
- [ ] `name` field is present and non-empty
- [ ] `name` is 1-64 characters
- [ ] `name` matches regex `^[a-z0-9]+(-[a-z0-9]+)*$` (lowercase alphanumeric + hyphens, no leading/trailing/consecutive hyphens)
- [ ] `name` matches the intended parent directory name
- [ ] `description` field is present and non-empty
- [ ] `description` is 1-1024 characters

**Optional field constraints (validate only if present):**
- [ ] `compatibility` is 1-500 characters
- [ ] `metadata` values are all strings (map[string]string)
- [ ] `allowed-tools` is a space-delimited string of tool names

**Format constraints:**
- [ ] File will be named `SKILL.md` (all caps)
- [ ] Target directory name will match the `name` field

#### OpenCode-Specific Rules

In addition to the shared rules, validate:

**Naming:**
- [ ] `name` uses lowercase only (not mixed-case — the agentskills.io spec requires lowercase even though OpenCode's implementation tolerates mixed case)

**Description quality (advisory, not failure):**
- [ ] Description includes both "what the skill does" and "when to use it" — if missing trigger context, suggest adding it
- [ ] Description includes specific keywords for agent discoverability — if vague, suggest improvement

**Content guidelines (advisory, not failure):**
- [ ] SKILL.md body is under 500 lines — if over, suggest moving content to `references/`
- [ ] Estimated token count is under 5000 — if over, suggest progressive disclosure

#### GAS-Specific Rules

In addition to the shared rules, validate:

**Portability checks** (apply when the user chose cross-platform portability during the interview):
- [ ] Only core GAS fields are used in frontmatter (`name`, `description`, `license`, `compatibility`, `metadata`) — if extension fields are present, warn that they will be silently ignored by non-supporting implementations
- [ ] Body content does not reference platform-specific tools by name without noting portability implications
- [ ] Skill directory uses `.agents/skills/` path convention (the most portable discovery path)

**Extension field validation** (apply when targeting a specific agent implementation):
- [ ] `argument-hint` is a string if provided (Claude Code)
- [ ] `user-invocable` is a boolean if provided (Claude Code)
- [ ] `disable-model-invocation` is a boolean if provided (Claude Code)
- [ ] `arguments` is an array of objects with `name`, `description`, and `required` fields if provided (Claude Code)

**Description quality (advisory, not failure):**
- [ ] Description includes both "what the skill does" and "when to use it"
- [ ] Description includes specific keywords for agent discoverability

**Content guidelines (advisory, not failure):**
- [ ] SKILL.md body is under 500 lines
- [ ] Estimated token count is under 5000

#### Codex-Specific Rules

In addition to the shared rules, validate:

**Frontmatter convention:**
- [ ] Frontmatter contains only `name` and `description` — if extra fields are present (beyond `license`), warn that Codex convention is to move metadata to `agents/openai.yaml`
- [ ] YAML string values are quoted (Codex convention)

**Description quality (advisory, not failure):**
- [ ] Description includes both "what the skill does" and "when to use it" with explicit scope boundaries
- [ ] All trigger/invocation context is in the description, not in the body

**agents/openai.yaml validation** (validate only if generated):
- [ ] File is valid YAML
- [ ] All string values are quoted
- [ ] `interface.short_description` is 25-64 characters if provided
- [ ] `interface.icon_small` and `interface.icon_large` are relative paths if provided
- [ ] `interface.brand_color` is a valid hex color string (e.g., `"#3B82F6"`) if provided
- [ ] `interface.default_prompt` mentions the skill as `$skill-name` if provided
- [ ] `policy.allow_implicit_invocation` is a boolean if provided
- [ ] `dependencies.tools[].type` is `"mcp"` (only supported type) if provided
- [ ] `dependencies.tools[].url` is a valid URL if type is `"mcp"`

**Content guidelines (advisory, not failure):**
- [ ] SKILL.md body is under 500 lines
- [ ] Estimated token count is under 5000
- [ ] No extraneous files suggested (README.md, CHANGELOG.md, etc.)

### Ambiguous Spec Requirements

When a platform spec has ambiguous or underspecified requirements, validate conservatively:

- **`allowed-tools` format**: The spec says "space-delimited string" but Claude Code uses YAML lists. Accept both formats without flagging as an error. If generating, use the target platform's preferred format.
- **`compatibility` vocabulary**: No standard vocabulary exists. Accept any non-empty string within the 500-character limit.
- **Body size limits**: The 500-line / 5000-token guidelines are recommendations, not hard limits. Flag as advisory suggestions, not failures.
- **Extension field behavior**: Extension fields are safe (silently ignored by non-supporting implementations). Flag for awareness on GAS portability targets, but never as validation failures.

### Auto-Fix Behavior

When validation finds fixable issues, automatically correct them before presenting the skill to the user. Auto-fixes are silent corrections — they are applied, then the fixed content is re-validated to confirm the fix did not introduce new issues.

#### Auto-Fixable Issues

| Issue | Auto-Fix | Re-validation Check |
|-------|----------|-------------------|
| `name` contains uppercase characters | Convert to lowercase | Confirm name still matches regex after lowering |
| `name` contains spaces | Replace spaces with hyphens, then lowercase | Confirm name matches regex; confirm no consecutive hyphens introduced |
| `name` starts or ends with hyphen | Trim leading/trailing hyphens | Confirm name is non-empty after trimming |
| `name` contains consecutive hyphens | Collapse `--` to `-` | Confirm name matches regex |
| `description` exceeds 1024 characters | Truncate to 1024 characters at the last complete sentence boundary | Confirm description is non-empty and under limit |
| `compatibility` exceeds 500 characters | Truncate to 500 characters at the last complete word boundary | Confirm string is non-empty and under limit |
| Missing frontmatter opening delimiter | Prepend `---\n` to file content | Confirm frontmatter parses as valid YAML |
| Missing frontmatter closing delimiter | Insert `---\n` after frontmatter content | Confirm body content follows the delimiter |
| Codex: unquoted YAML string values | Add double quotes around string values in frontmatter | Confirm YAML still parses correctly |
| Codex: `default_prompt` missing `$skill-name` | Append ` Use $skill-name.` to the default_prompt | Confirm the `$skill-name` reference is present |

#### Re-Validation After Fixes

After applying any auto-fix:
1. Re-run the full validation pass on the fixed content
2. If the re-validation passes, the fix is accepted
3. If the re-validation finds new issues introduced by the fix, revert the fix and treat the original issue as unfixable
4. Report both the original issue and the failed fix attempt in the validation report

#### Unfixable Issues

Issues that cannot be auto-fixed are reported as warnings. The skill is still presented to the user, but with clear annotations about the issues.

Unfixable issues include:
- Missing `name` field entirely (no reasonable default can be generated without user input)
- Missing `description` field entirely (cannot generate a meaningful description automatically)
- Invalid YAML that cannot be parsed (structural corruption beyond delimiter issues)
- `agents/openai.yaml` with fundamentally invalid structure
- Body content that is empty (no instructions to present)

### Validation Report

After validation (and any auto-fixes), present a validation report to the user alongside the generated skill content.

#### Report Format — PASS (all checks passed, no issues)

> **Validation: PASS**
> The generated skill passes all structural checks for {platform name}.

#### Report Format — PASS with fixes (issues found and auto-fixed)

> **Validation: PASS** (after auto-fixes)
> The following issues were detected and automatically corrected:
> - {description of issue and fix applied}
> - {description of issue and fix applied}
>
> The skill now passes all structural checks for {platform name}.

#### Report Format — WARNING (unfixable issues present)

> **Validation: WARNING**
> The generated skill has structural issues that could not be automatically resolved:
> - {description of unfixable issue}
> - {description of unfixable issue}
>
> The skill is presented as-is. Please review and address these issues manually before using it.

#### Quality Suggestions

Regardless of pass/fail status, include quality suggestions for optional fields and best practices that would enhance the skill. These are never marked as failures — they are recommendations.

Format quality suggestions as a separate section after the validation status:

> **Quality suggestions:**
> - Consider adding a `license` field to specify usage terms
> - The description could include more specific trigger keywords for better agent discoverability
> - Consider adding `agents/openai.yaml` with a `display_name` and `short_description` for better Codex UI integration
> - SKILL.md body exceeds 500 lines; consider moving reference material to a `references/` subdirectory

**Which suggestions to surface** (by platform):

- **OpenCode**: Suggest `license`, `compatibility`, `metadata` fields if not present and they would add value. Suggest description improvements if trigger context is missing. Suggest progressive disclosure if body is long.
- **GAS**: Same as OpenCode, plus suggest extension fields if targeting a specific agent. Suggest the `.agents/skills/` path for maximum portability.
- **Codex**: Suggest `agents/openai.yaml` if not generated (especially `interface.display_name` and `interface.short_description`). Suggest moving extra frontmatter fields to `openai.yaml`. Suggest scope boundaries in description if missing.

### Integration with Stage 4

The validation engine is invoked at a specific point in the Stage 4 pipeline:

1. **4.2 / 4.X: Rendering** — Generate the skill content
2. **Structural Validation** — Run the validation engine on the rendered content
3. **4.3: Output Path Selection** — Prompt for the output path (user sees validation results here)
4. **4.4: File Writing** — Write the validated (and possibly auto-fixed) content
5. **4.5: Post-Generation Summary** — Include validation status in the summary

The validation report is presented immediately after rendering and before the output path prompt, giving the user visibility into the structural quality of the skill before deciding where to save it. The post-generation summary (4.5) references the validation status in its "Validation note" section.

### Validation Failure Does Not Block Output

Validation failures (warnings) never prevent the skill from being presented or written. The purpose of validation is to inform, not to gate. If validation finds unfixable issues:

1. The skill content is presented to the user with the WARNING report
2. The user can still choose an output path and write the file
3. The post-generation summary notes the outstanding issues
4. The user is responsible for manual correction of unfixable issues

This ensures that edge cases in platform specs or unusual skill requirements do not prevent the user from getting their skill file. The validation engine is a quality safeguard, not a blocker.

---

## Spec Version Tracking

Track embedded platform spec versions and detect when embedded knowledge is outdated. This section defines the version metadata structure, the startup comparison flow, staleness warnings, and graceful degradation behavior.

### Version Metadata Structure

Each embedded platform knowledge section includes a **Version Metadata** block with the following fields:

| Field | Format | Description |
|-------|--------|-------------|
| `spec_version` | Date-based, e.g., `"2026-03"` | The version (or effective date) of the platform specification that the embedded knowledge reflects |
| `spec_last_verified` | ISO date, e.g., `"2026-03-07"` | The date when the embedded knowledge was last verified against the official documentation |
| `source_url` | URL | The primary official specification or documentation URL |
| `notes` | Free text | Context about versioning scheme, known gaps, or platform-specific caveats |

Additional platform-specific URL fields (e.g., `opencode_docs_url`, `github_url`, `official_skills_repo`, `agent_skills_spec_url`) are included where relevant.

**Current version metadata locations:**
- OpenCode: `Research Layer > Embedded Platform Knowledge > OpenCode Platform Knowledge > Version Metadata`
- Generic Agent Skills (GAS): `Research Layer > Embedded Platform Knowledge > Generic Agent Skills (GAS) Platform Knowledge > Version Metadata`
- Codex: `Research Layer > Embedded Platform Knowledge > Codex Platform Knowledge > Version Metadata`

These metadata blocks are the single source of truth for what version of each platform's spec the embedded knowledge represents.

### Startup Comparison Flow

On skill invocation, perform a version check for the selected target platform before entering the interview. This comparison runs once per session per platform.

**Step-by-step procedure:**

1. **Read embedded version metadata** — Extract `spec_version` and `spec_last_verified` from the selected platform's Version Metadata block in Embedded Platform Knowledge.

2. **Resolve platform library** — Use `resolve-library-id` to locate the platform's Context7 library (see Dynamic Documentation Fetching > Platform Documentation Lookup for queries).

3. **Fetch version indicators** — Use `query-docs` with keywords like `"version changelog updated specification"` to retrieve version-related information from the latest documentation.

4. **Compare versions** — Evaluate whether the fetched documentation indicates changes since the embedded `spec_last_verified` date:
   - Look for explicit version numbers, changelogs, "last updated" dates, or structural changes in the fetched content
   - Compare any version identifiers found against the embedded `spec_version`
   - Check for new fields, removed fields, changed constraints, or restructured formats that differ from embedded knowledge

5. **Determine staleness** — Classify the result:
   - **Current**: Fetched docs align with embedded knowledge. No version drift detected.
   - **Potentially stale**: Fetched docs indicate minor updates or additions after `spec_last_verified`, but no breaking changes.
   - **Likely outdated**: Fetched docs reveal significant structural changes, removed features, or new required fields not reflected in embedded knowledge.

6. **Take action** — Based on the staleness classification, follow the appropriate response (see Staleness Warning and Breaking Spec Changes below).

**Timing**: This check runs after the user selects a target platform (Stage 1, Step 4) and before the interview begins (Stage 2). It should feel quick and non-blocking. If the check takes too long, proceed with the interview and note the pending version check.

### Staleness Warning

When the startup comparison detects that embedded knowledge is potentially stale, inform the user and offer options.

**When versions differ (potentially stale):**

Present a clear, concise warning:

```
"Embedded knowledge for {platform} is version {spec_version} (last verified {spec_last_verified}),
but the latest documentation suggests updates may be available."
```

Then offer the user a choice:

```
"Would you like me to use the dynamically fetched documentation as the primary reference for
{platform}? This ensures the generated skill reflects the latest spec, but may take slightly
longer due to additional documentation lookups.

1. Yes — prefer fetched docs (recommended if accuracy to the latest spec is important)
2. No — use embedded knowledge (faster, but may miss recent changes)"
```

**If the user accepts (prefers fetched docs):**
- Adjust generation to treat dynamically fetched documentation as the primary reference for the selected platform
- Use embedded knowledge as a fallback for topics not covered by the fetched docs
- Note in the post-generation summary that dynamically fetched documentation was used as the primary source
- During generation, proactively fetch docs for each major section rather than relying on embedded knowledge alone

**If the user declines (prefers embedded knowledge):**
- Proceed with embedded knowledge as the primary reference
- Still use dynamic fetching for on-demand and proactive lookups as described in Dynamic Documentation Fetching
- Note in the post-generation summary that embedded knowledge was used despite a potential version difference

**When versions match (current):**

No warning is needed. Optionally, provide a brief confirmation:

```
"Embedded {platform} knowledge is current (version {spec_version}, verified {spec_last_verified})."
```

This confirmation is informational only and should not require user action.

### Breaking Spec Changes

When the startup comparison detects significant structural changes (likely outdated classification), escalate the warning:

```
"Warning: Embedded knowledge for {platform} appears significantly outdated. The latest
documentation indicates breaking changes since version {spec_version}:
- {brief description of detected changes, e.g., 'new required field: X', 'removed field: Y'}

Using embedded knowledge may produce skill files that do not conform to the current spec.
It is strongly recommended to use the dynamically fetched documentation as the primary reference."
```

In this case:
- Default to using fetched docs as the primary reference (the user can still decline, but the recommendation is strong)
- If the user still prefers embedded knowledge, proceed but add a prominent warning in the post-generation summary about potential spec non-compliance
- During generation, flag any sections where embedded knowledge may conflict with the detected changes

### Graceful Degradation

When dynamic fetching fails during the startup version check, the skill must not block the workflow.

**Context7 unavailable or times out:**
- Skip the version comparison entirely
- Proceed with embedded knowledge as the primary reference
- Do not display a staleness warning (since no comparison was possible)
- Inform the user only if they explicitly asked for a version check: "Unable to check for spec updates — Context7 is unavailable. Proceeding with embedded knowledge (last verified: {spec_last_verified})."

**Partial or ambiguous fetch results:**
- If the fetched content does not contain clear version indicators, treat the comparison as inconclusive
- Proceed with embedded knowledge without a staleness warning
- Do not guess or infer staleness from ambiguous signals

**Version comparison logic fails:**
- If parsing or comparing version information raises an error, catch it silently
- Proceed with embedded knowledge
- Do not block the interview or generation pipeline for version checking failures

**Network timeout handling:**
- A single retry is acceptable for transient failures
- If the retry also fails, proceed immediately with embedded knowledge
- Do not retry more than once — the version check is informational, not critical

**Key principle**: The version check is a quality enhancement, not a gate. The skill must always be able to proceed with embedded knowledge alone. Version checking failures should never prevent a user from creating a skill.
