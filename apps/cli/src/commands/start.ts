import { spawn } from "node:child_process";
import { Command } from "commander";
import { findApp, printUnknownAppError } from "../lib/discovery.js";
import { createLogStream, tee } from "../lib/logger.js";
import {
  isProcessAlive,
  readPid,
  removePid,
  writePid,
} from "../lib/process.js";
import { validateAppName } from "../lib/validate.js";

export const startCommand = new Command("start")
  .description("Start an app in dev mode")
  .argument("<app>", "App name (e.g. task-manager)")
  .action((appName: string) => {
    validateAppName(appName);

    const app = findApp(appName);
    if (!app) {
      printUnknownAppError(appName);
      process.exit(1);
    }

    // Check if already running
    const existingPid = readPid(appName);
    if (existingPid !== undefined) {
      if (isProcessAlive(existingPid)) {
        console.error(
          `Error: ${appName} is already running (PID: ${existingPid}).`,
        );
        console.error(`Use "agt stop ${appName}" to stop it first.`);
        process.exit(1);
      }
      console.warn(`Warning: Removing stale PID file for ${appName}.`);
      removePid(appName);
    }

    const logger = createLogStream(appName);

    console.log(`Starting ${appName} (dev mode)...`);
    console.log(`Logs: .agt/logs/${appName}.log\n`);

    // detached: true gives the child its own process group (PGID = child.pid).
    // This lets us kill the entire tree (npm + concurrently + tsx + vite) at once
    // via process.kill(-pid), rather than just signaling npm and hoping it propagates.
    const child = spawn("npm", ["run", "dev"], {
      cwd: app.path,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      detached: true,
    });

    if (child.pid === undefined) {
      console.error("Error: Failed to start process.");
      logger.close();
      process.exit(1);
    }

    writePid(appName, child.pid);

    if (child.stdout) tee(child.stdout, process.stdout, logger.stream);
    if (child.stderr) tee(child.stderr, process.stderr, logger.stream);

    let exiting = false;

    function cleanup(): void {
      if (exiting) return;
      exiting = true;
      console.log(`\nStopping ${appName}...`);

      // Kill the entire process group
      try {
        process.kill(-child.pid!, "SIGTERM");
      } catch {
        // Process group already dead
      }

      // If the child doesn't exit within 5 seconds, force kill
      const timeout = setTimeout(() => {
        console.warn(
          `Warning: ${appName} did not exit in time, sending SIGKILL.`,
        );
        try {
          process.kill(-child.pid!, "SIGKILL");
        } catch {
          // Already dead
        }
        removePid(appName);
        logger.close();
        process.exit(1);
      }, 5000);
      timeout.unref();
    }

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    child.on("error", (err) => {
      console.error(`Error starting ${appName}: ${err.message}`);
      removePid(appName);
      logger.close();
      process.exit(1);
    });

    child.on("exit", (code, signal) => {
      removePid(appName);
      logger.close();
      if (signal) {
        console.log(`\n${appName} exited via signal ${signal}.`);
      } else if (code !== 0) {
        console.error(`\n${appName} exited with code ${code}.`);
      } else {
        console.log(`\n${appName} stopped.`);
      }
      process.exit(code ?? 1);
    });
  });
