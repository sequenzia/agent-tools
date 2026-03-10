# Repositories — glab repo

Clone, create, fork, and manage GitLab repositories and project settings from the command line.

## Subcommand Overview

| Subcommand | Alias | Description |
|------------|-------|-------------|
| `clone` | — | Clone a repository |
| `create` | — | Create a new project |
| `fork` | — | Fork a repository |
| `view` | — | View project details |
| `list` | — | List repositories |
| `search` | — | Search for repositories |
| `members` | — | View project members |
| `contributors` | — | View contributors |
| `archive` | — | Archive a repository |
| `delete` | — | Delete a repository |
| `transfer` | — | Transfer project ownership |
| `update` | — | Update project settings |
| `mirror` | — | Manage repository mirroring |
| `publish` | — | Publish project to GitLab |

## clone

Clone a repository by name, ID, or URL. Also supports batch cloning all repos in a group.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--group` | Clone all repos in a group | `my-team` |
| `--preserve-namespace` | Mirror group structure in directories | — |
| `--include-subgroups` | Include subgroup repos | — |
| `--mine` | Only repos you own (with `--group`) | — |
| `--active` | Only active repos (with `--group`) | — |
| `--archived` | Include archived repos (with `--group`) | — |
| `--visibility` | Filter by visibility (public/internal/private) | `private` |
| `--with-issues-enabled` | Only repos with issues enabled | — |
| `--with-mr-enabled` | Only repos with MRs enabled | — |
| `--paginate` | Clone all pages of results | — |

### Examples

```bash
# Clone by namespace/name
glab repo clone gitlab-org/cli

# Clone by project ID
glab repo clone 278964

# Clone by URL
glab repo clone https://gitlab.com/gitlab-org/cli.git

# Clone all repos in a group
glab repo clone -g my-team --paginate

# Clone group repos, preserving namespace structure
glab repo clone -g my-team --preserve-namespace --paginate

# Clone only your repos in a group
glab repo clone -g my-team --mine --paginate

# Clone active private repos in a group
glab repo clone -g my-team --active --visibility private --paginate
```

## create

Create a new project on GitLab.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--name` | Project name | `"my-project"` |
| `--description` | Project description | `"A new service"` |
| `--group` | Create in a group (namespace) | `my-team` |
| `--private` | Set visibility to private | — |
| `--public` | Set visibility to public | — |
| `--internal` | Set visibility to internal | — |
| `--readme` | Initialize with README | — |
| `--defaultBranch` | Default branch name | `main` |
| `--remoteName` | Name for git remote | `origin` |
| `--tag` | Add tags (repeatable) | `--tag go` |
| `--skipGitInit` | Don't initialize git locally | — |

### Examples

```bash
# Create private project with README
glab repo create my-service --private --readme --description "Backend API service"

# Create in a group namespace
glab repo create api-gateway --group backend-team --private --readme

# Create public project
glab repo create my-library --public --description "Shared utility library"

# Create without local git init
glab repo create infra-config --private --skipGitInit
```

## fork

Fork a repository to your namespace or a group.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--clone` | Clone the fork after creating | — |
| `--name` | Custom name for the fork | `"my-fork"` |
| `--path` | Custom path for the fork | `"custom-path"` |
| `--remote` | Add fork as a remote to existing clone | — |

### Examples

```bash
# Fork a project
glab repo fork gitlab-org/cli

# Fork and clone immediately
glab repo fork gitlab-org/cli --clone

# Fork with custom name
glab repo fork gitlab-org/cli --name "cli-custom"
```

## view

View project details for the current repo or a specified project.

```bash
# View current project
glab repo view

# View a specific project
glab repo view gitlab-org/cli

# Open in browser
glab repo view --web

# JSON output
glab repo view --output json
```

## list

List repositories you have access to.

```bash
# List your repos
glab repo list

# List repos in a group
glab repo list --group my-team

# JSON output
glab repo list --output json

# Only repos you own
glab repo list --mine
```

## search

Search for repositories.

```bash
# Search by name
glab repo search --search "api-gateway"

# Search with filters
glab repo search --search "frontend" --visibility public
```

## members / contributors

```bash
# View project members and their access levels
glab repo members

# View contributors (by commit count)
glab repo contributors
```

## archive / delete / transfer

```bash
# Archive a project (read-only)
glab repo archive

# Delete a project (requires confirmation)
glab repo delete my-team/old-project

# Transfer ownership
glab repo transfer my-team/project --target-namespace other-team
```

## update

Update project settings.

```bash
# Update project description
glab repo update --description "Updated description"

# Change visibility
glab repo update --visibility private

# Update default branch
glab repo update --default-branch main
```

## mirror

Manage repository mirroring.

```bash
# List mirrors
glab repo mirror list

# Set up a mirror
glab repo mirror create --url https://github.com/org/repo.git --direction push
```

## Common Workflows

### Fork and Contribute

```bash
# 1. Fork the project and clone
glab repo fork upstream-team/project --clone
cd project

# 2. Create a feature branch
git checkout -b feature/improvement

# 3. Make changes and push
git add . && git commit -m "feat: add improvement"
git push -u origin feature/improvement

# 4. Create MR back to upstream
glab mr create --fill --yes
```

### Set Up a New Project

```bash
# 1. Create the project
glab repo create my-service --private --readme --group backend-team

# 2. Configure default branch protection (via API)
glab api projects/:id/protected_branches -X POST \
  -f name=main -f push_access_level=30

# 3. Set up CI variables
glab variable set DEPLOY_TOKEN --value "$TOKEN" --masked
```

### Batch Clone a Team's Repos

```bash
# Clone all active repos in a group, preserving directory structure
glab repo clone -g backend-team --preserve-namespace --active --paginate

# Clone only repos with MRs enabled
glab repo clone -g backend-team --with-mr-enabled --paginate
```

## Tips

- `glab repo clone -g` batch cloning is useful for onboarding — clone an entire team's repos at once.
- `--preserve-namespace` creates subdirectories matching the group/subgroup structure, which helps when a group has many subgroups.
- `--paginate` is needed for groups with more repos than fit in one API page (default 20). Always use it for batch cloning.
- The `glab repo` command can also be invoked as `glab project`.
- For project settings not exposed through `glab repo update`, use `glab api` to call the Projects API directly.
