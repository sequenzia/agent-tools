# Generation Templates

Body templates, content mapping, and complexity adaptation rules for skill file generation. Templates are organized by platform since heading structures differ between OpenCode/GAS and Codex.

## OpenCode / GAS Body Templates

### Simple Skills

Single-action or short pipeline, minimal configuration:

```markdown
# {Skill Title}

{One-paragraph overview: what the skill does, its primary purpose, and key behavior.}

## Instructions

{Step-by-step instructions for the agent to follow when the skill is invoked.
Each step should be a clear, actionable directive.
Use numbered lists for sequential steps, bullet lists for parallel options.}

## Examples

{One or more examples showing expected inputs and outputs.
Use code blocks for input/output formatting.
Include both a simple case and an edge case if applicable.}
```

### Moderate Skills

Multi-step workflow, some configuration, reference files:

```markdown
# {Skill Title}

{One-paragraph overview: purpose, primary capabilities, and when to use this skill.}

## How It Works

{Brief description of the workflow shape and overall approach.}

## {Workflow Step/Section 1}

{Detailed instructions for the first major step or section.}

## {Workflow Step/Section 2}

{Detailed instructions for the next step or section.}

{... additional sections as needed ...}

## Configuration

{Any configuration options, customization points, or settings.}

## Examples

{Representative examples of usage.}
```

### Complex Skills

Multi-step workflows with branching, conversational loops, extensive features:

```markdown
# {Skill Title}

{One-paragraph overview: purpose, key capabilities, and the problem it solves.}

## {Supported Platforms/Modes} (if applicable)

{List of platforms, modes, or configurations the skill supports.}

## Critical Rules

{Non-negotiable constraints, safety rules, or mandatory behaviors.
Use bold text and imperative language for emphasis.}

## {Pipeline/Workflow} Overview

{High-level description of the skill's execution flow.
Use numbered lists to describe the stages or phases.}

## {Stage/Section 1}

{Detailed instructions for the first major stage.
Include subsections (###) for distinct sub-steps within the stage.}

### {Subsection 1.1}

{Subsection detail...}

## {Stage/Section 2}

{Detailed instructions for the next stage.}

{... additional stages as needed ...}

## {Cross-Cutting Concern} (if applicable)

{Capabilities or behaviors that span multiple stages — e.g., logging, error handling, research.}

## Error Handling

{How the skill should handle failures, invalid inputs, and edge cases.}
```

## OpenCode / GAS Body Generation Rules

- **Map outline sections to body sections**: The outline's workflow overview (Section 4) drives the body structure. Each major workflow step becomes a heading (`##`) in the body. Features from Section 2 are woven into the relevant workflow sections, not listed separately.
- **Write as agent instructions**: The body tells the agent what to do, not the user. Use imperative directives: "Read the file...", "Analyze the diff...", "Present the results to the user...". The agent is the audience.
- **Include trigger context**: When the skill has specific trigger scenarios (from outline Section 3), work them into the opening paragraph or a "When to Use" section so the agent understands activation context.
- **Reference external files**: If the outline specifies `references/` or `scripts/` files, include relative-path references in the body (e.g., `See [the API reference](references/api-reference.md) for details.`). Note: this stage generates SKILL.md only — reference and script files are listed as follow-up actions for the user.
- **Respect token budget**: Target under 5000 tokens for the body content. If the skill is complex and the full instructions would exceed this, split detailed reference material into `references/` files and reference them from the main body. Indicate to the user which reference files to create as follow-up.
- **Use consistent formatting**: Headings (`##`, `###`), numbered lists for sequential steps, bullet lists for options or parallel items, code blocks for examples, bold for emphasis on key terms and rules, tables for structured data.
- **Handle "[Default — please review]" items**: For any outline items that were marked as defaults, generate the content using the default value but keep the generated text easy to locate and modify. Do not carry the "[Default — please review]" markers into the final file.

## OpenCode / GAS Content Mapping

Map interview/outline data to OpenCode / GAS format:

