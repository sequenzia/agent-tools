# Project Management — Variables, Labels, Milestones, Snippets

Manage CI/CD variables, labels, milestones, and snippets for GitLab projects.

---

## Variables — glab variable

Manage CI/CD variables used in pipelines. Variables can be set at project or group level.

### Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `set` | Create or update a variable |
| `list` | List all variables |
| `get` | Get a specific variable |
| `export` | Export variables (KEY=VALUE format) |
| `update` | Update an existing variable |
| `delete` | Delete a variable |

### set

Create or update a CI/CD variable.

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--value` | Variable value | `"secret123"` |
| `--type` | Variable type (env_var/file) | `file` |
| `--scope` | Environment scope | `production` |
| `--protected` | Only available in protected branches | — |
| `--masked` | Mask value in job logs | — |
| `--raw` | Don't expand variable references | — |
| `--group` | Set at group level | `my-team` |

#### Examples

```bash
# Set a simple variable
glab variable set DEPLOY_URL --value "https://api.example.com"

# Set a masked, protected secret
glab variable set API_SECRET --value "$SECRET" --masked --protected

# Set a file-type variable
glab variable set CONFIG_FILE --value "$(cat config.yml)" --type file

# Set variable scoped to production environment
glab variable set DB_HOST --value "prod-db.internal" --scope production

# Set a group-level variable
glab variable set SHARED_TOKEN --value "$TOKEN" --group my-team --masked
```

### list

```bash
# List all project variables
glab variable list

# List group variables
glab variable list --group my-team

# JSON output
glab variable list --output json
```

### get

```bash
# Get a specific variable
glab variable get DEPLOY_URL

# Get with specific scope
glab variable get DB_HOST --scope production
```

### export

```bash
# Export all variables in KEY=VALUE format (useful for .env files)
glab variable export

# Export to a file
glab variable export > .env.ci
```

### update

```bash
# Update variable value
glab variable update API_SECRET --value "$NEW_SECRET"

# Change variable scope
glab variable update DB_HOST --scope staging --value "staging-db.internal"
```

### delete

```bash
# Delete a variable
glab variable delete OLD_VARIABLE

# Delete scoped variable
glab variable delete DB_HOST --scope production
```

---

## Labels — glab label

Manage project labels for categorizing issues and merge requests.

### Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `create` | Create a new label |
| `list` | List all labels |
| `get` | Get label details |
| `edit` | Edit a label |
| `delete` | Delete a label |

### create

```bash
# Create a label with color
glab label create "priority::high" --color "#FF0000" --description "High priority items"

# Create with hex color
glab label create "type::bug" --color "#D32F2F" --description "Bug reports"

# Create without description
glab label create "good first issue" --color "#7057FF"
```

### list

```bash
# List all labels
glab label list

# JSON output
glab label list --output json
```

### get

```bash
# Get label details
glab label get "priority::high"
```

### edit

```bash
# Rename a label
glab label edit "bug" --name "type::bug"

# Change color
glab label edit "priority::high" --color "#B71C1C"

# Update description
glab label edit "type::bug" --description "Confirmed bug reports"
```

### delete

```bash
glab label delete "old-label"
```

---

## Milestones — glab milestone

Manage project milestones for tracking release schedules and sprint goals.

### Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `create` | Create a new milestone |
| `list` | List milestones |
| `get` | Get milestone details |
| `edit` | Edit a milestone |
| `delete` | Delete a milestone |

### create

```bash
# Create a milestone with due date
glab milestone create --title "v2.0" \
  --description "Version 2.0 release" \
  --due-date "2025-06-30"

# Create with start and due dates
glab milestone create --title "Sprint 5" \
  --start-date "2025-06-01" \
  --due-date "2025-06-14" \
  --description "Auth improvements sprint"
```

### list

```bash
# List active milestones
glab milestone list

# List all milestones (including closed)
glab milestone list --state all

# JSON output
glab milestone list --output json
```

### get

```bash
# Get milestone details
glab milestone get "v2.0"
```

### edit

```bash
# Update due date
glab milestone edit "v2.0" --due-date "2025-07-15"

# Close a milestone
glab milestone edit "v2.0" --state close

# Update description
glab milestone edit "Sprint 5" --description "Extended sprint for auth work"
```

### delete

```bash
glab milestone delete "old-milestone"
```

---

## Snippets — glab snippet

Create code snippets on GitLab.

### create

| Flag | Description | Example |
|------|-------------|---------|
| `--title` | Snippet title | `"Database backup script"` |
| `--filename` | File name for syntax highlighting | `"backup.sh"` |
| `--description` | Snippet description | `"Weekly backup script"` |
| `--visibility` | Visibility (private/internal/public) | `private` |

```bash
# Create snippet from stdin
echo "SELECT * FROM users;" | glab snippet create \
  --title "User query" --filename "query.sql" --visibility private

# Create from a file
cat backup.sh | glab snippet create \
  --title "Backup script" --filename "backup.sh" --visibility internal
```

---

## Common Workflows

### Set Up CI/CD Variables for Deployment

```bash
# Set deployment credentials
glab variable set DEPLOY_TOKEN --value "$TOKEN" --masked --protected
glab variable set DEPLOY_HOST --value "deploy.example.com" --protected
glab variable set DEPLOY_PATH --value "/var/www/app" --protected

# Set environment-scoped variables
glab variable set DB_HOST --value "staging-db.internal" --scope staging
glab variable set DB_HOST --value "prod-db.internal" --scope production

# Verify
glab variable list
```

### Organize Issues with Labels and Milestones

```bash
# Create label taxonomy
glab label create "type::bug" --color "#D32F2F"
glab label create "type::feature" --color "#1976D2"
glab label create "type::chore" --color "#757575"
glab label create "priority::high" --color "#FF6F00"
glab label create "priority::medium" --color "#FFA000"
glab label create "priority::low" --color "#4CAF50"

# Create sprint milestone
glab milestone create --title "Sprint 6" \
  --start-date "2025-06-15" --due-date "2025-06-28"

# Assign issues
glab issue update 15 --label "type::bug" --label "priority::high" --milestone "Sprint 6"
```

## Tips

- **Variable masking**: Masked variables must be at least 8 characters and can only contain certain characters. If masking fails, check the value format.
- **Variable precedence**: Project variables override group variables. Environment-scoped variables override unscoped ones.
- **Protected variables**: Only available in pipelines running on protected branches or tags.
- **Label scoping**: Use `::` in label names (e.g., `priority::high`) to create scoped labels — GitLab treats these as mutually exclusive within their scope.
- **Milestone closing**: Milestones linked to releases are auto-closed when the release is created (unless `--no-close-milestone` is used on `glab release create`).
