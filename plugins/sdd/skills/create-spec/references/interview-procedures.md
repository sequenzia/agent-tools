# Interview Procedures

Detailed procedures for conducting the adaptive interview in Phase 2 of the create-spec workflow.

## Interview Strategy

### Depth-Aware Questioning

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

### Question Categories

Cover all four categories, but adjust depth based on level:

1. **Problem & Goals**: Problem statement, success metrics, user personas, business value
2. **Functional Requirements**: Features, user stories, acceptance criteria, workflows
3. **Technical Specs**: Architecture, tech stack, data models, APIs, constraints
4. **Implementation**: Phases, dependencies, risks, out of scope items

### Expanded Budgets

When `complexity_detected` is set (user opted in after complexity assessment), use expanded budgets from `../sdd-specs/references/interview-questions.md` (section "Expanded Budgets (Complexity Detected)") instead of the standard budgets above. Soft ceiling of ~8 rounds / ~35 questions applies.

### Adaptive Behavior

- **Build on previous answers**: Reference what the user already told you
- **Skip irrelevant questions**: If user says "no preference" on tech stack, skip detailed tech questions
- **Probe deeper on important areas**: If user indicates something is critical, ask follow-up questions
- **Explore codebase when helpful**: For "new feature" type, offer to explore relevant code (with user approval)
- **If something is unclear, ask for clarification** rather than assuming

### Context-Informed Questioning

When user-supplied context was loaded in Phase 1, apply these strategies throughout the interview:

1. **Reference specifics from context** when asking questions — e.g., "Your context mentions a notification service — what events should trigger notifications?"
2. **Identify gaps in context and probe those first** — areas the context doesn't address are the highest-value questions
3. **Confirm assumptions the context implies but doesn't state** — e.g., "The context describes multiple services. Should these be independently deployable microservices?"
4. **Skip surface-level questions and go deeper** — don't ask "what are you building?" when the context already describes it; instead ask about edge cases, constraints, and trade-offs
5. **Cross-reference with complexity signals** — ensure areas that drove the complexity assessment get thorough coverage in the interview

## Round Structure

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

## Proactive Recommendations

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

## Using Exploration Findings in Interview

When codebase exploration was performed, use the findings throughout the interview:

1. **Tailor technical questions** — Reference specific files, patterns, and conventions discovered during exploration
2. **Skip answered questions** — If exploration already revealed tech stack, data models, or architecture, confirm rather than ask open-ended questions
3. **Ask targeted integration questions** — e.g., "The codebase uses {pattern X} for similar features. Should this feature follow the same pattern?"
4. **Surface risks early** — If exploration found challenges (tight coupling, missing tests, complex dependencies), ask about acceptable trade-offs
5. **Inform recommendations** — Use exploration findings as evidence for recommendations in Phase 3

Store findings internally as "Codebase Context" and reference throughout interview and spec compilation.

## External Research

Research can be invoked in two ways: on-demand when the user requests it, or proactively for specific high-value topics.

### On-Demand Research

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

### Proactive Research

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

### Invoking Research

Invoke the `research` skill by reading `../research/SKILL.md` and following its workflow. Provide:

- **Research topic**: The specific subject to investigate
- **Context**: Spec name, feature description, current interview state
- **Specific questions**: 1-3 focused questions the research should answer
- **Depth level**: Match the spec's depth level

Dispatch per the Execution Strategy section at the bottom of SKILL.md.

### Incorporating Research Findings

After receiving research results:

1. **Add to interview notes** under the appropriate category:
   - Technical findings → Technical Specifications
   - Best practices → Functional Requirements
   - Compliance → Non-Functional Requirements
   - Competitive → Problem Statement / Solution Overview

2. **Use findings for recommendations**: Research-backed recommendations are more valuable; include source attribution

3. **Use findings to ask informed follow-ups**: Research may reveal new areas to explore

4. **Credit sources**: Include research sources in spec references section

### Tracking Research Usage

Track proactive research usage during the interview:
```
Proactive Research: 1/2 used
- [Round 2] GDPR requirements - informed compliance recommendation
```

## Early Exit

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