| Outline Section | OpenCode / GAS Target | Mapping Notes |
|-----------------|-----------------|---------------|
| Section 1: Skill Identity — Name | Frontmatter `name` field | Normalize to lowercase, hyphenated format |
| Section 1: Skill Identity — Description | Frontmatter `description` field | Merge with trigger scenarios from Section 3 for discoverability |
| Section 2: Key Features | Body — woven into workflow sections | Features are instructions, not a feature list |
| Section 3: Use Cases — Primary | Body — opening overview paragraph | Establishes what the skill does |
| Section 3: Use Cases — Trigger Scenarios | Frontmatter `description` + Body overview | Triggers go in both places for discoverability |
| Section 4: Workflow Overview | Body — primary structure (headings, sections) | Each workflow step = a body section |
| Section 5: Platform Config — Frontmatter | Frontmatter optional fields | Include only fields with meaningful values |
| Section 5: Platform Config — Portability | Frontmatter field selection + Body tool references | GAS: if cross-agent, core fields only + generic tool refs; if single-agent, include extension fields |
| Section 5: Platform Config — References | Body — file reference links | Reference paths in body; note files for user to create |
| Section 5: Platform Config — Scripts | Body — script invocation instructions | Script paths in body; note files for user to create |
| Section 5: Platform Config — Token Budget | Body structure decisions | Split into references if exceeding budget |
| Section 6: File Structure | Post-generation summary | Tell user what additional files to create |
| Section 7: Requirements — Tools | Frontmatter `allowed-tools` (if requested) or Body rules | Tools are instructions, not just a list |
| Section 7: Requirements — Constraints | Body — Critical Rules or dedicated section | Hard constraints become explicit agent rules |
| Section 7: Requirements — Error Handling | Body — Error Handling section or inline | Error behavior as agent instructions |
| Section 8: Defaults | Body content (default values used) | Remove markers; use default values directly |

## OpenCode / GAS Complexity Adaptation

**Simple skills:**
- Frontmatter: `name` and `description` only (omit all optional fields unless explicitly requested)
- Body: 3-5 sections, direct and concise
- No reference files, no scripts
- Total file: roughly 30-80 lines

**Moderate skills:**
- Frontmatter: `name`, `description`, plus any relevant optional fields
- Body: 5-10 sections with clear structure
- May include reference file pointers if content is substantial
- Total file: roughly 80-200 lines

**Complex skills:**
- Frontmatter: `name`, `description`, plus relevant optional fields and metadata
- Body: 10+ sections with subsections, potentially including Critical Rules, Pipeline Overview, and Cross-Cutting Concerns
- Likely references `references/` files for progressive disclosure
- Total file: roughly 200-500 lines (keep under 500; move excess to reference files)
- For complex GAS skills with tool integrations, describe each tool dependency as a capability requirement in the body and optionally list tools in `allowed-tools` if the user requests it

---

## Codex Body Templates

### Simple Skills

Single-action or short pipeline, minimal configuration:

```markdown
# {Skill Title}

{One-paragraph overview: what the skill does and its primary purpose.}

## Workflow

{Step-by-step instructions for the agent to follow when the skill is invoked.
Each step should be a clear, imperative directive.
Use numbered lists for sequential steps, bullet lists for parallel options.}

## Tips

{Brief tips for common scenarios and edge cases, if applicable.}
```

### Moderate Skills

Multi-step workflow, some configuration, reference files:

```markdown
# {Skill Title}

{One-paragraph overview: purpose and primary capabilities.}

## Prerequisites

{Required tools, authentication, setup, or environment variables.}

## Workflow

{Step-by-step instructions organized by phase.
Use numbered lists for sequential steps.}

### {Phase 1}

{Detailed instructions for the first phase.}

### {Phase 2}

{Detailed instructions for the next phase.}

{... additional phases as needed ...}

## References

{Links to reference files for advanced features, if applicable.}

## Tips

{Common issues and solutions.}
```

### Complex Skills

Multi-step workflows with branching, conversational loops, extensive features:

```markdown
# {Skill Title}

{One-paragraph overview: purpose, key capabilities, and the problem it solves.}

## Prerequisites

{Required tools, authentication, environment variables, and setup steps.}

## Quick Start

{Minimal example showing the most common invocation.}

## Workflow

{High-level description of the skill's execution flow.
Use numbered lists to describe the stages or phases.}

### {Stage 1}

{Detailed instructions for the first stage.
Include sub-steps as needed.}

### {Stage 2}

{Detailed instructions for the next stage.}

{... additional stages as needed ...}

## {Cross-Cutting Concern} (if applicable)

{Capabilities or behaviors that span multiple stages — e.g., error handling, research, logging.}

## References

{Links to reference files in references/ with clear navigation.}

## Troubleshooting

{Common issues and solutions.}
```

## Codex Body Generation Rules

