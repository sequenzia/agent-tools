# Runners, Schedules & Jobs — glab runner / glab schedule / glab job

Manage CI/CD runners, pipeline schedules, and job artifacts from the command line.

---

## Runners — glab runner

Manage CI/CD runners assigned to your project or group.

### Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `list` | List runners available to the project |
| `assign` | Assign a runner to a project |
| `unassign` | Unassign a runner from a project |
| `update` | Update runner configuration |
| `delete` | Delete a runner |

### list

List runners available to the current project.

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--group` | List runners for a group | `my-team` |
| `--instance` | List all runners available to the user (instance scope) | — |
| `--output` | Output format (text/json, default "text") | `json` |
| `--per-page` | Items per page (default 30) | `50` |
| `--page` | Page number (default 1) | `2` |

#### Examples

```bash
# List all runners for the current project
glab runner list

# JSON output for scripting
glab runner list --output json

# List runners for a specific group
glab runner list --group my-team

# List all instance runners (admin)
glab runner list --instance
```

### assign

Assign a runner to a project.

```bash
# Assign runner by ID to current project
glab runner assign 12345

# Assign to a specific project
glab runner assign 12345 -R my-team/my-project
```

### unassign

Remove a runner from a project.

```bash
# Unassign runner from current project
glab runner unassign 12345
```

### update

Pause or resume a runner.

#### Key Flags

| Flag | Description |
|------|-------------|
| `--pause` | Pause the runner (stops accepting new jobs) |
| `--unpause` | Resume a paused runner |

#### Examples

```bash
# Pause a runner
glab runner update 12345 --pause

# Resume a paused runner
glab runner update 12345 --unpause
```

For advanced runner configuration (tags, description, access level, locking), use `glab api` with the Runners API:

```bash
# Update runner tags and description via API
glab api runners/12345 -X PUT \
  -f "description=Docker builder" \
  -f "tag_list=docker,linux,amd64"

# Lock runner to current projects
glab api runners/12345 -X PUT -f "locked=true"

# Restrict to protected branches
glab api runners/12345 -X PUT -f "access_level=ref_protected"
```

### delete

Delete a runner permanently.

```bash
# Delete a runner by ID
glab runner delete 12345
```

---

## Schedules — glab schedule

Create and manage pipeline schedules for automated recurring pipelines.

### Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `create` | Create a new pipeline schedule |
| `list` | List pipeline schedules |
| `run` | Trigger a scheduled pipeline immediately |
| `update` | Update a schedule |
| `delete` | Delete a schedule |

### create

Create a new pipeline schedule.

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--cron` | Cron expression (required) | `"0 2 * * *"` |
| `--description` | Schedule description (required) | `"Nightly build"` |
| `--ref` | Branch or tag to run on (required) | `main` |
| `--variable` | Schedule variables (KEY:VALUE, repeatable) | `"ENV:staging"` |
| `--cronTimeZone` | Timezone for cron expression (default "UTC") | `"America/New_York"` |
| `--active` | Whether the schedule is active | `true` |

#### Examples

```bash
# Create a nightly build schedule
glab schedule create --cron "0 2 * * *" --description "Nightly build" --ref main

# Create with timezone and variables
glab schedule create --cron "0 6 * * 1-5" \
  --description "Weekday morning deploy" \
  --ref main \
  --cronTimeZone "America/New_York" \
  --variable "DEPLOY_ENV:staging"

# Create inactive schedule (for testing)
glab schedule create --cron "0 0 * * 0" \
  --description "Weekly full test" --ref main --active false
```

### list

```bash
# List all schedules
glab schedule list

# JSON output
glab schedule list --output json
```

### run

Trigger a scheduled pipeline immediately (without waiting for the cron trigger).

```bash
# Run a schedule by ID
glab schedule run 42
```

### update

