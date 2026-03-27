# Common Findings Pattern Library

This reference catalogs common spec issues organized by analysis dimension. Each pattern includes detection strategy, example, fix recommendation, and default severity.

---

## Requirements Patterns

### REQ-01: Unstated Functional Requirement

**Severity**: Warning

**Pattern**: A capability implied by other features or user stories but not explicitly listed as a requirement.

**Detection**:
- Review user stories for actions that depend on unlisted features
- Check if features reference capabilities not in the feature list
- Look for verbs in descriptions that imply separate functionality (e.g., "notify" implies a notification system)

**Example**:
- Feature: "Order Management" with user story "As a user, I want to track my order status via email"
- Missing: No "Email Notifications" feature listed

**Fix**: Add the implied feature to the requirements list with appropriate priority, or explicitly note it as out of scope.

---

### REQ-02: Missing Non-Functional Requirement

**Severity**: Warning

**Pattern**: A critical or high-priority feature lacks non-functional requirements that would be expected for its type.

**Detection**:
- For P0/P1 features involving data: check for security/privacy NFRs
- For P0/P1 features involving user interaction: check for performance NFRs
- For features involving external systems: check for availability/reliability NFRs

**Example**:
- Feature: "Payment Processing" (P0)
- Missing: No security requirements, no PCI compliance mention, no availability targets

**Fix**: Add non-functional requirements appropriate to the feature's domain and priority.

---

### REQ-03: Requirements-Goal Misalignment

**Severity**: Warning

**Pattern**: Features or requirements that don't trace back to any stated goal or problem.

**Detection**:
- Map each feature to a problem statement goal
- Identify features with no clear connection to stated objectives
- Check if success metrics align with feature capabilities

**Example**:
- Goal: "Reduce customer onboarding time"
- Feature: "Admin Dashboard with Analytics" — no clear connection to onboarding

**Fix**: Either clarify how the feature supports stated goals or acknowledge it as a separate objective.

---

### REQ-04: Overlapping Requirements

**Severity**: Suggestion

**Pattern**: Multiple features or requirements describing the same capability with different language.

**Detection**:
- Compare feature descriptions for functional overlap
- Look for similar acceptance criteria across different features
- Check for redundant user stories

**Example**:
- Feature A: "User Notifications — send alerts when events occur"
- Feature B: "Activity Feed — notify users of relevant actions"
- Overlap: Both describe notifying users of events

**Fix**: Consolidate into a single feature or clearly delineate boundaries between them.

---

### REQ-05: Unscoped Requirement

**Severity**: Warning

**Pattern**: A requirement with no clear boundaries that could expand indefinitely.

**Detection**:
- Look for features without "in scope" / "out of scope" clarification
- Flag open-ended capabilities ("support search", "handle integrations")
- Check for requirements that lack completion criteria

**Example**:
- "Support search functionality" — What kind of search? Full-text? Faceted? Fuzzy matching? Autocomplete?

**Fix**: Define explicit scope boundaries with what is included and what is deferred.

---

## Risk Patterns

### RISK-01: Unmitigated Technical Dependency

**Severity**: Warning

**Pattern**: External system dependency with no fallback plan or failure handling strategy.

**Detection**:
- Scan for mentions of external APIs, services, or platforms
- Check if dependencies section lists each with availability expectations
- Verify that failure scenarios are addressed

**Example**:
- "Integrate with Stripe for payment processing"
- Missing: What happens if Stripe is unavailable? No retry strategy, no degraded mode.

**Fix**: Add failure handling strategy for each critical external dependency.

---

### RISK-02: Undefined Integration Contract

**Severity**: Warning

**Pattern**: Integration point mentioned without specifying protocol, data format, authentication, or error handling.

**Detection**:
- Find mentions of "integrate with", "connect to", "sync with"
- Check if protocol (REST, GraphQL, gRPC) is specified
- Verify authentication mechanism is defined
- Check if data format/schema is specified

**Example**:
- "Sync user data with the CRM system"
- Missing: Which CRM? What API? What data fields? What direction? What frequency?

**Fix**: Specify protocol, authentication, data format, sync direction, and error handling for each integration.

---

### RISK-03: Implicit Scaling Assumption

**Severity**: Warning

**Pattern**: System described as "scalable" without specifying targets, strategy, or constraints.

**Detection**:
- Look for vague scaling language: "scalable", "handles growth", "supports many users"
- Check if specific capacity targets are defined
- Verify scaling strategy is stated (horizontal, vertical, auto-scaling)

**Example**:
- "The platform must be scalable to handle future growth"
- Missing: Growth from what to what? Over what timeframe? What's the scaling mechanism?

**Fix**: Replace with specific capacity targets and scaling strategy.

---

### RISK-04: Missing Failure Mode

**Severity**: Warning (Critical if on a P0 feature)

**Pattern**: Critical path or feature defined without error handling, degradation strategy, or recovery plan.

**Detection**:
- Identify P0/P1 features and critical user flows
- Check if error scenarios are addressed for each
- Look for failure handling in architectural descriptions
- Verify rollback or recovery strategies exist

