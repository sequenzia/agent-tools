# CI/CD Pipelines — glab ci

Monitor, trigger, debug, and manage CI/CD pipelines and jobs from the command line.

## Subcommand Overview

| Subcommand | Alias | Description |
|------------|-------|-------------|
| `status` | `stats` | View current pipeline status |
| `list` | — | List pipelines |
| `view` | — | Interactive pipeline viewer |
| `trace` | — | Stream job logs in real-time |
| `run` | `create` | Trigger a new pipeline |
| `run-trig` | — | Run a pipeline using a trigger token |
| `lint` | — | Validate `.gitlab-ci.yml` syntax |
| `retry` | — | Retry failed pipelines or jobs |
| `cancel` | — | Cancel running pipelines or jobs |
| `get` | — | Get details of a specific pipeline |
| `delete` | — | Delete a pipeline |
| `config` | — | Manage CI/CD configuration |
| `trigger` | — | Manage pipeline triggers |

## status

Show the status of the most recent pipeline on a branch.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--branch` | Branch to check (default: current) | `main` |
| `--compact` | Compact output format | — |
| `--live` | Auto-refresh status until complete | — |
| `--output` | Output format (text/json) | `json` |

### Examples

```bash
# Current branch pipeline status
glab ci status

# Status for main branch
glab ci status --branch main

# Live-updating status (waits until pipeline completes)
glab ci status --live

# JSON output for parsing
glab ci status --output json
```

## list

List pipelines for the project.

```bash
# List recent pipelines
glab ci list

# JSON output for scripting
glab ci list --output json

# Filter by status
glab ci list --status failed
```

## view

Interactive pipeline viewer with keyboard navigation. Shows jobs grouped by stage with status indicators.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--branch` | Branch to view (default: current) | `main` |
| `--pipelineid` | View specific pipeline | `12345` |
| `--web` | Open in browser instead | — |

### Keyboard Controls

| Key | Action |
|-----|--------|
| `Enter` | View job logs |
| `Esc` | Go back / exit |
| `Ctrl+R` | Retry a failed job |
| `Ctrl+D` | Cancel a running job |
| `Ctrl+Q` | Quit viewer |

### Examples

```bash
# View latest pipeline interactively
glab ci view

# View specific pipeline
glab ci view --pipelineid 12345

# View in browser
glab ci view --web
```

## trace

Stream job logs in real-time. Useful for monitoring running jobs or debugging failures.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--branch` | Branch (default: current) | `main` |
| `--pipeline-id` | Specific pipeline ID | `12345` |

### Examples

```bash
# Stream logs from the most recent job
glab ci trace

# Trace a specific job by name
glab ci trace lint

# Trace from a specific pipeline
glab ci trace --pipeline-id 12345
```

## run

Trigger a new pipeline on a branch.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--branch` | Branch to run on (default: current) | `main` |
| `--variables` | Pipeline variables (KEY:VALUE) | `"DEPLOY_ENV:staging"` |
| `--variables-env` | Variables from environment | `"MY_VAR"` |
| `--variables-file` | Variable as file type | `"CONFIG:config.yml"` |
| `--variables-from` | Load variables from a file | `vars.env` |
| `--input` | Pipeline inputs (KEY:VALUE) | `"deploy_target:production"` |
| `--mr` | Run on MR's source branch | `42` |
| `--web` | Open pipeline in browser | — |

### Examples

```bash
# Run pipeline on current branch
glab ci run

# Run on main
glab ci run -b main

# Run with variables
glab ci run -b main --variables "DEPLOY_ENV:staging"

# Run with multiple variables
glab ci run -b main \
  --variables "DEPLOY_ENV:staging" \
  --variables "SKIP_TESTS:false"

# Run pipeline for an MR
glab ci run --mr 42

# Run with pipeline inputs
glab ci run -b main --input "deploy_target:production"
```

## run-trig

Trigger a pipeline using a trigger token (useful for cross-project pipelines).

```bash
# Trigger with token
glab ci run-trig --token "$TRIGGER_TOKEN" --branch main

# With variables
glab ci run-trig --token "$TRIGGER_TOKEN" --branch main \
  --variables "DEPLOY_ENV:production"
```

## lint

Validate `.gitlab-ci.yml` syntax before pushing.

### Key Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Validate without creating a pipeline |
| `--include-jobs` | Show expanded job definitions |
| `--ref` | Branch to validate against |

### Examples

```bash
# Validate current .gitlab-ci.yml
glab ci lint

# Dry run with expanded jobs
glab ci lint --dry-run --include-jobs

# Validate against a specific branch (for includes resolution)
glab ci lint --ref main
```

## retry

Retry failed pipelines or jobs.

```bash
# Retry the latest failed pipeline
glab ci retry

# Retry a specific pipeline
glab ci retry 12345
```

## cancel

Cancel running pipelines or jobs.

```bash
# Cancel the current branch's pipeline
glab ci cancel

# Cancel a specific pipeline
glab ci cancel 12345
```

## get / delete

```bash
# Get pipeline details
glab ci get 12345

# Delete a pipeline (and its jobs/artifacts)
glab ci delete 12345
```

## trigger

Manage pipeline trigger tokens.

```bash
# List triggers
glab ci trigger list

# Create a new trigger
glab ci trigger create --description "Deploy trigger"

# Delete a trigger
glab ci trigger delete 5
```

## Common Workflows

### Debug a Failing Pipeline

```bash
# 1. Check which pipeline/job failed
glab ci status

# 2. View the pipeline interactively
glab ci view

# 3. Stream the failing job's logs
glab ci trace <job-name>

# 4. After fixing, retry the failed job
glab ci retry
```

### Validate CI Config Before Pushing

```bash
# 1. Lint the config
glab ci lint

# 2. Check expanded jobs
glab ci lint --include-jobs

# 3. If valid, push and monitor
git push
glab ci status --live
```

### Monitor Pipeline to Completion

```bash
# Option 1: Live status update
glab ci status --live

# Option 2: Interactive viewer
glab ci view

# Option 3: Stream specific job logs
glab ci trace deploy
```

### Trigger Deployment Pipeline

```bash
# Run pipeline with deploy variables
glab ci run -b main --variables "DEPLOY_ENV:production"

# Monitor deployment
glab ci status --branch main --live
```

### Re-run Pipeline with Different Variables

```bash
# Run with staging config
glab ci run -b main --variables "DEPLOY_ENV:staging"

# After verification, run with production config
glab ci run -b main --variables "DEPLOY_ENV:production"
```

## Tips

- `glab ci status --live` blocks until the pipeline completes — useful for scripting deployment gates.
- `glab ci lint` validates against the server, so it respects `include:` directives and project-level CI/CD settings.
- The interactive `glab ci view` lets you retry or cancel individual jobs with keyboard shortcuts — often faster than finding them in the web UI.
- Job names in `glab ci trace <job-name>` must match exactly. Use `glab ci view` to see available job names.
- `--variables` uses `KEY:VALUE` format (colon separator), not `KEY=VALUE`.
- Pipeline triggers (`run-trig`) are for cross-project automation. For manual triggers within a project, use `glab ci run`.
