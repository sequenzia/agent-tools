# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-03-24 |
| **Time** | 11:41 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | c8c3a3b |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: Add `inverted-spec` skill to SDD pipeline

**Summary**: Created a new `inverted-spec` workflow skill that reverse-engineers specifications from existing codebases through deep analysis, interactive feature curation, and gap-filling interview. Updated the SDD pipeline documentation and manifest to register the new skill as an alternate entry point alongside `create-spec`.

## Overview

This session added the `inverted-spec` skill to the SDD pipeline — a 5-phase workflow that analyzes an existing codebase via the `deep-analysis` skill, conducts an interactive "take this, leave this" curation interview, and generates a pipeline-compatible spec with provenance annotations (`[Inferred]`/`[Stated]`/`[Researched]`).

- **Files affected**: 6
- **Lines added**: +1,199
- **Lines removed**: -7
- **Commits**: 0 (all changes uncommitted)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `skills/sdd/inverted-spec/SKILL.md` | Added | +427 | Main 5-phase workflow entry point |
| `skills/sdd/inverted-spec/references/curation-interview.md` | Added | +328 | 4-stage interactive interview procedures |
| `skills/sdd/inverted-spec/references/compilation-guide.md` | Added | +222 | Header format, provenance annotations, 12-step compilation |
| `skills/sdd/inverted-spec/references/analysis-to-spec-mapping.md` | Added | +160 | Mapping tables: analysis findings to spec template sections |
| `skills/manifest.json` | Modified | +6 | Added inverted-spec entry to sdd category |
| `skills/sdd/README.md` | Modified | +62 / -7 | Updated pipeline overview, diagram, quick start, skill reference, file map |

## Change Details

### Added

- **`skills/sdd/inverted-spec/SKILL.md`** — Main workflow file defining the 5-phase process: Input & Context, Deep Analysis (delegates to `deep-analysis` skill), Interactive Curation Interview, Summary & Approval, and Spec Generation. Includes critical rules section (question tool mandate, plan mode behavior), execution strategy with dual path (subagent dispatch vs inline fallback), and reference file loading instructions. Follows create-spec's structural patterns with adapted frontmatter (`type: workflow`, trigger-phrase-rich description).

- **`skills/sdd/inverted-spec/references/curation-interview.md`** — Defines four interview stages: (A) Feature Curation — multi-select checklist of discovered features with "take this, leave this" interaction; (B) Gap-Filling — depth-dependent questions targeting information code cannot reveal (problem statement, personas, success metrics, business value); (C) Optional Research — offers external research via the `research` dispatcher for compliance, best practices, industry standards; (D) Assumption Validation — confirms inferences from analysis (architecture choices, tech stack, patterns). Includes question budgets per depth level (8-14 for high-level, 12-20 for detailed, 16-26 for full-tech).

- **`skills/sdd/inverted-spec/references/analysis-to-spec-mapping.md`** — Detailed mapping tables showing how each deep-analysis output (architecture overview, critical files, relationship map, patterns, challenges, recommendations, open questions) transforms into spec template sections across all three depth levels (high-level, detailed, full-tech). Includes special handling for the Codebase Context section (always populated in inverted specs), gap handling rules, and provenance tracking through the mapping process.

- **`skills/sdd/inverted-spec/references/compilation-guide.md`** — Defines the inverted-spec header format (`Spec Type: Inverted`, `Source:` field for codebase path), provenance annotation rules with five marker types (`[Inferred]`, `[Inferred — low confidence]`, `[Inferred, Adjusted]`, `[Stated]`, `[Researched]`), placement rules for markers, and a 12-step compilation procedure from template selection through final output.

### Modified

- **`skills/manifest.json`** — Added the `inverted-spec` entry to the `sdd` category skills array with type `workflow`, trigger-phrase-rich description, and `allowed_tools` matching create-spec.

- **`skills/sdd/README.md`** — Updated Pipeline Overview to show two entry points (`create-spec` for greenfield, `inverted-spec` for brownfield). Updated the Mermaid flowchart to include `inverted-spec` feeding into `analyze-spec` and `create-tasks`. Added Quick Start section "1b. Or: Reverse-Engineer a Spec from Code". Added Skill Reference section for inverted-spec with phase table, provenance annotation info, and key references. Updated File Map to include the new directory and files. Updated total file count from 33 to 37.

## Git Status

### Unstaged Changes

| Status | File |
|--------|------|
| Modified | `skills/manifest.json` |
| Modified | `skills/sdd/README.md` |

### Untracked Files

| File |
|------|
| `skills/sdd/inverted-spec/` (new directory with 4 files) |

## Session Commits

No commits in this session. All changes are uncommitted.
