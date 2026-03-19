# Task Schema Reference

Complete JSON schema definition for `.tasks/{task-group}.json` files.

---

## File Structure

Each task file contains a top-level object with file metadata and a `tasks` array:

```json
{
  "version": "1.0",
  "task_group": "user-authentication",
  "spec_path": "specs/SPEC-Auth.md",
  "created_at": "2026-03-19T10:00:00Z",
  "updated_at": "2026-03-19T10:30:00Z",
  "tasks": []
}
```

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Schema version. Currently `"1.0"`. |
| `task_group` | string | Yes | Kebab-case identifier grouping these tasks (e.g., `"user-authentication"`). |
| `spec_path` | string | Yes | Path to the source specification file (e.g., `"specs/SPEC-Auth.md"`). |
| `created_at` | string | Yes | ISO 8601 timestamp of initial file creation. |
| `updated_at` | string | Yes | ISO 8601 timestamp of the most recent write. Updated on every file write. |
| `tasks` | array | Yes | Array of task objects (see below). |

---

## Task Object Fields

Each task in the `tasks` array has these fields:

### id

- **Type**: string
- **Required**: Yes
- **Format**: `task-NNN` where NNN is a zero-padded 3-digit sequential number
- **Description**: Unique identifier within this file. Generated at creation time as the next sequential ID.
- **Examples**: `"task-001"`, `"task-002"`, `"task-042"`

ID generation rules:
1. Find the highest existing numeric suffix in the file (e.g., `task-015` → 15)
2. Increment by 1 and zero-pad to 3 digits (→ `task-016`)
3. If the file is empty, start at `task-001`
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
- **Description**: Full task specification including context, technical details, acceptance criteria, and testing requirements. Supports markdown formatting.

Recommended structure:
```markdown
{Brief description of what needs to be done}

{Technical details if applicable}

**Acceptance Criteria:**

_Functional:_
- [ ] Core behavior criterion
- [ ] Expected output criterion

_Edge Cases:_
- [ ] Boundary condition criterion

_Error Handling:_
- [ ] Error scenario criterion

_Performance:_ (if applicable)
- [ ] Performance target criterion

**Testing Requirements:**
- {Test type}: {What to test}
- {Test type}: {What to test}

Source: {spec_path} Section {number}
```

### status

- **Type**: string
- **Required**: Yes
- **Values**: `"pending"`, `"in_progress"`, `"completed"`, `"deleted"`
- **Default**: `"pending"` on creation
- **Description**: Current state of the task. See Status Lifecycle in SKILL.md for transition rules.

### blocked_by

- **Type**: string[]
- **Required**: Yes (empty array `[]` if no dependencies)
- **Description**: Array of task IDs that must reach `completed` status before this task can start.
- **Validation**: Every ID in `blocked_by` must reference an existing task in the same file.
- **Example**: `["task-001", "task-003"]`

### blocks

- **Type**: string[]
- **Required**: Yes (empty array `[]` if nothing depends on this task)
- **Description**: **Computed field** — array of task IDs that have this task in their `blocked_by`. Recomputed on every file write as the inverse of all `blocked_by` relationships.
- **Never set manually**: Always derived from scanning all tasks' `blocked_by` arrays.
- **Example**: `["task-004", "task-005"]` (meaning tasks 4 and 5 depend on this task)

### owner

- **Type**: string | null
- **Required**: No (defaults to `null`)
- **Description**: Identifier of the agent or session that has claimed this task. Set when transitioning to `in_progress`.
- **Example**: `"agent-worker-1"`, `"session-abc123"`, `null`

### metadata

- **Type**: object
- **Required**: Yes (can be an object with only the required keys)
- **Description**: Typed key-value pairs for categorization, tracking, and deduplication.

#### Standard Metadata Keys

| Key | Type | Required | Values / Format | Description |
|-----|------|----------|----------------|-------------|
| `priority` | string | Yes | `"critical"`, `"high"`, `"medium"`, `"low"` | Execution ordering within a wave |
| `complexity` | string | Yes | `"XS"`, `"S"`, `"M"`, `"L"`, `"XL"` | Effort estimate |
| `task_group` | string | Yes | Kebab-case slug (e.g., `"user-auth"`) | Groups tasks for filtered execution |
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

Every task must have: `id`, `title`, `active_form`, `description`, `status`, `blocked_by`, `blocks`, `metadata`.

Every `metadata` object must have: `priority`, `complexity`, `task_group`, `task_uid`, `spec_path`, `feature_name`, `source_section`.

### Referential Integrity

- Every ID in `blocked_by` must reference an existing task `id` in the same file
- Every ID in `blocks` must reference an existing task `id` in the same file
- Every ID in `produces_for` must reference an existing task `id` in the same file
- `blocks` must be the exact inverse of all `blocked_by` relationships (computed, not manual)

### Acyclicity

