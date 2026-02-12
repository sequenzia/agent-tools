# CLAUDE.md Generation Template

Use this template when generating or updating a project's CLAUDE.md from codebase analysis findings.

---

## Template

```markdown
# CLAUDE.md

{One sentence describing what this file provides — guidance for Claude Code when working with this codebase.}

## What This Project Is

{2-3 sentences: what the project does, its primary purpose, and who uses it. Include the tech stack summary.}

## Repository Structure

```
{Top-level directory tree, 2-3 levels deep, with inline comments explaining each directory's purpose}
```

## Key Architectural Concepts

- **{Concept}** — {How it works and why it matters for making changes}
- **{Pattern}** — {Where it's applied and what to be aware of}

## Build & Development

### Build
```bash
{exact build command}
```

### Test
```bash
{exact test command}
{exact single-test command if applicable}
```

### Lint / Format
```bash
{exact lint command}
{exact format command}
```

## Code Patterns & Conventions

### Naming
- {Naming convention with example}

### File Organization
- {File organization rule with example}

### Common Patterns
- {Recurring pattern and where it appears}

## Critical Files

| File | Purpose |
|------|---------|
| `{path}` | {What it does and why it's important} |

## Dependencies & Integrations

- **{Dependency/Service}** — {How it's used and any configuration notes}

## Things to Watch Out For

- {Gotcha, constraint, or non-obvious behavior that could cause mistakes}
```

---

## Field Descriptions

| Field | Source |
|-------|--------|
| What This Project Is | Executive Summary from Phase 2 report |
| Repository Structure | Reconnaissance findings; include inline comments for each directory |
| Key Architectural Concepts | Architecture Overview and Patterns & Conventions from Phase 2 report |
| Build command | Scripts in package.json, Makefile, pyproject.toml, or equivalent |
| Test command | Test runner configuration and scripts |
| Lint/Format commands | Linter and formatter configurations (.eslintrc, ruff.toml, etc.) |
| Naming conventions | Patterns & Conventions → Naming Conventions from Phase 2 report |
| File Organization | Patterns & Conventions → Project Structure from Phase 2 report |
| Common Patterns | Patterns & Conventions → Code Patterns from Phase 2 report |
| Critical Files table | Critical Files section from Phase 2 report (top 5-8 files) |
| Dependencies & Integrations | Key external dependencies and services from exploration findings |
| Things to Watch Out For | Challenges & Risks from Phase 2 report; focus on day-to-day pitfalls |

---

## Section Guidelines

### What This Project Is
- Keep to 2-3 sentences — this orients the agent, not the user
- Include the primary language and framework
- Mention the project type (library, CLI, web app, API, etc.)

### Repository Structure
- Show 2-3 levels of directory structure
- Add inline comments (`# purpose`) for every directory shown
- Omit generated directories (node_modules, dist, __pycache__)

### Key Architectural Concepts
- Focus on concepts that affect how changes should be made
- Include patterns that must be followed when adding new code
- Limit to 4-6 bullet points

### Build & Development
- Commands must be exact and copy-pasteable
- Include the most common variations (e.g., single-test runner, watch mode)
- Omit commands that are obvious (e.g., `cd project-dir`)

### Code Patterns & Conventions
- Only include patterns that are consistently applied across the codebase
- Provide concrete examples rather than abstract descriptions
- Note any exceptions to the patterns

### Critical Files
- Limit to 5-8 files — the ones an agent must understand to work safely
- Include both entry points and core business logic files
- Purpose description should explain both what the file does and why it matters

### Things to Watch Out For
- Focus on non-obvious behaviors that could cause bugs or broken builds
- Include environment-specific gotchas
- Mention any fragile areas where changes have cascading effects

---

## Update Strategy

When updating an existing CLAUDE.md:

1. **Read the existing file completely** before drafting any changes
2. **Draft only NEW sections or bullet points** — do not rewrite existing content
3. **NEVER overwrite user-defined preferences, instructions, workflow rules, or project-specific overrides** — these represent intentional choices
4. **Preserve existing section ordering** and heading structure
5. **Merge new findings into existing sections** rather than creating duplicate sections
6. **Skip sections that already have adequate content** — do not add redundant information
7. **Present additions as clearly marked blocks** so the user can review exactly what is being added
8. **Respect the existing level of detail** — if the CLAUDE.md is terse, keep additions terse; if detailed, match that style
