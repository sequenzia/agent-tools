# Outline Generation & Review

Detailed procedures for Stage 3 of the create-skill workflow.

## 3.1 Outline Generation

Synthesize all information collected from Stage 1 (inputs) and Stage 2 (interview) into a structured outline. The outline serves as a blueprint for the final skill file — it is NOT the skill file itself.

### Pre-Generation Validation

Before generating the outline, walk through these checks internally:

- [ ] All required information from the Stage 2 completeness check (Section 2.7) is present or has reasonable defaults
- [ ] No contradictory information remains unresolved
- [ ] GAS-specific requirements are addressed

If any section cannot be populated with collected information or a reasonable default, flag it as an information gap (see Section 3.4).

### Outline Structure

Generate the outline with these sections. Always present a thorough, detailed outline regardless of interview depth — the depth setting affects only the interview, not the outline or generated output.

**Section 1: Skill Identity**
- **Name**: The skill name from Stage 1 (formatted to GAS conventions — lowercase, hyphenated)
- **Description**: A polished version of the user's description, expanded with interview insights to maximize agent discoverability. Show the full description text that will appear in the frontmatter.

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

**Section 5: GAS Configuration**

Refer to [references/platform-knowledge.md](references/platform-knowledge.md) for field definitions and conventions.

Include GAS-specific configuration:
- Frontmatter fields to include (required + relevant optional core fields)
- Whether `references/` or `scripts/` files are needed (and what they would contain)
- Estimated token budget: ~100 tokens metadata, <5000 tokens instructions, reference files as needed

**Section 6: Suggested File Structure**

Show the proposed directory layout. Include the standard directories (`SKILL.md`, `references/`, `scripts/`, `assets/`) as applicable. If the skill is simple enough for a single SKILL.md with no supporting files, say so explicitly. For each file or directory, include a one-line description of its purpose.

**Section 7: Requirements and Constraints**
- Tool capabilities needed (file read/write, web search, terminal, user interaction)
- Hard constraints or rules the skill must follow
- Scope boundaries — what the skill explicitly does NOT do
- Error handling approach

**Section 8: Defaults and Assumptions** (include only if applicable)
- List any information gaps that were filled with reasonable defaults during the interview
- Mark each with "[Default — please review]" so the user knows to verify these
- Include the reasoning for each default choice

### Formatting Guidelines

Present the outline using clear Markdown formatting:

- Use `##` headers for each section and `###` for subsections
- Use bullet lists for features, use cases, and requirements
- Use code blocks for file structure diagrams
- Bold key terms and section labels for scannability
- Keep the overall outline concise — aim for clarity over exhaustiveness. The outline should be reviewable in a single read-through (roughly 40-80 lines depending on skill complexity)

Include brief explanatory notes under technical sections where concepts may not be self-evident (e.g., what `references/` files are for, what `allowed-tools` means).

## 3.2 Outline Presentation and Review Prompt

After generating the outline, present it to the user as regular text output. Then immediately ask the user for their review.

**Review prompt:**

> Here's the outline for your skill. Please review it and let me know:
> 1. **Approve** — Everything looks good, proceed to generating the skill file
> 2. **Suggest changes** — Tell me what you'd like to adjust (I'll update the outline)
> 3. **Major rework** — Something fundamental needs to change (I'll re-ask some interview questions)

## 3.3 Review Flow

Handle the user's response based on the three possible paths.

### Path A: Approve

The user signals approval — phrases like "looks good", "approve", "let's go", "proceed", "yes", "generate it", or selecting option 1.

**Action:**
1. Acknowledge approval briefly: "Great — generating your skill file now."
2. Proceed to Stage 4 (Skill File Generation)

### Path B: Provide Feedback / Request Specific Changes

The user wants adjustments to specific parts of the outline — phrases like "change the description", "add a feature", "remove X", "the workflow should be...", or general feedback about specific sections.

**Action:**
1. Parse the feedback to identify which outline sections are affected
2. Apply the requested changes to the affected sections only — do not regenerate unaffected sections
3. If the feedback is ambiguous, ask one clarifying question before making changes
4. Present the updated outline (show the full outline with changes incorporated, not just a diff)
5. Prompt for review again using the same review prompt from Section 3.2

**Multiple feedback rounds are supported.** Each round follows the same pattern: apply changes, present updated outline, prompt for review. There is no limit on the number of feedback rounds — continue until the user approves or requests major changes.

### Path C: Major Rework

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

## 3.4 Gap Detection

If the outline generation process reveals information gaps — sections that cannot be populated meaningfully — handle them before presenting the outline.

### Identifying Gaps

Gaps are detected during the pre-generation validation (Section 3.1) or while writing specific outline sections. Common gap scenarios:

- A workflow step was mentioned but never detailed (e.g., "it processes the files" with no specifics on how)
- A feature was listed without enough context to describe its behavior
- Configuration requires a decision the user never made (e.g., whether to use reference files)
- Error handling approach was never discussed for a complex skill
- Trigger scenarios are unclear or too generic for a good description

### Handling Gaps

**Minor gaps** (can be filled with reasonable defaults):
- Fill with a reasonable default based on the skill's overall context
- Mark the defaulted item in the outline with "[Default — please review]"
- Present the outline normally — the user can adjust during the review step

**Significant gaps** (cannot be reasonably defaulted — the information is critical to the outline):
- Do NOT present an incomplete outline
- Before presenting the outline, ask the user for the specific missing information
- Frame the question with context: "While preparing your outline, I realized I need a bit more detail about [specific gap]. [Targeted question]"
- Limit gap-fill questions to at most 2 — if more than 2 significant gaps exist, present the outline with the most critical gaps filled and the rest marked as "[Default — please review]"
- After receiving the answer, incorporate it and then present the complete outline

## 3.5 Incomplete Section Flagging

When any section of the outline is based on incomplete information, limited context, or reasonable assumptions rather than explicit user input, flag it visibly so the user can prioritize their review.

**Flagging format:**

Use an inline marker at the end of the relevant bullet or paragraph:

- For defaulted values: `[Default — please review]`
- For assumptions derived from context: `[Assumed from {source} — please verify]`
- For sections with limited detail: `[Minimal detail collected — consider expanding]`

If an entire section is flagged, add a brief note at the top of that section:

> **Note:** This section is based on limited information from the interview. Please review carefully and provide feedback on anything that should change.

## 3.6 Transition to Stage 4

Only transition to Stage 4 when the user has explicitly approved the outline. Approval signals:

- Direct approval phrases (see Path A in Section 3.3)
- Approval after one or more feedback rounds
- Approval after major rework and re-presentation

After approval:
1. Store the approved outline internally as the blueprint for Stage 4
2. Note any remaining "[Default — please review]" items — these should be handled conservatively during generation (use the default but keep the generated content easy to modify)
3. Proceed to Stage 4
