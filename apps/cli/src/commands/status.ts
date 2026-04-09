import { Command } from "commander";
import { discoverApps } from "../lib/discovery.js";
import {
  isProcessAlive,
  listTrackedApps,
  readPid,
  removePid,
} from "../lib/process.js";
import { validateAppName } from "../lib/validate.js";

export const statusCommand = new Command("status")
  .description("Show status of running apps")
  .argument("[app]", "App name (omit to show all)")
  .action((appName?: string) => {
    if (appName) {
      validateAppName(appName);
      showAppStatus(appName);
    } else {
      showAllStatus();
    }
  });

function showAppStatus(appName: string): void {
  const pid = readPid(appName);

  if (pid === undefined) {
    console.log(`${appName}  \x1b[90mstopped\x1b[0m`);
    return;
  }

  if (isProcessAlive(pid)) {
    console.log(`${appName}  \x1b[32mrunning\x1b[0m (PID: ${pid})`);
  } else {
    console.log(`${appName}  \x1b[90mstopped\x1b[0m (stale PID removed)`);
    removePid(appName);
  }
}

function showAllStatus(): void {
  // Merge discovered apps with any tracked PIDs
  const discovered = discoverApps().map((a) => a.name);
  const tracked = listTrackedApps();
  const allApps = [...new Set([...discovered, ...tracked])].sort();

  if (allApps.length === 0) {
    console.log("No apps found.");
    return;
  }

  console.log("App status:\n");
  for (const app of allApps) {
    process.stdout.write("  ");
    showAppStatus(app);
  }
  console.log();
}
