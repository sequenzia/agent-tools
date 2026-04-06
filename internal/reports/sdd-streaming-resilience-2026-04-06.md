# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-04-06 |
| **Time** | 14:33 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | 531a26c |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: SDD streaming resilience — fix EOF errors across all SDD workflow skills

**Summary**: Added streaming resilience to all 5 SDD workflow skills to prevent EOF errors when run in third-party coding agent harnesses. High-risk spec-generating skills (`create-spec`, `inverted-spec`, `analyze-spec`) received structural fixes with incremental compilation passes, while lower-risk skills (`execute-tasks`, `create-tasks`) received harness-hints metadata only.

## Overview

All changes address a single issue: third-party agent harnesses (Cursor, Cline, Windsurf, etc.) drop streaming connections during large output generation, causing EOF errors. The fix introduces incremental writing strategies and non-streaming metadata hints across the SDD plugin.

- **Files affected**: 8
- **Lines added**: +238
- **Lines removed**: -47

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `plugins/manifest.json` | Modified | +2 / -2 | Add Edit to allowed_tools for create-spec and inverted-spec |
| `plugins/sdd/skills/analyze-spec/SKILL.md` | Modified | +19 / -6 | Add harness-hints, streaming section, restructure Phases 5A/5B for per-section Edit |
| `plugins/sdd/skills/create-spec/SKILL.md` | Modified | +34 / -11 | Add Edit to allowed-tools, harness-hints, streaming section, incremental Phase 5 strategy |
| `plugins/sdd/skills/create-spec/references/compilation-and-principles.md` | Modified | +63 / -11 | Replace single-Write compilation with multi-pass incremental procedure |
| `plugins/sdd/skills/create-tasks/SKILL.md` | Modified | +3 / -0 | Add harness-hints metadata |
| `plugins/sdd/skills/execute-tasks/SKILL.md` | Modified | +3 / -0 | Add harness-hints metadata |
| `plugins/sdd/skills/inverted-spec/SKILL.md` | Modified | +35 / -14 | Add Edit to allowed-tools, harness-hints, streaming section, incremental Phase 5 strategy |
| `plugins/sdd/skills/inverted-spec/references/compilation-guide.md` | Modified | +79 / -3 | Replace Step 12 single-Write with multi-pass incremental procedure |

## Change Details

### Modified

- **`plugins/manifest.json`** — Added `"Edit"` to the `allowed_tools` arrays for both `create-spec` and `inverted-spec` entries, enabling the Edit tool for incremental section appending during spec compilation.

- **`plugins/sdd/skills/create-spec/SKILL.md`** — Added `Edit` to `allowed-tools` frontmatter. Added `harness-hints` metadata block with `prefer-non-streaming: true`. Added "Streaming & Harness Compatibility" section explaining mitigations. Rewrote Phase 5 to use depth-aware incremental compilation: 1 pass for high-level, 3 passes (Write + 2 Edits) for detailed, 4 passes (Write + 3 Edits) with a checkpoint question for full-tech.

- **`plugins/sdd/skills/create-spec/references/compilation-and-principles.md`** — Replaced the single-step compilation procedure with a multi-pass incremental writing strategy. Added Pass 1 (Write foundation), Pass 2 (Edit requirements), Pass 3 (Edit technical), Pass 4 (Edit closing, full-tech only), and a compilation checkpoint between Pass 2 and 3 for full-tech. Added Edit tool usage guidance for appending sections. Updated the presentation step with next-steps suggestions.

- **`plugins/sdd/skills/create-tasks/SKILL.md`** — Added `harness-hints` metadata with `prefer-non-streaming: true` and reason noting 50-100+ individual task file writes.

- **`plugins/sdd/skills/execute-tasks/SKILL.md`** — Added `harness-hints` metadata with `prefer-non-streaming: true` and reason noting long-running autonomous execution with session file accumulation.

- **`plugins/sdd/skills/inverted-spec/SKILL.md`** — Added `Edit` to `allowed-tools` frontmatter. Added `harness-hints` metadata block. Added "Streaming & Harness Compatibility" section. Rewrote Phase 5 to reference the incremental compilation strategy in the compilation guide, replacing the previous inline compilation steps and single Write call.

- **`plugins/sdd/skills/inverted-spec/references/compilation-guide.md`** — Replaced Step 12 (single "Write and Present") with a multi-pass incremental write procedure matching the create-spec pattern. Added single-pass path for high-level, multi-pass with Edit for detailed/full-tech, compilation checkpoint for full-tech, Edit tool usage guidance, and updated presentation step.

- **`plugins/sdd/skills/analyze-spec/SKILL.md`** — Added `harness-hints` metadata block. Added "Streaming & Harness Compatibility" section. Restructured Phase 5A (Auto-Implement All) to group findings by section and apply fixes per-section using Edit instead of a single batch Write rewrite. Applied the same restructuring to Phase 5B Step 4 (Apply Accepted Changes).

## Git Status

### Unstaged Changes

| Status | File |
|--------|------|
| M | `plugins/manifest.json` |
| M | `plugins/sdd/skills/analyze-spec/SKILL.md` |
| M | `plugins/sdd/skills/create-spec/SKILL.md` |
| M | `plugins/sdd/skills/create-spec/references/compilation-and-principles.md` |
| M | `plugins/sdd/skills/create-tasks/SKILL.md` |
| M | `plugins/sdd/skills/execute-tasks/SKILL.md` |
| M | `plugins/sdd/skills/inverted-spec/SKILL.md` |
| M | `plugins/sdd/skills/inverted-spec/references/compilation-guide.md` |

## Session Commits

No commits in this session. All changes are unstaged.
