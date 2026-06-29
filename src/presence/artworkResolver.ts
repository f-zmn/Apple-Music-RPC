import crypto from "node:crypto";
import type { Diagnostics } from "../diagnostics";
import type { TrackState } from "../media/types";

type ArtworkSearchResult = {
  artistName?: string;
  artworkUrl100?: string;
  collectionName?: string;
  trackViewUrl?: string;
  trackName?: string;
};

type ArtworkSearchResponse = {
  resultCount?: number;
  results?: ArtworkSearchResult[];
};

const LOOKUP_TIMEOUT_MS = 4_000;

export type ArtworkResolution = {
  artworkUrl: string | null;
  trackUrl: string | null;
};

export type ArtworkResolverOptions = {
  countryCode: string;
  diagnostics?: Diagnostics;
};

export class ArtworkResolver {
  private readonly cache = new Map<string, ArtworkResolution>();
  private readonly inFlight = new Map<string, Promise<ArtworkResolution>>();
  private readonly countryCode: string;

  constructor(private readonly options: ArtworkResolverOptions) {
    this.countryCode = normalizeCountryCode(options.countryCode);
  }

  async resolve(track: TrackState): Promise<ArtworkResolution> {
    const cacheKey = createCacheKey(track);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? emptyResolution();
    }

    const activeLookup = this.inFlight.get(cacheKey);
    if (activeLookup) {
      return activeLookup;
    }

    const cacheHash = hashCacheKey(cacheKey);
    const lookup = this.lookup(track)
      .then((resolution) => {
        this.cache.set(cacheKey, resolution);
        this.options.diagnostics?.info("artwork.resolved", {
          cacheHash,
          hasArtworkUrl: Boolean(resolution.artworkUrl),
          hasTrackUrl: Boolean(resolution.trackUrl)
        });
        return resolution;
      })
      .catch((error) => {
        const fallback = emptyResolution();
        this.cache.set(cacheKey, fallback);
        this.options.diagnostics?.error("artwork.resolve_failed", error, { cacheHash });
        return fallback;
      })
      .finally(() => {
        this.inFlight.delete(cacheKey);
      });

    this.inFlight.set(cacheKey, lookup);
    return lookup;
  }

  private async lookup(track: TrackState): Promise<ArtworkResolution> {
    const queries = createSearchQueries(track);
    for (const query of queries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
      const response = await fetch(buildITunesSearchUrl(query, this.countryCode), {
        headers: {
          "User-Agent": "Music Presence/1.0"
        },
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`iTunes Search returned ${response.status}`);
      }

      const data = (await response.json()) as ArtworkSearchResponse;
      const resolution = pickBestResolution(data.results ?? [], track);
      if (resolution.artworkUrl || resolution.trackUrl) {
        return resolution;
      }
    }

    return emptyResolution();
  }
}

export function buildITunesSearchUrl(query: string, countryCode: string): string {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "8");
  url.searchParams.set("country", normalizeCountryCode(countryCode));
  return url.toString();
}

export function createSearchQueries(track: Pick<TrackState, "artist" | "title">): string[] {
  const cleanArtist = cleanSearchArtist(track.artist);
  const title = track.title.trim();
  return unique([
    `${title} ${cleanArtist}`.trim(),
    `${title} ${track.artist}`.trim(),
    title
  ]).filter(Boolean);
}

export function cleanSearchArtist(artist: string): string {
  return artist
    .split(/\s+[\u2014\u2013-]\s+/)[0]
    .replace(/\s+/g, " ")
    .trim();
}

export function pickBestArtworkUrl(results: ArtworkSearchResult[], track: Pick<TrackState, "artist" | "title">): string | null {
  return pickBestResolution(results, track).artworkUrl;
}

export function pickBestTrackUrl(results: ArtworkSearchResult[], track: Pick<TrackState, "artist" | "title">): string | null {
  return pickBestResolution(results, track).trackUrl;
}

export function pickBestResolution(
  results: ArtworkSearchResult[],
  track: Pick<TrackState, "artist" | "title">
): ArtworkResolution {
  const scored = results
    .map((result) => ({
      result,
      score: scoreResult(result, track)
    }))
    .filter(({ result, score }) => score > 0 && (Boolean(result.artworkUrl100) || Boolean(result.trackViewUrl)))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.result;
  if (!best) {
    return emptyResolution();
  }

  return {
    artworkUrl: best.artworkUrl100 ? upgradeArtworkUrl(best.artworkUrl100) : null,
    trackUrl: best.trackViewUrl ? normalizeAppleMusicTrackUrl(best.trackViewUrl) : null
  };
}

export function upgradeArtworkUrl(url: string): string {
  return url.replace(/\/\d+x\d+bb\.(jpg|jpeg|png|webp)$/i, "/512x512bb.$1");
}

export function resolveCountryCode(locale: string | undefined): string {
  const region = locale?.match(/[-_]([A-Za-z]{2})\b/)?.[1];
  return normalizeCountryCode(region ?? "US");
}

function scoreResult(result: ArtworkSearchResult, track: Pick<TrackState, "artist" | "title">): number {
  const resultTitle = normalizeForMatch(result.trackName ?? "");
  const wantedTitle = normalizeForMatch(track.title);
  const resultArtist = normalizeForMatch(result.artistName ?? "");
  const wantedArtist = normalizeForMatch(cleanSearchArtist(track.artist));
  const collection = normalizeForMatch(result.collectionName ?? "");

  let score = 0;
  if (resultTitle === wantedTitle) {
    score += 100;
  } else if (resultTitle.includes(wantedTitle) || wantedTitle.includes(resultTitle)) {
    score += 60;
  }

  if (resultArtist === wantedArtist) {
    score += 50;
  } else if (hasTokenOverlap(resultArtist, wantedArtist)) {
    score += 25;
  }

  if (collection.includes(wantedTitle)) {
    score += 10;
  }

  return score;
}

function emptyResolution(): ArtworkResolution {
  return {
    artworkUrl: null,
    trackUrl: null
  };
}

function normalizeAppleMusicTrackUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "music.apple.com") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function createCacheKey(track: Pick<TrackState, "artist" | "title">): string {
  return `${normalizeForMatch(track.title)}|${normalizeForMatch(cleanSearchArtist(track.artist))}`;
}

function hashCacheKey(cacheKey: string): string {
  return crypto.createHash("sha256").update(cacheKey).digest("hex").slice(0, 12);
}

function hasTokenOverlap(a: string, b: string): boolean {
  const aTokens = new Set(a.split(" ").filter((token) => token.length > 2));
  return b.split(" ").some((token) => token.length > 2 && aTokens.has(token));
}

function normalizeCountryCode(countryCode: string): string {
  return /^[A-Za-z]{2}$/.test(countryCode) ? countryCode.toUpperCase() : "US";
}

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\[[^\]]*]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
