import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname } from "node:path";
import { getPidPath } from "./paths.js";

/** Write a PID file for the given app. Creates parent directories as needed. */
export function writePid(app: string, pid: number): void {
  const pidPath = getPidPath(app);
  mkdirSync(dirname(pidPath), { recursive: true });
  writeFileSync(pidPath, String(pid), "utf-8");
}

/** Read the PID for a given app, or return undefined if no PID file exists. */
export function readPid(app: string): number | undefined {
  const pidPath = getPidPath(app);
  if (!existsSync(pidPath)) return undefined;

  try {
    const content = readFileSync(pidPath, "utf-8").trim();
    const pid = parseInt(content, 10);
    if (Number.isNaN(pid)) {
      // Corrupt PID file — remove it
      removePid(app);
      return undefined;
    }
    return pid;
  } catch {
    return undefined;
  }
}

/** Remove the PID file for the given app. Idempotent — ignores missing files. */
export function removePid(app: string): void {
  const pidPath = getPidPath(app);
  try {
    unlinkSync(pidPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/** Check if a process with the given PID is still alive. */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Send a signal to a process. Returns true if the signal was sent. */
export function sendSignal(
  pid: number,
  signal: NodeJS.Signals = "SIGTERM",
): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

/**
 * Send a signal to an entire process group (negative PID).
 * This kills the leader and all its children — essential because
 * `npm run dev` spawns a tree (npm → concurrently → tsx + vite).
 * Falls back to signaling the individual PID if group kill fails.
 */
export function sendSignalToGroup(
  pid: number,
  signal: NodeJS.Signals = "SIGTERM",
): boolean {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    return sendSignal(pid, signal);
  }
}

/** List all apps that have PID files (running or stale). */
export function listTrackedApps(): string[] {
  const pidsDir = dirname(getPidPath("_placeholder"));
  if (!existsSync(pidsDir)) return [];

  return readdirSync(pidsDir)
    .filter((f) => f.endsWith(".pid"))
    .map((f) => basename(f, ".pid"));
}
