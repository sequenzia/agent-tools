# SDD vs. TDD: An Agentic AI Perspective

**Date:** 2026-04-21
**Subject:** `plugins/sdd/` as a case study — how Spec-Driven Development compares to Test-Driven Development when AI coding agents produce 100% of the code.
**Scope:** This is a comparative methodology analysis, grounded in the actual mechanics of the `plugins/sdd/` pipeline (9 skills, 41 files). It assumes the team is operating in a fully-agentic mode: a human directs the work, AI agents write, test, and verify the code.

---

## 1. Executive Thesis

TDD is a **verification-first, incremental** discipline: write a failing test → make it pass → refactor. It is optimized for **continuous correctness** during implementation.

SDD, as implemented in `plugins/sdd/`, is an **intent-first, hierarchical** discipline: elicit requirements → produce a machine-executable spec → decompose into atomic dependency-aware tasks → execute each task with structured verification. It is optimized for **continuous alignment** between human intent and machine-generated code.

For agentic AI workflows these two are not opposed — **SDD is a superset that embeds TDD at the leaf nodes**. Every task in SDD carries a `testing_requirements` array and an `acceptance_criteria.functional` list; the 4-phase task executor (`Understand → Implement → Verify → Complete`) is effectively a structured red-green cycle, just one hierarchical level below the TDD surface. But the differences matter: SDD front-loads human attention into a single spec-review pass; TDD distributes human attention across every test. In a world where AI writes 100% of the code, SDD’s concentration of human judgment is usually the bigger win.

---

## 2. The Two Methodologies, Side by Side

### 2.1 Traditional TDD (Red-Green-Refactor)

The canonical loop:

```
1. Write a failing test for the smallest behavior increment
2. Write just enough code to pass it
3. Refactor
4. Repeat
```

TDD’s power comes from three properties:
- **Behavior is specified as executable tests**, not prose — no ambiguity.
- **Tests are written before code**, forcing the developer to think about the API surface first.
- **Every commit leaves the system green**, providing a continuous safety net.

TDD implicitly assumes:
1. The developer has the domain knowledge to pick the right next test.
2. Test granularity is small enough that each red-green cycle completes in minutes.
3. Refactoring is a conscious third step, not skipped.

### 2.2 SDD as Implemented in `plugins/sdd/`

SDD runs as a four-stage pipeline:

| Stage | Skill | Artifact produced |
|---|---|---|
| 1. Elicit | `create-spec` | `specs/SPEC-*.md` (5 phases: inputs → adaptive interview → recommendations → summary → compile) |
| 2. Audit (optional) | `analyze-spec` | `specs/SPEC-*.analysis.md` (4-dimension scoring: requirements, risk, quality, completeness) |
| 3. Decompose | `create-tasks` | `.agents/tasks/{status}/{group}/task-NNN.json` (10 phases: validate → depth detect → analyze → select phases → decompose → infer deps → detect producer-consumer → preview → write → error handling) |
| 4. Execute | `execute-tasks` or `execute-tasks-windsurf` | Modified source + `.agents/sessions/{id}/` archives |

Each task JSON contains (from `sdd-tasks/references/task-schema.md`):

```json
{
  "acceptance_criteria": {
    "functional": ["..."],
    "edge_cases": ["..."],
    "error_handling": ["..."],
    "performance": ["..."]
  },
  "testing_requirements": [
    { "type": "unit", "target": "..." },
    { "type": "integration", "target": "..." }
  ],
  "blocked_by": ["task-001"],
  "metadata": { "task_uid": "specs/SPEC-Auth.md:user-auth:model:001" }
}
```

Task verification uses the structured rule (`execute-tasks/references/verification-patterns.md`):

```
All Functional PASS + Tests PASS                          → PASS
All Functional PASS + Tests PASS + Edge/Error/Perf issues → PARTIAL
Any Functional FAIL or Test FAIL                          → FAIL
```

Only `PASS` moves the task file to `completed/`.

---

## 3. Where SDD Already Uses TDD Techniques

