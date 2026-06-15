import { EventEmitter } from "node:events";
import path from "node:path";
import { Worker } from "node:worker_threads";
import type { MediaWorkerCommand, MediaWorkerMessage, TrackState } from "./types";

type MediaWorkerClientEvents = {
  ready: [];
  track: [TrackState | null];
  error: [Error];
  exit: [number];
};

export class MediaWorkerClient extends EventEmitter {
  private worker: Worker | null = null;

  constructor(private readonly sourcePrefix: string) {
    super();
  }

  start(): void {
    if (this.worker) {
      return;
    }

    const workerPath = resolveWorkerPath(path.join(__dirname, "worker.js"));
    this.worker = new Worker(workerPath, {
      workerData: {
        sourcePrefix: this.sourcePrefix
      }
    });

    this.worker.on("message", (message: MediaWorkerMessage) => this.handleMessage(message));
    this.worker.on("error", (error) => this.emitTyped("error", asError(error)));
    this.worker.on("exit", (code) => {
      this.worker = null;
      this.emitTyped("exit", code);
    });
  }

  refresh(): void {
    this.post({ type: "refresh" });
  }

  stop(): void {
    this.post({ type: "shutdown" });
    this.worker?.terminate();
    this.worker = null;
  }

  on<K extends keyof MediaWorkerClientEvents>(event: K, listener: (...args: MediaWorkerClientEvents[K]) => void): this {
    return super.on(event, listener);
  }

  private handleMessage(message: MediaWorkerMessage): void {
    switch (message.type) {
      case "ready":
        this.emitTyped("ready");
        break;
      case "track":
        this.emitTyped("track", message.track);
        break;
      case "error":
        this.emitTyped("error", new Error(message.message));
        break;
    }
  }

  private post(command: MediaWorkerCommand): void {
    this.worker?.postMessage(command);
  }

  private emitTyped<K extends keyof MediaWorkerClientEvents>(event: K, ...args: MediaWorkerClientEvents[K]): boolean {
    return super.emit(event, ...args);
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function resolveWorkerPath(workerPath: string): string {
  return workerPath.includes("app.asar") ? workerPath.replace("app.asar", "app.asar.unpacked") : workerPath;
}
