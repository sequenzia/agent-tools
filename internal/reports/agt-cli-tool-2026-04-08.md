# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-04-08 |
| **Time** | 22:58 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | 09a8c03 |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: Add `agt` CLI tool for managing apps

**Summary**: Created a new TypeScript CLI tool (`agt`) at `apps/cli/` that provides unified app lifecycle management — start, stop, kill, status, logs, and list commands — with PID tracking, process group management, and tee logging. Also updated `.gitignore` and `CLAUDE.md` to document the new tool.

## Overview

- **Files affected**: 16
- **Lines added**: +710
- **Lines removed**: -1
- **Commits**: 0 (all changes uncommitted)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `apps/cli/package.json` | Added | +22 | CLI package config with Commander.js dependency and `agt` bin entry |
| `apps/cli/tsconfig.json` | Added | +16 | TypeScript config matching task-manager server conventions (ES2022, NodeNext) |
| `apps/cli/.gitignore` | Added | +2 | Ignore node_modules and dist |
| `apps/cli/src/index.ts` | Added | +25 | Entry point: shebang, Commander program setup, registers all 6 commands |
| `apps/cli/src/commands/start.ts` | Added | +118 | Start app in dev mode with process group spawning, tee logging, signal cleanup with 5s timeout |
| `apps/cli/src/commands/stop.ts` | Added | +51 | SIGTERM to process group with 5s wait-for-death polling |
| `apps/cli/src/commands/kill.ts` | Added | +33 | SIGKILL to process group for force kill |
| `apps/cli/src/commands/status.ts` | Added | +56 | Show running/stopped status with PID info and stale PID cleanup |
| `apps/cli/src/commands/logs.ts` | Added | +42 | Tail log file using system `tail` command for memory efficiency |
| `apps/cli/src/commands/list.ts` | Added | +28 | Discover and list apps from apps/ directory with running status |
| `apps/cli/src/lib/paths.ts` | Added | +53 | Repo root resolution via import.meta.url walk-up, .agt/ path helpers |
| `apps/cli/src/lib/discovery.ts` | Added | +52 | Auto-scan apps/ for subdirs with package.json containing dev script |
| `apps/cli/src/lib/process.ts` | Added | +97 | PID file CRUD, liveness checks, signal sending, process group kill |
| `apps/cli/src/lib/logger.ts` | Added | +41 | Tee stream: pipes child stdout/stderr to both terminal and log file |
| `apps/cli/src/lib/validate.ts` | Added | +9 | App name validation to prevent path traversal |
| `.gitignore` | Modified | +2 / -1 | Added `.agt/` to ignore CLI runtime state directory |
| `CLAUDE.md` | Modified | +37 | Added CLI Tool section documenting commands, setup, and key patterns |

## Change Details

### Added

- **`apps/cli/package.json`** — Package manifest for the CLI tool. Declares `commander` as the only runtime dependency, `tsx` and `typescript` as dev dependencies, and registers `agt` as a bin entry pointing to `./dist/index.js`.

- **`apps/cli/tsconfig.json`** — TypeScript configuration mirroring the task-manager server config: ES2022 target, NodeNext module system, strict mode, sourceMap enabled.

- **`apps/cli/.gitignore`** — Ignores `node_modules/` and `dist/` build output.

- **`apps/cli/src/index.ts`** — CLI entry point with `#!/usr/bin/env node` shebang. Creates Commander program with name `agt`, registers all 6 subcommands (start, stop, kill, status, logs, list), and calls `program.parse()`.

- **`apps/cli/src/commands/start.ts`** — The most complex command. Validates the app exists via discovery, checks for existing running instances (cleaning stale PIDs), spawns `npm run dev` with `detached: true` for process group management, tees child output to both terminal and log file, registers SIGINT/SIGTERM cleanup handlers with a 5-second timeout that escalates to SIGKILL.

- **`apps/cli/src/commands/stop.ts`** — Sends SIGTERM to the process group (not just the PID) to ensure the entire npm → concurrently → tsx/vite tree is signaled. Polls for up to 5 seconds to confirm process death before removing the PID file. Suggests `agt kill` if the process survives.

- **`apps/cli/src/commands/kill.ts`** — Sends SIGKILL to the process group for immediate termination. Warns that no graceful shutdown occurs.

- **`apps/cli/src/commands/status.ts`** — Checks PID files and verifies process liveness. Supports both single-app and all-apps modes. Cleans up stale PID files when found.

- **`apps/cli/src/commands/logs.ts`** — Uses system `tail` command to efficiently read the last N lines of a log file without loading the entire file into memory. Defaults to 50 lines with `-n` flag override.

- **`apps/cli/src/commands/list.ts`** — Uses the discovery module to find apps, displays each with a running/stopped indicator. Cleans stale PID files during listing.

- **`apps/cli/src/lib/paths.ts`** — Resolves the repo root by walking up from `import.meta.url` looking for a directory containing both `apps/` and `plugins/manifest.json` (dual marker for specificity). Provides path helpers for `.agt/`, PID files, log files, and app directories.

- **`apps/cli/src/lib/discovery.ts`** — Scans `apps/` for subdirectories containing `package.json` with a `scripts.dev` field. Filters out the `cli` directory itself. Provides `findApp()` lookup and `printUnknownAppError()` helper.

- **`apps/cli/src/lib/process.ts`** — PID file lifecycle management: write, read (with corrupt file detection), remove (idempotent). Process liveness check via `process.kill(pid, 0)`. Signal sending to both individual processes and process groups (negative PID for group kill with fallback).

- **`apps/cli/src/lib/logger.ts`** — Creates writable log file streams and provides a `tee()` function that pipes child process readable streams to both a terminal destination and a log file simultaneously.

- **`apps/cli/src/lib/validate.ts`** — Validates app names against `^[a-zA-Z0-9_-]+$` pattern to prevent path traversal attacks in commands that construct file paths from user input.

### Modified

- **`.gitignore`** — Added `.agt/` entry to ignore the CLI runtime state directory (PID files, log files) at the repo root.

- **`CLAUDE.md`** — Added a new "CLI Tool (`apps/cli/`)" section documenting the tech stack, all 6 commands, runtime state paths, key patterns (auto-discovery, tee logging, stale PID detection, signal cleanup), and setup/development instructions.

## Git Status

### Unstaged Changes

- `M  .gitignore` — Added `.agt/` to ignore list
- `M  CLAUDE.md` — Added CLI tool documentation section

### Untracked Files

- `apps/cli/` — Entire CLI tool directory (package.json, tsconfig.json, src/, .gitignore)

## Session Commits

No commits in this session. All changes are currently uncommitted.
