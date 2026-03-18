# Research Procedures

Complete research procedures for skill creation, including dynamic documentation fetching, web search, reference file reading, fallback handling, quality indicators, and spec version tracking.

## Dynamic Documentation Fetching

Use Context7 MCP tools to fetch the latest platform documentation at runtime. Dynamic fetching supplements embedded knowledge with current information and detects when embedded knowledge has become stale.

### Platform Documentation Lookup

Each target platform has a corresponding Context7 library. Use `resolve-library-id` to find the correct library ID, then `query-docs` to pull relevant snippets.

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

**OpenCode:**

```
Step 1: resolve-library-id("opencode skills")
Step 2: query-docs(library_id, "skill specification format frontmatter")
```

Target keywords by need:
- Skill format: `"skill specification format frontmatter"`
- Platform-specific fields: `"opencode skill fields compatibility"`
- Skill loading/discovery: `"skill loading discovery user project global"`

**Codex:**

```
Step 1: resolve-library-id("openai codex skills")
Step 2: query-docs(library_id, "codex skill format agents openai.yaml")
```

Target keywords by need:
- SKILL.md format: `"codex skill format frontmatter markdown"`
- agents/openai.yaml: `"agents openai.yaml interface invocation_policy dependencies"`
- Invocation and matching: `"skill invocation implicit explicit description matching"`
- MCP dependencies: `"openai.yaml dependencies tools MCP"`

### When to Invoke Dynamic Fetching

**On-demand** — User explicitly requests research:
- User says "check the latest docs", "look up the spec", "research this", or similar
- User asks a question about a platform feature you are uncertain about
- User mentions a feature or field not covered in embedded knowledge

**Proactive** — Agent detects uncertainty about platform-specific nuances:
- During the interview, a user describes a capability and you are unsure whether the target platform supports it
- During generation, you encounter a field or structural decision not clearly covered by embedded knowledge
- A documentation gap listed in the platform's "Documentation Gaps" subsection is relevant to the current skill being created
- The user's skill involves features flagged as "experimental" or "evolving" in embedded knowledge

**Startup version comparison** — At the beginning of a session, compare embedded knowledge against fetched docs:
1. Read the `spec_version` and `spec_last_verified` from the relevant platform's Version Metadata in embedded knowledge
2. Use `resolve-library-id` to locate the platform's Context7 library
3. Use `query-docs` with keywords like `"version changelog updated"` to check for version indicators
4. Compare the fetched information against embedded `spec_version` and `spec_last_verified` dates
5. If the fetched docs indicate changes after the `spec_last_verified` date, or if structural differences are detected, flag the embedded knowledge as potentially stale (this feeds into the Spec Version Tracking section)

### Tool Usage Instructions

**`resolve-library-id`** — Find the correct Context7 library ID for a platform.

Call this once per platform per session. Cache the returned library ID for subsequent `query-docs` calls.

```
resolve-library-id(query: string) -> library_id
```

- Use descriptive queries: `"agentskills agent skills specification"`, `"opencode skills"`, `"openai codex skills"`
- If the first query returns no results or an irrelevant library, try alternative queries:
  - GAS alternatives: `"agentskills.io"`, `"generic agent skills"`
  - OpenCode alternatives: `"opencode ai"`, `"charmbracelet crush opencode"`
  - Codex alternatives: `"openai codex"`, `"codex coding agent"`
- Store the resolved library ID for the duration of the session to avoid redundant lookups

**`query-docs`** — Fetch documentation snippets from a resolved library.

```
query-docs(library_id: string, query: string) -> documentation_snippets
```

- Use targeted, specific keywords — not broad queries. Good: `"frontmatter YAML fields required"`. Bad: `"everything about skills"`.
- Combine multiple related terms in a single query for better results: `"agents openai.yaml interface invocation_policy"`
- If a query returns insufficient results, try narrower or alternative keyword combinations
- Limit to the information you actually need — do not fetch entire specifications when you only need one section

### Result Integration