- **Map outline sections to body sections**: The outline's workflow overview (Section 4) drives the body structure. Each major workflow step becomes a heading (`##`) in the body. Features from Section 2 are woven into the relevant workflow sections, not listed separately.
- **Write as agent instructions**: The body tells the agent what to do, not the user. Use imperative directives: "Read the file...", "Analyze the diff...", "Present the results to the user...". The agent is the audience.
- **Put trigger context in the description, not the body**: Unlike OpenCode, Codex's implicit invocation matches against the `description` field. All "when to use" information belongs in the description. The body focuses purely on "how to execute."
- **Reference external files**: If the outline specifies `references/` or `scripts/` files, include relative-path references in the body (e.g., `See [the API reference](references/api-reference.md) for details.`). Note: this stage generates SKILL.md and optionally agents/openai.yaml — reference, script, and asset files are listed as follow-up actions for the user.
- **Respect token budget**: Target under 5000 tokens for the body content. Keep the main SKILL.md under 500 lines. If the skill is complex and the full instructions would exceed this, split detailed reference material into `references/` files and reference them from the main body. Indicate to the user which reference files to create as follow-up.
- **Use consistent formatting**: Headings (`##`, `###`), numbered lists for sequential steps, bullet lists for options or parallel items, code blocks for examples, bold for emphasis on key terms and rules, tables for structured data.
- **Handle "[Default — please review]" items**: For any outline items that were marked as defaults, generate the content using the default value but keep the generated text easy to locate and modify. Do not carry the "[Default — please review]" markers into the final file.
- **No extraneous files**: Do NOT include instructions to create README.md, INSTALLATION_GUIDE.md, QUICK_REFERENCE.md, or CHANGELOG.md. Only include files needed for the agent to do the job.

## Codex Content Mapping

Map interview/outline data to Codex format:

| Outline Section | Codex Target | Mapping Notes |
|-----------------|--------------|---------------|
| Section 1: Skill Identity — Name | Frontmatter `name` field | Normalize to lowercase, hyphenated format; prefer verb-led phrases |
| Section 1: Skill Identity — Description | Frontmatter `description` field | Merge with trigger scenarios from Section 3 and add scope boundaries |
| Section 2: Key Features | Body — woven into workflow sections | Features are instructions, not a feature list |
| Section 3: Use Cases — Primary | Frontmatter `description` + Body overview | Primary use case drives the description |
| Section 3: Use Cases — Trigger Scenarios | Frontmatter `description` | All triggers go in the description for implicit invocation matching |
| Section 4: Workflow Overview | Body — primary structure (headings, sections) | Each workflow step = a body section |
| Section 5: Platform Config — Display Name | `agents/openai.yaml` `interface.display_name` | Human-readable title case name |
| Section 5: Platform Config — Short Description | `agents/openai.yaml` `interface.short_description` | 25-64 char UI blurb |
| Section 5: Platform Config — Icons/Branding | `agents/openai.yaml` `interface.icon_*`, `brand_color` | Asset paths and hex color |
| Section 5: Platform Config — References | Body — file reference links | Reference paths in body; note files for user to create |
| Section 5: Platform Config — Scripts | Body — script invocation instructions | Script paths in body; note files for user to create |
| Section 5: Platform Config — Token Budget | Body structure decisions | Split into references if exceeding budget |
| Section 6: File Structure | Post-generation summary | Tell user what additional files to create (including `agents/` directory) |
| Section 7: Requirements — Tools (MCP) | `agents/openai.yaml` `dependencies.tools` | Map MCP tool integrations to dependency entries |
| Section 7: Requirements — Tools (non-MCP) | Body — Prerequisites section | Non-MCP tools described in body |
| Section 7: Requirements — Constraints | Body — dedicated section or inline rules | Hard constraints become explicit agent rules |
| Section 7: Requirements — Error Handling | Body — Troubleshooting section or inline | Error behavior as agent instructions |
| Section 7: Requirements — Env Vars | Body — Prerequisites section | Use Codex env var configuration pattern (e.g., `SENTRY_AUTH_TOKEN`) |
| Section 8: Defaults | Body content (default values used) | Remove markers; use default values directly |

## Codex Complexity Adaptation

**Simple skills:**
- Frontmatter: `name` and `description` only (Codex minimal frontmatter convention)
- Body: 3-5 sections, direct and concise
- agents/openai.yaml: `interface` section only (`display_name` + `short_description`)
- No reference files, no scripts
- Total SKILL.md: roughly 30-80 lines

**Moderate skills:**
- Frontmatter: `name` and `description` only
- Body: 5-10 sections with clear structure, includes Prerequisites
- agents/openai.yaml: `interface` section, possibly `dependencies` if MCP tools are used
- May include reference file pointers if content is substantial
- Total SKILL.md: roughly 80-200 lines

**Complex skills:**
- Frontmatter: `name` and `description` only
- Body: 10+ sections with subsections, including Prerequisites, Quick Start, Workflow stages, and Troubleshooting
- agents/openai.yaml: full `interface`, `policy` (if non-default), and `dependencies` sections
- Likely references `references/` files for progressive disclosure
- May include `scripts/` for deterministic tasks
- Total SKILL.md: roughly 200-500 lines (keep under 500; move excess to reference files)
