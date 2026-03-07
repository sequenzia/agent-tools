# Codex Skill Specification Research

**Researched**: 2026-03-07
**Sources**: https://developers.openai.com/codex/skills, https://agentskills.io/specification, https://github.com/openai/skills (OpenAI official skills repo), OpenAI skill-creator system skill
**Spec Version**: Agent Skills open standard (agentskills.io); Codex extends with `agents/openai.yaml` for product-specific metadata. No formal Codex skill spec version number; documentation current as of March 2026.

---

## 1. Overview

Codex (OpenAI's coding agent) implements the **Agent Skills open standard** defined at https://agentskills.io. The core skill format uses a `SKILL.md` file containing YAML frontmatter followed by Markdown instructions — identical to the format used by OpenCode and Claude Code.

Key insight: Codex does NOT define a proprietary skill file format. It adopts the Agent Skills spec for `SKILL.md` and **extends** it with a Codex-specific `agents/openai.yaml` file for UI metadata, invocation policy, and tool dependencies. This extension file is product-specific and is read by the Codex harness, not by the agent itself.

Codex is available as a CLI, IDE extension, and cloud-hosted app. Skills work across all three surfaces.

---

## 2. File Format and Structure

### 2.1 Directory Structure

A skill is a directory containing at minimum a `SKILL.md` file:

```
skill-name/
  SKILL.md              # Required - frontmatter + instructions
  agents/
    openai.yaml         # Recommended - Codex-specific UI metadata and dependencies
  scripts/              # Optional - executable code (Python, Bash, etc.)
  references/           # Optional - documentation loaded on demand
  assets/               # Optional - static resources (templates, icons, images, data)
```

The `agents/` directory is the Codex-specific extension. Other platforms ignore it. The `agents/openai.yaml` file provides UI-facing metadata for skill lists and chips in the Codex app.

### 2.2 SKILL.md Format

The file must contain:
1. **YAML frontmatter** - delimited by `---` on its own line
2. **Markdown body** - instructions for the agent

```markdown
---
name: skill-name
description: Explain exactly when this skill should and should not trigger.
---

Skill instructions for Codex to follow.
```

### 2.3 File Discovery Paths (Codex-specific)

Codex scans for skills in multiple scopes, from most specific to broadest:

| Scope | Location | Suggested Use |
|-------|----------|---------------|
| REPO (CWD) | `$CWD/.agents/skills/` | Skills for a specific module or microservice |
| REPO (parent) | `$CWD/../.agents/skills/` | Skills shared across sibling modules |
| REPO (root) | `$REPO_ROOT/.agents/skills/` | Organization-wide repo skills |
| USER | `$HOME/.agents/skills/` | Personal skills across all repos |
| ADMIN | `/etc/codex/skills/` | Machine/container-level default skills |
| SYSTEM | Bundled with Codex | OpenAI-provided skills (skill-creator, skill-installer, openai-docs) |

Key differences from OpenCode/GAS:
- Codex uses `.agents/skills/` directory path (not `.claude/skills/` or `.opencode/skills/`)
- Codex supports symlinked skill folders and follows symlink targets
- Codex scans every directory from CWD up to the git repository root
- If two skills share the same `name`, Codex does NOT merge them; both appear in skill selectors
- ADMIN scope (`/etc/codex/skills/`) is unique to Codex for enterprise/container deployments

---

## 3. Frontmatter Fields

### 3.1 Required Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | 1-64 chars, lowercase alphanumeric + hyphens, no leading/trailing/consecutive hyphens, must match parent directory name | Unique identifier for the skill |
| `description` | string | 1-1024 chars, non-empty | What the skill does and when to use it. Primary triggering mechanism for implicit invocation |

These are the **only** fields Codex reads from SKILL.md frontmatter for skill discovery and triggering. The `description` field is especially critical in Codex because it powers implicit invocation — Codex matches user prompts against skill descriptions to decide which skill to activate.

### 3.2 Optional Fields (per Agent Skills spec)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `license` | string | No length limit specified | License name or reference to bundled license file |
| `compatibility` | string | 1-500 chars if provided | Environment requirements (target product, system packages, network access) |
| `metadata` | map[string]string | String keys to string values | Arbitrary key-value pairs for additional properties |
| `allowed-tools` | string | Space-delimited | Pre-approved tools the skill may use (Experimental; support varies) |

### 3.3 Codex Frontmatter Convention

Based on analysis of the official OpenAI skills repository, Codex skills in practice use a minimal frontmatter approach:

- **Always include**: `name` and `description` (required)
- **Often include**: `metadata` with `short-description` key
- **Sometimes include**: `license` (usually referencing a `LICENSE.txt` file)
- **Rarely include**: `compatibility`, `allowed-tools`

The Codex skill-creator system skill explicitly instructs: "Do not include any other fields in YAML frontmatter" beyond `name` and `description`. This is the strongest official guidance — Codex prefers minimal frontmatter with extended metadata moved to `agents/openai.yaml`.

### 3.4 Name Validation Rules

- Must be 1-64 characters
- Lowercase letters, numbers, and hyphens only
- Must not start or end with `-`
- Must not contain consecutive hyphens (`--`)
- Must match the parent directory name
- Regex: `^[a-z0-9]+(-[a-z0-9]+)*$`

Naming conventions observed in official Codex skills:
- Prefer short, verb-led phrases that describe the action
- Namespace by tool when it improves clarity (e.g., `gh-fix-ci`, `gh-address-comments`)
- Normalize user-provided titles to hyphen-case (e.g., "Plan Mode" -> `plan-mode`)

### 3.5 Description Best Practices

Codex descriptions are the primary triggering mechanism for implicit invocation. Best practices:

- Include both what the skill does AND specific triggers/contexts for when to use it
- Include all "when to use" information in the description, not in the body
- Write descriptions with clear scope and boundaries
- Include specific keywords that help Codex identify relevant tasks

Good example:
```yaml
description: "Use when tasks involve reading, creating, or reviewing PDF files where rendering and layout matter; prefer visual checks by rendering pages (Poppler) and use Python tools such as `reportlab`, `pdfplumber`, and `pypdf` for generation and extraction."
```

Poor example:
```yaml
description: "Helps with PDFs."
```

### 3.6 Unknown Fields

Unknown frontmatter fields are silently ignored (consistent with Agent Skills spec behavior).

---

## 4. Codex-Specific Extension: agents/openai.yaml

This is the key differentiator for Codex skills. The `agents/openai.yaml` file provides product-specific metadata that the Codex harness reads (not the agent).

### 4.1 Full Schema

```yaml
interface:
  display_name: "Optional user-facing name"
  short_description: "Optional user-facing description"
  icon_small: "./assets/small-logo.svg"
  icon_large: "./assets/large-logo.png"
  brand_color: "#3B82F6"
  default_prompt: "Optional surrounding prompt to use the skill with"

policy:
  allow_implicit_invocation: false

dependencies:
  tools:
    - type: "mcp"
      value: "openaiDeveloperDocs"
      description: "OpenAI Docs MCP server"
      transport: "streamable_http"
      url: "https://developers.openai.com/mcp"
```

### 4.2 Interface Fields

| Field | Description | Constraints |
|-------|-------------|-------------|
| `display_name` | Human-facing title shown in UI skill lists and chips | String, quoted |
| `short_description` | Short UI blurb for quick scanning | 25-64 chars |
| `icon_small` | Path to small icon asset (relative to skill dir) | Relative path, placed in `assets/` |
| `icon_large` | Path to larger logo asset (relative to skill dir) | Relative path, placed in `assets/` |
| `brand_color` | Hex color used for UI accents (badges, etc.) | Hex color string (e.g., `"#3B82F6"`) |
| `default_prompt` | Default prompt snippet inserted when invoking the skill | Must mention skill as `$skill-name` |

### 4.3 Policy Fields

| Field | Default | Description |
|-------|---------|-------------|
| `allow_implicit_invocation` | `true` | When `false`, Codex won't implicitly invoke the skill based on user prompt; explicit `$skill` invocation still works |

### 4.4 Dependencies Fields

| Field | Description |
|-------|-------------|
| `tools[].type` | Dependency category. Only `mcp` is supported currently |
| `tools[].value` | Identifier of the tool or dependency |
| `tools[].description` | Human-readable explanation of the dependency |
| `tools[].transport` | Connection type when `type` is `mcp` (e.g., `streamable_http`) |
| `tools[].url` | MCP server URL when `type` is `mcp` |

### 4.5 YAML Formatting Rules

- Quote all string values
- Keep keys unquoted
- For `default_prompt`: must explicitly mention the skill as `$skill-name`

---

## 5. Body Content

The Markdown body after the frontmatter contains the skill instructions. There are no format restrictions on the body content.

### 5.1 Progressive Disclosure

Skills use a three-level loading system to manage context efficiently:

| Level | Token Budget | When Loaded |
|-------|-------------|-------------|
| Metadata | ~100 tokens | Startup (name + description + file path + optional openai.yaml metadata for all skills) |
| Instructions | <5000 tokens recommended | When skill is activated |
| Resources | As needed | On demand (scripts/, references/, assets/) |

**Guidelines**:
- Keep main `SKILL.md` under 500 lines
- Move detailed reference material to separate files
- Keep file references one level deep from SKILL.md
- For files longer than 100 lines, include a table of contents at the top
- Only add context Codex doesn't already have (Codex is already a capable model)

### 5.2 Recommended Body Structure

Based on official Codex skills, the body typically follows this pattern:

1. **Title** — `# Skill Name`
2. **Overview/Quick Start** — Brief description of what the skill does
3. **Prerequisites** — Required tools, authentication, or setup
4. **Workflow** — Step-by-step instructions (imperative/infinitive form)
5. **References** — Links to reference files for advanced features
6. **Tips/Troubleshooting** — Common issues and solutions

### 5.3 Writing Guidelines

- Use imperative/infinitive form (e.g., "Extract text" not "This skill extracts text")
- Prefer concise examples over verbose explanations
- Challenge each piece of information: "Does Codex really need this?"
- Only add context Codex doesn't already have
- Include information that is beneficial and non-obvious to the model

### 5.4 What Not to Include

Do NOT create extraneous files:
- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md

The skill should only contain files needed for the agent to do the job.

---

## 6. Optional Directories

### 6.1 scripts/

Executable code (Python, Bash, etc.) for tasks that require deterministic reliability or are repeatedly rewritten.

- **When to include**: When the same code is being rewritten repeatedly or deterministic reliability is needed
- Should be self-contained or clearly document dependencies
- Should include helpful error messages
- Should handle edge cases gracefully
- Scripts may be executed without being loaded into context (token efficient)

### 6.2 references/

Documentation and reference material intended to be loaded as needed into context.

- Keep individual files focused for efficient context usage
- If files are large (>10k words), include grep search patterns in SKILL.md
- Avoid duplication between SKILL.md and reference files
- Information should live in either SKILL.md or references files, not both

### 6.3 assets/

Files not intended to be loaded into context, used in the output Codex produces.

- Templates, images, icons, boilerplate code, fonts, sample documents
- UI assets for `agents/openai.yaml` (icon_small, icon_large)
- Separates output resources from documentation

---

## 7. Codex-Specific Behavior

### 7.1 Skill Invocation

Codex activates skills in two ways:

1. **Explicit invocation**: Include the skill directly in a prompt. In CLI/IDE, run `/skills` or type `$` to mention a skill (e.g., `$linear`)
2. **Implicit invocation**: Codex automatically chooses a skill when the user's task matches the skill's `description` field

The `$` prefix is the Codex convention for mentioning skills in prompts.

### 7.2 Skill Installation

Codex provides a built-in `$skill-installer` system skill:
```
$skill-installer linear
$skill-installer install the create-plan skill from the .experimental folder
$skill-installer install https://github.com/openai/skills/tree/main/skills/.experimental/create-plan
```

Codex detects newly installed skills automatically; restart may be needed if one doesn't appear.

### 7.3 Skill Configuration

Enable/disable skills via `~/.codex/config.toml`:

```toml
[[skills.config]]
path = "/path/to/skill/SKILL.md"
enabled = false
```

Restart Codex after changing config.

### 7.4 Skill Creator

Codex bundles a `$skill-creator` system skill that guides users through creating new skills. It asks what the skill does, when it should trigger, and whether it should include scripts. Instruction-only is the default.

### 7.5 Auto-Detection

Codex detects skill changes automatically without restart in most cases. If an update doesn't appear, restart Codex.

---

## 8. Example Skills Analysis

### 8.1 Example: Linear Integration Skill

```yaml
---
name: linear
description: Manage issues, projects & team workflows in Linear. Use when the user wants to read, create or updates tickets in Linear.
metadata:
  short-description: Manage Linear issues in Codex
---
```

With `agents/openai.yaml`:
```yaml
interface:
  display_name: "Linear"
  short_description: "Manage Linear issues in Codex"
  icon_small: "./assets/linear-small.svg"
  icon_large: "./assets/linear.png"
  default_prompt: "Use Linear context to triage or update relevant issues for this task, with clear next actions."

dependencies:
  tools:
    - type: "mcp"
      value: "linear"
      description: "Linear MCP server"
      transport: "streamable_http"
      url: "https://mcp.linear.app/mcp"
```

**Patterns observed**:
- Description includes what + when to use
- Uses `metadata.short-description` in frontmatter (mirrors openai.yaml `short_description`)
- MCP tool dependency declared in `agents/openai.yaml`
- Body follows: Overview -> Prerequisites -> Required Workflow (ordered steps) -> Available Tools -> Practical Workflows -> Tips -> Troubleshooting
- Extensive workflow guidance with imperative steps

### 8.2 Example: GitHub Fix CI Skill

```yaml
---
name: "gh-fix-ci"
description: "Use when a user asks to debug or fix failing GitHub PR checks that run in GitHub Actions; use `gh` to inspect checks and logs, summarize failure context, draft a fix plan, and implement only after explicit approval. Treat external providers (for example Buildkite) as out of scope and report only the details URL."
---
```

With `agents/openai.yaml`:
```yaml
interface:
  display_name: "GitHub Fix CI"
  short_description: "Debug failing GitHub Actions CI"
  icon_small: "./assets/github-small.svg"
  icon_large: "./assets/github.png"
  default_prompt: "Inspect failing GitHub Actions checks in this repo, summarize root cause, and propose a focused fix plan."
```

**Patterns observed**:
- Name uses namespace prefix (`gh-`) for tool clarity
- Very detailed description with explicit scope boundaries ("Treat external providers... as out of scope")
- No `metadata` or `license` in frontmatter (minimal approach)
- Body follows: Overview -> Inputs -> Quick start -> Workflow (numbered steps) -> Bundled Resources
- References a bundled Python script for deterministic behavior
- Description values are quoted in YAML (Codex convention)

### 8.3 Example: Sentry Observability Skill

```yaml
---
name: "sentry"
description: "Use when the user asks to inspect Sentry issues or events, summarize recent production errors, or pull basic Sentry health data via the Sentry API; perform read-only queries with the bundled script and require `SENTRY_AUTH_TOKEN`."
---
```

With `agents/openai.yaml`:
```yaml
interface:
  display_name: "Sentry (Read-only Observability)"
  short_description: "Read-only Sentry observability"
  icon_small: "./assets/sentry-small.svg"
  icon_large: "./assets/sentry.png"
  default_prompt: "Investigate this issue in read-only Sentry data and report likely root cause, impact, and next steps."
```

**Patterns observed**:
- Description mentions explicit capabilities ("read-only queries") and requirements ("require `SENTRY_AUTH_TOKEN`")
- Has scripts/ directory for bundled Python tooling
- Body starts with Quick start then detailed workflow
- Uses env var configuration pattern

### 8.4 Common Patterns Across Codex Skills

1. **Minimal frontmatter**: Only `name` and `description` are standard; `metadata.short-description` is occasionally used
2. **Description is the trigger**: All "when to use" information lives in the description, never in the body
3. **Quoted YAML values**: Codex skills consistently quote string values in frontmatter
4. **agents/openai.yaml is standard**: Nearly all curated skills include this extension file
5. **Asset structure**: Icons follow `./assets/{name}-small.svg` and `./assets/{name}.png` pattern
6. **Imperative writing style**: Instructions use imperative/infinitive form
7. **Scope boundaries**: Descriptions include explicit scope limits ("Use when X", "Treat Y as out of scope")
8. **Progressive disclosure**: Complex skills split into SKILL.md + references/ with clear navigation
9. **LICENSE.txt file**: License terms bundled as a separate file, not embedded in frontmatter

---

## 9. Differences from OpenCode and GAS Formats

### 9.1 Comparison Table

| Feature | Agent Skills (GAS) | OpenCode | Codex |
|---------|-------------------|----------|-------|
| Core file | `SKILL.md` | `SKILL.md` | `SKILL.md` |
| Frontmatter format | YAML | YAML | YAML |
| Required fields | `name`, `description` | `name`, `description` | `name`, `description` |
| Extension metadata | None | None | `agents/openai.yaml` |
| Skill directory path | `.agents/skills/` | `.opencode/skills/`, `.claude/skills/`, `.agents/skills/` | `.agents/skills/` |
| Global path | `~/.agents/skills/` | `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/` | `$HOME/.agents/skills/` |
| Admin/system path | Not defined | Not defined | `/etc/codex/skills/` (admin), bundled (system) |
| Skill invocation | Platform-dependent | `skill({ name: "..." })` tool | `$skill-name` prefix or implicit |
| Implicit invocation | Platform-dependent | Not documented | Yes, description-based matching |
| Invocation control | Not specified | Permission system (`allow`/`deny`/`ask`) | `allow_implicit_invocation` in openai.yaml |
| MCP dependency declaration | Not specified | Not specified | `dependencies.tools` in openai.yaml |
| UI metadata | Not specified | Not specified | `interface` block in openai.yaml |
| Config file | Not specified | `opencode.json` | `~/.codex/config.toml` (TOML) |
| Name validation regex | `^[a-z0-9]+(-[a-z0-9]+)*$` | `^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$` (allows mixed case) | `^[a-z0-9]+(-[a-z0-9]+)*$` |
| Skill installer | Not specified | Not specified | Built-in `$skill-installer` |
| Skill creator | Not specified | Not specified | Built-in `$skill-creator` |
| Permission system | Not specified | Pattern-based in `opencode.json` | TOML-based enable/disable + rules system |

### 9.2 Key Differences

**Codex vs. GAS (Agent Skills spec)**:
- Codex extends GAS with `agents/openai.yaml` for UI metadata, invocation policy, and tool dependencies
- Codex adds admin and system skill scopes not in GAS
- Codex has built-in skill management tools (installer, creator)
- Codex uses `.agents/skills/` path (aligned with GAS standard)
- Codex prefers minimal frontmatter (only `name` + `description`), moving extras to openai.yaml

**Codex vs. OpenCode**:
- Codex uses `agents/openai.yaml` for metadata; OpenCode uses optional frontmatter fields
- Codex uses `.agents/skills/` exclusively; OpenCode supports multiple path patterns (`.opencode/`, `.claude/`, `.agents/`)
- Codex uses TOML config (`~/.codex/config.toml`); OpenCode uses JSON config (`opencode.json`)
- Codex enforces lowercase names (aligned with GAS spec); OpenCode's source allows mixed case
- Codex has explicit implicit invocation control; OpenCode uses permission-based skill access
- Codex has `$skill-name` syntax for explicit invocation; OpenCode uses a `skill()` tool call
- Codex supports MCP dependency declaration in openai.yaml; OpenCode does not

**Codex vs. Both**:
- The `agents/openai.yaml` extension is entirely Codex-specific and has no equivalent in GAS or OpenCode
- Codex's admin scope (`/etc/codex/skills/`) and system-bundled skills are unique
- Codex's `$skill-installer` can install skills from GitHub URLs, a feature not present elsewhere

---

## 10. Validation

### 10.1 Codex Validation

Codex provides a validation script via the skill-creator system skill:

```bash
scripts/quick_validate.py <path/to/skill-folder>
```

This checks:
- YAML frontmatter format
- Required fields present
- Naming rules compliance

### 10.2 Agent Skills Reference Validation

The agentskills.io spec provides a reference library:
```bash
skills-ref validate ./my-skill
```

### 10.3 Troubleshooting

If a skill doesn't show up in Codex:
- Verify `SKILL.md` is spelled in ALL CAPS
- Check that frontmatter includes both `name` and `description`
- Ensure skill directory name matches the `name` field
- Check `~/.codex/config.toml` for `enabled = false` entries
- Try restarting Codex

---

## 11. Spec Version and Currency

### 11.1 Version Information

- **Core spec**: Agent Skills open standard (https://agentskills.io)
- **Codex extension**: `agents/openai.yaml` (no formal spec version)
- **Codex documentation**: https://developers.openai.com/codex/skills
- **Official skills repo**: https://github.com/openai/skills
- **Skills repo categories**: `.system/` (bundled), `.curated/` (installable), `.experimental/` (community)
- **Current Codex model**: GPT-5.4 (latest as of docs)
- **Docs last verified**: March 7, 2026

### 11.2 No Formal Version Number

Like the Agent Skills spec, Codex does not assign a formal version number to its skill format or the `agents/openai.yaml` schema. The Codex documentation states "Skills are experimental and may change" for features like rules.

**Recommended embedded version metadata**: `spec_version: "2026-03"` or `spec_last_verified: "2026-03-07"`

---

## 12. Gaps and Uncertainties

1. **`agents/openai.yaml` schema stability**: The openai.yaml format is not versioned and is documented only through examples and the skill-creator's reference file. It may evolve without notice.

2. **`allowed-tools` field**: Marked as "Experimental" in the agentskills.io spec. Codex's support for this field is not explicitly documented. The skill-creator instructs to not include any other fields beyond `name` and `description`, suggesting `allowed-tools` is not actively used.

3. **`metadata` field usage**: While the GAS spec defines `metadata` as a `map[string]string`, some Codex skills use `metadata.short-description` in frontmatter. This appears to be a legacy or transitional pattern — the preferred approach is to use `agents/openai.yaml` `interface.short_description` instead.

4. **Implicit invocation algorithm**: The exact algorithm Codex uses to match user prompts against skill descriptions is not documented. It appears to be semantic matching but the thresholds and ranking logic are opaque.

5. **`dependencies.tools` enforcement**: It is unclear whether Codex blocks skill execution if declared MCP dependencies are unavailable, or if it proceeds and lets the skill handle the failure.

6. **Admin scope availability**: The `/etc/codex/skills/` admin path is documented but its availability may depend on the Codex installation method and platform.

7. **Config format (TOML vs JSON)**: Codex uses TOML for configuration (`~/.codex/config.toml`) while OpenCode uses JSON (`opencode.json`). This creates a platform-specific configuration surface that skills themselves don't control.

8. **Spec evolution pace**: The Codex skills documentation is actively evolving. Features marked as "experimental" (rules, some tool integrations) may change substantially.
