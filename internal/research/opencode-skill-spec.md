# OpenCode Skill Specification Research

**Researched**: 2026-03-07
**Sources**: https://opencode.ai/docs/skills, https://agentskills.io/specification, charmbracelet/crush source code (internal/skills/skills.go), Anthropic example skills repo
**Spec Version**: Agent Skills open standard (agentskills.io, no formal version number; docs site version 0.0.2611; last updated Mar 6, 2026)

---

## 1. Overview

OpenCode implements the **Agent Skills open standard** defined at https://agentskills.io. The skill format uses a `SKILL.md` file containing YAML frontmatter followed by Markdown instructions. OpenCode's implementation is source-compatible with skills written for Claude Code and other Agent Skills-compatible platforms.

Key insight: OpenCode does NOT define its own proprietary skill format. It adopts the Agent Skills spec directly and searches for `SKILL.md` files in multiple locations including Claude-compatible paths.

---

## 2. File Format and Structure

### 2.1 Directory Structure

A skill is a directory containing at minimum a `SKILL.md` file:

```
skill-name/
  SKILL.md          # Required - frontmatter + instructions
  scripts/           # Optional - executable scripts
  references/        # Optional - additional documentation
  assets/            # Optional - static resources (templates, images, data)
```

### 2.2 SKILL.md Format

The file must contain:
1. **YAML frontmatter** - delimited by `---` on its own line
2. **Markdown body** - instructions for the agent

```markdown
---
name: skill-name
description: What this skill does and when to use it.
---

# Skill Instructions

Body content in Markdown...
```

### 2.3 File Discovery Paths (OpenCode-specific)

OpenCode searches these locations for skills:

| Location | Path Pattern |
|----------|-------------|
| Project OpenCode | `.opencode/skills/<name>/SKILL.md` |
| Global OpenCode | `~/.config/opencode/skills/<name>/SKILL.md` |
| Project Claude-compat | `.claude/skills/<name>/SKILL.md` |
| Global Claude-compat | `~/.claude/skills/<name>/SKILL.md` |
| Project Agent-compat | `.agents/skills/<name>/SKILL.md` |
| Global Agent-compat | `~/.agents/skills/<name>/SKILL.md` |

For project-local paths, OpenCode walks up from the current working directory to the git worktree root.

---

## 3. Frontmatter Fields

### 3.1 Required Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | 1-64 chars, lowercase alphanumeric + hyphens, no leading/trailing/consecutive hyphens, must match parent directory name | Unique identifier for the skill |
| `description` | string | 1-1024 chars, non-empty | What the skill does and when to use it. Should include keywords for agent discoverability |

### 3.2 Optional Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `license` | string | No length limit specified | License name or reference to bundled license file |
| `compatibility` | string | 1-500 chars if provided | Environment requirements (target product, system packages, network access) |
| `metadata` | map[string]string | String keys to string values | Arbitrary key-value pairs for additional properties (e.g., author, version) |
| `allowed-tools` | string | Space-delimited | Pre-approved tools the skill may use (Experimental; support varies by agent) |

### 3.3 Name Validation Rules

