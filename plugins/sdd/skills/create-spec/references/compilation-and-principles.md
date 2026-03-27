# Compilation Steps & Core Principles

Detailed compilation procedures and spec writing guidelines for Phase 5 of the create-spec workflow.

---

## Compilation Steps

1. **Read the appropriate template** based on depth level

2. **Apply spec metadata formatting**:
   - Use the title format `# {spec-name} PRD`
   - Include these metadata fields in the header block after Status:
     - `**Spec Type**`: The product type selected during the interview
     - `**Spec Depth**`: The depth level selected
     - `**Description**`: The initial description provided by the user
   - If early exit was used, set `**Status**: Draft (Partial)`

3. **Organize information** into template sections

4. **Fill gaps** by inferring logical requirements (flag assumptions clearly)

5. **Add acceptance criteria** for each functional requirement

6. **Define phases** with clear completion criteria

7. **Insert checkpoint gates** at critical decision points

8. **Review for completeness** before writing

9. **Confirm output path** with the user:
   ```yaml
   question:
     header: "Output"
     text: "Where should I save the spec? Default: specs/{name}-SPEC.md"
     options:
       - label: "Use default path"
     custom: true
   ```

10. **Write the spec** to the confirmed output path

11. **Present the completed spec location** to the user

## Writing Guidelines

### Requirement Formatting

```markdown
### REQ-001: [Requirement Name]

**Priority**: P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)

**Description**: Clear, concise statement of what is needed.

**Acceptance Criteria**:
- [ ] Criterion 1
- [ ] Criterion 2

**Notes**: Any additional context or constraints.
```

### User Story Format

```markdown
**As a** [user type]
**I want** [capability]
**So that** [benefit/value]
```

### API Specification Format (Full Tech Only)

```markdown
#### Endpoint: `METHOD /path`

**Purpose**: Brief description

**Request**:
- Headers: `Content-Type: application/json`
- Body:
  ```json
  {
    "field": "type - description"
  }
  ```

**Response**:
- `200 OK`: Success response schema
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Authentication required
```

---

## Core Principles

These principles guide how specs should be structured:

### 1. Phase-Based Milestones (Not Timelines)

Specs should define clear phases with completion criteria rather than time estimates:

- **Phase 1: Foundation** - Core infrastructure and data models
- **Phase 2: Core Features** - Primary user-facing functionality
- **Phase 3: Enhancement** - Secondary features and optimizations
- **Phase 4: Polish** - UX refinement, edge cases, documentation

### 2. Testable Requirements

Every requirement should include:
- **Clear acceptance criteria** - Specific, measurable conditions for completion
- **Test scenarios** - How to verify the requirement is met
- **Edge cases** - Known boundary conditions to handle

### 3. Human Checkpoint Gates

Define explicit points where human review is required:
- Architecture decisions before implementation begins
- API contract review before integration work
- Security review before authentication/authorization features
- UX review before user-facing changes ship

### 4. Context for AI Consumption

Structure specs for optimal AI assistant consumption:
- Use consistent heading hierarchy
- Include code examples where applicable
- Reference existing patterns in the codebase
- Provide clear file location guidance
