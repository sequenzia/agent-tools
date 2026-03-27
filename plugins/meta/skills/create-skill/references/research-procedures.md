# Research Procedures

Research procedures for skill creation, including dynamic documentation fetching, web search, reference file reading, fallback handling, quality indicators, and spec version tracking.

## Dynamic Documentation Fetching

Use Context7 MCP tools to fetch the latest GAS platform documentation at runtime. Dynamic fetching supplements embedded knowledge with current information and detects when embedded knowledge has become stale.

### Documentation Lookup

The GAS specification has a corresponding Context7 library. Use `resolve-library-id` to find the correct library ID, then `query-docs` to pull relevant snippets.

**Generic Agent Skills (agentskills.io):**

```
Step 1: resolve-library-id("agentskills agent skills specification")
Step 2: query-docs(library_id, "skill format frontmatter fields required structure")
```

Target keywords by need:
- Skill format/structure: `"skill format frontmatter fields required structure"`
- Frontmatter fields: `"frontmatter YAML name description allowed-tools"`
- Body conventions: `"body content markdown instructions examples"`
- File organization: `"directory structure references scripts assets"`

### When to Invoke Dynamic Fetching

**On-demand** — User explicitly requests research:
- User says "check the latest docs", "look up the spec", "research this", or similar
- User asks a question about a GAS feature you are uncertain about
- User mentions a feature or field not covered in embedded knowledge

**Proactive** — Agent detects uncertainty about specification nuances:
- During the interview, a user describes a capability and you are unsure whether the GAS spec supports it
- During generation, you encounter a field or structural decision not clearly covered by embedded knowledge
- A documentation gap listed in platform-knowledge.md's "Documentation Gaps" section is relevant to the current skill
- The user's skill involves features flagged as "experimental" or "evolving" in embedded knowledge

**Startup version comparison** — At the beginning of a session, compare embedded knowledge against fetched docs:
1. Read the `spec_version` and `spec_last_verified` from the Version Metadata in [references/platform-knowledge.md](platform-knowledge.md)
2. Use `resolve-library-id` to locate the GAS Context7 library
3. Use `query-docs` with keywords like `"version changelog updated"` to check for version indicators
4. Compare the fetched information against embedded `spec_version` and `spec_last_verified` dates
5. If the fetched docs indicate changes after the `spec_last_verified` date, or if structural differences are detected, flag the embedded knowledge as potentially stale

### Tool Usage Instructions

**`resolve-library-id`** — Find the correct Context7 library ID.

Call this once per session. Cache the returned library ID for subsequent `query-docs` calls.

```
resolve-library-id(query: string) -> library_id
```

- Use descriptive queries: `"agentskills agent skills specification"`
- If the first query returns no results, try alternatives: `"agentskills.io"`, `"generic agent skills"`
- Store the resolved library ID for the duration of the session

**`query-docs`** — Fetch documentation snippets from a resolved library.

```
query-docs(library_id: string, query: string) -> documentation_snippets
```

- Use targeted, specific keywords — not broad queries. Good: `"frontmatter YAML fields required"`. Bad: `"everything about skills"`.
- Combine multiple related terms in a single query: `"skill format frontmatter fields"`
- If a query returns insufficient results, try narrower or alternative keyword combinations
- Limit to the information you actually need

### Result Integration

When dynamic documentation is fetched, integrate it with embedded knowledge:

**Supplementing embedded knowledge:**
- If fetched docs provide additional detail on a topic covered by embedded knowledge, merge the new information into your working understanding
- If fetched docs cover a topic not present in embedded knowledge, treat it as authoritative

**Overriding embedded knowledge:**
- If fetched docs conflict with embedded knowledge on a factual matter (e.g., a field is now required that was previously optional), prefer the fetched version
- When overriding, note the discrepancy to the user: explain what the embedded knowledge stated, what the fetched docs state, and that you are using the more current information

**Discrepancy tracking:**
- Record any discrepancies between embedded and fetched documentation during the session
- Include discrepancies in the post-generation summary so the user is aware of potential knowledge drift
- If multiple discrepancies are found, recommend updating the embedded knowledge

### Error Handling

**Context7 unavailable or times out:**
- Fall back to embedded knowledge without interrupting the workflow
- Inform the user: "Context7 documentation fetching is unavailable. Proceeding with embedded platform knowledge (last verified: {spec_last_verified})."
- A single retry is acceptable; if the second attempt fails, proceed with embedded knowledge

