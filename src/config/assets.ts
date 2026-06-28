import { SITE_CONFIG } from "@/config/site"
import type { RemoteImagePattern } from "@/config/site"

export type ImageSourceKind = "asset" | "public" | "remote"

function normalizeUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/$/, "")
}

const publicAssetBaseUrl = normalizeUrl(SITE_CONFIG.assets.publicBaseUrl)

export const ASSET_CONFIG = {
  publicAssetBaseUrl,
  allowedRemotePatterns: SITE_CONFIG.assets.remotePatterns,
  objectKeyPattern: "posts/{locale}/{slug}/{hash}.{ext}",
}

function matchesRemotePattern(url: URL, pattern: RemoteImagePattern): boolean {
  if (url.protocol.replace(":", "") !== pattern.protocol) return false
  if (pattern.hostname.startsWith("*.")) {
    const hostname = pattern.hostname.slice(2)
    return url.hostname === hostname || url.hostname.endsWith(`.${hostname}`)
  }
  return url.hostname === pattern.hostname
}

export function isAllowedRemoteImage(src: string): boolean {
  try {
    const url = new URL(src)
    return (
      url.protocol === "https:" &&
      ASSET_CONFIG.allowedRemotePatterns.some((pattern) =>
        matchesRemotePattern(url, pattern)
      )
    )
  } catch {
    return false
  }
}

export function resolveImageSource(src: string): {
  kind: ImageSourceKind
  src: string
} {
  if (/^https:\/\//.test(src)) {
    if (!isAllowedRemoteImage(src)) {
      throw new Error(`Remote image host is not allowed: ${src}`)
    }
    return { kind: "remote", src }
  }

  if (src.startsWith("/")) {
    return { kind: "public", src }
  }

  return { kind: "asset", src }
}

export function optimizeRemoteImageUrl(src: string, width?: number): string {
  try {
    const url = new URL(src)
    if (url.hostname !== SITE_CONFIG.assets.unsplashImageHost) return src

    url.searchParams.set("auto", "format")
    url.searchParams.set("fit", "crop")
    url.searchParams.set("w", String(Math.min(width ?? 720, 720)))
    url.searchParams.set("q", "65")

    return url.toString()
  } catch {
    return src
  }
}
