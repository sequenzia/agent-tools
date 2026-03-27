# Verification Patterns Reference

This reference provides detailed verification approaches for SDD tasks with structured `acceptance_criteria`, including criterion evaluation, pass/fail determination, and failure reporting.

## Task Classification Detection

All tasks from the `create-tasks` skill have structured `acceptance_criteria` objects. Use this algorithm to classify:

### Step 1: Check for Structured Acceptance Criteria

Check if the task JSON has an `acceptance_criteria` object with non-empty arrays:

```json
{
  "acceptance_criteria": {
    "functional": ["criterion 1", "criterion 2"],
    "edge_cases": ["criterion 3"],
    "error_handling": ["criterion 4"],
    "performance": []
  }
}
```

If found with at least one non-empty array → **SDD task** (structured verification)

### Step 2: Check Description Format (Legacy Fallback)

If `acceptance_criteria` is missing, search the task description for the `**Acceptance Criteria:**` header followed by categorized criteria:

```
_Functional:_
- [ ] ...

_Edge Cases:_
- [ ] ...
```

If found → **SDD task** (parse criteria from description markdown)

### Step 3: Check Metadata

Check for `metadata.spec_path` field. If present → likely an SDD task

### Default

If none of the above match → **fallback** (infer requirements from title and description)

---

## SDD Task Verification

### Parsing Structured Acceptance Criteria

Read the `acceptance_criteria` object directly from the task JSON:

- `acceptance_criteria.functional` — array of strings, each is a Functional criterion
- `acceptance_criteria.edge_cases` — array of strings, each is an Edge Cases criterion
- `acceptance_criteria.error_handling` — array of strings, each is an Error Handling criterion
- `acceptance_criteria.performance` — array of strings, each is a Performance criterion

Empty arrays (`[]`) mean no criteria for that category.

### Evidence Types by Category

Verify each criterion using appropriate evidence:

| Category | How to Verify | Evidence Types |
|----------|--------------|----------------|
| **Functional** | Code inspection + test execution | File exists, function works, test passes |
| **Edge Cases** | Code inspection + targeted tests | Boundary handled, test covers scenario |
| **Error Handling** | Code inspection + error tests | Error path exists, error message returned, test confirms |
| **Performance** | Benchmark or inspection | Code uses efficient approach, no obvious bottlenecks |

### Functional Criteria Verification

For each string in `acceptance_criteria.functional`:
1. **Locate implementation**: Find the code that satisfies this criterion
2. **Verify correctness**: Read the code and confirm it does what the criterion requires
3. **Run tests**: Execute relevant tests that exercise this behavior
4. **Record result**: PASS if code exists and tests pass; FAIL if missing or tests fail

### Edge Case Criteria Verification

For each string in `acceptance_criteria.edge_cases`:
1. **Check guard clauses**: Look for boundary checks, null guards, validation
2. **Check test coverage**: Find tests that exercise the edge case
3. **Verify behavior**: Confirm the edge case produces the correct result
4. **Record result**: PASS if handled; FAIL if unhandled; SKIP if not applicable to implementation

### Error Handling Criteria Verification

For each string in `acceptance_criteria.error_handling`:
1. **Check error paths**: Find try/catch, error returns, validation errors
2. **Verify messages**: Check that error messages are clear and informative
3. **Check recovery**: Verify the system recovers gracefully from the error
4. **Record result**: PASS if handled; FAIL if unhandled

### Performance Criteria Verification

For each string in `acceptance_criteria.performance`:
1. **Inspect approach**: Check that the implementation uses an efficient algorithm
2. **Check for obvious issues**: N+1 queries, unbounded loops, missing indexes
3. **Run benchmarks**: If test infrastructure supports it, measure performance
4. **Record result**: PASS if efficient approach used; FAIL if obvious performance issue

### Testing Requirements Verification

After verifying acceptance criteria, check `testing_requirements`:

1. **Parse the array**: Each entry is a `{type, target}` object:
   ```json
   [
     { "type": "unit", "target": "Schema validation for all field types" },
     { "type": "integration", "target": "Database persistence and retrieval" }
   ]
   ```

2. **For each test requirement**:
   - Find or create the corresponding test
   - Run the test
   - Confirm it passes

3. **Run full test suite**: Execute the project's test command to check for regressions

---

## Fallback Verification

For tasks without structured `acceptance_criteria` (safety net for manually created tasks).

### Subject Line Parsing

Infer verification approach from the task title:

