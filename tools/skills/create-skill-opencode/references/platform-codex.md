# Codex Platform Reference

Codex-specific additions to the shared format defined in [platform-base.md](platform-base.md). Codex implements the Agent Skills open standard and extends it with `agents/openai.yaml`.

## Version Metadata

- spec_version: "2026-03"
- spec_last_verified: "2026-03-07"
- source_url: https://developers.openai.com/codex/skills
- agent_skills_spec_url: https://agentskills.io/specification
- official_skills_repo: https://github.com/openai/skills
- notes: Codex implements the Agent Skills open standard (agentskills.io) for SKILL.md and extends it with a Codex-specific `agents/openai.yaml` file for UI metadata, invocation policy, and MCP tool dependencies. No formal semantic versioning exists for either the skill format or the openai.yaml schema; use docs-last-verified date as the reference point.

## File Structure Addition

Codex adds the `agents/` directory to the standard file structure:

```
skill-name/
  SKILL.md              # Required — YAML frontmatter + Markdown instructions
  agents/
    openai.yaml         # Recommended — Codex-specific UI metadata, invocation policy, and MCP tool dependencies
  scripts/              # Optional — executable scripts (Python, Bash, etc.) for deterministic tasks
  references/           # Optional — additional documentation loaded on demand
  assets/               # Optional — static resources (templates, icons, images, data)
```

The `agents/` directory is the Codex-specific extension. Other platforms ignore it.

## Codex Frontmatter Convention

**Minimal frontmatter only:** The Codex skill-creator explicitly instructs: "Do not include any other fields in YAML frontmatter" beyond `name` and `description`. Move all extended metadata to `agents/openai.yaml`.

**Quote all YAML string values** — Codex skills consistently quote string values in frontmatter.

**Frontmatter template:**

```yaml
---
name: "{normalized-skill-name}"
description: "{polished description with trigger keywords and scope boundaries}"
---
```

## Naming Conventions

From official Codex skills:
- Prefer short, verb-led phrases that describe the action (e.g., `fix-ci`, `plan-mode`)
- Namespace by tool when it improves clarity (e.g., `gh-fix-ci`, `gh-address-comments`)
- Normalize user-provided titles to hyphen-case (e.g., "Plan Mode" -> `plan-mode`)

## agents/openai.yaml Schema

### Interface Fields (all optional)

| Field | Description | Constraints |
|-------|-------------|-------------|
| `display_name` | Human-facing title shown in UI skill lists and chips | Quoted string |
| `short_description` | Short UI blurb for quick scanning | 25-64 chars |
| `icon_small` | Path to small icon asset (relative to skill dir) | Relative path, placed in `assets/` |
| `icon_large` | Path to larger logo asset (relative to skill dir) | Relative path, placed in `assets/` |
| `brand_color` | Hex color for UI accents (badges, chips) | Hex color string (e.g., `"#3B82F6"`) |
| `default_prompt` | Default prompt snippet inserted when invoking | Must mention skill as `$skill-name` |

### Policy Fields (all optional)

| Field | Default | Description |
|-------|---------|-------------|
| `allow_implicit_invocation` | `true` | When `false`, Codex won't implicitly invoke based on user prompt; explicit `$skill-name` invocation still works |

### Dependencies Fields (optional)

| Field | Description |
|-------|-------------|
| `tools[].type` | Dependency category; only `mcp` is currently supported |
| `tools[].value` | Identifier of the tool or dependency |
| `tools[].description` | Human-readable explanation of the dependency |
| `tools[].transport` | Connection type (e.g., `streamable_http`) |
| `tools[].url` | MCP server URL |

### YAML Formatting Rules

- Quote all string values
- Keep keys unquoted
- Use consistent indentation (2 spaces)

### Complete Template

```yaml
interface:
  display_name: "{Human-Facing Skill Title}"
  short_description: "{Brief UI blurb, 25-64 chars}"
  icon_small: "./assets/{name}-small.svg"
  icon_large: "./assets/{name}.png"
  brand_color: "#3B82F6"
  default_prompt: "Default prompt snippet; must mention skill as $skill-name"

policy:
  allow_implicit_invocation: true

dependencies:
  tools:
    - type: "mcp"
      value: "{tool-identifier}"
      description: "{Human-readable explanation}"
      transport: "streamable_http"
      url: "{mcp-server-url}"
```

