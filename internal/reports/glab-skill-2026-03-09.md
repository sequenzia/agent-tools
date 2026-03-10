# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-03-09 |
| **Time** | 22:35 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | 1fd307b |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: New `glab` skill — GitLab CLI reference for AI coding agents

**Summary**: Created a new skill providing comprehensive, practical guidance for AI agents to interact with GitLab through the `glab` CLI tool. The skill consists of a routing SKILL.md and 8 reference files organized by command group.

## Overview

- **Files affected**: 9
- **Lines added**: +2,287
- **Commits**: 0 (all changes untracked)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `skills/glab/SKILL.md` | Added | +155 | Main skill file with quick patterns, cross-cutting patterns, and reference routing table |
| `skills/glab/references/auth-config.md` | Added | +217 | Authentication methods, configuration settings, environment variables, and global flags |
| `skills/glab/references/merge-requests.md` | Added | +340 | MR creation, review, approval, merge workflows with key flags and examples |
| `skills/glab/references/issues.md` | Added | +267 | Issue creation, listing, triage, and management with filtering patterns |
| `skills/glab/references/ci-cd.md` | Added | +326 | Pipeline monitoring, triggering, debugging, CI config validation |
| `skills/glab/references/repositories.md` | Added | +278 | Repository cloning, forking, creation, and batch operations |
| `skills/glab/references/releases.md` | Added | +155 | Release creation with assets, download, and milestone linking |
| `skills/glab/references/api.md` | Added | +234 | REST v4 and GraphQL API requests, pagination, jq filtering |
| `skills/glab/references/project-management.md` | Added | +315 | CI/CD variables, labels, milestones, and snippets |

## Change Details

### Added

- **`skills/glab/SKILL.md`** — Main skill entry point following GAS format. Contains YAML frontmatter with trigger description, quick patterns for common one-liners (MR create, issue list, CI status), cross-cutting patterns (--output json, -R flag, --yes), and a command reference index routing agents to the appropriate reference file.

- **`skills/glab/references/auth-config.md`** — Covers `glab auth login` (OAuth, PAT, CI job token, keyring), `glab auth status`, `glab config set/get/edit`, all configuration keys, environment variables with precedence rules, and global flags. Includes workflows for first-time setup, multi-host configuration, and CI/CD environments.

- **`skills/glab/references/merge-requests.md`** — Comprehensive coverage of all 19 `glab mr` subcommands. Detailed sections for create (--fill, --draft, --push), list (filters), view, checkout, diff, approve/revoke, merge (--squash, --auto-merge), update, note, and rebase. Includes workflows for creating, reviewing, and merging MRs.

- **`skills/glab/references/issues.md`** — Covers all 11 `glab issue` subcommands. Detailed create flags (--label, --milestone, --epic, --confidential), list filtering (--state, --search, --not-label), update, close/reopen, note, board, and subscribe. Includes triage and issue-to-MR linking workflows.

- **`skills/glab/references/ci-cd.md`** — Covers all 13 `glab ci` subcommands. Detailed sections for status (--live), view (keyboard controls), trace (real-time log streaming), run (--variables, --input), lint (--dry-run, --include-jobs), retry, and cancel. Includes workflows for debugging failures, validating CI config, and triggering deployments.

- **`skills/glab/references/repositories.md`** — Covers all 14 `glab repo` subcommands. Detailed clone section with batch group cloning (--group, --preserve-namespace, --paginate), create, fork (--clone), view, list, search, members, archive, delete, transfer, update, and mirror. Includes fork-and-contribute and batch clone workflows.

- **`skills/glab/references/releases.md`** — Covers all 6 `glab release` subcommands. Detailed create section with file assets (positional args), --notes-file, --milestone, --assets-links JSON format. Includes release-with-assets and CI release workflows.

- **`skills/glab/references/api.md`** — Covers `glab api` for REST v4 (GET/POST/PUT/DELETE with :id substitution) and GraphQL (queries with variables). Sections on --jq filtering, --paginate, and common API patterns for project administration, cross-project queries, and pipeline data.

- **`skills/glab/references/project-management.md`** — Bundles four smaller command groups: variables (set/list/get/export/update/delete with --masked, --protected, --scope), labels (create/list/edit/delete with --color), milestones (create/list/edit/delete with dates), and snippets (create). Includes CI variable setup and label taxonomy workflows.

## Git Status

### Untracked Files

```
skills/glab/SKILL.md
skills/glab/references/api.md
skills/glab/references/auth-config.md
skills/glab/references/ci-cd.md
skills/glab/references/issues.md
skills/glab/references/merge-requests.md
skills/glab/references/project-management.md
skills/glab/references/releases.md
skills/glab/references/repositories.md
```

## Session Commits

No commits in this session. All changes are untracked new files.
