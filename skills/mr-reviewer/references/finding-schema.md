# Finding Schema Reference

Complete documentation for the Finding schema used by all three subagents, including field descriptions, severity level definitions, category definitions, the deduplication algorithm, and example findings at each severity level.

## Schema Definition

Every finding produced by a subagent must include all nine fields:

```json
{
  "file_path": "string",
  "line_start": "number",
  "line_end": "number",
  "severity": "Critical | High | Medium | Low",
  "category": "string",
  "source": "string",
  "description": "string",
  "context": "string",
  "suggested_action": "string"
}
```

## Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_path` | `string` | Yes | Relative path to the file from the repository root (e.g., `src/auth/login.py`). Must match a file in the MR's changed file list. |
| `line_start` | `number` | Yes | Start line of the relevant code range (inclusive, 1-indexed). Must be >= 1. |
| `line_end` | `number` | Yes | End line of the relevant code range (inclusive). Must be >= `line_start`. For single-line findings, set equal to `line_start`. |
| `severity` | `enum` | Yes | One of: `Critical`, `High`, `Medium`, `Low`. See Severity Level Definitions below. |
| `category` | `string` | Yes | Finding type. Must be one of the categories defined for the producing subagent. See Category Definitions below. |
| `source` | `string` | Yes | Which subagent produced this finding. One of: `codebase-understanding`, `code-quality`, `git-history`. |
| `description` | `string` | Yes | What the issue is -- a concise explanation of the problem. Should reference specific code elements (variable names, function names, line numbers). |
| `context` | `string` | Yes | Why this is an issue -- supporting evidence from the codebase, history, or analysis that justifies the finding. |
| `suggested_action` | `string` | Yes | What the MR author should do to resolve the issue -- a specific, actionable recommendation. Never vague ("consider improving"); always concrete ("replace X with Y"). |

## Severity Level Definitions

Severity ranking (highest to lowest): **Critical > High > Medium > Low**

### Critical

Issues that will cause immediate, severe impact in production.

| Subagent | Criteria |
|----------|----------|
| Codebase Understanding | Architectural violation that will cause runtime failures or data corruption (e.g., circular dependency that breaks initialization) |
| Code Quality | Bugs that will cause crashes, data loss, or security vulnerabilities in production |
| Git History | Changes directly revert a recent bug fix or security patch (e.g., removing a null check that was added to fix a production crash) |

**Action required:** Must be fixed before merge. Posted as individual line-level diff comments on the MR.

### High

Issues that will likely cause incorrect behavior or significant maintenance problems.

| Subagent | Criteria |
|----------|----------|
| Codebase Understanding | Convention or integration issue that will likely cause bugs or maintenance problems (e.g., modifying a shared interface without updating all callers) |
| Code Quality | Logic errors likely to cause incorrect behavior; missing error handling on critical code paths |
| Git History | Changes conflict with recent work by other contributors; file has very high churn with recent bug-fix history suggesting fragile code |

**Action required:** Should be fixed before merge. Posted as individual line-level diff comments on the MR.

### Medium

Issues that should be addressed but are not immediately dangerous.

| Subagent | Criteria |
|----------|----------|
| Codebase Understanding | Convention deviation or minor architectural concern (e.g., inconsistent naming, bypassing an established pattern) |
| Code Quality | Code quality issues that hurt maintainability; best practice violations with moderate impact |
| Git History | File has moderate churn; historical context suggests the existing approach was intentional and the MR changes it without explanation |

**Action required:** Address in this MR or follow-up. Batched into the summary note (not posted as individual comments).

### Low

Minor issues, suggestions, and informational findings.

| Subagent | Criteria |
|----------|----------|
| Codebase Understanding | Minor stylistic inconsistency or suggestion for improvement (e.g., import ordering, optional type annotation) |
| Code Quality | Style issues, minor naming improvements, optional refactoring suggestions |
| Git History | General historical context useful for the reviewer; contributor distribution notes; new file with no history |

**Action required:** Optional, at author's discretion. Batched into the summary note.

## Category Definitions

Each subagent uses its own set of categories. The `category` field must match one of the categories defined for the producing subagent.

