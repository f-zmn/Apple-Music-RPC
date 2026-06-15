import fs from "node:fs";
import path from "node:path";

export type DiagnosticsData = Record<string, unknown>;

export class Diagnostics {
  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath;
  }

  info(event: string, data: DiagnosticsData = {}): void {
    this.write("info", event, data);
  }

  error(event: string, error: unknown, data: DiagnosticsData = {}): void {
    this.write("error", event, {
      ...data,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  private write(level: "info" | "error", event: string, data: DiagnosticsData): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.appendFileSync(
        this.filePath,
        `${new Date().toISOString()} ${level} ${event} ${JSON.stringify(data)}\n`,
        "utf8"
      );
    } catch {
      // Diagnostics must never break the tray app.
    }
  }
}
