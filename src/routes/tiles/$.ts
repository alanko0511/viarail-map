import { createFileRoute } from "@tanstack/react-router"
import { env, waitUntil } from "cloudflare:workers"
import {
  Compression,
  EtagMismatch,
  PMTiles,
  ResolvedValueCache,
  TileType,
  tileTypeExt
} from "pmtiles"
import type {RangeResponse, Source} from "pmtiles";

// --- Path parsing (from protomaps/PMTiles shared/index.ts) ---

function pmtilesPath(name: string): string {
  return name + ".pmtiles"
}

const TILE_RE =
  /^\/(?<NAME>[0-9a-zA-Z\/!\-_.*'()]+)\/(?<Z>\d+)\/(?<X>\d+)\/(?<Y>\d+).(?<EXT>[a-z]+)$/
const TILESET_RE = /^\/(?<NAME>[0-9a-zA-Z\/!\-_.*'()]+).json$/

function tilePath(path: string) {
  const tileMatch = path.match(TILE_RE)
  if (tileMatch) {
    const g = tileMatch.groups!
    return {
      ok: true,
      name: g.NAME,
      tile: [+g.Z, +g.X, +g.Y] as [number, number, number],
      ext: g.EXT,
    }
  }

  const tilesetMatch = path.match(TILESET_RE)
  if (tilesetMatch) {
    const g = tilesetMatch.groups!
    return { ok: true, name: g.NAME, tile: undefined, ext: "json" }
  }

  return { ok: false, name: "", tile: undefined, ext: "" }
}

// --- Decompression ---

async function nativeDecompress(
  buf: ArrayBuffer,
  compression: Compression,
): Promise<ArrayBuffer> {
  if (
    compression === Compression.None ||
    compression === Compression.Unknown
  ) {
    return buf
  }
  if (compression === Compression.Gzip) {
    const stream = new Response(buf).body
    const result = stream?.pipeThrough(new DecompressionStream("gzip"))
    return new Response(result).arrayBuffer()
  }
  throw new Error("Compression method not supported")
}

// --- R2 Source ---

const CACHE = new ResolvedValueCache(25, undefined, nativeDecompress)

class R2Source implements Source {
  archiveName: string

  constructor(archiveName: string) {
    this.archiveName = archiveName
  }

  getKey() {
    return this.archiveName
  }

  async getBytes(
    offset: number,
    length: number,
    _signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    const resp = await env.BUCKET.get(pmtilesPath(this.archiveName), {
      range: { offset, length },
      onlyIf: { etagMatches: etag },
    })

    if (!resp) {
      throw new KeyNotFoundError("Archive not found")
    }

    const o = resp as R2ObjectBody
    if (!o.body) {
      throw new EtagMismatch()
    }

    const a = await o.arrayBuffer()
    return {
      data: a,
      etag: o.etag,
      cacheControl: o.httpMetadata?.cacheControl,
      expires: o.httpMetadata?.cacheExpiry?.toISOString(),
    }
  }
}

class KeyNotFoundError extends Error {}

// --- Route handler ---

const EXT_TO_TYPE: Record<string, TileType> = {
  mvt: TileType.Mvt,
  pbf: TileType.Mvt,
  png: TileType.Png,
  jpg: TileType.Jpeg,
  webp: TileType.Webp,
  avif: TileType.Avif,
}

export const Route = createFileRoute("/tiles/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        // Strip the /tiles prefix to match the reference implementation's path parsing
        const subpath = url.pathname.replace(/^\/tiles/, "")
        const { ok, name, tile, ext } = tilePath(subpath)

        if (!ok) {
          return new Response("Invalid tile URL", { status: 404 })
        }

        // Cloudflare Workers runtime provides caches.default, but DOM lib types shadow it
        const cache = (caches as unknown as { default: Cache }).default
        const cached = await cache.match(request.url)
        if (cached) return cached

        const source = new R2Source(name)
        const p = new PMTiles(source, CACHE, nativeDecompress)

        try {
          const pHeader = await p.getHeader()

          if (!tile) {
            const t = await p.getTileJson(
              `${url.origin}/tiles/${name}`,
            )
            const resp = new Response(JSON.stringify(t), {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=604800",
              },
            })
            waitUntil(cache.put(request.url, resp.clone()))
            return resp
          }

          if (tile[0] < pHeader.minZoom || tile[0] > pHeader.maxZoom) {
            return new Response(undefined, { status: 404 })
          }

          const expectedType = EXT_TO_TYPE[ext]
          if (
            pHeader.tileType !== expectedType &&
            tileTypeExt(pHeader.tileType) !== ""
          ) {
            return new Response(
              `Bad request: requested .${ext} but archive has type ${tileTypeExt(pHeader.tileType)}`,
              { status: 400 },
            )
          }

          const tiledata = await p.getZxy(tile[0], tile[1], tile[2])

          if (!tiledata) {
            return new Response(undefined, { status: 204 })
          }

          const contentType: Record<number, string> = {
            [TileType.Mvt]: "application/x-protobuf",
            [TileType.Png]: "image/png",
            [TileType.Jpeg]: "image/jpeg",
            [TileType.Webp]: "image/webp",
            [TileType.Avif]: "image/avif",
          }

          const resp = new Response(tiledata.data, {
            headers: {
              "Content-Type":
                contentType[pHeader.tileType] ?? "application/octet-stream",
              "Cache-Control": "public, max-age=604800",
            },
          })
          waitUntil(cache.put(request.url, resp.clone()))
          return resp
        } catch (e) {
          if (e instanceof KeyNotFoundError) {
            return new Response("Archive not found", { status: 404 })
          }
          throw e
        }
      },
    },
  },
})
