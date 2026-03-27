# Interactive Review Guide

This reference provides guidance for the interactive review path (Phase 5B). It covers how to walk through findings, question patterns for decisions, follow-up handling, grouping strategies, and session management.

---

## Review Strategy

### Processing Order

Process findings in strict severity order:
1. **Critical** — These are blocking issues. Walk through each individually.
2. **Warnings** — Important but not blocking. May group related findings.
3. **Suggestions** — Improvements. Offer bulk acceptance for remaining suggestions.

### Progress Tracking

Maintain a running count and communicate it naturally:

```yaml
question:
  header: "FIND-003 (Warning) — 3 of 12"
  text: |
    **Requirements > REQ-02: Missing Non-Functional Requirement**
    ...
```

### Session Pacing

- **Critical findings**: Spend as much time as needed. These are worth getting right.
- **Warnings**: Aim for efficient decisions. Group when possible.
- **Suggestions**: After presenting 2-3 individually, offer to batch the rest.

---

## Question Patterns

### Standard Finding Presentation

Present each finding with this question structure:

```yaml
question:
  header: "FIND-{NNN} ({severity}) — {N} of {total}"
  text: |
    **{Dimension} > {Category}: {Finding Title}**

    **Location**: {section and line reference}

    **Issue**: {description of what's wrong}

    **Impact**: {why this matters}

    **Recommendation**: {specific fix action}

    How would you like to handle this?
  options:
    - label: "Accept recommendation — Apply this fix"
    - label: "Modify — I have a different approach"
    - label: "Skip — Leave as-is for now"
    - label: "Tell me more — Explain this in detail"
```

### Severity-Specific Framing

**Critical findings** — Emphasize impact and consequences:
```yaml
question:
  header: "FIND-001 (Critical) — 1 of 12"
  text: |
    **Quality > INC-04: Contradictory Requirements**

    **Location**: Sections 5.2 and 7.1

    **Issue**: The spec requires both "all data encrypted at rest" and "full-text
    search on user content." Standard full-text search requires unencrypted indexes,
    making these requirements contradictory.

    **Impact**: Implementation will stall when developers encounter this contradiction.
    This must be resolved before task decomposition.

    **Recommendation**: Choose one approach — either use encrypted search technology
    (e.g., searchable encryption) and add it to technical requirements, or scope
    full-text search to non-sensitive fields only.

    This is a critical finding. How would you like to resolve it?
  options:
    - label: "Accept recommendation — Apply this fix"
    - label: "Modify — I have a different resolution"
    - label: "Skip — I'll address this separately"
    - label: "Tell me more — Explain the technical trade-offs"
```

**Warning findings** — Balanced presentation:
```yaml
question:
  header: "FIND-005 (Warning) — 5 of 12"
  text: |
    **Requirements > REQ-05: Unscoped Requirement**

    **Location**: Section 5.3 "Search Functionality" (line 89)

    **Issue**: "Support search with filters" — the scope of search is undefined.
    It's unclear which filters, what search types (full-text, faceted, fuzzy), or
    what content is searchable.

    **Recommendation**: Define search scope: searchable content types, supported
    filters, and search behavior (exact match, fuzzy, autocomplete).

    How would you like to handle this?
  options:
    - label: "Accept recommendation — Define search scope"
    - label: "Modify — I'll provide the search scope details"
    - label: "Skip — Search scope is intentionally open for now"
    - label: "Tell me more — What details are typically needed?"
```

**Suggestion findings** — Light touch:
```yaml
question:
  header: "FIND-010 (Suggestion) — 10 of 12"
  text: |
    **Quality > AMB-03: Ambiguous Pronouns**

    **Location**: Section 6.1 (line 156)

    **Issue**: "When the user submits the form and the system processes it, it
    should notify them" — unclear which "it" performs the notification.

    **Recommendation**: Rewrite as "When the user submits the form, the system
    processes the submission and sends a notification to the user."
  options:
    - label: "Accept — Apply the rewrite"
    - label: "Skip — Clear enough in context"
    - label: "Modify — I'll reword it differently"
```

---

## Follow-Up Handling

### "Tell me more" Response

When the user selects "Tell me more":
1. Provide expanded explanation of the issue with full context
2. Show the exact spec text that triggered the finding
3. Explain what problems could arise during implementation
4. If applicable, describe how similar issues were handled in other specs
5. Re-present the same finding with the decision question

### "Modify" Response

When the user selects "Modify":
```yaml
question:
  header: "FIND-{NNN} — Your Approach"
  text: |
    You'd like to handle this differently from the recommendation.

    **Original recommendation**: {recommendation}

    What's your preferred approach? Describe what the updated spec text should say,
    or explain the direction you'd like to take.
  custom: true
  options:
    - label: "Actually, accept the original recommendation instead"
```

After receiving the user's modification:
- Incorporate their input into the planned spec changes
- Confirm the planned change back to them briefly before moving on

### Custom Text Input

