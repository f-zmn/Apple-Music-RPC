import { EventEmitter } from "node:events";
import { Client } from "@xhayper/discord-rpc";
import { createPresencePayload } from "./activity";
import type { TrackState } from "../media/types";

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

  constructor(private readonly clientId: string | null) {
    super();
    if (!clientId) {
      this.setStatus("not-configured");
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
      return;
    }

    if (this.status === "connecting" || this.status === "connected") {
      return;
    }

    this.clearReconnectTimer();
    this.setStatus("connecting");

    const client = new Client({ clientId: this.clientId });
    this.client = client;

    client.on("ready", async () => {
      this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      this.setStatus("connected");
      if (this.pendingTrack) {
        await this.setTrack(this.pendingTrack);
      }
    });

    client.on("disconnected", () => {
      this.client = null;
      this.lastSignature = null;
      this.setStatus("disconnected");
      this.scheduleReconnect();
    });

    try {
      await client.login();
    } catch (error) {
      this.client = null;
      this.lastSignature = null;
      this.setStatus("disconnected");
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
      return;
    }

    const payload = createPresencePayload(track);
    if (!payload) {
      await this.clearActivity();
      return;
    }

    if (payload.signature === this.lastSignature) {
      return;
    }

    if (!this.client?.isConnected || !this.client.user) {
      void this.connect();
      return;
    }

    try {
      await this.client.user.setActivity(payload.activity, process.pid);
      this.lastSignature = payload.signature;
    } catch (error) {
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
    } catch (error) {
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
