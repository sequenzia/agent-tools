# Recommendations Round & Pre-Compilation Summary

Procedures for Phase 3 (Recommendations) and Phase 4 (Summary) of the create-spec workflow.

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