SDD does not abandon testing — it **prescribes it** at the task layer. The TDD loop lives inside Phase 2 and Phase 3 of the task-executor:

| TDD step | SDD analogue | Location in `plugins/sdd/` |
|---|---|---|
| Red — write failing test | `testing_requirements` enumerated in task JSON; task-executor Phase 2 writes tests before/alongside implementation | `create-tasks/references/testing-requirements.md`; `execute-tasks/references/execution-workflow.md` Phase 2 |
| Green — make it pass | Task-executor Phase 2 implements code until functional criteria pass | `execute-tasks/agents/task-executor.md` lines describing Phase 2 |
| Refactor — clean up | Not explicitly separated; relies on agent’s in-phase judgment (soft spot) | Implicit; no dedicated "refactor" phase |
| Run full suite | Task-executor Phase 3 runs the test suite; any FAIL blocks completion | `execute-tasks/references/verification-patterns.md` |
| Commit green | File move `in-progress/` → `completed/` is the atomic "commit"; the file-based state machine guarantees the system is green before advancement | `sdd-tasks/references/operations.md` (Task File Integrity Rule) |

**Key observation:** SDD leans on TDD for the **correctness** part and uses spec infrastructure for the **direction** part. The spec says *what* to build; TDD-style verification confirms *it was built correctly*.

There are also TDD-adjacent ideas that SDD adds:

- **4-category acceptance criteria** (`functional`, `edge_cases`, `error_handling`, `performance`) — richer than a single "test passes" signal. Essentially BDD-style scenarios pre-written by the spec author.
- **Producer-consumer metadata** (`produces_for`) — upstream task outputs are injected into downstream task context. This resembles contract testing across task boundaries.
- **Execution context as shared memory** — `execution_context.md` carries patterns, decisions, known issues across tasks. This is analogous to a living design doc updated during TDD, but SDD makes it explicit and file-based.

---

## 4. How the Two Methodologies Differ

### 4.1 Workflow shape

```
TDD:  test → code → test → code → test → code → ...  (flat, continuous)
SDD:  interview → spec → analyze → tasks → [wave 1: test+code+verify] → [wave 2] → ...  (hierarchical, gated)
```

TDD is **depth-first**: one behavior at a time, drill down until green, then move on. SDD is **breadth-first then depth-first**: lay out all behaviors in a spec, decompose into a DAG of tasks, execute waves in parallel, drill down inside each task.

### 4.2 Where human judgment is concentrated

- **TDD:** human judgment is distributed across every test — the developer is the authority on "is this the right next test?" at every step.
- **SDD:** human judgment is concentrated in Phase 2 of `create-spec` (the adaptive interview), Phase 4 of `analyze-spec` (resolution mode), and Phase 8 of `create-tasks` (preview & confirm). After `execute-tasks` begins, the skill explicitly marks itself "autonomous after confirmation."

When the human is slow and the AI is fast (the agentic scenario), SDD’s concentration is a feature — it minimizes blocking on human input.

### 4.3 Where testing lives

| Aspect | TDD | SDD |
|---|---|---|
| Who decides what to test | Developer, at write-time | Spec author + create-tasks decomposer (`testing-requirements.md`) |
| When tests are written | Before code, always | Same — `testing_requirements` in task JSON, task-executor Phase 2 |
| Granularity of tests | Micro: one behavior at a time | Macro: per-task, grouped as `unit`/`integration`/`e2e` |
| Failure response | Immediate — next iteration of red-green | Structured — PASS/PARTIAL/FAIL with retry up to `max_retries` |
| Test coverage signal | Green bar + tooling (coverage %) | Per-category acceptance criteria + manifest metadata |
| Refactor step | Explicit, post-green | Implicit, optional |

### 4.4 Dependency management

TDD is silent on dependencies — the developer orders their own work. SDD encodes dependencies in task JSON (`blocked_by`) and uses topological sorting to form parallelizable waves. This matters hugely for agent dispatch: you can run 5 unblocked tasks in parallel when they share no dependencies, which TDD’s serial loop cannot.

### 4.5 Memory and context

