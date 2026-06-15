import path from "node:path";
import dotenv from "dotenv";

export const APP_NAME = "Music Presence";
export const APP_USER_MODEL_ID = "dev.fjoje.musicpresence";
export const DEFAULT_APPLE_MUSIC_SOURCE_PREFIX = "AppleInc.AppleMusicWin";

/*
 * Replace this with the public client ID of the maintainer-owned Discord
 * Developer Application before publishing the first zero-config release.
 * The client ID is public. Never commit a client secret or token.
 */
export const DEFAULT_DISCORD_CLIENT_ID = "1516152886286094406";

export type AppConfig = {
  discordClientId: string | null;
  discordClientIdSource: "default" | "env" | "missing";
  appleMusicSourcePrefix: string;
};

const DISCORD_CLIENT_ID_PATTERN = /^\d{17,20}$/;

export function loadDotEnv(cwd = process.cwd()): void {
  dotenv.config({ path: path.join(cwd, ".env"), quiet: true });
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const envClientId = normalize(env.DISCORD_CLIENT_ID);
  if (envClientId && DISCORD_CLIENT_ID_PATTERN.test(envClientId)) {
    return {
      discordClientId: envClientId,
      discordClientIdSource: "env",
      appleMusicSourcePrefix: resolveAppleMusicPrefix(env)
    };
  }

  if (DISCORD_CLIENT_ID_PATTERN.test(DEFAULT_DISCORD_CLIENT_ID)) {
    return {
      discordClientId: DEFAULT_DISCORD_CLIENT_ID,
      discordClientIdSource: "default",
      appleMusicSourcePrefix: resolveAppleMusicPrefix(env)
    };
  }

  return {
    discordClientId: null,
    discordClientIdSource: "missing",
    appleMusicSourcePrefix: resolveAppleMusicPrefix(env)
  };
}

export function hasValidDiscordClientId(clientId: string | null): clientId is string {
  return typeof clientId === "string" && DISCORD_CLIENT_ID_PATTERN.test(clientId);
}

function resolveAppleMusicPrefix(env: NodeJS.ProcessEnv): string {
  return normalize(env.APPLE_MUSIC_SOURCE_PREFIX) ?? DEFAULT_APPLE_MUSIC_SOURCE_PREFIX;
}

function normalize(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
