# Merge Requests — glab mr

Create, review, update, and merge GitLab merge requests from the command line.

## Subcommand Overview

| Subcommand | Alias | Description |
|------------|-------|-------------|
| `create` | `new` | Create a new merge request |
| `list` | `ls` | List merge requests with filters |
| `view` | `show` | Display merge request details |
| `checkout` | — | Check out an MR branch locally |
| `diff` | — | View MR file changes |
| `approve` | — | Approve a merge request |
| `merge` | `accept` | Merge a merge request |
| `update` | — | Modify MR properties |
| `note` | — | Add a comment to an MR |
| `rebase` | — | Rebase MR onto target branch |
| `close` | — | Close an MR without merging |
| `reopen` | — | Reopen a closed MR |
| `delete` | — | Delete a merge request |
| `revoke` | — | Withdraw your approval |
| `approvers` | — | View approval rules and status |
| `subscribe` | — | Subscribe to MR notifications |
| `unsubscribe` | — | Unsubscribe from MR notifications |
| `todo` | — | Add MR to your to-do list |
| `issues` | — | View issues related to an MR |

## create

Create a new merge request from the current or specified branch.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--fill` | Auto-fill title and description from commits | — |
| `--fill-commit-body` | Use full commit messages in description | — |
| `--title` | MR title | `"Add OAuth support"` |
| `--description` | MR description | `"Implements OAuth2 flow"` |
| `--target-branch` | Target branch (default: repo default) | `main` |
| `--source-branch` | Source branch (default: current) | `feature/auth` |
| `--draft` | Mark as draft | — |
| `--label` | Add labels (repeatable) | `--label bug --label urgent` |
| `--assignee` | Assign users (repeatable) | `--assignee alice` |
| `--reviewer` | Request review (repeatable) | `--reviewer bob` |
| `--milestone` | Set milestone | `"v2.0"` |
| `--squash-message` | Set squash commit message | `"feat: add auth"` |
| `--remove-source-branch` | Delete source branch after merge | — |
| `--related-issue` | Link related issue | `15` |
| `--copy-issue-labels` | Copy labels from related issue | — |
| `--yes` | Skip confirmation prompts | — |
| `--web` | Open in browser after creation | — |
| `--push` | Push the branch before creating | — |
| `--no-editor` | Skip opening editor for description | — |
| `--allow-collaboration` | Allow upstream members to push | — |

### Examples

```bash
# Quick MR from current branch with auto-filled title/description
glab mr create --fill --yes

# Draft MR with specific details
glab mr create --title "feat: add OAuth2 login" \
  --description "Implements OAuth2 authorization code flow" \
  --draft --reviewer alice --label "auth" --yes

# MR linked to an issue with squash message
glab mr create --fill --related-issue 42 \
  --copy-issue-labels --squash-message "fix: resolve login timeout (#42)" --yes

# Push and create in one step
glab mr create --fill --push --yes

# Create targeting a specific branch
glab mr create --fill --target-branch develop --yes
```

## list

List merge requests with extensive filtering.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--state` | Filter by state (opened/closed/merged/all) | `opened` |
| `--assignee` | Filter by assignee | `@me` |
| `--author` | Filter by author | `alice` |
| `--reviewer` | Filter by reviewer | `bob` |
| `--label` | Filter by label (repeatable) | `--label bug` |
| `--not-label` | Exclude labels | `--not-label wontfix` |
| `--milestone` | Filter by milestone | `"v2.0"` |
| `--source-branch` | Filter by source branch | `feature/auth` |
| `--target-branch` | Filter by target branch | `main` |
| `--draft` | Show only draft MRs | — |
| `--not-draft` | Exclude draft MRs | — |
| `--search` | Search in title and description | `"OAuth"` |
| `--output` | Output format (text/json) | `json` |
| `--per-page` | Results per page | `50` |
| `--group` | List MRs across a group | `my-team` |

### Examples

```bash
# Your open MRs
glab mr list --assignee=@me

# MRs needing your review
glab mr list --reviewer=@me

# Search for MRs by keyword
glab mr list --search "database migration" --state opened

# MRs with specific label, JSON output
glab mr list --label "needs-review" --output json

# All merged MRs targeting main
glab mr list --state merged --target-branch main --per-page 20

# MRs across a group
glab mr list --group my-team --state opened
```

## view

Display detailed information about a merge request.

```bash
# View by MR number
glab mr view 42

# View with comments
glab mr view 42 --comments

# JSON output for parsing
glab mr view 42 --output json

# Open in browser
glab mr view 42 --web
```

## checkout

