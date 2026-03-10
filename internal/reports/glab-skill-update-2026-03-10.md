# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-03-10 |
| **Time** | 09:28 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | aaabbe1 |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: Update glab CLI skill with coverage for 21 missing commands

**Summary**: Expanded the glab skill with 3 new reference files covering runners, schedules, jobs, tokens, deploy keys, incidents, and changelogs. Fixed minor inaccuracies in 3 existing reference files and updated SKILL.md with new quick patterns, command index entries, and an Additional Commands table for 16 niche/experimental commands.

## Overview

- **Files affected**: 7
- **Lines added**: +857
- **Lines removed**: -6
- **Commits**: 0 (all changes uncommitted)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `skills/glab/references/runners-schedules.md` | Added | +319 | New reference for runner, schedule, and job commands |
| `skills/glab/references/tokens-keys.md` | Added | +263 | New reference for token, deploy-key, ssh-key, and gpg-key commands |
| `skills/glab/references/incidents-changelog.md` | Added | +208 | New reference for incident and changelog commands |
| `skills/glab/SKILL.md` | Modified | +67 / -6 | Expanded description, quick patterns, command index, and additional commands table |
| `skills/glab/references/auth-config.md` | Modified | +2 | Added missing environment variables |
| `skills/glab/references/issues.md` | Modified | +1 | Added missing --recover flag |
| `skills/glab/references/project-management.md` | Modified | +5 | Added --personal flag and example to snippet create |

## Change Details

### Added

- **`skills/glab/references/runners-schedules.md`** — New reference file covering `glab runner` (list, assign, unassign, update, delete), `glab schedule` (create, list, run, update, delete), and `glab job` (artifact). Includes subcommand tables, key flags, examples, and common workflows for nightly builds, runner management, and artifact downloads.

- **`skills/glab/references/tokens-keys.md`** — New reference file covering `glab token` (create, list, revoke, rotate), `glab deploy-key` (add, list, get, delete), `glab ssh-key`, and `glab gpg-key`. Includes token scope reference table, examples for CI/CD deploy key setup, and token rotation workflows.

- **`skills/glab/references/incidents-changelog.md`** — New reference file covering `glab incident` (list, view, close, reopen, note, subscribe, unsubscribe) and `glab changelog` (generate). Includes incident response workflow and release changelog generation examples.

### Modified

- **`skills/glab/SKILL.md`** — Expanded frontmatter description and trigger phrases to cover runners, schedules, tokens, deploy keys, incidents, and changelogs. Added "Runners & Schedules" and "Tokens & Keys" quick pattern sections. Added 3 command aliases (runner ls, schedule ls, incident ls). Added 3 rows to Command Reference Index linking to new reference files. Added "Additional Commands" table with 16 entries for niche/experimental commands (duo, alias, user, stack, attestation, etc.). Added 3 new "When to Load References" bullets for infrastructure, security/credentials, and incident response.

- **`skills/glab/references/auth-config.md`** — Added `GLAB_CONFIG_DIR` and `GLAB_SEND_TELEMETRY` to the Behavior environment variables table.

- **`skills/glab/references/issues.md`** — Added `--recover` flag to the `issue create` Key Flags table for recovering draft issues from failed creations.

- **`skills/glab/references/project-management.md`** — Added `--personal` flag to the `snippet create` flags table and added an example showing personal snippet creation.

## Git Status

### Unstaged Changes

| Status | File |
|--------|------|
| Modified | `skills/glab/SKILL.md` |
| Modified | `skills/glab/references/auth-config.md` |
| Modified | `skills/glab/references/issues.md` |
| Modified | `skills/glab/references/project-management.md` |

### Untracked Files

- `skills/glab/references/incidents-changelog.md`
- `skills/glab/references/runners-schedules.md`
- `skills/glab/references/tokens-keys.md`

## Session Commits

No commits in this session. All changes are uncommitted.

## Notes

- The `publish` subcommand listed in `references/repositories.md` (line 22) was flagged for verification but left as-is pending `glab repo --help` confirmation.
- All files remain under the 500-line limit (largest: `runners-schedules.md` at 319 lines).
- All 11 reference file paths in the SKILL.md Command Reference Index have been verified to exist on disk.
