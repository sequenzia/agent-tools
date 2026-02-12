# AGENTS.md Generation Template

Use this template when generating or updating a project's AGENTS.md from codebase analysis findings. AGENTS.md is an open standard for guiding AI coding agents — it uses pure Markdown with no tool-specific syntax.

---

## Template

```markdown
# AGENTS.md

## Dev Environment

### Prerequisites
- {Runtime/language and version}
- {Package manager and version}
- {External tools or services required}

### Setup
```bash
{exact setup commands, one per line}
```

## Build & Test

### Build
```bash
{exact build command}
```

### Test
```bash
{run all tests}
{run single test file}
```

### Lint
```bash
{exact lint command}
{exact format command}
```

## Architecture Overview

{2-3 sentences describing the high-level architecture and design philosophy.}

### Key Components

- **{Component}** (`{path/}`) — {What it does}

### Directory Structure

```
{top-level directory tree, 2 levels deep, with inline comments}
```

## Code Style

### Naming
- {Convention}: {example}

### File Organization
- {Rule}: {example}

### Patterns
- {Pattern name}: {where it's used and how to follow it}

## Security

- {Security consideration relevant to contributions}

## Git Workflow

### Branching
- {Branch naming convention}

### Commits
- {Commit message format and conventions}

### Pull Requests
- {PR process or requirements}

## Conventions & Patterns

- {Convention that applies across the codebase}
- {Pattern that new code must follow}
```

---

## Field Descriptions

| Field | Source |
|-------|--------|
| Prerequisites | Runtime versions from config files (.nvmrc, .python-version, etc.) |
| Setup commands | Installation steps discovered during analysis |
| Build command | Build scripts from package.json, Makefile, or equivalent |
| Test commands | Test runner configuration and scripts |
| Lint commands | Linter/formatter config (.eslintrc, ruff.toml, .prettierrc, etc.) |
| Architecture description | Architecture Overview from Phase 2 report |
| Key Components | Critical Files and Relationship Map from Phase 2 report |
| Directory Structure | Reconnaissance findings from Phase 1 (deep-analysis) |
| Naming conventions | Patterns & Conventions → Naming Conventions from Phase 2 report |
| File Organization | Patterns & Conventions → Project Structure from Phase 2 report |
| Patterns | Patterns & Conventions → Code Patterns from Phase 2 report |
| Security | Challenges & Risks entries related to security; general security practices |
| Git Workflow | Git history analysis, branch naming patterns, commit message conventions |
| Conventions & Patterns | Cross-cutting patterns from Phase 2 report |

---

## Section Guidelines

### General AGENTS.md Principles
- **Pure Markdown only** — no YAML frontmatter, no tool-specific directives, no custom syntax
- **Target under 150 lines total** — concise and scannable
- **Exact copy-pasteable commands** — every code block must work when pasted into a terminal
- **Write for any AI coding agent** — not just Claude; avoid tool-specific instructions

### Dev Environment
- Include only what is strictly required to build and run the project
- Specify exact versions where the project requires them
- Setup commands should be runnable in sequence from a fresh clone

### Build & Test
- Include the most commonly used commands
- If the project has a single-test runner, include it — agents use this frequently
- Omit obvious commands (cd, source .env) unless the project has a non-standard setup

### Architecture Overview
- Keep to 2-3 sentences plus the components list
- Focus on what an agent needs to understand to make safe changes
- Directory structure should be 2 levels deep maximum

### Code Style
- Only include conventions that are actively enforced or consistently followed
- Give concrete examples, not abstract rules
- If a linter/formatter enforces it, mention the tool rather than restating rules

### Security
- Include only security considerations relevant to code contributions
- Mention authentication patterns, input validation approaches, or secret management
- Skip generic advice (e.g., "don't commit secrets") unless the project has specific tooling for it

### Git Workflow
- Include commit message format if the project uses conventional commits or a specific style
- Mention branch naming only if there's a consistent convention
- Include PR requirements only if there are specific checks or review processes

### Conventions & Patterns
- Cross-cutting patterns that don't fit in other sections
- Limit to 3-5 items that are most important for making correct changes

---

## Update Strategy

When updating an existing AGENTS.md:

1. **Read the existing file completely** before drafting any changes
2. **Draft only NEW sections or bullet points** — do not rewrite existing content
3. **Never overwrite existing guidance** — it may reflect team decisions not visible in the code
4. **Preserve existing section ordering** and heading structure
5. **Respect the 150-line budget** — if the file is already near 150 lines, consolidate rather than append
6. **Present additions as clearly marked blocks** so the user can review exactly what is being added
7. **Skip sections that already have adequate content** — do not duplicate information

---

## Tool Compatibility Notes

AGENTS.md is designed to work with any AI coding agent. When generating content:

- **No Claude-specific directives** — do not use `CRITICAL:`, `IMPORTANT:`, or other prompt-engineering patterns
- **No Cursor-specific syntax** — do not use `.cursorrules` format or Cursor-specific instructions
- **Standard Markdown only** — headings, lists, code blocks, tables; no custom extensions
- **Relationship to CLAUDE.md** — AGENTS.md covers the same ground as CLAUDE.md but in a tool-neutral format. Projects may use both (CLAUDE.md for Claude-specific preferences, AGENTS.md for universal guidance) or symlink one to the other
