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
| `--status` | Filter by status (online/offline/stale/never_contacted) | `online` |
| `--type` | Filter by type (instance_type/group_type/project_type) | `project_type` |
| `--tag` | Filter by tag | `docker` |
| `--all` | List all runners (admin only) | — |
| `--output` | Output format (text/json) | `json` |
| `--per-page` | Results per page | `50` |
| `--page` | Page number | `2` |

#### Examples

```bash
# List all runners for the current project
glab runner list

# List only online runners
glab runner list --status online

# List runners with a specific tag
glab runner list --tag docker

# JSON output for scripting
glab runner list --output json

# List all runners (admin)
glab runner list --all
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

Update runner configuration.

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--description` | Runner description | `"Docker builder"` |
| `--active` | Set runner active state | `true` |
| `--locked` | Lock runner to current projects | `true` |
| `--run-untagged` | Allow untagged jobs | `false` |
| `--tag-list` | Runner tags (comma-separated) | `"docker,linux"` |
| `--access-level` | Access level (not_protected/ref_protected) | `ref_protected` |
| `--maximum-timeout` | Max job timeout in seconds | `3600` |

#### Examples

```bash
# Update runner description and tags
glab runner update 12345 --description "Docker builder" --tag-list "docker,linux,amd64"

# Lock runner to current projects
glab runner update 12345 --locked true

# Set runner to only run tagged jobs
glab runner update 12345 --run-untagged false

# Restrict to protected branches
glab runner update 12345 --access-level ref_protected
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
| `--cron-timezone` | Timezone for cron expression | `"America/New_York"` |
| `--active` | Whether the schedule is active | `true` |

#### Examples

```bash
# Create a nightly build schedule
glab schedule create --cron "0 2 * * *" --description "Nightly build" --ref main

# Create with timezone and variables
glab schedule create --cron "0 6 * * 1-5" \
  --description "Weekday morning deploy" \
  --ref main \
  --cron-timezone "America/New_York" \
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

```bash
# Update cron expression
glab schedule update 42 --cron "0 3 * * *"

# Change branch
glab schedule update 42 --ref develop

# Disable a schedule
glab schedule update 42 --active false

# Update description and add variable
glab schedule update 42 --description "Updated nightly" --variable "DEBUG:true"
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

Download artifacts from a CI/CD job.

#### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--path` | Path within the artifact archive to download | `"coverage/"` |
| `--list-paths` | List available paths in the artifact archive | — |

#### Examples

```bash
# Download artifacts from a job by job ID
glab job artifact 123456

# List available artifact paths
glab job artifact 123456 --list-paths

# Download a specific path from artifacts
glab job artifact 123456 --path "coverage/report.html"
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

# 2. Check which are online
glab runner list --status online

# 3. Update tags for a runner
glab runner update 12345 --tag-list "docker,linux,deploy"

# 4. Lock runner to this project
glab runner update 12345 --locked true
```

### Download Job Artifacts

```bash
# 1. Find the job ID from the pipeline
glab ci view

# 2. List available artifact paths
glab job artifact 123456 --list-paths

# 3. Download specific artifacts
glab job artifact 123456 --path "build/output"
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
- Runner tags control which jobs a runner picks up. A job with `tags: [docker]` only runs on runners that have the `docker` tag.
- Locked runners (`--locked true`) cannot be assigned to other projects — useful for dedicated build infrastructure.
- Use `--access-level ref_protected` on runners that should only execute jobs on protected branches.
