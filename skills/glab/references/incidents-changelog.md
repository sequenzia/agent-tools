# Incidents & Changelog — glab incident / glab changelog

Manage production incidents and generate changelogs from the command line.

---

## Incidents — glab incident

Track, manage, and respond to production incidents. Incidents mirror much of the issue interface with incident-specific workflows.

### Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `list` | List incidents |
| `view` | View incident details |
| `close` | Close an incident |
| `reopen` | Reopen a closed incident |
| `note` | Add a comment to an incident |
| `subscribe` | Subscribe to incident notifications |
| `unsubscribe` | Unsubscribe from notifications |

### list

List incidents with filters.

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--state` | Filter by state (opened/closed/all) | `opened` |
| `--assignee` | Filter by assignee | `@me` |
| `--author` | Filter by author | `alice` |
| `--label` | Filter by label (repeatable) | `--label severity::1` |
| `--search` | Search title and description | `"database"` |
| `--order` | Order by (created_at/updated_at) | `updated_at` |
| `--sort` | Sort direction (asc/desc) | `desc` |
| `--output` | Output format (text/json) | `json` |
| `--per-page` | Results per page | `50` |

#### Examples

```bash
# List all open incidents
glab incident list

# List incidents assigned to you
glab incident list --assignee=@me --state opened

# Search for incidents by keyword
glab incident list --search "database timeout"

# List critical incidents
glab incident list --label "severity::1" --state opened

# JSON output for scripting
glab incident list --output json
```

### view

Display incident details.

```bash
# View by incident number
glab incident view 42

# View with comments/timeline
glab incident view 42 --comments

# JSON output
glab incident view 42 --output json

# Open in browser
glab incident view 42 --web
```

### close

```bash
# Close a resolved incident
glab incident close 42
```

### reopen

```bash
# Reopen an incident
glab incident reopen 42
```

### note

Add a comment or timeline entry to an incident.

```bash
# Add a status update
glab incident note 42 -m "Root cause identified: connection pool exhaustion"

# Opens editor if -m is omitted
glab incident note 42
```

### subscribe / unsubscribe

```bash
# Subscribe to incident updates
glab incident subscribe 42

# Unsubscribe from notifications
glab incident unsubscribe 42
```

---

## Changelog — glab changelog

Generate changelogs from merge request history using GitLab's changelog API.

### generate

Generate a changelog for a version.

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--version` | Version to generate changelog for (required) | `"1.5.0"` |
| `--from` | Start ref (commit SHA or tag) | `v1.4.0` |
| `--to` | End ref (commit SHA or tag) | `v1.5.0` |
| `--date` | Release date (ISO 8601) | `"2026-03-10"` |
| `--config-file` | Path to changelog config in repo | `".gitlab/changelog_config.yml"` |
| `--trailer` | Git trailer to use for categorization | `"Changelog"` |

#### Examples

```bash
# Generate changelog for a version
glab changelog generate --version "1.5.0"

# Generate with explicit range
glab changelog generate --version "1.5.0" --from v1.4.0 --to v1.5.0

# Generate with custom date
glab changelog generate --version "1.5.0" --date "2026-03-10"

# Use custom config file
glab changelog generate --version "1.5.0" \
  --config-file ".gitlab/changelog_config.yml"

# Use git trailers for categorization
glab changelog generate --version "1.5.0" --trailer "Changelog"
```

---

## Common Workflows

### Incident Response

```bash
# 1. Check for open incidents
glab incident list --state opened

# 2. View incident details
glab incident view 42

# 3. Subscribe for updates
glab incident subscribe 42

# 4. Add investigation notes
glab incident note 42 -m "Investigating: CPU spike on worker nodes"

# 5. Post root cause
glab incident note 42 -m "Root cause: memory leak in cache layer. Fix deployed."

# 6. Close the incident
glab incident close 42
```

### Generate Release Changelog

```bash
# 1. Generate changelog from MR history
glab changelog generate --version "2.0.0" --from v1.9.0 --to v2.0.0

# 2. Create the release with the generated changelog
glab release create v2.0.0 --notes "$(glab changelog generate --version '2.0.0')"
```

### Monitor Incident Activity

```bash
# List recently updated incidents
glab incident list --state opened --order updated_at --sort desc

# Export incident data for reporting
glab incident list --state all --output json > incidents-report.json
```

## Tips

- Incidents use the same numbering system as issues (IID) and appear in issue listings with `--issue-type incident`.
- Use `glab issue list --issue-type incident` as an alternative way to find incidents alongside regular issues.
- The `glab changelog generate` command uses GitLab's server-side changelog API, which categorizes entries based on MR labels or git trailers.
- Configure changelog categories in `.gitlab/changelog_config.yml` in your repository to control how MR labels map to changelog sections.
- The `--trailer` flag lets you use git trailers (e.g., `Changelog: added`) in commit messages to categorize changes without relying on labels.
- Incident severity labels (e.g., `severity::1` through `severity::4`) follow GitLab's built-in severity scheme and integrate with incident management features.
