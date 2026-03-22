---
name: create-spec
description: >-
  Create a new specification through an adaptive interview process with proactive
  recommendations and optional research. Supports high-level, detailed, and full
  technical documentation depths. Use when user says "create spec", "new spec",
  "generate spec", "write a spec", "PRD", "product requirements", or wants to
  start a specification document.
metadata:
  argument-hint: "[context-file-or-text]"
  type: workflow
allowed-tools: Read Write Glob Grep Bash
---

# Create Spec

You are initiating the spec creation workflow. This process gathers requirements through an adaptive, multi-round interview and generates a comprehensive specification document.

## Critical Rules

### question tool is MANDATORY

**IMPORTANT**: You MUST use the `question` tool for ALL questions to the user. Never ask questions through regular text output.

- Every interview question -> `question`
- Confirmation questions -> `question`
- Yes/no consent questions -> `question`
- Clarifying questions -> `question`

Text output should only be used for:
- Summarizing what you've learned
- Presenting information
- Explaining context

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

- **Option labels must be self-descriptive**: There is no separate `description` field per option. Fold context into the label text (e.g., `"OAuth 2.0 with PKCE — secure token handling for public clients"` instead of a separate label + description).
- **Mark recommended options**: Append `"(Recommended)"` to the label text of recommended choices.
- **Return format**: Answers are returned as arrays of selected labels.
- **Multi-select**: Use `multiple: true` for questions where users should select multiple items.
- **Custom input**: `custom: true` is the default — freeform text input is always available unless you explicitly set `custom: false`.
- **Single question per call**: The `question` tool accepts one question per invocation. Ask each question individually using separate calls.

**NEVER do this** (asking via text output):
```
What features are most important to you?
1. Performance
2. Usability
3. Security
```

**ALWAYS do this** (using question tool):
```yaml
question:
  header: "Priority"
  text: "What features are most important to you?"
  options:
    - label: "Performance — Speed and responsiveness"
    - label: "Usability — Ease of use"
    - label: "Security — Data protection"
  multiple: true
```

### Plan Mode Behavior

**CRITICAL**: This skill generates a spec document, NOT an implementation plan. When invoked in a planning context:

- **DO NOT** create an implementation plan for how to build the spec's described features
- **DO NOT** defer spec generation to an "execution phase"
- **DO** proceed with the full interview and spec generation workflow immediately
- **DO** write the spec file to the output path as normal

The spec is a planning artifact itself — generating it IS the planning activity.

## Load Reference Skills

Before starting the workflow, load the sdd-specs reference for templates, interview questions, and recommendation patterns:

```
Read ../sdd-specs/SKILL.md
```

This reference provides:
- Spec templates (high-level, detailed, full-tech)
- Interview question bank organized by category and depth
- Complexity signal definitions and thresholds
- Recommendation trigger patterns and presentation format
- Codebase exploration procedure for "new feature" type

## Workflow Overview

This workflow has five phases:

1. **Initial Inputs** — Gather spec name, type, depth, and description (includes codebase exploration for "new feature" type)
2. **Adaptive Interview** — Multi-round depth-aware interview with recommendations and optional research
3. **Recommendations Round** — Dedicated round for accumulated best-practice suggestions (if applicable)
4. **Pre-Compilation Summary** — Present gathered requirements for user confirmation
5. **Spec Compilation** — Generate spec from template and write to file

---

## Phase 1: Initial Inputs & Context

### Context Loading

If arguments are provided, load user-supplied context before gathering initial inputs:

1. **Determine input type**:
   - If the argument looks like a file path (ends in `.md`, `.txt`, or `.markdown`; or starts with `/`, `./`, `../`, or `~`; or contains path separators and the file exists) → read the file using the `Read` tool
   - Otherwise → treat the entire argument string as inline context text

2. **Store internally** as "User-Supplied Context" for use throughout the interview

3. **CRITICAL**: User-supplied context makes the interview *smarter*, not shorter. Do NOT pre-fill answers or skip questions based on context. Instead:
   - Ask more targeted, specific questions informed by the context
   - Probe areas the context doesn't cover
   - Confirm implicit assumptions the context makes
   - Reference specific details from the context when asking questions

If no arguments are provided, skip this subsection entirely — the skill behaves exactly as before.

### Complexity Assessment

If user-supplied context was loaded, assess its complexity:

