import path from "node:path";
import { app, shell } from "electron";
import { APP_NAME, APP_USER_MODEL_ID, loadDotEnv, resolveConfig } from "./config";
import { Diagnostics } from "./diagnostics";
import { MediaWorkerClient } from "./media/mediaWorkerClient";
import type { TrackState } from "./media/types";
import { ArtworkServer } from "./presence/artworkServer";
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
let diagnostics: Diagnostics | null = null;
let artworkServer: ArtworkServer | null = null;

app.on("second-instance", () => {
  mediaWorker?.refresh();
});

app.on("window-all-closed", () => {
  // Tray-only app: keep running until the user quits from the tray menu.
});

app.on("before-quit", () => {
  mediaWorker?.stop();
  artworkServer?.close();
  tray?.destroy();
});

void app.whenReady().then(async () => {
  const config = resolveConfig();
  diagnostics = new Diagnostics(path.join(app.getPath("userData"), "diagnostics.log"));
  diagnostics.info("app.ready", {
    packaged: app.isPackaged,
    discordClientIdSource: config.discordClientIdSource,
    hasDiscordClientId: Boolean(config.discordClientId),
    appleMusicSourcePrefix: config.appleMusicSourcePrefix
  });

  discordPresence = new DiscordPresence(config.discordClientId, diagnostics);
  artworkServer = new ArtworkServer(diagnostics);
  await artworkServer.start();
  mediaWorker = new MediaWorkerClient(config.appleMusicSourcePrefix);

  tray = new TrayController({
    reconnectDiscord: () => void discordPresence?.reconnectNow(),
    refreshMedia: () => mediaWorker?.refresh(),
    clearActivity: () => void discordPresence?.clearActivity(),
    openDiagnostics: () => {
      if (diagnostics) {
        void shell.openPath(diagnostics.path);
      }
    },
    quit: () => app.quit()
  });

  tray.setDiscordStatus(discordPresence.currentStatus);
  if (config.discordClientIdSource === "missing") {
    tray.setMediaStatus("Maintainer Discord Client ID is not configured", null);
  }

  discordPresence.on("status", (status) => tray?.setDiscordStatus(status));
  discordPresence.on("error", () => tray?.setDiscordStatus("disconnected"));

  mediaWorker.on("ready", () => {
    diagnostics?.info("media.worker_ready");
    tray?.setMediaStatus("Waiting for Apple Music", null);
  });

  mediaWorker.on("track", (track) => {
    diagnostics?.info("media.track", {
      hasTrack: Boolean(track),
      sourceAppId: track?.sourceAppId ?? null,
      playbackState: track?.playbackState ?? null,
      hasArtwork: Boolean(track?.artwork),
      hasPosition: track?.positionSeconds !== null,
      hasDuration: track?.durationSeconds !== null
    });
    handleTrack(track);
  });

  mediaWorker.on("error", (error) => {
    diagnostics?.error("media.worker_error", error);
    tray?.setMediaStatus("Unable to read Windows media sessions", null);
    void discordPresence?.clearActivity();
  });

  mediaWorker.on("exit", (code) => {
    diagnostics?.info("media.worker_exit", { code });
    tray?.setMediaStatus("Media worker stopped", null);
    void discordPresence?.clearActivity();
  });

  mediaWorker.start();
  await discordPresence.connect();
});

function handleTrack(track: TrackState | null): void {
  if (!track) {
    artworkServer?.updateArtwork(null);
    tray?.setMediaStatus("Waiting for Apple Music", null);
    void discordPresence?.clearActivity();
    return;
  }

  const artworkUrl = artworkServer?.updateArtwork(track.artwork) ?? null;
  const publishableTrack: TrackState = {
    ...track,
    artworkUrl
  };

  tray?.setMediaStatus(formatTrackStatus(publishableTrack), publishableTrack);
  void discordPresence?.setTrack(publishableTrack);
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
