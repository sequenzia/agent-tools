import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { Command } from "commander";
import { getLogPath } from "../lib/paths.js";
import { validateAppName } from "../lib/validate.js";

export const logsCommand = new Command("logs")
  .description("Show recent log output for an app")
  .argument("<app>", "App name (e.g. task-manager)")
  .option("-n, --lines <count>", "Number of lines to show", "50")
  .action((appName: string, opts: { lines: string }) => {
    validateAppName(appName);

    const logPath = getLogPath(appName);

    if (!existsSync(logPath)) {
      console.error(`No log file found for ${appName}.`);
      console.error(`Start the app first: agt start ${appName}`);
      process.exit(1);
    }

    const lineCount = parseInt(opts.lines, 10);
    if (Number.isNaN(lineCount) || lineCount <= 0) {
      console.error("Error: --lines must be a positive number.");
      process.exit(1);
    }

    // Use system `tail` to avoid reading the entire file into memory
    try {
      const output = execFileSync("tail", ["-n", String(lineCount), logPath], {
        encoding: "utf-8",
      });
      if (output.trim().length === 0) {
        console.log(`Log file for ${appName} is empty.`);
      } else {
        process.stdout.write(output);
      }
    } catch {
      console.error(`Error reading log file for ${appName}.`);
      process.exit(1);
    }
  });
