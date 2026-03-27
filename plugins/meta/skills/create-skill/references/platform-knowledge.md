# GAS Platform Knowledge

Authoritative reference for the Generic Agent Skills (GAS) specification — the open standard for portable agent skills originally developed by Anthropic. This file merges shared format definitions with GAS-specific rules into a single reference.

## Version Metadata

- spec_version: "2026-03"
- spec_last_verified: "2026-03-07"
- source_url: https://agentskills.io/specification
- github_url: https://github.com/agentskills/agentskills
- docs_site_version: "0.0.2611"
- notes: GAS is the open standard for portable agent skills. No formal semantic versioning exists for the spec; use the docs-last-updated date as the reference point.

## File Structure

```
skill-name/
  SKILL.md          # Required — YAML frontmatter + Markdown instructions
  scripts/           # Optional — executable scripts the agent can run
  references/        # Optional — additional documentation loaded on demand
  assets/            # Optional — static resources (templates, images, data)
```

## SKILL.md Format

The file MUST contain YAML frontmatter delimited by `---` on its own line, followed by a Markdown body:

```markdown
---
name: skill-name
description: What this skill does and when to use it.
---

# Skill Title

Instructions in Markdown...
```

## Frontmatter Fields — Required

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | 1-64 chars; lowercase alphanumeric + hyphens; no leading, trailing, or consecutive hyphens; must match parent directory name | Unique identifier for the skill |
| `description` | string | 1-1024 chars; non-empty | What the skill does and when to use it; include keywords for agent discoverability |

**Name validation regex:** `^[a-z0-9]+(-[a-z0-9]+)*$`

## Frontmatter Fields — Optional

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `license` | string | No length limit specified | License name (e.g., `MIT`, `Apache-2.0`) or reference to bundled license file |
| `compatibility` | string | 1-500 chars if provided | Environment requirements — system packages, network access |
| `metadata` | map[string]string | String keys to string values | Arbitrary key-value pairs for additional properties (e.g., `author`, `version`, `audience`) |
| `allowed-tools` | string | Space-delimited tool names | Pre-approved tools the skill may use. **Experimental** — support varies by agent implementation |

**Unknown fields:** Any frontmatter fields not defined in the spec are silently ignored by all known implementations. This mechanism enables platform-specific extensions — implementations that do not understand a field simply skip it.

## Implementation-Specific Extension Fields

These fields are NOT part of the GAS core spec. They are used by specific agent implementations and silently ignored by others. They are safe to include without breaking cross-platform compatibility, but portable skills should avoid them to keep intent clear.

| Field | Type | Used By | Description |
|-------|------|---------|-------------|
| `argument-hint` | string | Claude Code | Display hint for skill arguments (e.g., `"[context-file-or-text]"`) |
| `user-invocable` | boolean | Claude Code | Whether users can invoke the skill directly |
| `disable-model-invocation` | boolean | Claude Code | When true, prevents autonomous model invocation |
| `arguments` | array of objects | Claude Code | Typed argument definitions with `name`, `description`, and `required` properties |

Since this skill always generates maximally portable output, extension fields are not included in generated skills. They are documented here for awareness when reading existing skills that use them.

## Portability Considerations

- Always use lowercase-only names — the spec requires it, even if some implementations tolerate mixed case
- Stick to core GAS fields (`name`, `description`, `license`, `compatibility`, `metadata`) for maximum portability
- Do not rely on `allowed-tools` for critical functionality — it is experimental and inconsistently supported
- Place skills in `.agents/skills/<name>/` for broadest cross-platform discovery
- Avoid platform-specific assumptions in the Markdown body (e.g., referencing specific tool names)

**Recommended discovery path:** `.agents/skills/<name>/SKILL.md` (the agent-agnostic standard path, recognized by Claude Code, OpenCode, and other compatible agents)

## File Naming Conventions

