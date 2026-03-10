# GitLab API — glab api

Make authenticated HTTP requests to the GitLab REST v4 and GraphQL APIs directly from the command line.

## Overview

`glab api` sends authenticated requests using your stored credentials. It handles token injection, hostname resolution, and response formatting automatically. Use it when glab doesn't have a dedicated subcommand for what you need, or when you need direct API access.

## REST API Requests

### Basic Syntax

```bash
glab api <endpoint> [flags]
```

The endpoint is relative to `/api/v4/`. The `:id` placeholder is automatically replaced with the current project's ID.

### Key Flags

| Flag | Description | Example |
|------|-------------|---------|
| `-X, --method` | HTTP method (default: GET) | `POST` |
| `-f, --field` | Request body fields (key=value) | `-f title="New issue"` |
| `-F, --raw-field` | Raw string field (no JSON conversion) | `-F body="text"` |
| `-H, --header` | Additional headers | `-H "Accept: text/plain"` |
| `--input` | Request body from file | `body.json` |
| `--jq` | Filter response with jq expression | `.[].name` |
| `--paginate` | Auto-paginate results | — |
| `--per-page` | Results per page | `100` |
| `--hostname` | Target a specific host | `gitlab.example.com` |
| `--output` | Output format (text/json) | `json` |

### GET Requests

```bash
# Get current project details
glab api projects/:id

# List project merge requests
glab api projects/:id/merge_requests

# List with query parameters
glab api projects/:id/merge_requests?state=opened&per_page=50

# Get a specific MR
glab api projects/:id/merge_requests/42

# Get project members
glab api projects/:id/members

# List all projects in a group
glab api groups/my-team/projects

# Get current user
glab api user
```

### POST Requests

```bash
# Create an issue via API
glab api projects/:id/issues -X POST \
  -f title="API-created issue" \
  -f description="Created via glab api"

# Add a comment to an MR
glab api projects/:id/merge_requests/42/notes -X POST \
  -f body="Comment from CLI"

# Create a project label
glab api projects/:id/labels -X POST \
  -f name="priority::high" \
  -f color="#FF0000"
```

### PUT Requests

```bash
# Update project settings
glab api projects/:id -X PUT \
  -f description="Updated project description"

# Update an issue
glab api projects/:id/issues/15 -X PUT \
  -f state_event=close
```

### DELETE Requests

```bash
# Delete a branch
glab api projects/:id/repository/branches/old-branch -X DELETE

# Remove a label
glab api projects/:id/labels/bug -X DELETE
```

## GraphQL Requests

Use `-X graphql` (or `graphql` as the endpoint) for GraphQL queries.

### Examples

```bash
# Get current user info
glab api graphql -f query='{ currentUser { name username email } }'

# Get project details
glab api graphql -f query='
  query {
    project(fullPath: "my-team/my-project") {
      name
      description
      mergeRequests(state: opened) {
        count
      }
    }
  }
'

# Query with variables
glab api graphql \
  -f query='query($path: ID!) { project(fullPath: $path) { name } }' \
  -f variables='{"path": "my-team/my-project"}'

# Get pipeline details
glab api graphql -f query='
  query {
    project(fullPath: "my-team/my-project") {
      pipelines(first: 5) {
        nodes {
          id
          status
          duration
          createdAt
        }
      }
    }
  }
'
```

## Filtering with --jq

The `--jq` flag applies a jq expression to the response, extracting specific fields without needing external `jq`.

```bash
# Extract MR titles
glab api projects/:id/merge_requests --jq '.[].title'

# Get MR IIDs and titles
glab api projects/:id/merge_requests --jq '.[] | {iid, title}'

# Count open issues
glab api projects/:id/issues?state=opened --jq 'length'

# Get member usernames
glab api projects/:id/members --jq '.[].username'

# Filter by condition
glab api projects/:id/pipelines --jq '[.[] | select(.status == "failed")]'
```

## Pagination

By default, API responses return one page (20 items). Use `--paginate` to automatically fetch all pages.

```bash
# Get all MRs (auto-paginate)
glab api projects/:id/merge_requests --paginate

# Paginate with more items per page (faster)
glab api projects/:id/issues --paginate --per-page 100

# Paginate with filtering
glab api projects/:id/merge_requests?state=merged --paginate --jq '.[].title'
```

## Common API Patterns

### Project Administration

```bash
# Get project settings
glab api projects/:id

# Protect a branch
glab api projects/:id/protected_branches -X POST \
  -f name=main \
  -f push_access_level=30 \
  -f merge_access_level=30

# Add a deploy key
glab api projects/:id/deploy_keys -X POST \
  -f title="Production server" \
  -f key="ssh-rsa AAAA..." \
  -f can_push=false
```

### Cross-Project Queries

```bash
# List all projects in a group
glab api groups/my-team/projects --paginate --jq '.[].path_with_namespace'

# Search for projects
glab api projects?search=api-gateway --jq '.[].path_with_namespace'

# Get group members
glab api groups/my-team/members --jq '.[] | {username, access_level}'
```

### Pipeline and Job Data

```bash
# Get pipeline jobs
glab api projects/:id/pipelines/12345/jobs --jq '.[] | {name, status, duration}'

# Get job artifacts
glab api projects/:id/jobs/67890/artifacts --output /tmp/artifacts.zip

# Get pipeline test report
glab api projects/:id/pipelines/12345/test_report
```

## Tips

- `:id` is automatically substituted with the current project's numeric ID when run from within a git repo that has a GitLab remote.
- For endpoints not under `/api/v4/`, you can use a full URL.
- `-f` fields are sent as JSON in the request body for POST/PUT. For GET requests, they become query parameters.
- `--jq` runs server-side-like filtering on the response — it's a built-in jq implementation, so you don't need `jq` installed separately.
- GraphQL is better for complex queries that would require multiple REST calls — e.g., getting MR details with author, pipeline status, and approval state in a single request.
- Rate limits apply. If you get 429 responses, reduce request frequency. `--paginate` handles rate limits automatically with backoff.