### Minimal Template

```yaml
interface:
  display_name: "{Human-Facing Skill Title}"
  short_description: "{Brief UI blurb, 25-64 chars}"
```

## File Discovery Paths

Codex scans for skills in multiple scopes, from most specific to broadest:

| Scope | Location | Suggested Use |
|-------|----------|---------------|
| REPO (CWD) | `$CWD/.agents/skills/` | Skills for a specific module or microservice |
| REPO (parent) | `$CWD/../.agents/skills/` | Skills shared across sibling modules |
| REPO (root) | `$REPO_ROOT/.agents/skills/` | Organization-wide repo skills |
| USER | `$HOME/.agents/skills/` | Personal skills across all repos |
| ADMIN | `/etc/codex/skills/` | Machine/container-level default skills (unique to Codex) |
| SYSTEM | Bundled with Codex | OpenAI-provided skills (skill-creator, skill-installer, openai-docs) |

Codex uses `.agents/skills/` exclusively (not `.opencode/skills/` or `.claude/skills/`). Codex supports symlinked skill folders and scans every directory from CWD up to the git repository root. If two skills share the same `name`, Codex does NOT merge them; both appear in skill selectors.

## How Codex Differs

- Codex extends the Agent Skills standard with `agents/openai.yaml` — a Codex-specific file for UI metadata, invocation policy, and MCP tool dependencies. This extension has no equivalent in GAS or OpenCode.
- Codex uses `.agents/skills/` directory path exclusively; OpenCode supports multiple path patterns (`.opencode/`, `.claude/`, `.agents/`).
- Codex has an admin scope (`/etc/codex/skills/`) and system-bundled skills not found in GAS or OpenCode.
- Codex supports implicit invocation via description-based semantic matching; OpenCode uses explicit `skill()` tool calls.
- Codex uses `$skill-name` syntax for explicit invocation; OpenCode uses a `skill({ name: "..." })` tool call.
- Codex uses TOML config (`~/.codex/config.toml`); OpenCode uses JSON config (`opencode.json`).
- Codex enforces lowercase names (aligned with GAS spec); OpenCode's source allows mixed case.
- Codex has built-in skill management tools: `$skill-installer` (install from GitHub URLs) and `$skill-creator`.
- Codex supports MCP dependency declaration in `agents/openai.yaml`; OpenCode and GAS do not.

## Codex-Specific Best Practices

- **Description is the trigger**: Include all "when to use" information in the `description` field, not in the body. Codex's implicit invocation matches user prompts against descriptions.
  - Good: "Use when tasks involve reading, creating, or reviewing PDF files where rendering and layout matter; prefer visual checks by rendering pages (Poppler) and use Python tools such as `reportlab`, `pdfplumber`, and `pypdf` for generation and extraction."
  - Poor: "Helps with PDFs."
- **Scope boundaries**: Include explicit scope limits in the description (e.g., "Treat external providers as out of scope and report only the details URL").
- **Minimal frontmatter**: Only include `name` and `description` in YAML frontmatter. Move all other metadata to `agents/openai.yaml`.
- **Quoted YAML values**: Codex skills consistently quote string values in frontmatter.
- **Progressive disclosure**: Keep main SKILL.md under 500 lines and under 5000 tokens. Move detailed reference material to `references/` files. Only add context Codex doesn't already have.
- **Imperative writing style**: Use imperative/infinitive form (e.g., "Extract text" not "This skill extracts text"). Prefer concise examples over verbose explanations. Challenge each piece of information: "Does Codex really need this?"
- **Asset conventions**: Icons follow `./assets/{name}-small.svg` and `./assets/{name}.png` pattern.
- **No extraneous files**: Do NOT create README.md, INSTALLATION_GUIDE.md, QUICK_REFERENCE.md, or CHANGELOG.md. Only include files needed for the agent to do the job.

## Interview Questions

When the user selects Codex as the target platform, ask the shared questions from Category E plus these additional considerations:

**`agents/openai.yaml` configuration** — Does the skill need a Codex-specific `agents/openai.yaml` file? Nearly all curated Codex skills include one. Cover these sub-questions:
- **UI metadata** — Does the skill need a display name, short description, brand color, or icons for the Codex app UI? (Recommend yes for any skill that will appear in skill lists)
- **Invocation policy** — Should the skill be implicitly invocable (Codex auto-activates it based on the user's prompt), or should it require explicit `$skill-name` invocation only?
- **MCP tool dependencies** — Does the skill depend on any MCP (Model Context Protocol) servers or external tools that should be declared as dependencies?

**Codex execution model fit** — Codex runs tasks asynchronously in sandboxed environments. Does the skill's workflow fit this model, or does it assume interactive/synchronous execution? Surface this when the skill involves:
- Real-time user interaction during execution (Codex tasks run without live user input)
- Long-running processes or external service calls
- Access to resources outside the repository sandbox

**Codex-specific formatting preferences** — Codex conventions differ from GAS/OpenCode in key ways:
- Minimal frontmatter (only `name` and `description`; everything else goes in `agents/openai.yaml`)
- Quoted YAML string values
- Imperative writing style in the body ("Extract text" not "This skill extracts text")
- No extraneous files (no README.md, CHANGELOG.md, etc.)
- Confirm the user is comfortable with these conventions or has specific preferences

**Description-as-trigger optimization** — Codex uses the `description` field as the primary mechanism for implicit invocation. Does the user want help crafting a description optimized for Codex's semantic matching? Surface this as a recommendation, especially for skills that should be auto-activated.

*Prompt example:*
> A few questions about how your skill will work in Codex:
> 1. Should Codex automatically activate this skill when it recognizes a matching prompt, or should users need to type `$skill-name` to use it?
>    - **Automatic** — Codex decides when to use it based on my description (recommended for most skills)
>    - **Manual only** — Users must explicitly request it
> 2. Does your skill need any external tools or services? (e.g., an MCP server, API endpoint, database)
>    - Yes (describe which ones)
>    - No / Not sure
> 3. Will the skill instructions be short (under a page) or long and detailed?
>    - Short: everything goes in one file
>    - Long: we can split detailed references into separate files the agent loads on demand
> 4. Should this skill appear in the Codex app's skill list with a custom name, description, and color? Most Codex skills include an `agents/openai.yaml` for UI metadata and invocation policy.
>    - Yes — I'd like it to look polished in the UI
>    - No — keep it simple
> 5. Does the skill's workflow work in Codex's async sandbox model, or does it need live user interaction?

## Codex Rendering Specifics

### Frontmatter Rules

- Include only `name` and `description` in frontmatter
- Quote all YAML string values
- Include explicit scope boundaries in the description
- All trigger/invocation context goes in the description, not the body

### agents/openai.yaml Generation

**When to generate:**
- Always generate when the target platform is Codex — nearly all curated Codex skills include this file
- Include at minimum the `interface` section with `display_name` and `short_description`
- Add `dependencies` section only when the skill uses MCP tools
- Add `policy` section only when the skill should NOT be implicitly invocable (default is `true`)

**Interface section mapping:**

| Outline Data | openai.yaml Field | Mapping Notes |
|-------------|-------------------|---------------|
| Skill name (human-readable) | `display_name` | Title case, spaces allowed (e.g., "GitHub Fix CI") |
| Short summary | `short_description` | 25-64 characters; brief UI blurb for quick scanning |
| Asset references | `icon_small`, `icon_large` | Use `./assets/{name}-small.svg` and `./assets/{name}.png` pattern |
| Brand color (if specified) | `brand_color` | Hex color string (e.g., `"#3B82F6"`) |
| Primary use case | `default_prompt` | Must mention skill as `$skill-name`; describes the default action |

**Policy section:**
- Include `allow_implicit_invocation: false` only when the outline explicitly states the skill should require explicit invocation
- Omit the entire `policy` section when using defaults (implicit invocation is enabled by default)

**Dependencies section:**

If the outline or interview identified MCP tool dependencies:

```yaml
dependencies:
  tools:
    - type: "mcp"
      value: "{tool-identifier}"
      description: "{human-readable explanation}"
      transport: "streamable_http"
      url: "{mcp-server-url}"
```

- Only `type: "mcp"` is currently supported
- Include all MCP tools the skill depends on
- If the skill uses external APIs but not through MCP, do not add them to dependencies — mention them in the body's Prerequisites section instead

### Complexity Adaptation

**Key difference from OpenCode:** Codex always uses minimal frontmatter regardless of complexity. All additional metadata goes to `agents/openai.yaml`. The agents/openai.yaml file grows with complexity, not the frontmatter.

**Simple skills:**
- agents/openai.yaml: `interface` section only (`display_name` + `short_description`)
- No reference files, no scripts

**Moderate skills:**
- agents/openai.yaml: `interface` section, possibly `dependencies` if MCP tools are used
- May include reference file pointers if content is substantial

**Complex skills:**
- agents/openai.yaml: full `interface`, `policy` (if non-default), and `dependencies` sections
- Likely references `references/` files for progressive disclosure
- May include `scripts/` for deterministic tasks

## Output Path Prompts

Present the output path selection using `question` with structured options:

```
question:
  header: "Output Path"
  text: "Where should I save the skill? It will be written as {skill-name}/SKILL.md (and {skill-name}/agents/openai.yaml if configured) inside the directory you choose."
  options:
    - label: "~/.agents/skills — Available globally for all your projects (Recommended)"
    - label: ".agents/skills — Available only in this project"
    - label: "$REPO_ROOT/.agents/skills — Available at the repository root for all modules"
  custom: true
```

**Default path:** `~/.agents/skills`

## Codex-Specific Validation Rules

In addition to the shared rules in platform-base.md, validate:

### Frontmatter Convention

- [ ] Frontmatter contains only `name` and `description` — if extra fields are present (beyond `license`), warn that Codex convention is to move metadata to `agents/openai.yaml`
- [ ] YAML string values are quoted (Codex convention)

### Description Quality (advisory, not failure)

- [ ] Description includes both "what the skill does" and "when to use it" with explicit scope boundaries
- [ ] All trigger/invocation context is in the description, not in the body

### agents/openai.yaml Validation (validate only if generated)

- [ ] File is valid YAML
- [ ] All string values are quoted
- [ ] `interface.short_description` is 25-64 characters if provided
- [ ] `interface.icon_small` and `interface.icon_large` are relative paths if provided
- [ ] `interface.brand_color` is a valid hex color string (e.g., `"#3B82F6"`) if provided
- [ ] `interface.default_prompt` mentions the skill as `$skill-name` if provided
- [ ] `policy.allow_implicit_invocation` is a boolean if provided
- [ ] `dependencies.tools[].type` is `"mcp"` (only supported type) if provided
- [ ] `dependencies.tools[].url` is a valid URL if type is `"mcp"`

### Content Guidelines (advisory, not failure)

- [ ] SKILL.md body is under 500 lines
- [ ] Estimated token count is under 5000
- [ ] No extraneous files suggested (README.md, CHANGELOG.md, etc.)

### Codex-Specific Auto-Fix Entries

| Issue | Auto-Fix | Re-validation Check |
|-------|----------|-------------------|
| Unquoted YAML string values | Add double quotes around string values in frontmatter | Confirm YAML still parses correctly |
| `default_prompt` missing `$skill-name` | Append ` Use $skill-name.` to the default_prompt | Confirm the `$skill-name` reference is present |

## Documentation Gaps

The following areas have limited or ambiguous documentation and may benefit from dynamic fetching:

- The `agents/openai.yaml` schema is not versioned and is documented only through examples and the skill-creator's reference file; it may evolve without notice
- The `allowed-tools` field is experimental and not actively used by Codex; the skill-creator instructs to not include it
- The `metadata` field usage is transitional — some skills use `metadata.short-description` in frontmatter, but the preferred approach is `agents/openai.yaml` `interface.short_description`
- The implicit invocation algorithm (how Codex matches prompts to descriptions) is opaque; thresholds and ranking logic are undocumented
- It is unclear whether Codex blocks skill execution if declared MCP dependencies are unavailable or lets the skill handle the failure
- The `/etc/codex/skills/` admin path availability may depend on installation method and platform
- The Codex skills documentation is actively evolving; features marked as "experimental" may change substantially