**Example**:
- "Users can submit payment for their order" (P0 feature)
- Missing: Payment declined flow, timeout handling, partial failure recovery, duplicate submission prevention

**Fix**: Add error scenarios and degradation strategies for each critical feature.

---

### RISK-05: Underestimated Complexity

**Severity**: Suggestion

**Pattern**: A feature described in simple terms but carrying significant hidden complexity based on known complexity signals.

**Detection**:
- Cross-reference features with complexity signals (from sdd-specs complexity-signals)
- Look for features that casually mention complex patterns (real-time sync, multi-tenant, distributed consensus)
- Check if implementation phase allocation matches feature complexity

**Example**:
- "Add real-time collaborative editing" — listed as a single medium-priority feature in Phase 2
- Reality: Real-time collaboration requires conflict resolution (OT/CRDT), WebSocket infrastructure, presence management

**Fix**: Acknowledge complexity in the spec, consider breaking into sub-features, or adjust phase/priority allocation.

---

## Inconsistency Patterns

### INC-01: Feature Name Mismatch

**Severity**: Warning

**Pattern**: Same feature referred to by different names in different sections.

**Detection**:
- Build list of feature names from the primary features section
- Search for variations (plural/singular, abbreviations, synonyms)
- Flag when the same concept has multiple names

**Example**:
- Key Features: "User Authentication"
- User Stories: "Login System"
- Technical Specs: "Auth Module"

**Fix**: Standardize on one name throughout the document.

---

### INC-02: Priority Inconsistency

**Severity**: Warning

**Pattern**: Feature priority differs between sections.

**Detection**:
- Extract priorities from feature list
- Compare with priorities in user stories
- Compare with phase assignments (P0 should be Phase 1)

**Example**:
- Feature "Export" marked P2 in features table
- Same feature in "Phase 1" deliverables

**Fix**: Align priority across all mentions, or clarify phase assignment rationale.

---

### INC-03: Metric-Goal Mismatch

**Severity**: Warning

**Pattern**: Success metrics don't measure stated goals.

**Detection**:
- Extract goals from Problem Statement
- Extract metrics from Success Metrics section
- Verify each goal has at least one related metric

**Example**:
- Goal: "Reduce customer support tickets"
- Metrics: "Page load time", "User signups"
- Missing: Metric for support ticket reduction

**Fix**: Add metrics that directly measure each stated goal.

---

### INC-04: Contradictory Requirements

**Severity**: Critical

**Pattern**: Two requirements that cannot both be true.

**Detection**:
- Look for conflicting constraints
- Check performance vs. feature requirements
- Verify security vs. usability trade-offs are addressed

**Example**:
- "All data must be encrypted at rest"
- "System must support full-text search on encrypted fields"
- (Contradiction: full-text search typically requires unencrypted indexes)

**Fix**: Clarify constraints or acknowledge trade-off with solution.

---

## Missing Information Patterns

### MISS-01: Undefined Terms

**Severity**: Suggestion

**Pattern**: Domain-specific terms used without definition.

**Detection**:
- Identify technical or business jargon
- Check for glossary or inline definitions
- Flag terms that non-domain experts wouldn't understand

**Example**:
- "The system will use CQRS pattern" (What is CQRS?)
- "Support for SSO via SAML" (Acronyms unexplained)

**Fix**: Add glossary section or inline definitions.

---

### MISS-02: Missing Acceptance Criteria

**Severity**: Warning

**Pattern**: Features or user stories lack testable criteria.

**Detection**:
- Check each feature/story for acceptance criteria
- Verify criteria are specific and testable
- Flag vague criteria ("works correctly", "is fast")

**Example**:
- User Story: "As a user, I want to search products"
- Missing: What constitutes a successful search? Filters? Sort options?

**Fix**: Add specific, testable acceptance criteria.

---

### MISS-03: Unspecified Error Handling

**Severity**: Warning

**Pattern**: Happy path defined but error scenarios missing.

**Detection**:
- Look for error handling requirements
- Check API specs for error responses
- Verify edge cases are addressed

**Example**:
- "User can upload profile photo"
- Missing: What if file too large? Wrong format? Upload fails?

**Fix**: Add error scenarios and expected behavior.

---

### MISS-04: Missing Dependencies

**Severity**: Warning

**Pattern**: External systems referenced but dependencies not listed.

**Detection**:
- Scan for mentions of external systems/APIs
- Compare with Dependencies section
- Flag missing external dependencies

**Example**:
- "Integrate with Stripe for payments"
- Dependencies section: No mention of Stripe

**Fix**: Add all external dependencies with version requirements.

---

### MISS-05: Incomplete User Personas

**Severity**: Suggestion

**Pattern**: Personas mentioned but not fully defined.

**Detection**:
- Check if personas have: name, role, goals, pain points
- Verify personas are referenced in user stories
- Flag "placeholder" personas

**Example**:
- "Admin users" mentioned in features
- No Admin persona defined with specific needs

**Fix**: Define complete personas for each user type.

---

## Ambiguity Patterns

