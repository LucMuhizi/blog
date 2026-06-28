const CONTENT_EXTENSION_RE = /\.(md|mdx|markdown)$/i
const DEFAULT_LOCALE_PREFIX_RE = /^en\//

export function stripContentExtension(value: string): string {
  return value.replace(CONTENT_EXTENSION_RE, "")
}

export function normalizeContentSlug(value: string): string {
  return stripContentExtension(value).replace(DEFAULT_LOCALE_PREFIX_RE, "")
}