When dynamic documentation is fetched, integrate it with embedded knowledge using these rules:

**Supplementing embedded knowledge:**
- If fetched docs provide additional detail on a topic covered by embedded knowledge (e.g., new optional fields, clarified constraints), merge the new information into your working understanding
- If fetched docs cover a topic not present in embedded knowledge (e.g., a newly added feature), treat it as authoritative and apply it

**Overriding embedded knowledge:**
- If fetched docs conflict with embedded knowledge on a factual matter (e.g., a field is now required that was previously optional, a constraint has changed), prefer the fetched version
- When overriding, note the discrepancy to the user: explain what the embedded knowledge stated, what the fetched docs state, and that you are using the more current information
- Example: "Note: The embedded knowledge lists `allowed-tools` as optional, but the latest documentation indicates it is now a recommended field. Using the updated guidance."

**Discrepancy tracking:**
- Record any discrepancies between embedded and fetched documentation during the session
- Include discrepancies in the post-generation summary (Stage 4.5) so the user is aware of potential knowledge drift
- If multiple discrepancies are found for a platform, recommend updating the embedded knowledge

### Error Handling

**Context7 unavailable or times out:**
- If `resolve-library-id` or `query-docs` fails or times out, fall back to embedded knowledge without interrupting the workflow
- Inform the user: "Context7 documentation fetching is unavailable. Proceeding with embedded platform knowledge (last verified: {spec_last_verified})."
- Do not retry repeatedly — a single retry is acceptable, but if the second attempt fails, proceed with embedded knowledge

**Partial results:**
- If `query-docs` returns results but they seem incomplete or tangential, use what is relevant and supplement with embedded knowledge
- Do not treat partial results as authoritative for topics they do not directly address

**Research status communication:**
- When initiating a dynamic fetch, briefly inform the user: "Checking latest {platform} documentation..."
- When the fetch completes, summarize what was found if it is relevant to the current decision: "Confirmed: the latest docs align with embedded knowledge on {topic}" or "Found updated guidance on {topic}: {brief summary}"
- Keep status updates concise — do not narrate every fetch operation in detail

---

## Web Search

Use web search to find current best practices, community examples, and platform-specific guidance that supplements embedded knowledge. Web search is especially valuable when embedded knowledge has gaps, the user's skill targets a niche domain, or platform documentation has recently changed.

### What to Search For

**Best practices for skill creation:**
- Search for best practices and patterns for creating skills on the target platform
- Look for style guides, authoring tips, and recommended approaches from platform maintainers
- Example queries: "best practices for writing OpenCode skills", "agent skill authoring guide agentskills.io", "Codex skill creation tips"

**Community examples and patterns:**
- Search for open-source skill repositories and example skills on the target platform
- Look for community-shared skills that solve problems similar to the user's skill
- Example queries: "example OpenCode skills github", "Codex skill examples repository", "agentskills.io community skills"

**Platform-specific guidance and tutorials:**
- Search for tutorials, walkthroughs, and how-to guides for the target platform
- Look for platform blog posts or changelogs that discuss skill capabilities
- Example queries: "OpenCode skill tutorial getting started", "Codex custom skill walkthrough", "agent skills specification tutorial"

**Recent changes or updates:**
- Search for recent announcements, release notes, or breaking changes to platform specs
- Especially important when the embedded knowledge `spec_version` date is more than 30 days old
- Example queries: "OpenCode skills spec changes 2026", "Codex skill format updates", "agentskills.io specification changelog"

### When to Invoke Web Search

**On-demand triggers:**
- The user explicitly asks to research something (e.g., "look up how other skills handle X", "search for examples of Y")
- The user mentions a pattern or feature you are uncertain about
- The user asks about recent platform changes or updates

**Proactive triggers:**
- During the interview, the user describes a skill pattern you have limited embedded knowledge about
- The skill targets a niche domain where community examples would improve output quality
- The embedded knowledge `spec_version` is older than 30 days and the user asks about a potentially changed feature
- During generation, you encounter a platform feature not covered by embedded knowledge
- The outline includes capabilities that would benefit from community-validated patterns

