# Generic Tool Installer

Cross-platform installer scripts for downloading and installing pre-built binaries from GitLab, GitHub, or any hosting platform that follows a predictable URL pattern.

## Scripts

| Script | Platform | Shell | Requirements |
|--------|----------|-------|--------------|
| `install-tool.sh` | Linux, macOS | Bash | `curl` or `wget`; `jq` or `python3` for version detection |
| `install-tool.ps1` | Windows | PowerShell 5.1+ | — |
| `install-tool.cmd` | Windows | CMD (batch) | Windows 10+ (`curl.exe`, `tar`) |

## Quick Start

### Linux / macOS

```bash
# Remote (pipe to bash)
curl -fsSL https://example.com/install-tool.sh | TOOL_NAME=mytool TOOL_BASE_URL=https://gitlab.com/myorg/mytool bash

# Local
bash install-tool.sh --name mytool --base-url https://gitlab.com/myorg/mytool
```

### Windows (PowerShell)

```powershell
# Remote (pipe to iex)
$env:TOOL_NAME = "mytool"; $env:TOOL_BASE_URL = "https://gitlab.com/myorg/mytool"; irm https://example.com/install-tool.ps1 | iex

# Local
.\install-tool.ps1 -Name "mytool" -BaseUrl "https://gitlab.com/myorg/mytool"
```

### Windows (CMD)

```cmd
:: Remote (download and run)
curl -fsSL https://example.com/install-tool.cmd -o install-tool.cmd && set TOOL_NAME=mytool && set TOOL_BASE_URL=https://gitlab.com/myorg/mytool && install-tool.cmd && del install-tool.cmd

:: Local
install-tool.cmd --name mytool --base-url https://gitlab.com/myorg/mytool
```

## Parameters

All parameters can be set via **CLI flags**, **environment variables**, or **PowerShell parameters** (`.ps1` only). CLI flags take precedence over environment variables.

### Required

| Env Var | CLI Flag | PS Param | Description |
|---------|----------|----------|-------------|
| `TOOL_NAME` | `--name` | `-Name` | Binary name (e.g., `glab`, `myctl`). Must contain only `[a-zA-Z0-9._-]` |
| `TOOL_BASE_URL` | `--base-url` | `-BaseUrl` | Project URL (e.g., `https://gitlab.com/gitlab-org/cli`) |

### Optional