### AMB-01: Vague Quantifiers

**Severity**: Warning

**Pattern**: Non-specific terms used where numbers are needed.

**Detection**: Look for these words without specific values:
- "fast", "quickly", "responsive"
- "many", "few", "several"
- "large", "small", "scalable"
- "easy", "simple", "intuitive"

**Example**:
- "The system should load quickly" (How quickly?)
- "Support many concurrent users" (How many?)

**Fix**: Replace with specific, measurable values.

---

### AMB-02: Undefined "Should" vs "Must"

**Severity**: Suggestion

**Pattern**: Unclear requirement priority in language.

**Detection**:
- Check for consistent use of RFC 2119 language
- Flag mixed usage without definition
- Identify requirements using "should" for critical features

**Example**:
- "The system should encrypt all passwords" (Is this optional?)
- "Users must be able to login" (Required)

**Fix**: Use consistent RFC 2119 language (MUST, SHOULD, MAY) with definitions.

---

### AMB-03: Ambiguous Pronouns

**Severity**: Suggestion

**Pattern**: Unclear referents for "it", "this", "that", "they".

**Detection**:
- Find pronouns that could refer to multiple antecedents
- Flag long sentences with unclear references

**Example**:
- "When the user submits the form and the system processes it, it should notify them."
- (Which "it"? Form or system? Who are "them"?)

**Fix**: Replace pronouns with specific nouns.

---

### AMB-04: Open-Ended Lists

**Severity**: Warning

**Pattern**: Lists with "etc.", "and more", "such as" without bounds.

**Detection**:
- Find incomplete lists
- Flag unbounded requirements

**Example**:
- "Support file types: PDF, DOC, images, etc."
- (What specific image formats? What else is included in "etc."?)

**Fix**: Provide exhaustive list or explicit bounds.

---

### AMB-05: Undefined Scope Boundaries

**Severity**: Warning

**Pattern**: Features described without clear limits.

**Detection**:
- Look for features without "out of scope" clarification
- Flag features that could expand indefinitely

**Example**:
- "Support search with filters"
- (Which filters? All possible filters? User-defined filters?)

**Fix**: Define explicit scope with "in scope" and "out of scope" lists.

---

## Structure Patterns

### STRUCT-01: Missing Required Section

**Severity**: Critical

**Pattern**: Expected section for depth level is absent.

**Detection**:
- Compare document structure to depth-level template
- Flag missing required sections for depth level

**Example**:
- Full-Tech spec missing "API Specifications" section
- Detailed spec missing "User Stories" section

**Fix**: Add missing section with appropriate content.

---

### STRUCT-02: Section Misplacement

**Severity**: Suggestion

**Pattern**: Content in wrong section.

**Detection**:
- Identify content that belongs in a different section
- Flag technical details in business sections
- Flag user stories in technical sections

**Example**:
- API endpoints listed in "Problem Statement"
- Business metrics in "Technical Architecture"

**Fix**: Move content to appropriate section.

---

### STRUCT-03: Inconsistent Formatting

**Severity**: Suggestion

**Pattern**: Similar items formatted differently.

**Detection**:
- Check user story format consistency
- Check requirement ID format
- Check heading hierarchy

**Example**:
- Some user stories: "As a user, I want..."
- Other stories: "User should be able to..."

**Fix**: Standardize formatting across all similar items.

---

### STRUCT-04: Orphaned References

**Severity**: Warning

**Pattern**: References to non-existent sections or documents.

**Detection**:
- Find internal references ("see Section X", "refer to Y")
- Verify referenced sections/documents exist

**Example**:
- "See Security Requirements in Section 8"
- Section 8 doesn't exist or covers a different topic

**Fix**: Update references or add missing sections.

---

### STRUCT-05: Circular Dependencies

**Severity**: Critical

**Pattern**: Tasks or features depend on each other.

**Detection**:
- Map feature dependencies
- Identify circular references in phases

**Example**:
- Feature A requires Feature B to be complete
- Feature B requires Feature A to be complete

**Fix**: Identify minimum viable version of one to break the cycle.

---

## Severity Assignment Guidelines

### Critical (Must Fix)

Assign Critical when the issue:
- Would cause implementation to fail or go significantly wrong
- Represents a fundamental contradiction
- Leaves a core requirement completely undefined
- Indicates a missing required section for the depth level

### Warning (Should Fix)

Assign Warning when the issue:
- Could cause confusion during implementation
- Represents incomplete but not missing information
- Uses ambiguous language for important features
- Is a minor inconsistency that could compound

### Suggestion (Nice to Fix)

Assign Suggestion when the issue:
- Is a style or clarity improvement
- Affects non-critical sections
- Would improve spec quality but isn't blocking
- Represents best practice not currently followed

### Severity Override Rules

- **Escalate to Critical**: Any warning-level issue on a P0 feature
- **Demote to Suggestion**: Any warning-level issue on explicitly deferred/Phase 3+ features
- **Context matters**: A vague quantifier (AMB-01) on "the system should be fast" is a Suggestion, but on "the payment API response time should be fast" is a Warning
