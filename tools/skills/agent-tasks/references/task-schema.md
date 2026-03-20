# Task Schema Reference

Complete JSON schema definition for `.agent-tasks/` task files.

---

## Directory Structure

Tasks are stored as individual JSON files organized by status and group:

```
.agent-tasks/
├── _manifests/
│   └── {group}.json
├── backlog/
│   └── {group}/
│       └── task-NNN.json
├── pending/
│   └── {group}/
│       └── task-NNN.json
├── in-progress/
│   └── {group}/
│       └── task-NNN.json
└── completed/
    └── {group}/
        └── task-NNN.json
```

---

## Manifest File

Each task group has a manifest file at `_manifests/{group}.json`:

```json
{
  "version": "2.0",
  "task_group": "user-authentication",
  "spec_path": "specs/SPEC-Auth.md",
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-20T10:30:00Z"
}
```

### Manifest Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Schema version. Currently `"2.0"`. |
| `task_group` | string | Yes | Kebab-case identifier grouping these tasks (e.g., `"user-authentication"`). |
| `spec_path` | string | Yes | Path to the source specification file (e.g., `"specs/SPEC-Auth.md"`). |
| `created_at` | string | Yes | ISO 8601 timestamp of initial manifest creation. |
| `updated_at` | string | Yes | ISO 8601 timestamp of the most recent group modification. Updated on any task write. |

---

## Task Object Fields

Each task is stored as an individual JSON file with these fields:

### id

- **Type**: string
- **Required**: Yes
- **Format**: `task-NNN` where NNN is a zero-padded 3-digit sequential number
- **Description**: Unique identifier within this task group. Generated at creation time as the next sequential ID. Also used as the filename (e.g., `task-001.json`).
- **Examples**: `"task-001"`, `"task-002"`, `"task-042"`

ID generation rules:
1. Find the highest existing numeric suffix across all status directories for the group
2. Increment by 1 and zero-pad to 3 digits (→ `task-016`)
3. If no tasks exist, start at `task-001`
4. IDs are never reused — if task-005 is deleted, the next task is still task-016 (or wherever the sequence is)

### title

- **Type**: string
- **Required**: Yes
- **Description**: Short imperative title for the task. Displayed in task lists and overviews.
- **Convention**: Imperative mood, 5-10 words.
- **Good**: `"Create user schema"`, `"Add JWT authentication"`, `"Fix login timeout bug"`
- **Bad**: `"Creating user schema"`, `"JWT authentication addition"`, `"Login timeout bug"`

### active_form

- **Type**: string
- **Required**: Yes
- **Description**: Present-continuous description shown while the task is in progress. Used by execution UIs and status displays.
- **Convention**: Convert the imperative verb in `title` to its `-ing` form.
- **Examples**: `"Creating user schema"`, `"Adding JWT authentication"`, `"Fixing login timeout bug"`

### description

- **Type**: string (markdown)
- **Required**: Yes
- **Description**: Pure description of what needs to be done, including context and technical details. Does **not** contain acceptance criteria or testing requirements — those are in their own top-level fields.

### acceptance_criteria

- **Type**: object
- **Required**: Yes
- **Description**: Structured acceptance criteria organized by category. Each category is an array of strings describing individual criteria.

| Category | Type | Description |
|----------|------|-------------|
| `functional` | string[] | Core behavior, expected outputs, state changes |
| `edge_cases` | string[] | Boundaries, empty/null, max values, concurrent operations |
| `error_handling` | string[] | Invalid input, failures, timeouts, graceful degradation |
| `performance` | string[] | Response times, throughput, resource limits (if applicable) |

All four categories must be present. Use an empty array `[]` if a category has no criteria.

### testing_requirements

- **Type**: array of objects
- **Required**: Yes (empty array `[]` if no specific testing requirements)
- **Description**: Array of testing requirements, each specifying a test type and target.

Each object has:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Test type: `"unit"`, `"integration"`, `"e2e"`, `"security"`, `"performance"` |
| `target` | string | What to test (e.g., `"Schema validation"`, `"Database persistence"`) |

### status

- **Type**: string
- **Required**: Yes
- **Values**: `"backlog"`, `"pending"`, `"in_progress"`, `"completed"`
- **Default**: `"pending"` for current-phase tasks, `"backlog"` for future-phase tasks
- **Description**: Current state of the task. Must match the directory the file lives in. See Status Lifecycle in SKILL.md for transition rules.

### blocked_by

