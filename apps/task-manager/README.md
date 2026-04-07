# Task Manager

Desktop application for visualizing and managing SDD (Spec-Driven Development) pipeline tasks. Built with Tauri 2.x + React 19.

## Architecture

Two-tier architecture: a Rust backend handles file I/O, OS dialogs, and file watching. A React 19 frontend handles visualization and interaction. Communication flows through Tauri's IPC invoke mechanism.

The filesystem is the source of truth — tasks are JSON files in `.agents/tasks/{status}/{group}/task-N.json`. The app watches for external changes (from Claude Code agents) and reconciles in real-time.

### Data Flow

```
Filesystem → Rust (serde parse) → IPC invoke → Service (Zod validate) → Zustand Store → React Component
```

### Backend (Rust)

7 modules exposing 24 IPC commands:

| Module | Commands | Purpose |
|--------|----------|---------|
| `lib.rs` | 9 | Project/settings management, app setup |
| `tasks.rs` | 6 | Task CRUD, status transitions, conflict detection |
| `specs.rs` | 3 | Spec reading, lifecycle tracking |
| `session.rs` | 5 | Live/archived session monitoring |
| `watcher.rs` | 4 | Dual-threaded file watching (tasks + sessions) |
| `discovery.rs` | 1 | BFS project auto-discovery |

### Frontend (React + TypeScript)

| Layer | Count | Purpose |
|-------|-------|---------|
| Components | 21 | UI rendering (KanbanBoard, TaskDetailPanel, etc.) |
| Services | 13 | IPC bridge (typed wrappers around `invoke()`) |
| Hooks | 11 | Event subscriptions, polling, state derivation |
| Stores | 8 | Zustand v5 state management (no middleware) |
| Types | 3 | Zod schemas as source of truth |

## Tech Stack

- **Backend**: Rust (Tauri 2.x), chrono, notify-debouncer-mini, serde_json
- **Frontend**: React 19, TypeScript 5.8, Zustand v5, Zod v4, dnd-kit v6, react-markdown
- **Styling**: Tailwind CSS v4 (dark mode supported)
- **Tooling**: Vite 7.x, vitest, ESLint 9, Prettier

## Development

```bash
npm install
npm run tauri dev     # Dev server with HMR
npm test              # Run vitest suite
npm run lint          # ESLint check
```

### Build

```bash
npm run tauri build           # macOS .app + .dmg
npm run tauri:build:macos     # macOS build script
```

Note: Cargo binary is at `~/.cargo/bin/cargo` (not in default PATH).

## IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
