# Curation Interview Procedures

Detailed procedures for the interactive curation interview in Phase 3 of the inverted-spec workflow. This interview is fundamentally different from create-spec's interview: instead of open-ended requirements gathering, it presents discovered facts and asks the user to confirm, adjust, or supplement them.

The interview has four stages executed in order. Each stage uses the `question` tool for all user interaction.

---

## Stage A: Feature Curation (1-2 rounds)

**Goal:** Let the user select which discovered features to include in the spec and validate observed patterns.

### Round 1: Feature Inventory

Extract a feature inventory from the analysis findings. Each "feature" is a distinct capability or functional area discovered in the codebase — for example, "User Authentication", "REST API", "Background Job Processing", "Admin Dashboard".

Present using the `question` tool with multi-select:

```yaml
question:
  header: "Feature Selection"
  text: "I found the following features/capabilities in the codebase. Select which ones should be included in the spec. Deselected items will be documented as 'Out of Scope'."
  options:
    - label: "{Feature Name} — {brief description} ({primary directory or module})"
    - label: "{Feature Name} — {brief description} ({primary directory or module})"
    # ... one option per discovered feature
  multiple: true
  custom: true
```

**Guidelines for feature extraction:**
- Group by functional capability, not by directory or file
- Include the primary directory/module in parentheses for orientation
- Aim for 4-12 features — fewer for small codebases, more for large ones
- If only 1-3 features are found, this is likely a focused utility; present the sub-capabilities instead
- The `custom: true` option lets users add features the analysis missed

**Processing the response:**
- Selected features → mark as "Included" for spec generation
- Deselected features → mark as "Out of Scope" with reason "excluded during curation"
- Custom entries → mark as "User-provided" and include in spec (these will need extra gap-filling)

### Round 2: Pattern Validation (optional)

If the analysis discovered significant architectural patterns, present them for validation. Skip this round if patterns are straightforward or the depth is high-level.

```yaml
question:
  header: "Architecture Patterns"
  text: "The analysis identified these architectural patterns. Confirm which are intentional design choices vs. accidental patterns that shouldn't be documented as conventions."
  options:
    - label: "{Pattern} — Observed in {location}. Intentional?"
    - label: "{Pattern} — Observed in {location}. Intentional?"
  multiple: true
  custom: false
```

Selected patterns are documented as intentional architectural decisions. Deselected patterns are noted internally but not promoted as conventions in the spec.

---

## Stage B: Gap-Filling (1-3 rounds)

**Goal:** Gather information that code analysis cannot provide. These are questions whose answers genuinely cannot be inferred from source code.

### Question Selection

Draw from a curated subset of the `sdd-specs/references/interview-questions.md` question bank, focusing on questions not answerable from code. The analysis findings should inform which questions to skip and which to probe deeper.

### Depth-Dependent Budgets

| Depth | Rounds | Questions | Focus |
|-------|--------|-----------|-------|
| High-level | 1 | 3-5 | Problem, users, success metrics, future direction |
| Detailed | 2 | 6-10 | Add acceptance criteria context, integration details, risks, business value |
| Full-tech | 3 | 10-15 | Add performance targets, security posture, deployment strategy, testing approach |

### Core Gap-Filling Questions

**All depths — Round 1:**

1. **Problem Statement** (if not provided in Phase 1 context):
   ```yaml
   question:
     header: "Problem"
     text: "What problem does this codebase solve? Who are the primary users?"
     options:
       - label: "Describe the problem and the people it affects"
     custom: true
   ```

2. **Success Metrics:**
   ```yaml
   question:
     header: "Success"
     text: "How is success measured for this project? What are the key performance indicators?"
     options:
       - label: "No formal metrics — This is an internal tool / utility"
       - label: "Standard business metrics — Revenue, users, engagement"
     custom: true
   ```

