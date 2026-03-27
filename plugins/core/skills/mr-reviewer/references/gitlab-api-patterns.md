# GitLab API Patterns for MR Commenting

Patterns for posting line-level diff comments and summary notes on GitLab merge requests using `glab api` and `glab mr note`. For general `glab api` usage, see `../glab/references/api.md`. For MR subcommand reference, see `../glab/references/merge-requests.md`.

## Discussions API Overview

Line-level diff comments are posted via the GitLab Discussions API. This creates a new discussion thread anchored to a specific line in the MR diff. The endpoint is:

```
POST /projects/:id/merge_requests/:iid/discussions
```

Where:
- `:id` is automatically resolved by `glab` to the current project's numeric ID
- `:iid` is the MR IID (the number shown in the GitLab UI)

## Permalink URL Construction

Findings in the structured report and summary note include clickable links to the exact source code lines on GitLab. These are blob permalinks pinned to the specific commit that was reviewed.

### URL Pattern

```
{project_base_url}/-/blob/{head_sha}/{file_path}#L{line_start}-{line_end}
```

For single-line findings where `line_start == line_end`, use `#L{line_start}` (omit the range).

### Components

| Component | Source | Description |
|-----------|--------|-------------|
| `project_base_url` | Derived from `.web_url` | The project's base URL, obtained by stripping `/-/merge_requests/{iid}` from the MR's `web_url` |
| `head_sha` | `.diff_refs.head_sha` | The head commit SHA -- ensures the link points to the exact code version that was reviewed |
| `file_path` | Finding's `file_path` field | Relative path from repo root (e.g., `src/auth/login.py`). URL-encode if it contains spaces or special characters |
| `#L{start}-{end}` | Finding's `line_start` and `line_end` | Line range anchor. GitLab uses a single `L` prefix: `#L40-58`, not `#L40-L58` |

### Deriving project_base_url

Strip the `/-/merge_requests/{iid}` suffix from `web_url`:

```
web_url:          https://gitlab.company.com/group/project/-/merge_requests/123
project_base_url: https://gitlab.company.com/group/project
```

This works for all GitLab instances (self-hosted and gitlab.com) and for projects nested in subgroups (e.g., `org/team/subteam/project`), because `/-/merge_requests/{iid}` is a standard GitLab URL convention.

### Markdown Link Formats

**In the report** (finding line references):
```markdown
[Lines 40-58](https://gitlab.company.com/group/project/-/blob/abc1234/src/auth/login.py#L40-58)
```

**In the summary note** (Critical/High one-liners):
```markdown
[src/auth/login.py:40](https://gitlab.company.com/group/project/-/blob/abc1234/src/auth/login.py#L40-58)
```

**In the summary note** (Medium/Low per-file lines):
```markdown
[Line 40](https://gitlab.company.com/group/project/-/blob/abc1234/src/auth/login.py#L40-58)
```

### Local Mode Fallback

When running in local mode (no `glab`, no MR data), `project_base_url` and `head_sha` are not available. Fall back to plain text references without links:
- Report: `**Lines {line_start}-{line_end}**`
- Summary note: `**{file_path}:{line_start}**`

---

## Position Data Construction

Each line-level comment requires position data that tells GitLab exactly where in the diff to anchor the comment.

### Required Values

These values come from `glab mr view <iid> --output json`, specifically the `.diff_refs` object:

| Field | Source | Description |
|-------|--------|-------------|
| `base_sha` | `.diff_refs.base_sha` | Base commit SHA of the MR diff |
| `head_sha` | `.diff_refs.head_sha` | Head commit SHA of the MR diff |
| `start_sha` | `.diff_refs.start_sha` | Start commit SHA of the MR diff |

### Extracting diff_refs

```bash
# Get all three SHAs at once
glab mr view <iid> --output json --jq '.diff_refs'

# Get individual values
glab mr view <iid> --output json --jq '.diff_refs.base_sha'
glab mr view <iid> --output json --jq '.diff_refs.head_sha'
glab mr view <iid> --output json --jq '.diff_refs.start_sha'
```

