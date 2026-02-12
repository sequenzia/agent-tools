# README.md Generation Template

Use this template when generating or updating a project's README.md from codebase analysis findings.

---

## Template

```markdown
# {Project Name}

{One-line description of what the project does and its primary value.}

## Overview

{2-3 paragraphs covering:}
- What the project does and the problem it solves
- The high-level approach or architectural philosophy
- Who the intended users/audience are

## Architecture

{Brief description of how the project is structured.}

### Directory Structure

```
{top-level directory tree, 2-3 levels deep}
```

### Tech Stack

| Category | Technology |
|----------|------------|
| Language | {Primary language(s)} |
| Framework | {Core framework(s)} |
| Database | {Database/storage if applicable} |
| Testing | {Test framework(s)} |

## Getting Started

### Prerequisites

- {Runtime/language version required}
- {Package manager}
- {External services or tools needed}

### Installation

```bash
{clone and install commands}
```

### Quick Start

```bash
{commands to run the project locally}
```

## Key Concepts

{3-5 bullet points explaining the most important abstractions, patterns, or domain terms a new developer needs to understand.}

- **{Concept}** — {One-line explanation}

## Contributing

{Brief contribution guidance or link to CONTRIBUTING.md.}

## License

{License type and link.}
```

---

## Field Descriptions

| Field | Source |
|-------|--------|
| Project Name | Repository name or package.json/pyproject.toml name field |
| One-line description | Synthesize from executive summary or existing project description |
| Overview paragraphs | Architecture Overview and Executive Summary from Phase 2 report |
| Directory Structure | Reconnaissance findings from Phase 1 (deep-analysis) |
| Tech Stack table | Dependencies and frameworks discovered during exploration |
| Prerequisites | Runtime versions from config files (package.json engines, .python-version, etc.) |
| Installation commands | Package manager install commands found in config files |
| Quick Start commands | Dev/start scripts from package.json, Makefile, or equivalent |
| Key Concepts | Core abstractions identified in Patterns & Conventions section |
| Contributing | Existing CONTRIBUTING.md reference or brief inline guidance |
| License | LICENSE file content or package.json license field |

---

## Section Guidelines

### Overview
- Lead with what the project does, not how it's built
- Keep technical details for the Architecture section
- Mention the primary use case or problem being solved

### Architecture
- Directory structure should show only the top 2-3 levels — enough to orient, not overwhelm
- Tech stack table should only include actively used technologies, not transitive dependencies
- Keep architecture description to 2-4 sentences

### Getting Started
- Commands must be exact and copy-pasteable
- Include only the minimum steps needed to run the project locally
- If setup is complex, link to a more detailed guide rather than inlining everything

### Key Concepts
- Limit to 3-5 concepts that a new developer must understand
- Use the project's own terminology, not generic software terms
- Each concept gets one sentence — link to deeper docs if available

---

## Update Strategy

When updating an existing README.md:

1. **Read the existing file completely** before drafting any changes
2. **Draft only NEW sections or substantive additions** — do not rewrite existing content
3. **Never overwrite user-written content**, introductions, badges, or custom sections
4. **Preserve existing heading structure** and section ordering
5. **Adapt additions to match the existing organizational style** — if the README uses different heading names or structures, follow those conventions rather than the template
6. **Present additions as clearly marked blocks** so the user can see exactly what is being added
7. **Skip sections that already have adequate content** — do not duplicate information
