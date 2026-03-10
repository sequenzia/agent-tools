# GAS Platform Reference

GAS-specific additions to the shared format defined in [platform-base.md](platform-base.md). GAS is the open standard for portable agent skills, originally developed by Anthropic.

## Version Metadata

- spec_version: "2026-03"
- spec_last_verified: "2026-03-07"
- source_url: https://agentskills.io/specification
- github_url: https://github.com/agentskills/agentskills
- docs_site_version: "0.0.2611"
- notes: GAS is the open standard for portable agent skills. No formal semantic versioning exists for the spec; use the docs-last-updated date as the reference point.

## Implementation-Specific Extension Fields

These fields are NOT part of the GAS core spec. They are used by specific agent implementations and are silently ignored by implementations that do not recognize them. They are safe to include without breaking cross-platform compatibility.

| Field | Type | Used By | Description |
|-------|------|---------|-------------|
| `argument-hint` | string | Claude Code | Display hint for skill arguments (e.g., `"[context-file-or-text]"`) |
| `user-invocable` | boolean | Claude Code | Whether users can invoke the skill directly (vs. only agent-invocable) |
| `disable-model-invocation` | boolean | Claude Code | When true, prevents the model from invoking the skill autonomously |
| `arguments` | array of objects | Claude Code | Typed argument definitions with `name`, `description`, and `required` properties |

## How GAS Differs from OpenCode and Codex

