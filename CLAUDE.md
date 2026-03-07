# agent-tools

## Project Structure

- `skills/` — Skill files in GAS (Generic Agent Skills) format
  - Each skill in `skills/{skill-name}/SKILL.md`
- `internal/research/` — Platform specification research documents
- `internal/specs/` — Feature specification documents
- `internal/prompts/` — Original concept prompts

## Conventions

- Skills use GAS (agentskills.io) format: YAML frontmatter between `---` + Markdown body
- Required frontmatter fields: `name` (1-64 chars, lowercase alphanum + hyphens), `description` (1-1024 chars)
- Skill sections use numbered subsections within stages (e.g., 2.1, 2.2)
- Prompt examples formatted as blockquotes with experience-level variants
- Internal checklists use `- [ ]` format

## Platform Notes

- OpenCode/GAS formats are structurally identical; OpenCode implements the GAS standard directly
- Codex uses same SKILL.md format but adds `agents/openai.yaml` extension file
- Best portable discovery path: `.agents/skills/<name>/SKILL.md`
- `allowed-tools` field is experimental across all platforms

## No Test Suite

This project produces Markdown skill files, not code. Verification is manual.
