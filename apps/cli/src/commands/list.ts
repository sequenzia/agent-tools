import { Command } from "commander";
import { discoverApps } from "../lib/discovery.js";
import { isProcessAlive, readPid, removePid } from "../lib/process.js";

export const listCommand = new Command("list")
  .description("List available apps")
  .action(() => {
    const apps = discoverApps();

    if (apps.length === 0) {
      console.log("No apps found in apps/ directory.");
      return;
    }

    console.log("Available apps:\n");
    for (const app of apps) {
      const pid = readPid(app.name);
      const alive = pid !== undefined && isProcessAlive(pid);
      if (pid !== undefined && !alive) {
        removePid(app.name);
      }
      const status = alive
        ? `\x1b[32mrunning\x1b[0m (PID: ${pid})`
        : "\x1b[90mstopped\x1b[0m";
      console.log(`  ${app.name}  ${status}`);
    }
    console.log();
  });
