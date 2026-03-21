---
name: glab
description: >-
  Interact with GitLab through the glab CLI tool. Covers merge requests, issues,
  CI/CD pipelines, runners, pipeline schedules, repositories, releases, API
  requests, variables, labels, milestones, snippets, access tokens, deploy keys,
  incidents, and changelogs. Use when the user needs to create or manage merge
  requests, check CI pipeline status, manage runners or schedules, manage GitLab
  issues or incidents, create releases, generate changelogs, manage access tokens
  or deploy keys, query the GitLab API, or perform any GitLab operation from the
  command line. Trigger on mentions of glab, GitLab CLI, merge requests, MR
  workflows, CI pipelines, runners, pipeline schedules, access tokens, deploy
  keys, incidents, GitLab issues, or GitLab API.
metadata:
  type: reference
---

# glab CLI Reference

glab is GitLab's official command-line tool for working with merge requests, issues, CI/CD pipelines, repositories, releases, and more. It works with both gitlab.com and self-managed GitLab instances. This skill provides practical guidance for constructing correct glab commands.

## Prerequisites

Before running glab commands, verify the tool is available and authenticated:

```bash
# Check installation
glab version

# Check authentication status
glab auth status
```

If glab is not authenticated, read [references/auth-config.md](references/auth-config.md) for setup instructions.

## Quick Patterns

These cover the most common operations. For simple tasks matching these patterns, execute directly without loading reference files.

### Merge Requests

```bash
glab mr create --fill --yes                    # Create MR from current branch, auto-fill title/description
glab mr create --draft --fill --yes            # Create draft MR
glab mr list --assignee=@me                    # List your open MRs
glab mr view 42                                # View MR details
glab mr checkout 42                            # Check out MR branch locally
glab mr merge 42 --squash --remove-source-branch --yes  # Squash merge
```

### Issues

```bash
glab issue create --title "Bug: ..." --label bug --assignee @me  # Create issue
glab issue list --assignee=@me                 # List your issues
glab issue view 15                             # View issue details
glab issue close 15                            # Close an issue
```

### CI/CD

```bash
glab ci status                                 # Current pipeline status
glab ci view                                   # Interactive pipeline viewer
glab ci lint                                   # Validate .gitlab-ci.yml
glab ci trace                                  # Stream job logs in real-time
glab ci run -b main                            # Trigger a pipeline on main
```

### Repository & API

```bash
glab repo clone namespace/project              # Clone a repo
glab repo view                                 # View current project info
glab api projects/:id/merge_requests           # REST API call
```

### Runners & Schedules

```bash
glab runner list                               # List project runners
glab schedule create --cron "0 2 * * *" --description "Nightly" --ref main   # Create schedule
glab schedule run 42                           # Trigger schedule now
glab job artifact main build                    # Download job artifacts
```

### Tokens & Keys

```bash
glab token create ci --scope api --duration "90d"            # Create access token
glab token list                                # List project tokens
glab deploy-key add key.pub --title "CI"                     # Add deploy key
glab deploy-key list                           # List deploy keys
```

## Cross-Cutting Patterns

These patterns apply across all glab command groups.

### Machine-Readable Output

Many `list` and `view` commands support `--output json` for structured output that can be parsed programmatically:

```bash
glab mr list --output json
glab issue list --output json
```

When piping glab output to other commands, use JSON output and parse with `jq`:

```bash
glab mr list --output json | jq '.[].iid'
```

### Targeting a Different Repository

Use `-R` (or `--repo`) to run commands against a repo other than the current directory's:

```bash
glab mr list -R gitlab-org/cli
glab issue view 42 -R team/backend-service
```

Accepts formats: `OWNER/REPO`, `GROUP/NAMESPACE/REPO`, or a full GitLab URL.

### Suppressing Interactive Prompts

For non-interactive (scripted or automated) usage:

```bash
glab mr create --fill --yes                    # --yes skips confirmation prompts
NO_PROMPT=1 glab mr merge 42                   # Environment variable alternative
```

### Error Handling

- Check exit codes: glab returns non-zero on failure
- Auth errors: re-run `glab auth status` to verify credentials
- 404 errors: verify the project path with `glab repo view` or check `-R` value
- Rate limiting: the API may throttle requests; back off and retry

### Command Aliases

Some commands have aliases for convenience:

