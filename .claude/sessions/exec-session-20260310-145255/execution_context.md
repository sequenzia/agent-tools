# Execution Context

## Project Patterns
- GAS skill files: SKILL.md in skills/{skill-name}/; name + description required in frontmatter
- Numbered sections with subsections; HTML comments serve as section placeholders
- Prompt templates use Handlebars-style `{{variable}}` syntax with `{{#if}}` conditionals
- Finding schema (9 fields): file_path, line_start, line_end, severity, category, source, description, context, suggested_action
- Report template uses quadruple-backtick fencing for nested markdown code blocks
- Line-level comments use `glab api` with `-f "position[field]=value"` nested syntax
- Summary notes use `glab mr note` (not `glab api`)
- Concurrent edits require re-reads (expected, cleanly resolved)

## Key Decisions
- No test suite; verification is manual
- Only Critical/High findings get line-level comments; Medium/Low batched in summary note
- Section 6 (output selection) logically executes between Section 1 and Section 7 in pipeline

## Known Issues
- Concurrent file edits on `skills/mr-reviewer/SKILL.md` require re-read/retry cycles (file now ~2290+ lines)

## File Map
- `skills/mr-reviewer/SKILL.md` — MR reviewer skill (~2290+ lines): All sections 1-9 complete. Section 5.3 (~210 lines) consolidates comment error handling. Section 6 (~65 lines) output action selection. Only references/ pending.
- `internal/specs/mr-reviewer-skill-SPEC.md` — MR Reviewer skill specification

## Task History
### Wave 1-3 Summary (13/13 PASS)
Created skill scaffold, spec analysis, subagent sections, MR input, schema/merge, depth, large MR, error handling.

### Wave 4 Summary (3/3 PASS)
Tasks 30, 33, 34. Report generation, line-level comments, summary note posting.

### Task [35]: Write comment error handling and fallback section - PASS
- ~210 lines (5.3.1-5.3.6): position fallback, rate limiting, force push, individual failure, glab CLI errors, completion confirmation

### Task [32]: Write output action selection section - PASS
- ~65 lines (6.1-6.4): options table, pipeline flow, per-option execution, default behavior