- GAS is the base open standard; OpenCode adopts it directly, so GAS and OpenCode skills are structurally identical
- GAS skills are inherently portable across all compliant agent implementations (Claude Code, OpenCode/Crush, and any future adopters)
- Codex does NOT implement the GAS standard; cross-compatibility with Codex requires format translation, not just field mapping
- GAS defines only the file format and metadata schema; invocation mechanisms, permission models, and discovery paths are platform-dependent
- Extension fields (like Claude Code's `arguments`) coexist safely with core fields — unknown fields are silently ignored

## Portability Considerations

- Always use lowercase-only names — the spec requires it, even if some implementations tolerate mixed case
- Stick to core GAS fields (`name`, `description`, `license`, `compatibility`, `metadata`) for maximum portability
- Extension fields are safe to include — they are silently ignored by non-supporting implementations
- Do not rely on `allowed-tools` for critical functionality — it is experimental and inconsistently supported
- Place skills in `.agents/skills/<name>/` for broadest cross-platform discovery
- Avoid platform-specific assumptions in the Markdown body (e.g., referencing Claude Code-specific tools by name)

**Recommended discovery path:** `.agents/skills/<name>/SKILL.md` (the agent-agnostic standard path, recognized by Claude Code, OpenCode, and other compatible agents)

## Interview Questions

When the user selects GAS as the target platform, ask the shared questions from Category E plus these additional considerations:

**Portability scope** — Is this skill intended to work across multiple agent implementations (Claude Code, OpenCode, Codex-compatible, future agents), or is it targeting a specific one while using GAS format for standardization?
- This affects whether to include implementation-specific extension fields (e.g., Claude Code's `arguments`, `user-invocable`) or stick to core GAS fields only

**Tool integration approach** — Does the skill rely on tools that vary across agent implementations? If so, should instructions be written generically (e.g., "read the file" rather than naming a specific tool), or is it acceptable to reference platform-specific tool names?
- If the user is unsure, recommend generic tool references for maximum portability

**Agent vs skill distinction** — Is the user building a skill (a focused capability invoked by an agent) or does their use case actually call for an agent configuration (a top-level persona or workflow coordinator)? Surface this when the described scope is unusually broad — multiple independent workflows, persistent state management, or coordination of other skills.
- If the use case sounds like an agent, explain the distinction briefly and confirm the user wants a skill

**Optional GAS section usage** — Based on what was learned in earlier categories, recommend which optional frontmatter fields would add value:
- `metadata` fields — useful when the skill targets a specific audience, workflow, or domain
- `compatibility` field — useful when the skill depends on specific environments or tools
- `license` field — useful for skills intended for public sharing
- `allowed-tools` — mention it exists but note it is experimental and inconsistently supported across implementations
- If the skill is simple, recommend sticking to `name` and `description` only

*Prompt example:*
> A few platform considerations for your GAS skill:
> 1. Should this skill work with multiple AI coding agents, or primarily target one?
>    - **Multiple agents** — I want it to be portable (we'll stick to the standard format)
>    - **Primarily one agent** — Which one? (Claude Code, OpenCode, or other)
>    - **Not sure** — I'll go with the portable option
> 2. Will the skill instructions be short (under a page) or long and detailed?
>    - Short: everything goes in one file
>    - Long: we can split detailed references into separate files the agent loads on demand
> 3. Any optional frontmatter fields you want? (`metadata`, `compatibility`, `license`, `allowed-tools`) — or keep it minimal with just `name` and `description`?
> 4. Should this skill be available in all projects or just specific ones?
>    - All projects (global install at `~/.agents/skills/`)
>    - Specific projects only (project-local at `.agents/skills/`)

## GAS-Specific Rendering Rules

When the target platform is GAS, apply these additional rules on top of the shared rendering pipeline. These rules ensure the generated skill file is maximally portable across all GAS-compliant agent implementations.

### Frontmatter — Portability Rules

- **Core fields only by default**: Use only core GAS fields (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`) unless the user explicitly requests extension fields for a specific implementation.
- **No extension fields for portable skills**: Do NOT include implementation-specific extension fields (`argument-hint`, `user-invocable`, `disable-model-invocation`, `arguments`) unless the user explicitly chose to target a specific agent during the interview. These fields are silently ignored by non-supporting implementations but reduce clarity of the portable intent.
- **Extension fields with comments**: If the user wants extension fields for a specific implementation, include them with a YAML comment indicating which implementation uses them:
  ```yaml
  ---
  name: my-skill
  description: What this skill does.
  # Claude Code extension fields
  user-invocable: true
  arguments:
    - name: input
      description: The input to process
      required: false
  ---
  ```
- **Platform-agnostic compatibility**: When including the `compatibility` field, use platform-agnostic language (e.g., "Requires Python 3.10+" rather than "Requires OpenCode 1.2+").
- **allowed-tools caution**: If including `allowed-tools`, add a YAML comment noting experimental status and cross-platform variability: `# Experimental — behavior varies across agent implementations`.
- **Name must match directory**: The `name` field must match the parent directory name exactly. This is a GAS spec requirement that is critical for cross-platform discovery.

### Body — Portability Rules

- **Generic tool references**: Avoid referencing platform-specific tool names in the body. Write instructions using capability descriptions that any GAS-compliant agent can interpret:
  - Instead of "Use the `read` tool to read the file", write "Read the file contents"
  - Instead of "Use the `question` tool to prompt the user", write "Ask the user"
  - Instead of "Use `bash` to run the command", write "Execute the shell command"
  - If the user explicitly wants to target a specific agent implementation, platform-specific tool names are acceptable but should be noted as implementation-specific
- **No invocation assumptions**: Do not assume a specific invocation syntax (`$skill-name`, `skill({ name: "..." })`) or discovery path in the body content. These are platform-dependent.
- **No permission model assumptions**: Do not reference platform-specific permission models or sandbox restrictions. If the skill needs elevated permissions, describe the requirement generically (e.g., "This skill requires file system write access").
- **Tool integration patterns for GAS**: When the skill requires tool integrations:
  1. Describe the capability needed in the body instructions (e.g., "Search the web for...", "Read the contents of...")
  2. If the user requested `allowed-tools`, list the tool names in frontmatter using the most common/portable names
  3. Note in the body that tool names may vary across implementations if the skill relies on specific tools

### GAS Content Mapping Additions

These supplement the shared content mapping table in generation-templates.md with GAS-specific mappings:

| Outline Section | GAS-Specific Target | Mapping Notes |
|-----------------|---------------------|---------------|
| Section 5: Platform Config — Portability | Frontmatter field selection + Body language | Cross-agent: core fields only + generic tool refs; single-agent: include extension fields |
| Section 5: Platform Config — Tool Integrations | Body — capability descriptions + optional `allowed-tools` | Describe needed capabilities generically; use `allowed-tools` only if explicitly requested |
| Section 7: Requirements — Tools | Body — capability descriptions | Describe as capabilities for portability; avoid platform-specific tool names |

### GAS Generation Failure Handling

If generation fails at any point during the rendering process:

- **Frontmatter generation failure** (e.g., name cannot be normalized, description exceeds limits after trimming): Report the specific field and constraint that failed. Suggest a fix (e.g., "The skill name '{name}' contains characters that cannot be normalized to a valid GAS name. Please provide a name using only lowercase letters, numbers, and hyphens."). Use the `question` tool to collect corrected input and retry.
- **Body generation failure** (e.g., outline is too sparse to generate meaningful content): Report which outline sections lacked sufficient detail. Suggest returning to the interview (Stage 2) to gather more information, or proceeding with a simpler skill structure.
- **Content exceeds token budget**: Automatically restructure — move detailed sections to `references/` file pointers and note the reference files in the post-generation summary. Do not fail; adapt the output.

## Output Path Prompts

> Your skill file is ready! Where would you like me to save it?
>
> I need a directory path. The skill will be saved as `{skill-name}/SKILL.md` inside the directory you specify. For example:
> - `.agents/skills` — makes it available in this project for any compatible agent (recommended for portability)
> - `.claude/skills` — makes it available in this project for Claude Code and OpenCode
> - `~/.agents/skills` — makes it available globally for all projects
>
> Enter the directory path, or press Enter for the default: `.agents/skills`

**Default path:** `.agents/skills`

## GAS-Specific Validation Rules

In addition to the shared rules in platform-base.md, validate:

### Portability Checks (apply when the user chose cross-platform portability)

- [ ] Only core GAS fields are used in frontmatter (`name`, `description`, `license`, `compatibility`, `metadata`) — if extension fields are present, warn that they will be silently ignored by non-supporting implementations
- [ ] Body content does not reference platform-specific tools by name without noting portability implications
- [ ] Skill directory uses `.agents/skills/` path convention (the most portable discovery path)

### Extension Field Validation (apply when targeting a specific agent implementation)

- [ ] `argument-hint` is a string if provided (Claude Code)
- [ ] `user-invocable` is a boolean if provided (Claude Code)
- [ ] `disable-model-invocation` is a boolean if provided (Claude Code)
- [ ] `arguments` is an array of objects with `name`, `description`, and `required` fields if provided (Claude Code)

### Description Quality (advisory, not failure)

- [ ] Description includes both "what the skill does" and "when to use it"
- [ ] Description includes specific keywords for agent discoverability

### Content Guidelines (advisory, not failure)

- [ ] SKILL.md body is under 500 lines
- [ ] Estimated token count is under 5000

## Documentation Gaps

The following areas have limited or ambiguous documentation and may benefit from dynamic fetching:

- The `allowed-tools` field is experimental with no standard vocabulary of tool names; behavior varies between implementations (Claude Code supports it, OpenCode silently ignores it)
- The `compatibility` field has no standard vocabulary; values like "opencode" and "claude-code" are conventions, not enforced or registered values
- Body content size limits (500 lines, 5000 tokens) are guidelines, not enforced limits; real-world skills exceed them
- The spec has no formal versioning scheme; breaking changes could occur without a version bump
- Extension field behavior relies on the "silently ignored" convention; there is no formal extension mechanism, namespacing, or prefix convention to distinguish core from extension fields
- The `allowed-tools` format differs between spec (space-delimited string) and Claude Code implementation (YAML list); both are accepted in practice