Check out a merge request branch locally for review or testing.

```bash
# Checkout by MR number
glab mr checkout 42

# Checkout to a custom branch name
glab mr checkout 42 --branch review-auth

# Set upstream tracking
glab mr checkout 42 --set-upstream-to
```

## diff

View the file changes in a merge request.

```bash
# View colored diff
glab mr diff 42

# Raw diff (for piping)
glab mr diff 42 --raw
```

## approve / revoke

Manage MR approvals.

```bash
# Approve an MR
glab mr approve 42

# Withdraw approval
glab mr revoke 42

# View approval rules and status
glab mr approvers 42
```

## merge

Merge an approved MR.

### Key Flags

| Flag | Description |
|------|-------------|
| `--squash` | Squash commits into one |
| `--remove-source-branch` | Delete source branch after merge |
| `--message` | Custom merge commit message |
| `--squash-message` | Custom squash commit message |
| `--rebase` | Rebase before merging |
| `--auto-merge` | Merge when pipeline succeeds |
| `--sha` | Require HEAD to match this SHA |
| `--yes` | Skip confirmation |

### Examples

```bash
# Simple merge
glab mr merge 42 --yes

# Squash merge with source branch cleanup
glab mr merge 42 --squash --remove-source-branch --yes

# Auto-merge when pipeline passes
glab mr merge 42 --auto-merge --squash --remove-source-branch

# Merge with custom commit message
glab mr merge 42 --message "Merge feature/auth into main" --yes
```

## update

Modify properties of an existing MR.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--title` | Update title | `"Updated title"` |
| `--description` | Update description | `"New description"` |
| `--label` | Add labels | `--label review` |
| `--unlabel` | Remove labels | `--unlabel draft` |
| `--assignee` | Set assignees | `--assignee alice` |
| `--unassign` | Remove assignees | `--unassign bob` |
| `--reviewer` | Set reviewers | `--reviewer carol` |
| `--milestone` | Set milestone | `"v2.0"` |
| `--draft` | Convert to draft | — |
| `--ready` | Mark as ready (remove draft) | — |
| `--target-branch` | Change target branch | `develop` |
| `--lock-discussion` | Lock discussion | — |
| `--unlock-discussion` | Unlock discussion | — |

### Examples

```bash
# Mark MR as ready for review
glab mr update 42 --ready --reviewer alice --reviewer bob

# Add labels
glab mr update 42 --label "reviewed" --label "ready-to-merge"

# Change target branch
glab mr update 42 --target-branch release/2.0
```

## note

Add a comment to a merge request.

```bash
# Add inline comment
glab mr note 42 -m "LGTM, approved after reviewing auth changes"

# Opens editor if -m is omitted
glab mr note 42
```

## rebase

Rebase MR branch onto the target branch (server-side).

```bash
glab mr rebase 42
```

## close / reopen / delete

```bash
glab mr close 42       # Close without merging
glab mr reopen 42      # Reopen a closed MR
glab mr delete 42      # Permanently delete an MR
```

## Other Subcommands

```bash
glab mr subscribe 42     # Subscribe to notifications
glab mr unsubscribe 42   # Unsubscribe
glab mr todo 42           # Add to your to-do list
glab mr issues 42         # View related issues
```

## Common Workflows

### Create and Submit MR

```bash
# 1. Push your branch
git push -u origin feature/auth

# 2. Create MR with auto-fill and reviewer
glab mr create --fill --reviewer alice --label "auth" --yes

# 3. (After CI passes) Check status
glab ci status
```

### Review an MR

```bash
# 1. Check out the MR branch
glab mr checkout 42

# 2. View the diff
glab mr diff 42

# 3. Run tests locally, then approve or comment
glab mr approve 42
# or
glab mr note 42 -m "Please fix the error handling in auth.go:45"
```

### Merge After Review

```bash
# 1. Verify approval status
glab mr approvers 42

# 2. Rebase if needed
glab mr rebase 42

# 3. Squash merge and clean up
glab mr merge 42 --squash --remove-source-branch --yes
```

## Tips

- `--fill` uses the first commit's subject as the MR title and remaining commit messages as the description. Use `--fill-commit-body` to include full commit bodies.
- `--auto-merge` sets the MR to merge automatically when the pipeline succeeds — useful for MRs that are approved but waiting on CI.
- Use `--draft` during development; switch to ready with `glab mr update <id> --ready` when you're done.
- `--push` on `mr create` pushes the current branch before creating the MR, combining two steps into one.
- MR numbers are project-scoped (IID), not global (ID). Use the number shown in the GitLab UI.
