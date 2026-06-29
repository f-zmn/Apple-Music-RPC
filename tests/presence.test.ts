import { describe, expect, it } from "vitest";
import { createPresencePayload } from "../src/presence/activity";
import type { TrackState } from "../src/media/types";

describe("presence mapping", () => {
  it("creates a listening activity with progress timestamps while playing", () => {
    const payload = createPresencePayload(
      createTrack({
        playbackState: "playing",
        positionSeconds: 30,
        durationSeconds: 210,
        observedAtMs: 1_700_000_030_000
      })
    );

    expect(payload?.activity.type).toBe(2);
    expect(payload?.activity.name).toBe("Feel auf Apple Music");
    expect(payload?.activity.details).toBe("Feel");
    expect(payload?.activity.state).toBe("XIRA");
    expect(payload?.activity.startTimestamp).toEqual(new Date(1_700_000_000_000));
    expect(payload?.activity.endTimestamp).toEqual(new Date(1_700_000_210_000));
  });

  it("keeps paused activity visible without timestamps", () => {
    const payload = createPresencePayload(
      createTrack({
        playbackState: "paused",
        positionSeconds: 45,
        durationSeconds: 200
      })
    );

    expect(payload?.activity.details).toBe("Feel");
    expect(payload?.activity.state).toBe("Paused - XIRA");
    expect(payload?.activity.startTimestamp).toBeUndefined();
    expect(payload?.activity.endTimestamp).toBeUndefined();
  });

  it("returns null for stopped tracks so Discord activity can be cleared", () => {
    const payload = createPresencePayload(createTrack({ playbackState: "stopped" }));

    expect(payload).toBeNull();
  });

  it("omits timestamps if duration is missing", () => {
    const payload = createPresencePayload(
      createTrack({
        playbackState: "playing",
        positionSeconds: 30,
        durationSeconds: null
      })
    );

    expect(payload?.activity.startTimestamp).toBeUndefined();
    expect(payload?.activity.endTimestamp).toBeUndefined();
  });

  it("uses the artwork URL as large image when available", () => {
    const payload = createPresencePayload(
      createTrack({
        artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg/512x512bb.jpg",
        albumTitle: "Self Aware"
      })
    );

    expect(payload?.activity.largeImageKey).toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg/512x512bb.jpg");
    expect(payload?.activity.largeImageText).toBe("Self Aware");
  });

  it("adds an Apple Music button when a track URL is available", () => {
    const payload = createPresencePayload(
      createTrack({
        trackUrl: "https://music.apple.com/de/album/feel/123456789?i=987654321"
      })
    );

    expect(payload?.activity.buttons).toEqual([
      {
        label: "In Apple Music öffnen",
        url: "https://music.apple.com/de/album/feel/123456789?i=987654321"
      }
    ]);
  });
});

function createTrack(overrides: Partial<TrackState> = {}): TrackState {
  return {
    sourceAppId: "AppleInc.AppleMusicWin_nzyj5cx40ttqa!App",
    title: "Feel",
    artist: "XIRA",
    albumTitle: "",
    artwork: null,
    artworkUrl: null,
    trackUrl: null,
    playbackState: "playing",
    positionSeconds: 0,
    durationSeconds: 180,
    observedAtMs: 1_700_000_000_000,
    ...overrides
  };
}
