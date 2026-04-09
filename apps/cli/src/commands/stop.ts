import { Command } from "commander";
import {
  isProcessAlive,
  readPid,
  removePid,
  sendSignalToGroup,
} from "../lib/process.js";
import { validateAppName } from "../lib/validate.js";

export const stopCommand = new Command("stop")
  .description("Stop a running app (SIGTERM)")
  .argument("<app>", "App name (e.g. task-manager)")
  .action((appName: string) => {
    validateAppName(appName);

    const pid = readPid(appName);

    if (pid === undefined) {
      console.log(`${appName} is not running.`);
      return;
    }

    if (!isProcessAlive(pid)) {
      console.log(`${appName} is not running (cleaned stale PID file).`);
      removePid(appName);
      return;
    }

    sendSignalToGroup(pid, "SIGTERM");
    console.log(`Sent SIGTERM to ${appName} (PID: ${pid}).`);

    // Wait up to 5 seconds for the process to exit
    const start = Date.now();
    while (Date.now() - start < 5000 && isProcessAlive(pid)) {
      // Busy-wait in small increments (synchronous CLI — acceptable)
      const end = Date.now() + 100;
      while (Date.now() < end) {
        /* spin */
      }
    }

    if (isProcessAlive(pid)) {
      console.warn(
        `Warning: ${appName} (PID: ${pid}) is still running after SIGTERM.`,
      );
      console.warn(`Use "agt kill ${appName}" to force kill.`);
    } else {
      removePid(appName);
      console.log(`${appName} stopped.`);
    }
  });
