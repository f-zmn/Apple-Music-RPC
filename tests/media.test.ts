import { describe, expect, it } from "vitest";
import { DEFAULT_APPLE_MUSIC_SOURCE_PREFIX } from "../src/config";
import { normalizeTrackState, pickAppleMusicSession } from "../src/media/session";
import { PlaybackStatusCode, type RawMediaInfo } from "../src/media/types";

describe("media session selection", () => {
  it("filters Apple Music sessions by source prefix", () => {
    const sessions: RawMediaInfo[] = [
      createSession("Chrome", "Browser track", PlaybackStatusCode.Playing),
      createSession("AppleInc.AppleMusicWin_nzyj5cx40ttqa!App", "Apple track", PlaybackStatusCode.Paused)
    ];

    const session = pickAppleMusicSession(sessions, DEFAULT_APPLE_MUSIC_SOURCE_PREFIX);

    expect(session?.media.title).toBe("Apple track");
  });

  it("prefers a playing Apple Music session over a paused one", () => {
    const sessions: RawMediaInfo[] = [
      createSession("AppleInc.AppleMusicWin_secondary!App", "Paused track", PlaybackStatusCode.Paused),
      createSession("AppleInc.AppleMusicWin_nzyj5cx40ttqa!App", "Playing track", PlaybackStatusCode.Playing)
    ];

    const session = pickAppleMusicSession(sessions, DEFAULT_APPLE_MUSIC_SOURCE_PREFIX);

    expect(session?.media.title).toBe("Playing track");
  });

  it("normalizes missing title and artist values", () => {
    const track = normalizeTrackState(
      {
        sourceAppId: "AppleInc.AppleMusicWin_nzyj5cx40ttqa!App",
        media: { title: " ", artist: "", albumArtist: " Album Artist " },
        playback: { playbackStatus: PlaybackStatusCode.Playing },
        timeline: { position: 12.4, duration: 180 },
        lastUpdatedTime: 1_700_000_000_000
      },
      1_800_000_000_000
    );

    expect(track.title).toBe("Unknown title");
    expect(track.artist).toBe("Album Artist");
    expect(track.playbackState).toBe("playing");
    expect(track.positionSeconds).toBe(12.4);
    expect(track.durationSeconds).toBe(180);
    expect(track.observedAtMs).toBe(1_700_000_000_000);
  });
});

function createSession(sourceAppId: string, title: string, playbackStatus: PlaybackStatusCode): RawMediaInfo {
  return {
    sourceAppId,
    media: {
      title,
      artist: "Artist",
      albumTitle: "",
      albumArtist: ""
    },
    playback: {
      playbackStatus
    },
    timeline: {
      position: 10,
      duration: 120
    },
    lastUpdatedTime: 1_700_000_000_000
  };
}
