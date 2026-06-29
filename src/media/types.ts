export const enum PlaybackStatusCode {
  Closed = 0,
  Opened = 1,
  Changing = 2,
  Stopped = 3,
  Playing = 4,
  Paused = 5
}

export type PlaybackState = "playing" | "paused" | "stopped" | "unknown";

export type RawMediaInfo = {
  sourceAppId: string;
  media: {
    title?: string;
    artist?: string;
    albumTitle?: string;
    albumArtist?: string;
    thumbnail?: Uint8Array;
  };
  playback: {
    playbackStatus?: number;
  };
  timeline?: {
    position?: number;
    duration?: number;
  };
  lastUpdatedTime?: number;
};

export type TrackArtwork = {
  dataBase64: string;
  hash: string;
  mimeType: string;
};

export type TrackState = {
  sourceAppId: string;
  title: string;
  artist: string;
  albumTitle: string;
  artwork: TrackArtwork | null;
  artworkUrl?: string | null;
  trackUrl?: string | null;
  playbackState: PlaybackState;
  positionSeconds: number | null;
  durationSeconds: number | null;
  observedAtMs: number;
};

export type MediaWorkerMessage =
  | { type: "ready" }
  | { type: "track"; track: TrackState | null }
  | { type: "error"; message: string };

export type MediaWorkerCommand = { type: "refresh" } | { type: "shutdown" };
