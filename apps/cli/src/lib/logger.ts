import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { dirname } from "node:path";
import type { Readable } from "node:stream";
import { getLogPath } from "./paths.js";

export interface TeeLogger {
  /** The writable stream to the log file. */
  stream: WriteStream;
  /** Close the log stream. */
  close(): void;
}

/** Create a log file write stream for an app. Truncates any existing log. */
export function createLogStream(app: string): TeeLogger {
  const logPath = getLogPath(app);
  mkdirSync(dirname(logPath), { recursive: true });

  const stream = createWriteStream(logPath, { flags: "w" });

  return {
    stream,
    close() {
      stream.end();
    },
  };
}

/**
 * Pipe a child process readable stream to both the terminal and a log file.
 * Handles the common pattern of teeing stdout/stderr.
 */
export function tee(
  source: Readable,
  destination: NodeJS.WritableStream,
  logStream: WriteStream,
): void {
  source.on("data", (chunk: Buffer) => {
    destination.write(chunk);
    logStream.write(chunk);
  });
}
