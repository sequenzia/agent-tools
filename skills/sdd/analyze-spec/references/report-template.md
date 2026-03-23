# Analysis Report Template

Use this exact template structure when generating `.analysis.md` reports.

---

```markdown
# Spec Analysis Report: {Spec Name}

**Analyzed**: {YYYY-MM-DD}
**Spec Path**: {path/to/spec.md}
**Detected Depth Level**: {High-Level | Detailed | Full-Tech}
**Overall Score**: {0-100} — {Excellent | Good | Needs Improvement | Significant Issues}
**Status**: {Initial | Updated after review}

---

## Summary Dashboard

| Dimension | Score | Critical | Warning | Suggestion |
|-----------|-------|----------|---------|------------|
| Requirements | {0-100} | {N} | {N} | {N} |
| Risk & Feasibility | {0-100} | {N} | {N} | {N} |
| Quality | {0-100} | {N} | {N} | {N} |
| Completeness | {0-100} | {N} | {N} | {N} |
| **Overall** | **{weighted}** | **{N}** | **{N}** | **{N}** |

### Overall Assessment

{2-3 sentence summary of spec quality, main strengths, and primary areas for improvement}

---

## Completeness Scorecard

| Section | Status | Score | Notes |
|---------|--------|-------|-------|
| {Section Name} | {Present | Missing | Partial} | {0-100%} | {brief note} |
| ... | ... | ... | ... |

**Thresholds**: {Min Sections}: {met/missed} | {Min Features}: {met/missed} | {Min User Stories}: {met/missed} | {Min Metrics}: {met/missed}

---

## Findings

### Critical

{If no critical findings: "No critical findings."}

#### FIND-001: {Finding Title}

- **Dimension**: {Requirements | Risk & Feasibility | Quality | Completeness}
- **Category**: {Sub-category, e.g., INC-01, REQ-03, RISK-02}
- **Location**: Section {X.Y} "{Section Name}" (line {N})
- **Issue**: {Clear description of what's wrong}
- **Impact**: {Why this matters — what problems it causes}
- **Recommendation**: {Specific action to resolve}
- **Status**: {Pending | Resolved | Skipped}

---

### Warnings

{If no warnings: "No warnings."}

#### FIND-002: {Finding Title}

- **Dimension**: {Dimension}
- **Category**: {Pattern ID}
- **Location**: {Location reference}
- **Issue**: {Description}
- **Impact**: {Consequence}
- **Recommendation**: {Action}
- **Status**: {Pending | Resolved | Skipped}

---

### Suggestions

{If no suggestions: "No suggestions."}

#### FIND-003: {Finding Title}

- **Dimension**: {Dimension}
- **Category**: {Pattern ID}
- **Location**: {Location reference}
- **Issue**: {Description}
- **Recommendation**: {Action}
- **Status**: {Pending | Resolved | Skipped}

---

## Resolution Summary

*(Added/updated after review session — omit in initial report)*

**Review Session**: {YYYY-MM-DD}
**Resolution Mode**: {Auto-implement | Interactive Review}

| Metric | Count |
|--------|-------|
| Total Findings | {N} |
| Resolved | {N} |
| Skipped | {N} |
| Remaining | {N} |

### Score Change

| Dimension | Before | After | Change |
|-----------|--------|-------|--------|
| Requirements | {N} | {N} | {+/-N} |
| Risk & Feasibility | {N} | {N} | {+/-N} |
| Quality | {N} | {N} | {+/-N} |
| Completeness | {N} | {N} | {+/-N} |
| **Overall** | **{N}** | **{N}** | **{+/-N}** |

### Resolved Findings

{List of FIND-NNN IDs with brief resolution notes}

### Skipped Findings

{List of FIND-NNN IDs with skip reasons}

### Recommendations for Future

{Patterns observed, areas to focus on in future specs or iterations}

---

## Analysis Methodology

This analysis was performed using depth-aware criteria for **{Depth Level}** specs:

- **Dimensions Analyzed**: Requirements, Risk & Feasibility, Quality, Completeness
- **Sections Checked**: {List main sections analyzed}
- **Criteria Applied**: analysis-dimensions.md checklists, common-findings.md pattern library
- **Template Validated Against**: sdd-specs {depth} template
- **Out of Scope**: {What was intentionally not checked due to depth level}
```

---

## Template Usage Notes

### Finding ID Format

Use sequential IDs: `FIND-001`, `FIND-002`, etc. IDs are assigned in order of discovery, not severity.

### Location Format

Specify location as precisely as possible:
- Numbered sections: `Section 3.2 "User Stories" (line 145)`
- Unnumbered sections: `"Success Metrics" section (line 67)`
- Specific content: `Feature "Search" in Key Features table (line 34)`
- Multiple locations: `Sections 2.1, 5.3, and 7.2`

### Status Values

- **Pending** — Not yet addressed (initial state)
- **Resolved** — Fix approved and applied to spec
- **Skipped** — User chose to skip (include reason if provided)

### Deduplication

If the same underlying issue spans multiple dimensions, create a single finding tagged with the primary dimension. Note the cross-dimension impact in the Issue or Impact field.

### Impact Guidelines

Describe impact in terms of:
- What problems it could cause if not fixed
- Who would be affected (developers, stakeholders, users)
- How it might lead to implementation issues
- Whether it blocks task decomposition
