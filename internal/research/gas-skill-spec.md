# Generic Agent Skills (GAS) Specification Research

**Researched**: 2026-03-07
**Sources**: https://agentskills.io/specification, https://github.com/agentskills/agentskills, charmbracelet/crush source code (internal/skills/skills.go), Anthropic example skills repo, agent-alchemy-sdd-tools plugin skills (5 real-world GAS skills analyzed)
**Spec Version**: No formal semantic version; docs site version 0.0.2611; docs last updated Mar 6, 2026; GitHub repo last updated Mar 7, 2026
**Recommended Embedded Version**: `spec_version: "2026-03"` or `spec_last_verified: "2026-03-07"`

---

## 1. Overview

The Generic Agent Skills (GAS) specification is an open standard for portable agent skills, published at https://agentskills.io. Originally developed by Anthropic, it defines a platform-agnostic format for packaging agent capabilities as structured Markdown files with YAML frontmatter.

**Key characteristics:**
- Open standard, not proprietary to any single agent platform
- File-based format using `SKILL.md` files
- YAML frontmatter for metadata + Markdown body for instructions
- Designed for cross-platform portability across compatible agent implementations
- Skills are directories, not single files — supporting scripts, references, and assets alongside the main `SKILL.md`

**Platforms implementing GAS:**
- Claude Code (Anthropic) — the reference implementation
- OpenCode / Crush (Charmbracelet) — full adoption of the GAS standard
- Any agent that supports the agentskills.io specification

---

## 2. File Format and Structure

### 2.1 Directory Structure

A GAS skill is a directory containing at minimum a `SKILL.md` file:

```
skill-name/
  SKILL.md          # Required — YAML frontmatter + Markdown instructions
  scripts/           # Optional — executable scripts the agent can run
  references/        # Optional — additional documentation loaded on demand
  assets/            # Optional — static resources (templates, images, data)
```

The directory name MUST match the `name` field in the frontmatter (case-insensitive matching in some implementations, but lowercase is recommended for portability).

### 2.2 SKILL.md Format

The file consists of two parts:
1. **YAML frontmatter** — delimited by `---` on its own line at start and end
2. **Markdown body** — instructions for the agent, following the frontmatter

```markdown
---
name: skill-name
description: What this skill does and when to use it.
---

# Skill Title

Instructions in Markdown...
```

### 2.3 File Naming

- The main file MUST be named `SKILL.md` (all uppercase)
- The parent directory name MUST match the `name` frontmatter field

---

## 3. Frontmatter Fields

### 3.1 Required Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | 1-64 chars; lowercase alphanumeric + hyphens; no leading, trailing, or consecutive hyphens; must match parent directory name | Unique identifier for the skill |
| `description` | string | 1-1024 chars; non-empty | What the skill does and when to use it; should include keywords for agent discoverability |

### 3.2 Optional Fields (GAS Spec)

These fields are defined in the agentskills.io specification:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `license` | string | No length limit specified | License name (e.g., `MIT`, `Apache-2.0`) or reference to bundled license file (e.g., `Complete terms in LICENSE.txt`) |
| `compatibility` | string | 1-500 chars if provided | Environment requirements — target product, system packages, network access |
| `metadata` | map[string]string | String keys to string values | Arbitrary key-value pairs for additional properties (e.g., `author`, `version`, `audience`) |
| `allowed-tools` | string | Space-delimited tool names | Pre-approved tools the skill may use. **Experimental** — support varies by agent implementation |

### 3.3 Implementation-Specific Extension Fields

These fields are NOT part of the agentskills.io core specification but are used by specific agent implementations (notably Claude Code). They are silently ignored by implementations that do not recognize them.

| Field | Type | Used By | Description |
|-------|------|---------|-------------|
| `argument-hint` | string | Claude Code | Display hint for skill arguments (e.g., `"[context-file-or-text]"`, `"[task-id] [--retries <n>]"`) |
| `user-invocable` | boolean | Claude Code | Whether users can invoke the skill directly (vs. only agent-invocable) |
| `disable-model-invocation` | boolean | Claude Code | When true, prevents the model from invoking the skill autonomously |
| `arguments` | array of objects | Claude Code | Typed argument definitions with `name`, `description`, and `required` properties |

