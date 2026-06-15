import crypto from "node:crypto";
import { PlaybackStatusCode, type PlaybackState, type RawMediaInfo, type TrackArtwork, type TrackState } from "./types";

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
    artwork: normalizeArtwork(session.media.thumbnail),
    playbackState: normalizePlaybackState(session.playback.playbackStatus),
    positionSeconds: normalizeSeconds(session.timeline?.position),
    durationSeconds: normalizeSeconds(session.timeline?.duration),
    observedAtMs: normalizeTimestamp(session.lastUpdatedTime) ?? nowMs
  };
}

function normalizeArtwork(value: Uint8Array | undefined): TrackArtwork | null {
  if (!value || value.byteLength === 0) {
    return null;
  }

  const buffer = Buffer.from(value);
  const mimeType = detectMimeType(buffer);
  if (!mimeType) {
    return null;
  }

  return {
    dataBase64: buffer.toString("base64"),
    hash: crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16),
    mimeType
  };
}

function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }

  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }

  return null;
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