| Command | Aliases |
|---------|---------|
| `glab ci` | `glab pipe`, `glab pipeline` |
| `glab config` | `glab conf` |
| `glab mr create` | `glab mr new` |
| `glab mr merge` | `glab mr accept` |
| `glab mr view` | `glab mr show` |
| `glab issue create` | `glab issue new` |
| `glab issue list` | `glab issue ls` |
| `glab mr list` | `glab mr ls` |
| `glab repo` | `glab project` |
| `glab runner list` | `glab runner ls` |
| `glab schedule list` | `glab schedule ls` |
| `glab incident list` | `glab incident ls` |

## Command Reference Index

Load the relevant reference file when a task requires flags, workflows, or subcommands not shown in Quick Patterns above.

| Task | Reference File | Key Commands |
|------|---------------|--------------|
| Authentication, configuration, environment variables | [references/auth-config.md](references/auth-config.md) | `auth login`, `config set`, `GITLAB_TOKEN` |
| Merge requests (create, review, merge) | [references/merge-requests.md](references/merge-requests.md) | `mr create`, `mr list`, `mr approve`, `mr merge`, `mr checkout` |
| Issues (create, triage, track) | [references/issues.md](references/issues.md) | `issue create`, `issue list`, `issue close`, `issue board` |
| CI/CD pipelines and jobs | [references/ci-cd.md](references/ci-cd.md) | `ci status`, `ci view`, `ci trace`, `ci run`, `ci lint` |
| Repository management | [references/repositories.md](references/repositories.md) | `repo clone`, `repo fork`, `repo create`, `repo view` |
| Release management | [references/releases.md](references/releases.md) | `release create`, `release download`, `release upload` |
| GitLab API (REST and GraphQL) | [references/api.md](references/api.md) | `api` with REST paths or GraphQL queries |
| Variables, labels, milestones, snippets | [references/project-management.md](references/project-management.md) | `variable set`, `label create`, `milestone create`, `snippet create` |
| Runners, schedules, job artifacts | [references/runners-schedules.md](references/runners-schedules.md) | `runner list`, `schedule create`, `job artifact` |
| Access tokens, deploy keys, SSH/GPG keys | [references/tokens-keys.md](references/tokens-keys.md) | `token create`, `token rotate`, `deploy-key add` |
| Incidents, changelog generation | [references/incidents-changelog.md](references/incidents-changelog.md) | `incident list`, `incident close`, `changelog generate` |

## Additional Commands

These commands have smaller surface areas or are experimental. They are not covered in dedicated reference files.

| Command | Status | Description |
|---------|--------|-------------|
| `glab duo` | Stable | GitLab Duo AI features (ask, chat) |
| `glab alias` | Stable | Create command shortcuts |
| `glab user` | Stable | View user profiles and activity |
| `glab ssh-key` | Stable | Manage account SSH keys (see tokens-keys.md) |
| `glab gpg-key` | Stable | Manage account GPG keys (see tokens-keys.md) |
| `glab completion` | Stable | Generate shell completion scripts (bash/zsh/fish/powershell) |
| `glab check-update` | Stable | Check for glab updates |
| `glab cluster` | Stable | Manage Kubernetes cluster integrations |
| `glab securefile` | Stable | Manage CI/CD secure files |
| `glab iteration` | Stable | Manage group iterations |
| `glab work-items` | Stable | Manage work items |
| `glab mcp` | Stable | Model Context Protocol server for GitLab |
| `glab opentofu` | Stable | OpenTofu state management |
| `glab stack` | Experimental | Manage stacked diffs |
| `glab attestation` | Experimental | Verify artifact attestations |
| `glab runner-controller` | Experimental | Self-hosted runner controller management |

## When to Load References

- **Simple tasks**: If the command matches a Quick Pattern above, execute directly.
- **Complex tasks**: Load the relevant reference file when the task involves flags, multi-step workflows, or subcommands not listed above.
- **Auth issues**: Load `references/auth-config.md` if `glab auth status` shows no authenticated host or if commands fail with 401/403 errors.
- **Infrastructure tasks**: Load `references/runners-schedules.md` for runner management, pipeline schedules, or job artifact downloads.
- **Security & credentials**: Load `references/tokens-keys.md` for access token management, deploy keys, or SSH/GPG key operations.
- **Incident response**: Load `references/incidents-changelog.md` for incident management or changelog generation.
- **Multiple areas**: Load only the reference files needed — avoid loading all references at once.
