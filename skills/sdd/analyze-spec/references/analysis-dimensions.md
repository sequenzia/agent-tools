# Analysis Dimensions Reference

This reference defines the four analysis dimensions, depth-aware checklists, scoring methodology, and evaluation criteria for spec analysis.

---

## Scoring Methodology

### Dimension Scores

Each dimension is scored 0–100 based on the ratio of satisfied criteria to total applicable criteria for the detected depth level.

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| Requirements | 30% | Functional/non-functional coverage, gaps, conflicts |
| Risk & Feasibility | 20% | Technical risks, implementation challenges, dependency risks |
| Quality | 25% | Consistency, clarity, precision of language and structure |
| Completeness | 25% | Structural coverage against depth-level template expectations |

**Overall Score** = weighted average of dimension scores.

### Score Thresholds

| Range | Rating | Interpretation |
|-------|--------|----------------|
| 90–100 | Excellent | Ready for task decomposition with minimal issues |
| 75–89 | Good | Minor improvements recommended before proceeding |
| 60–74 | Needs Improvement | Several issues should be addressed before task creation |
| 0–59 | Significant Issues | Major gaps or contradictions require substantial revision |

### Scoring Principles

- Only evaluate criteria applicable to the detected depth level
- Award partial credit when a criterion is partially met (e.g., 3 of 5 expected metrics defined = 60%)
- When in doubt about a criterion, lean toward giving credit — avoid punishing reasonable spec variations
- Document the rationale for any score below 50% on a dimension

---

## Dimension 1: Requirements Extraction

Analyze the spec to identify, categorize, and evaluate stated and implied requirements.

### Functional Requirements Checklist

**High-Level:**
- Features listed with priorities and brief descriptions
- Core features distinguishable from secondary features
- Feature groupings or categories present

**Detailed** (all high-level items plus):
- User stories with acceptance criteria
- Workflow descriptions for key user journeys
- Feature interactions and dependencies noted
- Edge cases acknowledged for critical features

**Full-Tech** (all detailed items plus):
- API specifications with endpoints, methods, schemas
- Data models with entities, relationships, field types
- Request/response formats defined
- State machines or workflow diagrams for complex flows

### Non-Functional Requirements Checklist

**High-Level:**
- Success metrics defined (2+ measurable targets)
- Basic constraints stated (timeline, budget, platform)

**Detailed** (all high-level items plus):
- Performance expectations stated (response times, throughput)
- Security outline (authentication method, data protection approach)
- Scalability considerations mentioned

**Full-Tech** (all detailed items plus):
- Performance SLAs with specific numbers
- Security requirements with implementation specifics
- Availability targets (e.g., 99.9% uptime)
- Deployment and infrastructure requirements

### Gap Detection Heuristics

- **Cross-section gaps**: Feature mentioned in one section (e.g., overview) but not specified in the requirements section
- **Implied requirements**: User stories that imply capabilities not listed as features (e.g., a story about "sorting search results" implies a search feature)
- **Missing NFRs for critical features**: P0/critical features without performance, security, or error handling requirements
- **Orphaned features**: Features in the requirements list not referenced by any user story or implementation phase

### Conflict Detection

- **Performance vs. feature conflicts**: Requirements that demand both maximum features and maximum performance without acknowledging trade-offs
- **Security vs. usability tensions**: Strong security requirements alongside "frictionless" user experience goals without resolution strategy
- **Scope vs. timeline conflicts**: Large scope with tight timeline and no phasing or prioritization strategy
- **Contradictory constraints**: Two requirements that cannot both be satisfied simultaneously (see INC-04 pattern)

---

## Dimension 2: Risk & Feasibility

Evaluate the spec for technical risks, implementation challenges, and feasibility concerns.

### Technical Risk Signals

Adapted from complexity signals — these indicate areas where implementation risk is elevated:

| Risk Area | Detection Patterns | Default Severity |
|-----------|-------------------|-----------------|
| Integration density | 3+ external APIs or services mentioned | Warning |
| Distributed architecture | Microservices, CQRS, event sourcing patterns | Warning |
| Compliance requirements | GDPR, HIPAA, PCI-DSS, SOC 2 mentioned | Critical (if undefined) |
| Real-time requirements | WebSockets, sub-second latency, live collaboration | Warning |
| Scale requirements | Millions of users, 99.9%+ availability, global distribution | Warning |

### Implementation Challenge Signals

| Challenge | Detection Patterns | Default Severity |
|-----------|-------------------|-----------------|
| Underspecified interfaces | Integration points mentioned without protocol/format/auth details | Warning |
| Circular dependencies | Features or phases that depend on each other | Critical |
| Missing error handling | Happy paths defined without failure scenarios for critical flows | Warning |
| Technology unknowns | New or unproven technologies without evaluation plan | Suggestion |
| Data migration complexity | Existing data referenced without migration strategy | Warning |

### Scalability Risk Checklist