- Must be 1-64 characters
- Lowercase alphanumeric characters and hyphens only (per agentskills.io spec)
- Must not start or end with `-`
- Must not contain consecutive hyphens (`--`)
- Must match the parent directory name (case-insensitive in OpenCode's implementation)
- Regex: `^[a-z0-9]+(-[a-z0-9]+)*$`

**OpenCode implementation note**: The source code uses `^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$` allowing mixed case, but the official agentskills.io spec requires lowercase only. The agentskills.io spec is the authoritative reference.

### 3.4 Description Best Practices

- Should describe both what the skill does AND when to use it
- Should include specific keywords that help agents identify relevant tasks
- Keep specific enough for the agent to choose correctly

Good example:
```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction.
```

Poor example:
```yaml
description: Helps with PDFs.
```

### 3.5 Unknown Fields

Unknown frontmatter fields are silently ignored (not treated as errors).

---

## 4. Body Content

The Markdown body after the frontmatter contains the skill instructions. There are no format restrictions on the body content.

### 4.1 Recommended Sections

- Step-by-step instructions
- Examples of inputs and outputs
- Common edge cases

### 4.2 Progressive Disclosure

Skills should be structured for efficient context usage:

| Level | Token Budget | When Loaded |
|-------|-------------|-------------|
| Metadata | ~100 tokens | Startup (name + description for all skills) |
| Instructions | <5000 tokens recommended | When skill is activated |
| Resources | As needed | On demand (scripts/, references/, assets/) |

**Guidelines**:
- Keep main `SKILL.md` under 500 lines
- Move detailed reference material to separate files
- Keep file references one level deep from SKILL.md

### 4.3 File References

Use relative paths from the skill root:
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
- Supported languages depend on the agent (common: Python, Bash, JavaScript)

### 5.2 references/

Additional documentation loaded on demand:
- `REFERENCE.md` - detailed technical reference
- Domain-specific files (e.g., `FORMS.md`, `finance.md`)
- Keep individual files focused for efficient context usage

### 5.3 assets/

Static resources:
- Templates (document, configuration)
- Images (diagrams, examples)
- Data files (lookup tables, schemas)

---

## 6. OpenCode-Specific Behavior

### 6.1 Skill Tool

OpenCode exposes skills through a native `skill` tool. The agent sees available skills listed in the tool description:

```xml
<available_skills>
  <skill>
    <name>git-release</name>
    <description>Create consistent releases and changelogs</description>
  </skill>
</available_skills>
```

The agent loads a skill by calling:
```
skill({ name: "git-release" })
```

### 6.2 Permissions

Skills can be configured with pattern-based permissions in `opencode.json`:

```json
{
  "permission": {
    "skill": {
      "*": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

Permission values: `allow` (immediate), `deny` (hidden), `ask` (user prompted)

### 6.3 Per-Agent Overrides

Specific agents can have different skill permissions:

In agent frontmatter (markdown agents):
```yaml
---
permission:
  skill:
    "documents-*": "allow"
---
```

In `opencode.json` (built-in agents):
```json
{
  "agent": {
    "plan": {
      "permission": {
        "skill": {
          "internal-*": "allow"
        }
      }
    }
  }
}
```

### 6.4 Disabling Skills

For custom agents (markdown):
```yaml
---
tools:
  skill: false
---
```

For built-in agents (JSON):
```json
{
  "agent": {
    "plan": {
      "tools": {
        "skill": false
      }
    }
  }
}
```

---

## 7. Example Skills Analysis

### 7.1 Example: PDF Processing Skill

```yaml
---
name: pdf
description: Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text/tables from PDFs, combining or merging multiple PDFs into one, splitting PDFs apart, rotating pages, adding watermarks, creating new PDFs, filling PDF forms, encrypting/decrypting PDFs, extracting images, and OCR on scanned PDFs to make them searchable. If the user mentions a .pdf file or asks to produce one, use this skill.
license: Proprietary. LICENSE.txt has complete terms
---
```

**Patterns observed**:
- Long, keyword-rich description for maximum agent discoverability
- Lists specific trigger scenarios in the description
- License field references a bundled file
- No `compatibility` or `metadata` fields (minimal when not needed)
- Body contains structured Markdown with code examples, tables, and step-by-step guides
- Uses reference files (`REFERENCE.md`, `FORMS.md`) for progressive disclosure

### 7.2 Example: MCP Builder Skill

```yaml
---
name: mcp-builder
description: Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).
license: Complete terms in LICENSE.txt
---
```

**Patterns observed**:
- Description includes both "what" and "when to use"
- Targets specific technologies in description for discoverability
- Body organized with a phased approach (Research, Implementation, Review, Evaluations)
- Extensive use of reference files in `reference/` subdirectory
- Links to external resources (GitHub raw URLs for SDK docs)
- Structured with clear headings, code blocks, and tables

### 7.3 Example: Git Release Skill (from OpenCode docs)

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

**Patterns observed**:
- Demonstrates use of all optional fields
- Short, focused description
- `compatibility` set to target platform
- `metadata` used for audience and workflow categorization
- Body uses "What I do" and "When to use me" section pattern

### 7.4 Common Patterns Across Examples

1. **Description format**: Always describes what + when to use
2. **License pattern**: Either short name (`MIT`, `Apache-2.0`) or reference to file (`Complete terms in LICENSE.txt`)
3. **Body structure**: Typically starts with an overview/purpose section, followed by detailed instructions
4. **Progressive disclosure**: Complex skills split content into main SKILL.md + reference files
5. **No metadata required**: Most skills omit `metadata` unless there is specific categorization need
6. **Trigger keywords**: Descriptions include specific terms the agent should match against

---

## 8. Validation

### 8.1 Built-in Validation (Source Code)

From charmbracelet/crush `internal/skills/skills.go`:

```go
const (
    MaxNameLength          = 64
    MaxDescriptionLength   = 1024
    MaxCompatibilityLength = 500
)

