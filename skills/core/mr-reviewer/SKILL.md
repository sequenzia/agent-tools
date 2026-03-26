---
name: mr-reviewer
description: >-
  Perform automated merge request reviews by dispatching three parallel
  agents -- codebase understanding, code quality analysis, and git history
  examination -- then merging their findings into a structured review report
  and/or GitLab line-level comments. Uses the glab CLI for GitLab integration.
  Use when the user wants to review an MR, analyze a merge request, get code
  review feedback, or post review comments on GitLab. Also trigger when users
  mention "MR review", "review this merge request", "code review for MR",
  "review my changes", or any merge request review workflow.
metadata:
  argument-hint: "<mr-url-or-iid> [--deep] [--report-only] [--comments-only]"
  type: workflow
  agents:
    - name: codebase-understanding
      file: agents/codebase-understanding.md
      shared: false
    - name: mr-code-quality
      file: agents/mr-code-quality.md
      shared: false
    - name: git-history
      file: agents/git-history.md
      shared: false
allowed-tools: Read Glob Grep Bash
---

# MR Reviewer

You are an automated merge request reviewer that dispatches parallel agents to analyze MRs from multiple dimensions, merges their findings, and delivers structured review output. You integrate with GitLab via the `glab` CLI for all GitLab operations. For glab usage patterns, read `../glab/SKILL.md`.

## Platform Requirements

This skill requires:
- **Git CLI**: Always available -- used for diff analysis and history examination
- **glab CLI** (GitLab): Required for MR data fetching and comment posting. If glab is not available, the skill can still produce a structured review report by analyzing a local branch diff. GitLab comment posting requires glab.

If `glab` is not found or not authenticated, fall back to local mode:
1. Accept a branch name instead of MR URL/IID
2. Use `git diff <target>..<source>` for the diff
3. Skip interactive MR selection and GitLab comment posting
4. Produce the structured review report (Section 4) as the sole output

## Pipeline Overview

```
User invokes mr-reviewer
        |
        v
  [1. MR Input] -- Accept MR, fetch data, parse arguments
        |
        v
  [2. Agent Dispatch] -- Launch 3 parallel analysis agents
  +----------------------------------+
  | Codebase    | Code Quality | Git |
  | Understanding| Analysis   |History|
  +----------------------------------+
        |
        v
  [3. Finding Merge] -- Collect, deduplicate, sort
        |
        v
  [4. Report Generation] -- Structured markdown report
        |
        v
  [5. GitLab Comments] -- Line-level + summary comments
```

## Configuration Parameters

Parse these from the user's invocation. All have defaults, so zero prompts are needed for the common case.

| Parameter | Default | Flag | Description |
|-----------|---------|------|-------------|
| MR target | _(required)_ | first argument | MR URL, MR IID (number), or branch name (local mode) |
| Depth | `mr-scoped` | `--deep` for `feature-scoped` | How broadly the codebase understanding agent explores |
| Output | `both` | `--report-only` or `--comments-only` | Report, GitLab comments, or both |
| Review notes | _(none)_ | free text after flags | Optional guidance for the review |

If no MR target is provided, list open MRs via `glab mr list --output json` and let the user choose.

## Agents

This skill dispatches three independent analysis agents:

| Agent | File | Tools | Description |
|-------|------|-------|-------------|
| codebase-understanding | `agents/codebase-understanding.md` | Read, Glob, Grep | Convention violations, architectural issues, integration risks |
| mr-code-quality | `agents/mr-code-quality.md` | Read, Glob, Grep, Bash | Bugs, code quality, best practices, error handling |
| git-history | `agents/git-history.md` | Bash, Read, Glob, Grep | Regression risks, high-churn areas, historical context |

All three agents return findings using the same 10-field JSON schema. See `references/finding-schema.md` for the complete schema documentation.

## Execution Strategy

**If subagent dispatch is available:** Dispatch all three agents in parallel, passing the MR context data (diff, changed files, metadata) to each. Wait for all to complete (or fail/timeout) before proceeding to finding merge.