- Capacity targets defined with specific numbers (not "scalable" or "many users")
- Data growth projections present for data-intensive features
- Caching or performance strategy for high-traffic endpoints
- Horizontal scaling approach if scale requirements are significant
- Rate limiting or throttling strategy for external-facing APIs

### Security Risk Checklist

- Authentication mechanism specified (not just "requires auth")
- Authorization model defined for multi-role systems
- Data sensitivity classification (what data is sensitive, what protection it needs)
- Encryption requirements stated for data at rest and in transit
- Compliance requirements have corresponding technical requirements
- Third-party dependency security considerations addressed

### Depth-Aware Risk Evaluation

**High-Level**: Flag only risks that are critical or that contradict stated goals. Do not flag missing technical details.

**Detailed**: Flag risks related to underspecified interfaces, missing NFRs for complex features, and unaddressed security concerns.

**Full-Tech**: Full scrutiny — flag all identified risks including missing mitigation strategies, undefined failure modes, and incomplete security specifications.

---

## Dimension 3: Quality Audit

Evaluate the spec for consistency, clarity, and precision. This dimension applies the pattern library from `common-findings.md`.

### Pattern Categories

Load patterns from `references/common-findings.md` and apply them systematically:

1. **Inconsistencies** (INC-01 through INC-04): Feature name mismatches, priority inconsistencies, metric-goal mismatches, contradictory requirements
2. **Missing Information** (MISS-01 through MISS-05): Undefined terms, missing acceptance criteria, unspecified error handling, missing dependencies, incomplete personas
3. **Ambiguities** (AMB-01 through AMB-05): Vague quantifiers, undefined should/must, ambiguous pronouns, open-ended lists, undefined scope boundaries
4. **Structure Issues** (STRUCT-01 through STRUCT-05): Missing sections, misplacement, inconsistent formatting, orphaned references, circular dependencies

### Depth-Aware Quality Standards

What NOT to flag at each depth level — flagging these creates noise and penalizes specs for being at their intended depth:

**High-Level — Do NOT flag:**
- Missing user stories or acceptance criteria
- Missing API specifications or data models
- Missing deployment architecture
- Vague technical approach (expected at this level)
- Missing individual feature acceptance criteria

**Detailed — Do NOT flag:**
- Missing API endpoint details (request/response schemas)
- Missing database schemas or ER diagrams
- Missing deployment architecture specifics
- Vague technical implementation details (expected at this level)

**Full-Tech — Flag everything.** Full scrutiny is expected at this depth.

---

## Dimension 4: Completeness Scoring

Evaluate structural coverage against the depth-level template from `sdd-specs`.

### Section Checklists by Depth Level

**High-Level** (minimum 5 sections):
1. Executive Summary — clear overview paragraph
2. Problem Statement — problem articulated with impact
3. Key Features — listed with priorities
4. Success Metrics — 2+ measurable metrics
5. Implementation Phases — at least 2 phases with deliverables
6. Risks & Dependencies — 2+ risks, external dependencies listed

**Detailed** (minimum 8 sections, includes all high-level):
7. User Personas — at least 1 with goals and pain points
8. User Stories — "As a... I want... So that..." format with IDs
9. Acceptance Criteria — testable criteria for major features
10. Technical Constraints — tech stack, integration points, performance expectations
11. Non-Functional Requirements — security, performance, scalability

**Full-Tech** (minimum 12 sections, includes all detailed):
12. System Architecture — diagram or description with component interactions
13. API Specifications — endpoints, methods, schemas, error codes
14. Data Models — entities, relationships, fields, types
15. Performance SLAs — response times, throughput, availability targets
16. Testing Strategy — unit, integration, performance testing approach
17. Deployment Plan — strategy, rollback, environment requirements

### Minimum Thresholds

| Depth Level | Min Sections | Min Features | Min User Stories | Min Metrics |
|-------------|--------------|--------------|------------------|-------------|
| High-Level | 5 | 3 | 0 | 2 |
| Detailed | 8 | 5 | 5 | 3 |
| Full-Tech | 12 | 5 | 8 | 4 |

Falling below any threshold generates a **Critical** finding.

### Per-Section Scoring

For each expected section, assign a score:
- **100%** — Section present with full expected content
- **75%** — Section present but missing some expected elements
- **50%** — Section present but substantially incomplete
- **25%** — Section mentioned/referenced but content is minimal or placeholder
- **0%** — Section missing entirely

### Cross-Depth Quality Checks

These apply regardless of depth level:

- **Internal consistency**: Feature names, priorities, and phase assignments consistent throughout
- **Completeness indicators**: No "TBD" items in critical sections; external references accessible; out-of-scope items defined
- **Measurability**: Success metrics quantifiable; acceptance criteria verifiable; performance targets specific
- **Clarity**: No ambiguous terms without definitions; no contradicting statements; dependencies clearly stated

### Scoring Calculation

```
Section Score = (sum of per-section scores) / (number of expected sections × 100) × 100
```

The completeness dimension score is the section score adjusted by threshold compliance:
- If ALL thresholds met: score stands as calculated
- If ANY threshold missed: cap score at 59 (forces "Significant Issues" rating)