TDD relies on the developer’s head. SDD writes everything to disk — `execution_context.md`, `task_log.md`, `progress.md`, per-wave snapshots. This is the "file as external memory" pattern: agents can be compacted, swapped, or killed and the session can recover. TDD has no equivalent — lose the developer, lose the context.

---

## 5. Advantages and Disadvantages

### 5.1 TDD — Advantages

1. **Immediate feedback.** Agent writes a test, runs it, sees red, writes code, sees green. The loop is short, dopamine-reinforcing, and provably correct at every step.
2. **Emergent design.** API surface grows from how tests call the code. Fewer speculative abstractions.
3. **Minimal prose artifacts.** No spec document to maintain — tests are the spec.
4. **Friction against overreach.** Hard to silently implement unrequested features when every feature requires a written test first.
5. **Well-understood by LLM agents.** Decades of training data on TDD; agents produce competent red-green cycles.

### 5.2 TDD — Disadvantages (amplified in agentic settings)

1. **No direction at the macro level.** TDD tells you how to build each piece but not which pieces to build. An AI agent can happily grind through red-green cycles implementing the wrong thing.
2. **No dependency awareness.** Test A and Test B may be independent, but TDD workflow implies sequential execution. Agents cannot parallelize effectively.
3. **Refactoring is often skipped.** LLM agents, in particular, tend to declare victory at green and move on; the third step of the loop erodes.
4. **Continuous human checkpointing.** If the human reviews every test, the agent is blocked on humans constantly. If they don’t, the agent can drift undetected across dozens of tests.
5. **Weak at elicitation.** TDD has no vocabulary for "have I understood what the user wants?" — it assumes that’s solved before the loop starts.

### 5.3 SDD — Advantages (agentic setting)

1. **Explicit intent artifact.** The spec is a persistent, reviewable document. Humans can audit, diff, version, and share it without re-running the system.
2. **Parallelism by construction.** `blocked_by` DAG + wave dispatch lets 5+ tasks execute concurrently. Huge throughput advantage for large features.
3. **Minimal human touch-points.** One spec review, one analysis review (optional), one task preview confirmation — then autonomous execution. Matches agent speeds, not human speeds.
4. **Auditable state machine.** Every status transition is a file move; session archives are complete historical records. You can reconstruct exactly what happened in wave 3 of task-group `user-authentication` six months later.
5. **Structured verification at multiple levels.** 4-category acceptance criteria surface edge cases, error handling, and performance — categories TDD typically underweights.
6. **Cross-task memory.** `execution_context.md` lets later tasks benefit from patterns discovered in earlier tasks without burdening each prompt with full context.
7. **Depth-aware effort scaling.** High-level / detailed / full-tech tracks let you match ceremony to stakes.
8. **Anti-pattern enforcement.** `sdd-tasks/references/anti-patterns.md` encodes 9 failure modes (AP-01 through AP-09) — the plugin fights back against over-granular tasks, circular deps, status/directory mismatches, and field loss on writes. TDD has no equivalent codified playbook.

### 5.4 SDD — Disadvantages

1. **High upfront cost.** Running `create-spec` end-to-end can take 20-60 minutes of interview. For a 1-hour bug fix this is absurd.
2. **Spec can lie.** A spec says what you intended to build, not what the code does. If the spec and code drift, you have two sources of truth.
3. **Brittle at edges.** The plugin itself has undeclared cross-plugin deps on `core-tools` (`code-explorer`, `deep-analysis`), no schema validator for task JSON, and boilerplate duplication across SKILL.md files. A real-world user of SDD inherits these risks.
4. **Refactoring story is weaker than TDD.** No explicit refactor step; emergent design is harder because the API is spec’d up front.
5. **Over-reliance on spec author.** If the spec is ambiguous or wrong, the entire downstream pipeline produces wrong code. TDD catches this at the first failing test; SDD catches it only at task verification — often deeper.
6. **Tool-chain sprawl.** `.agents/tasks/`, `.agents/sessions/`, `execution_context.md`, `result-{id}.md`, `context-{id}.md`, group manifests, lock files — significant cognitive overhead compared to "just write tests."
7. **Agent-crash failure mode.** If a subagent dies before writing `result-{id}.md`, retry has no failure details (documented risk C7 in the main analysis). TDD’s simpler loop has no equivalent zombie state.

