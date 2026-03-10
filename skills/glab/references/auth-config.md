# Authentication & Configuration — glab auth / glab config

Set up and manage glab authentication, configuration settings, environment variables, and global flags.

## Authentication — glab auth

### login

Authenticate with a GitLab instance. Supports multiple methods.

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--hostname` | GitLab instance URL | `gitlab.example.com` |
| `--token` | Personal access token | `glpat-xxxxxxxxxxxx` |
| `--stdin` | Read token from stdin | pipe token via `echo` |
| `--job-token` | CI/CD job token | `$CI_JOB_TOKEN` |
| `--use-keyring` | Store token in OS keyring | — |
| `--api-protocol` | API protocol (https/http) | `https` |
| `--git-protocol` | Git protocol (ssh/https) | `ssh` |

#### Examples

```bash
# Interactive OAuth login (recommended for first setup)
glab auth login

# Login to self-managed instance with PAT
glab auth login --hostname gitlab.example.com --token glpat-xxxxxxxxxxxx

# Login via stdin (useful in scripts)
echo "$GITLAB_TOKEN" | glab auth login --hostname gitlab.example.com --stdin

# CI/CD environment login
glab auth login --hostname "$CI_SERVER_HOST" --job-token "$CI_JOB_TOKEN"

# Store credentials in OS keyring
glab auth login --use-keyring
```

### status

Check current authentication state.

```bash
# Show auth status for all hosts
glab auth status

# Show status for specific host
glab auth status --hostname gitlab.example.com

# Show the actual token value
glab auth status --show-token
```

### logout

Remove stored credentials.

```bash
# Logout from default host
glab auth logout

# Logout from specific host
glab auth logout --hostname gitlab.example.com
```

### Other auth subcommands

| Subcommand | Description |
|------------|-------------|
| `configure-docker` | Configure Docker credentials using glab auth |
| `docker-helper` | Act as Docker credential helper |
| `dpop-gen` | Generate DPoP proof tokens |

## Configuration — glab config

Configuration is stored at `~/.config/glab-cli/config.yml`. Settings can be global or per-repository.

### set

```bash
# Set global config
glab config set editor "code --wait" --global

# Set per-repository config (run from within the repo)
glab config set editor vim
```

### get

```bash
# Get a config value
glab config get editor

# Get global value
glab config get editor --global
```

### edit

```bash
# Open config file in editor
glab config edit
```

### Configuration Keys

| Key | Description | Default |
|-----|-------------|---------|
| `browser` | Web browser for `--web` flags | System default / `$BROWSER` |
| `editor` | Text editor for compose operations | `$EDITOR` |
| `visual` | Visual editor (overrides `editor`) | `$VISUAL` |
| `git_protocol` | Preferred git protocol (ssh/https) | `https` |
| `glamour_style` | Markdown rendering style (dark/light/notty) | auto |
| `check_update` | Check for glab updates on start | `true` |
| `display_hyperlinks` | Show clickable links in terminal | `false` |
| `glab_pager` | Custom pager for long output | — |
| `host` | Default GitLab instance URL | `https://gitlab.com` |

## Environment Variables

Environment variables override config file values and stored credentials.

### Authentication

| Variable | Purpose |
|----------|---------|
| `GITLAB_TOKEN` | API access token (highest precedence) |
| `GITLAB_ACCESS_TOKEN` | Alternative token variable |
| `OAUTH_TOKEN` | OAuth token |

**Precedence order:** Environment variable > config file > interactive prompt

### Host & Connection

| Variable | Purpose |
|----------|---------|
| `GITLAB_HOST` | GitLab server URL |
| `GL_HOST` | Alternative host variable |
| `GITLAB_API_HOST` | API host override |

### Behavior

| Variable | Purpose |
|----------|---------|
| `NO_PROMPT` | Set to `1` to disable interactive prompts |
| `NO_COLOR` | Set to `1` to disable colored output |
| `DEBUG` | Set to `1` to enable debug logging |
| `BROWSER` | Override browser for `--web` commands |
| `VISUAL` | Override visual editor |
| `EDITOR` | Override text editor |
| `GLAB_CHECK_UPDATE` | Set to `0` to disable update checks |
| `GLAB_ENABLE_CI_AUTOLOGIN` | Set to `true` for experimental CI auto-login |

## Global Flags

These flags work with any glab command.

| Flag | Description | Example |
|------|-------------|---------|
| `-R, --repo` | Target a different repository | `-R gitlab-org/cli` |
| `-h, --help` | Show help for any command | `glab mr --help` |

The `--repo` flag accepts: `OWNER/REPO`, `GROUP/NAMESPACE/REPO`, full GitLab URL, or Git URL.

## Common Workflows

### First-Time Setup

```bash
# 1. Login interactively
glab auth login

# 2. Set preferred editor
glab config set editor "code --wait" --global

# 3. Set preferred git protocol
glab config set git_protocol ssh --global

# 4. Verify everything works
glab auth status
glab repo view
```

### Multi-Host Setup

```bash
# Login to gitlab.com
glab auth login

# Login to self-managed instance
glab auth login --hostname gitlab.internal.com

# Commands auto-detect host from git remote
# Or specify explicitly:
glab mr list -R gitlab.internal.com/team/project
```

### CI/CD Environment Setup

```bash
# In .gitlab-ci.yml:
# variables:
#   GITLAB_TOKEN: $CI_JOB_TOKEN
#
# Or explicitly:
glab auth login --hostname "$CI_SERVER_HOST" --job-token "$CI_JOB_TOKEN"
```

## Tips

- **Token scopes**: PATs need `api` scope for full access; `read_api` works for read-only operations.
- **CI job token limitations**: Job tokens have limited scope — they can only access the project's own resources and explicitly allowed dependencies.
- **Config file location**: `~/.config/glab-cli/config.yml` on Linux/macOS. Use `glab config edit` to view/modify.
- **Multiple accounts**: glab supports multiple hosts simultaneously. It selects the correct host based on the git remote URL of the current repository.