### Position Object Structure

```json
{
  "position_type": "text",
  "base_sha": "<base_sha from diff_refs>",
  "head_sha": "<head_sha from diff_refs>",
  "start_sha": "<start_sha from diff_refs>",
  "old_path": "<file_path>",
  "new_path": "<file_path>",
  "new_line": "<line_number>"
}
```

Field details:

| Field | Value | Notes |
|-------|-------|-------|
| `position_type` | Always `"text"` | Use `"text"` for code comments (`"image"` is for image diffs) |
| `base_sha` | From `.diff_refs.base_sha` | Defines the diff baseline |
| `head_sha` | From `.diff_refs.head_sha` | Defines the diff head |
| `start_sha` | From `.diff_refs.start_sha` | Defines the diff start point |
| `old_path` | File path before rename (or same as `new_path`) | Must match the file's path in the base commit |
| `new_path` | File path after rename (or same as `old_path`) | Must match the file's path in the head commit |
| `new_line` | Finding's `line_start` | Anchors to the new (head) side of the diff |

## glab api Command Templates

### Posting a Line-Level Diff Discussion

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

**Notes:**
- The `-f` flag sends fields as the request body in JSON format for POST requests.
- Position fields use the nested syntax `position[field_name]=value` which `glab api` maps to a nested JSON object.
- The `body` field contains the full comment text with the severity tag, description, context, and suggested action.
- Replace `{mr_iid}` with the MR's IID number.

### Posting a General MR Note (Fallback)

When line-level positioning fails, post as a general MR note:

```bash
glab mr note {mr_iid} -m "[{SEVERITY}] [{file_path}:{line_start}]({project_base_url}/-/blob/{head_sha}/{file_path}#L{line_start}-{line_end}) -- {description}

{context}

**Suggested:** {suggested_action}"
```

**Notes:**
- `glab mr note` posts a general comment on the MR (not anchored to a specific diff line).
- Include a permalink `[{file_path}:{line_start}]({permalink_url})` so the reader can navigate directly to the relevant code. See "Permalink URL Construction" above for the URL pattern.
- When `project_base_url` is unavailable (local mode), fall back to plain text `{file_path}:{line_start}`.
- This is the fallback when diff_refs are unavailable or position data is invalid.

### Posting a Summary Note

```bash
glab mr note {mr_iid} -m "## MR Review Summary

**Statistics:** {n} findings ({critical} critical, {high} high, {medium} medium, {low} low) | {files} files analyzed

### Critical/High Issues
- **[{file_path}:{line_start}]({project_base_url}/-/blob/{head_sha}/{file_path}#L{line_start}-{line_end})** [{severity}] {description}
- **[{file_path}:{line_start}]({project_base_url}/-/blob/{head_sha}/{file_path}#L{line_start}-{line_end})** [{severity}] {description}

### Additional Findings (Medium/Low)
**{file_path}:**
- [Line {line_start}]({project_base_url}/-/blob/{head_sha}/{file_path}#L{line_start}-{line_end}): [{severity}] {description} -- {suggested_action}
- [Line {line_start}]({project_base_url}/-/blob/{head_sha}/{file_path}#L{line_start}-{line_end}): [{severity}] {description} -- {suggested_action}"
```

### Checking for Force Push (Stale diff_refs)

Before posting comments, verify the MR diff has not changed since analysis:

```bash
# Get current head SHA
glab mr view {mr_iid} --output json --jq '.diff_refs.head_sha'
```

Compare the returned value to the `head_sha` stored during MR data fetching. If they differ, a force push occurred and comments may land on incorrect lines.

## Renamed File Handling

When a file was renamed in the MR, `old_path` and `new_path` must differ:

```bash
# Check for renamed files in MR changes
glab mr view {mr_iid} --output json --jq '.changes[] | select(.old_path != .new_path) | {old_path, new_path}'
```

For renamed files, set:
- `old_path` = the file's previous name (`.changes[].old_path`)
- `new_path` = the file's current name (`.changes[].new_path`)

