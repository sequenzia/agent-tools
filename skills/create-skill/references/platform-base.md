# Platform Base Reference

Shared format, fields, validation rules, and best practices common to all supported platforms (OpenCode, GAS, Codex). Platform-specific additions are in separate reference files.

## File Structure

```
skill-name/
  SKILL.md          # Required — YAML frontmatter + Markdown instructions
  scripts/           # Optional — executable scripts the agent can run
  references/        # Optional — additional documentation loaded on demand
  assets/            # Optional — static resources (templates, images, data)
```

Note: Codex adds an `agents/` directory — see platform-codex.md for details.

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
| `license` | string | No length limit specified | License name (e.g., `MIT`, `Apache-2.0`) or reference to bundled license file (e.g., `Complete terms in LICENSE.txt`) |
| `compatibility` | string | 1-500 chars if provided | Environment requirements — target product, system packages, network access |
| `metadata` | map[string]string | String keys to string values | Arbitrary key-value pairs for additional properties (e.g., `author`, `version`, `audience`) |
| `allowed-tools` | string | Space-delimited tool names | Pre-approved tools the skill may use. **Experimental** — support varies by agent implementation |

**Unknown fields:** Any frontmatter fields not defined in the spec are silently ignored by all known implementations. This mechanism enables platform-specific extensions — implementations that do not understand a field simply skip it.

## File Naming Conventions

- The main file MUST be named `SKILL.md` (all uppercase)
- The parent directory name MUST match the `name` frontmatter field
- Directory names follow the same rules as the `name` field (lowercase alphanumeric + hyphens)

## Best Practices

### Description Quality

Write long, keyword-rich descriptions that list specific trigger scenarios. The description is the primary mechanism for agent discoverability across all platforms.

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

- **License field**: Use a short identifier (`MIT`, `Apache-2.0`) or reference a bundled file (`Complete terms in LICENSE.txt`)
- **Metadata field**: Use for categorization when needed (e.g., `audience: maintainers`, `workflow: github`), but omit when there is no specific need

## Common Patterns in Well-Written Skills

1. Description always answers "what does it do" AND "when should the agent use it"
2. Body starts with a brief overview then moves to structured instructions
3. Complex skills use `references/` subdirectory for progressive disclosure
4. Scripts are self-contained with clear error messages
5. Token budget is respected across the three tiers (metadata, instructions, resources)
6. Only `name` and `description` in frontmatter unless optional fields add clear value

## Shared Validation Rules

Use these rules to validate any generated skill file, regardless of target platform.

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

## Common Mistakes to Avoid

- Using uppercase or mixed-case characters in `name` (use lowercase only)
- Starting or ending `name` with a hyphen
- Using consecutive hyphens (`--`) in `name`
- Mismatching the directory name and the `name` field
- Leaving `description` empty or too vague for agent discoverability
- Exceeding the 1024-character limit on `description`
- Exceeding the 500-character limit on `compatibility`
- Omitting frontmatter delimiters (`---`)
- Adding `allowed-tools` expecting it to work reliably across all platforms (it is experimental)

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
allowed-tools: {space-delimited tool names}
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
