import path from "node:path";
import { app, Menu, nativeImage, Tray } from "electron";
import { APP_NAME } from "../config";
import type { DiscordConnectionStatus } from "../presence/discordPresence";
import type { TrackState } from "../media/types";

export type TrayCallbacks = {
  reconnectDiscord: () => void;
  clearActivity: () => void;
  quit: () => void;
};

type TrayState = {
  discordStatus: DiscordConnectionStatus;
  mediaStatus: string;
  track: TrackState | null;
  autostartEnabled: boolean;
};

export class TrayController {
  private tray: Tray;
  private state: TrayState = {
    discordStatus: "disconnected",
    mediaStatus: "Waiting for Apple Music",
    track: null,
    autostartEnabled: false
  };

  constructor(private readonly callbacks: TrayCallbacks) {
    this.tray = new Tray(loadTrayImage());
    this.tray.setToolTip(APP_NAME);
    this.state.autostartEnabled = app.getLoginItemSettings().openAtLogin;
    this.render();
  }

  setDiscordStatus(status: DiscordConnectionStatus): void {
    this.state.discordStatus = status;
    this.render();
  }

  setMediaStatus(status: string, track: TrackState | null): void {
    this.state.mediaStatus = status;
    this.state.track = track;
    this.render();
  }

  destroy(): void {
    this.tray.destroy();
  }

  private render(): void {
    const trackLabel = this.state.track
      ? `${this.state.track.title} - ${this.state.track.artist}`
      : this.state.mediaStatus;

    this.tray.setToolTip(`${APP_NAME}: ${trackLabel}`);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: `${APP_NAME}`,
          enabled: false
        },
        {
          label: `Discord: ${formatDiscordStatus(this.state.discordStatus)}`,
          enabled: false
        },
        {
          label: trackLabel,
          enabled: false
        },
        { type: "separator" },
        {
          label: "Reconnect Discord",
          click: this.callbacks.reconnectDiscord
        },
        {
          label: "Clear Activity",
          click: this.callbacks.clearActivity
        },
        {
          label: "Start with Windows",
          type: "checkbox",
          checked: this.state.autostartEnabled,
          click: (item) => this.toggleAutostart(item.checked)
        },
        { type: "separator" },
        {
          label: "Quit",
          click: this.callbacks.quit
        }
      ])
    );
  }

  private toggleAutostart(enabled: boolean): void {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath
    });

    this.state.autostartEnabled = app.getLoginItemSettings().openAtLogin;
    this.render();
  }
}

function loadTrayImage(): Electron.NativeImage {
  const imagePath = app.isPackaged
    ? path.join(app.getAppPath(), "assets", "icon.png")
    : path.join(process.cwd(), "assets", "icon.png");

  const image = nativeImage.createFromPath(imagePath);
  return image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 });
}

function formatDiscordStatus(status: DiscordConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "not-configured":
      return "Missing client ID";
    case "disconnected":
      return "Disconnected";
  }
}