**Do not search when:**
- The embedded platform knowledge already covers the topic comprehensively
- The question is about basic skill structure that is well-documented in the embedded knowledge sections
- The user has explicitly said they want to proceed without research

### Handling Search Results

**Filtering and ranking:**
- Prioritize results from official platform documentation and repositories
- Rank community examples by recency (prefer last 6 months) and quality indicators (stars, forks, maintenance activity)
- Discard results that target a different platform than the user's target
- Discard results that describe deprecated or outdated approaches (check dates)

**When results are irrelevant:**
- If search returns no useful results, inform the user: "Web search did not return relevant results for [topic]. Proceeding with embedded knowledge."
- Do not present irrelevant results to the user or incorporate them into the skill
- Consider refining the search query once before giving up — try more specific terms or alternative phrasing

**When results conflict with embedded knowledge:**
- Prefer the web search result if it is from an official source and more recent than the embedded `spec_last_verified` date
- Note the discrepancy to the user: "Web search found that [X] has changed since the last embedded knowledge update. Using the updated approach."
- If the conflict source is unofficial (blog post, community example), flag it as uncertain and ask the user which approach to follow

### Search Failure Handling

- If web search is unavailable or fails, notify the user: "Web search is currently unavailable. Continuing with embedded platform knowledge."
- Do not block the workflow — fall back to embedded knowledge and continue
- Log the search intent so the user can manually research later if desired
- If repeated searches fail, stop attempting web search for the remainder of the session and inform the user once

---

## Reference File Reading

Read existing skill files that the user provides as reference material. This allows the user to share examples, templates, or their own prior skills to inform the creation process.

### How to Use Reference Files

When the user provides a file path to an existing skill (via the `context` argument, during the interview, or at any stage):

1. **Read the file** using the `read` tool. Accept any file format — `.md`, `.yaml`, `.yml`, `.txt`, `.json`, or any other text format
2. **Identify the source platform** by examining the file's structure:
   - YAML frontmatter with `name` + `description` + Markdown body -> GAS or OpenCode skill
   - `agents/openai.yaml` or YAML with `interface` key -> Codex skill
   - Other structured format -> Non-skill reference (documentation, spec, example)
3. **Extract useful patterns** from the reference file:
   - Structural patterns: section organization, heading hierarchy, content flow
   - Content patterns: how instructions are written, level of detail, tone
   - Feature patterns: tool usage, error handling approaches, configuration patterns
   - Platform-specific patterns: frontmatter fields used, platform conventions followed

### Cross-Platform Reference Handling

When the reference file's platform does not match the user's target platform:

- **Warn the user**: "This reference file appears to be a [source platform] skill. Your target platform is [target platform]. I'll extract transferable patterns but will adapt the output to [target platform] conventions."
- **Extract transferable patterns**: Content structure, instruction style, feature design, and workflow patterns are generally transferable across platforms
- **Do not transfer platform-specific elements**: Frontmatter format, file structure conventions, and platform-specific tool references should not be carried over — generate these fresh for the target platform
- **Note differences**: If the reference uses a capability available on its platform but not on the target, inform the user and suggest the closest alternative

### What to Extract from Reference Files

**For informing interview questions:**
- Identify patterns in the reference that suggest questions to ask (e.g., if the reference has an error handling section, ask about error handling for the new skill)
- Use the reference's scope and complexity to calibrate interview depth

**For enhancing the outline:**
- Suggest sections and structure inspired by the reference
- Incorporate best practices visible in the reference's organization
- Flag areas where the reference is strong and the user's skill could benefit from a similar approach

**For guiding generation:**
- Match the reference's instruction style and level of detail when appropriate
- Use the reference as a quality benchmark for the generated output
- Adopt validated structural patterns from the reference (e.g., progressive disclosure via reference files, clear workflow steps)

### When to Invoke Reference File Reading