### Codebase Understanding Subagent Categories

| Category | Description | Example |
|----------|-------------|---------|
| `convention` | Codebase convention violations -- naming, style, patterns that deviate from established norms | Function uses `camelCase` when the codebase uses `snake_case` |
| `architecture` | Architectural pattern issues -- violations of layering, dependency direction, module boundaries | A utility module imports from a feature module, violating dependency direction |
| `integration-risk` | Cross-cutting concern risks -- changes that may affect shared utilities, middleware, configuration, or other consumers | A shared validation function's signature was changed without updating all 5 callers |

### Code Quality Subagent Categories

| Category | Description | Example |
|----------|-------------|---------|
| `bug` | Bugs, logic errors, potential regressions -- code that will produce incorrect behavior at runtime | Off-by-one error in loop boundary causes last element to be skipped |
| `code-quality` | Readability, maintainability, naming, duplication -- issues that make the code harder to understand or maintain | 40-line function duplicates logic already present in a helper 3 lines away |
| `best-practice` | Language-specific best practice violations -- deviation from established idioms for Python or TypeScript/JavaScript | Bare `except:` clause catches and silently swallows `KeyboardInterrupt` |
| `error-handling` | Missing error handling, unhandled edge cases, boundary conditions -- code paths that lack defensive checks | Database query result used without checking for `None` return on missing record |

### Git History Subagent Categories

| Category | Description | Example |
|----------|-------------|---------|
| `regression-risk` | Changes that revert or conflict with recent work -- the MR undoes a previous fix or contradicts a recent intentional change | Lines modified by this MR were part of a bug fix committed 2 weeks ago (commit `abc1234`) |
| `high-churn` | Files with high churn rates or recent bug-fix history -- higher-risk areas that warrant closer scrutiny | File has 15 commits in the last 3 months, 6 of which reference "fix" or "bug" |
| `historical-context` | Important context from git history about why code exists -- past commits explain the rationale behind the current implementation | Commit `def5678` added this defensive check after a production incident (PROD-456) |

## Example Findings by Severity

### Critical Example

```json
{
  "file_path": "src/api/payments.py",
  "line_start": 87,
  "line_end": 92,
  "severity": "Critical",
  "category": "bug",
  "source": "code-quality",
  "description": "SQL injection vulnerability: user-supplied `filter_expr` is interpolated directly into the SQL query string without parameterization",
  "context": "The `filter_expr` parameter comes from the API request body (line 72) and passes through no validation or sanitization before reaching the f-string SQL query on line 89. An attacker can inject arbitrary SQL via the filter field.",
  "suggested_action": "Replace the f-string query with a parameterized query using SQLAlchemy's `text()` with `bindparam()`, or use the ORM query builder to construct the WHERE clause safely."
}
```

### High Example

```json
{
  "file_path": "src/auth/session.ts",
  "line_start": 34,
  "line_end": 41,
  "severity": "High",
  "category": "integration-risk",
  "source": "codebase-understanding",
  "description": "The `SessionConfig` interface adds a required `timeout` field, but 3 other modules that implement this interface are not updated",
  "context": "src/auth/oauth.ts, src/auth/saml.ts, and src/middleware/session-refresh.ts all implement SessionConfig. Adding a required field without updating these implementations will cause TypeScript compilation errors or runtime failures if strict mode is not enforced.",
  "suggested_action": "Either make the `timeout` field optional (`timeout?: number`) with a default value, or update all three implementing modules to include the new field."
}
```

### Medium Example

```json
{
  "file_path": "src/utils/format.py",
  "line_start": 15,
  "line_end": 28,
  "severity": "Medium",
  "category": "high-churn",
  "source": "git-history",
  "description": "This file has been modified 12 times in the last 3 months, with 4 commits referencing bug fixes",
  "context": "Recent commits: 'fix(format): handle None input' (2 weeks ago), 'fix(format): correct decimal rounding' (1 month ago), 'fix(format): locale-aware number formatting' (2 months ago), 'fix(format): edge case with empty string' (3 months ago). The high bug-fix density suggests this module is fragile and changes warrant extra scrutiny.",
  "suggested_action": "Review the changes carefully against the recent bug fixes to ensure they do not reintroduce previously fixed issues. Consider adding targeted unit tests for the modified lines."
}
```

