import { Command } from "commander";
import {
  isProcessAlive,
  readPid,
  removePid,
  sendSignalToGroup,
} from "../lib/process.js";
import { validateAppName } from "../lib/validate.js";

export const killCommand = new Command("kill")
  .description("Force kill a running app (SIGKILL)")
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

    console.warn("Warning: SIGKILL does not allow graceful shutdown.");
    sendSignalToGroup(pid, "SIGKILL");
    removePid(appName);
    console.log(`Sent SIGKILL to ${appName} (PID: ${pid}).`);
  });
