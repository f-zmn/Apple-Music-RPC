import { describe, expect, it } from "vitest";
import {
  buildITunesSearchUrl,
  cleanSearchArtist,
  createSearchQueries,
  pickBestArtworkUrl,
  pickBestResolution,
  pickBestTrackUrl,
  resolveCountryCode,
  upgradeArtworkUrl
} from "../src/presence/artworkResolver";

describe("artwork resolver helpers", () => {
  it("cleans Apple Music artist strings before searching", () => {
    expect(cleanSearchArtist("DJ Rob Ru \u2014 Where You Go - Single")).toBe("DJ Rob Ru");
    expect(cleanSearchArtist("MARE, NALYRO, Lawstylez & Mike Gudmann \u2014 Riverside - Single")).toBe(
      "MARE, NALYRO, Lawstylez & Mike Gudmann"
    );
  });

  it("builds stable iTunes Search URLs", () => {
    const url = buildITunesSearchUrl("Where You Go DJ Rob Ru", "de");

    expect(url).toContain("https://itunes.apple.com/search?");
    expect(url).toContain("term=Where+You+Go+DJ+Rob+Ru");
    expect(url).toContain("country=DE");
    expect(url).toContain("entity=song");
  });

  it("creates fallback queries from title and artist", () => {
    expect(createSearchQueries({ title: "Where You Go", artist: "DJ Rob Ru \u2014 Where You Go - Single" })).toEqual([
      "Where You Go DJ Rob Ru",
      "Where You Go DJ Rob Ru \u2014 Where You Go - Single",
      "Where You Go"
    ]);
  });

  it("upgrades Apple artwork URLs to Discord-friendly dimensions", () => {
    expect(upgradeArtworkUrl("https://is1-ssl.mzstatic.com/image/thumb/example/cover.jpg/100x100bb.jpg")).toBe(
      "https://is1-ssl.mzstatic.com/image/thumb/example/cover.jpg/512x512bb.jpg"
    );
  });

  it("picks the best matching artwork URL", () => {
    const url = pickBestArtworkUrl(
      [
        {
          artistName: "Someone Else",
          artworkUrl100: "https://example.com/wrong/100x100bb.jpg",
          collectionName: "Other",
          trackName: "Wrong"
        },
        {
          artistName: "DJ Rob Ru",
          artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg/100x100bb.jpg",
          collectionName: "Where You Go - Single",
          trackName: "Where You Go"
        }
      ],
      { title: "Where You Go", artist: "DJ Rob Ru \u2014 Where You Go - Single" }
    );

    expect(url).toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg/512x512bb.jpg");
  });

  it("picks the Apple Music web URL from the best match", () => {
    const url = pickBestTrackUrl(
      [
        {
          artistName: "DJ Rob Ru",
          collectionName: "Where You Go - Single",
          trackName: "Where You Go",
          trackViewUrl: "https://music.apple.com/de/album/where-you-go/123456789?i=987654321&uo=4"
        }
      ],
      { title: "Where You Go", artist: "DJ Rob Ru" }
    );

    expect(url).toBe("https://music.apple.com/de/album/where-you-go/123456789?i=987654321&uo=4");
  });

  it("returns artwork and track URL from one best match", () => {
    const result = pickBestResolution(
      [
        {
          artistName: "DJ Rob Ru",
          artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg/100x100bb.jpg",
          collectionName: "Where You Go - Single",
          trackName: "Where You Go",
          trackViewUrl: "https://music.apple.com/de/album/where-you-go/123456789?i=987654321&uo=4"
        }
      ],
      { title: "Where You Go", artist: "DJ Rob Ru" }
    );

    expect(result).toEqual({
      artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music/cover.jpg/512x512bb.jpg",
      trackUrl: "https://music.apple.com/de/album/where-you-go/123456789?i=987654321&uo=4"
    });
  });

  it("rejects non-Apple Music track URLs", () => {
    const url = pickBestTrackUrl(
      [
        {
          artistName: "DJ Rob Ru",
          collectionName: "Where You Go - Single",
          trackName: "Where You Go",
          trackViewUrl: "https://example.com/where-you-go"
        }
      ],
      { title: "Where You Go", artist: "DJ Rob Ru" }
    );

    expect(url).toBeNull();
  });

  it("derives a country code from locale", () => {
    expect(resolveCountryCode("de-DE")).toBe("DE");
    expect(resolveCountryCode("en_US")).toBe("US");
    expect(resolveCountryCode(undefined)).toBe("US");
  });
});