The dependency graph formed by `blocked_by` relationships must be acyclic. To detect cycles: walk the `blocked_by` chain from each task — if you revisit a task already seen, a cycle exists.

### Status Constraints

- Only `pending` tasks with all blockers `completed` should transition to `in_progress`
- Only `in_progress` tasks should transition to `completed`
- `completed` tasks should not be modified (except to `deleted`)

---

## Example: Minimal Task

```json
{
  "id": "task-001",
  "title": "Create User data model",
  "active_form": "Creating User data model",
  "description": "Define the User entity with id, email, passwordHash, and timestamp fields.\n\n**Acceptance Criteria:**\n\n_Functional:_\n- [ ] All fields defined with correct types\n- [ ] Email uniqueness constraint\n\n**Testing Requirements:**\n- Unit: Schema validation\n- Integration: Database persistence\n\nSource: specs/SPEC-Auth.md Section 7.3",
  "status": "pending",
  "blocked_by": [],
  "blocks": ["task-002", "task-003"],
  "owner": null,
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

```json
{
  "id": "task-005",
  "title": "Implement POST /auth/login endpoint",
  "active_form": "Implementing login endpoint",
  "description": "Create login endpoint that authenticates users and returns JWT token.\n\nEndpoint: POST /api/auth/login\nRequest: { email, password }\nResponse: { token, expiresAt, user }\n\n**Acceptance Criteria:**\n\n_Functional:_\n- [ ] Valid credentials return JWT token\n- [ ] Token contains user ID and expiration\n\n_Error Handling:_\n- [ ] 401 for invalid credentials\n- [ ] 429 for rate limit exceeded\n\n_Performance:_\n- [ ] Response time < 200ms (P95)\n\n**Testing Requirements:**\n- Integration: Successful login returns valid token\n- Integration: Invalid credentials return 401\n- Security: Rate limiting prevents brute force\n\nSource: specs/SPEC-Auth.md Section 7.4.1",
  "status": "pending",
  "blocked_by": ["task-001"],
  "blocks": ["task-010"],
  "owner": null,
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

## Example: Complete File

```json
{
  "version": "1.0",
  "task_group": "user-authentication",
  "spec_path": "specs/SPEC-Auth.md",
  "created_at": "2026-03-19T10:00:00Z",
  "updated_at": "2026-03-19T10:00:00Z",
  "tasks": [
    {
      "id": "task-001",
      "title": "Create User data model",
      "active_form": "Creating User data model",
      "description": "...",
      "status": "pending",
      "blocked_by": [],
      "blocks": ["task-002", "task-003"],
      "owner": null,
      "metadata": {
        "priority": "critical",
        "complexity": "S",
        "task_group": "user-authentication",
        "task_uid": "specs/SPEC-Auth.md:user-auth:model:001",
        "spec_path": "specs/SPEC-Auth.md",
        "feature_name": "User Authentication",
        "source_section": "7.3 Data Models",
        "spec_phase": 1,
        "spec_phase_name": "Foundation"
      }
    },
    {
      "id": "task-002",
      "title": "Implement POST /auth/login endpoint",
      "active_form": "Implementing login endpoint",
      "description": "...",
      "status": "pending",
      "blocked_by": ["task-001"],
      "blocks": ["task-004"],
      "owner": null,
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
        "produces_for": ["task-004"]
      }
    },
    {
      "id": "task-003",
      "title": "Implement POST /auth/register endpoint",
      "active_form": "Implementing registration endpoint",
      "description": "...",
      "status": "pending",
      "blocked_by": ["task-001"],
      "blocks": ["task-004"],
      "owner": null,
      "metadata": {
        "priority": "high",
        "complexity": "M",
        "task_group": "user-authentication",
        "task_uid": "specs/SPEC-Auth.md:user-auth:api-register:001",
        "spec_path": "specs/SPEC-Auth.md",
        "feature_name": "User Authentication",
        "source_section": "7.4 API Specifications",
        "spec_phase": 1,
        "spec_phase_name": "Foundation"
      }
    },
    {
      "id": "task-004",
      "title": "Add auth endpoint integration tests",
      "active_form": "Adding auth endpoint integration tests",
      "description": "...",
      "status": "pending",
      "blocked_by": ["task-002", "task-003"],
      "blocks": [],
      "owner": null,
      "metadata": {
        "priority": "high",
        "complexity": "M",
        "task_group": "user-authentication",
        "task_uid": "specs/SPEC-Auth.md:user-auth:test:001",
        "spec_path": "specs/SPEC-Auth.md",
        "feature_name": "User Authentication",
        "source_section": "8.1 Testing Strategy",
        "spec_phase": 1,
        "spec_phase_name": "Foundation"
      }
    }
  ]
}
```

This forms a diamond dependency pattern: task-001 fans out to task-002 and task-003, which fan in to task-004.
