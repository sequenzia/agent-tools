# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-03-10 |
| **Time** | 10:12 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | 31f1b06 |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: glab skill reference file validation and correction

**Summary**: Validated all 11 glab CLI reference files against official GitLab CLI source documentation and corrected numerous inaccuracies including fabricated flags, wrong command syntax, and a non-existent `--state` flag used across multiple files.

## Overview

Comprehensive validation of the glab skill's reference files revealed critical errors that would cause AI agents to generate broken CLI commands. Corrections were verified against the official glab source docs at `gitlab.com/gitlab-org/cli/-/raw/main/docs/source/`.

- **Files affected**: 9
- **Lines added**: +207
- **Lines removed**: -111
- **Commits**: 0 (uncommitted)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `skills/glab/references/runners-schedules.md` | Modified | +85 / -54 | Major rewrite of runner list/update flags, job artifact syntax, schedule flags |
| `skills/glab/references/tokens-keys.md` | Modified | +37 / -20 | Fixed token create, deploy-key add, ssh-key add syntax |
| `skills/glab/references/project-management.md` | Modified | +29 / -13 | Fixed variable export, label edit flags, added milestone enhancements |
| `skills/glab/references/issues.md` | Modified | +14 / -7 | Removed --state, added boolean filter flags and enhancements |
| `skills/glab/references/incidents-changelog.md` | Modified | +13 / -7 | Removed --state, added boolean filter flags and enhancements |
| `skills/glab/references/merge-requests.md` | Modified | +10 / -5 | Removed --state, added boolean filter flags and enhancements |
| `skills/glab/references/repositories.md` | Modified | +8 / -5 | Fixed repo update flags (--defaultBranch, removed --visibility) |
| `skills/glab/SKILL.md` | Modified | +4 / -4 | Fixed Quick Patterns (job artifact, token create, deploy-key add) |
| `skills/glab/references/api.md` | Modified | +5 / -2 | Fixed output format (json/ndjson), added --include and --silent flags |

## Change Details

### Modified

- **`skills/glab/references/runners-schedules.md`** — Replaced 4 fabricated `runner list` flags (--status, --type, --tag, --all) with actual flags (--group, --instance, --output, --page, --per-page). Replaced 7 fabricated `runner update` flags with only valid flags (--pause, --unpause) plus API workarounds for advanced config. Fixed `job artifact` syntax from `<jobID>` to `<refName> <jobName>`. Fixed `--cron-timezone` to `--cronTimeZone`. Replaced `schedule update --variable` with `--create-variable`/`--update-variable`/`--delete-variable`. Updated all workflow examples.

- **`skills/glab/references/tokens-keys.md`** — Changed `token create --name` to positional name argument. Removed non-existent `--key` flag from `deploy-key add` and `ssh-key add`, replacing with positional key-file argument or stdin. Added missing `--expires-at` and `--usage-type` flags. Fixed all examples and workflow sections.

- **`skills/glab/references/project-management.md`** — Fixed `variable export` description (default is JSON, not KEY=VALUE; formats are json/export/env). Fixed `label edit --name` to `--new-name`. Added missing flags: `--description` for variables, `--instance` for variable list, `--priority` for labels, `--group`/`--project` for milestones. Added milestone list enhancements (--search, --show-id, --include-ancestors).

- **`skills/glab/references/issues.md`** — Removed non-existent `--state` flag from list command. Added `--closed` and `--all` boolean flags. Added `--order`, `--sort`, `--page`, `--per-page`, `--not-author`, `--not-assignee`, `--iteration` enhancements. Fixed all examples including workflow sections.

- **`skills/glab/references/incidents-changelog.md`** — Removed non-existent `--state` flag. Added `--closed`, `--all`, `--milestone`, `--not-label`, `--not-assignee`, `--confidential`, `--page`, `--per-page`. Fixed all examples and workflow sections.

- **`skills/glab/references/merge-requests.md`** — Removed non-existent `--state` flag. Added `--closed`, `--merged`, `--all` boolean flags. Added `--order`, `--sort`, `--page`, `--created-after`, `--created-before` enhancements. Fixed all examples.

- **`skills/glab/references/repositories.md`** — Fixed `--default-branch` to `--defaultBranch` (camelCase). Removed non-existent `--visibility` from repo update. Added API workaround for visibility changes.

- **`skills/glab/SKILL.md`** — Fixed Quick Patterns: `glab job artifact 123456` to `glab job artifact main build`; `glab token create --name "ci"` to `glab token create ci`; `glab deploy-key add --title "CI" --key "$(cat key.pub)"` to `glab deploy-key add key.pub --title "CI"`.

- **`skills/glab/references/api.md`** — Changed output format from "(text/json)" to "(json/ndjson)". Added `--include` and `--silent` flags. Added tip about ndjson for large datasets.

## Git Status

### Unstaged Changes

| Status | File |
|--------|------|
| M | `skills/glab/SKILL.md` |
| M | `skills/glab/references/api.md` |
| M | `skills/glab/references/incidents-changelog.md` |
| M | `skills/glab/references/issues.md` |
| M | `skills/glab/references/merge-requests.md` |
| M | `skills/glab/references/project-management.md` |
| M | `skills/glab/references/repositories.md` |
| M | `skills/glab/references/runners-schedules.md` |
| M | `skills/glab/references/tokens-keys.md` |

## Errors Corrected

### Critical (would produce broken commands)

| Error | Files Affected | Fix |
|-------|---------------|-----|
| `--state` flag doesn't exist for mr/issue/incident list | 3 reference files + examples | Replaced with `--closed`, `--merged`, `--all` boolean flags |
| `runner list` has 4 fabricated flags | runners-schedules.md | Replaced with actual flags (--group, --instance, etc.) |
| `runner update` has 7 fabricated flags | runners-schedules.md | Replaced with --pause/--unpause + API workarounds |
| `job artifact` takes refName + jobName, not job ID | runners-schedules.md, SKILL.md | Fixed syntax to `<refName> <jobName>` |
| `token create` name is positional, not --name flag | tokens-keys.md, SKILL.md | Changed to positional argument |
| `deploy-key add` / `ssh-key add` have no --key flag | tokens-keys.md, SKILL.md | Changed to positional key-file argument |
| `repo update --visibility` doesn't exist | repositories.md | Removed, added API workaround |
| `repo update --default-branch` wrong casing | repositories.md | Changed to `--defaultBranch` |
| `schedule create/update --cron-timezone` wrong casing | runners-schedules.md | Changed to `--cronTimeZone` |
| `schedule update --variable` doesn't exist | runners-schedules.md | Changed to --create-variable/--update-variable/--delete-variable |
| `api --output` doesn't support "text" | api.md | Changed to json/ndjson |
| `variable export` default is JSON, not KEY=VALUE | project-management.md | Fixed description and added format options |
| `label edit --name` should be `--new-name` | project-management.md | Fixed flag name |

### Files Validated With No Errors

- `skills/glab/references/auth-config.md`
- `skills/glab/references/ci-cd.md`
- `skills/glab/references/releases.md`
