import type { SetActivity } from "@xhayper/discord-rpc/dist/structures/ClientUser";
import type { TrackState } from "../media/types";

export type PresencePayload = {
  activity: SetActivity;
  signature: string;
  summary: string;
};

const ACTIVITY_TYPE_LISTENING = 2;
const MAX_TEXT_LENGTH = 128;

export function createPresencePayload(track: TrackState): PresencePayload | null {
  if (track.playbackState === "stopped" || track.playbackState === "unknown") {
    return null;
  }

  const details = truncate(track.title, MAX_TEXT_LENGTH);
  const baseArtist = truncate(track.artist, MAX_TEXT_LENGTH);
  const state = track.playbackState === "paused" ? truncate(`Paused - ${baseArtist}`, MAX_TEXT_LENGTH) : baseArtist;
  const activity: SetActivity = {
    name: truncate(`${track.title} auf Apple Music`, MAX_TEXT_LENGTH),
    type: ACTIVITY_TYPE_LISTENING,
    details,
    state,
    instance: false,
    statusDisplayType: 2
  };

  if (track.artworkUrl) {
    activity.largeImageKey = track.artworkUrl;
    activity.largeImageText = track.albumTitle ? truncate(track.albumTitle, MAX_TEXT_LENGTH) : details;
  }

  const timestamps = createTimestamps(track);
  if (track.playbackState === "playing" && timestamps) {
    activity.startTimestamp = timestamps.startTimestamp;
    activity.endTimestamp = timestamps.endTimestamp;
  }

  return {
    activity,
    signature: createActivitySignature(activity),
    summary: `${details} - ${baseArtist}`
  };
}

export function createActivitySignature(activity: SetActivity): string {
  return JSON.stringify({
    type: activity.type,
    name: activity.name,
    details: activity.details,
    state: activity.state,
    largeImageKey: activity.largeImageKey,
    startTimestamp: normalizeTimestampForSignature(activity.startTimestamp),
    endTimestamp: normalizeTimestampForSignature(activity.endTimestamp)
  });
}

function createTimestamps(track: TrackState): { startTimestamp: Date; endTimestamp: Date } | null {
  const { positionSeconds, durationSeconds } = track;
  if (
    positionSeconds === null ||
    durationSeconds === null ||
    durationSeconds <= 0 ||
    positionSeconds < 0 ||
    positionSeconds >= durationSeconds + 1
  ) {
    return null;
  }

  const startMs = track.observedAtMs - positionSeconds * 1000;
  const endMs = startMs + durationSeconds * 1000;
  return {
    startTimestamp: new Date(startMs),
    endTimestamp: new Date(endMs)
  };
}

function normalizeTimestampForSignature(value: SetActivity["startTimestamp"]): number | null {
  if (!value) {
    return null;
  }

  const ms = value instanceof Date ? value.getTime() : value;
  return Math.round(ms / 5000) * 5;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength - 1).trimEnd() + "...";
}
