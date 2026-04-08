# Codebase Changes Report

## Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-04-07 |
| **Time** | 21:30 EDT |
| **Branch** | main |
| **Author** | Stephen Sequenzia |
| **Base Commit** | 192f25b |
| **Latest Commit** | uncommitted |
| **Repository** | git@github.com:sequenzia/agent-tools.git |

**Scope**: Unify project management system in task-manager app

**Summary**: Replaced the dual project management system (a legacy single-path hook + an in-memory multi-project Zustand store) with a single persisted multi-project store. Removed the legacy `useProjectDirectory` hook, redesigned the header to show project name only, added backend multi-project CRUD endpoints with auto-migration, and applied a full sidebar UX polish pass.

## Overview

- **Files affected**: 10
- **Lines added**: +442
- **Lines removed**: -538
- **Commits**: 0 (all changes uncommitted)

## Files Changed

| File | Status | Lines | Description |
|------|--------|-------|-------------|
| `apps/task-manager/server/routes/projects.ts` | Modified | +136 / -74 | Replaced legacy single-path endpoints with multi-project CRUD + auto-migration |
| `apps/task-manager/server/types.ts` | Modified | +10 / -0 | Added `ProjectListResponse` and `AddProjectResponse` types |
| `apps/task-manager/server/watcher.ts` | Modified | +1 / -1 | Fixed pre-existing lint error (`let` to `const` for state) |
| `apps/task-manager/src/App.tsx` | Modified | +48 / -100 | Removed legacy hook, sync effect, header input form; simplified to store-based init |
| `apps/task-manager/src/components/ProjectSidebar.tsx` | Modified | +40 / -27 | UX polish: spacing, dark mode, collapsed mode badges, focus-visible outlines |
| `apps/task-manager/src/hooks/use-project-directory.ts` | Deleted | -104 | Legacy single-path hook — no longer needed |
| `apps/task-manager/src/services/__tests__/project-directory.test.ts` | Modified | +73 / -106 | Rewrote tests for new multi-project service functions |
| `apps/task-manager/src/services/api-client.ts` | Modified | +3 / -1 | Added optional `body` parameter to `api.delete()` |
| `apps/task-manager/src/services/project-directory.ts` | Modified | +41 / -57 | Replaced legacy functions with `loadProjects`, `addProjectPath`, `removeProjectPath`, `persistActiveProject` |
| `apps/task-manager/src/stores/project-store.ts` | Modified | +90 / -68 | Added `initialize()`, `addProjectFromPath()`, backend persistence, always-active logic |

## Change Details

### Modified

- **`server/routes/projects.ts`** — Replaced the legacy single `projectPath` persistence model with a multi-project system. New endpoints: `GET /api/projects` (list all), `POST /api/projects` (add with validation), `DELETE /api/projects` (remove with always-active auto-selection), `PUT /api/projects/active` (set active). Added automatic migration that converts old `projectPath` field to `projects[]` on first read. Removed legacy `/api/projects/saved` and `/api/projects/save` endpoints.

- **`server/types.ts`** — Added `ProjectListResponse` (`projects: string[]`, `activeProjectPath: string | null`) and `AddProjectResponse` (`ok: boolean`, `has_tasks_dir: boolean`) interfaces for the new endpoints.

- **`server/watcher.ts`** — Fixed a pre-existing ESLint `prefer-const` error: `let state` changed to `const state` since the variable is never reassigned (the Map values inside are mutated, not the binding itself).

- **`src/App.tsx`** — Major simplification. Removed: `useProjectDirectory` hook and all 7 values it provided, the sync `useEffect` that bridged the two project systems, `currentProjectPath` fallback logic, `directoryInput` state and the header input form, the standalone `DirectoryBrowser` modal, warning/error bars from the old hook. Added: `initialize()` call on mount, `initError` displayed as toast. Header now shows only the active project's directory name with full path as a hover tooltip. Empty state message updated to guide users to the sidebar.

- **`src/components/ProjectSidebar.tsx`** — UX polish pass: standardized padding from mixed `px-3`/`px-2` to consistent `px-4` across header, items, groups, and footer. Fixed dark mode consistency by changing sidebar header from indigo (`dark:bg-indigo-950/20`) to gray palette (`dark:bg-gray-800/30`). Improved collapsed mode with task count badges (absolute-positioned on project initials) and multi-line tooltips showing project name + per-status counts. Added `focus-visible:ring-2` keyboard navigation outlines to all interactive elements. Added `title` attribute to expanded settings button.

- **`src/services/__tests__/project-directory.test.ts`** — Rewrote test suite for the new service API. Tests now cover `loadProjects`, `addProjectPath`, `removeProjectPath`, and `persistActiveProject` instead of the removed legacy functions. Kept `validateProjectDirectory` tests unchanged.

- **`src/services/api-client.ts`** — Added optional `body` parameter to `api.delete()` method, including `Content-Type: application/json` header and `JSON.stringify(body)` when body is provided. Needed for `DELETE /api/projects` which sends `{ path }` in the request body.

- **`src/services/project-directory.ts`** — Complete rewrite. Replaced 6 legacy functions (`saveProjectPath`, `getSavedProjectPath`, `clearSavedProjectPath`, `validateAndSaveProjectDirectory`, `loadProjectOnStartup`) with 4 new ones: `loadProjects()` (GET all projects + active), `addProjectPath()` (POST to add), `removeProjectPath()` (DELETE to remove), `persistActiveProject()` (PUT active selection). Kept `validateProjectDirectory()` unchanged.

- **`src/stores/project-store.ts`** — Added `isInitialized`, `isLoading`, `initError` state fields. Added `initialize()` action that loads persisted projects from backend, validates each path's connectivity in parallel via `Promise.all`, restores active project with fallback to first connected project. Added `addProjectFromPath(path)` convenience action that validates, persists, adds to store, and sets active. Modified `removeProject()` and `setActiveProject()` to persist changes to backend (fire-and-forget with `.catch(() => {})`). Enforced always-active rule: removing the active project auto-selects the next connected one.

### Deleted

- **`src/hooks/use-project-directory.ts`** — The legacy single-project hook that managed one `projectPath` via React `useState`. All its responsibilities (loading, saving, clearing, validating) are now handled by `useProjectStore.initialize()` and the rewritten service functions.

## Git Status

### Unstaged Changes

| Status | File |
|--------|------|
| Modified | `apps/task-manager/server/routes/projects.ts` |
| Modified | `apps/task-manager/server/types.ts` |
| Modified | `apps/task-manager/server/watcher.ts` |
| Modified | `apps/task-manager/src/App.tsx` |
| Modified | `apps/task-manager/src/components/ProjectSidebar.tsx` |
| Deleted | `apps/task-manager/src/hooks/use-project-directory.ts` |
| Modified | `apps/task-manager/src/services/__tests__/project-directory.test.ts` |
| Modified | `apps/task-manager/src/services/api-client.ts` |
| Modified | `apps/task-manager/src/services/project-directory.ts` |
| Modified | `apps/task-manager/src/stores/project-store.ts` |

## Session Commits

No commits in this session. All changes are uncommitted.
