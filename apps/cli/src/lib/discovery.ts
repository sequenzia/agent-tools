import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getAppsDir } from "./paths.js";

export interface AppInfo {
  name: string;
  path: string;
}

/** Scan apps/ for subdirectories with a package.json containing a `dev` script. */
export function discoverApps(): AppInfo[] {
  const appsDir = getAppsDir();
  const entries = readdirSync(appsDir, { withFileTypes: true });
  const apps: AppInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "cli") continue;

    const pkgPath = join(appsDir, entry.name, "package.json");
    if (!existsSync(pkgPath)) continue;

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
        scripts?: Record<string, string>;
      };
      if (pkg.scripts?.dev) {
        apps.push({ name: entry.name, path: join(appsDir, entry.name) });
      }
    } catch {
      // Skip directories with malformed package.json
    }
  }

  return apps;
}

/** Find a specific app by name, or return undefined. */
export function findApp(name: string): AppInfo | undefined {
  return discoverApps().find((app) => app.name === name);
}

/** Print an error message for an unknown app and list available ones. */
export function printUnknownAppError(name: string): void {
  const apps = discoverApps();
  console.error(`Error: Unknown app "${name}".`);
  if (apps.length > 0) {
    console.error(`Available apps: ${apps.map((a) => a.name).join(", ")}`);
  } else {
    console.error("No apps found in apps/ directory.");
  }
}