**If subagent dispatch is not available:** Read each agent file sequentially and follow its instructions inline:
1. Read `agents/codebase-understanding.md`, execute its analysis, collect findings
2. Read `agents/mr-code-quality.md`, execute its analysis, collect findings
3. Read `agents/git-history.md`, execute its analysis, collect findings

Then proceed to finding merge with all collected findings.

Each agent is configured with a 5-minute timeout and 1 retry on failure. If an agent fails after retry, continue with partial results and note the gap in the output.

---

## 1. MR Input Handling

### 1.1 MR Selection

Determine how the user identifies the MR:

| Method | Input Format | Action |
|--------|-------------|--------|
| MR URL | GitLab URL containing `/-/merge_requests/<iid>` | Parse IID and project path from URL |
| MR IID | Bare number (digits only) | Use directly with `glab mr view <iid>` |
| Branch name | Non-numeric string (local mode) | Use `git diff <target>..<branch>` |
| No input | Nothing provided | List open MRs via `glab mr list --output json`, let user choose |

For URL parsing: strip fragments (`#...`) and trailing path segments (`/diffs`, `/commits`). Extract the IID from the segment after `/-/merge_requests/`. If the URL hostname differs from the authenticated GitLab host, pass `-R <namespace/project>` to glab commands.

### 1.2 MR Validation and Data Extraction

Fetch MR data:

```bash
glab mr view <iid> --output json
```

**Validation:**
- If MR not found (404): report error and stop.
- If MR is merged/closed: warn the user and ask whether to proceed.

**Extract and store:**

| Field | JSON Path | Used By |
|-------|-----------|---------|
| MR IID | `.iid` | All stages |
| Title | `.title` | Report, agent context |
| Description | `.description` | Agent context |
| Source branch | `.source_branch` | Branch checkout, agent context |
| Target branch | `.target_branch` | Agent context |
| Author | `.author.username` | Report |
| Changed files | `.changes[].new_path` | Agent dispatch |
| diff_refs (base, head, start SHA) | `.diff_refs.*` | GitLab comment positioning |
| Web URL | `.web_url` | Report |
| Project base URL | Derived: strip `/-/merge_requests/{iid}` from `.web_url` | Permalinks in report and comments |

**Derived values:**
- `project_base_url`: Strip `/-/merge_requests/{iid}` from `web_url`. Example: `https://gitlab.company.com/group/project/-/merge_requests/123` becomes `https://gitlab.company.com/group/project`. Works for all GitLab instances including projects nested in subgroups.
- `head_sha` (from `diff_refs`): Used for both comment positioning (Section 5) and permalink construction. See `references/gitlab-api-patterns.md` "Permalink URL Construction" for the full pattern.

**Check out the MR branch** so agents can read actual code:

```bash
glab mr checkout <iid>
```

If checkout fails, set CHECKOUT_AVAILABLE to `false` and continue -- agents will work from available data.

### 1.3 Large MR Detection

After fetching MR data, check if the MR exceeds size thresholds:
- **50+ changed files** OR **1000+ changed lines** (additions + deletions)

If exceeded and `--deep` is not set, automatically apply focused mode: prioritize high-impact files by complexity, change volume, core module status, and git history risk signals. Select files covering ~60% of total changed lines (minimum 20 files). Include a Scope section in the report listing analyzed vs. skipped files.

If `--deep` is set, review all files regardless of size.

### 1.4 Review Notes

If the user provided review notes (free text after flags), store as REVIEW_NOTES and pass to all agents via their input context. Notes are additive -- the full review runs regardless. Notes add extra attention to specified areas.

If no notes provided, skip without prompting.

### 1.5 Error Handling

- **glab not authenticated**: Report: "glab is not authenticated. Run `glab auth login` or set `GITLAB_TOKEN`." For glab setup, read `../glab/SKILL.md`. Stop the review.
- **Network failure**: Report the glab error and stop. Do not retry automatically.
- **MR not found**: Report the glab error with the IID and stop.

---

## 2. Agent Dispatch

### 2.1 Codebase Understanding Agent

Analyzes changed files and surrounding codebase context. Depth-aware: `mr-scoped` (direct imports/callers only) or `feature-scoped` (broader feature area exploration).

**Finding categories:** `convention`, `architecture`, `integration-risk`

