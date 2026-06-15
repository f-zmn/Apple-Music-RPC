import { app } from "electron";
import { APP_NAME, APP_USER_MODEL_ID, loadDotEnv, resolveConfig } from "./config";
import { MediaWorkerClient } from "./media/mediaWorkerClient";
import type { TrackState } from "./media/types";
import { DiscordPresence } from "./presence/discordPresence";
import { TrayController } from "./tray/trayController";

loadDotEnv();

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.setAppUserModelId(APP_USER_MODEL_ID);

let tray: TrayController | null = null;
let mediaWorker: MediaWorkerClient | null = null;
let discordPresence: DiscordPresence | null = null;

app.on("second-instance", () => {
  mediaWorker?.refresh();
});

app.on("window-all-closed", () => {
  // Tray-only app: keep running until the user quits from the tray menu.
});

app.on("before-quit", () => {
  mediaWorker?.stop();
  tray?.destroy();
});

void app.whenReady().then(async () => {
  const config = resolveConfig();
  discordPresence = new DiscordPresence(config.discordClientId);
  mediaWorker = new MediaWorkerClient(config.appleMusicSourcePrefix);

  tray = new TrayController({
    reconnectDiscord: () => void discordPresence?.reconnectNow(),
    clearActivity: () => void discordPresence?.clearActivity(),
    quit: () => app.quit()
  });

  tray.setDiscordStatus(discordPresence.currentStatus);
  if (config.discordClientIdSource === "missing") {
    tray.setMediaStatus("Maintainer Discord Client ID is not configured", null);
  }

  discordPresence.on("status", (status) => tray?.setDiscordStatus(status));
  discordPresence.on("error", () => tray?.setDiscordStatus("disconnected"));

  mediaWorker.on("ready", () => {
    tray?.setMediaStatus("Waiting for Apple Music", null);
  });

  mediaWorker.on("track", (track) => {
    handleTrack(track);
  });

  mediaWorker.on("error", () => {
    tray?.setMediaStatus("Unable to read Windows media sessions", null);
    void discordPresence?.clearActivity();
  });

  mediaWorker.on("exit", () => {
    tray?.setMediaStatus("Media worker stopped", null);
    void discordPresence?.clearActivity();
  });

  mediaWorker.start();
  await discordPresence.connect();
});

function handleTrack(track: TrackState | null): void {
  if (!track) {
    tray?.setMediaStatus("Waiting for Apple Music", null);
    void discordPresence?.clearActivity();
    return;
  }

  tray?.setMediaStatus(formatTrackStatus(track), track);
  void discordPresence?.setTrack(track);
}

function formatTrackStatus(track: TrackState): string {
  if (track.playbackState === "playing") {
    return `Playing in ${APP_NAME}`;
  }

  if (track.playbackState === "paused") {
    return "Paused";
  }

  return "Waiting for Apple Music";
}
