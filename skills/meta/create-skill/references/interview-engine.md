# Interview Engine

Detailed interview procedures for Stage 2 of the create-skill workflow.

## 2.1 Question Categories

The interview must cover these five topic areas. Not every category needs a dedicated question — combine or skip topics when previous answers already provide the information.

### Category A: Target Audience

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

### Category B: Use Cases and Workflows

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

### Category C: Requirements and Constraints

What rules or limitations apply?

- **Hard requirements** — things the skill MUST do or MUST NOT do
- **Tool dependencies** — does it need specific capabilities (file read/write, web search, terminal access)?
- **Security or safety constraints** — data sensitivity, network access restrictions, permission boundaries
- **Scope boundaries** — what is explicitly out of scope?

*Prompt example:*
> What capabilities does your skill need? (List all that apply, or describe in your own words.)
> 1. Read files from the project
> 2. Write or create files
> 3. Run terminal commands
> 4. Search the web
> 5. Ask the user questions during execution
> 6. None of the above / not sure
>
> Also mention any hard constraints, scope boundaries, or security considerations.

### Category D: Key Features and Capabilities

What specific features make this skill valuable?

- **Core features** — the minimum set of capabilities for the skill to be useful
- **Nice-to-have features** — enhancements that add value but are not essential
- **Error handling** — how should the skill behave when things go wrong?
- **Configuration or customization** — does the user need to adjust behavior per invocation?

*Prompt example:*
> What are the core features of this skill? List the must-have capabilities, and optionally any nice-to-have features or error handling considerations.
>
> Start with the single most important thing the skill should accomplish, then add any additional capabilities.

### Category E: GAS Skill Considerations

Considerations specific to creating a portable GAS skill.

**Tool integration approach** — Does the skill rely on capabilities that vary across agent implementations? If so, instructions should be written generically (e.g., "read the file" rather than naming a specific tool) to ensure portability across different agents.
- If the user is unsure, recommend generic capability descriptions for maximum portability

**Agent vs skill distinction** — Is the user building a skill (a focused capability invoked by an agent) or does their use case actually call for an agent configuration (a top-level persona or workflow coordinator)? Surface this when the described scope is unusually broad — multiple independent workflows, persistent state management, or coordination of other skills.
- If the use case sounds like an agent, explain the distinction briefly and confirm the user wants a skill

**Optional GAS fields** — Based on what was learned in earlier categories, recommend which optional frontmatter fields would add value:
- `metadata` fields — useful when the skill targets a specific audience, workflow, or domain
- `compatibility` field — useful when the skill depends on specific environments or tools
- `license` field — useful for skills intended for public sharing
- If the skill is simple, recommend sticking to `name` and `description` only

**Skill structure** — Based on what was learned in earlier categories:
- Should the skill use `references/` files for progressive disclosure?
- Does it need scripts in `scripts/`?
- Should this skill be available in all projects or just specific ones? (project-local vs global install path)

*Prompt example:*
> A few considerations for your portable GAS skill:
> 1. Will the skill instructions be short (under a page) or long and detailed?
>    - Short: everything goes in one file
>    - Long: we can split detailed references into separate files the agent loads on demand
> 2. Any optional fields you want? (`metadata`, `compatibility`, `license`) — or keep it minimal with just `name` and `description`?
> 3. Should this skill be available in all projects or just specific ones?
>    - All projects (global install at `~/.agents/skills/`)
>    - Specific projects only (project-local at `.agents/skills/`)

## 2.2 Interview Flow Control

### Round Structure

The interview proceeds in rounds. Each round consists of asking the user a question and processing their response. There is no fixed number of rounds — the interview continues until all required information is gathered or the user signals early exit.

**Typical round counts by interview depth and complexity:**

| | Simple Skill | Moderate Skill | Complex Skill |
|---|---|---|---|
| **High-Level Overview** | 2-4 rounds | 3-5 rounds | 4-6 rounds |
| **Detailed** | 3-5 rounds | 5-7 rounds | 6-9 rounds |
| **Deep Dive** | 4-6 rounds | 6-9 rounds | 8-12 rounds |

These are guidelines, not hard limits. End the interview when you have enough information, not when you hit a target number.

### Question Ordering

Follow this recommended order, but skip or reorder categories based on what was already learned:

1. **Use cases and workflows** (Category B) — Start here because the workflow shape determines which other questions are relevant. The user's description from Stage 1 often provides a starting point.
2. **Target audience** (Category A) — Understanding the audience clarifies requirements and feature scope. Skip if the user's description and use case answers already make the audience obvious.
3. **Key features** (Category D) — Define specific capabilities based on the use cases and audience.
4. **Requirements and constraints** (Category C) — Gather hard rules and tool dependencies after features are established.
5. **GAS skill considerations** (Category E) — Cover last because structural decisions are most useful when the skill's content is already understood.

### Building on Previous Answers

Every question after the first MUST reference context from prior answers. Techniques:

- **Summarize before asking**: "You mentioned the skill will analyze PR diffs and produce review summaries. For that workflow..."
- **Connect to prior context**: "Since this is a multi-step pipeline that reads files and generates reports, which of these capabilities will it need?"
- **Narrow the scope**: "You've described the core analysis step. Are there any additional features beyond the diff analysis you mentioned?"
- **Reflect understanding**: "So the skill targets senior engineers working in TypeScript monorepos. Given that audience..."