1. **Read** `../sdd-specs/references/complexity-signals.md` for signal definitions and thresholds
2. **Scan** the user-supplied context for complexity signals
3. **If threshold is met** (3+ high-weight signals OR 5+ any-weight signals), present a brief notice via the `question` tool:
   ```yaml
   question:
     header: "Complexity"
     text: "This appears to involve significant complexity (e.g., {top 2-3 complexity areas}). The interview will be more thorough to ensure complete coverage. Ready to proceed?"
     options:
       - label: "Yes, let's be thorough — Use expanded interview budgets for deeper coverage"
       - label: "Keep it brief — Use standard interview budgets"
     custom: false
   ```
4. If user selects "Yes, let's be thorough" → set internal `complexity_detected` flag for expanded budgets
5. If user selects "Keep it brief" → proceed with standard budgets
6. If no context was loaded or threshold was not met → proceed with standard budgets (no alert shown)

### Gather Initial Inputs

Use the `question` tool to gather the essential starting information. Ask each question individually:

**Question 1 - Spec Name:**
```yaml
question:
  header: "Spec Name"
  text: "What would you like to name this spec?"
  options:
    - label: "Provide a descriptive name for your specification"
  custom: true
```

**Question 2 - Type:**
```yaml
question:
  header: "Type"
  text: "What type of product/feature is this?"
  options:
    - label: "New product — A completely new product being built from scratch"
    - label: "New feature — A new feature for an existing product"
  custom: false
```

**Question 3 - Depth:**
```yaml
question:
  header: "Depth"
  text: "How detailed should the spec be?"
  options:
    - label: "High-level overview (Recommended) — Executive summary with key features and goals"
    - label: "Detailed specifications — Standard spec with acceptance criteria and phases"
    - label: "Full technical documentation — Comprehensive specs with API definitions and data models"
  custom: false
```

**Question 4 - Description:**
- If context was loaded:
  ```yaml
  question:
    header: "Description"
    text: "I've loaded the context you provided. Is there anything it doesn't cover, or would you like to highlight specific priorities?"
    options:
      - label: "Context is complete — Proceed with what's provided"
    custom: true
  ```
- If no context:
  ```yaml
  question:
    header: "Description"
    text: "Briefly describe the product/feature and its key requirements."
    options:
      - label: "Describe the problem, main features, and any constraints"
    custom: true
  ```

---

## Phase 2: Adaptive Interview

### Codebase Exploration (New Feature Type)

If the product type is "New feature for existing product":

1. **Read the exploration procedure:** `../sdd-specs/references/codebase-exploration.md`
2. **Follow all 4 steps** (Quick Reconnaissance → Plan Focus Areas → Parallel Exploration → Synthesis)
3. After synthesis, store the merged findings internally as "Codebase Context" for use in subsequent interview rounds and spec compilation
4. Present a brief summary of key findings to the user before starting the interview

**Error handling / fallback:**
If exploration agents fail:
1. If some agents succeeded: continue with partial findings — merge what's available
2. If all agents failed: use the reconnaissance findings from Step 1 as minimal context
3. If reconnaissance also failed, use the `question` tool to offer fallback:
   ```yaml
   question:
     header: "Fallback"
     text: "Codebase exploration encountered an issue. How would you like to proceed?"
     options:
       - label: "Quick exploration — Fall back to basic Glob/Grep/Read exploration"
       - label: "Skip — Continue without codebase analysis"
     custom: false
   ```
4. If quick exploration: use basic Glob/Grep/Read to understand existing patterns, related features, integration points, and data models
5. If skip: continue to the interview with whatever findings were gathered

### Prepare for Interview

Before starting Round 1, read these reference files to load the full question bank and trigger patterns:

1. `../sdd-specs/references/interview-questions.md` — Question bank organized by category and depth level
2. `../sdd-specs/references/recommendation-triggers.md` — Trigger patterns for proactive recommendations across all domains

Use these as your primary source for questions and trigger detection throughout the interview.

### Interview Strategy

#### Depth-Aware Questioning

Adapt your interview depth based on the requested level:

**High-level overview** (2-3 rounds):
- Focus on problem, goals, key features, and success metrics
- Skip deep technical details
- Ask broader, strategic questions
- Total of 6-10 questions across all rounds

**Detailed specifications** (3-4 rounds):
- Balanced coverage of all categories
- Include acceptance criteria for features
- Cover technical constraints without deep architecture
- Total of 12-18 questions across all rounds