**On-demand triggers:**
- The user provides a file path and says "use this as a reference" or similar
- The user mentions an existing skill they want to base their new skill on
- The `context` argument contains a file path to an existing skill

**Proactive triggers:**
- During the interview, if the user mentions they have existing skills, ask if they would like to provide one as a reference
- If the user's description closely matches a common skill pattern and they seem uncertain about structure, suggest providing a reference

### Error Handling for Reference Files

**Invalid file paths:**
- If the `read` tool returns an error (file not found, permission denied), inform the user clearly: "Could not read the file at [path]. Please check the path and try again."
- Do not block the workflow — continue without the reference and offer to try again later

**Unreadable or binary files:**
- If the file content is binary or not human-readable text, inform the user: "The file at [path] does not appear to be a text file. Reference files should be text-based (Markdown, YAML, JSON, or plain text)."
- Skip the file and continue

**Empty files:**
- If the file exists but is empty, inform the user: "The file at [path] is empty. No patterns to extract."
- Continue without incorporating reference patterns

---

## Research Result Integration

Research findings from web search and reference files are integrated into the pipeline at three points:

**During the interview (Stage 2):**
- Discovered patterns inform follow-up questions — if research reveals a common best practice, ask the user whether they want to adopt it
- Community examples help calibrate question depth — if similar skills typically include error handling sections, ask about error handling
- Platform-specific findings surface relevant options the user might not know about

**During outline generation (Stage 3):**
- Best practice suggestions are incorporated as recommended sections in the outline
- Reference file patterns inform the outline's structure and level of detail
- Research findings are presented as suggestions, not mandates — the user approves the outline before generation

**During generation (Stage 4):**
- Community-validated approaches guide implementation details (instruction style, section organization, progressive disclosure patterns)
- Platform-specific guidance from web search ensures the generated file follows current conventions
- Reference file quality standards serve as a benchmark for the generated output's depth and clarity

---

## Research Fallback Handling

Graceful degradation when dynamic research sources are unavailable. Skill generation must always succeed regardless of which research sources are accessible. The fallback chain ensures the best available information is used at every stage.

### Fallback Priority Chain

Research sources are attempted in priority order. When a higher-priority source is unavailable, the system falls through to the next level automatically.

| Priority | Source | Availability | Quality Level |
|----------|--------|-------------|---------------|
| 1 (Primary) | Context7 MCP documentation fetching | Requires Context7 MCP tools | Highest — live, versioned platform docs |
| 2 (Secondary) | Web search for docs, examples, best practices | Requires web search capability | High — current community knowledge |
| 3 (Tertiary) | Reference files provided by user | Requires user-supplied file paths | Medium — relevant but potentially dated |
| 4 (Final) | Embedded platform knowledge | Always available | Baseline — comprehensive but may be stale |

Embedded platform knowledge (Priority 4) is always available and serves as the baseline for every research operation. Higher-priority sources supplement and override embedded knowledge when accessible.

### Availability Detection

Each research source has specific failure signals. When a failure is detected, the system transitions to the next source in the chain without blocking the workflow.

**Context7 (Priority 1) failure detection:**
- `resolve-library-id` call fails, throws an error, or times out
- `query-docs` call fails, throws an error, or times out
- Context7 MCP tools are not registered or not accessible in the current environment
- A single retry is acceptable; if the second attempt fails, mark Context7 as unavailable for the session

**Web search (Priority 2) failure detection:**
- Web search tool call fails or returns an error
- Web search returns zero results for a well-formed query
- Web search tool is not available in the current environment
- After two consecutive failures across different queries, mark web search as unavailable for the session

**Reference files (Priority 3) failure detection:**
- No reference files were provided by the user (the `context` argument is empty and no files were shared during the interview)
- All provided file paths fail to read (file not found, permission denied, binary content)
- Reference files are empty or contain no extractable patterns

**Embedded knowledge (Priority 4):**
- Always available — this source cannot fail
- Acts as the terminal fallback for every research operation