Never ask a question that ignores what the user has already told you.

### Skipping Irrelevant Questions

Skip questions when the answer is already known or the topic is not applicable:

- If the user described a simple single-action skill, skip questions about multi-step workflows, complex error handling, and reference file splitting
- If the description from Stage 1 was detailed and specific, skip broad "what does it do" questions and move directly to clarifying details
- If the user already mentioned tools or constraints in passing, confirm rather than re-ask: "You mentioned needing file read access — any other capabilities?"
- If target audience is obvious from context (e.g., "a skill for my personal use"), acknowledge it and skip the audience category entirely

### Combining Questions

When appropriate, combine related topics into a single prompt to reduce round count:

- Combining related topics (e.g., features + error handling, audience + environment) is always allowed regardless of depth level
- **Interview depth affects scope, not style**: At High-Level Overview, fewer topics need covering so there are naturally fewer opportunities to combine. At Deep Dive, more topics are explored but combining keeps the round count manageable.
- **Rule of thumb**: Never combine more than 2-3 related topics in a single question

## 2.3 Depth Adaptation

The interview dynamically adjusts its depth based on three signals.

### Signal 1: Interview Depth (from Stage 1)

This is the primary depth control. See Step 4 of Stage 1 for the depth level definitions.

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

### Signal 2: Skill Complexity Assessment

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
- **Simple skills**: Shorten the interview. Skip features/capabilities deep-dive if the use case is clear. Skip GAS-specific questions if defaults suffice. Aim for the lower end of the round-count range.
- **Complex skills**: Extend the interview. Ask detailed questions about each workflow step. Probe for edge cases and error handling. Cover GAS considerations thoroughly. Aim for the upper end of the round-count range.

### Signal 3: Response Quality

Adjust based on the depth and quality of the user's answers:

- **Detailed, comprehensive responses**: Skip follow-up questions on the same topic. Reduce remaining question count. Consider jumping ahead to later categories.
- **Average responses**: Proceed normally through the question sequence.
- **Terse or vague responses**: Ask targeted follow-up questions (see Section 2.4). Do not move on until the topic has enough detail for generation.

## 2.4 Response Handling

### Handling Terse Responses

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

### Handling Contradictory Answers

When a user provides information that conflicts with something they said earlier:

1. **Flag the inconsistency explicitly** — do not silently pick one answer
2. **Quote both statements** so the user can see the contradiction
3. **Ask for clarification** with a neutral tone — do not assume which answer is correct
4. **Store the clarified answer** and update any derived understanding

*Example:*
> Earlier you said the skill is "for my personal use only," but just now you mentioned it should "work across different team members' environments." Could you clarify — is this skill for your personal projects, or should it support team usage? That will affect how I structure the configuration and documentation.

## 2.5 Early Exit Support

The user may signal they want to wrap up the interview before all categories are covered. Recognize these signals:

- Explicit statements: "that's enough", "let's move on", "I think you have what you need", "skip the rest", "wrap up"
- Impatience indicators: increasingly terse responses after previously detailed ones, responses like "sure", "whatever works", "you decide"

**When early exit is detected:**

1. **Acknowledge the signal**: "Understood — let's move on to the outline."
2. **Perform a quick gap check** (see Section 2.7) before proceeding
3. If critical information is missing, ask at most **one** final consolidated question covering only the gaps: "Before I generate the outline, I just need to know: [specific missing items]"
4. If the user declines the gap-fill question, accept reasonable defaults for all gaps and note them in the outline for review
5. Proceed to Stage 3

## 2.6 Revision Support

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

## 2.7 Completeness Check

Before transitioning to Stage 3, verify that enough information has been collected to generate a meaningful outline. Walk through this checklist internally (do not present it to the user):

**Required information (must have at least a basic answer or reasonable default):**
- [ ] Primary use case / what the skill does (Category B)
- [ ] Workflow shape — single-shot, multi-step, conversational (Category B)
- [ ] Core inputs and outputs (Category B)
- [ ] At least one core feature or capability (Category D)
- [ ] GAS skill structure decisions addressed or defaults acceptable (Category E)

**Recommended information (improves quality but can use defaults):**
- [ ] Target audience identified (Category A)
- [ ] Trigger scenarios defined — when should the agent invoke this skill? (Category B)
- [ ] Tool dependencies identified (Category C)
- [ ] Hard constraints or scope boundaries noted (Category C)
- [ ] Error handling approach (Category D)

**If required information is missing:**
- Ask up to 2 targeted questions to fill the gaps
- If the user has signaled early exit, fill gaps with reasonable defaults and flag them in the Stage 3 outline with a note: "[Default — please review]"

**If recommended information is missing:**
- Fill with reasonable defaults derived from other answers
- Note the defaults in the outline so the user can adjust during Stage 3

**Transition to Stage 3:**
Once the completeness check passes, summarize the collected information briefly (3-5 sentences covering the skill's purpose, workflow, key features, and any notable decisions) and proceed directly to Stage 3. Do not ask for permission to proceed — the outline review in Stage 3 is the user's opportunity to make changes.