## Rate Limiting Handling

### Prevention -- Batching

| Condition | Strategy |
|-----------|----------|
| More than 10 findings to post | Insert 1-second pause between consecutive posts |
| More than 20 findings to post | Batch in groups of 10 with 2-second pause between batches |

### Detection and Retry

When a request returns HTTP 429 (Too Many Requests):

1. Read the `Retry-After` header if present in the response.
2. Wait for the specified duration. If no header, wait 60 seconds.
3. Retry the failed request once.
4. If the retry also returns 429, record as failed and continue with remaining requests.

### Escalation -- Summary-Only Fallback

If three or more consecutive requests hit rate limits (even after retries):

1. Stop attempting individual line-level comments.
2. Warn the user: `GitLab API rate limiting prevented posting line-level comments.`
3. Post only the summary note (a single API call, less likely to be rate-limited).
4. If the summary note also hits a rate limit, wait and retry once.

## Common API Error Responses and Handling

| HTTP Status | Cause | Handling |
|-------------|-------|----------|
| **400 Bad Request** | Malformed request or invalid position data | Check position field values; fall back to general MR note for the affected finding |
| **401 Unauthorized** | Token expired or invalid | **Stop posting immediately** -- all subsequent requests will also fail. Report: "Verify your GitLab token is valid and has API write access: `glab auth status`" |
| **403 Forbidden** | Insufficient permissions | **Stop posting immediately.** Report: "You do not have permission to post comments. Check your GitLab role for this project (Developer or higher required)." |
| **404 Not Found** | MR or project does not exist | Report: "Resource not found. Verify the MR number and project." |
| **409 Conflict** | Concurrent modification | Retry the request once. If still failing, record as failed and continue. |
| **422 Unprocessable Entity** | Invalid position data (most common for diff comments) | Fall back to general MR note for the affected finding. The position data may reference a line that is not part of the diff. |
| **429 Too Many Requests** | Rate limiting | Follow the rate limiting handling pattern above. |
| **500 Internal Server Error** | GitLab server issue | Log the error for the affected comment and continue posting remaining comments. Do not retry. |
| **502 Bad Gateway** | GitLab server issue (proxy/load balancer) | Same as 500 -- log and continue. |
| **503 Service Unavailable** | GitLab under maintenance or overloaded | Log and continue. If multiple 503s occur, stop and report. |

## Fallback Strategy Summary

The comment posting pipeline has a layered fallback strategy:

```
Line-level diff discussion (preferred)
        |
        v (fails with 400/422)
General MR note with file:line reference (fallback)
        |
        v (also fails)
Record as failed; include in completion summary
        |
        v (3+ consecutive failures)
Stop line-level posting; summary-only mode
        |
        v (summary note fails)
Report error; refer user to structured report (Section 4)
```

Each layer preserves as much finding content as possible while degrading gracefully when API calls fail.

## Authentication Verification

Before posting any comments, verify authentication:

```bash
# Check glab is authenticated
glab auth status

# Verify API access by reading the MR (non-destructive)
glab api projects/:id/merge_requests/{mr_iid} --jq '.iid'
```

If authentication fails before any comments are posted, report the error and skip the entire commenting phase. The structured report (Section 4) remains available.

## Network Failure Handling

When `glab` returns a connection error (no HTTP status):

- Report: "Unable to reach GitLab during comment posting."
- Include the glab stderr output for diagnosis.
- The structured report is still available.
- Suggest the user check connectivity and retry.

Network failures are distinct from API errors. Network failures produce no HTTP status code -- the connection itself fails (DNS resolution, TCP timeout, TLS handshake failure, etc.).

## Complete Posting Workflow

For the full end-to-end comment posting workflow, refer to Section 5 of the main skill file (`SKILL.md`):

1. **Section 5.1** -- Line-level comment posting (Critical/High findings)
2. **Section 5.2** -- Summary note posting (all findings overview + Medium/Low details)
3. **Section 5.3** -- Error handling and fallback (position fallback, rate limiting, force push detection, individual failures, CLI errors, completion confirmation)