Update an existing schedule.

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--cron` | Cron interval pattern | `"0 3 * * *"` |
| `--description` | Schedule description | `"Updated nightly"` |
| `--ref` | Target branch or tag | `develop` |
| `--cronTimeZone` | Timezone for cron expression | `"America/New_York"` |
| `--active` | Whether the schedule is active | `false` |
| `--create-variable` | Add new variables (KEY:VALUE, repeatable) | `"DEBUG:true"` |
| `--update-variable` | Update existing variables (KEY:VALUE, repeatable) | `"ENV:production"` |
| `--delete-variable` | Delete variables (KEY, repeatable) | `"OLD_VAR"` |

```bash
# Update cron expression
glab schedule update 42 --cron "0 3 * * *"

# Change branch
glab schedule update 42 --ref develop

# Disable a schedule
glab schedule update 42 --active false

# Add a new variable to an existing schedule
glab schedule update 42 --description "Updated nightly" --create-variable "DEBUG:true"

# Update an existing variable
glab schedule update 42 --update-variable "DEPLOY_ENV:production"

# Delete a variable
glab schedule update 42 --delete-variable "OLD_VAR"
```

### delete

```bash
# Delete a schedule
glab schedule delete 42
```

---

## Jobs — glab job

Manage CI/CD job artifacts.

### Subcommand Overview

| Subcommand | Description |
|------------|-------------|
| `artifact` | Download job artifacts |

### artifact

Download artifacts from the most recent successful pipeline. Takes a branch/tag ref and job name (not a job ID).

**Syntax:** `glab job artifact <refName> <jobName> [flags]`

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--path` | Path to download the artifact files (default "./") | `"coverage/"` |
| `--list-paths` | Print the paths of downloaded artifacts | — |

#### Examples

```bash
# Download artifacts from a job on main branch
glab job artifact main build

# List available artifact paths
glab job artifact main build --list-paths

# Download artifacts to a specific directory
glab job artifact main test --path "coverage/"

# Download from a specific branch
glab job artifact feature/auth deploy
```

---

## Common Workflows

### Set Up a Nightly Build Schedule

```bash
# 1. Create the schedule
glab schedule create --cron "0 2 * * *" \
  --description "Nightly build & test" --ref main

# 2. Verify it was created
glab schedule list

# 3. Test it by triggering immediately
glab schedule run 42

# 4. Monitor the triggered pipeline
glab ci status --live
```

### Manage Project Runners

```bash
# 1. List available runners
glab runner list

# 2. List runners for a group
glab runner list --group my-team

# 3. Pause a runner for maintenance
glab runner update 12345 --pause

# 4. Resume the runner
glab runner update 12345 --unpause
```

### Download Job Artifacts

```bash
# 1. Find the job name from the pipeline
glab ci view

# 2. List available artifact paths
glab job artifact main build --list-paths

# 3. Download specific artifacts
glab job artifact main build --path "build/output"
```

### Schedule with Environment-Specific Variables

```bash
# Staging deploy every weekday morning
glab schedule create --cron "0 7 * * 1-5" \
  --description "Staging deploy" --ref main \
  --variable "DEPLOY_ENV:staging" \
  --variable "NOTIFY:true"

# Production deploy every Sunday night
glab schedule create --cron "0 22 * * 0" \
  --description "Weekly production deploy" --ref main \
  --variable "DEPLOY_ENV:production"
```

## Tips

- Cron expressions use standard 5-field format: `minute hour day month weekday`. Use [crontab.guru](https://crontab.guru) to verify expressions.
- Schedule variables are passed to the pipeline as CI/CD variables, supplementing (not replacing) project-level variables.
- `glab schedule run` triggers the pipeline immediately but does not change the next scheduled run time.
- Runner tags control which jobs a runner picks up. A job with `tags: [docker]` only runs on runners that have the `docker` tag. Use `glab api` to update runner tags.
- `glab runner update` only supports `--pause` and `--unpause`. For other runner configuration (tags, locking, access level), use `glab api runners/<id> -X PUT` with the appropriate fields.
- `glab job artifact` takes a ref name and job name (not a job ID). It downloads artifacts from the most recent successful pipeline on that ref.
