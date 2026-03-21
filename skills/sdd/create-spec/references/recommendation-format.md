# Recommendation Format Templates

This document provides templates for presenting recommendations during spec interviews using the `question` tool.

## Inline Insight Template

Use this during interview rounds when a trigger is detected. Keep it brief and non-intrusive.

```yaml
question:
  header: "Quick Insight"
  text: "{Brief recommendation in 1-2 sentences}. Would you like to include this in the spec?"
  options:
    - label: "Include this — Add to spec requirements"
    - label: "Tell me more — Get details before deciding"
    - label: "Skip — Continue without this recommendation"
  custom: false
```

### Example: Authentication Insight

```yaml
question:
  header: "Quick Insight"
  text: "For public-facing apps with user accounts, OAuth 2.0 with PKCE is the recommended approach - it provides secure token refresh without exposing client secrets. Would you like to include this in the spec?"
  options:
    - label: "Include this — Add OAuth 2.0 with PKCE as auth requirement"
    - label: "Tell me more — Explain the security benefits"
    - label: "Skip — I'll decide on auth approach later"
  custom: false
```

---

## Recommendations Round Template

Use this for the dedicated recommendations round, presenting 3-7 accumulated recommendations.

### Round Introduction

Before presenting recommendations, briefly introduce the round:

```
Based on what you've shared, I have a few recommendations based on industry best practices
that could strengthen your spec. I'll present each one for your review.
```

### Single Recommendation Template

```yaml
question:
  header: "Rec {N}/{Total}"
  text: "{Detailed recommendation with rationale}\n\n**Why this matters:**\n{1-2 sentence explanation of benefits}"
  options:
    - label: "Accept — Include in spec"
    - label: "Modify — I want to adjust this"
    - label: "Skip — Don't include"
  custom: false
```

### Example: Scale Recommendation

```yaml
question:
  header: "Rec 2/5"
  text: "For your expected traffic of 10k+ concurrent users, I recommend implementing a caching layer (Redis) for frequently accessed data and rate limiting for API endpoints.\n\n**Why this matters:**\nThis prevents database overload during traffic spikes and ensures fair usage across clients."
  options:
    - label: "Accept — Include caching and rate limiting requirements"
    - label: "Modify — Adjust the approach"
    - label: "Skip — Handle this during implementation"
  custom: false
```

---

## Modification Flow Template

When user selects "Modify", gather their adjustment:

```yaml
question:
  header: "Modify"
  text: "How would you like to adjust this recommendation?"
  options:
    - label: "Different approach — Use a different technical approach"
    - label: "Reduce scope — Simplify the requirement"
    - label: "Add constraints — Include specific limitations or conditions"
  custom: true
```

After receiving modification input, confirm the adjusted recommendation:

```yaml
question:
  header: "Confirm"
  text: "Updated recommendation: {modified version}. Is this accurate?"
  options:
    - label: "Yes, include this"
    - label: "Adjust further"
  custom: false
```

---

## Research-Backed Recommendation Template

When proactive research informed the recommendation:

```yaml
question:
  header: "Rec {N}/{Total}"
  text: "{Recommendation}\n\n**Based on current standards:**\n{Research finding summary}\n\n**Source:** {Brief source attribution}"
  options:
    - label: "Accept — Include in spec"
    - label: "Modify — Adjust this"
    - label: "Skip — Don't include"
  custom: false
```

### Example: Compliance Research Recommendation

```yaml
question:
  header: "Rec 3/5"
  text: "Since you're handling EU user data, GDPR compliance should be explicitly addressed. I recommend including: consent management, data retention policy (max 3 years), and right-to-deletion implementation.\n\n**Based on current standards:**\nGDPR Article 17 requires the ability to delete user data within 30 days of request. Standard practice is implementing a soft-delete with scheduled purge.\n\n**Source:** EU GDPR Guidelines, ICO Best Practices"
  options:
    - label: "Accept — Include GDPR requirements"
    - label: "Modify — Adjust compliance scope"
    - label: "Skip — Address compliance separately"
  custom: false
```

---

## "Tell Me More" Response Template

When user wants more details on an inline insight:

```yaml
question:
  header: "Details"
  text: "**{Topic} Explanation:**\n\n{Detailed explanation with pros/cons}\n\n**Alternatives:**\n- {Alternative 1}: {brief description}\n- {Alternative 2}: {brief description}\n\nWould you like to include this recommendation?"
  options:
    - label: "Yes, include it — Add to spec"
    - label: "Use alternative — Choose a different approach"
    - label: "Skip — Don't include any recommendation"
  custom: true
```

---

## Summary Section Template

For the pre-compilation summary, add this section after "Implementation":

```markdown
### Agent Recommendations (Accepted)

*The following recommendations were suggested based on industry best practices and accepted during the interview:*

1. **{Category}**: {Recommendation title}
   - Rationale: {Why this was recommended}
   - Applies to: {Which section/feature}

2. **{Category}**: {Recommendation title}
   - Rationale: {Why this was recommended}
   - Applies to: {Which section/feature}

{Continue for all accepted recommendations}
```

### Example Summary Section

```markdown
### Agent Recommendations (Accepted)

*The following recommendations were suggested based on industry best practices and accepted during the interview:*

1. **Authentication**: OAuth 2.0 with PKCE
   - Rationale: Secure token handling for public clients without exposing secrets
   - Applies to: User authentication feature

2. **Performance**: Redis caching layer
   - Rationale: Handle 10k+ concurrent users without database overload
   - Applies to: API endpoints, user session data

3. **Compliance**: GDPR data handling
   - Rationale: EU user data requires consent management and deletion rights
   - Applies to: User data storage, account management
```

---

## Tracking Accepted Recommendations

Maintain internal tracking during the interview:

```
Accepted Recommendations:
1. [Auth] OAuth 2.0 with PKCE - Include in Technical Specs > Authentication
2. [Performance] Redis caching - Include in Technical Specs > Performance
3. [Compliance] GDPR requirements - Include in Non-Functional Requirements

Skipped Recommendations:
- [Testing] E2E test coverage - User prefers to decide during implementation

Modified Recommendations:
- [Scale] Rate limiting - Modified: 100 req/min instead of 60 req/min
```

This tracking ensures recommendations flow correctly into the final spec.

---

## Presentation Guidelines

1. **Be concise**: Recommendations should be clear and actionable, not lengthy explanations
2. **Provide rationale**: Always explain *why* this is recommended
3. **Offer alternatives**: When relevant, acknowledge other valid approaches
4. **Respect user decisions**: Accept skips gracefully, don't repeatedly push rejected recommendations
5. **Group related items**: If multiple recommendations are related, consider presenting together
6. **Match depth level**: Fewer, higher-level recommendations for high-level specs; more detailed for full-tech