**Partial results:**
- If `query-docs` returns results but they seem incomplete, use what is relevant and supplement with embedded knowledge
- Do not treat partial results as authoritative for topics they do not directly address

**Research status communication:**
- When initiating a dynamic fetch, briefly inform the user: "Checking latest GAS documentation..."
- When the fetch completes, summarize what was found if relevant
- Keep status updates concise

---

## Web Search

Use web search to find current best practices, community examples, and GAS-specific guidance that supplements embedded knowledge.

### What to Search For

**Best practices for skill creation:**
- Search for best practices and patterns for creating agent skills
- Look for style guides, authoring tips, and recommended approaches
- Example queries: "agent skill authoring guide agentskills.io", "best practices for writing portable agent skills"

**Community examples and patterns:**
- Search for open-source skill repositories and example skills
- Look for community-shared skills that solve problems similar to the user's skill
- Example queries: "agentskills.io community skills", "example agent skills github"

**Recent changes or updates:**
- Search for recent announcements, release notes, or breaking changes to the GAS spec
- Especially important when the embedded knowledge `spec_version` date is more than 30 days old
- Example queries: "agentskills.io specification changelog", "agent skills spec changes 2026"

### When to Invoke Web Search

**On-demand triggers:**
- The user explicitly asks to research something
- The user mentions a pattern or feature you are uncertain about
- The user asks about recent spec changes

**Proactive triggers:**
- During the interview, the user describes a skill pattern you have limited embedded knowledge about
- The skill targets a niche domain where community examples would improve output quality
- The embedded knowledge `spec_version` is older than 30 days and the user asks about a potentially changed feature

**Do not search when:**
- The embedded platform knowledge already covers the topic comprehensively
- The question is about basic skill structure well-documented in the embedded knowledge
- The user has explicitly said they want to proceed without research

### Handling Search Results

**Filtering and ranking:**
- Prioritize results from official documentation and repositories
- Rank community examples by recency (prefer last 6 months) and quality indicators
- Discard results that describe deprecated or outdated approaches

**When results are irrelevant:**
- Inform the user: "Web search did not return relevant results for [topic]. Proceeding with embedded knowledge."
- Consider refining the search query once before giving up

**When results conflict with embedded knowledge:**
- Prefer the web search result if it is from an official source and more recent than the embedded `spec_last_verified` date
- Note the discrepancy to the user
- If the conflict source is unofficial, flag it as uncertain and ask the user which approach to follow

### Search Failure Handling

- If web search is unavailable, notify the user: "Web search is currently unavailable. Continuing with embedded platform knowledge."
- Do not block the workflow — fall back to embedded knowledge
- If repeated searches fail, stop attempting web search for the remainder of the session

---

## Reference File Reading

Read existing skill files that the user provides as reference material. This allows the user to share examples, templates, or prior skills to inform the creation process.

### How to Use Reference Files

When the user provides a file path to an existing skill (via the `context` argument, during the interview, or at any stage):

1. **Read the file**. Accept any text format — `.md`, `.yaml`, `.yml`, `.txt`, `.json`, or other text files
2. **Identify the source format** by examining the file's structure:
   - YAML frontmatter with `name` + `description` + Markdown body -> GAS skill
   - Other structured format -> Non-skill reference (documentation, spec, example)
3. **Extract useful patterns** from the reference file:
   - Structural patterns: section organization, heading hierarchy, content flow
   - Content patterns: how instructions are written, level of detail, tone
   - Feature patterns: tool usage, error handling approaches, configuration patterns

### Cross-Format Reference Handling

When the reference file uses a different format than GAS:

- **Inform the user**: "This reference file appears to use a different format. I'll extract transferable patterns but will adapt the output to GAS conventions."
- **Extract transferable patterns**: Content structure, instruction style, feature design, and workflow patterns are generally transferable
- **Do not transfer format-specific elements**: Frontmatter format, file structure conventions, and platform-specific tool references should not be carried over — generate these fresh for GAS
- **Note differences**: If the reference uses a capability not standard in GAS, inform the user and suggest the closest alternative

### What to Extract from Reference Files

**For informing interview questions:**
- Identify patterns that suggest questions to ask
- Use the reference's scope and complexity to calibrate interview depth

**For enhancing the outline:**
- Suggest sections and structure inspired by the reference
- Incorporate best practices visible in the reference's organization

