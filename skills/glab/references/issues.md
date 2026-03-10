# Issues — glab issue

Create, track, triage, and manage GitLab issues from the command line.

## Subcommand Overview

| Subcommand | Alias | Description |
|------------|-------|-------------|
| `create` | `new` | Create a new issue |
| `list` | `ls` | List issues with filters |
| `view` | — | Display issue details |
| `update` | — | Modify issue properties |
| `close` | — | Close an issue |
| `reopen` | — | Reopen a closed issue |
| `note` | — | Add a comment |
| `delete` | — | Delete an issue |
| `board` | — | View issue boards |
| `subscribe` | — | Subscribe to issue notifications |
| `unsubscribe` | — | Unsubscribe from notifications |

## create

Create a new issue in the current project.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--title` | Issue title (required) | `"Login fails on mobile"` |
| `--description` | Issue body | `"Steps to reproduce..."` |
| `--label` | Add labels (repeatable) | `--label bug --label P1` |
| `--assignee` | Assign users (repeatable) | `--assignee alice` |
| `--milestone` | Set milestone | `"v2.0"` |
| `--epic` | Link to epic | `5` |
| `--due-date` | Set due date | `"2025-06-30"` |
| `--weight` | Set issue weight | `3` |
| `--confidential` | Mark as confidential | — |
| `--time-estimate` | Set time estimate | `"3h"` |
| `--time-spent` | Log time spent | `"1h30m"` |
| `--linked-issues` | Link related issues | `12,15` |
| `--linked-mr` | Link related MR | `42` |
| `--link-type` | Relationship type | `relates_to` |
| `--recover` | Recover a draft issue from a previous failed creation | — |
| `--web` | Open in browser after creation | — |
| `--yes` | Skip confirmation | — |
| `--no-editor` | Skip opening editor | — |

### Examples

```bash
# Quick issue creation
glab issue create --title "Fix: login timeout on slow connections" \
  --label bug --assignee @me --yes

# Detailed issue with milestone and estimate
glab issue create --title "Add rate limiting to API endpoints" \
  --description "Implement token bucket rate limiting for all public API endpoints. Target: 100 req/min per user." \
  --label "enhancement" --label "api" \
  --milestone "v2.1" --weight 5 --time-estimate "8h" --yes

# Confidential security issue
glab issue create --title "SQL injection in search endpoint" \
  --confidential --label "security" --assignee security-team --yes

# Issue linked to existing MR
glab issue create --title "Tracking: auth refactor" \
  --linked-mr 42 --yes
```

## list

List issues with comprehensive filtering.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--state` | Filter by state (opened/closed/all) | `opened` |
| `--assignee` | Filter by assignee | `@me` |
| `--author` | Filter by author | `alice` |
| `--label` | Filter by label (repeatable) | `--label bug` |
| `--not-label` | Exclude labels | `--not-label wontfix` |
| `--not-assignee` | Exclude assignees | `--not-assignee bot` |
| `--milestone` | Filter by milestone | `"v2.0"` |
| `--epic` | Filter by epic | `5` |
| `--search` | Search title and description | `"timeout"` |
| `--in` | Search scope (title/description) | `title` |
| `--confidential` | Show only confidential issues | — |
| `--issue-type` | Filter by type (issue/incident/test_case) | `issue` |
| `--order` | Order by (created_at/updated_at/priority/weight) | `updated_at` |
| `--sort` | Sort direction (asc/desc) | `desc` |
| `--output` | Output format (text/json) | `json` |
| `--per-page` | Results per page | `50` |
| `--group` | List across a group | `my-team` |
| `--all` | List across all projects you have access to | — |

### Examples

```bash
# Your open issues in current project
glab issue list --assignee=@me

# Search for issues by keyword
glab issue list --search "timeout" --state opened

# Bugs without the "triaged" label
glab issue list --label bug --not-label triaged

# Issues in a milestone, JSON output
glab issue list --milestone "v2.0" --output json

# All issues across a group
glab issue list --group backend-team --state opened

# All issues you created across all projects
glab issue list --all --author=@me
```

## view

Display issue details.

```bash
# View by issue number
glab issue view 15

# View with comments
glab issue view 15 --comments

# JSON output
glab issue view 15 --output json

# Open in browser
glab issue view 15 --web
```

## update

Modify properties of an existing issue.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--title` | Update title | `"Updated title"` |
| `--description` | Update description | `"New details"` |
| `--label` | Add labels | `--label triaged` |
| `--unlabel` | Remove labels | `--unlabel needs-triage` |
| `--assignee` | Set assignees | `--assignee alice` |
| `--unassign` | Remove assignees | `--unassign bob` |
| `--milestone` | Set milestone | `"v2.0"` |
| `--confidential` | Mark confidential | — |
| `--lock-discussion` | Lock discussion | — |
| `--unlock-discussion` | Unlock discussion | — |

### Examples

```bash
# Triage an issue: add labels and assign
glab issue update 15 --label "triaged" --label "P2" --assignee alice

# Move to a milestone
glab issue update 15 --milestone "v2.1"

# Remove a label
glab issue update 15 --unlabel "needs-triage"
```

## close / reopen

```bash
# Close an issue
glab issue close 15

# Reopen a closed issue
glab issue reopen 15
```

## note

Add a comment to an issue.

```bash
# Inline comment
glab issue note 15 -m "Reproduced on mobile. Stack trace attached."

# Opens editor if -m is omitted
glab issue note 15
```

## delete

Permanently delete an issue (requires appropriate permissions).

```bash
glab issue delete 15
```

## board

View and interact with issue boards.

```bash
# View project issue boards
glab issue board view

# Create a new board
glab issue board create --name "Sprint 5"
```

## subscribe / unsubscribe

```bash
glab issue subscribe 15      # Get notifications for this issue
glab issue unsubscribe 15    # Stop notifications
```

## Common Workflows

### Triage New Issues

```bash
# 1. List untriaged issues
glab issue list --not-label triaged --state opened

# 2. View each issue
glab issue view 15

# 3. Add labels and assign
glab issue update 15 --label "triaged" --label "bug" --label "P1" --assignee alice

# 4. Set milestone
glab issue update 15 --milestone "v2.1"
```

### Create Issue and Start Working

```bash
# 1. Create the issue
glab issue create --title "Implement caching layer" \
  --label enhancement --assignee @me --milestone "v2.1" --yes

# 2. Create a branch and MR linked to the issue
git checkout -b feature/caching
# ... make changes ...
glab mr create --fill --related-issue 20 --copy-issue-labels --yes

# 3. Close issue when MR is merged (or use "Closes #20" in MR description)
glab issue close 20
```

### Bulk Operations with JSON

```bash
# Get all open bug issue IDs
glab issue list --label bug --state opened --output json | jq '.[].iid'

# Export issues to JSON for processing
glab issue list --milestone "v2.0" --output json > sprint-issues.json
```

## Tips

- Use `Closes #15` or `Fixes #15` in MR descriptions to auto-close issues when the MR is merged.
- `@me` is a special keyword that refers to the authenticated user — works with `--assignee`, `--author`, and `--reviewer`.
- Issue numbers are project-scoped (IID). Use the number shown in the GitLab UI.
- `--weight` is useful for sprint planning and reflects story points or complexity.
- Labels can be created on-the-fly when used in `--label` flags if they don't already exist (depending on project settings).