---

## 6. Scenario-Based Guidance

### 6.1 Use TDD when:

- **Bug fixes.** One failing test = the bug. Make it green. Done. SDD’s spec-first ceremony is pure overhead.
- **Adding a single method to an existing class.** Clear API, clear expected behavior — write the test, fill the body, move on.
- **Exploratory coding with unclear direction.** When the engineer is genuinely learning the domain, TDD’s emergent design is faster than trying to spec ahead.
- **Small teams, small scope.** One agent + one human, working on <5 files.
- **Refactoring-heavy work.** TDD’s explicit refactor step and green-bar guarantee protect behavior during structural change. SDD has no dedicated refactor pattern.

### 6.2 Use SDD when:

- **Greenfield features with unknown scope.** The interview surface is actually useful for figuring out what to build. (This is exactly what `create-spec` Phase 2 is for.)
- **Multi-agent parallel execution.** Any time you have >3 parallelizable tasks, SDD’s wave-based dispatch dramatically outpaces sequential TDD loops.
- **Compliance-heavy domains.** `analyze-spec` flags missing auth/privacy/security and runs research via the `researcher` agent on HIPAA/GDPR/PCI/SOC 2/WCAG triggers. TDD has no hooks for compliance.
- **Handoffs across time or teams.** Specs and task archives are persistent; verbal TDD context is not.
- **Large integrations.** An integration feature with 12 tasks across API / model / middleware / UI / tests benefits from explicit `produces_for` metadata.
- **AI-heavy autonomous runs.** When you want to start an agent swarm and come back in two hours, SDD’s "autonomous after confirmation" contract is exactly what you want.
- **Reverse-engineering documentation.** `inverted-spec` has no TDD equivalent — you cannot retrofit tests to produce a requirements document.

### 6.3 A composite recommendation

In practice, strong agentic workflows use **SDD at the macro level and TDD at the micro level**:

```
create-spec → analyze-spec → create-tasks → execute-tasks
                                                    ↓
                                          (inside each task:
                                          Phase 2 implements using a
                                          TDD-style red-green loop
                                          against testing_requirements
                                          and acceptance_criteria)
```

The `execute-tasks/agents/task-executor.md` 4-phase workflow already admits this composition. The improvement opportunity is making it **explicit**: add language in `execution-workflow.md` Phase 2 saying "Write tests first, confirm they fail, then implement" rather than the current implicit ordering.

---

## 7. Agentic-Specific Considerations

When AI produces 100% of the code, four concerns dominate:

### 7.1 Alignment of intent

Humans are much slower readers than writers, and much slower than AI at either. The ratio of **"minutes of AI coding per minute of human review"** determines practical throughput. TDD demands review of every test (high human-touch); SDD demands review of the spec, analysis, and task preview (three high-quality checkpoints). SDD wins on touch-point economy. *If you can only afford to review N pages, make N pages count.*

### 7.2 Recoverability

AI agents can die, hallucinate, timeout, or produce garbage. A methodology that survives partial agent failure is strictly better.
- TDD has no explicit recovery story — if the agent writes a broken test and lies about it, nothing catches it until next human review.
- SDD uses atomic file moves, status/directory authority, `result-{id}.md` as completion signal, session archival, and lock files. Many things can go wrong and be detected.

### 7.3 Parallelism

Humans are inherently sequential. AI agents are not. TDD’s serial loop wastes agent throughput. SDD’s wave-based DAG dispatch is natively parallel. For the same hardware budget, SDD often delivers >3× the effective throughput on features with >5 tasks.

### 7.4 Quality drift

Both methodologies are vulnerable to silent quality drift — agents writing code that passes the metric but misses the intent. SDD fights drift with:
- Structured `acceptance_criteria.functional`, which is harder to game than a single boolean test.
- `analyze-spec` as an explicit audit stage.
- `execution_context.md` that makes patterns and decisions explicit across tasks.

