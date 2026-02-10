---
name: deep-analysis
description: Reusable deep exploration and synthesis workflow. Use when asked for "deep analysis", "deep understanding", "analyze codebase", "explore and analyze", or "investigate codebase".
argument-hint: <analysis-context or focus-area>
user-invocable: true
disable-model-invocation: false
---

# Deep Analysis Workflow

Execute a structured exploration + synthesis workflow within a single context. This skill can be invoked standalone or loaded by other skills as a reusable building block.

## Phase 1: Reconnaissance

**Goal:** Quick codebase mapping to determine structure and focus areas.

1. **Determine analysis context:**
   - If `$ARGUMENTS` is provided, use it as the analysis context (feature area, question, or general exploration goal)
   - If no arguments and this skill was loaded by another skill, use the calling skill's context
   - If no arguments and standalone invocation, set context to "general codebase understanding"
   - Set `PATH = current working directory`
   - Inform the user: "Exploring codebase at: `PATH`" with the analysis context

2. **Quick codebase mapping:**
   - Use Glob to map the top-level directory structure (`*`, `*/*`)
   - Read key config files: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `tsconfig.json`, `README.md`, `CLAUDE.md` (whichever exist)
   - Identify the primary language, framework, and project type

3. **Load guidance skills:**
   - Read `../project-conventions/SKILL.md` and apply its guidance
   - Read `../language-patterns/SKILL.md` and apply its guidance

4. **Determine focus areas (2-3 based on context):**
   - For feature-focused analysis:
     ```
     Focus 1: Entry points and user-facing code related to the context
     Focus 2: Data models, schemas, and storage related to the context
     Focus 3: Utilities, helpers, and shared infrastructure
     ```
   - For general codebase understanding:
     ```
     Focus 1: Application structure, entry points, and core logic
     Focus 2: Configuration, infrastructure, and shared utilities
     ```

---

## Phase 2: Systematic Exploration

**Goal:** Thoroughly explore the codebase to gather raw findings for each focus area.

Execute the following for **each focus area sequentially**:

### Exploration Strategies

For each focus area, apply these four strategies in order:

#### 1. Start from Entry Points
- Find where similar features are exposed (routes, CLI commands, UI components)
- Trace the execution path from user interaction to data storage
- Identify the layers of the application

#### 2. Follow the Data
- Find data models and schemas related to the feature
- Trace how data flows through the system
- Identify validation, transformation, and persistence points

#### 3. Find Similar Features
- Search for features with similar functionality
- Study their implementation patterns
- Note reusable components and utilities

#### 4. Map Dependencies
- Identify shared utilities and helpers
- Find configuration files that affect the feature area
- Note external dependencies that might be relevant

### Search Techniques

Use these tools effectively during exploration:

**Glob** — Find files by pattern:
- `**/*.ts` - All TypeScript files
- `**/test*/**` - All test directories
- `src/**/*user*` - Files with "user" in the name

**Grep** — Search file contents:
- Search for function/class names
- Find import statements
- Locate configuration keys
- Search for comments and TODOs

**Read** — Examine file contents:
- Read key files completely
- Understand the structure and exports
- Note coding patterns used

### Recording Findings

For each focus area, record findings in this structure:

```markdown
### Focus Area: [Name]

#### Key Files Found
| File | Purpose | Relevance |
|------|---------|-----------|
| path/to/file.ts | Brief description | High/Medium/Low |

#### Code Patterns Observed
- Pattern 1: Description
- Pattern 2: Description

#### Important Functions/Classes
- `functionName` in `file.ts`: What it does
- `ClassName` in `file.ts`: What it represents

#### Integration Points
1. Integration point 1
2. Integration point 2

#### Potential Challenges
- Challenge 1: Description
- Challenge 2: Description
```

### Exploration Guidelines

1. **Be thorough but focused** — Explore deeply in the assigned area, don't wander into unrelated code
2. **Read before reporting** — Actually read the files, don't just list them
3. **Note patterns** — The implementation should follow existing patterns
4. **Flag concerns** — If you see potential issues, report them
5. **Quantify relevance** — Indicate how relevant each finding is

---

## Phase 3: Synthesis

**Goal:** Merge exploration findings into a unified analysis.

### Step 1: Merge Findings

- Combine file lists from all focus area explorations
- Deduplicate entries (same file found in multiple focus areas)
- Reconcile conflicting assessments (if focus areas disagree on relevance, investigate)
- Preserve unique insights from each focus area

### Step 2: Read Critical Files in Depth

- Read all files identified as high-relevance across focus areas
- Read files where focus areas provided incomplete analysis
- Read configuration files that affect the analyzed area
- Build a concrete understanding — don't rely solely on exploration summaries

### Step 3: Map Relationships

- Trace how critical files connect to each other (imports, calls, data flow)
- Identify the dependency direction between components
- Map entry points to their downstream effects
- Note circular dependencies or tight coupling

### Step 4: Identify Patterns

- Catalog recurring code patterns and conventions
- Note naming conventions, file organization, and architectural style
- Identify shared abstractions (base classes, utilities, middleware)
- Flag deviations from established patterns

### Step 5: Assess Challenges

- Identify technical risks and complexity hotspots
- Note areas with high coupling or unclear boundaries
- Flag potential breaking changes or migration concerns
- Assess test coverage gaps in critical areas

### Synthesis Output Format

Structure your synthesis as follows:

```markdown
## Synthesized Analysis

### Architecture Overview
[2-3 paragraph summary of how the analyzed area is structured, its key layers, and the overall design philosophy]

### Critical Files

| File | Purpose | Relevance | Connections |
|------|---------|-----------|-------------|
| path/to/file | What it does | High/Medium | Which other critical files it connects to |

#### File Details
For each critical file, provide:
- **Key exports/interfaces** that other files depend on
- **Core logic** that would be affected by changes
- **Notable patterns** used in this file

### Relationship Map
[Describe how the critical files connect to each other]
- Component A → calls → Component B
- Component B → depends on → Component C
- Data flows from X through Y to Z

### Patterns & Conventions
- **Pattern 1**: Description and where it's used
- **Pattern 2**: Description and where it's used
- **Convention 1**: Description (e.g., naming, structure)

### Challenges & Risks
| Challenge | Severity | Details |
|-----------|----------|---------|
| Challenge 1 | High/Medium/Low | Description and potential impact |

### Recommendations
1. [Actionable recommendation based on findings]
2. [Another recommendation]

### Open Questions
- [Anything that couldn't be determined from exploration alone]
```

### Synthesis Guidelines

1. **Synthesize, don't summarize** — Add value by connecting findings across focus areas, not just restating them
2. **Read deeply** — Actually read the critical files rather than trusting exploration notes alone
3. **Map relationships** — The connections between files are often more important than individual file descriptions
4. **Be specific** — Reference exact file paths, function names, and line numbers where relevant
5. **Stay focused** — Only include findings relevant to the analysis context; omit tangential discoveries

### Handling Incomplete Exploration

If exploration has gaps:
- Use Glob to find files that may have been missed
- Use Grep to search for patterns mentioned but not fully traced
- Note what information is missing and cannot be determined
- Distinguish between confirmed findings and inferences

---

## Completion

- **Standalone invocation:** Present the synthesized analysis to the user. The results remain in conversation memory for follow-up questions.
- **Loaded by another skill:** The synthesis is complete. Control returns to the calling workflow — do not present a standalone summary.

---

## Error Handling

If any phase fails:
1. Explain what went wrong
2. Ask the user how to proceed:
   - Retry the phase
   - Continue with partial results
   - Abort the analysis