When the user provides freeform text (instead of selecting an option):
- Treat it as additional context for the finding
- If it provides new information that changes the finding's validity, re-evaluate:
  - If the finding is no longer valid: acknowledge and mark as Skipped with reason
  - If the finding is still valid but the user provides a better fix: use their approach
  - If the text is a question: answer it, then re-present the decision

### New Context That Changes Analysis

If user input during review reveals information that affects other findings:
- Note the impact on remaining findings
- When reaching those findings, mention the new context: "Based on what you mentioned about {X}, this finding may be different than originally assessed..."
- Re-evaluate severity if warranted

---

## Grouping Heuristics

### When to Group Findings

Group findings when presenting them would be more efficient and coherent together:

**Same-section findings**: If 3+ findings affect the same spec section, present them as a group:
```yaml
question:
  header: "Section 5.2 — 3 findings"
  text: |
    The "User Authentication" section has 3 findings:

    1. **FIND-004 (Warning)**: AMB-01 — "fast response times" is vague.
       Recommendation: Specify "< 200ms for login, < 500ms for token refresh"

    2. **FIND-005 (Warning)**: MISS-03 — No error handling for failed login.
       Recommendation: Define lockout policy, rate limiting, error messages

    3. **FIND-006 (Suggestion)**: STRUCT-03 — Inconsistent format between
       login and registration user stories.
       Recommendation: Standardize to "As a... I want... So that..." format

    How would you like to handle these?
  options:
    - label: "Accept all 3 recommendations"
    - label: "Review individually — Walk through one at a time"
    - label: "Skip all — This section is fine as-is"
  multiple: false
```

**Same-concept findings**: When the same issue appears across multiple sections (e.g., naming inconsistency), present all occurrences together.

**Cascading findings**: When fixing one finding resolves others, present the root finding and note the cascade:
```
Fixing FIND-003 (missing "Notifications" feature) would also resolve:
- FIND-007: User story references undefined notification capability
- FIND-011: Missing dependency on email service
```

### When NOT to Group

- Critical findings with different root causes — always present individually
- Findings across different dimensions unless they share a root cause
- Findings requiring different types of user decisions

---

## Bulk Actions

### Remaining Suggestions

When only suggestion-severity findings remain (or the user has addressed all critical/warning items):

```yaml
question:
  header: "Remaining Suggestions ({N} left)"
  text: |
    You've addressed all critical and warning findings. There are {N} suggestion-level
    findings remaining — these are style and clarity improvements.

    {Brief list of remaining suggestion titles}

    How would you like to handle these?
  options:
    - label: "Accept all suggestions — Apply all improvements"
    - label: "Review individually — Walk through each one"
    - label: "Skip all suggestions — Good enough for now"
```

### Early Exit

If the user signals wanting to wrap up before all findings are processed:

```yaml
question:
  header: "Wrap Up"
  text: |
    You've addressed {resolved} of {total} findings so far.
    {remaining_critical} critical and {remaining_warning} warning findings remain.

    How would you like to proceed?
  options:
    - label: "Apply what we've decided so far — Save and exit"
    - label: "Accept remaining recommendations — Apply all unreviewed findings"
    - label: "Continue reviewing — I want to finish"
```

---

## Batch Rewrite Guidance

### Assembling Changes

After all decisions are collected:

1. **Group by section**: Organize accepted changes by which spec section they affect
2. **Order within section**: Apply changes top-to-bottom within each section to maintain coherence
3. **Preserve unchanged content**: Sections with no findings should be copied exactly as-is
4. **Resolve conflicts**: If two accepted changes affect overlapping text, merge them into a single coherent edit
5. **Validate structure**: After assembling all changes, verify the result conforms to the depth-level template from sdd-specs

### Writing the Updated Spec

- Read the current spec fresh (avoid stale data)
- Apply all accepted changes as a single Write operation
- The batch approach produces a cleaner result than incremental edits because cross-finding coherence is maintained

### Updating the Report

After applying changes:
1. Update each resolved finding's Status to "Resolved"
2. Update each skipped finding's Status to "Skipped" with reason if provided
3. Add the Resolution Summary section
4. Recalculate dimension scores based on the updated spec
5. Add Score Change table showing before/after

---

## Session Completion

### Summary Presentation

After all changes are applied, present a completion summary as text output (not a question):

```
Analysis Review Complete

- Findings resolved: {N} of {total}
- Findings skipped: {N}
- Sections modified: {list}

Score Change:
  Requirements:    {before} → {after} ({+/-N})
  Risk:            {before} → {after} ({+/-N})
  Quality:         {before} → {after} ({+/-N})
  Completeness:    {before} → {after} ({+/-N})
  Overall:         {before} → {after} ({+/-N})

Updated files:
  - {spec path} (spec updated)
  - {report path} (report updated with resolution summary)
```

### Follow-Up Suggestion

If significant issues remain unresolved, suggest re-running analysis after the user addresses them:

```
{N} findings were skipped. You can re-run analyze-spec after addressing
these items to verify the spec is ready for task decomposition.
```
