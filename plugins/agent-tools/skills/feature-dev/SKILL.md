---
name: feature-dev
description: Feature development workflow with exploration, architecture, implementation, and review phases. Use for implementing new features or significant changes.
argument-hint: <feature-description>
user-invocable: true
disable-model-invocation: false
---

# Feature Development Workflow

Execute a structured 7-phase feature development workflow. This workflow guides you through understanding, exploring, designing, implementing, and reviewing a feature.

**CRITICAL: Complete ALL 7 phases.** The workflow is not complete until Phase 7: Summary is finished. After completing each phase, immediately proceed to the next phase without waiting for user prompts.

## Phase Overview

Execute these phases in order, completing ALL of them:

1. **Discovery** - Understand the feature requirements
2. **Codebase Exploration** - Map relevant code areas
3. **Clarifying Questions** - Resolve ambiguities
4. **Architecture Design** - Design the implementation approach
5. **Implementation** - Build the feature
6. **Quality Review** - Review for issues
7. **Summary** - Document accomplishments

---

## Phase 1: Discovery

**Goal:** Understand what the user wants to build.

1. Analyze the feature description from `$ARGUMENTS`:
   - What is the core functionality?
   - What are the expected inputs and outputs?
   - Are there any constraints mentioned?
   - What success criteria can you infer?

2. Summarize your understanding to the user. Use AskUserQuestion to confirm if your understanding is correct before proceeding.

---

## Phase 2: Codebase Exploration

**Goal:** Understand the relevant parts of the codebase.

1. **Run deep-analysis workflow:**
   - Read `../deep-analysis/SKILL.md` and follow its workflow
   - Pass the feature description from Phase 1 as the analysis context
   - This handles reconnaissance, systematic exploration, and synthesis

2. Present the synthesized analysis to the user.

---

## Phase 3: Clarifying Questions

**Goal:** Resolve any ambiguities before designing.

1. Review the feature requirements and exploration findings.

2. Identify underspecified aspects:
   - Edge cases not covered
   - Technical decisions that could go multiple ways
   - Integration points that need clarification
   - Performance or scale requirements

3. **Ask clarifying questions:**
   Use AskUserQuestion to get answers for critical unknowns. Only ask questions that would significantly impact the implementation.

   If no clarifying questions are needed, inform the user and proceed.

---

## Phase 4: Architecture Design

**Goal:** Design the implementation approach using a three-lens analysis.

1. **Load guidance skills:**
   - Read `../architecture-patterns/SKILL.md` and apply its guidance
   - Read `../language-patterns/SKILL.md` and apply its guidance

2. **Design with three-lens analysis:**

   Produce a single unified implementation blueprint. For each significant design decision within the blueprint, briefly evaluate three perspectives:

   | Lens | Priority | Good For |
   |------|----------|----------|
   | **Simplicity** | Fewest files changed, inline solutions, direct implementation | Small features, time-sensitive work |
   | **Extensibility** | Abstractions where reuse is likely, configuration over hardcoding | Features expected to grow |
   | **Consistency** | Match existing patterns exactly, use established abstractions | Mature codebases, team conventions |

   For each significant decision, document your analysis in a trade-off table:

   ```markdown
   | Decision | Simplicity | Extensibility | Consistency | Chosen | Why |
   |----------|-----------|---------------|-------------|--------|-----|
   | Where to put X | Inline in Y | New module | Same as Z pattern | ... | ... |
   ```

3. **Structure the blueprint:**

   ```markdown
   ## Implementation Blueprint

   ### Approach
   [Brief philosophy and summary]

   ### Overview
   [2-3 sentence summary of the implementation]

   ### Trade-Off Analysis
   [Table from step 2]

   ### Files to Create

   #### `path/to/new-file.ts`
   **Purpose:** What this file does
   **Key decisions:** Why this structure was chosen

   ### Files to Modify

   #### `path/to/existing-file.ts`
   **Current state:** What it does now
   **Changes needed:**
   1. Change 1
   2. Change 2

   ### Data Flow
   1. User action triggers X
   2. X calls Y with data
   3. Y validates and transforms
   4. Z persists/returns result

   ### Error Handling
   - Error case 1: How to handle
   - Error case 2: How to handle

   ### Risks and Mitigations
   | Risk | Likelihood | Impact | Mitigation |
   |------|------------|--------|------------|
   | Risk 1 | Low/Med/High | Low/Med/High | How to mitigate |

   ### Testing Strategy
   - Unit tests for: X, Y, Z
   - Integration tests for: A, B
   - Manual testing: Steps to verify
   ```

   **Design principles to follow:**
   - Match the codebase — your design should feel native to the project
   - Minimize blast radius — prefer changes that affect fewer files
   - Preserve behavior — don't break existing functionality
   - Enable testing — design for testability
   - Consider errors — handle failure modes gracefully

4. **Present the blueprint:**
   - Show the complete blueprint with trade-off analysis
   - Highlight key design decisions and their rationale
   - Use AskUserQuestion to let the user approve or request modifications

5. **Generate ADR artifact:**
   - Read the ADR template from `resources/adr-template.md`
   - Create an ADR documenting:
     - Context: Why this feature is needed
     - Decision: The chosen approach
     - Consequences: Trade-offs and implications
     - Alternatives: Other approaches considered (from the three-lens analysis)
   - Determine the next ADR number by checking existing files in `internal/docs/adr/`
   - Save to `internal/docs/adr/NNNN-[feature-slug].md` (create `internal/docs/adr/` if needed)
   - Inform the user of the saved ADR location