**Full technical documentation** (4-5 rounds):
- Deep probing on all areas
- Request specific API endpoints, data models
- Detailed performance and security requirements
- Total of 18-25 questions across all rounds

#### Question Categories

Cover all four categories, but adjust depth based on level:

1. **Problem & Goals**: Problem statement, success metrics, user personas, business value
2. **Functional Requirements**: Features, user stories, acceptance criteria, workflows
3. **Technical Specs**: Architecture, tech stack, data models, APIs, constraints
4. **Implementation**: Phases, dependencies, risks, out of scope items

#### Expanded Budgets

When `complexity_detected` is set (user opted in after complexity assessment), use expanded budgets from `../sdd-specs/references/interview-questions.md` (section "Expanded Budgets (Complexity Detected)") instead of the standard budgets above. Soft ceiling of ~8 rounds / ~35 questions applies.

#### Adaptive Behavior

- **Build on previous answers**: Reference what the user already told you
- **Skip irrelevant questions**: If user says "no preference" on tech stack, skip detailed tech questions
- **Probe deeper on important areas**: If user indicates something is critical, ask follow-up questions
- **Explore codebase when helpful**: For "new feature" type, offer to explore relevant code (with user approval)
- **If something is unclear, ask for clarification** rather than assuming

#### Context-Informed Questioning

When user-supplied context was loaded in Phase 1, apply these strategies throughout the interview:

1. **Reference specifics from context** when asking questions — e.g., "Your context mentions a notification service — what events should trigger notifications?"
2. **Identify gaps in context and probe those first** — areas the context doesn't address are the highest-value questions
3. **Confirm assumptions the context implies but doesn't state** — e.g., "The context describes multiple services. Should these be independently deployable microservices?"
4. **Skip surface-level questions and go deeper** — don't ask "what are you building?" when the context already describes it; instead ask about edge cases, constraints, and trade-offs
5. **Cross-reference with complexity signals** — ensure areas that drove the complexity assessment get thorough coverage in the interview

### Round Structure

Each round MUST:
1. Summarize what you've learned so far (briefly) — use text output
2. Ask 3-5 focused questions using the `question` tool — REQUIRED, never use text for questions
3. Use a mix of multiple choice (for structured data) and open text (for details)
4. **Detect triggers**: Note any recommendation triggers in user responses
5. **Offer inline insights** (optional): If triggers detected, offer 1-2 brief recommendations
6. Acknowledge responses before moving to next round

**Question Guidelines:**
- Keep questions clear and specific
- Provide helpful options for multiple choice where appropriate
- Group related questions together
- Ask each question individually — one `question` call per question

**Example Question Patterns:**

For structured choices:
```yaml
question:
  header: "Priority"
  text: "What priority is this feature?"
  options:
    - label: "P0 - Critical — Must have for initial release"
    - label: "P1 - High — Important but can follow fast"
    - label: "P2 - Medium — Nice to have"
  custom: false
```

For open-ended input:
```yaml
question:
  header: "Problem"
  text: "What specific problem are you trying to solve?"
  options:
    - label: "Efficiency — Users spend too much time on manual tasks"
    - label: "Quality — Current solution produces errors or poor results"
    - label: "Access — Users can't do something they need to do"
  custom: true
```

### Proactive Recommendations

Throughout the interview, watch for patterns in user responses that indicate opportunities for best-practice recommendations. When detected, offer relevant suggestions based on industry standards.

**Trigger Detection**: After receiving user responses each round, scan for trigger keywords from the loaded `../sdd-specs/references/recommendation-triggers.md`. The file covers domains including: Authentication, Scale & Performance, Security & Compliance, Real-Time Features, File & Media, API Design, Search & Discovery, Testing, and Accessibility.

**When to Offer Recommendations:**
- **Inline insights**: Brief suggestions during rounds when triggers detected (max 2 per round)
- **Recommendations round**: Accumulated recommendations presented in Phase 3
- Always present recommendations for user approval — never assume acceptance

**Inline Insight Format:**
```yaml
question:
  header: "Quick Insight"
  text: "{Brief recommendation}. Would you like to include this in the spec?"
  options:
    - label: "Include this — Add to spec requirements"
    - label: "Tell me more — Get more details"
    - label: "Skip — Continue without this"
  custom: false
```

**For detailed recommendation templates, refer to:** `../sdd-specs/references/recommendation-format.md`