- The main file MUST be named `SKILL.md` (all uppercase)
- The parent directory name MUST match the `name` frontmatter field
- Directory names follow the same rules as the `name` field (lowercase alphanumeric + hyphens)

## Best Practices

### Description Quality

Write long, keyword-rich descriptions that list specific trigger scenarios. The description is the primary mechanism for agent discoverability across all implementations.

- Good: "Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction."
- Poor: "Helps with PDFs."

### Progressive Disclosure

Keep the main SKILL.md under 500 lines and under 5000 tokens. Move detailed reference material to `references/` files.

**Token budget tiers:**
- ~100 tokens for metadata (loaded at startup)
- <5000 tokens for instructions (loaded on activation)
- Reference/asset files loaded on demand

### Body Structure

Start with an overview/purpose section, then provide detailed step-by-step instructions. Use clear Markdown headings, code blocks, and tables.

### File References

Use relative paths from the skill root (e.g., `references/REFERENCE.md`, `scripts/extract.py`). Keep references one level deep from SKILL.md.

### Minimal Frontmatter

Only include optional fields when they add value. Most skills need only `name` and `description`.

- **License field**: Use a short identifier (`MIT`, `Apache-2.0`) or reference a bundled file
- **Metadata field**: Use for categorization when needed (e.g., `audience: maintainers`, `workflow: github`), but omit when there is no specific need

## Common Patterns in Well-Written Skills

1. Description always answers "what does it do" AND "when should the agent use it"
2. Body starts with a brief overview then moves to structured instructions
3. Complex skills use `references/` subdirectory for progressive disclosure
4. Scripts are self-contained with clear error messages
5. Token budget is respected across the three tiers (metadata, instructions, resources)
6. Only `name` and `description` in frontmatter unless optional fields add clear value

## Frontmatter Templates

**Minimal (most skills):**

```yaml
---
name: {normalized-skill-name}
description: {polished description with trigger keywords}
---
```

**With optional fields:**

```yaml
---
name: {normalized-skill-name}
description: {polished description with trigger keywords}
license: {license identifier or reference}
compatibility: {environment requirements}
metadata:
  {key}: "{value}"
---
```

## Name Normalization Procedure

If the user's name does not conform to the validation regex:

1. Convert to lowercase
2. Replace spaces and underscores with hyphens
3. Strip invalid characters (anything not `[a-z0-9-]`)
4. Collapse consecutive hyphens to single hyphens
5. Trim leading and trailing hyphens
6. Verify result is non-empty and 1-64 characters
7. Verify result matches parent directory name

## Description Generation Guidelines

The description must:

- Answer both "what does it do" AND "when should the agent use it"
- Include specific keywords and trigger phrases for agent discoverability
- Be 1-1024 characters
- If the outline description plus trigger scenarios exceeds 1024 characters, prioritize the core description and the most important trigger phrases; trim secondary details

## Rendering Rules — Portability

### Frontmatter Rules