### Fallback Transition Behavior

When a source becomes unavailable, the system transitions smoothly to the next level:

**Context7 unavailable — fall through to web search:**
1. Mark Context7 as unavailable for the remainder of the session
2. Attempt the same research intent via web search (translate the Context7 query into appropriate search terms)
3. If web search succeeds, use those results to supplement embedded knowledge

**Web search unavailable — fall through to reference files:**
1. Mark web search as unavailable for the remainder of the session
2. Check whether the user has provided reference files that may contain relevant patterns
3. If reference files exist and contain relevant content, extract patterns to supplement embedded knowledge

**Reference files unavailable — use embedded knowledge only:**
1. No action required — embedded knowledge is already loaded
2. Proceed with embedded platform knowledge as the sole research source

**Partial availability — use what works:**
- If Context7 returns partial or incomplete results, supplement with web search for the missing information
- If Context7 works but web search does not, use Context7 results with embedded knowledge as the supplement
- If only reference files and embedded knowledge are available, use both together
- Any combination of available sources is valid — use all sources that succeed

### Session Research State

Track the availability of each research source throughout the session. This prevents repeated failed attempts and enables accurate status reporting.

**State tracking:**
- Maintain a per-session availability status for each source: `available`, `unavailable`, or `untested`
- All sources start as `untested` at session begin
- Sources transition to `available` on first successful use or `unavailable` after failure (with retry exhausted)
- Once marked `unavailable`, do not re-attempt that source for the remainder of the session
- Log the reason for unavailability (timeout, tool not found, repeated failures) for user communication

### User Communication

Inform the user about research source availability at two points: when a fallback occurs and in the post-generation summary.

**When a fallback transition occurs:**
- Inform the user which source failed and which source the system is falling back to
- Keep the message concise and non-alarming — fallbacks are expected behavior, not errors
- Examples:
  - "Context7 documentation fetching is unavailable. Checking web search for current platform guidance..."
  - "Web search did not return results. Proceeding with embedded platform knowledge (last verified: {spec_last_verified})."
  - "No dynamic research sources are available. Generating with embedded platform knowledge, which was last verified on {spec_last_verified}. Consider providing reference files for additional context."

**When all dynamic sources fail:**
- Deliver a single consolidated message (do not stack multiple failure notifications):
  - "Dynamic research sources (Context7, web search) are unavailable for this session. Generating with embedded platform knowledge (last verified: {spec_last_verified}). The generated skill will be structurally correct but may not reflect the latest platform changes. You can provide reference files at any time to supplement the embedded knowledge."

**In the post-generation summary (Stage 4.5):**
- Include a "Research sources" line in the summary listing which sources were used:
  - "Research sources: Context7 (live docs), web search (community examples), embedded knowledge"
  - "Research sources: Embedded knowledge only (Context7 and web search unavailable)"
  - "Research sources: Web search, user reference files, embedded knowledge (Context7 unavailable)"

---

## Research Quality Indicators

Track and communicate the quality level of the research backing each generated skill. Quality indicators help the user understand how current and comprehensive the research behind their skill is.

### Quality Levels

| Sources Available | Quality Label | Confidence | Notes |
|-------------------|---------------|------------|-------|
| Context7 + any others | "Dynamic research" | High | Live documentation confirms currency |
| Web search + embedded (no Context7) | "Supplemented research" | Medium-High | Community sources supplement embedded knowledge |
| Reference files + embedded (no dynamic) | "Reference-informed" | Medium | User-provided references augment baseline |
| Embedded knowledge only | "Baseline knowledge" | Baseline | Comprehensive but potentially stale |

### Attribution Comment

Include a research attribution comment in the generated skill file, placed after the frontmatter and before the main body content:

```markdown
<!-- Generated by create-skill-opencode | Research: {quality_label} | Platform knowledge last verified: {spec_last_verified} -->
```