**Arguments object structure:**
```yaml
arguments:
  - name: context
    description: Optional context — a file path or inline text
    required: false
  - name: platform
    description: Target platform — gas, opencode, or codex
    required: false
```

### 3.4 Name Validation Rules

- Must be 1-64 characters
- Lowercase alphanumeric characters and hyphens only
- Must not start or end with a hyphen (`-`)
- Must not contain consecutive hyphens (`--`)
- Must match the parent directory name
- **Spec regex**: `^[a-z0-9]+(-[a-z0-9]+)*$`

**Implementation note**: OpenCode/Crush source code uses `^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$` (allows mixed case), but the agentskills.io spec requires lowercase only. For maximum cross-platform portability, always use lowercase names.

### 3.5 Unknown Fields

Unknown frontmatter fields are silently ignored by all known implementations. This is the mechanism that allows implementation-specific extensions (like Claude Code's `arguments` field) to coexist with the base spec — implementations that do not understand them simply skip them.

---

## 4. Body Content

The Markdown body after the frontmatter contains the skill instructions. The GAS spec does not impose structural requirements on the body content, but provides guidelines.

### 4.1 Recommended Sections

The spec recommends skills include:
- Step-by-step instructions for the agent to follow
- Examples of inputs and expected outputs
- Common edge cases to handle

### 4.2 Progressive Disclosure / Token Budget

Skills should be structured for efficient context usage:

| Level | Token Budget | When Loaded |
|-------|-------------|-------------|
| Metadata | ~100 tokens | Startup — name + description loaded for all skills |
| Instructions | <5000 tokens recommended | When the skill is activated |
| Resources | As needed | On demand — scripts/, references/, assets/ |

**Guidelines:**
- Keep main `SKILL.md` under 500 lines
- Move detailed reference material to separate files in `references/`
- Keep file references one level deep from SKILL.md
- Use relative paths from the skill root for cross-references

### 4.3 File References

Use relative paths from the skill root directory:
```markdown
See [the reference guide](references/REFERENCE.md) for details.
Run the extraction script: scripts/extract.py
```

---

## 5. Optional Directories

### 5.1 scripts/

Executable code that agents can run:
- Should be self-contained or clearly document dependencies
- Should include helpful error messages
- Should handle edge cases gracefully
- Supported languages depend on the agent runtime (common: Python, Bash, JavaScript)

### 5.2 references/

Additional documentation loaded on demand:
- `REFERENCE.md` — detailed technical reference
- Domain-specific files (e.g., `FORMS.md`, `finance.md`)
- Keep individual files focused for efficient context usage

### 5.3 assets/

Static resources:
- Templates (document, configuration)
- Images (diagrams, examples)
- Data files (lookup tables, schemas)

---

## 6. Example Skills Analysis

### 6.1 Example: PDF Processing Skill (from Anthropic examples)

```yaml
---
name: pdf
description: Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rotating pages, adding watermarks, creating new PDFs, filling PDF forms, encrypting/decrypting PDFs, extracting images, and OCR on scanned PDFs to make them searchable. If the user mentions a .pdf file or asks to produce one, use this skill.
license: Proprietary. LICENSE.txt has complete terms
---
```

**Patterns observed:**
- Long, keyword-rich description for maximum agent discoverability
- Lists specific trigger scenarios directly in the description
- License field references a bundled file
- No `compatibility` or `metadata` fields — minimal when not needed
- Body contains structured Markdown with code examples, tables, step-by-step guides
- Uses reference files (`REFERENCE.md`, `FORMS.md`) for progressive disclosure
- Only uses GAS core spec fields (no implementation-specific extensions)

### 6.2 Example: MCP Builder Skill (from Anthropic examples)

```yaml
---
name: mcp-builder
description: Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).
license: Complete terms in LICENSE.txt
---
```

**Patterns observed:**
- Description includes both "what" and "when to use"
- Targets specific technologies in description for discoverability
- Body organized with a phased approach (Research, Implementation, Review, Evaluations)
- Extensive use of reference files in `reference/` subdirectory
- Links to external resources (GitHub raw URLs for SDK docs)
- Structured with clear headings, code blocks, and tables

### 6.3 Example: Git Release Skill (from OpenCode docs)

```yaml
---
name: git-release
description: Create consistent releases and changelogs
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: github
---
```

**Patterns observed:**
- Demonstrates use of all spec-defined optional fields
- Short, focused description (contrast with PDF and MCP skills)
- `compatibility` set to target platform
- `metadata` used for audience and workflow categorization
- Body uses "What I do" and "When to use me" section pattern

### 6.4 Example: create-skill Skill (from this project — real-world GAS skill)

```yaml
---
name: create-skill
description: Create a new agent skill through an adaptive interview process that produces complete, platform-native skill files. Supports Generic Agent Skills (agentskills.io), OpenCode, and Codex platforms. Use when user says "create a skill", "new skill", "generate skill", "make a skill", "build a skill", "skill creator", or wants to author an agent skill file.
argument-hint: "[context-file-or-text]"
user-invocable: true
disable-model-invocation: false
allowed-tools: AskUserQuestion, Read, Write, Glob, Grep, Bash
arguments:
  - name: context
    description: Optional context — a file path (.md, .txt) to read or inline text describing the skill to create
    required: false
  - name: platform
    description: Target platform — gas, opencode, or codex. If omitted, user will be prompted to select.
    required: false
---
```

**Patterns observed:**
- Uses both GAS core fields AND Claude Code implementation-specific extensions
- `allowed-tools` as YAML list format (Claude Code extension) rather than space-delimited string (spec format)
- Long description with specific trigger phrases for agent discoverability
- `argument-hint` provides a usage hint shown to the user
- `arguments` provides typed, structured argument definitions
- `user-invocable: true` and `disable-model-invocation: false` control invocation modes
- Body is extensive (1242 lines) — well beyond the 500-line guideline, but uses references for supplementary content
- Validates that the GAS spec's "unknown fields silently ignored" principle works in practice

### 6.5 Example: execute-tasks Skill (from agent-alchemy-sdd-tools)

```yaml
---
name: execute-tasks
description: Execute pending Claude Code Tasks in dependency order with wave-based concurrent execution and adaptive verification...
argument-hint: "[task-id] [--task-group <group>] [--retries <n>] [--max-parallel <n>]"
user-invocable: true
disable-model-invocation: false
allowed-tools:
  - Task
  - TaskOutput
  - TaskStop
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
  - TaskList
  - TaskGet
  - TaskUpdate
arguments:
  - name: task-id
    description: Optional specific task ID to execute...
    required: false
  - name: task-group
    description: Optional task group name to filter tasks...
    required: false
  - name: retries
    description: Number of retry attempts...
    required: false
  - name: max-parallel
    description: Maximum number of tasks to execute simultaneously per wave...
    required: false
---
```

**Patterns observed:**
- `allowed-tools` as YAML list (multi-line) — Claude Code extension of the spec's space-delimited string format
- Multiple typed arguments with `required: false`
- Demonstrates how complex tool requirements are declared
- Same extension field pattern as create-skill

### 6.6 Common Patterns Across All Examples

1. **Description format**: Always describes what the skill does AND when to use it
2. **License pattern**: Either short identifier (`MIT`, `Apache-2.0`) or reference to file (`Complete terms in LICENSE.txt`)
3. **Body structure**: Starts with overview/purpose, then detailed instructions
4. **Progressive disclosure**: Complex skills split content into SKILL.md + reference files
5. **Minimal frontmatter**: Most skills omit optional fields unless they add value
6. **Trigger keywords**: Descriptions include specific terms/phrases the agent should match against
7. **Extension field safety**: Implementation-specific fields coexist with core fields without issues

---

## 7. Validation

### 7.1 Reference Library

The agentskills.io spec provides a reference validation library:
```bash
skills-ref validate ./my-skill
```

### 7.2 Validation Rules

**Required field checks:**
- `name` is present and non-empty
- `name` is 1-64 characters
- `name` matches regex `^[a-z0-9]+(-[a-z0-9]+)*$`
- `name` matches the parent directory name
- `description` is present and non-empty
- `description` is 1-1024 characters
- Frontmatter starts with `---` on its own line
- Frontmatter ends with `---` on its own line
- Markdown body follows the frontmatter

**Optional field constraints (validate only if present):**
- `compatibility` is 1-500 characters
- `metadata` values are all strings (map[string]string)
- `allowed-tools` is a space-delimited string of tool names

**Format constraints:**
- File must be named `SKILL.md` (all caps)
- File must reside in a directory whose name matches the `name` field
- YAML frontmatter must be valid YAML
- Body content must be valid Markdown

### 7.3 Common Mistakes

- Using uppercase or mixed-case characters in `name` (use lowercase only)
- Starting or ending `name` with a hyphen
- Using consecutive hyphens (`--`) in `name`
- Mismatching the directory name and the `name` field
- Leaving `description` empty or too vague for discoverability
- Exceeding the 1024-character limit on `description`
- Exceeding the 500-character limit on `compatibility`
- Omitting frontmatter delimiters (`---`)

---

## 8. Spec Version and Currency

### 8.1 Version Information

- **Spec**: Agent Skills open standard (https://agentskills.io)
- **Spec origin**: Originally developed by Anthropic, released as open standard
- **Docs site version**: 0.0.2611 (Mintlify-hosted docs)
- **Docs last updated**: March 6, 2026
- **GitHub repo**: https://github.com/agentskills/agentskills (updated March 7, 2026)
- **Reference implementation**: Claude Code (Anthropic)

### 8.2 No Formal Version Number

The GAS specification does not use a formal semantic version. There is no version field in the spec itself. For embedded knowledge tracking, use the docs site last-updated date as the reference point.

**Recommended embedded version metadata**: `spec_version: "2026-03"` or `spec_last_verified: "2026-03-07"`

### 8.3 Spec Stability

The spec appears stable at the core level (name, description, license, compatibility, metadata are well-established). The `allowed-tools` field is explicitly marked as experimental. Extension fields (like Claude Code's `arguments`) are implementation-specific and not governed by the spec's stability guarantees.

---

## 9. Differences from OpenCode Format

### 9.1 Key Insight: OpenCode IS GAS

OpenCode does not define its own proprietary skill format. It adopts the GAS standard directly. OpenCode-specific behaviors are implementation details, not format differences.

### 9.2 Implementation Differences

| Aspect | GAS Spec (agentskills.io) | OpenCode Implementation |
|--------|--------------------------|------------------------|
| Name regex | `^[a-z0-9]+(-[a-z0-9]+)*$` (lowercase only) | `^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$` (mixed case accepted) |
| `allowed-tools` | Space-delimited string (experimental) | Silently ignored (unknown field) |
| Skill invocation | Not specified (platform-dependent) | Via native `skill` tool: `skill({ name: "..." })` |
| Skill discovery | Not specified (platform-dependent) | 6 search paths: `.opencode/`, `.claude/`, `.agents/` (project + global) |
| Permissions | Not specified (platform-dependent) | Configurable in `opencode.json` with glob patterns (allow/deny/ask) |
| Per-agent overrides | Not specified | Supported in markdown agent frontmatter and JSON config |
| Disabling skills | Not specified | `tools: { skill: false }` in agent config |

### 9.3 Cross-Platform Portability Considerations

- **Use lowercase names only** — the spec requires it; OpenCode merely tolerates mixed case
- **Do not rely on `allowed-tools`** — it is experimental and silently ignored by OpenCode
- **Keep to core fields** — `name`, `description`, `license`, `compatibility`, `metadata` work everywhere
- **Extension fields are safe** — unknown fields are silently ignored, so Claude Code extensions do not break OpenCode or other implementations
- **Discovery paths vary** — a skill in `.claude/skills/` will be found by both Claude Code and OpenCode, but `.opencode/skills/` is OpenCode-only
- **Best portable path**: `.agents/skills/<name>/SKILL.md` (the agent-agnostic standard path)

### 9.4 Differences from Codex Format

Codex (OpenAI) uses a fundamentally different approach:
- Codex skills are typically instruction files, not YAML+Markdown structured files
- Codex does not implement the GAS standard
- Codex has its own conventions for skill definition and discovery
- Cross-compatibility between GAS and Codex requires format translation, not just field mapping

---

## 10. Gaps and Uncertainties

1. **`allowed-tools` field**: Marked "Experimental" in the agentskills.io spec. Support varies between implementations. OpenCode silently ignores it. Claude Code supports it but the exact behavior (strict enforcement vs. advisory) is unclear. The spec does not define a standard vocabulary of tool names.

2. **Name case sensitivity**: Spec requires lowercase but not all implementations enforce it. Use lowercase for portability.

3. **Body content size limits**: The spec recommends <5000 tokens and <500 lines for the main SKILL.md body, but these are guidelines, not enforced limits. Real-world skills (e.g., create-skill at 1242 lines) exceed these guidelines.

4. **Spec versioning**: No formal versioning scheme exists. The spec could change without a version bump. Dynamic documentation fetching is important for staying current.

5. **`compatibility` field semantics**: Free-form text with no standard vocabulary. Usage varies (e.g., "opencode", "claude-code" are conventions, not enforced values). No registry of valid compatibility values exists.

6. **Extension field behavior**: While unknown fields are silently ignored, there is no formal extension mechanism. Each implementation adds its own fields without coordination. No namespacing or prefix convention exists to distinguish core fields from extensions.

7. **Context7 availability**: Context7 MCP tools were not available during this research session. The agentskills.io specification content was sourced from prior research, source code analysis, and the existing opencode-skill-spec.md research document. Findings should be verified against the live agentskills.io/specification page when Context7 or web access is available.

8. **Codex specification details**: Full Codex skill format documentation was not available during this research. The differences noted are high-level observations. A dedicated Codex research document will be needed for Phase 2 implementation.

---

## 11. Host Format Validation

Since the `create-skill` skill itself is built to the GAS format, this research validates that the host skill file conforms to the specification.

### 11.1 create-skill SKILL.md Validation Results

| Check | Result | Notes |
|-------|--------|-------|
| `name` present | PASS | `create-skill` |
| `name` length (1-64) | PASS | 12 characters |
| `name` regex `^[a-z0-9]+(-[a-z0-9]+)*$` | PASS | Lowercase with single hyphen |
| `name` matches directory | PASS | `skills/create-skill/SKILL.md` |
| `description` present | PASS | Non-empty, descriptive |
| `description` length (1-1024) | PASS | ~280 characters |
| Frontmatter delimiters | PASS | `---` present at start and end |
| YAML validity | PASS | All fields parse correctly |
| Markdown body present | PASS | Extensive body content |
| Extension fields safe | PASS | `argument-hint`, `user-invocable`, `disable-model-invocation`, `arguments` are silently ignored by non-Claude implementations |
| `allowed-tools` format | NOTE | Uses YAML list format (Claude Code extension) rather than spec's space-delimited string |

### 11.2 Conclusion

The create-skill SKILL.md is a valid GAS skill file. Its extension fields (`argument-hint`, `user-invocable`, `disable-model-invocation`, `arguments`) do not violate the spec because unknown fields are silently ignored. The `allowed-tools` field uses Claude Code's YAML list format rather than the spec's space-delimited string format; this is a harmless implementation variance since `allowed-tools` is experimental and implementations vary in parsing.