**For guiding generation:**
- Match the reference's instruction style and level of detail when appropriate
- Use the reference as a quality benchmark for the generated output

### When to Invoke Reference File Reading

**On-demand triggers:**
- The user provides a file path and says "use this as a reference" or similar
- The user mentions an existing skill they want to base their new skill on
- The `context` argument contains a file path

**Proactive triggers:**
- During the interview, if the user mentions existing skills, ask if they would like to provide one as a reference

### Error Handling for Reference Files

**Invalid file paths:**
- If the file cannot be read, inform the user clearly: "Could not read the file at [path]. Please check the path and try again."
- Do not block the workflow — continue without the reference

**Unreadable or binary files:**
- If the content is binary, inform the user: "The file at [path] does not appear to be a text file."
- Skip and continue

**Empty files:**
- Inform the user: "The file at [path] is empty. No patterns to extract."
- Continue without incorporating reference patterns

---

## Research Result Integration

Research findings from web search and reference files are integrated into the pipeline at three points:

**During the interview (Stage 2):**
- Discovered patterns inform follow-up questions
- Community examples help calibrate question depth
- Findings surface relevant options the user might not know about

**During outline generation (Stage 3):**
- Best practice suggestions are incorporated as recommended sections
- Reference file patterns inform structure and detail level
- Research findings are presented as suggestions, not mandates

**During generation (Stage 4):**
- Community-validated approaches guide implementation details
- Guidance from fetched docs ensures the file follows current conventions
- Reference file quality standards serve as a benchmark

---

## Research Fallback Handling

Graceful degradation when dynamic research sources are unavailable. Skill generation always succeeds regardless of which research sources are accessible.

### Fallback Priority Chain

| Priority | Source | Availability | Quality Level |
|----------|--------|-------------|---------------|
| 1 (Primary) | Context7 MCP documentation fetching | Requires Context7 MCP tools | Highest — live, versioned docs |
| 2 (Secondary) | Web search for docs, examples, best practices | Requires web search capability | High — current community knowledge |
| 3 (Tertiary) | Reference files provided by user | Requires user-supplied file paths | Medium — relevant but potentially dated |
| 4 (Final) | Embedded platform knowledge | Always available | Baseline — comprehensive but may be stale |

Embedded platform knowledge (Priority 4) is always available and serves as the baseline.

### Availability Detection

**Context7 (Priority 1) failure detection:**
- `resolve-library-id` or `query-docs` fails, throws an error, or times out
- Context7 MCP tools are not registered in the current environment
- A single retry is acceptable; if the second attempt fails, mark as unavailable for the session

**Web search (Priority 2) failure detection:**
- Web search tool call fails or returns an error
- Web search returns zero results for a well-formed query
- After two consecutive failures, mark as unavailable for the session

**Reference files (Priority 3) failure detection:**
- No reference files were provided by the user
- All provided file paths fail to read

**Embedded knowledge (Priority 4):**
- Always available — cannot fail

### User Communication

**When a fallback transition occurs:**
- Inform the user which source failed and which source is being used instead
- Keep the message concise — fallbacks are expected behavior, not errors
- Examples:
  - "Context7 is unavailable. Checking web search for current guidance..."
  - "Web search did not return results. Proceeding with embedded knowledge (last verified: {spec_last_verified})."

**When all dynamic sources fail:**
- Deliver a single consolidated message:
  - "Dynamic research sources are unavailable for this session. Generating with embedded platform knowledge (last verified: {spec_last_verified}). You can provide reference files at any time to supplement."

**In the post-generation summary:**
- Include a "Research sources" line listing which sources were used:
  - "Research sources: Context7 (live docs), web search, embedded knowledge"
  - "Research sources: Embedded knowledge only (dynamic sources unavailable)"

---

## Research Quality Indicators

Track and communicate the quality level of research backing each generated skill.

### Quality Levels

| Sources Available | Quality Label | Confidence |
|-------------------|---------------|------------|
| Context7 + any others | "Dynamic research" | High |
| Web search + embedded (no Context7) | "Supplemented research" | Medium-High |
| Reference files + embedded (no dynamic) | "Reference-informed" | Medium |
| Embedded knowledge only | "Baseline knowledge" | Baseline |

### Attribution Comment

Include a research attribution comment in the generated skill file, placed after the frontmatter and before the main body content:

```markdown
<!-- Generated by create-skill | Research: {quality_label} | Platform knowledge last verified: {spec_last_verified} -->
```

Examples:
- `<!-- Generated by create-skill | Research: Dynamic research (Context7 + web search) | Platform knowledge last verified: 2026-03-07 -->`
- `<!-- Generated by create-skill | Research: Baseline knowledge only | Platform knowledge last verified: 2026-03-07 -->`

### Staleness Indicator

When generating with embedded knowledge only and the `spec_last_verified` date is more than 30 days ago, add a staleness note in the post-generation summary:

- "Note: This skill was generated using embedded knowledge last verified on {spec_last_verified} ({N} days ago) without dynamic research confirmation. Consider checking the platform documentation manually."

---

## Spec Version Tracking

Track embedded spec versions and detect when embedded knowledge is outdated.

### Version Metadata Structure

The embedded platform knowledge includes a **Version Metadata** block with:

| Field | Format | Description |
|-------|--------|-------------|
| `spec_version` | Date-based, e.g., `"2026-03"` | The version of the GAS specification reflected in embedded knowledge |
| `spec_last_verified` | ISO date, e.g., `"2026-03-07"` | When embedded knowledge was last verified against official docs |
| `source_url` | URL | The primary official specification URL |
| `notes` | Free text | Context about versioning scheme or known gaps |

Version metadata is in [references/platform-knowledge.md](platform-knowledge.md) > Version Metadata.

### Startup Comparison Flow

On skill invocation, perform a version check before entering the interview. This runs once per session.

**Procedure:**

1. **Read embedded version metadata** — Extract `spec_version` and `spec_last_verified` from platform-knowledge.md.
2. **Resolve GAS library** — Use `resolve-library-id` to locate the Context7 library.
3. **Fetch version indicators** — Use `query-docs` with keywords like `"version changelog updated specification"`.
4. **Compare versions** — Check for explicit version numbers, changelogs, "last updated" dates, or structural changes that differ from embedded knowledge.
5. **Determine staleness**:
   - **Current**: Fetched docs align with embedded knowledge. No drift detected.
   - **Potentially stale**: Minor updates after `spec_last_verified`, no breaking changes.
   - **Likely outdated**: Significant structural changes, removed features, or new required fields.
6. **Take action** based on classification (see below).

**Timing**: This check runs after Stage 1 inputs are gathered and before the interview begins. It should be quick and non-blocking.

### Staleness Warning

**When versions differ (potentially stale):**

Present a clear, concise warning, then offer the user a choice:

> "Embedded GAS knowledge is version {spec_version} (last verified {spec_last_verified}), but the latest documentation suggests updates may be available."
>
> 1. Yes — prefer fetched docs (recommended if accuracy to the latest spec is important)
> 2. No — use embedded knowledge (faster, but may miss recent changes)

**If the user accepts (prefers fetched docs):**
- Treat dynamically fetched documentation as the primary reference
- Use embedded knowledge as a fallback for topics not covered by fetched docs
- Note in the post-generation summary that fetched documentation was used

**If the user declines (prefers embedded knowledge):**
- Proceed with embedded knowledge as the primary reference
- Still use dynamic fetching for on-demand lookups
- Note in the post-generation summary that embedded knowledge was used despite potential differences

**When versions match (current):**
No warning needed. Optionally confirm: "Embedded GAS knowledge is current (version {spec_version}, verified {spec_last_verified})."

### Breaking Spec Changes

When significant structural changes are detected:

> "Warning: Embedded GAS knowledge appears significantly outdated. The latest documentation indicates breaking changes since version {spec_version}:
> - {brief description of changes}
>
> Using embedded knowledge may produce non-conformant skill files. It is strongly recommended to use the dynamically fetched documentation."

Default to using fetched docs. If the user declines, add a prominent warning in the post-generation summary.

### Graceful Degradation

When dynamic fetching fails during the startup version check:

- **Context7 unavailable**: Skip the version comparison entirely. Proceed with embedded knowledge. Do not display a staleness warning.
- **Partial or ambiguous results**: Treat as inconclusive. Proceed with embedded knowledge without warning.
- **Network timeout**: A single retry is acceptable. If retry fails, proceed immediately.

**Key principle**: The version check is a quality enhancement, not a gate. Skill creation always proceeds with embedded knowledge alone. Version checking failures never prevent a user from creating a skill.