- **Type**: string[]
- **Required**: Yes (empty array `[]` if no dependencies)
- **Description**: Array of task IDs that must reach `completed` status before this task can start.
- **Validation**: Every ID in `blocked_by` must reference an existing task in the same group (across any status directory).
- **Example**: `["task-001", "task-003"]`

### owner

- **Type**: string | null
- **Required**: No (defaults to `null`)
- **Description**: Identifier of the agent or session that has claimed this task. Set when transitioning to `in_progress`.
- **Example**: `"agent-worker-1"`, `"session-abc123"`, `null`

### created_at

- **Type**: string
- **Required**: Yes
- **Description**: ISO 8601 timestamp of when the task was created.
- **Example**: `"2026-03-20T10:00:00Z"`

### updated_at

- **Type**: string
- **Required**: Yes
- **Description**: ISO 8601 timestamp of the most recent modification to this task. Updated on every write.
- **Example**: `"2026-03-20T10:30:00Z"`

### metadata

- **Type**: object
- **Required**: Yes (can be an object with only the required keys)
- **Description**: Typed key-value pairs for categorization, tracking, and deduplication.

#### Standard Metadata Keys

| Key | Type | Required | Values / Format | Description |
|-----|------|----------|----------------|-------------|
| `priority` | string | Yes | `"critical"`, `"high"`, `"medium"`, `"low"` | Execution ordering within a wave |
| `complexity` | string | Yes | `"XS"`, `"S"`, `"M"`, `"L"`, `"XL"` | Effort estimate |
| `task_group` | string | Yes | Kebab-case slug (e.g., `"user-auth"`) | Groups tasks; matches directory name |
| `task_uid` | string | Yes | `{spec_path}:{feature}:{type}:{seq}` | Composite key for idempotent merge |
| `spec_path` | string | Yes | File path | Source spec file |
| `feature_name` | string | Yes | Feature name string | Parent feature from spec |
| `source_section` | string | Yes | Section reference (e.g., `"7.3 Data Models"`) | Spec section that defined this task |
| `spec_phase` | integer | Conditional | Phase number (e.g., `1`, `2`) | Phase from spec Section 9. Omit if no phases. |
| `spec_phase_name` | string | Conditional | Phase name (e.g., `"Foundation"`) | Phase name from spec. Omit if no phases. |
| `produces_for` | string[] | Optional | Array of task IDs | Tasks that consume this task's output |
| `needs_review` | boolean | Optional | `true` | Flags uncertain tasks for human review |
| `incomplete` | boolean | Optional | `true` | Flags tasks created with missing information |
| `dependency_override` | boolean | Optional | `true` | Marks manually overridden dependencies |

**Metadata typing**: Unlike harness-specific tools that restrict all values to strings, this schema supports native JSON types. Use integers for `spec_phase`, arrays for `produces_for`, and booleans for flags.

---

## Validation Rules

### Required Fields

Every task must have: `id`, `title`, `active_form`, `description`, `acceptance_criteria`, `testing_requirements`, `status`, `blocked_by`, `created_at`, `updated_at`, `metadata`.

Every `acceptance_criteria` object must have: `functional`, `edge_cases`, `error_handling`, `performance` (all arrays, empty if no criteria).

Every `metadata` object must have: `priority`, `complexity`, `task_group`, `task_uid`, `spec_path`, `feature_name`, `source_section`.

### Referential Integrity

- Every ID in `blocked_by` must reference an existing task `id` in the same group (across all status directories)
- Every ID in `produces_for` must reference an existing task `id` in the same group

### Status-Directory Consistency

- The `status` field in a task file must match the status directory the file lives in
- A file at `.agent-tasks/pending/group/task-001.json` must have `"status": "pending"`
- After moving a file, always update the `status` field to match the new directory

### Acceptance Criteria Structure

- `acceptance_criteria` must be an object with exactly four keys: `functional`, `edge_cases`, `error_handling`, `performance`
- Each key must map to an array of strings
- Empty arrays are valid (not all categories apply to every task)

### Acyclicity

The dependency graph formed by `blocked_by` relationships must be acyclic. To detect cycles: walk the `blocked_by` chain from each task — if you revisit a task already seen, a cycle exists.

### Status Constraints

- Only `pending` tasks with all blockers `completed` should transition to `in_progress`
- Only `in_progress` tasks should transition to `completed`
- `completed` tasks should not be modified

---

## Example: Minimal Task

File: `.agent-tasks/pending/user-authentication/task-001.json`

