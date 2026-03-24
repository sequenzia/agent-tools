# Analysis-to-Spec Section Mapping

How deep-analysis output maps to spec template sections across all three depth levels. Use this reference during Phase 5 (Spec Generation) to transform analysis findings into template-compatible content.

---

## Mapping by Analysis Finding

### Architecture Overview

The analysis produces a 2-3 paragraph architecture description with an optional Mermaid diagram.

| Depth | Target Section(s) | How to Transform |
|-------|-------------------|------------------|
| High-level | Executive Summary, Proposed Solution Overview | Condense to 2-3 sentences for Executive Summary. Use the full overview for Proposed Solution. |
| Detailed | 1. Executive Summary, 7.1 Architecture Overview | Executive Summary gets a condensed version. Section 7.1 gets the full description with diagram. |
| Full-tech | 1. Executive Summary, 7.1 System Overview | Same as detailed, but expand with subgraph layers in the Mermaid diagram (Client, API Gateway, Services, Data Layer). |

### Critical Files Table

The analysis lists files with purpose, relevance, and connections.

| Depth | Target Section(s) | How to Transform |
|-------|-------------------|------------------|
| High-level | _(skip)_ | Too detailed for high-level. |
| Detailed | 7.5 Codebase Context: Integration Points | Transform the connections column into an Integration Points table (File/Module, Purpose, Connection). |
| Full-tech | 7.6 Codebase Context: Integration Points, 7.4 API Specifications (seed) | Same as detailed, plus use exported interfaces to seed API Specification section with discovered endpoints. |

### File Details (Exports, Logic, Patterns)

Per-file breakdown of key exports, core logic, and notable patterns.

| Depth | Target Section(s) | How to Transform |
|-------|-------------------|------------------|
| High-level | _(skip)_ | Too granular. |
| Detailed | 7.5 Codebase Context: Patterns to Follow | Extract common patterns across files into a "Patterns to Follow" list. |
| Full-tech | 7.6 Codebase Context: Patterns to Follow, 7.3 Data Models | Extract patterns for Codebase Context. Use entity exports to seed Data Model section with discovered schemas. |

### Relationship Map

Component dependencies and data flow, typically as a Mermaid flowchart.

| Depth | Target Section(s) | How to Transform |
|-------|-------------------|------------------|
| High-level | Dependencies section | Summarize as a dependency list (no diagram). |
| Detailed | 7.3 Integration Points, 10. Dependencies | Use the relationship map to populate Integration Points table and Dependencies section. Include diagram in 7.1 if not already covered. |
| Full-tech | 7.5 Integration Points, 12. Dependencies | Same as detailed, plus create sequence diagrams for key integration flows. |

### Patterns & Conventions

Recurring patterns, naming conventions, file organization, shared abstractions.

| Depth | Target Section(s) | How to Transform |
|-------|-------------------|------------------|
| High-level | Proposed Solution Overview | Mention key architectural style (e.g., "microservices", "monolith", "event-driven") in the solution overview. |
| Detailed | 7.1 Architecture Overview, 7.5 Codebase Context: Patterns to Follow | Architecture style goes in 7.1. Specific patterns (naming, file org, shared abstractions) go in 7.5. |
| Full-tech | 7.1 System Overview, 7.2 Tech Stack, 7.6 Codebase Context | Architecture style in 7.1. Technology justifications in 7.2 (reference discovered patterns as evidence). Detailed patterns in 7.6. |

### Challenges & Risks

Technical risks, complexity hotspots, tight coupling, test gaps.

| Depth | Target Section(s) | How to Transform |
|-------|-------------------|------------------|
| High-level | Risks & Mitigations table | Map each challenge to a row: Risk, Impact (High/Medium/Low), Likelihood, Mitigation. |
| Detailed | 7.4 Technical Constraints, 11. Risks & Mitigations | Technical constraints (coupling, performance limits) go in 7.4. Business-facing risks go in 11. |
| Full-tech | 7.7 Technical Constraints, 13. Risks & Mitigations, 10. Testing Strategy (gaps) | Same as detailed, plus test coverage gaps inform the Testing Strategy section. |

