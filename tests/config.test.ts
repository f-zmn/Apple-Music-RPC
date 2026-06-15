import { describe, expect, it } from "vitest";
import { DEFAULT_APPLE_MUSIC_SOURCE_PREFIX, DEFAULT_DISCORD_CLIENT_ID, resolveConfig } from "../src/config";

describe("config", () => {
  it("uses a valid Discord client ID from the environment", () => {
    const config = resolveConfig({
      DISCORD_CLIENT_ID: "123456789012345678",
      APPLE_MUSIC_SOURCE_PREFIX: "CustomAppleMusic"
    });

    expect(config.discordClientId).toBe("123456789012345678");
    expect(config.discordClientIdSource).toBe("env");
    expect(config.appleMusicSourcePrefix).toBe("CustomAppleMusic");
  });

  it("uses the committed default Discord client ID without environment config", () => {
    const config = resolveConfig({});

    expect(config.discordClientId).toBe(DEFAULT_DISCORD_CLIENT_ID);
    expect(config.discordClientIdSource).toBe("default");
    expect(config.appleMusicSourcePrefix).toBe(DEFAULT_APPLE_MUSIC_SOURCE_PREFIX);
  });

  it("falls back to the committed default when the environment client ID is invalid", () => {
    const config = resolveConfig({
      DISCORD_CLIENT_ID: "not-a-client-id"
    });

    expect(config.discordClientId).toBe(DEFAULT_DISCORD_CLIENT_ID);
    expect(config.discordClientIdSource).toBe("default");
  });
});