Pass to the agent: CHANGED_FILE_LIST, MR_DIFF, REVIEW_NOTES, DEPTH.

See `agents/codebase-understanding.md` for full agent instructions.

### 2.2 Code Quality Agent

Analyzes code changes for bugs, quality issues, and best practice violations. Reads full file content (not just diff) for context. Covers Python, TypeScript, JavaScript with detailed rules; general heuristics for other languages.

**Finding categories:** `bug`, `code-quality`, `best-practice`, `error-handling`

Pass to the agent: MR_TITLE, MR_DESCRIPTION, SOURCE_BRANCH, TARGET_BRANCH, CHANGED_FILE_LIST, MR_DIFF, REVIEW_NOTES, and the full content of each changed file (CHANGED_FILES array).

See `agents/mr-code-quality.md` for full agent instructions.

### 2.3 Git History Agent

Examines git history of changed files for regression risks, churn patterns, and historical context.

**Finding categories:** `regression-risk`, `high-churn`, `historical-context`

Pass to the agent: CHANGED_FILE_LIST, MR_BRANCH, TARGET_BRANCH, REVIEW_NOTES, CHECKOUT_AVAILABLE.

See `agents/git-history.md` for full agent instructions.

### 2.4 Agent Failure Handling

Each agent is retried once on failure. If still failing, mark as `failed` and continue with remaining agents.

- **succeeded**: Returned findings (may be empty array if no issues found)
- **failed**: Could not complete analysis; contributes zero findings

"No findings" (succeeded with empty array) is distinct from "failed" -- report them differently. A clean result is a positive signal; a failed agent is a coverage gap.

If all three agents fail, report an error with diagnostic info and stop. Do not produce an empty review.

---

## 3. Finding Merge and Deduplication

After agents complete, collect all findings into a single list, deduplicate overlapping findings, and sort for output.

### 3.1 Collecting Results

1. Parse JSON arrays from each successful agent. Failed agents contribute empty arrays.
2. Concatenate into a combined findings list.
3. Track each agent's status (succeeded/failed) for the report.

### 3.2 Deduplication

Overlapping findings from different agents targeting the same code region are merged. The algorithm uses category-aware merging to avoid combining unrelated findings.

See `references/finding-schema.md` for the complete deduplication algorithm, merge rules, and examples.

**Summary:** Group by file, detect overlapping line ranges, merge only if findings are related (shared category, significant overlap, or same source), produce structured sub-findings, sort by severity descending then file path then line number.

### 3.3 Handling Partial Results

Failed agents contribute zero findings. The merge proceeds with available results. Gap records are passed to the report generation stage:

```
Gap:
  agent: "codebase-understanding" | "code-quality" | "git-history"
  reason: "Agent timed out after retry" | "Agent returned invalid output after retry"
```

---

## 4. Structured Review Report

The report is always generated before GitLab comment posting so the user has complete findings even if posting fails.

### 4.1 Report Template

````markdown
# MR Review: !{iid} -- {title}

**Branch:** `{source_branch}` -> `{target_branch}`
**Author:** @{author}
**MR Link:** {web_url}

## Executive Summary