**Tracking Recommendations:**
Maintain internal tracking of detected triggers and accepted recommendations:
- Detected triggers with source round
- Accepted recommendations with target spec section
- Skipped/modified recommendations

**Trigger Detection per Round:**
- After receiving user responses, scan for trigger keywords
- Note triggers internally for the recommendations round
- For high-priority triggers (compliance, security), consider inline insight immediately

### Using Exploration Findings in Interview

When codebase exploration was performed, use the findings throughout the interview:

1. **Tailor technical questions** — Reference specific files, patterns, and conventions discovered during exploration
2. **Skip answered questions** — If exploration already revealed tech stack, data models, or architecture, confirm rather than ask open-ended questions
3. **Ask targeted integration questions** — e.g., "The codebase uses {pattern X} for similar features. Should this feature follow the same pattern?"
4. **Surface risks early** — If exploration found challenges (tight coupling, missing tests, complex dependencies), ask about acceptable trade-offs
5. **Inform recommendations** — Use exploration findings as evidence for recommendations in Phase 3

Store findings internally as "Codebase Context" and reference throughout interview and spec compilation.

### External Research

Research can be invoked in two ways: on-demand when the user requests it, or proactively for specific high-value topics.

#### On-Demand Research

When the user explicitly requests research about technologies or general topics during the interview, invoke the research skill.

**Technical research triggers:**
- "Research the {API/library} documentation"
- "Look up what {technology} supports"
- "Check the docs for {feature}"
- "What does {library} provide for {feature}?"

**General topic research triggers:**
- "Research best practices for {area}"
- "How do competitors handle {feature}?"
- "What are the industry standards for {area}?"
- "Research {compliance} requirements" (GDPR, HIPAA, WCAG, etc.)
- "Help me understand the problem space for {domain}"
- "What do users expect from {feature type}?"

#### Proactive Research

**You MAY proactively research** (without explicit user request) for specific high-value topics:

**Auto-research triggers:**
- **Compliance mentions**: GDPR, HIPAA, PCI DSS, SOC 2, WCAG, ADA compliance
- **User uncertainty**: "I'm not sure", "what do you recommend?", "what's standard?"
- **Complex trade-offs**: When multiple valid approaches exist and current information would help

**Proactive research limit**: Maximum 2 proactive research calls per interview to avoid slowing down the process.

**Before proactive research**, briefly inform the user:
```
Since you mentioned GDPR compliance, let me quickly research the current requirements to ensure we capture them accurately.
```

#### Invoking Research

Invoke the `research` skill by reading `../research/SKILL.md` and following its workflow. Provide:

- **Research topic**: The specific subject to investigate
- **Context**: Spec name, feature description, current interview state
- **Specific questions**: 1-3 focused questions the research should answer
- **Depth level**: Match the spec's depth level

Dispatch per the Execution Strategy section at the bottom of this file.

#### Incorporating Research Findings

After receiving research results:

1. **Add to interview notes** under the appropriate category:
   - Technical findings → Technical Specifications
   - Best practices → Functional Requirements
   - Compliance → Non-Functional Requirements
   - Competitive → Problem Statement / Solution Overview

2. **Use findings for recommendations**: Research-backed recommendations are more valuable; include source attribution

3. **Use findings to ask informed follow-ups**: Research may reveal new areas to explore

4. **Credit sources**: Include research sources in spec references section

#### Tracking Research Usage

Track proactive research usage during the interview:
```
Proactive Research: 1/2 used
- [Round 2] GDPR requirements - informed compliance recommendation
```

### Early Exit

If the user indicates they want to wrap up early (signals like "I think that's enough", "let's wrap up", "that covers it", "skip the rest"), handle it gracefully:

1. Acknowledge the request
2. Present a truncated summary of what was gathered so far using the Pre-Compilation Summary format (Phase 4)
3. Use the `question` tool to confirm:
   ```yaml
   question:
     header: "Early Exit"
     text: "Here's what I've gathered so far. Should I generate the spec with this information, or would you like to add anything?"
     options:
       - label: "Generate spec — Proceed with what we have"
       - label: "Add more — I want to provide additional details"
     custom: false
   ```
4. If generating, add `**Status**: Draft (Partial)` to the spec metadata to indicate incomplete coverage
5. Proceed to Phase 5 (Spec Compilation)

---

## Phase 3: Recommendations Round

After completing the main interview rounds and before the summary, present a dedicated recommendations round.

### When to Include

