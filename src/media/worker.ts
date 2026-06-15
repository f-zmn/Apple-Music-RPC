import { parentPort, workerData } from "node:worker_threads";
import { SMTCMonitor } from "@coooookies/windows-smtc-monitor";
import { normalizeTrackState, pickAppleMusicSession } from "./session";
import type { MediaWorkerCommand, MediaWorkerMessage, RawMediaInfo } from "./types";

const DEFAULT_APPLE_MUSIC_SOURCE_PREFIX = "AppleInc.AppleMusicWin";

const sourcePrefix =
  typeof workerData?.sourcePrefix === "string" && workerData.sourcePrefix.trim()
    ? workerData.sourcePrefix.trim()
    : DEFAULT_APPLE_MUSIC_SOURCE_PREFIX;

let monitor: SMTCMonitor | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
let lastSignature = "";

function post(message: MediaWorkerMessage): void {
  parentPort?.postMessage(message);
}

function publishCurrentTrack(): void {
  try {
    const sessions = SMTCMonitor.getMediaSessions() as RawMediaInfo[];
    const session = pickAppleMusicSession(sessions, sourcePrefix);
    const track = session ? normalizeTrackState(session) : null;
    const signature = track ? JSON.stringify(track) : "null";

    if (signature !== lastSignature) {
      lastSignature = signature;
      post({ type: "track", track });
    }
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
}

function scheduleRefresh(delayMs = 150): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    publishCurrentTrack();
  }, delayMs);
}

function bindMonitor(): void {
  monitor = new SMTCMonitor();

  monitor.on("session-added", () => scheduleRefresh());
  monitor.on("session-removed", () => scheduleRefresh());
  monitor.on("current-session-changed", () => scheduleRefresh());
  monitor.on("session-media-changed", (sourceAppId) => {
    if (sourceAppId.toLowerCase().startsWith(sourcePrefix.toLowerCase())) {
      scheduleRefresh();
    }
  });
  monitor.on("session-playback-changed", (sourceAppId) => {
    if (sourceAppId.toLowerCase().startsWith(sourcePrefix.toLowerCase())) {
      scheduleRefresh();
    }
  });
  monitor.on("session-timeline-changed", (sourceAppId) => {
    if (sourceAppId.toLowerCase().startsWith(sourcePrefix.toLowerCase())) {
      scheduleRefresh(500);
    }
  });
}

parentPort?.on("message", (command: MediaWorkerCommand) => {
  if (command.type === "refresh") {
    publishCurrentTrack();
  }

  if (command.type === "shutdown") {
    monitor?.destroy();
    process.exit(0);
  }
});

try {
  bindMonitor();
  post({ type: "ready" });
  publishCurrentTrack();
} catch (error) {
  post({ type: "error", message: error instanceof Error ? error.message : String(error) });
}