- **Core fields only**: Use only core GAS fields (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`). Do not include implementation-specific extension fields.
- **Platform-agnostic compatibility**: When including the `compatibility` field, use platform-agnostic language (e.g., "Requires Python 3.10+" rather than "Requires OpenCode 1.2+").
- **allowed-tools caution**: If including `allowed-tools`, note that it is experimental and behavior varies across agent implementations.
- **Name must match directory**: The `name` field must match the parent directory name exactly. This is a GAS spec requirement critical for cross-platform discovery.

### Body Rules

- **Generic tool references**: Avoid referencing platform-specific tool names in the body. Write instructions using capability descriptions that any GAS-compliant agent can interpret:
  - Instead of "Use the `read` tool to read the file", write "Read the file contents"
  - Instead of "Use the `question` tool to prompt the user", write "Ask the user"
  - Instead of "Use `bash` to run the command", write "Execute the shell command"
- **No invocation assumptions**: Do not assume a specific invocation syntax or discovery path in the body content. These are platform-dependent.
- **No permission model assumptions**: Do not reference platform-specific permission models or sandbox restrictions. If the skill needs elevated permissions, describe the requirement generically (e.g., "This skill requires file system write access").
- **Tool integration patterns**: When the skill requires tool integrations, describe the capability needed (e.g., "Search the web for...") rather than naming specific tools.

## Generation Failure Handling

If generation fails at any point during the rendering process:

- **Frontmatter generation failure** (e.g., name cannot be normalized, description exceeds limits after trimming): Report the specific field and constraint that failed. Suggest a fix (e.g., "The skill name '{name}' contains characters that cannot be normalized to a valid GAS name. Please provide a name using only lowercase letters, numbers, and hyphens."). Collect corrected input and retry.
- **Body generation failure** (e.g., outline is too sparse to generate meaningful content): Report which outline sections lacked sufficient detail. Suggest returning to the interview (Stage 2) to gather more information, or proceeding with a simpler skill structure.
- **Content exceeds token budget**: Automatically restructure — move detailed sections to `references/` file pointers and note the reference files in the post-generation summary. Do not fail; adapt the output.

## Shared Validation Rules

Use these rules to validate any generated skill file.

### Required Fields Checklist

- [ ] `name` field is present and non-empty
- [ ] `name` is 1-64 characters
- [ ] `name` matches regex `^[a-z0-9]+(-[a-z0-9]+)*$`
- [ ] `name` matches the parent directory name
- [ ] `description` field is present and non-empty
- [ ] `description` is 1-1024 characters
- [ ] Frontmatter starts with `---` on its own line
- [ ] Frontmatter ends with `---` on its own line
- [ ] Markdown body follows the frontmatter

### Optional Field Constraints (validate only if present)

- [ ] `compatibility` is 1-500 characters
- [ ] `metadata` values are all strings (map[string]string)
- [ ] `allowed-tools` is a space-delimited string of tool names

### Format Constraints

- File must be named `SKILL.md` (all caps)
- File must reside in a directory whose name matches the `name` field
- YAML frontmatter must be valid YAML
- Body content must be valid Markdown

### Portability Checks

- [ ] Only core GAS fields are used in frontmatter
- [ ] Body content does not reference platform-specific tools by name
- [ ] Skill directory uses `.agents/skills/` path convention

### Description Quality (advisory, not failure)

- [ ] Description includes both "what the skill does" and "when to use it"
- [ ] Description includes specific keywords for agent discoverability

### Content Guidelines (advisory, not failure)

- [ ] SKILL.md body is under 500 lines
- [ ] Estimated token count is under 5000

## Common Mistakes to Avoid

- Using uppercase or mixed-case characters in `name` (use lowercase only)
- Starting or ending `name` with a hyphen
- Using consecutive hyphens (`--`) in `name`
- Mismatching the directory name and the `name` field
- Leaving `description` empty or too vague for agent discoverability
- Exceeding the 1024-character limit on `description`
- Exceeding the 500-character limit on `compatibility`
- Omitting frontmatter delimiters (`---`)
- Adding `allowed-tools` expecting it to work reliably across all implementations (it is experimental)
- Referencing platform-specific tool names in the body (reduces portability)

## Documentation Gaps

The following areas have limited or ambiguous documentation and may benefit from dynamic fetching:

- The `allowed-tools` field is experimental with no standard vocabulary of tool names; behavior varies between implementations
- The `compatibility` field has no standard vocabulary; values are conventions, not enforced or registered
- Body content size limits (500 lines, 5000 tokens) are guidelines, not enforced limits; real-world skills exceed them
- The spec has no formal versioning scheme; breaking changes could occur without a version bump
- Extension field behavior relies on the "silently ignored" convention; there is no formal extension mechanism or namespacing
- The `allowed-tools` format differs between spec (space-delimited string) and some implementations (YAML list); both are accepted in practice
