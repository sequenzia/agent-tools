/** Validate that an app name contains only safe characters. Exits on invalid input. */
export function validateAppName(name: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    console.error(
      `Error: Invalid app name "${name}". Only letters, numbers, hyphens, and underscores are allowed.`,
    );
    process.exit(1);
  }
}
