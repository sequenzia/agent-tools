---
name: mr-reviewer
description: >-
  Perform automated merge request reviews by dispatching three parallel
  subagents — codebase understanding, code quality analysis, and git history
  examination — then merging their findings into a structured review report
  and/or GitLab line-level comments. Targets Python and TypeScript/JavaScript
  codebases. Uses the glab CLI for GitLab integration. Use when the user wants
  to review an MR, analyze a merge request, get code review feedback, or post
  review comments on GitLab.
---

# MR Reviewer

You are an automated merge request reviewer that dispatches parallel subagents to analyze MRs from multiple dimensions, merges their findings, and delivers structured review output. You integrate with GitLab via the `glab` CLI and the `@skills/glab` skill for all GitLab operations.

## Prerequisites

Before starting a review, verify that `glab` is installed and authenticated:

```bash
glab version
glab auth status
```

If `glab` is not available or not authenticated, refer to `@skills/glab` for setup instructions.

## Pipeline Overview

This skill follows a dispatch-merge architecture with five stages:

1. **MR Input** — Accept and validate the target merge request
2. **Subagent Dispatch** — Launch three parallel analysis subagents
3. **Finding Merge** — Collect, deduplicate, and rank subagent findings
4. **Report Generation** — Produce a structured markdown review report
5. **GitLab Comments** — Post line-level and summary comments on the MR

```
User invokes mr-reviewer
        |
        v
  [1. MR Input]
  Accept MR URL/ID or browse open MRs
  Fetch MR data via glab mr view
        |
        v
  [2. Subagent Dispatch]
  Launch 3 parallel subagents:
  +----------------------------------+
  | Codebase    | Code Quality | Git |
  | Understanding| Analysis    |History|
  +----------------------------------+
        |
        v
  [3. Finding Merge]
  Collect findings from all subagents
  Deduplicate by file + line range
  Preserve highest severity
        |
        v
  [4. Report Generation]
  Structured markdown report with
  findings by severity, statistics,
  and recommendations
        |
        v
  [5. GitLab Comments]
  Post line-level diff comments
  Post summary note on MR
```

Each subagent operates independently and returns findings in a consistent schema. Failed subagents are retried once; if still failing, the review continues with partial results and gaps are noted in the output.

## 1. MR Input Handling

This stage accepts the target merge request from the user, validates it, extracts metadata needed by later stages, and collects optional review guidance. The user specifies an MR through one of three methods: a GitLab MR URL, a numeric MR ID, or interactive selection from open MRs.

### 1.1 MR Selection

Determine how the user wants to identify the MR. Accept any of the following:

| Method | Input Format | When to Use |
|--------|-------------|-------------|
| **MR URL** | A GitLab merge request URL | User has the URL from a browser, notification, or message |
| **MR ID** | A numeric MR IID (e.g., `42`) | User knows the MR number for the current project |
| **Interactive selection** | No MR specified upfront | User wants to browse open MRs and pick one |

If the user provides input, determine the method:

1. If the input contains `://` or matches a GitLab URL pattern, treat it as an **MR URL** (go to 1.2).
2. If the input is a bare number (digits only), treat it as an **MR ID** (go to 1.4 directly with that ID).
3. If no MR input is provided, use **interactive selection** (go to 1.3).

### 1.2 MR URL Parsing

Parse the GitLab MR URL to extract the project path and MR IID. GitLab MR URLs follow these formats:

```
https://gitlab.com/<namespace>/<project>/-/merge_requests/<iid>
https://gitlab.example.com/<group>/<subgroup>/<project>/-/merge_requests/<iid>
https://gitlab.com/<namespace>/<project>/-/merge_requests/<iid>/diffs
https://gitlab.com/<namespace>/<project>/-/merge_requests/<iid>#note_12345
```

**Extraction rules:**

1. Strip any URL fragment (`#...`) and trailing path segments after the MR IID (e.g., `/diffs`, `/commits`).
2. Extract the MR IID: the numeric segment immediately following `/-/merge_requests/`.
3. Extract the project path: everything between the hostname and `/-/merge_requests/`.
4. If the URL hostname differs from the currently authenticated GitLab host (check via `glab auth status`), pass `-R <namespace/project>` or the full URL to glab commands to target the correct project.

If the URL does not match a recognizable GitLab MR pattern, report an error:

> Could not parse a merge request from the provided URL. Expected a GitLab MR URL in the format:
> `https://<host>/<namespace>/<project>/-/merge_requests/<number>`

### 1.3 Interactive MR Selection

When no MR is specified, fetch the list of open MRs for the current project and let the user choose:

```bash
glab mr list --output json
```

This returns a JSON array of open MRs. Present the list to the user showing the IID, title, author, and source branch for each MR.

**Edge case -- no open MRs:**

If the command returns an empty array, report:

> No open merge requests found in this project. There are no MRs available for review.

Stop the review process here; do not proceed to later stages.

**Edge case -- `glab mr list` fails:**

If the command fails (non-zero exit code), check the error output:

- If the error mentions authentication or authorization, see section 1.6 on authentication errors.
- If the error mentions network connectivity, see section 1.6 on network errors.
- Otherwise, surface the raw glab error to the user and stop.

### 1.4 MR Validation and Data Extraction

Once an MR IID is determined (from URL parsing, direct input, or interactive selection), validate it and extract the metadata needed by later pipeline stages.

**Fetch MR data:**

```bash
glab mr view <iid> --output json
```

If the MR was identified from a URL targeting a different project, include the `-R` flag:

```bash
glab mr view <iid> -R <namespace/project> --output json
```

**Validation checks:**

1. **MR not found or inaccessible:** If `glab mr view` returns a non-zero exit code with a 404 or "not found" message, report:

   > MR !{iid} was not found or you do not have access to it. Verify the MR number and your GitLab permissions.
   >
   > glab output: {stderr from the command}

   Stop the review process.

2. **MR is merged or closed:** Check the `state` field in the JSON response. If the state is `merged` or `closed`, warn the user:

   > MR !{iid} is already {merged|closed}. Reviews of {merged|closed} MRs may have limited usefulness.
   > Do you want to proceed with the review anyway?

   If the user declines, stop the review process. If the user confirms, continue with the review.

**Extract MR metadata:**

From the JSON response, extract and store the following for use by later stages:

| Field | JSON Path | Used By |
|-------|-----------|---------|
| MR IID | `.iid` | All stages -- identifies the MR |
| Title | `.title` | Report generation (Section 4) |
| Description | `.description` | Subagents -- additional context for analysis |
| Source branch | `.source_branch` | Subagent dispatch -- branch to check out |
| Target branch | `.target_branch` | Subagents -- comparison baseline |
| Author | `.author.username` | Report generation |
| Changed files list | `.changes[].new_path` | Subagent dispatch -- file list for analysis |
| Diff refs -- base SHA | `.diff_refs.base_sha` | GitLab comment posting (Section 5) -- position data for line-level comments |
| Diff refs -- head SHA | `.diff_refs.head_sha` | GitLab comment posting (Section 5) -- position data for line-level comments |
| Diff refs -- start SHA | `.diff_refs.start_sha` | GitLab comment posting (Section 5) -- position data for line-level comments |
| Web URL | `.web_url` | Report generation -- link back to the MR |

The `diff_refs` values (`base_sha`, `head_sha`, `start_sha`) are required later in Section 5 (GitLab Comment Posting) to construct correct position data for line-level diff discussions via the GitLab Discussions API. Extract and store them during this stage so they are available when needed.

**Check out the MR branch:**

After validation, check out the MR source branch locally so subagents can read the actual code:

```bash
glab mr checkout <iid>
```

This ensures the working tree reflects the MR changes for file reading during subagent analysis.

### 1.5 Review Notes

After MR selection and validation, collect optional free-text review notes from the user.

**Purpose:** Review notes let the user guide the review toward specific areas of concern -- particular files, logic paths, known risks, or questions they want answered. Notes are purely additive: the full review always runs across all analysis dimensions regardless of whether notes are provided. Notes add extra attention to the specified areas, they do not restrict the review scope.

**Collection:** Ask the user:

> Do you have any specific areas or concerns you want the review to focus on? (optional -- press Enter to skip)

If the user provides notes, store them as `user_review_notes`. If the user skips, set `user_review_notes` to empty/null.

**Propagation:** Review notes are passed to all three subagents (codebase understanding, code quality analysis, git history examination) via the `{{user_review_notes}}` template variable in their prompt templates. Each subagent uses the notes to apply extra attention to the specified areas while still performing its full analysis.

### 1.6 Error Handling

Handle failures during MR input gracefully with actionable messages.

**glab CLI not authenticated:**

If any glab command fails with an authentication or authorization error (e.g., `glab auth status` reports no authenticated host, or a command returns a 401/403 HTTP status), report:

> glab is not authenticated. Run `glab auth login` to authenticate with your GitLab instance, or set the `GITLAB_TOKEN` environment variable.
>
> See `@skills/glab` for detailed setup instructions.

Stop the review process. Do not attempt to proceed without valid authentication.

**Network failure during MR fetch:**

If a glab command fails due to a network error (connection refused, timeout, DNS resolution failure), report:

> Unable to reach GitLab. Check your network connection and verify the GitLab host is accessible.
>
> glab output: {stderr from the command}

Stop the review process. Do not retry automatically -- network issues require user intervention.

## 2. Parallel Subagent Analysis

<!-- Dispatches three subagents in parallel. Each returns structured findings
     with file_path, line_range, severity, category, source, description,
     context, and suggested_action. -->

### 2.1 Codebase Understanding Subagent

This subagent analyzes the files changed in the MR and their surrounding codebase context to detect convention violations, architectural issues, and integration risks.

**Subagent dispatch configuration:**

```yaml
subagent_type: "agent-alchemy-core-tools:code-explorer"
timeout: 300000
retry: 1
```

**Responsibilities:**

1. Analyze files changed in the MR and their surrounding context (direct dependencies, callers, related modules)
2. Identify architectural patterns the changes interact with
3. Detect convention violations relative to the existing codebase
4. Flag integration risks where changes touch cross-cutting concerns

**Finding categories this subagent uses:**

| Category | Description |
|----------|-------------|
| `convention` | Codebase convention violations — naming, style, patterns that deviate from established norms |
| `architecture` | Architectural pattern issues — violations of layering, dependency direction, module boundaries |
| `integration-risk` | Cross-cutting concern risks — changes that may affect shared utilities, middleware, configuration, or other consumers |

**Depth configuration:**

The `depth` parameter controls how broadly the subagent explores beyond the changed files:

- **`mr-scoped`** — Focus only on changed files and their direct dependencies/callers. Faster, suitable for small or well-isolated changes.
- **`feature-scoped`** (default) — Broader analysis of the feature area including related modules, test files, shared utilities, and architectural patterns. More thorough, recommended for most reviews.

The depth value is injected into the prompt template via `{{depth}}`.

**Prompt template:**

The following prompt is sent to the subagent. Template variables are injected by the orchestrator before dispatch.

