import http from "node:http";
import { nativeImage } from "electron";
import type { Diagnostics } from "../diagnostics";
import type { TrackArtwork } from "../media/types";

export class ArtworkServer {
  private server: http.Server | null = null;
  private port: number | null = null;
  private current: { buffer: Buffer; hash: string; mimeType: string } | null = null;

  constructor(private readonly diagnostics?: Diagnostics) {}

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = http.createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/cover" || !this.current) {
        response.writeHead(404);
        response.end();
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": this.current.buffer.length,
        "Content-Type": this.current.mimeType,
        "ETag": `"${this.current.hash}"`
      });
      response.end(this.current.buffer);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(0, "127.0.0.1", () => resolve());
    });

    const address = this.server.address();
    this.port = typeof address === "object" && address ? address.port : null;
    this.diagnostics?.info("artwork.server_started", { port: this.port });
  }

  updateArtwork(artwork: TrackArtwork | null): string | null {
    if (!artwork || !this.port) {
      this.current = null;
      return null;
    }

    const normalized = normalizeArtwork(artwork);
    if (!normalized) {
      this.current = null;
      this.diagnostics?.info("artwork.unsupported");
      return null;
    }

    this.current = normalized;
    this.diagnostics?.info("artwork.updated", {
      hash: normalized.hash,
      mimeType: normalized.mimeType
    });
    return `http://127.0.0.1:${this.port}/cover?hash=${normalized.hash}`;
  }

  close(): void {
    this.server?.close();
    this.server = null;
    this.port = null;
    this.current = null;
  }
}

function normalizeArtwork(artwork: TrackArtwork): { buffer: Buffer; hash: string; mimeType: string } | null {
  const original = Buffer.from(artwork.dataBase64, "base64");

  if (artwork.mimeType === "image/jpeg" || artwork.mimeType === "image/png" || artwork.mimeType === "image/webp") {
    return {
      buffer: original,
      hash: artwork.hash,
      mimeType: artwork.mimeType
    };
  }

  const image = nativeImage.createFromBuffer(original);
  if (image.isEmpty()) {
    return null;
  }

  return {
    buffer: image.toPNG(),
    hash: artwork.hash,
    mimeType: "image/png"
  };
}