{1-3 sentences summarizing the MR's purpose and overall assessment: finding count, highest severity, and any coverage gaps.}

**Analysis Coverage:**
- Codebase Understanding: {Completed | **Unavailable** -- agent failed after retry}
- Code Quality Analysis: {Completed | **Unavailable** -- agent failed after retry}
- Git History Examination: {Completed | **Unavailable** -- agent failed after retry}

{If any agent failed, add a blockquote noting partial coverage.}

{If REVIEW_NOTES provided: show notes and count of findings in noted areas.}

{If focused mode active: insert Scope section listing analyzed vs. skipped files.}

{If 50+ findings: insert Top Issues table (all Critical + up to 10 High).}

## Findings

{For each severity level (Critical, High, Medium, Low) that has findings:}

### {Severity} ({count})

#### `{file_path}`

- **[Lines {line_start}-{line_end}]({project_base_url}/-/blob/{head_sha}/{file_path}#L{line_start}-{line_end})** | `{category}` | Source: {source} | Confidence: {confidence}%
  {If merged finding with sub_findings, render each as a labeled bullet.}
  {description}
  **Context:** {context}
  **Suggested action:** {suggested_action}

{For each succeeded agent with zero findings:}
> No issues found in **{dimension name}** analysis.

## Statistics

| Metric | Value |
|--------|-------|
| Total findings | {total} |
| Critical / High / Medium / Low | {counts} |
| Files with findings | {count} |
| Total files analyzed | {count} |
| Agent coverage | {n}/3 dimensions |

## Recommendations

{Numbered list of prioritized action items based on findings.}
````

**Permalink availability:** Line references use clickable GitLab blob permalinks constructed from `project_base_url` and `head_sha` (see Section 1.2 and `references/gitlab-api-patterns.md` "Permalink URL Construction"). For single-line findings (`line_start == line_end`), use `#L{line_start}` instead of a range. In local mode where `project_base_url` is unavailable, fall back to plain text: `**Lines {line_start}-{line_end}**`.

### 4.2 Clean Review (No Findings)

When all agents succeeded and no findings exist, produce a clean review confirming all three dimensions found no issues. If any agent failed, use the standard template with partial coverage noted -- absence of findings may be due to the gap.

### 4.3 Findings Related to Review Notes

When REVIEW_NOTES is provided, tag matching findings with `[Noted Area]` by comparing file paths, category, and description against terms from the notes.

---

## 5. GitLab Comment Posting

Posts review findings directly on the MR. Only executes when output is `comments` or `both`. For detailed API patterns, see `references/gitlab-api-patterns.md`.

### 5.1 Line-Level Comments (Critical/High Only)

Post each Critical and High finding as a diff discussion anchored to the specific line. Construct position data from the `diff_refs` extracted in Section 1.2.

**Comment format:**
```
[{SEVERITY}] {description}

{context}

**Suggested:** {suggested_action}
```

For merged findings with sub_findings, use the labeled section format from `references/finding-schema.md`.

**Posting via glab api:**
```bash
glab api projects/:id/merge_requests/{iid}/discussions -X POST \
  -f "body=..." \
  -f "position[position_type]=text" \
  -f "position[base_sha]=..." \
  -f "position[head_sha]=..." \
  -f "position[start_sha]=..." \
  -f "position[old_path]=..." \
  -f "position[new_path]=..." \
  -f "position[new_line]=..."
```

### 5.2 Summary Note

After line-level comments, post a single summary note via `glab mr note`:
- Statistics header with finding counts
- Critical/High findings list (one-line each, details are in line-level comments)
- Medium/Low findings grouped by file with inline suggested actions
- Agent gap notes if any failed
- Review notes reference if provided

All file and line references in the summary note use markdown permalink format so developers can click through to the code. See `references/gitlab-api-patterns.md` "Permalink URL Construction" for the URL pattern and "Posting a Summary Note" for the template. When `project_base_url` is unavailable (local mode), use plain text references instead.

Truncate if > 25 Medium/Low findings: show first 15 files, then count of remaining.

### 5.3 Error Handling and Fallback

**Layered fallback strategy:**

```
Line-level diff discussion (preferred)
  -> General MR note with file:line reference (if position fails)
  -> Record as failed and continue (if note also fails)
  -> Summary-only mode (if 3+ consecutive failures)
  -> Report only (if summary also fails)
```

**Force push detection:** Before posting, re-fetch `head_sha`. If changed, warn the user and offer to skip line-level comments, proceed anyway, or abort posting.

**Rate limiting:** Batch with 1s pauses for 10+ findings, 2s pauses in groups of 10 for 20+ findings. On HTTP 429, wait for Retry-After (or 60s), retry once.

**Auth errors (401/403):** Stop posting immediately -- all subsequent calls will fail. Report the error.

**Completion confirmation:** Report posted/failed counts and reference the structured report for any findings that couldn't be posted.

---

## Reference Files

- `references/finding-schema.md` -- Complete finding schema, severity/category definitions, deduplication algorithm, merge examples, validation rules
- `references/gitlab-api-patterns.md` -- GitLab Discussions API patterns, position data construction, glab command templates, rate limiting, error handling, fallback strategies
- `../glab/SKILL.md` -- glab CLI setup and usage patterns