- **Skip for high-level depth**: High-level specs focus on problem/goals; recommendations may be premature
- **Include for detailed/full-tech**: These depths benefit from architectural and technical recommendations
- **Skip if no triggers detected**: If no recommendation triggers were found, proceed directly to Phase 4

### Recommendation Categories

Present recommendations organized by category:

1. **Architecture**: Patterns, scaling approaches, data models
2. **Security**: Authentication, encryption, compliance
3. **User Experience**: Accessibility, performance, error handling
4. **Operational**: Monitoring, deployment, testing strategies

### Presentation Format

Introduce the recommendations round briefly:

```
Based on what you've shared, I have a few recommendations based on industry best practices.
I'll present each for your review — you can accept, modify, or skip any of them.
```

Then present each recommendation using the `question` tool:

```yaml
question:
  header: "Rec {N}/{Total}"
  text: "{Recommendation}\n\n**Why this matters:**\n{Brief rationale}"
  options:
    - label: "Accept — Include in spec"
    - label: "Modify — Adjust this recommendation"
    - label: "Skip — Don't include"
  custom: false
```

### Handling Modifications

If user selects "Modify":
1. Ask what they'd like to change using the `question` tool
2. Present the modified recommendation for confirmation
3. Add the modified version to accepted recommendations

### Tracking

After the recommendations round, update internal tracking:
- Mark each recommendation as accepted, modified, or skipped
- Note the target spec section for accepted recommendations
- Modified recommendations include the user's adjustments

---

## Phase 4: Pre-Compilation Summary

Before compilation, present a comprehensive summary:

```markdown
## Requirements Summary

### Problem & Goals
- Problem: {summarized problem statement}
- Success Metrics: {list metrics}
- Primary User: {persona description}
- Business Value: {why this matters}

### Functional Requirements
{List each feature with acceptance criteria}

### Technical Specifications
- Tech Stack: {choices or constraints}
- Integrations: {systems to integrate with}
- Performance: {requirements}
- Security: {requirements}

### Implementation
- Phases: {list phases}
- Dependencies: {list dependencies}
- Risks: {list risks}
- Out of Scope: {list exclusions}

### Agent Recommendations (Accepted)
*The following recommendations were suggested based on industry best practices and accepted during the interview:*

1. **{Category}**: {Recommendation title}
   - Rationale: {Why this was recommended}
   - Applies to: {Which section/feature}

{Continue for all accepted recommendations, or note "No recommendations accepted" if none}

### Open Questions
{Any unresolved items}
```

**Important**: Clearly distinguish the "Agent Recommendations" section from user-provided requirements. This transparency helps stakeholders understand which requirements came from the user versus agent suggestions.

Then use the `question` tool to confirm:

```yaml
question:
  header: "Summary"
  text: "Is this requirements summary accurate and complete?"
  options:
    - label: "Yes, proceed to spec — Summary is accurate, generate the spec"
    - label: "Needs corrections — I have changes or additions"
  custom: false
```

If user selects "Needs corrections", ask what they'd like to change using the `question` tool, then update the summary and confirm again.

**Never skip the summary confirmation step.** Only proceed to compilation after user explicitly confirms via the `question` tool.

---

## Phase 5: Spec Compilation

### Template Selection

Choose the appropriate template based on depth level:

| Depth Level | Template | Use Case |
|-------------|----------|----------|
| High-level overview | `../sdd-specs/references/templates/high-level.md` | Executive summaries, stakeholder alignment, initial scoping |
| Detailed specifications | `../sdd-specs/references/templates/detailed.md` | Standard development specs with clear requirements |
| Full technical documentation | `../sdd-specs/references/templates/full-tech.md` | Complex features requiring API specs, data models, architecture |

### Diagram Guidance (Detailed/Full-Tech Only)

For "Detailed specifications" and "Full technical documentation" depth levels, load the technical-diagrams skill before compilation:

```
Read ../technical-diagrams/SKILL.md
```

Apply its styling rules when generating Mermaid diagrams in the spec — use `classDef` with `color:#000` for all node styles. For "High-level overview" depth, skip diagram loading.

### Compilation Steps

1. **Read the appropriate template** based on depth level

2. **Apply spec metadata formatting**:
   - Use the title format `# {spec-name} PRD`
   - Include these metadata fields in the header block after Status:
     - `**Spec Type**`: The product type selected during the interview
     - `**Spec Depth**`: The depth level selected
     - `**Description**`: The initial description provided by the user
   - If early exit was used, set `**Status**: Draft (Partial)`

