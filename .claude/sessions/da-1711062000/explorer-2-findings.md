## Explorer 2 Findings: SDD Pipeline & Task Execution

### Pipeline Overview
Three-stage: create-spec → create-tasks → execute-tasks

### create-spec (5 phases)
- Interview-driven with mandatory `question` tool
- Three depths: high-level, detailed, full-tech
- Codebase exploration support via code-exploration skill
- Proactive recommendation system with keyword triggers

### create-tasks (10 phases)
- Extracts features (Section 5) + phases (Section 9) from spec
- Standard layer decomposition: Data Model → API/Service → Business Logic → UI → Tests
- Automatic DAG dependency inference
- Producer-consumer detection (produces_for metadata)
- Phase-aware status: selected phases → pending/; future → backlog/
- Idempotent merge via task_uid composite key
- Output: .agents/tasks/{status}/{group}/task-NNN.json

### execute-tasks (9-step orchestration)
- Topological wave plan from blocked_by DAG
- Wave-based parallelism (up to max_parallel, default 5)
- Session management in .agents/sessions/__live_session__/
- poll-for-results.sh (15s interval, 45min timeout) for completion detection
- Result file existence (result-{id}.md) as sole completion signal
- Context sharing via execution_context.md + per-agent context-{id}.md files

### task-executor agent (4 phases)
- Understand → Implement → Verify → Complete
- Structured acceptance_criteria: functional (blocking), edge_cases/error_handling/performance (non-blocking)
- File movement = status transition (pending → in-progress → completed)
- Writes context file FIRST, result file LAST (ordering protocol)

### Key Properties
1. Entirely file-based — no harness-specific task tools
2. Hub-and-spoke within waves
3. File-as-state-machine (directory = status)
4. Result file protocol (compact ~18-line signals)
5. Context compaction rules (200+ lines: summarize; 500+: selective reads)

### Gap Identified
produces_for field documented but injection step not explicit in orchestration.md
