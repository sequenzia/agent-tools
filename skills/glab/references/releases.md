# Releases — glab release

Create, manage, and download GitLab releases and their assets.

## Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `create` | Create a new release (or update existing) |
| `list` | List releases |
| `view` | View release details |
| `download` | Download release assets |
| `upload` | Upload assets to a release |
| `delete` | Delete a release |

## create

Create a release for a tag. Optionally upload assets directly.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--name` | Release title | `"Version 2.0"` |
| `--notes` | Release notes (inline) | `"Bug fixes and improvements"` |
| `--notes-file` | Release notes from file | `CHANGELOG.md` |
| `--ref` | Git ref to tag (branch, SHA) | `main` |
| `--tag-message` | Annotated tag message | `"Release v2.0.0"` |
| `--milestone` | Link milestone (repeatable) | `--milestone "v2.0"` |
| `--released-at` | Custom release date (ISO 8601) | `"2025-06-15T10:00:00Z"` |
| `--assets-links` | JSON array of asset links | see below |
| `--no-update` | Fail if release already exists | — |
| `--no-close-milestone` | Don't close linked milestones | — |

### Examples

```bash
# Simple release with inline notes
glab release create v2.0.0 --notes "Initial stable release"

# Release with notes from changelog
glab release create v2.0.0 --notes-file CHANGELOG.md --name "Version 2.0"

# Release with file assets (positional args after tag)
glab release create v2.0.0 ./dist/app-linux.tar.gz ./dist/app-darwin.tar.gz \
  --notes-file CHANGELOG.md

# Release linked to a milestone
glab release create v2.0.0 --notes-file CHANGELOG.md \
  --milestone "v2.0" --name "Version 2.0"

# Release from a specific ref
glab release create v2.0.0 --ref main --notes "Release from main"

# Release with external asset links
glab release create v2.0.0 --notes "See assets" \
  --assets-links '[{"name":"Docker Image","url":"https://registry.example.com/app:2.0","link_type":"image"}]'

# Create annotated tag with the release
glab release create v2.0.0 --tag-message "Release v2.0.0" --notes-file CHANGELOG.md
```

## list

List releases for the project.

```bash
# List releases
glab release list

# JSON output
glab release list --output json
```

## view

View details of a specific release.

```bash
# View latest release
glab release view

# View specific release
glab release view v2.0.0

# JSON output
glab release view v2.0.0 --output json
```

## download

Download assets attached to a release.

```bash
# Download all assets from a release
glab release download v2.0.0

# Download to a specific directory
glab release download v2.0.0 --dir ./downloads

# Download specific asset by name
glab release download v2.0.0 --asset-name "app-linux.tar.gz"
```

## upload

Upload additional assets to an existing release.

```bash
# Upload files to a release
glab release upload v2.0.0 ./dist/app-linux.tar.gz ./dist/app-darwin.tar.gz
```

## delete

Delete a release (does not delete the git tag).

```bash
glab release delete v2.0.0
```

## Common Workflows

### Create Release with Assets and Changelog

```bash
# 1. Ensure your tag exists or will be created
git tag -a v2.0.0 -m "Release v2.0.0"
git push origin v2.0.0

# 2. Build artifacts
make build-all

# 3. Create release with files and changelog
glab release create v2.0.0 ./dist/*.tar.gz \
  --name "Version 2.0.0" \
  --notes-file CHANGELOG.md \
  --milestone "v2.0"
```

### Release from CI Pipeline

```bash
# In .gitlab-ci.yml release job:
glab release create "$CI_COMMIT_TAG" ./build/artifacts/* \
  --notes-file CHANGELOG.md
```

## Tips

- File assets are passed as positional arguments after the tag name: `glab release create v1.0 file1 file2`.
- If the tag doesn't exist yet, glab creates a lightweight tag. Use `--tag-message` for an annotated tag, or `--ref` to specify which commit to tag.
- `--assets-links` accepts a JSON array for linking external assets (Docker images, package registries, etc.). Each object needs `name`, `url`, and optionally `link_type` (other/runbook/image/package).
- `--milestone` can be repeated to link multiple milestones. Linked milestones are auto-closed unless `--no-close-milestone` is passed.
- `--no-update` prevents overwriting an existing release — useful in CI to avoid accidental overwrites.