3. **User Personas:**
   ```yaml
   question:
     header: "Users"
     text: "Who are the primary users? What are their roles and goals?"
     options:
       - label: "Developers — Building on or extending this system"
       - label: "End users — Interacting through a UI or API"
       - label: "Operations — Managing and monitoring the system"
     multiple: true
     custom: true
   ```

4. **Scope Boundaries:**
   ```yaml
   question:
     header: "Future Plans"
     text: "Is there anything planned but not yet built? Anything explicitly out of scope for this spec?"
     options:
       - label: "No planned changes — Document what exists"
       - label: "There are planned additions — I'll describe them"
     custom: true
   ```

**Detailed & Full-tech — Round 2:**

5. **Business Value:**
   ```yaml
   question:
     header: "Business Value"
     text: "What business value does this project deliver? How does it align with team or company goals?"
     options:
       - label: "Revenue generation — Directly drives income"
       - label: "Cost reduction — Automates or streamlines processes"
       - label: "Enablement — Supports other teams or products"
       - label: "Compliance — Meets regulatory or legal requirements"
     custom: true
   ```

6. **Non-Functional Requirements Context:**
   ```yaml
   question:
     header: "Non-Functional"
     text: "Are there SLAs, compliance requirements, or scalability targets not documented in code?"
     options:
       - label: "No formal requirements — Best-effort approach"
       - label: "Yes, there are targets — I'll specify them"
     custom: true
   ```

7. **Risk Awareness:**
   ```yaml
   question:
     header: "Known Risks"
     text: "The analysis found these potential risks: {top 2-3 risks from analysis}. Are there additional risks or concerns you're aware of?"
     options:
       - label: "These cover it — No additional risks"
       - label: "There are more — I'll describe additional concerns"
     custom: true
   ```

**Full-tech — Round 3:**

8. **Performance Context:**
   ```yaml
   question:
     header: "Performance"
     text: "Are there specific performance targets (response times, throughput, concurrent users) beyond what the code implies?"
     options:
       - label: "No specific targets — Document observed patterns"
     custom: true
   ```

9. **Security Posture:**
   ```yaml
   question:
     header: "Security"
     text: "Are there security or compliance frameworks this project must adhere to? (GDPR, HIPAA, SOC 2, etc.)"
     options:
       - label: "No formal compliance requirements"
       - label: "Yes — I'll specify the frameworks"
     custom: true
   ```

10. **Testing & Deployment Strategy:**
    ```yaml
    question:
      header: "Testing"
      text: "Beyond what tests exist in the codebase, are there testing requirements or coverage targets? What's the deployment process?"
      options:
        - label: "Document what exists — No additional requirements"
        - label: "There are additional requirements — I'll specify"
      custom: true
    ```

### Adaptive Behavior

- **Skip questions already answered:** If the user provided context in Phase 1 that answers a gap-filling question, skip it and reference the earlier answer
- **Skip questions answered by analysis:** If analysis clearly reveals the answer (e.g., the codebase has extensive test suites), confirm rather than ask open-ended
- **Probe deeper on uncertainty:** If the user indicates an area is important or complex, ask follow-up questions
- **Reference analysis findings:** Frame questions with what the analysis found — e.g., "The codebase uses JWT for authentication. Are there additional auth requirements beyond what's implemented?"

---

## Stage C: Optional Research (0-1 rounds)

**Goal:** Offer to research topics identified during analysis or gap-filling that would benefit from external knowledge.

### When to Offer Research

Offer research when any of these conditions are met:
- The analysis found compliance-related code (auth, encryption, data handling) and the user confirmed compliance requirements
- The user expressed uncertainty about best practices ("I'm not sure", "what's standard?")
- The gap-filling revealed complex domains (payment processing, real-time systems, regulatory frameworks)
- The analysis found integration patterns with third-party services that may have specific requirements

### How to Offer

```yaml
question:
  header: "Research"
  text: "Based on our conversation, these topics could benefit from current best-practice research: {topic list}. Would you like me to research any of these to enrich the spec?"
  options:
    - label: "Yes, research these — Get current best practices and requirements"
    - label: "Skip research — Generate the spec with what we have"
  custom: true
```