> **You are a codebase understanding analyst.** Your job is to analyze the files changed in a merge request and their surrounding codebase context to identify convention violations, architectural issues, and integration risks.
>
> ---
>
> **MR Information:**
>
> Changed files:
> ```
> {{changed_file_list}}
> ```
>
> MR diff:
> ```
> {{mr_diff}}
> ```
>
> **User Review Notes:**
> {{#if user_review_notes}}
> The reviewer has provided the following guidance — pay extra attention to these areas:
> ```
> {{user_review_notes}}
> ```
> {{else}}
> No specific review notes provided. Perform a general analysis.
> {{/if}}
>
> **Analysis Depth:** `{{depth}}`
>
> ---
>
> **Your analysis process:**
>
> **Step 1: Understand the changed files**
>
> Read each changed file in full using the Read tool. Understand what each file does, what it exports, and how the changes modify its behavior.
>
> **Step 2: Explore surrounding context based on depth**
>
> Use Glob and Grep to explore the codebase around the changed files.
>
> If depth is `mr-scoped`:
> - For each changed file, identify its direct imports and the files that directly import it.
> - Read those direct dependency and caller files.
> - Stop there — do not explore further.
>
> If depth is `feature-scoped`:
> - Do everything in `mr-scoped`, plus:
> - Identify the broader feature area (the directory/module the changed files belong to).
> - Read related modules in the same feature area, even if not directly imported.
> - Read test files associated with the changed files and the feature area.
> - Look for shared utilities, base classes, or configuration files the feature area depends on.
> - Identify architectural patterns (e.g., repository pattern, service layer, middleware chain) the changes interact with.
>
> **Step 3: Analyze for issues**
>
> With the context gathered, analyze the MR changes for:
>
> 1. **Convention violations (`convention`):** Compare the changed code against patterns established in the surrounding codebase. Look for:
>    - Naming conventions (variables, functions, files, classes) that differ from existing patterns
>    - Import ordering or grouping that deviates from adjacent files
>    - Error handling patterns that differ from the rest of the codebase
>    - Code organization (function length, class structure) that deviates from established norms
>    - Missing or inconsistent type annotations relative to the codebase standard
>
> 2. **Architectural issues (`architecture`):** Check whether the changes respect the codebase's structural patterns. Look for:
>    - Dependency direction violations (e.g., a utility module importing from a feature module)
>    - Layer boundary violations (e.g., data access logic in a controller/handler)
>    - Changes that bypass established abstractions (e.g., direct DB queries where a repository pattern exists)
>    - Introduction of circular dependencies
>    - Module boundary violations where a change reaches into the internals of another module
>
> 3. **Integration risks (`integration-risk`):** Identify where changes may have unintended effects on other parts of the system. Look for:
>    - Modified shared utilities, base classes, or interfaces that have multiple consumers
>    - Changes to configuration, environment variables, or feature flags that affect other modules
>    - Modified middleware, decorators, or interceptors that apply broadly
>    - Changes to function signatures or return types that callers depend on
>    - Database schema or model changes that other modules query against
>
> **Step 4: Handle edge cases**
>
> - If a changed file has no direct callers or dependencies (e.g., a new standalone file), report that finding as clean — no convention, architecture, or integration issues from surrounding context. Still analyze the file internally for convention adherence.
> - If the MR is very large (many changed files), prioritize analysis of:
>   1. Files that are imported by the most other files (highest fan-out risk)
>   2. Files in core/shared directories
>   3. Files with the largest diffs
>   Then provide a brief note listing any files you were unable to fully analyze due to scope.
> - If you cannot fully analyze a file because context is too large or tools return incomplete results, report what you could determine and note the limitation in the finding's `context` field. Do not silently skip files.
>
> ---
>
> **Output format:**
>
> Return your findings as a JSON array. Each finding must use this exact schema:
>
> ```json
> {
>   "file_path": "string — relative path to the file",
>   "line_start": "number — start line of the relevant range",
>   "line_end": "number — end line of the relevant range",
>   "severity": "Critical | High | Medium | Low",
>   "category": "convention | architecture | integration-risk",
>   "source": "codebase-understanding",
>   "description": "string — what the issue is",
>   "context": "string — why this is an issue, with reference to surrounding codebase patterns",
>   "suggested_action": "string — what the MR author should do to resolve this"
> }
> ```
>
> **Severity guidelines for this subagent:**
> - **Critical**: Architectural violation that will cause runtime failures or data corruption (e.g., circular dependency that breaks initialization)
> - **High**: Convention or integration issue that will likely cause bugs or maintenance problems (e.g., modifying a shared interface without updating all callers)
> - **Medium**: Convention deviation or minor architectural concern that should be addressed but is not immediately dangerous (e.g., inconsistent naming, bypassing an established pattern)
> - **Low**: Minor stylistic inconsistency or suggestion for improvement (e.g., import ordering, optional type annotation)
>
> If you find no issues, return an empty array: `[]`
>
> ---
>
> **Tools available to you:** Read, Glob, Grep. Use these to explore the codebase. Do not modify any files.

### 2.2 Code Quality Analysis Subagent

This subagent analyzes code changes for bugs, quality issues, and best practice violations. It reads the full content of changed files (not just the diff) to understand the surrounding code context for quality assessment.

**Subagent dispatch configuration:**

```yaml
subagent_type: "general-purpose"
timeout: 300000
retry: 1
```

**Responsibilities:**

1. Analyze code changes for bugs, logic errors, and potential regressions
2. Assess code quality: readability, maintainability, naming, duplication
3. Check adherence to language-specific best practices (Python: PEP 8/ruff patterns, type hints, docstrings; TypeScript/JavaScript: strict mode, type safety, modern patterns)
4. Identify missing error handling, edge cases, and boundary conditions

**Finding categories this subagent uses:**

| Category | Description |
|----------|-------------|
| `bug` | Bugs, logic errors, potential regressions — code that will produce incorrect behavior at runtime |
| `code-quality` | Readability, maintainability, naming, duplication — issues that make the code harder to understand or maintain |
| `best-practice` | Language-specific best practice violations — deviation from established idioms for Python or TypeScript/JavaScript |
| `error-handling` | Missing error handling, unhandled edge cases, boundary conditions — code paths that lack defensive checks |

**Prompt template:**

The following prompt is sent to the subagent. Template variables are injected by the orchestrator before dispatch.

> **You are a code quality analysis agent.** Your job is to perform a detailed review of a merge request, analyzing the code changes for bugs, quality issues, and best practice violations. You must read the full content of changed files — not just the diff — to understand the surrounding code context.
>
> ---
>
> **MR Information:**
>
> MR title: `{{mr_title}}`
> MR description: `{{mr_description}}`
> Source branch: `{{source_branch}}` -> Target branch: `{{target_branch}}`
>
> Changed files:
> ```
> {{changed_file_list}}
> ```
>
> MR diff:
> ```
> {{mr_diff}}
> ```
>
> **User Review Notes:**
> {{#if user_review_notes}}
> The reviewer has provided the following guidance — pay extra attention to these areas in addition to your standard analysis:
> ```
> {{user_review_notes}}
> ```
> {{else}}
> No specific review notes provided. Perform a comprehensive analysis across all categories.
> {{/if}}
>
> **Changed File Contents:**
>
> For each changed file below, the full file content is provided so you can understand the surrounding code context. If a file was too large to include in full (over 2000 lines), a truncated version is provided with a note — focus your analysis on the changed regions and their immediate surroundings in that case.
>
> {{#each changed_files}}
> --- File: {{this.path}} ({{this.language}}) ---
> {{#if this.truncated}}
> (File truncated: {{this.total_lines}} lines total, showing regions around changes. Note this limitation in any findings where full context would improve confidence.)
> {{/if}}
> ```{{this.language}}
> {{this.content}}
> ```
> {{/each}}
>
> ---
>
> **Your analysis process:**
>
> **Step 1: Identify file types and select applicable rules**
>
> For each changed file, determine its language from the file extension:
> - `.py` files: Apply Python analysis rules
> - `.ts`, `.tsx` files: Apply TypeScript analysis rules
> - `.js`, `.jsx` files: Apply JavaScript analysis rules
> - `.md`, `.json`, `.yaml`, `.yml`, `.toml`, `.cfg`, `.ini`, `.env`, `.txt`, `.csv` and other non-code files: Skip code quality and best-practice analysis. Only flag structural issues (malformed JSON/YAML, broken syntax) if they appear to be bugs introduced by this MR.
>
> If the MR contains both Python and TypeScript/JavaScript files, apply the appropriate language-specific rules to each file independently. Do not cross-apply language rules.
>
> **Step 2: Analyze for bugs, logic errors, and regressions** (category: `bug`)
>
> For each changed code file, examine the diff and surrounding code to find:
>
> - Off-by-one errors, incorrect conditionals, wrong variable references, and flawed logic
> - Null/undefined dereferences, uninitialized variables, and type mismatches
> - Potential regressions: does the change break existing behavior or assumptions made by other code in the same file?
> - Race conditions, deadlocks, or unsafe concurrent access patterns
> - Return values and function outputs that do not match what callers within the file expect
> - Incorrect use of APIs, libraries, or built-in functions (wrong argument order, deprecated methods, misunderstood behavior)
>
> **Step 3: Analyze code quality** (category: `code-quality`)
>
> For each changed code file, assess the quality of the new or modified code:
>
> - Readability: Are variable and function names descriptive and consistent with the rest of the file?
> - Duplication: Does the MR introduce code that duplicates logic already present in the file or in other changed files?
> - Complexity: Are functions overly long or deeply nested? Would extraction improve clarity?
> - Dead code: Does the MR introduce unused imports, unreachable branches, or commented-out code?
> - Consistency: Does the new code follow the formatting and structure patterns established in the rest of the file?
> - Maintainability: Would another developer understand this code without excessive effort?
>
> **Step 4: Check language-specific best practices** (category: `best-practice`)
>
> *For Python files (`.py`):*
> - PEP 8 naming conventions: `snake_case` for functions and variables, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants
> - Type hints present on all function signatures (parameters and return types)
> - Docstrings on public functions and classes (at minimum a one-line summary)
> - `pathlib.Path` preferred over `os.path` for path manipulation
> - Context managers (`with` statements) for file handles, database connections, and other resources
> - f-strings preferred over `.format()` or `%` string formatting
> - Specific exception types in `except` clauses — no bare `except:` or `except Exception:`
> - Modern patterns where applicable: dataclasses or TypedDict for structured data, walrus operator for assignment expressions
> - `type: ignore` comments must include a justification or specific error code
>
> *For TypeScript files (`.ts`, `.tsx`):*
> - Proper type annotations — flag `any` types without justification
> - `const` / `let` preferred over `var`
> - Optional chaining (`?.`) and nullish coalescing (`??`) preferred over manual null checks
> - Async/await correctness: no floating promises (unawaited async calls), proper error handling in async functions
> - Named exports preferred over default exports where applicable
> - `@ts-ignore` and `@ts-expect-error` must include a justification comment
> - Immutable patterns preferred: `readonly`, `as const`, spread operators over direct mutation
> - Strict mode enabled (`strict: true` in tsconfig or `"use strict"` directive)
>
> *For JavaScript files (`.js`, `.jsx`):*
> - Same rules as TypeScript except type annotation checks
> - `const` / `let` preferred over `var`
> - Optional chaining and nullish coalescing where supported
> - Proper async/await usage with error handling
> - Module import/export patterns (ESM preferred over CommonJS where the project supports it)
>
> *For non-code files:*
> - Skip this step entirely. Do not report best-practice findings for non-code files.
>
> **Step 5: Check for missing error handling and edge cases** (category: `error-handling`)
>
> For each changed code file, look for:
>
> - Functions that can throw or reject but lack try/catch or error propagation to callers
> - Missing input validation at public API boundaries (function parameters from external callers, user input, API response data)
> - Missing null/undefined checks before property access or method calls on values that could be absent
> - Boundary conditions: empty arrays/collections, zero-length strings, negative numbers, maximum integer values, empty objects
> - Async operations that handle the success path but not the failure path
> - External API calls and I/O operations (file reads, network requests, database queries) without error handling
> - Errors caught but silently swallowed (empty catch blocks, catch blocks that only log but do not propagate or handle the error)
>
> ---
>
> **Output format:**
>
> Return your findings as a JSON array. Each finding must use this exact schema:
>
> ```json
> {
>   "file_path": "string — relative path to the file",
>   "line_start": "number — start line of the relevant range",
>   "line_end": "number — end line of the relevant range",
>   "severity": "Critical | High | Medium | Low",
>   "category": "bug | code-quality | best-practice | error-handling",
>   "source": "code-quality",
>   "description": "string — what the issue is, referencing specific code",
>   "context": "string — why this is an issue, explaining impact or risk",
>   "suggested_action": "string — what the author should do, with specific guidance"
> }
> ```
>
> **Severity guidelines:**
> - **Critical**: Bugs that will cause crashes, data loss, or security vulnerabilities in production
> - **High**: Logic errors likely to cause incorrect behavior; missing error handling on critical code paths
> - **Medium**: Code quality issues that hurt maintainability; best practice violations with moderate impact
> - **Low**: Style issues, minor naming improvements, optional refactoring suggestions
>
> **Rules:**
> - Only report findings for lines that were changed or directly affected by changes in this MR
> - Do not report issues in unchanged code unless the MR's changes make existing issues worse or newly relevant
> - Be specific: reference exact variable names, function names, and line numbers
> - Every finding must have a concrete `suggested_action` — never say "consider improving" without explaining how
> - If you find no issues in a category, do not fabricate findings — return an empty array if the code is clean
> - For files provided in truncated form, note the limitation in the finding's `context` field if it affects your confidence
> - The `source` field must always be `"code-quality"` for findings from this subagent
>
> If you find no issues at all, return an empty array: `[]`
>
> ---
>
> **Tools available to you:** Read, Glob, Grep, Bash. Use Read to examine the full content of changed files. Use Grep and Glob to search for related patterns if needed. Do not modify any files.

### 2.3 Git History Examination Subagent

This subagent examines the git history of changed files to provide historical context for the review. It identifies regression risks, high-churn areas, and the reasoning behind existing code.

**Subagent dispatch configuration:**

```yaml
subagent_type: "general-purpose"
timeout: 300000
retry: 1
```

**Responsibilities:**

1. Examine git history of changed files to understand the evolution and context of modifications
2. Identify whether changes revert or conflict with recent work
3. Flag files with high churn rates or recent bug-fix history (higher risk areas)
4. Provide context on why existing code was written a certain way (referencing past commits)

**Prerequisites:**

The MR branch must be available locally for full git history analysis. The orchestrator checks out the branch before dispatching this subagent:

```bash
glab mr checkout <mr_id>
```

If `glab mr checkout` fails (branch deleted, rebased, or unavailable), the orchestrator sets `{{checkout_available}}` to `false` and the subagent falls back to diff-only analysis. See the error handling notes at the end of this section.

**Finding categories this subagent uses:**

| Category | Description |
|----------|-------------|
| `regression-risk` | Changes that revert or conflict with recent work — the MR undoes a previous fix or contradicts a recent intentional change |
| `high-churn` | Files with high churn rates or recent bug-fix history — these are higher-risk areas that warrant closer scrutiny |
| `historical-context` | Important context from git history about why code exists — past commits explain the rationale behind the current implementation |

**Prompt template:**

The following prompt is sent to the subagent. Template variables are injected by the orchestrator before dispatch.

> **You are a git history analyst.** Your job is to examine the git history of each file changed in a merge request and report findings that provide historical context, identify regression risks, and flag high-churn areas.
>
> ---
>
> **MR Information:**
>
> Changed files:
> ```
> {{changed_file_list}}
> ```
>
> MR branch: `{{mr_branch}}`
> Target branch: `{{target_branch}}`
>
> **User Review Notes:**
> {{#if user_review_notes}}
> The reviewer has provided the following guidance — pay extra attention to these areas:
> ```
> {{user_review_notes}}
> ```
> {{else}}
> No specific review notes provided. Perform a general analysis.
> {{/if}}
>
> **Branch checkout status:** `{{checkout_available}}`
>
> ---
>
> **Your analysis process:**
>
> **Step 1: Classify each changed file**
>
> For each file in the changed file list, determine:
> - Is it a **binary file**? If yes, skip it entirely — do not run git commands or produce findings for binary files.
> - Is it a **new file** (not present in the target branch)? Check with:
>   ```bash
>   git cat-file -e {{target_branch}}:<file> 2>/dev/null; echo $?
>   ```
>   If the file does not exist in the target branch (exit code 1), report a single Low-severity `historical-context` finding: "New file, no prior history. No historical risk signals." Set `line_start: 1` and `line_end: 1`. Move to the next file.
>
> **Step 2: Gather git history data**
>
> For each non-binary, non-new changed file, run these git commands:
>
> 1. **Recent commit history** (last 20 commits):
>    ```bash
>    git log --oneline -20 -- <file>
>    ```
>
> 2. **Activity in the last 3 months** (limits scope for files with extensive history):
>    ```bash
>    git log --oneline --since="3 months ago" -- <file>
>    ```
>
> 3. **Contributor distribution** (who has worked on this file):
>    ```bash
>    git shortlog -sn -- <file>
>    ```
>
> 4. **Bug-fix history** (commits referencing fixes):
>    ```bash
>    git log --grep="fix\|bug\|hotfix" --oneline -- <file>
>    ```
>
> If any git command fails for a specific file, report partial results for that file and note which command failed in the finding's `context` field. Continue analyzing the remaining files — do not abort the entire analysis.
>
> If `{{checkout_available}}` is `false`, you will not have the full branch available. Work with whatever git data is accessible from the current state. Note in each finding's `context` field: "Analysis based on diff only — branch checkout unavailable."
>
> **Step 3: Analyze for findings**
>
> Using the history data collected, analyze each file for:
>
> 1. **Regression risk (`regression-risk`):** Do the MR changes revert, undo, or conflict with recent commits? Look for:
>    - Lines or logic that were recently added or fixed being removed or changed
>    - Commit messages mentioning "fix", "bug", or "hotfix" for the same code area being modified
>    - Recent changes by other contributors that this MR contradicts
>    - Reverted patterns — code returning to a state that a previous commit intentionally moved away from
>
> 2. **High churn (`high-churn`):** Is this file a frequent target of changes? Look for:
>    - Many commits in the last 3 months (relative to other files in the MR)
>    - A pattern of bug-fix commits — files repeatedly patched suggest fragile code
>    - Single-contributor files being modified by someone else (knowledge transfer risk)
>    - Files with very high contributor counts (coordination risk)
>
> 3. **Historical context (`historical-context`):** Do past commits explain why the existing code was written a certain way? Look for:
>    - Commit messages that reference specific decisions, trade-offs, or constraints
>    - Past refactors that intentionally shaped the current code structure
>    - Comments or commit messages referencing issues, tickets, or incidents
>    - Past bug fixes that explain defensive coding patterns the MR is modifying
>
> Pay extra attention to any areas mentioned in the user review notes.
>
> **Step 4: Handle edge cases**
>
> - **New files**: Already handled in Step 1 — report as "new file, no prior history."
> - **Binary files**: Already handled in Step 1 — skip entirely.
> - **Very old files with extensive history**: Limit analysis to the last 3 months of activity. The `--since="3 months ago"` command already enforces this. Do not attempt to review the complete history of files with hundreds of commits.
> - **Files where all git commands fail**: Report a single `historical-context` finding noting that history analysis was unavailable for the file, and include the error details.
>
> ---
>
> **Output format:**
>
> Return your findings as a JSON array. Each finding must use this exact schema:
>
> ```json
> {
>   "file_path": "string — relative path to the file",
>   "line_start": "number — start line of the relevant range",
>   "line_end": "number — end line of the relevant range",
>   "severity": "Critical | High | Medium | Low",
>   "category": "regression-risk | high-churn | historical-context",
>   "source": "git-history",
>   "description": "string — what the finding is",
>   "context": "string — historical evidence (commit hashes, messages, dates, contributor info)",
>   "suggested_action": "string — what the MR author should do"
> }
> ```
>
> **Severity guidelines for this subagent:**
> - **Critical**: Changes directly revert a recent bug fix or security patch (e.g., removing a null check that was added to fix a production crash)
> - **High**: Changes conflict with recent work by other contributors; file has very high churn with recent bug-fix history suggesting fragile code
> - **Medium**: File has moderate churn; historical context suggests the existing approach was intentional and the MR changes it without explanation
> - **Low**: General historical context that may be useful for the reviewer; contributor distribution notes; new file with no history
>
> If you find no issues, return an empty array: `[]`
>
> ---
>
> **Tools available to you:** Bash (for git commands), Read, Glob, Grep. Do not modify any files.

**Error handling:**

- **Branch checkout failure**: If `glab mr checkout` fails, the orchestrator sets `{{checkout_available}}` to `false` in the prompt template. The subagent works with available diff data and notes the limitation in each finding's `context` field. Partial history analysis from the default branch is still possible.
- **Git command failure**: The subagent reports partial results for any file where a git command fails, including which command failed and the error. Individual file failures do not abort the full analysis.
- **Subagent failure**: If the git history subagent fails entirely, it is retried once per the standard retry policy (Section 9). If still failing, the review continues without git history findings and the gap is noted in the report.

## 3. Finding Merge and Deduplication

After all subagents complete (or fail/time out), this stage collects their findings, deduplicates overlapping results, and produces a single sorted list for downstream report generation and comment posting.

### 3.1 Subagent Output Schema

All three subagents (codebase understanding, code quality, git history) return findings using this shared schema. Every finding must include all nine fields.

| Field | Type | Description |
|-------|------|-------------|
| `file_path` | `string` | Relative path to the file from the repository root (e.g., `src/auth/login.py`) |
| `line_start` | `number` | Start line of the relevant code range (inclusive, 1-indexed) |
| `line_end` | `number` | End line of the relevant code range (inclusive, must be >= `line_start`) |
| `severity` | `enum` | One of: `Critical`, `High`, `Medium`, `Low` |
| `category` | `string` | Finding type. Codebase subagent: `convention`, `architecture`, `integration-risk`. Quality subagent: `bug`, `code-quality`, `best-practice`, `error-handling`. History subagent: `regression-risk`, `high-churn`, `historical-context`. |
| `source` | `string` | Which subagent produced this finding. One of: `codebase-understanding`, `code-quality`, `git-history` |
| `description` | `string` | What the issue is — a concise explanation of the problem |
| `context` | `string` | Why this is an issue — codebase context, historical evidence, or reasoning that supports the finding |
| `suggested_action` | `string` | What the MR author should do to resolve the issue — a specific, actionable recommendation |

**Severity ranking (highest to lowest):** Critical > High > Medium > Low

Each subagent's prompt template specifies severity guidelines tailored to its analysis type. The severity ranking is consistent across all subagents.

### 3.2 Collecting Subagent Results

Collect findings from all three subagents. Each subagent returns a JSON array of findings (or an empty array if no issues were found).

**Input assembly:**

1. Parse the JSON array from the codebase understanding subagent. If the subagent succeeded, use its findings. If it failed or timed out after retry, set its findings to an empty array and record the gap.
2. Parse the JSON array from the code quality analysis subagent. Same failure handling as above.
3. Parse the JSON array from the git history examination subagent. Same failure handling as above.
4. Concatenate all three arrays into a single combined findings list.

**Tracking subagent coverage:**

Record the status of each subagent for use in the report (Section 4):

| Subagent | Status |
|----------|--------|
| Codebase understanding | `complete` / `partial` (retried then succeeded) / `failed` (retried then failed or timed out) |
| Code quality analysis | `complete` / `partial` / `failed` |
| Git history examination | `complete` / `partial` / `failed` |

If a subagent has status `failed`, note this in the merge output so the report can indicate which analysis dimension is missing. A failed subagent contributes zero findings — it does not block the merge process.

**Edge case — no findings from any subagent:**

If all three subagents return empty arrays (and none failed), the combined findings list is empty. Pass the empty set through the deduplication and sorting steps unchanged. The report generation stage (Section 4) handles this case by producing a "clean review" report.

**Edge case — one subagent produced no findings:**

A subagent returning an empty array is normal — it means that analysis dimension found no issues. Include the empty array in the merge (it contributes nothing) and record the subagent status as `complete`. This is distinct from a `failed` subagent, which could not complete its analysis.

### 3.3 Deduplication Algorithm

When multiple subagents analyze the same MR, they may independently flag the same code region. Deduplication merges overlapping findings to avoid redundant output.

**Step 1: Group by file path**

Partition the combined findings list by `file_path`. Process each file's findings independently.

**Step 2: Detect overlapping line ranges within each file**

For each file, compare every pair of findings to detect overlapping line ranges. Two findings overlap when:

```
finding_A.line_start <= finding_B.line_end
AND finding_B.line_start <= finding_A.line_end
```

Build clusters of mutually overlapping findings. A finding belongs to a cluster if it overlaps with any finding already in that cluster.

**Step 3: Merge each cluster into a single finding**

For each cluster of overlapping findings, produce one merged finding:

- **`file_path`**: Same for all findings in the cluster (grouped in Step 1).
- **`line_start`**: Minimum `line_start` across all findings in the cluster.
- **`line_end`**: Maximum `line_end` across all findings in the cluster.
- **`severity`**: Highest severity across all findings in the cluster (Critical > High > Medium > Low).
- **`category`**: Comma-separated list of all unique `category` values from the cluster, ordered alphabetically (e.g., `"bug, convention"`).
- **`source`**: Comma-separated list of all unique `source` values from the cluster, ordered alphabetically (e.g., `"code-quality, codebase-understanding"`).
- **`description`**: Concatenation of all unique `description` values from the cluster, separated by ` | `. If two findings have identical descriptions, include it only once.
- **`context`**: Concatenation of all unique `context` values from the cluster, separated by ` | `. If two findings have identical context, include it only once.
- **`suggested_action`**: Concatenation of all unique `suggested_action` values from the cluster, separated by ` | `. Preserve every unique action — different subagents may recommend complementary fixes.

Findings that do not overlap with any other finding pass through unchanged as single-finding clusters.

**Step 4: Sort the deduplicated findings**

Sort the final findings list by:

1. **Severity** (descending): Critical first, then High, Medium, Low.
2. **File path** (ascending, alphabetical): Within the same severity, group findings by file for readability.
3. **Line start** (ascending, numeric): Within the same file and severity, order by position in the file.

### 3.4 Handling Partial Results

When one or more subagents failed or timed out (after their single retry), the merge process continues with whatever findings are available.

**Behavior:**

- A failed subagent contributes zero findings to the combined list. The deduplication and sorting steps proceed normally on the reduced set.
- Record which subagents failed and include this information in the merge output for the report generation stage.
- The report (Section 4) must clearly indicate which analysis dimensions are missing so the reviewer understands the coverage gaps.

**Gap notation format:**

For each failed subagent, produce a gap record:

```
Gap:
  subagent: string       # "codebase-understanding" | "code-quality" | "git-history"
  reason: string         # e.g., "Subagent timed out after retry", "Subagent returned invalid output after retry"
```

Pass the list of gap records alongside the deduplicated findings to the report generation stage.

**Edge case — all three subagents failed:**

If all three subagents failed, the combined findings list is empty and all three are recorded as gaps. The report generation stage handles this by producing an error report with diagnostic information rather than an empty review (see Section 4).

### 3.5 Merge Example

The following example demonstrates how overlapping findings from different subagents are merged.

**Input: Three findings from two subagents targeting the same code region**

Finding 1 (from code quality subagent):
```json
{
  "file_path": "src/auth/login.py",
  "line_start": 42,
  "line_end": 58,
  "severity": "High",
  "category": "bug",
  "source": "code-quality",
  "description": "Missing null check on user object before accessing .email",
  "context": "If get_user() returns None (user not found), line 45 will raise AttributeError",
  "suggested_action": "Add a guard clause after get_user() to handle the None case and return an appropriate error response"
}
```

Finding 2 (from codebase understanding subagent):
```json
{
  "file_path": "src/auth/login.py",
  "line_start": 45,
  "line_end": 52,
  "severity": "Medium",
  "category": "convention",
  "source": "codebase-understanding",
  "description": "Other auth modules use the validate_user_exists() helper instead of manual null checks",
  "context": "src/auth/register.py and src/auth/reset_password.py both call validate_user_exists() which raises UserNotFoundError with a standard error format",
  "suggested_action": "Replace the manual null check with validate_user_exists(user) to match the established pattern in the auth module"
}
```

Finding 3 (from git history subagent):
```json
{
  "file_path": "src/auth/login.py",
  "line_start": 40,
  "line_end": 50,
  "severity": "Critical",
  "category": "regression-risk",
  "source": "git-history",
  "description": "This code region was patched in commit abc1234 two weeks ago to fix a production null pointer crash",
  "context": "Commit abc1234 (2026-02-24) message: 'fix(auth): handle missing user in login flow — fixes PROD-1234'. The MR modifies the same lines that were part of that fix",
  "suggested_action": "Verify that the changes in this MR preserve the null-safety guarantees added by commit abc1234"
}
```

**Step 1: Group by file path**

All three findings share `file_path: "src/auth/login.py"`, so they form one file group.

**Step 2: Detect overlapping line ranges**

- Finding 1 (42-58) overlaps Finding 2 (45-52): 42 <= 52 AND 45 <= 58 -- overlap.
- Finding 1 (42-58) overlaps Finding 3 (40-50): 42 <= 50 AND 40 <= 58 -- overlap.
- Finding 2 (45-52) overlaps Finding 3 (40-50): 45 <= 50 AND 40 <= 52 -- overlap.

All three findings are in one cluster.

**Step 3: Merge the cluster**

```json
{
  "file_path": "src/auth/login.py",
  "line_start": 40,
  "line_end": 58,
  "severity": "Critical",
  "category": "bug, convention, regression-risk",
  "source": "code-quality, codebase-understanding, git-history",
  "description": "Missing null check on user object before accessing .email | Other auth modules use the validate_user_exists() helper instead of manual null checks | This code region was patched in commit abc1234 two weeks ago to fix a production null pointer crash",
  "context": "If get_user() returns None (user not found), line 45 will raise AttributeError | src/auth/register.py and src/auth/reset_password.py both call validate_user_exists() which raises UserNotFoundError with a standard error format | Commit abc1234 (2026-02-24) message: 'fix(auth): handle missing user in login flow — fixes PROD-1234'. The MR modifies the same lines that were part of that fix",
  "suggested_action": "Add a guard clause after get_user() to handle the None case and return an appropriate error response | Replace the manual null check with validate_user_exists(user) to match the established pattern in the auth module | Verify that the changes in this MR preserve the null-safety guarantees added by commit abc1234"
}
```

The merged finding takes the highest severity (`Critical` from the git history finding), expands the line range to cover all three findings (40-58), and preserves all unique descriptions, contexts, and suggested actions from each subagent.

**Non-overlapping findings pass through unchanged.** If a fourth finding existed at `src/auth/login.py` lines 100-110, it would not overlap with the cluster above and would appear as a separate finding in the final output.

### 3.6 Edge Case: Same Line, Different Categories

When two findings target the exact same line range but represent different analysis dimensions, they are still merged because their line ranges overlap.

**Example input:**

Finding A (code quality):
```json
{
  "file_path": "src/utils/parser.py",
  "line_start": 15,
  "line_end": 15,
  "severity": "Medium",
  "category": "code-quality",
  "source": "code-quality",
  "description": "Variable name 'x' is not descriptive",
  "context": "Single-character variable names reduce readability in utility functions",
  "suggested_action": "Rename 'x' to a descriptive name like 'parsed_value'"
}
```

Finding B (codebase understanding):
```json
{
  "file_path": "src/utils/parser.py",
  "line_start": 15,
  "line_end": 15,
  "severity": "Low",
  "category": "convention",
  "source": "codebase-understanding",
  "description": "Other parser utilities in src/utils/ use the prefix 'parsed_' for output variables",
  "context": "src/utils/json_parser.py and src/utils/xml_parser.py both follow this naming convention",
  "suggested_action": "Use the 'parsed_' prefix for consistency with other parsers"
}
```

**Merged output:**

```json
{
  "file_path": "src/utils/parser.py",
  "line_start": 15,
  "line_end": 15,
  "severity": "Medium",
  "category": "code-quality, convention",
  "source": "code-quality, codebase-understanding",
  "description": "Variable name 'x' is not descriptive | Other parser utilities in src/utils/ use the prefix 'parsed_' for output variables",
  "context": "Single-character variable names reduce readability in utility functions | src/utils/json_parser.py and src/utils/xml_parser.py both follow this naming convention",
  "suggested_action": "Rename 'x' to a descriptive name like 'parsed_value' | Use the 'parsed_' prefix for consistency with other parsers"
}
```

Both findings target the exact same line, so they merge. The higher severity (`Medium`) is kept. The descriptions complement each other — one identifies the quality issue, the other provides the codebase convention to follow.

## 4. Structured Review Report

After finding merge and deduplication (Section 3) produces the final sorted findings list and gap records, this stage generates a structured markdown review report. The report is the primary output of the skill — it is always generated before GitLab comment posting (Section 5) so that the user has a complete review even if comment posting fails.

### 4.1 Report Structure

The report contains four mandatory sections in this order:

1. **Executive Summary** — Brief overview of the MR, analysis coverage, and top-level assessment
2. **Findings by Severity** — All findings grouped by severity level, then by file within each level
3. **Statistics** — Quantitative summary of the review
4. **Recommendations** — Prioritized action items for the MR author

Two conditional sections are added when applicable:

- **Scope** — Inserted after the Executive Summary when focused mode is active (see Section 8.4)
- **Top Issues** — Inserted before the full Findings section when the review has 50 or more findings

If the user provided review notes (Section 1.5), findings that relate to the noted areas are highlighted with a `[Noted Area]` tag so the MR author can quickly locate feedback on the areas the reviewer cared about most.

### 4.2 Report Template

Generate the report using this format. Replace `{placeholders}` with actual values from the MR metadata (Section 1.4), the deduplicated findings list, gap records, and subagent status tracking (Section 3.2).

````markdown
# MR Review: !{iid} — {title}

**Branch:** `{source_branch}` → `{target_branch}`
**Author:** @{author}
**MR Link:** {web_url}

## Executive Summary

{One to three sentences summarizing the MR's purpose based on the title and description. State the overall assessment: how many findings were identified, the highest severity level found, and whether any analysis dimensions are missing.}

**Analysis Coverage:**
- Codebase Understanding: {Completed | **Unavailable** — subagent failed after retry}
- Code Quality Analysis: {Completed | **Unavailable** — subagent failed after retry}
- Git History Examination: {Completed | **Unavailable** — subagent failed after retry}

{If any subagent has status `failed`:}
> **Note:** This review has partial coverage. {Failed subagent name(s)} analysis was unavailable due to a subagent failure. Findings below reflect only the dimensions that completed successfully.

{If user_review_notes is not empty:}
**Reviewer Notes:** {user_review_notes}
Findings related to the noted areas are tagged with `[Noted Area]` below.

{If focused mode is active, insert the Scope section from Section 8.4 here.}

{If total findings >= 50, insert the Top Issues section (see 4.3) here.}

## Findings

{For each severity level that has findings, in order: Critical, High, Medium, Low:}

### {Severity} ({count})

{For each unique file_path within this severity level, in alphabetical order:}

#### `{file_path}`

{For each finding in this file at this severity level, ordered by line_start:}

- **Lines {line_start}–{line_end}** | `{category}` | Source: {source} {If finding relates to a user-noted area: `[Noted Area]`}

  {description}

  **Context:** {context}

  **Suggested action:** {suggested_action}

---

{End of severity level. Repeat for the next severity level.}

{If a subagent dimension produced zero findings but succeeded (status is `complete`/`succeeded`):}
> No issues found in **{dimension name}** analysis.

## Statistics

| Metric | Value |
|--------|-------|
| Total findings | {total_count} |
| Critical | {critical_count} |
| High | {high_count} |
| Medium | {medium_count} |
| Low | {low_count} |
| Files with findings | {files_with_findings_count} |
| Total files analyzed | {total_files_analyzed} |
| Subagent coverage | {succeeded_count}/3 dimensions |

{If any subagent has status `failed`, add a row per failed subagent:}
| Missing dimension | {subagent_name} — {gap reason} |

## Recommendations

{Numbered list of prioritized action items based on the findings. Order by severity — address Critical findings first, then High, then Medium/Low. Each recommendation should be a concrete action the MR author can take.}

1. {Recommendation addressing the highest-severity finding or cluster of related findings}
2. {Next recommendation}
3. ...

{If there are no findings, this section contains a single entry:}
1. No action required — this MR passed review with no findings.
````

### 4.3 Top Issues Section (50+ Findings)

When the deduplicated findings list contains 50 or more findings, insert a **Top Issues** section after the Executive Summary (and after the Scope section if present) and before the full Findings section. This section surfaces the most impactful findings so the MR author is not overwhelmed by the full list.

**Top Issues selection criteria:**

1. Include all Critical severity findings.
2. Include High severity findings up to a total of 10 items in the Top Issues list.
3. If there are fewer than 10 Critical + High findings, fill remaining slots with the highest-severity Medium findings.

**Top Issues format:**

```markdown
## Top Issues

This review produced {total_count} findings. The most impactful issues are summarized below. See the full **Findings** section for the complete list.

| # | Severity | File | Lines | Category | Description |
|---|----------|------|-------|----------|-------------|
| 1 | Critical | `{file_path}` | {line_start}–{line_end} | {category} | {description (truncated to ~80 chars if needed)} |
| 2 | High | `{file_path}` | {line_start}–{line_end} | {category} | {description} |
| ... | ... | ... | ... | ... | ... |
```

### 4.4 Clean Review Report (No Findings)

When the deduplicated findings list is empty and no subagents failed (all three have status `succeeded`/`complete`), produce a clean review report confirming the MR was analyzed and no issues were found.

**Clean review template:**

````markdown
# MR Review: !{iid} — {title}

**Branch:** `{source_branch}` → `{target_branch}`
**Author:** @{author}
**MR Link:** {web_url}

## Executive Summary

This merge request was analyzed across all three review dimensions and no issues were found.

**Analysis Coverage:**
- Codebase Understanding: Completed
- Code Quality Analysis: Completed
- Git History Examination: Completed

{If user_review_notes is not empty:}
**Reviewer Notes:** {user_review_notes}
No findings were identified in the noted areas or elsewhere.

{If focused mode is active, insert the Scope section from Section 8.4 here.}

## Findings

No issues identified. The changes in this MR are consistent with codebase conventions, code quality standards, and git history patterns.

## Statistics

| Metric | Value |
|--------|-------|
| Total findings | 0 |
| Files analyzed | {total_files_analyzed} |
| Subagent coverage | 3/3 dimensions |

## Recommendations

1. No action required — this MR passed review with no findings.
````

**Edge case — no findings but one or more subagents failed:**

If the findings list is empty but one or more subagents have status `failed`, do not use the clean review template. Use the standard report template (Section 4.2) instead, because the absence of findings may be due to the failed subagents rather than clean code. The Analysis Coverage and Statistics sections will clearly show which dimensions are missing.

### 4.5 Handling User Review Notes in the Report

When the user provided review notes (Section 1.5, stored as `user_review_notes`), the report highlights findings that relate to the noted areas:

**Matching findings to review notes:**

1. Parse the user's review notes for file paths, directory names, function names, class names, or topic keywords.
2. For each finding in the deduplicated list, check whether its `file_path`, `category`, `description`, or `context` matches any term from the review notes.
3. If a finding matches, tag it with `[Noted Area]` in the Findings section (see the template in 4.2).

**In the Executive Summary:**

Include the reviewer's notes and a count of how many findings relate to the noted areas:

```markdown
**Reviewer Notes:** {user_review_notes}
Findings related to the noted areas are tagged with `[Noted Area]` below. {noted_area_count} of {total_count} findings relate to the noted areas.
```

**If no findings match the review notes:**

```markdown
**Reviewer Notes:** {user_review_notes}
No findings were identified in the areas mentioned in the review notes.
```

### 4.6 Partial Result Indicators

When one or more subagents failed (but at least one succeeded), the report must clearly indicate the coverage gaps so the reviewer understands which analysis dimensions are reflected in the findings.

**Indicators appear in three places:**

1. **Executive Summary — Analysis Coverage block:** Each subagent's status is listed as "Completed" or "**Unavailable**" with a reason (see template in 4.2).

2. **Executive Summary — Partial coverage note:** A blockquote warning is included when any subagent failed, stating which dimensions are missing and what types of findings may be absent.

3. **Statistics — Missing dimension rows:** For each failed subagent, an additional row in the Statistics table names the missing dimension and the gap reason from the gap record (Section 3.4).

**Dimension-to-coverage mapping for the partial coverage note:**

| Failed Subagent | Missing Coverage Description |
|----------------|------------------------------|
| Codebase Understanding | Convention violations, architectural issues, and integration risk analysis are missing from this review. |
| Code Quality Analysis | Bug detection, code quality, best practice, and error handling analysis are missing from this review. |
| Git History Examination | Regression risk, high-churn area, and historical context analysis are missing from this review. |

### 4.7 Noting Dimensions With No Findings

When a subagent succeeded but returned zero findings (empty array), this is a positive signal — that analysis dimension found no issues. Include a note in the Findings section after all severity groups:

```markdown
> No issues found in **Codebase Understanding** analysis.
```

This distinguishes a clean result (subagent ran, found nothing) from a missing result (subagent failed). Only include this note for dimensions where the subagent succeeded with zero findings. Do not include it for failed subagents — those are covered by the partial result indicators in Section 4.6.

## 5. GitLab Comment Posting

This stage posts review findings directly on the GitLab merge request. Critical and High severity findings are posted as line-level diff discussions so the MR author sees feedback in context on the exact code lines. Medium and Low severity findings are batched into a summary note to avoid comment noise. See `@skills/glab/references/api.md` for `glab api` patterns and `@skills/glab/references/merge-requests.md` for `glab mr note` usage.

### 5.1 Line-Level Comment Posting

Only **Critical** and **High** severity findings are posted as individual line-level comments via the GitLab Discussions API. Each comment is a diff discussion anchored to the specific line in the MR diff where the finding applies.

#### 5.1.1 Position Data Construction

Line-level diff discussions require position data that tells GitLab exactly where in the diff to anchor the comment. The position data uses the `diff_refs` values extracted during MR data fetching (Section 1.4).

**Required values from Section 1.4:**

| Value | Source | Purpose |
|-------|--------|---------|
| `base_sha` | `.diff_refs.base_sha` from `glab mr view --output json` | The base commit SHA of the MR diff |
| `head_sha` | `.diff_refs.head_sha` from `glab mr view --output json` | The head commit SHA of the MR diff |
| `start_sha` | `.diff_refs.start_sha` from `glab mr view --output json` | The start commit SHA of the MR diff |

**Constructing the position object for each finding:**

For each Critical or High severity finding, build the position data:

```json
{
  "position_type": "text",
  "base_sha": "<base_sha from diff_refs>",
  "head_sha": "<head_sha from diff_refs>",
  "start_sha": "<start_sha from diff_refs>",
  "old_path": "<finding.file_path>",
  "new_path": "<finding.file_path>",
  "new_line": "<finding.line_start>"
}
```

Field details:

- **`position_type`**: Always `"text"` for code comments (as opposed to `"image"` for image diffs).
- **`base_sha`**, **`head_sha`**, **`start_sha`**: Taken directly from the `diff_refs` extracted in Section 1.4. These three SHAs define the diff context for the MR.
- **`old_path`** and **`new_path`**: Both set to the finding's `file_path`. If the file was renamed in the MR, set `old_path` to the previous filename and `new_path` to the current filename (see edge case in 5.1.4).
- **`new_line`**: Set to `finding.line_start`. This anchors the comment to the start line of the finding on the new (head) side of the diff. If the finding spans multiple lines, use `line_start` — GitLab anchors the discussion to a single line.

#### 5.1.2 Comment Content Format

Each line-level comment follows this format:

```
[{SEVERITY}] {description}

{context}

**Suggested:** {suggested_action}
```

Where:
- **`{SEVERITY}`**: The finding's severity in uppercase — `CRITICAL` or `HIGH`.
- **`{description}`**: The finding's `description` field — what the issue is.
- **`{context}`**: The finding's `context` field — why this is an issue (codebase context, history, etc.).
- **`{suggested_action}`**: The finding's `suggested_action` field — what the author should do.

Example comment body:

```
[CRITICAL] Unbounded SQL query with user-supplied input

This function passes the user-provided `filter` parameter directly into the SQL WHERE clause without parameterization. The `filter` field is received from the API request body and has no validation or sanitization applied before reaching this query.

**Suggested:** Use parameterized queries via SQLAlchemy's `bindparam()` or the ORM query builder instead of string interpolation.
```

#### 5.1.3 Posting via glab api

Post each line-level comment using the GitLab Discussions API through `glab api`:

```bash
glab api projects/:id/merge_requests/{mr_iid}/discussions -X POST \
  -f "body=[{SEVERITY}] {description}

{context}

**Suggested:** {suggested_action}" \
  -f "position[position_type]=text" \
  -f "position[base_sha]={base_sha}" \
  -f "position[head_sha]={head_sha}" \
  -f "position[start_sha]={start_sha}" \
  -f "position[old_path]={file_path}" \
  -f "position[new_path]={file_path}" \
  -f "position[new_line]={line_start}"
```

Replace `{mr_iid}` with the MR IID from Section 1.4. The `:id` placeholder is automatically resolved by `glab` to the current project's numeric ID.

**Posting order:** Post comments in the same order as the deduplicated findings list from Section 3 (sorted by severity descending, then file path ascending, then line number ascending). This ensures Critical findings are posted first.

#### 5.1.4 Edge Cases

**File was renamed in the MR:**

When a finding references a file that was renamed as part of the MR, the `old_path` and `new_path` must differ. Check the MR's changed files list (from `.changes[]` in the `glab mr view --output json` response) for entries where `old_path` differs from `new_path`. If the finding's `file_path` matches a renamed file's `new_path`, set:

- `old_path` to the file's previous name (from `.changes[].old_path`)
- `new_path` to the file's current name (from `.changes[].new_path`, which matches `finding.file_path`)

**Finding spans multiple lines:**

When a finding has `line_start` different from `line_end` (it spans multiple lines), use `line_start` for the `new_line` position field. GitLab anchors each discussion to a single line. The comment body already contains the full finding description, which provides sufficient context about the affected range.

**Position data cannot be determined:**

If the `diff_refs` are unavailable (e.g., `glab mr view` did not return them) or if a line-level comment fails with a 400 or 422 error (indicating invalid position data), fall back to posting the finding as a general MR note instead of a diff discussion:

```bash
glab mr note {mr_iid} -m "[{SEVERITY}] {description} ({file_path}:{line_start})

{context}

**Suggested:** {suggested_action}"
```

The fallback includes `{file_path}:{line_start}` in the comment body so the reader can still locate the code, even though the comment is not anchored to the diff.

**MR diff changed since analysis (force push):**

If the MR's `head_sha` has changed between the time the analysis ran and the time comments are posted (e.g., the author force-pushed new commits), the position data may be stale. Detect this by re-fetching the MR's `diff_refs` immediately before posting comments:

```bash
glab mr view {mr_iid} --output json --jq '.diff_refs.head_sha'
```

If the `head_sha` differs from the one stored during Section 1.4, warn the user before posting:

> **Warning:** The MR diff has changed since the analysis was performed (head SHA mismatch). Comments may land on incorrect lines due to code changes after the analysis. Consider re-running the review on the updated MR.

Proceed with posting using the original position data (the stored `diff_refs` from the analysis), since the findings correspond to that version of the code. The warning ensures the user understands potential misalignment.

#### 5.1.5 Error Handling

**Individual comment failure:**

If posting a single line-level comment fails, do not stop. Log the failure and continue posting the remaining comments. After all comments are attempted, report the failures:

> {n} of {total} line-level comments could not be posted:
>
> - `{file_path}:{line_start}` — {error message or HTTP status}
> - `{file_path}:{line_start}` — {error message or HTTP status}
>
> The structured review report contains the complete findings.

For each failed line-level comment, attempt the general MR note fallback (Section 5.1.4) before recording it as a failure. A finding is only reported as a failure if both the diff discussion and the fallback note fail.

**API rate limiting:**

If a comment post returns HTTP 429 (Too Many Requests), apply the following strategy:

1. Read the `Retry-After` header from the response if available.
2. Wait for the specified duration (or 60 seconds if no header is provided).
3. Retry the failed comment once.
4. If the retry also returns 429, record it as a failure and continue with the remaining comments.

To reduce rate limiting risk, insert a 1-second pause between consecutive comment posts when there are more than 10 findings to post.

**Batch size management:**

When there are many Critical and High findings (more than 20), batch the posts in groups of 10 with a 2-second pause between batches. This reduces the risk of hitting GitLab API rate limits.

**GitLab API errors:**

For other API errors (401, 403, 404, 422, 500+), follow the error handling patterns in Section 9.3. Specifically:

- **422 Unprocessable Entity** on a comment post typically indicates invalid position data. Fall back to the general MR note approach for that finding (Section 5.1.4).
- **401/403** errors suggest an authentication or permissions issue. Report the error and stop posting further comments — if authentication has failed, all subsequent posts will also fail.
- **500+** errors indicate a GitLab server issue. Report the error for that comment and continue attempting the remaining comments.

### 5.2 Summary Note Posting

After posting line-level comments for Critical and High findings (Section 5.1), post a single summary note on the MR that provides an overview of the entire review. Medium and Low severity findings are batched into this summary note rather than posted as individual comments, reducing comment noise on the MR.

The summary note is posted via `glab mr note` as a general MR comment (not anchored to a specific diff line).

#### 5.2.1 Summary Note Content

Build the summary note using the following structure. Each section is included only when it has content.

**Review header:**

```
## MR Review Summary

**Statistics:** {n} findings ({critical} critical, {high} high, {medium} medium, {low} low) | {files} files analyzed
```

Where:
- **`{n}`**: Total number of deduplicated findings from Section 3.
- **`{critical}`**, **`{high}`**, **`{medium}`**, **`{low}`**: Count of findings at each severity level.
- **`{files}`**: Number of unique files that have at least one finding, or the total number of changed files in the MR if no findings exist.

**Critical/High findings summary:**

If there are any Critical or High severity findings (which also have individual line-level comments from Section 5.1), include a summary referencing them:

```
### Critical/High Issues
- **{file_path}:{line_start}** [{severity}] {description}
- **{file_path}:{line_start}** [{severity}] {description}
```

List each Critical finding first, then High findings. Each entry is a one-line summary -- the full details (context, suggested action) are in the line-level comments posted by Section 5.1. This section lets the MR author see all high-priority issues at a glance.

**Medium/Low findings:**

Medium and Low severity findings are not posted as individual comments. They appear only in this summary note, grouped by file:

```
### Additional Findings (Medium/Low)
**{file_path}:**
- Line {line_start}: [{severity}] {description} -- {suggested_action}
- Line {line_start}: [{severity}] {description} -- {suggested_action}

**{file_path}:**
- Line {line_start}: [{severity}] {description} -- {suggested_action}
```

Group findings by `file_path` (sorted alphabetically). Within each file group, sort by `line_start` ascending. Include the `suggested_action` inline since there is no separate line-level comment for these findings.

**Analysis gaps:**

If any subagent failed (status `failed` from Section 9.1), append a note identifying the missing analysis dimension:

```
> **Note:** {subagent_name} analysis was incomplete due to subagent failure after retry. Findings from the remaining subagents are included above.
```

If multiple subagents failed, list each one:

```
> **Note:** The following analyses were incomplete due to subagent failures:
> - {subagent_name_1}: failed after retry
> - {subagent_name_2}: failed after retry
>
> Findings from the remaining subagents are included above.
```

Use the display names: "Codebase Understanding", "Code Quality Analysis", "Git History Examination".

**Review notes reference:**

If the user provided review notes (Section 1.5), append a section referencing them:

```
### Review Notes
The following areas were given extra attention per your review notes: {summary of user_review_notes}
```

Include a brief summary (not the full text) of the review notes. If any findings are directly related to the user's noted concerns, mention which findings address them (by file and line reference).

**Complete example:**

```
## MR Review Summary

**Statistics:** 7 findings (1 critical, 2 high, 3 medium, 1 low) | 4 files analyzed

### Critical/High Issues
- **src/auth/login.py:42** [Critical] Unbounded SQL query with user-supplied input
- **src/auth/login.py:87** [High] Missing rate limit on login endpoint
- **src/api/handler.ts:15** [High] Unvalidated redirect URL parameter

### Additional Findings (Medium/Low)
**src/auth/login.py:**
- Line 55: [Medium] Magic number in retry logic -- Extract to a named constant (e.g., MAX_LOGIN_RETRIES)
- Line 102: [Low] Unused import of `datetime` -- Remove the unused import

**src/utils/config.py:**
- Line 12: [Medium] Hardcoded timeout value -- Move to configuration or environment variable

**tests/test_auth.py:**
- Line 30: [Medium] Test assertions use string comparison for status codes -- Use integer comparison for HTTP status codes

> **Note:** Code Quality Analysis was incomplete due to subagent failure after retry. Findings from the remaining subagents are included above.

### Review Notes
The following areas were given extra attention per your review notes: authentication flow and SQL injection risks. The Critical finding at src/auth/login.py:42 directly addresses the SQL injection concern.
```

#### 5.2.2 Posting via glab mr note

Post the assembled summary note as a single MR comment:

```bash
glab mr note {mr_iid} -m "{summary_note_content}"
```

Replace `{mr_iid}` with the MR IID from Section 1.4 and `{summary_note_content}` with the fully assembled markdown content from Section 5.2.1.

**Posting order:** Post the summary note after all line-level comments (Section 5.1) have been posted. This ensures the summary appears as the most recent comment on the MR, providing an overview after the individual findings.

#### 5.2.3 Edge Cases

**No findings (clean review):**

When the deduplicated findings list from Section 3 is empty and no subagents failed, post a summary confirming a clean review:

```
## MR Review Summary

**Statistics:** 0 findings | {files} files analyzed

All analyzed files passed review with no issues found. The review covered codebase understanding, code quality analysis, and git history examination.
```

This confirms the review ran successfully and is distinct from a failed review where no findings could be produced.

**No findings but subagent gaps:**

If the findings list is empty but one or more subagents failed, the clean review message must be qualified:

```
## MR Review Summary

**Statistics:** 0 findings | {files} files analyzed

No issues were found by the completed analyses.

> **Note:** {subagent_name} analysis was incomplete due to subagent failure after retry. The absence of findings may not indicate a clean review -- the {analysis_dimension} dimension was not covered.
```

**Very many Medium/Low findings (truncation):**

When there are more than 25 Medium/Low findings, the summary note can become too long for a readable MR comment. Apply the following truncation strategy:

1. Include all findings for the first 15 files (sorted alphabetically by file path).
2. For remaining files, include only a count:

```
### Additional Findings (Medium/Low)
**src/api/handler.ts:**
- Line 15: [Medium] Unvalidated input parameter -- Add input validation
- Line 42: [Low] Inconsistent error message format -- Match project error conventions

**src/auth/login.py:**
- Line 55: [Medium] Magic number in retry logic -- Extract to named constant

... and 12 more findings across 5 additional files. See the full review report for details.
```

The truncation message references the structured review report (Section 4) where the complete findings are available.

**Only Medium/Low findings (no Critical/High):**

Omit the "Critical/High Issues" section entirely. The summary note contains only the statistics header and the "Additional Findings" section.

**Only Critical/High findings (no Medium/Low):**

Omit the "Additional Findings (Medium/Low)" section entirely. The summary note contains only the statistics header and the "Critical/High Issues" section.

#### 5.2.4 Error Handling

**glab mr note failure:**

If posting the summary note fails, report the error to the user with the glab output:

> Failed to post review summary note on the MR.
>
> glab output: {stderr from the command}
>
> The structured review report (Section 4) contains the complete findings. Line-level comments for Critical/High findings were posted separately and may have succeeded.

Do not retry the summary note automatically. The user can manually retry by copying the summary content from the structured report. The line-level comments (Section 5.1) are posted independently and are not affected by a summary note failure.

**Summary note too large:**

If `glab mr note` fails due to the note content exceeding GitLab's maximum comment size (typically around 1MB), apply a more aggressive truncation:

1. Remove the "Additional Findings (Medium/Low)" section entirely.
2. Replace it with a brief count: `**Additional Findings:** {n} medium and {m} low severity findings. See the structured review report for details.`
3. Retry posting the truncated summary.
4. If the truncated version also fails, report the error as above.

### 5.3 Comment Error Handling and Fallback

This section defines the overarching error handling strategy for all GitLab comment posting (Sections 5.1 and 5.2). It covers five error scenarios, their detection, fallback strategies, and the completion confirmation that reports the outcome of the entire posting phase.

#### 5.3.1 Position Data Fallback

When a line-level diff discussion cannot be posted because position data is unavailable or invalid, fall back to posting the finding as a general MR note that references the file and line in the comment body.

**Detection:**

- `diff_refs` were not returned by `glab mr view` during Section 1.4
- The `glab api` call to post a diff discussion returns 400 or 422 (invalid position data)

**Fallback action:**

Post the finding as a general MR note instead of a diff discussion:

```bash
glab mr note {mr_iid} -m "[{SEVERITY}] {file_path}:{line_start} — {description}

{context}

**Suggested:** {suggested_action}"
```

The `{file_path}:{line_start}` reference in the body allows the reader to locate the relevant code manually. This fallback preserves the finding's content even when diff anchoring is impossible.

**When all position data is unavailable:**

If `diff_refs` could not be retrieved at all (Section 1.4 did not return them), skip line-level diff discussions entirely. Post all Critical and High findings as general MR notes using the format above, then proceed to the summary note (Section 5.2). Log a warning before posting:

> **Warning:** MR diff reference data (diff_refs) is unavailable. All line-level comments will be posted as general MR notes without diff anchoring.

#### 5.3.2 API Rate Limiting

GitLab may return HTTP 429 (Too Many Requests) when too many API calls are made in a short period. The strategy combines batching, backoff, and fallback to summary-only posting.

**Prevention — batching:**

To reduce the risk of hitting rate limits, batch comment posts:

- When there are more than 10 Critical/High findings, insert a 1-second pause between consecutive comment posts.
- When there are more than 20 Critical/High findings, batch posts in groups of 10 with a 2-second pause between batches.

**Detection and retry with backoff:**

When a comment post returns HTTP 429:

1. Read the `Retry-After` header from the response if available.
2. Wait for the specified duration. If no `Retry-After` header is present, wait 60 seconds.
3. Retry the failed comment once.
4. If the retry also returns 429, record the comment as failed and continue with the remaining comments.

**Fallback — summary-only posting:**

If three or more consecutive comments hit rate limits (even after individual retries), stop attempting further line-level comments and fall back to summary-only posting:

1. Stop posting individual line-level comments.
2. Report the rate limiting to the user:

> **Warning:** GitLab API rate limiting prevented posting line-level comments. {n} of {total} comments were posted before rate limiting was encountered.

3. Proceed to the summary note (Section 5.2). The summary note is a single API call and is less likely to be affected by rate limits.
4. If the summary note also hits a rate limit, wait for the `Retry-After` period and retry once. If still failing, report the error and refer the user to the structured report (Section 4).

#### 5.3.3 Force Push Detection

If the MR author force-pushes new commits between the time the analysis ran (Section 2) and the time comments are posted (Section 5), the stored `diff_refs` may be stale and comments could land on incorrect lines.

**Detection:**

Immediately before posting comments, re-fetch the MR's current `head_sha`:

```bash
glab mr view {mr_iid} --output json --jq '.diff_refs.head_sha'
```

Compare the returned `head_sha` to the one stored during Section 1.4.

**If the SHAs match:** Proceed with posting normally. No action needed.

**If the SHAs differ (force push detected):**

1. Warn the user before posting any comments:

> **Warning:** The MR diff has changed since the analysis was performed (head SHA mismatch: stored `{stored_head_sha}`, current `{current_head_sha}`). Comments may land on incorrect lines due to code changes after the analysis.
>
> Options:
> - Proceed with posting (comments may be misaligned with the current diff)
> - Skip line-level comments and post the summary note only
> - Abort comment posting and re-run the review on the updated MR

2. If the skill is running non-interactively (no user input available), default to proceeding with posting using the original `diff_refs`. The warning is included in the summary note so it is visible on the MR.

3. If the user chooses to skip line-level comments, go directly to Section 5.2 to post the summary note. The summary note should include:

> **Note:** Line-level comments were skipped because the MR diff changed after analysis (force push detected). Re-run the review on the updated MR for line-level feedback.

#### 5.3.4 Individual Comment Posting Failure

When a single line-level comment or the summary note fails to post, the skill should continue posting the remaining comments rather than aborting.

**Line-level comment failure:**

1. When a `glab api` call to post a diff discussion fails, attempt the general MR note fallback (Section 5.3.1).
2. If the fallback also fails, log the failure with the HTTP status code and response body.
3. Continue posting the remaining comments.
4. Track each failure for the completion summary (Section 5.3.6).

A finding is recorded as a failure only if both the diff discussion and the fallback note fail.

**Summary note failure:**

If posting the summary note via `glab mr note` fails:

1. Log the error with the glab output (stderr).
2. Do not retry the summary note automatically.
3. Report the failure in the completion summary.
4. The structured review report (Section 4) still contains all findings.

**All comments fail:**

If every comment (all line-level comments and the summary note) fails to post:

1. Report the error with diagnostic information:

> **All comments failed to post.** No review comments were added to the MR.
>
> {n} line-level comments and the summary note all failed. Last error: {last_error_message}
>
> Possible causes:
> - Authentication issue: verify `glab auth status` shows a valid token with API write access
> - Network connectivity: check that GitLab is reachable
> - Permissions: verify you have Developer (or higher) access to this project
>
> The structured review report (Section 4) contains the complete findings. You can manually post comments or re-run the review after resolving the issue.

2. Suggest the user manually review the findings in the structured report.

#### 5.3.5 glab CLI Errors

The `glab` CLI can fail for reasons beyond individual API errors. Surface clear, actionable error messages that distinguish between error types.

**Authentication failures (401/403):**

If any comment post returns 401 or 403, stop posting further comments immediately — all subsequent posts will also fail with the same authentication issue.

> GitLab authentication error during comment posting.
>
> HTTP status: {status_code}
> Response: {response_body}
>
> Verify your GitLab token is valid and has API write access: `glab auth status`
> If using a project or group token, confirm it has the `api` scope and at least Developer role.

**Network failures:**

If `glab` returns a connection error (no HTTP status, network timeout, DNS resolution failure):

> Unable to reach GitLab during comment posting.
>
> glab output: {stderr}
>
> The structured review report (Section 4) has been generated successfully. Check your network connection and try posting comments again.

**API errors (422, 500+):**

- **422 Unprocessable Entity**: Typically invalid position data. Fall back to the general MR note approach (Section 5.3.1) for that specific finding.
- **500+ Server Error**: Log the error for that comment and continue posting the remaining comments. Do not retry server errors automatically.
- **409 Conflict**: Retry the comment once. If still failing, record as a failure and continue.

For all error types, reference Section 9.3 for the detailed error table and handling patterns.

#### 5.3.6 Completion Confirmation

After all comment posting is complete (both line-level comments and the summary note), report the outcome to the user.

**All comments posted successfully:**

> **Comment posting complete.** {n} line-level comments and 1 summary note posted on MR !{mr_iid}.

**Partial success:**

When some comments were posted but others failed:

> **Comment posting partially complete.** {posted} of {total} line-level comments posted on MR !{mr_iid}.
>
> **Succeeded:**
> - {n} line-level diff discussions posted
> - {n} findings posted as general notes (fallback)
> - Summary note: {posted/failed}
>
> **Failed ({failed_count}):**
> - `{file_path}:{line_start}` — {error_message_or_http_status}
> - `{file_path}:{line_start}` — {error_message_or_http_status}
>
> The structured review report (Section 4) contains all findings including those that could not be posted as comments.

**No comments posted (total failure):**

Follow the "All comments fail" handling in Section 5.3.4.

**Summary note only (no line-level comments):**

When the review found only Medium/Low severity findings (no Critical/High), or when line-level posting was skipped due to force push detection:

> **Comment posting complete.** Summary note posted on MR !{mr_iid}. No line-level comments were needed ({reason}).

Where `{reason}` is one of:
- "no Critical or High severity findings"
- "line-level comments skipped due to force push detection"
- "diff_refs unavailable, all findings posted as general notes"

## 6. Output Action Selection

This section defines how the user chooses their preferred output format after MR selection and before subagent dispatch. The selection determines which output actions (Section 4, Section 5) execute once the merged findings are available. All three options consume the same deduplicated findings set produced by Section 3 — no re-analysis is required for the "Both" option.

### 6.1 Output Options

| Option | Label | What It Produces | Sections Executed |
|--------|-------|------------------|-------------------|
| **1** | Produce a detailed review report | Structured markdown report written to the conversation | Section 4 (Report Generation) |
| **2** | Create comments on the MR directly in GitLab | Line-level diff comments for Critical/High findings + summary note on the MR | Section 5 (GitLab Comments: 5.1 + 5.2) |
| **3** | Both | Generates the report AND posts GitLab comments in a single session | Section 4 + Section 5 |

All three options run the same subagent analysis (Section 2) and finding merge (Section 3) pipeline. The selection only controls which output stages execute afterward.

### 6.2 Selection in the Pipeline Flow

Present the output action selection to the user after MR validation and review notes collection (Section 1) and before subagent dispatch (Section 2). The interaction fits into the pipeline as follows:

```
[1. MR Input]  -->  MR validated, review notes collected
       |
       v
[6. Output Action Selection]  -->  User selects output format
       |
       v
[7. Depth Selection]  -->  User selects analysis depth (or accepts default)
       |
       v
[2. Subagent Dispatch]  -->  Analysis proceeds regardless of output selection
       |
       v
[3. Finding Merge]  -->  Deduplicated findings produced
       |
       v
[Output Actions]  -->  Execute Section 4 and/or Section 5 based on stored selection
```

**Prompt the user:**

> Select output format:
> 1. **Review report** — Produce a detailed structured markdown report
> 2. **GitLab comments** — Post line-level comments and a summary note directly on the MR
> 3. **Both** — Generate the report and post GitLab comments
>
> Enter 1, 2, or 3:

Store the selection as `output_action` with one of three values: `report`, `comments`, or `both`.

### 6.3 How the Selection Controls Output Stages

After the finding merge stage (Section 3) completes, check the stored `output_action` value and execute the corresponding output stages:

**When `output_action` is `report`:**
- Execute Section 4 (Report Generation) only.
- Skip Section 5 (GitLab Comments) entirely.

**When `output_action` is `comments`:**
- Execute Section 5 (GitLab Comments) only — both line-level comments (5.1) and summary note (5.2).
- Skip Section 4 (Report Generation) entirely.

**When `output_action` is `both`:**
- Execute Section 4 (Report Generation) first.
- Then execute Section 5 (GitLab Comments) — both line-level comments (5.1) and summary note (5.2).
- Both stages read from the same merged findings list produced by Section 3. The findings are not regenerated or modified between the two output stages.

### 6.4 Default Behavior

If the user provides no input or presses Enter without selecting, default to `both`. This ensures the user receives the most complete output by default — a report they can reference locally and comments visible to the full team on GitLab.

## 7. Configurable Analysis Depth

Analysis depth controls how broadly the codebase understanding subagent explores beyond the changed files. The user selects a depth before the review starts, trading off between speed and thoroughness. Depth applies only to the codebase understanding subagent (Section 2.1) — the code quality and git history subagents always analyze the full diff regardless of depth selection.

### 7.1 Depth Options

| Depth | Label | Exploration Scope | When to Use |
|-------|-------|-------------------|-------------|
| **`mr-scoped`** | Fast, focused | Changed files + direct imports and direct callers (1 hop) | Small or well-isolated changes where broader context is unnecessary |
| **`feature-scoped`** | Thorough, broader context | Changed files + direct dependencies + related modules, test files, shared utilities, and architectural patterns in the feature area | Most reviews — provides the context needed to catch convention violations and integration risks |

**Default:** `feature-scoped`. If the user does not specify a depth, use `feature-scoped` silently without prompting again.

### 7.2 Depth Selection in the Pipeline Flow

Present the depth selection to the user after MR validation and review notes collection (Section 1) and before subagent dispatch (Section 2). The interaction fits into the pipeline as follows:

```
[1. MR Input]  -->  MR validated, review notes collected
       |
       v
[7. Depth Selection]  -->  User selects depth (or accepts default)
       |
       v
[2. Subagent Dispatch]  -->  Depth passed to codebase understanding subagent
```

**Prompt the user:**

> Select analysis depth:
> 1. **Feature-scoped** (default) — Thorough analysis of the feature area including related modules, test files, and patterns
> 2. **MR-scoped** — Fast, focused analysis of changed files and their direct dependencies only
>
> Enter 1 or 2 (press Enter for feature-scoped):

If the user selects `1`, presses Enter, or provides no input, set `depth` to `feature-scoped`. If the user selects `2`, set `depth` to `mr-scoped`.

### 7.3 How Depth Modifies the Codebase Understanding Subagent

The selected depth value is injected into the codebase understanding subagent's prompt template (Section 2.1) via the `{{depth}}` template variable. The subagent's exploration behavior changes based on this value:

**When `depth` is `mr-scoped`:**

The subagent prompt instructs limited exploration:
- For each changed file, identify its direct imports and the files that directly import it.
- Read those direct dependency and caller files.
- Stop there — do not explore further beyond 1 hop from changed files.

**When `depth` is `feature-scoped`:**

The subagent prompt instructs broader exploration:
- Do everything in `mr-scoped`, plus:
- Identify the broader feature area (the directory/module the changed files belong to).
- Read related modules in the same feature area, even if not directly imported.
- Read test files associated with the changed files and the feature area.
- Look for shared utilities, base classes, or configuration files the feature area depends on.
- Identify architectural patterns (e.g., repository pattern, service layer, middleware chain) the changes interact with.

### 7.4 Subagents Not Affected by Depth

The following subagents are not affected by the depth selection and always operate on the full MR diff:

- **Code quality analysis subagent** (Section 2.2) — Analyzes all changed files for bugs, quality issues, and best practice violations. Does not explore beyond the changed files regardless of depth.
- **Git history examination subagent** (Section 2.3) — Examines the git history of all changed files. History analysis scope is determined by the files in the diff, not by depth.

## 8. Large MR Handling

This section defines how the skill detects very large merge requests and offers the user a choice between a full review and a focused review of high-impact files. Large MR handling runs after MR data is fetched (Section 1.4) and before subagent dispatch (Section 2). It filters the changed files list that is passed to subagents when the user selects focused mode.

### 8.1 Detection Thresholds

After fetching MR data via `glab mr view <iid> --output json`, extract the MR size metrics:

- **Changed file count**: The number of entries in the `.changes[]` array.
- **Changed line count**: The sum of additions and deletions across all changed files. Extract from the diff stats in the JSON response, or compute by parsing `glab mr diff <iid>` output and counting `+`/`-` lines.

**Threshold check:**

An MR triggers the large MR warning if **either** condition is true:

| Metric | Threshold |
|--------|-----------|
| Changed files | 50 or more |
| Changed lines | 1000 or more (additions + deletions) |

If neither threshold is exceeded, skip the rest of this section and proceed directly to subagent dispatch (Section 2) with the full changed files list.

**Edge case -- MR is just under threshold:**

If an MR has 49 changed files and 999 changed lines, neither threshold is met. No warning is triggered and the review proceeds normally with all files. The thresholds are strict lower bounds -- only values at or above the threshold activate large MR handling.

### 8.2 Warning and User Choice

When an MR exceeds either threshold, display the MR size metrics and offer the user a choice before proceeding.

**Warning display:**

> **Large MR detected.** This merge request has significant scope:
>
> - **Changed files:** {file_count}
> - **Changed lines:** {additions} additions, {deletions} deletions ({total} total)
>
> Large MRs may produce less focused reviews due to the volume of changes.
>
> How would you like to proceed?
> 1. **Review all files** -- analyze every changed file (thorough but slower)
> 2. **Focus on high-impact files** -- prioritize the most important files and skip low-impact ones (faster, more targeted)

**If the user chooses "Review all files" (option 1):**

Proceed to subagent dispatch (Section 2) with the complete changed files list. No filtering is applied. The review operates identically to a non-large MR.

**If the user chooses "Focus on high-impact files" (option 2):**

Run the high-impact file prioritization (Section 8.3) to rank and filter the changed files list. Pass only the high-impact files to subagent dispatch. Include a "Scope" section in the final report (Section 8.4) listing which files were analyzed and which were skipped.

### 8.3 High-Impact File Prioritization

When the user selects focused mode, rank all changed files by the following signals in priority order. Files scoring higher across these signals are retained for analysis; low-scoring files are skipped.

**Prioritization signals (ranked by importance):**

| Priority | Signal | Description | How to Assess |
|----------|--------|-------------|---------------|
| 1 | **File complexity** | Larger code files with more logic are higher priority than config, docs, or boilerplate | Check file extension and size. Code files (`.py`, `.ts`, `.tsx`, `.js`, `.jsx`) rank higher than non-code files (`.md`, `.json`, `.yaml`, `.yml`, `.toml`, `.cfg`, `.env`, `.txt`, `.csv`, lockfiles). Among code files, larger files with more substantive logic rank higher. |
| 2 | **Number of changes** | Files with more additions and deletions carry more review risk | Count the additions and deletions per file from the diff stats. Files with more total changed lines rank higher. |
| 3 | **Core module status** | Files in core source paths are higher priority than tests, docs, or config | Rank files in `src/`, `lib/`, `app/`, `core/`, `pkg/`, or the project root source directories higher than files in `tests/`, `test/`, `__tests__/`, `docs/`, `config/`, `.github/`, or similar support paths. |
| 4 | **Git history risk signals** | Files with high churn or recent bug fixes are riskier | Run `git log --oneline --since="3 months ago" -- <file>` and `git log --grep="fix\|bug\|hotfix" --oneline -- <file>` for each file. Files with more recent commits and more bug-fix commits rank higher. |

**Scoring and selection:**

1. Compute a composite score for each changed file by weighting the four signals above. The exact weighting is left to the implementing agent's judgment, but the priority order must be respected -- file complexity and number of changes outweigh core module status and git history signals.

2. Sort files by composite score, highest first.

3. Select the top files for analysis. The cutoff is:
   - Include files until the cumulative changed line count reaches approximately 60% of the total MR changed lines, OR
   - Include at least 20 files (whichever is greater), up to the total number of changed files.

4. All remaining files are marked as "skipped" in the scope report.

**Edge case -- all files are high-impact:**

If the prioritization produces a list that includes all or nearly all changed files (e.g., all files are core code files with similar change volumes), proceed with all files. Note in the scope report that focused mode was selected but all files qualified as high-impact, so the review is effectively a full review.

**Edge case -- MR has many changed files but few changed lines (renames, moves):**

Files with zero or near-zero actual code changes (pure renames, file moves, permission changes) should score low on signal 2 (number of changes) and naturally fall below the cutoff. If the MR is dominated by renames, the high-impact set may be very small. This is correct behavior -- there is little to review in renamed files. Note in the scope report that most changes were file renames or moves with minimal code modifications.

### 8.4 Scope Reporting in Focused Mode

When focused mode is active, the final review report (Section 4) must include a **Scope** section immediately after the executive summary. This section documents which files were analyzed and which were skipped so the reader understands the review's coverage.

**Scope section format:**

```markdown
## Scope

This review used **focused mode** due to the MR's size ({file_count} changed files, {line_count} changed lines). Files were prioritized by complexity, change volume, core module status, and git history risk signals.

### Analyzed Files ({analyzed_count}/{total_count})

| File | Changed Lines | Priority Signals |
|------|--------------|-----------------|
| `src/core/engine.py` | +120 / -45 | Core module, high churn, 3 recent bug fixes |
| `src/api/handler.ts` | +80 / -20 | Core module, large diff |
| ... | ... | ... |

### Skipped Files ({skipped_count}/{total_count})

| File | Changed Lines | Reason Skipped |
|------|--------------|----------------|
| `tests/test_engine.py` | +50 / -10 | Test file, lower priority |
| `docs/api-reference.md` | +30 / -5 | Documentation file |
| `package-lock.json` | +500 / -400 | Lockfile, auto-generated |
| ... | ... | ... |
```

**Rules for scope reporting:**

- Every changed file in the MR must appear in exactly one of the two tables (Analyzed or Skipped). No file should be omitted from the scope report.
- The "Priority Signals" column for analyzed files should list the key signals that ranked the file highly.
- The "Reason Skipped" column for skipped files should briefly explain why the file was deprioritized.
- If the user chose "Review all files" (option 1 in Section 8.2), do not include a Scope section. The report proceeds as normal with full coverage implied.

## 9. Error Handling

This section defines how the skill handles failures during subagent execution, GitLab API interactions, and network issues. The guiding principle is **retry-then-partial**: attempt recovery once, and if recovery fails, continue with whatever results are available rather than aborting the entire review.

### 9.1 Subagent Failure Handling

Each subagent is configured with `retry: 1` and `timeout: 300000` (5 minutes) in its dispatch configuration. The retry-then-partial strategy ensures that a single subagent failure does not prevent the user from receiving review feedback.

**Retry flow:**

```
Subagent dispatched
        |
        v
   [Execution]
        |
   Success? ──Yes──> Collect findings, continue pipeline
        |
       No (failure or timeout)
        |
        v
   [Retry once with same parameters]
        |
   Success? ──Yes──> Collect findings, continue pipeline
        |
       No
        |
        v
   Mark subagent as FAILED
   Continue with remaining subagents
   Note gap in output
```

**What counts as a subagent failure:**

- The subagent process exits with an error or returns malformed output
- The subagent exceeds its 5-minute timeout (treated identically to a crash -- the timeout is not extended on retry)
- An intermittent network issue during subagent execution causes the subagent to fail (e.g., a GitLab API call inside the git history subagent times out)

**Retry behavior:**

1. When a subagent fails, retry it exactly once using the same parameters (same prompt template variables, same timeout, same configuration).
2. If the retry succeeds, use its findings normally -- no special handling is needed.
3. If the retry also fails, mark the subagent as failed and proceed with the remaining subagents. Do not retry a second time.

**Tracking subagent status:**

Track the outcome of each subagent for use in report generation (Section 4) and comment posting (Section 5):

| Subagent | Status | Meaning |
|----------|--------|---------|
| Codebase Understanding | `succeeded` | Returned findings (may be an empty array if no issues found) |
| Codebase Understanding | `failed` | Failed after retry; no findings available |
| Code Quality Analysis | `succeeded` | Returned findings (may be an empty array if no issues found) |
| Code Quality Analysis | `failed` | Failed after retry; no findings available |
| Git History Examination | `succeeded` | Returned findings (may be an empty array if no issues found) |
| Git History Examination | `failed` | Failed after retry; no findings available |

**Distinguishing "no findings" from "failed":**

These are distinct outcomes and must be reported differently:

- **No findings (succeeded with empty array):** The subagent ran successfully and found no issues in its analysis dimension. Report this as: "No issues found by {subagent name}." This is a positive signal -- it means the code is clean in that dimension.
- **Failed (error after retry):** The subagent could not complete its analysis. Report this as: "{Subagent name} analysis unavailable -- subagent failed after retry." This is a gap in coverage -- the absence of findings does not mean the code is clean.

### 9.2 All-Subagents-Fail Scenario

If all three subagents fail (even after retries), do not produce an empty review. Instead, report an error to the user with diagnostic information:

> **Review could not be completed.** All three analysis subagents failed:
>
> - **Codebase Understanding**: {error summary or "timed out after 300s"}
> - **Code Quality Analysis**: {error summary or "timed out after 300s"}
> - **Git History Examination**: {error summary or "timed out after 300s"}
>
> Each subagent was retried once. Possible causes:
> - Network connectivity issues preventing subagent operations
> - The MR branch may not be checked out correctly (run `git status` to verify)
> - The MR may contain files that cause analysis tools to fail
>
> Try running the review again. If the problem persists, check your network connection and verify the MR is accessible.

Stop the pipeline after this message. Do not proceed to finding merge (Section 3), report generation (Section 4), or comment posting (Section 5) when there are zero successful subagents.

### 9.3 GitLab API Error Handling

GitLab API errors can occur during MR data fetching (Section 1), comment posting (Section 5), or within subagents that call `glab` commands.

**Error surfacing:**

When a `glab` command or API call fails, surface the error with:
1. The HTTP status code (if available from the glab output)
2. The response body or error message from glab
3. The specific operation that failed

Format:

> GitLab API error during {operation description}.
>
> HTTP status: {status code}
> Response: {response body or glab stderr}

**Common GitLab API errors and handling:**

| Error | Cause | Handling |
|-------|-------|----------|
| 401 Unauthorized | Token expired or invalid | Report authentication error; refer to Section 1.6 and `@skills/glab` |
| 403 Forbidden | Insufficient permissions | Report: "You do not have permission to {operation}. Check your GitLab role for this project." |
| 404 Not Found | MR or resource does not exist | Report: "Resource not found. Verify the MR number and project." |
| 409 Conflict | Concurrent modification | Retry the operation once; if still failing, report the conflict |
| 422 Unprocessable Entity | Invalid request data (e.g., bad position data for comments) | Report the specific validation error; fall back to general note if line-level comment fails |
| 429 Too Many Requests | Rate limiting | Wait and retry after the `Retry-After` period if provided; otherwise wait 60 seconds and retry once |
| 500+ Server Error | GitLab server issue | Report: "GitLab server error. Try again later." Do not retry automatically for server errors |

### 9.4 Network Failure Handling

Network failures during the review process (after the initial MR fetch succeeds) are handled differently depending on where they occur:

**During subagent execution:**

Network failures within a subagent (e.g., a `glab` or `git` command fails due to connectivity) are treated as subagent failures and follow the retry-then-partial strategy in Section 9.1. The subagent is retried once; if the network issue persists, the subagent is marked as failed and the review continues with partial results.

**During GitLab comment posting (Section 5):**

If posting comments fails due to a network error:
1. Report the network error to the user with the glab output.
2. The structured report (Section 4) is still available since it was generated before comment posting.
3. Suggest the user retry comment posting once connectivity is restored.

> Unable to post comments to GitLab. The review report has been generated successfully, but comments could not be posted due to a network error.
>
> glab output: {stderr from the command}
>
> Check your network connection and try again.

### 9.5 Error Reporting in Output

When subagent failures occur but the review continues with partial results, the gaps must be clearly communicated in the output.

**In the structured report (Section 4):**

Include a "Coverage" or "Analysis Gaps" subsection noting which subagents succeeded and which failed:

> **Analysis Coverage:**
> - Codebase Understanding: Completed
> - Code Quality Analysis: **Unavailable** -- subagent failed after retry
> - Git History Examination: Completed
>
> Findings below reflect partial analysis. Code quality coverage (bugs, best practices, error handling) is missing from this review.

**In GitLab comments (Section 5):**

The summary note posted on the MR must mention any analysis gaps so that readers of the MR comments know the review is incomplete:

> **Note:** This review has partial coverage. The {failed subagent name(s)} analysis was unavailable due to a subagent failure. Findings from the remaining subagents are included below.

## Reference Files

Detailed documentation for components referenced throughout this skill. These files provide the full content that the main skill file summarizes or references.

- `references/subagent-prompts.md` — Complete prompt templates for all three subagents with parameterized sections, template variable reference, and output format instructions
- `references/finding-schema.md` — Full Finding schema documentation with field descriptions, severity level definitions, category definitions per subagent, example findings at each severity level, and deduplication algorithm reference
- `references/gitlab-api-patterns.md` — GitLab Discussions API patterns for MR commenting, position data construction, `glab api` command templates, rate limiting handling, error response reference, and fallback strategies

## GitLab Integration Reference

This skill depends on `@skills/glab` for all GitLab CLI operations. Key reference files:

- `@skills/glab` — Main glab skill with quick command patterns
- `@skills/glab/references/merge-requests.md` — MR subcommands (`mr view`, `mr diff`, `mr list`, `mr note`, `mr checkout`)
- `@skills/glab/references/api.md` — GitLab API patterns for line-level diff comments via Discussions API
