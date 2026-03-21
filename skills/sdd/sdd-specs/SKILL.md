---
name: sdd-specs
description: >-
  Spec templates, interview question banks, complexity signals, recommendation
  patterns, and codebase exploration procedures for the SDD spec creation
  workflow. Use as a reference skill when creating or reviewing specs. Load
  this skill whenever working with spec templates, conducting interviews,
  assessing project complexity, or reviewing spec quality.
---

# SDD Specs Reference

This skill is a shared reference for spec creation materials. Load it when your skill or agent needs to create, review, or assess specifications.

It covers:
- Spec templates at three depth levels (high-level, detailed, full-tech)
- Interview question bank organized by category and depth
- Complexity signal definitions and thresholds
- Recommendation trigger patterns and presentation format
- Codebase exploration procedures for new feature specs

For deeper content, load the reference files listed at the end of this document.

---

## Spec Templates

Three templates support different documentation depths. Choose based on the project's needs:

| Depth Level | Template | Use Case |
|-------------|----------|----------|
| High-level overview | `references/templates/high-level.md` | Executive summaries, stakeholder alignment, initial scoping |
| Detailed specifications | `references/templates/detailed.md` | Standard development specs with clear requirements |
| Full technical documentation | `references/templates/full-tech.md` | Complex features requiring API specs, data models, architecture |

Each template provides the section structure and guidance for what to include. The interview process determines which template to use based on the assessed complexity and user preference.

---

## Interview Questions

The question bank is organized into four categories, each with questions at three depth levels:

- **Functional Requirements** — core behaviors, features, user interactions
- **Technical Requirements** — architecture, integrations, data models, performance
- **Non-Functional Requirements** — scalability, security, compliance, accessibility
- **Project Context** — timeline, team, constraints, risks

Each depth level has a question budget (standard and expanded for complex projects). The interview process draws from these questions adaptively based on what has been covered.

```
Read references/interview-questions.md
```

---

## Complexity Signals

Complexity signals help determine whether a project needs expanded interview coverage. Signals are categorized by weight (high, medium) and a threshold triggers expanded budgets.

- **Threshold**: 3+ high-weight signals OR 5+ any-weight signals
- **Effect**: Expanded question budgets for deeper coverage

```
Read references/complexity-signals.md
```

---

## Recommendation System

The recommendation system proactively suggests best practices when trigger patterns are detected during the interview. It consists of two parts:

### Trigger Patterns

Patterns that activate recommendations across domains: authentication, scalability, security, real-time features, file handling, API design, search, testing, and accessibility.

```
Read references/recommendation-triggers.md
```

### Presentation Format

Templates for presenting recommendations to users with context, rationale, and actionable guidance.

```
Read references/recommendation-format.md
```

---

## Codebase Exploration

For "new feature" type specs, codebase exploration gathers context about the existing codebase to inform the specification. This is delegated to the `code-exploration` skill using a team-based approach.

```
Read references/codebase-exploration.md
```

---

## Reference Files

### Interview Questions

Question bank organized by category and depth level, with standard and expanded budgets for complex projects.

```
Read references/interview-questions.md
```

### Complexity Signals

Signal definitions, thresholds, and assessment format for detecting project complexity.

```
Read references/complexity-signals.md
```

### Recommendation Triggers

Trigger patterns organized by domain for proactive best-practice recommendations.

```
Read references/recommendation-triggers.md
```

### Recommendation Format

Templates for presenting recommendations with context and rationale.

```
Read references/recommendation-format.md
```

### Codebase Exploration

Procedure for team-based codebase exploration when building specs for new features.

```
Read references/codebase-exploration.md
```

### Spec Templates

```
Read references/templates/high-level.md
Read references/templates/detailed.md
Read references/templates/full-tech.md
```
