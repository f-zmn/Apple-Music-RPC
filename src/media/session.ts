import { PlaybackStatusCode, type PlaybackState, type RawMediaInfo, type TrackState } from "./types";

export function isAppleMusicSession(session: Pick<RawMediaInfo, "sourceAppId">, sourcePrefix: string): boolean {
  return session.sourceAppId.toLowerCase().startsWith(sourcePrefix.toLowerCase());
}

export function pickAppleMusicSession(sessions: RawMediaInfo[], sourcePrefix: string): RawMediaInfo | null {
  const matches = sessions.filter((session) => isAppleMusicSession(session, sourcePrefix));
  if (matches.length === 0) {
    return null;
  }

  return (
    matches.find((session) => normalizePlaybackState(session.playback.playbackStatus) === "playing") ??
    matches.find((session) => normalizePlaybackState(session.playback.playbackStatus) === "paused") ??
    matches[0]
  );
}

export function normalizeTrackState(session: RawMediaInfo, nowMs = Date.now()): TrackState {
  return {
    sourceAppId: session.sourceAppId,
    title: cleanText(session.media.title) || "Unknown title",
    artist: cleanText(session.media.artist) || cleanText(session.media.albumArtist) || "Unknown artist",
    albumTitle: cleanText(session.media.albumTitle),
    playbackState: normalizePlaybackState(session.playback.playbackStatus),
    positionSeconds: normalizeSeconds(session.timeline?.position),
    durationSeconds: normalizeSeconds(session.timeline?.duration),
    observedAtMs: normalizeTimestamp(session.lastUpdatedTime) ?? nowMs
  };
}

export function normalizePlaybackState(status: number | undefined): PlaybackState {
  switch (status) {
    case PlaybackStatusCode.Playing:
      return "playing";
    case PlaybackStatusCode.Paused:
      return "paused";
    case PlaybackStatusCode.Stopped:
    case PlaybackStatusCode.Closed:
      return "stopped";
    default:
      return "unknown";
  }
}

function cleanText(value: string | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeSeconds(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function normalizeTimestamp(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}