Examples:
- `<!-- Generated by create-skill-opencode | Research: Dynamic research (Context7 + web search) | Platform knowledge last verified: 2026-03-07 -->`
- `<!-- Generated by create-skill-opencode | Research: Baseline knowledge only | Platform knowledge last verified: 2026-03-07 -->`
- `<!-- Generated by create-skill-opencode | Research: Reference-informed (user examples + embedded) | Platform knowledge last verified: 2026-03-07 -->`

### Staleness Indicator

When generating with embedded knowledge only (no dynamic sources confirmed the currency of the embedded knowledge), and the `spec_last_verified` date is more than 30 days ago, add a staleness note in the post-generation summary:

- "Note: This skill was generated using embedded knowledge last verified on {spec_last_verified} ({N} days ago) without dynamic research confirmation. Platform specs may have changed since then. Consider running with Context7 available or checking the platform documentation manually."

### Interaction with Other Research Sections

The fallback chain integrates with the existing research subsections as follows:

- **Dynamic Documentation Fetching** (Context7): The error handling in that section covers individual fetch failures. This fallback section governs the session-level decision to stop attempting Context7 and move to the next source.
- **Web Search**: The search failure handling in that section covers individual search failures. This fallback section governs the session-level decision to stop attempting web search.
- **Reference File Reading**: Reference files are passive — they are available if the user provides them. This fallback section clarifies their role as the third-priority source when dynamic sources fail.
- **Research Result Integration**: Integration rules apply regardless of which source produced the results. Whether information comes from Context7, web search, or reference files, the same integration and conflict-resolution rules apply.

---

## Spec Version Tracking

Track embedded platform spec versions and detect when embedded knowledge is outdated. This section defines the version metadata structure, the startup comparison flow, staleness warnings, and graceful degradation behavior.

### Version Metadata Structure

Each embedded platform knowledge section includes a **Version Metadata** block with the following fields:

| Field | Format | Description |
|-------|--------|-------------|
| `spec_version` | Date-based, e.g., `"2026-03"` | The version (or effective date) of the platform specification that the embedded knowledge reflects |
| `spec_last_verified` | ISO date, e.g., `"2026-03-07"` | The date when the embedded knowledge was last verified against the official documentation |
| `source_url` | URL | The primary official specification or documentation URL |
| `notes` | Free text | Context about versioning scheme, known gaps, or platform-specific caveats |

Additional platform-specific URL fields (e.g., `opencode_docs_url`, `github_url`, `official_skills_repo`, `agent_skills_spec_url`) are included where relevant.

**Version metadata is located in each platform reference file:**
- OpenCode: [platform-opencode.md](platform-opencode.md) > Version Metadata
- GAS: [platform-gas.md](platform-gas.md) > Version Metadata
- Codex: [platform-codex.md](platform-codex.md) > Version Metadata

### Startup Comparison Flow

On skill invocation, perform a version check for the selected target platform before entering the interview. This comparison runs once per session per platform.

**Step-by-step procedure:**

1. **Read embedded version metadata** — Extract `spec_version` and `spec_last_verified` from the selected platform's Version Metadata block in the platform reference file.

2. **Resolve platform library** — Use `resolve-library-id` to locate the platform's Context7 library (see Dynamic Documentation Fetching > Platform Documentation Lookup for queries).

3. **Fetch version indicators** — Use `query-docs` with keywords like `"version changelog updated specification"` to retrieve version-related information from the latest documentation.

4. **Compare versions** — Evaluate whether the fetched documentation indicates changes since the embedded `spec_last_verified` date:
   - Look for explicit version numbers, changelogs, "last updated" dates, or structural changes in the fetched content
   - Compare any version identifiers found against the embedded `spec_version`
   - Check for new fields, removed fields, changed constraints, or restructured formats that differ from embedded knowledge

5. **Determine staleness** — Classify the result:
   - **Current**: Fetched docs align with embedded knowledge. No version drift detected.
   - **Potentially stale**: Fetched docs indicate minor updates or additions after `spec_last_verified`, but no breaking changes.
   - **Likely outdated**: Fetched docs reveal significant structural changes, removed features, or new required fields not reflected in embedded knowledge.

