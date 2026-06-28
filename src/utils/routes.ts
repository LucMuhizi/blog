import { SITE_CONFIG } from "@/config/site"

export function withTrailingSlash(path: string): string {
  if (path === "") return "/"
  return path.endsWith("/") ? path : `${path}/`
}

export function normalizePath(path: string): string {
  const next = path.startsWith("/") ? path : `/${path}`
  return withTrailingSlash(next)
}

export function localePath(path = "/"): string {
  return normalizePath(path)
}

export function canonicalUrl(path = "/"): string {
  return `${SITE_CONFIG.url}${normalizePath(path)}`
}

export function buildAlternates(path = "/"): Record<string, string> {
  const url = canonicalUrl(path)
  return {
    "en-US": url,
    "x-default": url,
  }
}