### Recommendations

Actionable items from the synthesizer with challenge citations.

| Depth | Target Section(s) | How to Transform |
|-------|-------------------|------------------|
| High-level | Implementation Phases (guidance) | Incorporate recommendations as phase guidance — e.g., "Phase 1 should address {recommendation}." |
| Detailed | 9. Implementation Plan | Weave recommendations into phase deliverables and completion criteria. |
| Full-tech | 9. Implementation Plan, 11. Deployment & Operations | Same as detailed, plus operational recommendations go in Deployment & Operations. |

### Open Questions

Areas not fully covered by the analysis.

| Depth | Target Section(s) | How to Transform |
|-------|-------------------|------------------|
| All depths | Open Questions section | Direct pass-through. Format as a numbered table: #, Question, Owner, Due Date, Resolution. Mark Owner as "TBD" and Resolution as "Pending". |

---

## Mapping User-Provided Context

Information gathered during the interview (Phase 3 Stages B-D) maps to sections that code cannot populate:

| Interview Data | Target Section |
|---|---|
| Problem statement | Problem Statement (all depths) |
| Business value / impact | 2.4 Business Value (detailed, full-tech) |
| User personas | 4. User Research / User Personas (all depths — simplified for high-level) |
| Success metrics | 3. Goals & Success Metrics (all depths) |
| Non-functional requirements | 6. Non-Functional Requirements (detailed, full-tech) |
| Future direction | 3.3 Non-Goals / 8.3 Future Considerations (detailed, full-tech) |
| Security/compliance context | 6.2 Security (detailed, full-tech) |
| Performance targets | 6.1 Performance (detailed, full-tech) |

---

## Special Section: Codebase Context

The detailed and full-tech templates include a Codebase Context subsection (7.5 in detailed, 7.6 in full-tech). In create-spec, this section is conditional — only populated for "new feature" type specs. In inverted-spec, this section is **always populated** because the entire spec is derived from codebase analysis.

### Codebase Context Structure

```markdown
### 7.5 Codebase Context

#### Existing Architecture
{Architecture overview from analysis — 1-2 paragraphs summarizing the discovered structure}

#### Integration Points

| File/Module | Purpose | Connection |
|-------------|---------|------------|
| {from critical files table} | {purpose} | {connections} |

#### Patterns to Follow
- {Pattern 1 from analysis — validated as intentional in Stage A}
- {Pattern 2}

#### Related Features
- {Other features in the codebase that interact with included features}
```

---

## Gap Handling

When analysis findings are thin for a particular section:

1. **If the gap was addressed in the interview** → use interview data
2. **If the gap was addressed by research** → use research findings with `[Researched]` provenance
3. **If the gap is minor** → infer from available context, mark with `[Inferred — low confidence]`
4. **If the gap is significant** → add to the Open Questions section rather than fabricating content
5. **If the section is not required for the depth level** → skip it (refer to the template for required sections)

The principle: it's better to have an accurate spec with acknowledged gaps than a complete-looking spec with fabricated content.

---

## Provenance in Mapping

Every piece of content placed into the spec should carry its provenance through to the compilation phase:

| Source | Marker | Example |
|--------|--------|---------|
| Code analysis (high confidence) | `[Inferred]` | Architecture patterns, tech stack, existing features |
| Code analysis (low confidence) | `[Inferred — low confidence]` | Inferred business logic intent, unclear patterns |
| User interview | `[Stated]` | Problem statement, personas, success metrics |
| User adjustment of analysis | `[Inferred, Adjusted]` | Analysis finding corrected by user in Stage D |
| External research | `[Researched]` | Compliance requirements, best practices |

The compilation guide (`compilation-guide.md`) defines how these markers are formatted in the final spec.