3. **Organize information** into template sections

4. **Fill gaps** by inferring logical requirements (flag assumptions clearly)

5. **Add acceptance criteria** for each functional requirement

6. **Define phases** with clear completion criteria

7. **Insert checkpoint gates** at critical decision points

8. **Review for completeness** before writing

9. **Confirm output path** with the user:
   ```yaml
   question:
     header: "Output"
     text: "Where should I save the spec? Default: specs/{name}-SPEC.md"
     options:
       - label: "Use default path"
     custom: true
   ```

10. **Write the spec** to the confirmed output path

11. **Present the completed spec location** to the user

### Writing Guidelines

#### Requirement Formatting

```markdown
### REQ-001: [Requirement Name]

**Priority**: P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)

**Description**: Clear, concise statement of what is needed.

**Acceptance Criteria**:
- [ ] Criterion 1
- [ ] Criterion 2

**Notes**: Any additional context or constraints.
```

#### User Story Format

```markdown
**As a** [user type]
**I want** [capability]
**So that** [benefit/value]
```

#### API Specification Format (Full Tech Only)

```markdown
#### Endpoint: `METHOD /path`

**Purpose**: Brief description

**Request**:
- Headers: `Content-Type: application/json`
- Body:
  ```json
  {
    "field": "type - description"
  }
  ```

**Response**:
- `200 OK`: Success response schema
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Authentication required
```

---

## Core Principles

These principles guide how specs should be structured:

### 1. Phase-Based Milestones (Not Timelines)

Specs should define clear phases with completion criteria rather than time estimates:

- **Phase 1: Foundation** - Core infrastructure and data models
- **Phase 2: Core Features** - Primary user-facing functionality
- **Phase 3: Enhancement** - Secondary features and optimizations
- **Phase 4: Polish** - UX refinement, edge cases, documentation

### 2. Testable Requirements

Every requirement should include:
- **Clear acceptance criteria** - Specific, measurable conditions for completion
- **Test scenarios** - How to verify the requirement is met
- **Edge cases** - Known boundary conditions to handle

### 3. Human Checkpoint Gates

Define explicit points where human review is required:
- Architecture decisions before implementation begins
- API contract review before integration work
- Security review before authentication/authorization features
- UX review before user-facing changes ship

### 4. Context for AI Consumption

Structure specs for optimal AI assistant consumption:
- Use consistent heading hierarchy
- Include code examples where applicable
- Reference existing patterns in the codebase
- Provide clear file location guidance

---

## Agents

This skill invokes the following skills for agent access:

| Skill Invoked | Agent Accessed | Purpose |
|---------------|---------------|---------|
| `code-exploration` | code-explorer | Focused codebase investigation for "new feature" type (Phase 1) |
| `research` | researcher | Best practices, compliance, and technology research (Phase 2) |

## Execution Strategy

**If subagent dispatch is available:** Dispatch each code-exploration invocation as a parallel subagent (Phase 1 codebase exploration). Dispatch the research skill as a subagent when research is triggered (Phase 2).

**If subagent dispatch is not available:** For codebase exploration, read `../code-exploration/SKILL.md` and follow its workflow sequentially for each focus area. For research, read `../research/SKILL.md` and follow its instructions directly inline.

## Agent Coordination

- The lead (you) acts as the interviewer: manages the full interview lifecycle, tracks recommendations, and compiles the final spec
- Codebase exploration is delegated to the `code-exploration` skill, not managed directly
- Research agents work independently and return structured findings
- Handle agent failures gracefully — continue with partial results when possible

---

## Reference Files

- `../sdd-specs/references/interview-questions.md` — Question bank organized by category and depth level (includes expanded budgets for complex projects)
- `../sdd-specs/references/complexity-signals.md` — Signal definitions, thresholds, and assessment format for complexity detection
- `../sdd-specs/references/recommendation-triggers.md` — Trigger patterns for proactive recommendations
- `../sdd-specs/references/recommendation-format.md` — Templates for presenting recommendations
- `../sdd-specs/references/codebase-exploration.md` — Procedure for team-based codebase exploration (new feature type)
- `../sdd-specs/references/templates/high-level.md` — Streamlined executive overview template
- `../sdd-specs/references/templates/detailed.md` — Standard spec template with all sections
- `../sdd-specs/references/templates/full-tech.md` — Extended template with technical specifications
