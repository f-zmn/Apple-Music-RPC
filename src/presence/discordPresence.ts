import { EventEmitter } from "node:events";
import { Client } from "@xhayper/discord-rpc";
import { createPresencePayload } from "./activity";
import type { TrackState } from "../media/types";
import type { Diagnostics } from "../diagnostics";

type DiscordPresenceEvents = {
  status: [DiscordConnectionStatus];
  error: [Error];
};

export type DiscordConnectionStatus = "not-configured" | "connecting" | "connected" | "disconnected";

const INITIAL_RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_DELAY_MS = 60_000;

export class DiscordPresence extends EventEmitter {
  private client: Client | null = null;
  private status: DiscordConnectionStatus = "disconnected";
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  private pendingTrack: TrackState | null = null;
  private lastSignature: string | null = null;

  constructor(
    private readonly clientId: string | null,
    private readonly diagnostics?: Diagnostics
  ) {
    super();
    if (!clientId) {
      this.setStatus("not-configured");
      this.diagnostics?.info("discord.not_configured");
    }
  }

  on<K extends keyof DiscordPresenceEvents>(event: K, listener: (...args: DiscordPresenceEvents[K]) => void): this {
    return super.on(event, listener);
  }

  get currentStatus(): DiscordConnectionStatus {
    return this.status;
  }

  async connect(): Promise<void> {
    if (!this.clientId) {
      this.setStatus("not-configured");
      this.diagnostics?.info("discord.connect_skipped_no_client_id");
      return;
    }

    if (this.status === "connecting" || this.status === "connected") {
      return;
    }

    this.clearReconnectTimer();
    this.setStatus("connecting");
    this.diagnostics?.info("discord.connecting");

    const client = new Client({ clientId: this.clientId });
    this.client = client;

    client.on("ready", async () => {
      this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      this.setStatus("connected");
      this.diagnostics?.info("discord.ready", {
        applicationName: this.client?.application?.name ?? null
      });
      if (this.pendingTrack) {
        await this.setTrack(this.pendingTrack);
      }
    });

    client.on("disconnected", () => {
      this.client = null;
      this.lastSignature = null;
      this.setStatus("disconnected");
      this.diagnostics?.info("discord.disconnected");
      this.scheduleReconnect();
    });

    try {
      await client.login();
    } catch (error) {
      this.client = null;
      this.lastSignature = null;
      this.setStatus("disconnected");
      this.diagnostics?.error("discord.login_failed", error);
      this.emitTyped("error", asError(error));
      this.scheduleReconnect();
    }
  }

  async reconnectNow(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  async disconnect(): Promise<void> {
    this.clearReconnectTimer();
    this.diagnostics?.info("discord.disconnect");
    const client = this.client;
    this.client = null;
    this.lastSignature = null;

    if (client?.isConnected) {
      await client.destroy().catch(() => undefined);
    }

    this.setStatus(this.clientId ? "disconnected" : "not-configured");
  }

  async setTrack(track: TrackState | null): Promise<void> {
    this.pendingTrack = track;

    if (!track) {
      await this.clearActivity();
      this.diagnostics?.info("presence.clear_no_track");
      return;
    }

    const payload = createPresencePayload(track);
    if (!payload) {
      await this.clearActivity();
      this.diagnostics?.info("presence.clear_unpublishable_track", {
        playbackState: track.playbackState
      });
      return;
    }

    if (payload.signature === this.lastSignature) {
      return;
    }

    if (!this.client?.isConnected || !this.client.user) {
      this.diagnostics?.info("presence.defer_until_connected", {
        playbackState: track.playbackState
      });
      void this.connect();
      return;
    }

    try {
      await this.client.user.setActivity(payload.activity, process.pid);
      this.lastSignature = payload.signature;
      this.diagnostics?.info("presence.set_ok", {
        playbackState: track.playbackState,
        hasLargeImage: Boolean(payload.activity.largeImageKey),
        hasButton: Boolean(payload.activity.buttons?.length),
        hasTimestamps: Boolean(payload.activity.startTimestamp && payload.activity.endTimestamp)
      });
    } catch (error) {
      this.diagnostics?.error("presence.set_failed", error, {
        playbackState: track.playbackState
      });
      this.emitTyped("error", asError(error));
      this.lastSignature = null;
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  async clearActivity(): Promise<void> {
    this.pendingTrack = null;
    this.lastSignature = null;

    if (!this.client?.isConnected || !this.client.user) {
      return;
    }

    try {
      await this.client.user.clearActivity(process.pid);
      this.diagnostics?.info("presence.clear_ok");
    } catch (error) {
      this.diagnostics?.error("presence.clear_failed", error);
      this.emitTyped("error", asError(error));
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.clientId || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, this.reconnectDelayMs);

    this.diagnostics?.info("discord.reconnect_scheduled", {
      delayMs: this.reconnectDelayMs
    });
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: DiscordConnectionStatus): void {
    if (status !== this.status) {
      this.status = status;
      this.emitTyped("status", status);
    }
  }

  private emitTyped<K extends keyof DiscordPresenceEvents>(event: K, ...args: DiscordPresenceEvents[K]): boolean {
    return super.emit(event, ...args);
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