| Title Pattern | Verification Approach |
|--------------|----------------------|
| "Fix {X}" | Verify the bug no longer reproduces; check regression tests pass |
| "Add {X}" | Verify X exists and works; check it integrates with existing code |
| "Create {X}" | Verify X is created with correct structure; check it can be used |
| "Implement {X}" | Verify X works end-to-end; check tests cover core behavior |
| "Update {X}" | Verify X reflects the changes; check nothing else broke |
| "Remove {X}" | Verify X is fully removed; check no dead references remain |
| "Refactor {X}" | Verify behavior is unchanged; check tests still pass |
| "Configure {X}" | Verify configuration works; check it applies correctly |

### Description Parsing

Extract implicit criteria from description text:

- **"should..."** statements → functional requirements to verify
- **"when..."** statements → scenarios to test
- **"must..."** statements → hard requirements to verify
- **"can..."** statements → capabilities to confirm
- **"handle..."** statements → error scenarios to check

### Basic Quality Checklist

For all fallback tasks, verify:

1. **Tests pass**: Run the project's test suite; no regressions
2. **Linter passes**: Run the project's linter; no new violations
3. **Core change works**: The primary change described in the task is implemented and functional
4. **No dead code**: Removed features don't leave dead references
5. **Files are saved**: All changes are written to disk

---

## Pass Threshold Rules

### SDD Tasks (Structured Acceptance Criteria)

| Category | Pass Requirement | Failure Impact |
|----------|-----------------|----------------|
| **Functional** | ALL must pass | Any failure → FAIL |
| **Edge Cases** | Failures flagged, don't block | Report as PARTIAL if other categories pass |
| **Error Handling** | Failures flagged, don't block | Report as PARTIAL if other categories pass |
| **Performance** | Failures flagged, don't block | Report as PARTIAL if other categories pass |
| **Tests** | ALL must pass | Any test failure → FAIL |

**Decision matrix:**

```
All Functional PASS + Tests PASS                          → PASS
All Functional PASS + Tests PASS + Edge/Error/Perf issues → PARTIAL
Any Functional FAIL                                       → FAIL
Any Test FAIL                                             → FAIL
```

### Fallback Tasks

| Check | Pass Requirement | Failure Impact |
|-------|-----------------|----------------|
| **Core change** | Must be implemented | Missing → FAIL |
| **Tests pass** | Existing tests must pass | Test failure → FAIL |
| **Linter** | No new violations | New violations → PARTIAL |
| **No regressions** | Nothing else broken | Regression → FAIL |

---

## Failure Escalation Format

When verification results in PARTIAL or FAIL, structure the report:

```
VERIFICATION REPORT: {PASS|PARTIAL|FAIL}

CRITERIA RESULTS:
  Functional: ({passed}/{total})
  ✓ Schema defined with all required fields
  ✗ Indexes created for email lookup
    → Index creation code exists but migration not run

  Edge Cases: ({passed}/{total})
  ✓ Handle duplicate email constraint violation
  ○ Support maximum email length - SKIPPED (not applicable)

  Error Handling: ({passed}/{total})
  ✓ Clear error messages for constraint violations

  Performance: ({passed}/{total} or N/A)
  N/A - No performance criteria specified

TEST RESULTS:
  Ran: {total} tests
  Passed: {passed}
  Failed: {failed}
  {If failures:}
  Failures:
    - test_name: {error message}

RECOMMENDATIONS:
  - {Specific action to fix the failure}
  - {Alternative approach if primary fix is complex}
```

### Status Symbols

Use consistent symbols in verification reports:

| Symbol | Meaning |
|--------|---------|
| `✓` | Criterion passed |
| `✗` | Criterion failed |
| `○` | Criterion skipped (not applicable) |

---

## Retry Context

When a task is being retried after a previous failure, the orchestrator provides failure context from the previous attempt. Use this information to:

1. **Understand what failed**: Review the previous verification report
2. **Avoid repeating mistakes**: Check if the same approach was already tried
3. **Try a different approach**: If the previous fix didn't work, consider alternatives
4. **Focus on failures**: Only address the specific criteria that failed; don't redo passing work unless regressions occurred
5. **Check execution context**: Read `.agents/sessions/__live_session__/execution_context.md` for any learnings from the previous attempt
6. **Clean up before fixing**: Check for partial changes from the previous attempt. Run linter and tests to assess codebase state before adding new changes. Revert incomplete artifacts if they would interfere with the fix.