TDD fights drift with:
- Coverage reports.
- Frequent human review.

In a 100%-AI setting, SDD’s structural artifacts are auditable after the fact; TDD’s real-time review requirement becomes a bottleneck.

---

## 8. Recommendations for an SDD+TDD-Aware AI Workflow

Based on the state of `plugins/sdd/` and the analysis above:

1. **Make TDD explicit inside task-executor Phase 2.** Add "Write failing tests first; confirm they fail; then implement." to `execute-tasks/references/execution-workflow.md`. Today this is implicit and easily skipped.
2. **Add a refactor sub-phase.** Insert a short refactor step between Phase 2 and Phase 3, or inside Phase 3 (before verification). Mirrors TDD’s third step, which today has no SDD home.
3. **Allow TDD-scale bypass of SDD.** For bug-fix or single-method tasks, allow `create-tasks` to produce a single minimal task that skips decomposition. Today the 10-phase create-tasks ceremony is heavy for small work.
4. **Harden schema validation.** Add a pre-write validator in `create-tasks` (risk C2 in the main analysis). This is the SDD equivalent of "make sure your test is well-formed before it runs."
5. **Document explicit anti-patterns for AI agents.** Extend `sdd-tasks/references/anti-patterns.md` with agent-specific failure modes: lying about green tests, skipping refactor, writing over-specified edge-case tests that pin implementation details, etc.
6. **Integrate `produces_for` with test-fixture injection.** If task A produces for task B, auto-inject task A’s result fixtures into task B’s test environment. Today `produces_for` is metadata only.
7. **Add a "red baseline" wave before each execution wave.** Run tests first, confirm expected failures match `testing_requirements`, then proceed. Catches specs that promise behavior already implemented or already broken.

---

## 9. Summary Table

| Dimension | TDD | SDD (plugins/sdd/) | Winner for Agentic AI |
|---|---|---|---|
| Upfront cost | Very low | High (spec interview) | TDD for <1h work, SDD for >4h work |
| Time to first running code | Minutes | 30-60 min | TDD |
| Human attention required | Continuous | Concentrated (3 gates) | SDD |
| Parallelism | None (serial) | Wave-based DAG | SDD |
| Recoverability from agent failure | Poor | Strong (file-based state) | SDD |
| Correctness of individual units | Excellent | Excellent (uses TDD inside) | Tie |
| Alignment with stated requirements | Weak (tests ≠ requirements) | Strong (spec + analysis) | SDD |
| Refactoring discipline | Explicit | Implicit / weaker | TDD |
| Fits bug fixes | Excellent | Overkill | TDD |
| Fits greenfield features | Weak | Excellent | SDD |
| Fits compliance-heavy work | Weak | Good (researcher + analyze-spec triggers) | SDD |
| Auditability after the fact | Weak (tests + git log) | Strong (specs + sessions + context) | SDD |
| Cost per human review minute | Low productivity | High productivity | SDD |
| Tooling complexity | Low | High | TDD |
| Maturity as practice | Decades | Emerging | TDD |

---

## 10. Closing Thought

TDD was designed for humans writing code under deadline pressure, where the bottleneck is correctness. SDD, as embodied in `plugins/sdd/`, is designed for humans directing AI under ambition pressure, where the bottleneck is alignment. Neither replaces the other — the strongest agentic workflows wrap TDD’s tight local correctness loop inside SDD’s structured global direction loop.

The `plugins/sdd/` plugin is a working instance of this integration: ambitious in its spec-to-execution vision, pragmatic in its file-based state machine, and honest enough to codify its own anti-patterns. Its weakest seam today is precisely at the TDD boundary — Phase 2 of the task-executor would benefit from explicit red-first language, and the refactor step deserves a dedicated home. Both are easy fixes.

As AI agents take on more of the coding, the premium shifts from "is this test passing?" to "is the system doing what the user meant?" SDD was built for that question. TDD is a powerful tactic in service of it — not a competing strategy.