### Low Example

```json
{
  "file_path": "src/models/user.py",
  "line_start": 1,
  "line_end": 1,
  "severity": "Low",
  "category": "historical-context",
  "source": "git-history",
  "description": "New file, no prior history. No historical risk signals.",
  "context": "This file does not exist in the target branch. No previous commits, no churn data, and no regression risk from prior changes.",
  "suggested_action": "No action needed from a history perspective. Standard code review applies."
}
```

### Merged Finding Example (Post-Deduplication)

When findings from multiple subagents overlap on the same code region, they are merged into a single finding:

```json
{
  "file_path": "src/auth/login.py",
  "line_start": 40,
  "line_end": 58,
  "severity": "Critical",
  "category": "bug, convention, regression-risk",
  "source": "code-quality, codebase-understanding, git-history",
  "description": "Missing null check on user object before accessing .email | Other auth modules use the validate_user_exists() helper instead of manual null checks | This code region was patched in commit abc1234 two weeks ago to fix a production null pointer crash",
  "context": "If get_user() returns None (user not found), line 45 will raise AttributeError | src/auth/register.py and src/auth/reset_password.py both call validate_user_exists() which raises UserNotFoundError with a standard error format | Commit abc1234 (2026-02-24) message: 'fix(auth): handle missing user in login flow -- fixes PROD-1234'. The MR modifies the same lines that were part of that fix",
  "suggested_action": "Add a guard clause after get_user() to handle the None case and return an appropriate error response | Replace the manual null check with validate_user_exists(user) to match the established pattern in the auth module | Verify that the changes in this MR preserve the null-safety guarantees added by commit abc1234"
}
```

## Deduplication Algorithm

When merging findings from all three subagents, overlapping findings are deduplicated to avoid redundant output.

### Step 1: Group by File Path

Partition the combined findings list by `file_path`. Process each file's findings independently.

### Step 2: Detect Overlapping Line Ranges

Within each file, compare every pair of findings to detect overlapping line ranges. Two findings overlap when:

```
finding_A.line_start <= finding_B.line_end
AND finding_B.line_start <= finding_A.line_end
```

Build clusters of mutually overlapping findings. A finding belongs to a cluster if it overlaps with any finding already in that cluster.

### Step 3: Merge Each Cluster

For each cluster of overlapping findings, produce one merged finding:

| Merged Field | Rule |
|-------------|------|
| `file_path` | Same for all findings in the cluster |
| `line_start` | Minimum `line_start` across the cluster |
| `line_end` | Maximum `line_end` across the cluster |
| `severity` | Highest severity across the cluster (Critical > High > Medium > Low) |
| `category` | Comma-separated unique categories, alphabetically ordered |
| `source` | Comma-separated unique sources, alphabetically ordered |
| `description` | Unique descriptions joined with ` \| ` separator |
| `context` | Unique contexts joined with ` \| ` separator |
| `suggested_action` | Unique actions joined with ` \| ` separator |

Findings that do not overlap with any other finding pass through unchanged.

### Step 4: Sort the Deduplicated Findings

Sort the final list by:

1. **Severity** (descending): Critical first, then High, Medium, Low
2. **File path** (ascending, alphabetical)
3. **Line start** (ascending, numeric)

## Validation Rules

Before merging, each finding should satisfy these validation rules:

| Rule | Check |
|------|-------|
| All 9 fields present | No field may be null or missing |
| `line_end >= line_start` | End line must not precede start line |
| `line_start >= 1` | Line numbers are 1-indexed |
| `severity` is valid | Must be exactly one of: `Critical`, `High`, `Medium`, `Low` |
| `source` matches subagent | Must be `codebase-understanding`, `code-quality`, or `git-history` |
| `category` matches source | Must be a valid category for the declaring subagent |
| `file_path` is relative | Must not start with `/` or contain `..` |

Findings that fail validation should be logged as warnings and excluded from the merge. The report should note any excluded findings.