---

## Phase 5: Implementation

**Goal:** Build the feature.

1. **Require explicit approval:**
   Ask the user: "Ready to begin implementation of [feature] using [chosen approach]?"
   Wait for confirmation before proceeding.

2. **Read all relevant files:**
   Before making any changes, read the complete content of every file you'll modify.

3. **Implement the feature:**
   - Follow the chosen architecture design
   - Match existing code patterns and conventions
   - Create new files as needed
   - Update existing files using Edit tool
   - Add appropriate error handling
   - Include inline comments only where logic isn't obvious

4. **Test if applicable:**
   - If the project has tests, add tests for the new functionality
   - Run existing tests to ensure nothing broke

5. **IMPORTANT: Proceed immediately to Phase 6.**
   Do NOT stop here. Do NOT wait for user input. Implementation is complete, but the workflow requires Quality Review and Summary phases. Continue directly to Phase 6 now.

---

## Phase 6: Quality Review

**Goal:** Review the implementation for issues using three sequential review passes.

1. **Load guidance skill:**
   - Read `../code-quality/SKILL.md` and apply its guidance

2. **Execute three sequential review passes:**

   For each pass, review all files that were created or modified during implementation. Only report issues with confidence >= 80 (see scoring below).

   ### Pass 1: Correctness & Edge Cases
   Review checklist:
   - [ ] Does the code do what it's supposed to?
   - [ ] Are all code paths handled?
   - [ ] Are edge cases considered?
   - [ ] Are types correct?
   - [ ] Are async operations handled properly?
   - [ ] Are there off-by-one errors?
   - [ ] Is null/undefined handled correctly?
   - [ ] Are there race conditions?

   ### Pass 2: Security & Error Handling
   Review checklist:
   - [ ] Is user input validated?
   - [ ] Is output properly escaped/sanitized?
   - [ ] Are errors handled without leaking internal details?
   - [ ] Are permissions checked?
   - [ ] Are secrets handled securely?
   - [ ] Are resources cleaned up properly?
   - [ ] Are secure defaults used?

   ### Pass 3: Maintainability & Code Quality
   Review checklist:
   - [ ] Is the code readable and clear?
   - [ ] Are names descriptive?
   - [ ] Is complexity manageable?
   - [ ] Is there unnecessary duplication?
   - [ ] Are there magic numbers/strings?
   - [ ] Does it follow project conventions?
   - [ ] Is error handling consistent?
   - [ ] Is the code testable?

   ### Confidence Scoring

   Rate each finding 0-100:
   - **90-100:** Definite issue, will cause problems
   - **80-89:** Very likely issue, should be fixed
   - **70-79:** Probable issue, worth investigating (don't report)
   - **Below 70:** Uncertain, likely false positive (don't report)

   **Only report issues with confidence >= 80.**

   ### False Positive Avoidance

   Before reporting an issue, verify:
   - The code actually does what you think it does
   - The issue isn't handled elsewhere
   - The pattern isn't intentional for this codebase
   - The framework/library doesn't handle this case

   ### Issue Report Format

   For each issue found:
   ```markdown
   #### [Brief title]
   **File:** `path/to/file.ts:line`
   **Confidence:** [score]
   **Category:** Bug/Security/Maintainability
   **Problem:** [Clear description]
   **Suggested fix:** [How to fix it]
   **Impact:** [What could go wrong if not fixed]
   ```

3. **Aggregate findings:**
   - Collect results from all three passes
   - Deduplicate similar issues
   - Prioritize by severity and confidence

4. **Present findings:**
   Show the user:
   - Critical issues (must fix)
   - Moderate issues (should fix)
   - Minor suggestions (nice to have)
   - Positive observations (what was done well)

5. **User decides:**
   Use AskUserQuestion:
   - "Fix all issues now"
   - "Fix critical issues only"
   - "Proceed without fixes"
   - "I'll fix manually later"

6. If fixing: make the changes and re-review if needed.

7. **IMPORTANT: Proceed immediately to Phase 7.**
   Do NOT stop here. The workflow requires a Summary phase to document accomplishments and update the CHANGELOG. Continue directly to Phase 7 now.

---

## Phase 7: Summary

**Goal:** Document and celebrate accomplishments.

1. **Summarize accomplishments:**
   Present to the user:
   - What was built
   - Key files created/modified
   - Architecture decisions made
   - Any known limitations or future work

2. **Update CHANGELOG.md:**
   - Read the entry template from `resources/changelog-entry-template.md`
   - Read `../changelog-format/SKILL.md` for Keep a Changelog guidelines
   - Create an entry under the `[Unreleased]` section with:
     - Appropriate category (Added, Changed, Fixed, etc.)
     - Concise description of the feature
   - If `CHANGELOG.md` doesn't exist, create it with proper header
   - Add the entry to the appropriate section under `[Unreleased]`
   - Inform the user of the update

3. **Final message:**
   Congratulate the user and offer next steps:
   - Commit the changes
   - Create a PR
   - Additional testing suggestions

---

## Error Handling

If any phase fails:
1. Explain what went wrong
2. Ask the user how to proceed:
   - Retry the phase
   - Skip to next phase
   - Abort the workflow

---

## Additional Resources

- For ADR template, see [resources/adr-template.md](resources/adr-template.md)
- For changelog entry format, see [resources/changelog-entry-template.md](resources/changelog-entry-template.md)
