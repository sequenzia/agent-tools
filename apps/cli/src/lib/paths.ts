import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let repoRootCache: string | undefined;

/** Walk up from the CLI package to find the repo root (directory containing `apps/`). */
export function getRepoRoot(): string {
  if (repoRootCache) return repoRootCache;

  let dir = resolve(__dirname);
  while (dir !== dirname(dir)) {
    if (
      existsSync(join(dir, "apps")) &&
      existsSync(join(dir, "plugins", "manifest.json"))
    ) {
      repoRootCache = dir;
      return dir;
    }
    dir = dirname(dir);
  }

  console.error("Error: Could not find repo root (no apps/ directory found).");
  process.exit(1);
}

/** The `.agt/` runtime state directory at the repo root. */
export function getAgtDir(): string {
  return join(getRepoRoot(), ".agt");
}

/** Path to a PID file for a given app. */
export function getPidPath(app: string): string {
  return join(getAgtDir(), "pids", `${app}.pid`);
}

/** Path to a log file for a given app. */
export function getLogPath(app: string): string {
  return join(getAgtDir(), "logs", `${app}.log`);
}

/** Path to an app's directory. */
export function getAppDir(app: string): string {
  return join(getRepoRoot(), "apps", app);
}

/** Path to the apps/ directory. */
export function getAppsDir(): string {
  return join(getRepoRoot(), "apps");
}