```json
{
  "id": "task-001",
  "title": "Create User data model",
  "active_form": "Creating User data model",
  "description": "Define the User entity with id, email, passwordHash, and timestamp fields.\n\nSource: specs/SPEC-Auth.md Section 7.3",
  "acceptance_criteria": {
    "functional": [
      "All fields defined with correct types",
      "Email uniqueness constraint"
    ],
    "edge_cases": [],
    "error_handling": [],
    "performance": []
  },
  "testing_requirements": [
    { "type": "unit", "target": "Schema validation" },
    { "type": "integration", "target": "Database persistence" }
  ],
  "status": "pending",
  "blocked_by": [],
  "owner": null,
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-20T10:00:00Z",
  "metadata": {
    "priority": "critical",
    "complexity": "S",
    "task_group": "user-authentication",
    "task_uid": "specs/SPEC-Auth.md:user-auth:model:001",
    "spec_path": "specs/SPEC-Auth.md",
    "feature_name": "User Authentication",
    "source_section": "7.3 Data Models"
  }
}
```

## Example: Task with Phase and Producer-Consumer

File: `.agent-tasks/pending/user-authentication/task-005.json`

```json
{
  "id": "task-005",
  "title": "Implement POST /auth/login endpoint",
  "active_form": "Implementing login endpoint",
  "description": "Create login endpoint that authenticates users and returns JWT token.\n\nEndpoint: POST /api/auth/login\nRequest: { email, password }\nResponse: { token, expiresAt, user }\n\nSource: specs/SPEC-Auth.md Section 7.4.1",
  "acceptance_criteria": {
    "functional": [
      "Valid credentials return JWT token",
      "Token contains user ID and expiration"
    ],
    "edge_cases": [],
    "error_handling": [
      "401 for invalid credentials",
      "429 for rate limit exceeded"
    ],
    "performance": [
      "Response time < 200ms (P95)"
    ]
  },
  "testing_requirements": [
    { "type": "integration", "target": "Successful login returns valid token" },
    { "type": "integration", "target": "Invalid credentials return 401" },
    { "type": "security", "target": "Rate limiting prevents brute force" }
  ],
  "status": "pending",
  "blocked_by": ["task-001"],
  "owner": null,
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-20T10:00:00Z",
  "metadata": {
    "priority": "high",
    "complexity": "M",
    "task_group": "user-authentication",
    "task_uid": "specs/SPEC-Auth.md:user-auth:api-login:001",
    "spec_path": "specs/SPEC-Auth.md",
    "feature_name": "User Authentication",
    "source_section": "7.4 API Specifications",
    "spec_phase": 1,
    "spec_phase_name": "Foundation",
    "produces_for": ["task-010"]
  }
}
```

## Example: Backlog Task (Future Phase)

File: `.agent-tasks/backlog/user-authentication/task-010.json`

```json
{
  "id": "task-010",
  "title": "Add OAuth2 social login",
  "active_form": "Adding OAuth2 social login",
  "description": "Integrate Google and GitHub OAuth2 providers for social login.\n\nSource: specs/SPEC-Auth.md Section 5.3",
  "acceptance_criteria": {
    "functional": [
      "Google OAuth2 login flow works end-to-end",
      "GitHub OAuth2 login flow works end-to-end",
      "New OAuth users get local accounts created"
    ],
    "edge_cases": [
      "Handles existing email with different provider"
    ],
    "error_handling": [
      "Graceful handling of OAuth provider downtime"
    ],
    "performance": []
  },
  "testing_requirements": [
    { "type": "integration", "target": "OAuth2 flow with mocked providers" },
    { "type": "e2e", "target": "Full login flow through UI" }
  ],
  "status": "backlog",
  "blocked_by": ["task-005"],
  "owner": null,
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-20T10:00:00Z",
  "metadata": {
    "priority": "medium",
    "complexity": "L",
    "task_group": "user-authentication",
    "task_uid": "specs/SPEC-Auth.md:user-auth:oauth:001",
    "spec_path": "specs/SPEC-Auth.md",
    "feature_name": "User Authentication",
    "source_section": "5.3 Social Login",
    "spec_phase": 2,
    "spec_phase_name": "Enhancement"
  }
}
```

## Example: Manifest File

File: `.agent-tasks/_manifests/user-authentication.json`

```json
{
  "version": "2.0",
  "task_group": "user-authentication",
  "spec_path": "specs/SPEC-Auth.md",
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-20T10:30:00Z"
}
```
