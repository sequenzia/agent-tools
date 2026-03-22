# Generation Engine

Body templates, content mapping, rendering rules, and complexity adaptation for GAS skill file generation.

## Body Templates

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

## Body Generation Rules

- **Map outline sections to body sections**: The outline's workflow overview (Section 4) drives the body structure. Each major workflow step becomes a heading (`##`) in the body. Features from Section 2 are woven into the relevant workflow sections, not listed separately.
- **Write as agent instructions**: The body tells the agent what to do, not the user. Use imperative directives: "Read the file contents...", "Analyze the diff...", "Present the results to the user...". The agent is the audience.
- **Include trigger context**: When the skill has specific trigger scenarios (from outline Section 3), work them into the opening paragraph or a "When to Use" section so the agent understands activation context.
- **Reference external files**: If the outline specifies `references/` or `scripts/` files, include relative-path references in the body (e.g., `See [the API reference](references/api-reference.md) for details.`). Note: this stage generates SKILL.md only — reference and script files are listed as follow-up actions for the user.
- **Respect token budget**: Target under 5000 tokens for the body content. If the skill is complex and the full instructions would exceed this, split detailed reference material into `references/` files and reference them from the main body. Indicate to the user which reference files to create as follow-up.
- **Use consistent formatting**: Headings (`##`, `###`), numbered lists for sequential steps, bullet lists for options or parallel items, code blocks for examples, bold for emphasis on key terms and rules, tables for structured data.
- **Handle "[Default — please review]" items**: For any outline items that were marked as defaults, generate the content using the default value but keep the generated text easy to locate and modify. Do not carry the "[Default — please review]" markers into the final file.

## Portability Rendering Rules

These rules ensure the generated skill file is maximally portable across all GAS-compliant agent implementations.

### Frontmatter — Portability

- **Core fields only**: Use only core GAS fields (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`). Do not include implementation-specific extension fields.
- **Platform-agnostic compatibility**: When including `compatibility`, use platform-agnostic language (e.g., "Requires Python 3.10+" rather than platform-specific version references).
- **allowed-tools caution**: If including `allowed-tools`, use the most common/portable tool names and note that behavior varies across implementations.
- **Name must match directory**: The `name` field must match the parent directory name exactly — a GAS spec requirement critical for cross-platform discovery.

### Body — Portability

- **Generic tool references**: Write instructions using capability descriptions, not platform-specific tool names:
  - Instead of "Use the `read` tool", write "Read the file contents"
  - Instead of "Use the `question` tool", write "Ask the user"
  - Instead of "Use `bash` to run the command", write "Execute the shell command"
- **No invocation assumptions**: Do not assume a specific invocation syntax or discovery path in the body content.
- **No permission model assumptions**: Do not reference platform-specific permission models. Describe permission requirements generically (e.g., "This skill requires file system write access").
- **Tool integration patterns**: Describe needed capabilities in the body instructions (e.g., "Search the web for...", "Read the contents of..."). If the user requested `allowed-tools`, list tool names in frontmatter using the most common/portable names.

## Content Mapping

Map interview/outline data to GAS skill format:

| Outline Section | GAS Target | Mapping Notes |
|-----------------|------------|---------------|
| Section 1: Skill Identity — Name | Frontmatter `name` field | Normalize to lowercase, hyphenated format |
| Section 1: Skill Identity — Description | Frontmatter `description` field | Merge with trigger scenarios from Section 3 for discoverability |
| Section 2: Key Features | Body — woven into workflow sections | Features are instructions, not a feature list |
| Section 3: Use Cases — Primary | Body — opening overview paragraph | Establishes what the skill does |
| Section 3: Use Cases — Trigger Scenarios | Frontmatter `description` + Body overview | Triggers go in both places for discoverability |
| Section 4: Workflow Overview | Body — primary structure (headings, sections) | Each workflow step = a body section |
| Section 5: GAS Config — Frontmatter | Frontmatter optional fields | Include only core fields with meaningful values |
| Section 5: GAS Config — References | Body — file reference links | Reference paths in body; note files for user to create |
| Section 5: GAS Config — Scripts | Body — script invocation instructions | Script paths in body; note files for user to create |
| Section 5: GAS Config — Token Budget | Body structure decisions | Split into references if exceeding budget |
| Section 5: GAS Config — Tool Integrations | Body — capability descriptions | Describe needed capabilities generically |
| Section 6: File Structure | Post-generation summary | Tell user what additional files to create |
| Section 7: Requirements — Tools | Body — capability descriptions | Describe as capabilities for portability |
| Section 7: Requirements — Constraints | Body — Critical Rules or dedicated section | Hard constraints become explicit agent rules |
| Section 7: Requirements — Error Handling | Body — Error Handling section or inline | Error behavior as agent instructions |
| Section 8: Defaults | Body content (default values used) | Remove markers; use default values directly |

## Complexity Adaptation

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
- Describe each tool dependency as a capability requirement in the body