| Env Var | CLI Flag | PS Param | Default | Description |
|---------|----------|----------|---------|-------------|
| `TOOL_VERSION` | `--version` | `-Version` | Auto-detect latest | Pin a specific version (with or without `v` prefix) |
| `TOOL_INSTALL_DIR` | `--install-dir` | `-InstallDir` | `~/.local/bin` (Unix) or `%USERPROFILE%\.local\bin` (Windows) | Installation directory |
| `TOOL_DOWNLOAD_URL` | `--download-url` | `-DownloadUrl` | GitLab pattern | Download URL template (see [URL Templates](#url-template-system)) |
| `TOOL_API_URL` | `--api-url` | `-ApiUrl` | Derived from base URL (GitLab API v4) | Full API URL for version detection |
| `TOOL_VERSION_JSONPATH` | `--version-jsonpath` | `-VersionJsonPath` | Auto-detect | jq-style expression for extracting version from API response |
| `TOOL_NONINTERACTIVE` | — | — | — | Set to any value to suppress interactive prompts (Windows only) |

## URL Template System

The download URL can be customized using a template with placeholders. This enables support for any hosting platform.

### Placeholders

| Placeholder | Value |
|-------------|-------|
| `{base_url}` | Value of `TOOL_BASE_URL` |
| `{version}` | Resolved version number (without `v` prefix) |
| `{name}` | Value of `TOOL_NAME` |
| `{os}` | Detected OS: `linux`, `darwin`, or `windows` |
| `{arch}` | Detected architecture: `amd64` or `arm64` |
| `{ext}` | Archive extension: `tar.gz` (Unix) or `zip` (Windows) |

### Default Pattern (GitLab)

```
{base_url}/-/releases/v{version}/downloads/{name}_{version}_{os}_{arch}.{ext}
```

This resolves to URLs like:
```
https://gitlab.com/gitlab-org/cli/-/releases/v1.46.0/downloads/glab_1.46.0_linux_amd64.tar.gz
```

### GitHub Pattern

```
{base_url}/releases/download/v{version}/{name}_{version}_{os}_{arch}.{ext}
```

This resolves to URLs like:
```
https://github.com/myorg/mytool/releases/download/v1.0.0/mytool_1.0.0_linux_amd64.tar.gz
```

## Version Detection

### Default Behavior

When `TOOL_VERSION` is not set, the scripts auto-detect the latest version:

1. **API URL derivation**: Constructs a GitLab API v4 URL from `TOOL_BASE_URL`:
   ```
   https://{host}/api/v4/projects/{url-encoded-path}/releases?per_page=1
   ```
2. **Response parsing**: Extracts `tag_name` from the JSON response, auto-detecting whether the response is an array (GitLab: `[{"tag_name":"v1.0.0"}]`) or an object (GitHub: `{"tag_name":"v1.0.0"}`).

### Custom API URL

For non-GitLab platforms, set `TOOL_API_URL` to the full API endpoint:

```bash
# GitHub
--api-url 'https://api.github.com/repos/myorg/mytool/releases/latest'

# Custom registry
--api-url 'https://releases.example.com/api/mytool/latest'
```

### Custom JSONPath

Set `TOOL_VERSION_JSONPATH` to a jq-style expression if the API response uses a different field name or structure:

```bash
# GitHub (object with tag_name)
--version-jsonpath '.tag_name'

# GitLab (array with tag_name)
--version-jsonpath '.[0].tag_name'

# Custom field
--version-jsonpath '.latest_release.version'
```

### Parser Requirements (Bash)

The bash script tries multiple JSON parsers in order:

| Parser | Custom JSONPath | Default (tag_name) |
|--------|----------------|-------------------|
| `jq` | Full support | Full support |
| `python3` | Simple path expressions | Full support |
| `grep` | Not supported (errors with guidance) | Basic support |

For the most reliable experience, install `jq`.

## Examples

### Install glab from GitLab

```bash
# Latest version
bash install-tool.sh --name glab --base-url https://gitlab.com/gitlab-org/cli

# Pinned version
bash install-tool.sh --name glab --base-url https://gitlab.com/gitlab-org/cli --version 1.46.0

# Via environment variables (useful for piped remote execution)
curl -fsSL https://example.com/install-tool.sh | \
  TOOL_NAME=glab TOOL_BASE_URL=https://gitlab.com/gitlab-org/cli TOOL_VERSION=1.46.0 bash
```

### Install a Tool from GitHub

```bash
bash install-tool.sh \
  --name mytool \
  --base-url https://github.com/myorg/mytool \
  --download-url '{base_url}/releases/download/v{version}/{name}_{version}_{os}_{arch}.{ext}' \
  --api-url 'https://api.github.com/repos/myorg/mytool/releases/latest' \
  --version-jsonpath '.tag_name'
```

PowerShell equivalent:

```powershell
.\install-tool.ps1 `
  -Name "mytool" `
  -BaseUrl "https://github.com/myorg/mytool" `
  -DownloadUrl '{base_url}/releases/download/v{version}/{name}_{version}_{os}_{arch}.{ext}' `
  -ApiUrl 'https://api.github.com/repos/myorg/mytool/releases/latest' `
  -VersionJsonPath '.tag_name'
```

### Install with a Custom Download URL

If the binary hosting doesn't follow standard patterns:

```bash
bash install-tool.sh \
  --name myctl \
  --base-url https://releases.example.com \
  --version 2.1.0 \
  --download-url '{base_url}/binaries/{name}/v{version}/{name}-{os}-{arch}.{ext}'
```

### Install to a Custom Directory

```bash
bash install-tool.sh --name mytool --base-url https://gitlab.com/myorg/mytool \
  --install-dir /usr/local/bin
```

### Remote Execution with Environment Variables

```bash
# All parameters via env vars
export TOOL_NAME=mytool
export TOOL_BASE_URL=https://gitlab.com/myorg/mytool
export TOOL_VERSION=1.2.0
export TOOL_INSTALL_DIR=$HOME/bin
curl -fsSL https://example.com/install-tool.sh | bash
```

## What the Scripts Do

1. **Validate** required parameters (`TOOL_NAME`, `TOOL_BASE_URL`)
2. **Detect** OS (`linux`, `darwin`, `windows`) and architecture (`amd64`, `arm64`)
3. **Warn** if the tool is already installed
4. **Resolve version**: query the API for the latest release, or use the pinned version
5. **Build download URL**: apply the URL template or use the default GitLab pattern
6. **Download** the archive to a temporary directory
7. **Extract** the archive (`tar` on Unix, `Expand-Archive`/`tar` on Windows)
8. **Find the binary** in the extracted contents (checks `bin/`, root, then recursive search)
9. **Install** to `TOOL_INSTALL_DIR` with executable permissions
10. **PATH check**: warn if `TOOL_INSTALL_DIR` is not in PATH (Windows scripts offer to add it)
11. **Verify** by running `{tool} --version`

## Limitations

- **Bash extraction**: Only supports `tar.gz` archives. Custom download URLs that resolve to `.zip` on Unix are not supported.
- **Custom JSONPath with grep**: On systems with neither `jq` nor `python3`, custom `TOOL_VERSION_JSONPATH` is not supported. Install `jq` for full support.
- **TOOL_NAME characters**: Must be alphanumeric with dots, hyphens, and underscores only (`[a-zA-Z0-9._-]`).
- **No checksum verification**: Downloads are not verified against checksums or signatures. Use HTTPS URLs and pinned versions for security-sensitive deployments.
- **CMD piping**: The `.cmd` script cannot be piped like bash/PowerShell scripts. Download it first, then execute.