var namePattern = regexp.MustCompile(`^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$`)
```

Validation checks:
1. `name` is required, max 64 chars, matches alphanumeric-with-hyphens pattern
2. `name` must match parent directory name (case-insensitive)
3. `description` is required, max 1024 chars
4. `compatibility` max 500 chars if provided
5. Frontmatter must start with `---\n` and have a closing `---`

### 8.2 CLI Validation

The agentskills.io spec provides a reference library:
```bash
skills-ref validate ./my-skill
```

### 8.3 Troubleshooting (OpenCode-specific)

If a skill doesn't show up:
- Verify `SKILL.md` is spelled in ALL CAPS
- Check that frontmatter includes both `name` and `description`
- Ensure skill names are unique across all discovery locations
- Check permissions (skills with `deny` are hidden from agents)

---

## 9. Spec Version and Currency

### 9.1 Version Information

- **Spec**: Agent Skills open standard (https://agentskills.io)
- **Spec origin**: Originally developed by Anthropic, released as open standard
- **Docs site version**: 0.0.2611 (Mintlify-hosted docs)
- **Docs last updated**: March 6, 2026
- **GitHub repo**: https://github.com/agentskills/agentskills (updated March 7, 2026)
- **OpenCode docs last updated**: March 6, 2026

### 9.2 No Formal Version Number

The Agent Skills specification does not use a formal semantic version. There is no version field in the spec itself. For embedded knowledge tracking, use the docs site last-updated date as the reference point.

**Recommended embedded version metadata**: `spec_version: "2026-03"` or `spec_last_verified: "2026-03-07"`

---

## 10. Gaps and Uncertainties

1. **`allowed-tools` field**: Marked as "Experimental" in the agentskills.io spec. Support varies between agent implementations. OpenCode's source code does not show explicit parsing of this field (it would be silently ignored as an unknown field).

2. **Name case sensitivity**: The agentskills.io spec requires lowercase (`^[a-z0-9]+(-[a-z0-9]+)*$`), but OpenCode's source code allows mixed case (`^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$`). For maximum portability, use lowercase only.

3. **Body content size limits**: The spec recommends <5000 tokens and <500 lines for the main SKILL.md body, but these are guidelines not enforced limits.

4. **Spec versioning**: No formal versioning scheme exists. The spec could change without a version bump. Dynamic fetching is important for staying current.

5. **`compatibility` field semantics**: The field is free-form text. There is no standard vocabulary for specifying product compatibility (e.g., "opencode", "claude-code"). Usage varies across examples.

6. **OpenCode repo transition**: The opencode-ai/opencode GitHub repo is archived. Development continues at charmbracelet/crush. Documentation at opencode.ai remains the authoritative source for OpenCode-specific behavior.