### Invoking Research

If accepted, invoke the `research` skill by reading `../research/SKILL.md` and following its workflow. Provide:
- **Research topic**: The specific subject (e.g., "GDPR data retention requirements for user session data")
- **Context**: The spec being generated, relevant analysis findings
- **Specific questions**: 1-3 focused questions
- **Depth level**: Match the spec's depth level

Dispatch per the Execution Strategy in the main SKILL.md.

### Incorporating Findings

After research completes:
1. Add findings to the appropriate spec sections
2. Mark research-backed requirements with `[Researched]` provenance (in addition to `[Inferred]` and `[Stated]`)
3. Include source attribution in the spec's references section
4. Use findings to inform any remaining assumption validation in Stage D

### Skip Conditions

Skip Stage C entirely if:
- No research-worthy topics emerged from analysis or interview
- The depth is high-level (research depth is typically overkill)
- The user declined research when offered

---

## Stage D: Assumption Validation (1 round)

**Goal:** Confirm inferences made during analysis that need user validation before they become spec requirements.

### What to Validate

Surface the top 3-5 assumptions from the analysis that:
- Describe architectural decisions (e.g., "The project follows a microservices architecture")
- Identify technology choices (e.g., "PostgreSQL is the primary data store")
- Infer behavioral patterns (e.g., "Background jobs use retry with exponential backoff")
- Note apparent gaps (e.g., "No test files were found for the payment module")

### Question Format

Present assumptions as individual confirmation questions:

```yaml
question:
  header: "Confirm: {topic}"
  text: "The analysis found: {finding}. Is this accurate and should it be documented in the spec?"
  options:
    - label: "Confirmed — Document as-is"
    - label: "Partially correct — Needs adjustment"
    - label: "Incorrect — Remove or revise"
  custom: true
```

For efficiency, group related assumptions when possible:

```yaml
question:
  header: "Tech Stack"
  text: "The analysis identified this tech stack: {list}. Is this complete and accurate?"
  options:
    - label: "Confirmed — This is the correct stack"
    - label: "Mostly correct — Minor adjustments needed"
    - label: "Needs significant correction"
  custom: true
```

### Processing Responses

- **Confirmed** → mark as validated and include in spec with `[Inferred]` provenance
- **Partially correct** → read the user's custom input for adjustments, mark as `[Inferred, Adjusted]`
- **Incorrect** → remove from spec or replace with user's correction (mark as `[Stated]`)

---

## Question Budget Summary

| Depth | Stage A | Stage B | Stage C | Stage D | Total |
|-------|---------|---------|---------|---------|-------|
| High-level | 1-2 rounds, 2-4 Q | 1 round, 3-5 Q | Skip | 1 round, 3-5 Q | 8-14 Q |
| Detailed | 1-2 rounds, 2-4 Q | 2 rounds, 6-10 Q | 0-1 round, 1 Q | 1 round, 3-5 Q | 12-20 Q |
| Full-tech | 1-2 rounds, 2-4 Q | 3 rounds, 10-15 Q | 0-1 round, 1-2 Q | 1 round, 3-5 Q | 16-26 Q |

These are soft budgets — adjust based on codebase complexity and how much context the user provided upfront.

---

## Interview Principles

1. **Code is the primary source.** The interview supplements, not replaces, what the analysis found. Every question should target a gap that code genuinely cannot answer.

2. **Respect the user's time.** The inverted-spec interview should be shorter than create-spec's because the code provides most technical content. If the user provided rich context in Phase 1, shorten further.

3. **Present, don't interrogate.** Frame questions as confirmation of findings, not blank-slate inquiry. "The analysis found X — is this correct?" beats "What is X?"

4. **Track provenance throughout.** Every piece of information gathered gets tagged with its source (analysis, user, research) for the compilation phase.

5. **Graceful degradation.** If the analysis was partial (some explorers failed), note the gaps and ask targeted questions to fill them. Don't pretend the analysis was complete.