6. **Take action** — Based on the staleness classification, follow the appropriate response (see Staleness Warning and Breaking Spec Changes below).

**Timing**: This check runs after the user selects a target platform (Stage 1, Step 4) and before the interview begins (Stage 2). It should feel quick and non-blocking. If the check takes too long, proceed with the interview and note the pending version check.

### Staleness Warning

When the startup comparison detects that embedded knowledge is potentially stale, inform the user and offer options.

**When versions differ (potentially stale):**

Present a clear, concise warning:

```
"Embedded knowledge for {platform} is version {spec_version} (last verified {spec_last_verified}),
but the latest documentation suggests updates may be available."
```

Then offer the user a choice:

```
"Would you like me to use the dynamically fetched documentation as the primary reference for
{platform}? This ensures the generated skill reflects the latest spec, but may take slightly
longer due to additional documentation lookups.

1. Yes — prefer fetched docs (recommended if accuracy to the latest spec is important)
2. No — use embedded knowledge (faster, but may miss recent changes)"
```

**If the user accepts (prefers fetched docs):**
- Adjust generation to treat dynamically fetched documentation as the primary reference for the selected platform
- Use embedded knowledge as a fallback for topics not covered by the fetched docs
- Note in the post-generation summary that dynamically fetched documentation was used as the primary source
- During generation, proactively fetch docs for each major section rather than relying on embedded knowledge alone

**If the user declines (prefers embedded knowledge):**
- Proceed with embedded knowledge as the primary reference
- Still use dynamic fetching for on-demand and proactive lookups as described in Dynamic Documentation Fetching
- Note in the post-generation summary that embedded knowledge was used despite a potential version difference

**When versions match (current):**

No warning is needed. Optionally, provide a brief confirmation:

```
"Embedded {platform} knowledge is current (version {spec_version}, verified {spec_last_verified})."
```

### Breaking Spec Changes

When the startup comparison detects significant structural changes (likely outdated classification), escalate the warning:

```
"Warning: Embedded knowledge for {platform} appears significantly outdated. The latest
documentation indicates breaking changes since version {spec_version}:
- {brief description of detected changes, e.g., 'new required field: X', 'removed field: Y'}

Using embedded knowledge may produce skill files that do not conform to the current spec.
It is strongly recommended to use the dynamically fetched documentation as the primary reference."
```

In this case:
- Default to using fetched docs as the primary reference (the user can still decline, but the recommendation is strong)
- If the user still prefers embedded knowledge, proceed but add a prominent warning in the post-generation summary about potential spec non-compliance
- During generation, flag any sections where embedded knowledge may conflict with the detected changes

### Graceful Degradation

When dynamic fetching fails during the startup version check, the skill must not block the workflow.

**Context7 unavailable or times out:**
- Skip the version comparison entirely
- Proceed with embedded knowledge as the primary reference
- Do not display a staleness warning (since no comparison was possible)
- Inform the user only if they explicitly asked for a version check: "Unable to check for spec updates — Context7 is unavailable. Proceeding with embedded knowledge (last verified: {spec_last_verified})."

**Partial or ambiguous fetch results:**
- If the fetched content does not contain clear version indicators, treat the comparison as inconclusive
- Proceed with embedded knowledge without a staleness warning
- Do not guess or infer staleness from ambiguous signals

**Version comparison logic fails:**
- If parsing or comparing version information raises an error, catch it silently
- Proceed with embedded knowledge
- Do not block the interview or generation pipeline for version checking failures

**Network timeout handling:**
- A single retry is acceptable for transient failures
- If the retry also fails, proceed immediately with embedded knowledge
- Do not retry more than once — the version check is informational, not critical

**Key principle**: The version check is a quality enhancement, not a gate. The skill must always be able to proceed with embedded knowledge alone. Version checking failures should never prevent a user from creating a skill.
