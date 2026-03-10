# Tokens & Keys — glab token / glab deploy-key / glab ssh-key / glab gpg-key

Manage access tokens, deploy keys, SSH keys, and GPG keys for GitLab projects and users.

---

## Tokens — glab token

Manage personal, project, and group access tokens.

### Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `create` | Create a new access token |
| `list` | List access tokens |
| `revoke` | Revoke an access token |
| `rotate` | Rotate an access token |

### create

Create a new access token. Name is a positional argument.

**Syntax:** `glab token create <name> [flags]`

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--scope` | Token scopes (repeatable or comma-separated) | `--scope api --scope read_registry` |
| `--access-level` | Access level (guest/reporter/developer/maintainer/owner) | `developer` |
| `--duration` | Token duration (days: 30d, weeks: 4w, hours: 24h) | `"90d"` |
| `--expires-at` | Exact expiry date (YYYY-MM-DD) | `"2026-12-31"` |
| `--description` | Token description | `"CI deploy token"` |
| `--group` | Create group access token | `my-team` |
| `--user` | Create user token (@me for self, admin for others) | `@me` |
| `--output` | Output format (text/json) | `json` |

#### Token Scopes

| Scope | Description |
|-------|-------------|
| `api` | Full API access |
| `read_api` | Read-only API access |
| `read_repository` | Read repository contents |
| `write_repository` | Write to repository |
| `read_registry` | Read container registry |
| `write_registry` | Write to container registry |
| `create_runner` | Create CI runners |
| `k8s_proxy` | Kubernetes API proxy |

#### Examples

```bash
# Create a project access token with API scope
glab token create ci-deploy --scope api --access-level developer --duration "90d"

# Create token with multiple scopes
glab token create registry-bot \
  --scope read_registry --scope write_registry \
  --access-level developer --expires-at "2026-12-31"

# Create a group access token
glab token create group-ci --scope api \
  --access-level maintainer --group my-team --duration "60d"

# Create token with read-only API access
glab token create monitoring --scope read_api \
  --access-level reporter --duration "365d"
```

### list

```bash
# List project access tokens
glab token list

# List group tokens
glab token list --group my-team

# JSON output
glab token list --output json
```

### revoke

```bash
# Revoke a token by ID
glab token revoke 42

# Revoke a group token
glab token revoke 42 --group my-team
```

### rotate

Rotate a token — generates a new token value while keeping the same configuration.

```bash
# Rotate a project token
glab token rotate 42

# Rotate a group token
glab token rotate 42 --group my-team
```

---

## Deploy Keys — glab deploy-key

Manage SSH deploy keys for repository access.

### Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `add` | Add a deploy key to the project |
| `list` | List deploy keys |
| `get` | Get deploy key details |
| `delete` | Delete a deploy key |

### add

Add a deploy key by providing a key file as a positional argument, or pipe key content via stdin.

**Syntax:** `glab deploy-key add [key-file] [flags]`

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--title` | Key title (required) | `"CI deploy key"` |
| `--can-push` | Allow push access | — |
| `--expires-at` | Expiration date (ISO 8601: YYYY-MM-DDTHH:MM:SSZ) | `"2026-12-31T00:00:00Z"` |

#### Examples

```bash
# Add a read-only deploy key from a file
glab deploy-key add ~/.ssh/deploy_key.pub --title "CI read access"

# Add a deploy key with push access
glab deploy-key add ~/.ssh/deploy_key.pub --title "CI deploy" --can-push

# Add a deploy key from stdin
cat ~/.ssh/deploy_key.pub | glab deploy-key add --title "CI deploy" -
```

### list

```bash
# List all deploy keys
glab deploy-key list

# JSON output
glab deploy-key list --output json
```

### get

```bash
# Get details for a deploy key
glab deploy-key get 42
```

### delete

```bash
# Delete a deploy key
glab deploy-key delete 42
```

---

## SSH Keys — glab ssh-key

Manage SSH keys for your GitLab user account.

| Subcommand | Description |
|------------|-------------|
| `add` | Add an SSH key to your account |
| `list` | List your SSH keys |
| `delete` | Delete an SSH key |

**Syntax:** `glab ssh-key add [key-file] [flags]`

| Flag | Description | Example |
|------|-------------|---------|
| `--title` | Key title (required) | `"Work laptop"` |
| `--expires-at` | Expiration date (ISO 8601: YYYY-MM-DDTHH:MM:SSZ) | `"2026-12-31T00:00:00Z"` |
| `--usage-type` | Usage scope (auth/signing/auth_and_signing) | `auth_and_signing` |

```bash
# Add an SSH key from file
glab ssh-key add ~/.ssh/id_ed25519.pub --title "Work laptop"

# Add with expiration and usage type
glab ssh-key add ~/.ssh/id_ed25519.pub --title "Deploy key" \
  --expires-at "2026-12-31T00:00:00Z" --usage-type signing

# List SSH keys
glab ssh-key list

# Delete an SSH key
glab ssh-key delete 42
```

---

## GPG Keys — glab gpg-key

Manage GPG keys for commit signature verification.

| Subcommand | Description |
|------------|-------------|
| `add` | Add a GPG key to your account |
| `list` | List your GPG keys |
| `delete` | Delete a GPG key |

```bash
# Add a GPG key
gpg --armor --export your@email.com | glab gpg-key add

# List GPG keys
glab gpg-key list

# Delete a GPG key
glab gpg-key delete 42
```

---

## Common Workflows

### Set Up CI/CD Deploy Key

```bash
# 1. Generate a dedicated deploy key
ssh-keygen -t ed25519 -f deploy_key -N "" -C "ci-deploy"

# 2. Add the public key to the project
glab deploy-key add deploy_key.pub --title "CI deploy" --can-push

# 3. Store the private key as a CI variable (file type)
glab variable set DEPLOY_SSH_KEY --value "$(cat deploy_key)" --type file --masked

# 4. Verify
glab deploy-key list
```

### Rotate Project Access Token

```bash
# 1. List current tokens
glab token list

# 2. Rotate the token (returns new value)
glab token rotate 42

# 3. Update CI variable with the new token
glab variable update DEPLOY_TOKEN --value "$NEW_TOKEN"
```

### Manage Team Access Tokens

```bash
# 1. Create a group token for CI/CD
glab token create group-ci --scope api \
  --access-level maintainer --group my-team --duration "90d"

# 2. List group tokens
glab token list --group my-team

# 3. Revoke old tokens
glab token revoke 15 --group my-team
```

## Tips

- **Token expiry**: GitLab enforces maximum token lifetimes. If `--duration` exceeds the instance limit, the token will be created with the maximum allowed duration.
- **Deploy key sharing**: The same deploy key can be added to multiple projects. It provides repository-level access without requiring a user account.
- **Push access**: Deploy keys default to read-only. Use `--can-push` only when the key needs write access (e.g., automated deployments that push tags).
- **Token rotation**: `glab token rotate` invalidates the old token immediately and returns a new value. Update any CI variables or integrations that use the token.
- **Scope minimization**: Always use the minimum scopes needed. Prefer `read_api` over `api` for monitoring or read-only integrations.
