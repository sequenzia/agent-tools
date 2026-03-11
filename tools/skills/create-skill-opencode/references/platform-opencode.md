# OpenCode Platform Reference

OpenCode-specific additions to the shared format defined in [platform-base.md](platform-base.md). OpenCode implements the Agent Skills open standard (agentskills.io) directly.

## Version Metadata

- spec_version: "2026-03"
- spec_last_verified: "2026-03-07"
- source_url: https://agentskills.io/specification
- opencode_docs_url: https://opencode.ai/docs/skills
- docs_site_version: "0.0.2611"
- notes: OpenCode implements the Agent Skills open standard (agentskills.io). No formal semantic versioning exists for the spec; use docs-last-updated date as the reference point.

## Platform-Specific Notes

**Mixed-case tolerance:** OpenCode's source code uses `^[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*$` (allows mixed case), but the agentskills.io spec requires lowercase only. Always generate lowercase names for maximum portability.

**`.opencode` path priority:** OpenCode checks `.opencode/skills/` first, giving project-level OpenCode skills the highest discovery priority.

## File Discovery Paths

OpenCode searches these locations in order (project-local paths walk up from cwd to git worktree root):

| Location | Path Pattern |
|----------|-------------|
| Project OpenCode | `.opencode/skills/<name>/SKILL.md` |
| Global OpenCode | `~/.config/opencode/skills/<name>/SKILL.md` |
| Project Claude-compat | `.claude/skills/<name>/SKILL.md` |
| Global Claude-compat | `~/.claude/skills/<name>/SKILL.md` |
| Project Agent-compat | `.agents/skills/<name>/SKILL.md` |
| Global Agent-compat | `~/.agents/skills/<name>/SKILL.md` |

## How OpenCode Differs

- OpenCode adopts the Agent Skills open standard (agentskills.io) directly; it does NOT use a proprietary format
- Skills are cross-compatible with Claude Code and other Agent Skills-compatible platforms
- OpenCode exposes skills through a native `skill` tool that agents call by name
- Skill permissions are configurable via `opencode.json` using glob patterns (allow/deny/ask)
- Per-agent permission overrides are supported in both markdown agent frontmatter and JSON config

## Interview Questions

When the user selects OpenCode as the target platform, the shared questions from Category E are sufficient. OpenCode implements the Agent Skills standard directly, so no additional platform-specific questions are needed beyond what is already covered in Categories A-D and the shared questions.

## Output Path Prompts

Present the output path selection using `question` with structured options:

```
question:
  header: "Output Path"
  text: "Where should I save the skill? It will be written as {skill-name}/SKILL.md inside the directory you choose."
  options:
    - label: "~/.agents/skills — Available globally for all projects (Recommended)"
    - label: "~/.config/opencode/skills — Available globally via the OpenCode-native discovery path"
    - label: ".agents/skills — Available only in this project"
  custom: true
```

**Default path:** `~/.agents/skills`

## OpenCode-Specific Validation Rules

In addition to the shared rules in platform-base.md, validate:

**Naming:**
- [ ] `name` uses lowercase only (not mixed-case — the agentskills.io spec requires lowercase even though OpenCode's implementation tolerates mixed case)

**Description quality (advisory, not failure):**
- [ ] Description includes both "what the skill does" and "when to use it" — if missing trigger context, suggest adding it
- [ ] Description includes specific keywords for agent discoverability — if vague, suggest improvement

**Content guidelines (advisory, not failure):**
- [ ] SKILL.md body is under 500 lines — if over, suggest moving content to `references/`
- [ ] Estimated token count is under 5000 — if over, suggest progressive disclosure

## Documentation Gaps

The following areas have limited or ambiguous documentation and may benefit from dynamic fetching:

- The `allowed-tools` field is experimental with no clear specification of supported tool names or behavior across agents
- The `compatibility` field has no standard vocabulary; usage varies (e.g., "opencode", "claude-code" are conventions, not enforced values)
- Body content size limits (500 lines, 5000 tokens) are guidelines, not enforced limits
- The spec has no formal versioning; breaking changes could occur without a version bump
- OpenCode repo transitioned from opencode-ai/opencode (archived) to charmbracelet/crush; documentation at opencode.ai remains authoritative
