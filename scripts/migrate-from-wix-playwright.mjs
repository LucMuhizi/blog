#!/usr/bin/env node
/**
 * migrate-from-wix-playwright.mjs
 *
 * Public-site scraping fallback for scripts/migrate-from-wix.mjs. Use this
 * when the Wix Headless API key lacks the Blog scope, or the Wix Blog app
 * isn't connected to your Headless project. Drives a real Chromium browser
 * via Playwright so it works against the Wix React SPA — a plain HTTP fetch
 * can't see posts because they render client-side.
 *
 * Produces the SAME outputs as the API script:
 *   - scripts/.migration/{dump.json, plan.json, report.md}
 *   - src/content/posts/en/*.mdx
 *   - src/content/authors/en/*.mdx (limited — Wix blog usually doesn't
 *     expose author collections; we only emit what we see)
 *   - public/uploads/migrated/{slug}-hero.{ext} and inline image binaries
 *
 * Modes (mirrors the API script):
 *   --plan (default)  Scrape + write {dump,plan,report}. No MDX written.
 *   --live --confirm  Read plan.json and write MDX files.
 *   --force           Overwrite existing MDX files in --live mode.
 *   --fresh           Refetch even if dump.json exists.
 *   --verbose         Log every visit and conversion decision.
 *   --headed          Run Playwright with a visible browser (debug only).
 *   --concurrency N   Parallel post-detail pages (default 4).
 *   -h, --help        Show this message.
 *
 * Environment (.env.local auto-loaded if invoked with --env-file-if-exists):
 *   WIX_SITE_URL      Public URL of the legacy Wix site (required).
 *                       Examples:
 *                         https://yourname.wixsite.com/yourname
 *                         https://www.yourlegacy.com
 *   WIX_LIST_PATH     Bare path to the blog index. Default: /blog-1
 *                       (the Wix Blog app's default slug).
 *   WIX_USER_AGENT    Override the User-Agent string. Default: a recent
 *                       Chrome on Windows so Wix doesn't block us.
 *
 * Install requirements before first run:
 *   pnpm add -D playwright && pnpm add turndown
 *   npx playwright install chromium
 */

import path from "node:path"
import process from "node:process"
import {
  mkdir,
  writeFile,
  readFile,
  access,
} from "node:fs/promises"
import { constants as fsConstants } from "node:fs"
import { fileURLToPath } from "node:url"

// ---------- Configuration ----------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, "..")
const POSTS_DIR = path.join(PROJECT_ROOT, "src/content/posts/en")
const AUTHORS_DIR = path.join(PROJECT_ROOT, "src/content/authors/en")
const UPLOADS_DIR = path.join(PROJECT_ROOT, "public/uploads/migrated")
const MIGRATION_DIR = path.join(PROJECT_ROOT, "scripts/.migration")
const DUMP_PATH = path.join(MIGRATION_DIR, "dump.json")
const PLAN_PATH = path.join(MIGRATION_DIR, "plan.json")
const REPORT_PATH = path.join(MIGRATION_DIR, "report.md")

const DEFAULT_LIST_PATH = "/blog-1"
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
const DEFAULT_CONCURRENCY = 4
const POST_PAGE_TIMEOUT_MS = 15000
const LIST_PAGE_TIMEOUT_MS = 15000
const SITEMAP_TIMEOUT_MS = 10000

// ---------- Optional dependency guards --------------------------------------

let _turndown = null
async function loadTurndown() {
  if (_turndown) return _turndown
  try {
    const mod = await import("turndown")
    _turndown = mod.default
    return _turndown
  } catch {
    throw new Error(
      "turndown is not installed. Run `pnpm add turndown` before invoking this script.",
    )
  }
}

let _playwright = null
async function loadPlaywright() {
  if (_playwright) return _playwright
  try {
    _playwright = await import("playwright")
    return _playwright
  } catch {
    throw new Error(
      "playwright is not installed. Run `pnpm add -D playwright && npx playwright install chromium` before invoking this script.",
    )
  }
}

// ---------- CLI --------------------------------------------------------------

function printHelp() {
  console.log(`Usage: node scripts/migrate-from-wix-playwright.mjs [options]

Options:
  --plan           Scrape + write dump.json, plan.json, report.md (default).
  --live           Read the existing plan.json and write MDX files.
  --force          (with --live) Overwrite MDX files that already exist.
  --confirm        Required to actually write files with --live.
  --fresh          Refetch from the public site even if dump.json exists.
  --verbose        Log every visit and conversion decision.
  --headed         Run Playwright with a visible browser window.
  --concurrency N  How many post pages in parallel (default ${DEFAULT_CONCURRENCY}).
  -h, --help       Show this message.

Environment (read via process.env, auto-loaded from .env.local if Node 22
--env-file-if-exists=.env.local is used):

  WIX_SITE_URL     Public URL of the legacy Wix site. Required.
  WIX_LIST_PATH    Bare path to the blog index. Default ${DEFAULT_LIST_PATH}
                   (the Wix Blog app's default slug).
  WIX_USER_AGENT   Override the User-Agent string.
`)
}

function parseArgs(argv) {
  const args = {
    mode: "plan",
    force: false,
    confirm: false,
    freshDump: false,
    verbose: false,
    headed: false,
    concurrency: DEFAULT_CONCURRENCY,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case "--plan":
        args.mode = "plan"
        break
      case "--live":
        args.mode = "live"
        break
      case "--force":
        args.force = true
        break
      case "--confirm":
        args.confirm = true
        break
      case "--fresh":
        args.freshDump = true
        break
      case "--verbose":
        args.verbose = true
        break
      case "--headed":
        args.headed = true
        break
      case "--help":
      case "-h":
        printHelp()
        process.exit(0)
      default:
        if (a === "--concurrency" && argv[i + 1]) {
          const n = Number(argv[++i])
          if (Number.isFinite(n) && n > 0) args.concurrency = n
          else throw new Error("--concurrency expects a positive integer")
          break
        }
        if (a.startsWith("--")) throw new Error(`Unknown flag: ${a}`)
    }
  }
  return args
}

// ---------- Logging helpers --------------------------------------------------

function log(line) {
  console.log(line)
}

function warn(line) {
  console.warn(`! ${line}`)
}

function verboseLog(args, line) {
  if (args.verbose) log(line)
}

// ---------- File helpers ------------------------------------------------------

async function pathExists(p) {
  try {
    await access(p, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function readJsonOrNull(p) {
  if (!(await pathExists(p))) return null
  return JSON.parse(await readFile(p, "utf8"))
}

async function ensureDir(p) {
  await mkdir(p, { recursive: true })
}

// ---------- Category & tag mapping -------------------------------------------
// (Identical tables to scripts/migrate-from-wix.mjs so the resulting MDX
// frontmatter matches.)

function slugify(s) {
  const stripped = (s ?? "")
    .toString()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
  if (stripped.length > 0) return stripped
  const hex = Buffer.from((s ?? "").toString(), "utf8")
    .toString("hex")
    .slice(0, 60)
  return hex || "untitled"
}

const CATEGORY_ALIAS_MAP = new Map([
  ["blog", "articles"],
  ["article", "articles"],
  ["articles", "articles"],
  ["post", "articles"],
  ["posts", "articles"],
  ["essay", "articles"],
  ["essays", "articles"],
  ["opinion", "articles"],
  ["research", "research"],
  ["report", "research"],
  ["reports", "research"],
  ["analysis", "research"],
  ["policy", "policy"],
  ["policies", "policy"],
  ["brief", "policy"],
  ["briefs", "policy"],
  ["speaking", "speaking"],
  ["press", "speaking"],
  ["media", "speaking"],
  ["interview", "speaking"],
  ["interviews", "speaking"],
  ["talks", "speaking"],
  ["notes", "notes"],
  ["thought", "notes"],
  ["thoughts", "notes"],
  ["projects", "projects"],
  ["project", "projects"],
  ["case-study", "projects"],
  ["case-studies", "projects"],
  ["work", "projects"],
])

function mapWixCategoryToSlug(wixLabel) {
  const fallback = "articles"
  if (!wixLabel) return fallback
  const normalized = slugify(wixLabel)
  if (CATEGORY_ALIAS_MAP.has(normalized)) return CATEGORY_ALIAS_MAP.get(normalized)
  return normalized
}

function mapWixTagToSlug(wixLabel) {
  if (!wixLabel) return null
  return slugify(wixLabel) || null
}

// ---------- Browser bootstrap ------------------------------------------------

async function launchBrowser(args) {
  const { chromium } = await loadPlaywright()
  return chromium.launch({
    headless: !args.headed,
    args: args.headed ? [] : ["--no-sandbox", "--disable-dev-shm-usage"],
  })
}

async function newPage(browser, siteUrl, args) {
  const context = await browser.newContext({
    userAgent: process.env.WIX_USER_AGENT || DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  })
  const page = await context.newPage()
  if (args.verbose) {
    page.on("requestfailed", (r) =>
      warn(`[net-fail] ${r.url()} (${r.failure()?.errorText ?? "?"})`),
    )
  }
  return page
}

async function closeBrowser(browser) {
  try {
    await browser.close()
  } catch {
    /* swallow on shutdown */
  }
}

// ---------- Sitemap discovery ------------------------------------------------
// Wix generates a /sitemap.xml by default. We parse it before touching the
// browser so discovery is O(1) network round-trip and gives zero false
// positives on a well-configured site. Falls back to homepage link scan when
// the sitemap doesn't exist or doesn't list posts.

async function fetchText(url, timeoutMs) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": process.env.WIX_USER_AGENT || DEFAULT_USER_AGENT },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return await res.text()
  } finally {
    clearTimeout(id)
  }
}

async function discoverPostUrls(args) {
  const siteUrl = process.env.WIX_SITE_URL
  if (!siteUrl) {
    throw new Error(
      "Missing WIX_SITE_URL. Set it in .env.local (e.g. https://yourname.wixsite.com/yourname) or export it before running.",
    )
  }

  const cleanedSite = siteUrl.replace(/\/$/, "")
  const listPath = (process.env.WIX_LIST_PATH || DEFAULT_LIST_PATH).replace(/^\//, "")
  const listUrl = `${cleanedSite}/${listPath}`

  verboseLog(args, `[sitemap] GET ${cleanedSite}/sitemap.xml`)
  try {
    const xml = await fetchText(`${cleanedSite}/sitemap.xml`, SITEMAP_TIMEOUT_MS)
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1])
    const filtered = locs.filter((href) => {
      try {
        const u = new URL(href)
        const p = u.pathname.toLowerCase()
        // Posts live under the blog index path. They should be deeper than
        // the list URL itself, not the same URL, not /post-sitemap sub-files.
        if (p === `/${listPath}`) return false
        if (p.startsWith("/post-sitemap") || p.endsWith(".xml")) return false
        if (u.hostname !== new URL(cleanedSite).hostname) return false
        return p.startsWith(`/${listPath}/`) || p.startsWith("/post/")
      } catch {
        return false
      }
    })
    if (filtered.length > 0) {
      verboseLog(args, `[sitemap] found ${filtered.length} post URLs`)
      return { listUrl, postUrls: [...new Set(filtered)], source: "sitemap" }
    }
    verboseLog(args, "[sitemap] no post URLs in sitemap.xml; falling back to homepage scan")
  } catch (e) {
    verboseLog(args, `[sitemap] ${e.message}; falling back to list page scan`)
  }

  // Fallback: visit the list page once and harvest post URLs.
  const browser = await launchBrowser(args)
  try {
    const page = await newPage(browser, cleanedSite, args)
    await page.goto(listUrl, {
      waitUntil: "domcontentloaded",
      timeout: LIST_PAGE_TIMEOUT_MS,
    })
    await page
      .waitForSelector("a[href]", { state: "attached", timeout: LIST_PAGE_TIMEOUT_MS })
      .catch(() => {})
    const harvested = await page.evaluate((base) => {
      const out = new Set()
      const basePath = new URL(base).pathname.replace(/\/$/, "")
      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href") || ""
        try {
          const u = new URL(href, base)
          const p = u.pathname
          if (!p.startsWith(basePath + "/")) continue
          if (p.split("/").filter(Boolean).length < 3) continue
          out.add(u.toString())
        } catch {
          /* skip */
        }
      }
      return [...out]
    }, listUrl)
    verboseLog(args, `[fallback] harvested ${harvested.length} URLs from ${listUrl}`)
    return { listUrl, postUrls: harvested, source: "fallback" }
  } finally {
    await closeBrowser(browser)
  }
}

// ---------- Per-post extraction (browser) ------------------------------------
//
// Extraction order (thinker recommendation):
//   1. JSON-LD BlogPosting (most reliable when present)
//   2. og:* / article:published_time meta tags
//   3. DOM selectors (h1, [data-testid="richTextElement"], etc.)
//
// Inline `<img>` references are extracted from the body HTML before turndown
// conversion. Each image is downloaded to public/uploads/migrated/, and the
// HTML src is rewritten to point at the local path. This matches the API
// script's local-path convention so heroImage with `/uploads/` prefix skips
// the remote width/height schema check.

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

async function extractFromPage(page, sourceUrl) {
  await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: POST_PAGE_TIMEOUT_MS })
  await page
    .waitForSelector('article, [data-testid="richTextElement"]', {
      state: "attached",
      timeout: POST_PAGE_TIMEOUT_MS,
    })
    .catch(() => {})

  const jsonLd = await page.evaluate(() => {
    const found = []
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const parsed = JSON.parse(s.textContent || "{}")
        if (Array.isArray(parsed)) found.push(...parsed)
        else found.push(parsed)
      } catch {
        /* skip invalid JSON-LD */
      }
    }
    const posting = found.find(
      (x) => x && (x["@type"] === "BlogPosting" || x["@type"] === "Article"),
    )
    return posting || null
  })

  const meta = await page.evaluate(() => {
    const out = {}
    for (const m of document.querySelectorAll("meta")) {
      const k = m.getAttribute("property") || m.getAttribute("name")
      const v = m.getAttribute("content")
      if (k && v) out[k] = v
    }
    return out
  })

  const bodyCandidates = await page.evaluate(() => {
    const nodes = [
      document.querySelector("article"),
      document.querySelector('[data-testid="richTextElement"]'),
      document.querySelector('[data-hook="post-content"]'),
      document.querySelector("main"),
    ].filter(Boolean)
    return nodes.map((n) => n.innerHTML)
  })
  const bodyHtml = bodyCandidates[0] || ""

  const tagLinks = await page.evaluate(() => {
    const out = new Set()
    const selectors = [
      'a[href*="/category/"]',
      'a[href*="/tag/"]',
      '[data-hook="tag"] a',
      '[data-hook="categories"] a',
    ]
    for (const sel of selectors) {
      for (const a of document.querySelectorAll(sel)) {
        const t = (a.textContent || "").trim()
        if (t) out.add(t)
      }
    }
    return [...out]
  })

  // Merge signals: JSON-LD > meta > DOM, line by line.
  const pick = (...vals) => vals.find((v) => v && String(v).trim() !== "") || ""

  const ld = jsonLd || {}
  const ldImage = Array.isArray(ld.image)
    ? ld.image[0]?.url
    : typeof ld.image === "string"
      ? ld.image
      : ld.image?.url
  const ldAuthor = Array.isArray(ld.author)
    ? ld.author[0]?.name
    : ld.author?.name

  // Read the document title once (Wix sets window.title via the React shell).
  const docTitle = await page.title()
  const finalTitle = pick(ld.headline, meta["og:title"], docTitle)

  const coverUrl = pick(
    ldImage && absoluteUrl(ldImage, sourceUrl),
    absoluteUrl(meta["og:image"] || "", sourceUrl),
  )
  const ldImageAltText = Array.isArray(ld.image)
    ? ld.image[0]?.altText
    : typeof ld.image === "object" && ld.image !== null
      ? ld.image?.altText ?? ld.image?.caption
      : null
  const coverAlt = pick(ldImageAltText, meta["og:image:alt"], finalTitle)

  const pubDate = pick(
    ld.datePublished,
    meta["article:published_time"],
    meta["published_time"],
  )
  const updated = pick(ld.dateModified, meta["article:modified_time"])
  const authorName = pick(ldAuthor, meta["author"])

  const excerpt = pick(
    ld.description,
    meta["og:description"],
    meta["description"],
  )

  return {
    title: finalTitle,
    coverUrl,
    coverAlt,
    pubDate,
    updatedDate: updated,
    authorName,
    excerpt,
    bodyHtml,
    tagLinks,
    url: sourceUrl,
  }
}

// ---------- Image downloading -----------------------------------------------

const SUPPORTED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"])

function imageExtFromUrl(url) {
  try {
    const p = new URL(url).pathname.split("?")[0]
    const ext = p.slice(p.lastIndexOf(".")).toLowerCase()
    return SUPPORTED_EXT.has(ext) ? ext : ".jpg"
  } catch {
    return ".jpg"
  }
}

function imageDestFor(postSlug, srcUrl) {
  const safe = slugify(postSlug).slice(0, 60) || "post"
  const ext = imageExtFromUrl(srcUrl)
  return path.join(UPLOADS_DIR, `${safe}-hero${ext}`)
}

async function downloadImage(url, destPath) {
  const res = await fetch(url, { headers: { Accept: "image/*" } })
  if (!res.ok) throw new Error(`Image ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await ensureDir(path.dirname(destPath))
  await writeFile(destPath, buf)
  return destPath
}

// Extract <img src> URLs from body HTML. Returns the list of source URLs
// and a rewriter that replaces them with local paths once we've downloaded
// each one.
function collectInlineImageSources(bodyHtml) {
  const sources = []
  const seen = new Set()
  const re = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi
  let m
  while ((m = re.exec(bodyHtml)) !== null) {
    const src = m[1].trim()
    if (!src) continue
    if (seen.has(src)) continue
    seen.add(src)
    sources.push(src)
  }
  return sources
}

function rewriteImageSources(bodyHtml, srcMap) {
  return bodyHtml.replace(
    /(<img\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
    (_, pre, src, post) => {
      const mapped = srcMap.get(src)
      return mapped ? `${pre}${mapped}${post}` : `${pre}${src}${post}`
    },
  )
}

// ---------- HTML → MDX via turndown -----------------------------------------

async function htmlToMdx(html, args) {
  const TurndownService = await loadTurndown()
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    linkStyle: "inlined",
  })

  // Strip Wix lazy-loading attributes that pollute the resulting MDX.
  td.addRule("cleanImg", {
    filter: "img",
    replacement: (_, node) => {
      const src = node.getAttribute("src") || ""
      const alt = (node.getAttribute("alt") || "").replace(/\n+/g, " ")
      if (!src) return ""
      return `![${alt}](${src})`
    },
  })

  if (args.verbose) verboseLog(args, "[mdx] running turndown on body")
  return td.turndown(html).trimEnd() + "\n"
}

// ---------- Frontmatter --------------------------------------------------

function fmtDate(d) {
  return d.toISOString().slice(0, 10)
}

function pickDate(...candidates) {
  for (const c of candidates) {
    if (!c) continue
    const d = new Date(c)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

function buildPostFrontmatter(extracted, mappedCategory, tagSlugs) {
  const title = (extracted.title ?? "Untitled").toString()
  const slug = slugify(title) || "untitled"
  const pub = pickDate(extracted.pubDate)
  const upd = extracted.updatedDate ? pickDate(extracted.updatedDate) : null
  const coverAlt = (extracted.coverAlt ?? title).toString().trim() || title
  const description = (extracted.excerpt ?? coverAlt ?? "")
    .toString()
    .trim()
    .slice(0, 160)
  return {
    frontmatter: {
      title,
      description,
      category: mappedCategory,
      tags: tagSlugs,
      pubDate: fmtDate(pub),
      ...(upd && upd.getTime() > pub.getTime() + 86_400_000
        ? { updatedDate: fmtDate(upd) }
        : {}),
      authors: ["default"],
      // Hero image path is filled in once the image download succeeds.
      heroImage: "/uploads/migrated/PLACEHOLDER.jpg",
      heroImageAlt: coverAlt,
      locale: "en",
      draft: true,
      featured: false,
    },
    slug,
    sourceCoverUrl: extracted.coverUrl ?? null,
  }
}

function buildAuthorFrontmatter(author) {
  const name = (author.name ?? "Unnamed").toString()
  const slug = slugify(name) || "default"
  return {
    frontmatter: {
      name,
      bio: (author.bio ?? "").toString().slice(0, 280),
      slug,
    },
    slug,
  }
}

// ---------- Frontmatter YAML emitter --------------------------------------

function mdString(s) {
  return JSON.stringify(s ?? "")
}

function emitField(key, val) {
  if (val === null || val === undefined) return null
  if (typeof val === "string") return `${key}: ${mdString(val)}`
  if (typeof val === "number") return `${key}: ${Number.isFinite(val) ? val : 0}`
  if (typeof val === "boolean") return `${key}: ${val ? "true" : "false"}`
  if (Array.isArray(val)) {
    if (val.length === 0) return `${key}: []`
    return `${key}:\n${val.map((v) => `  - ${mdString(String(v))}`).join("\n")}`
  }
  return null
}

function emitFrontmatter(fm) {
  const lines = ["---"]
  for (const [key, val] of Object.entries(fm)) {
    const line = emitField(key, val)
    if (line) lines.push(line)
  }
  lines.push("---")
  return lines.join("\n")
}

// ---------- Validation ----------------------------------------------------

function validatePostFrontmatter(fm) {
  const errors = []
  if (!fm.title) errors.push("title missing")
  if (!fm.description) errors.push("description missing")
  if (!fm.heroImage?.startsWith("/uploads/")) errors.push("heroImage must be a local /uploads/ path")
  if (!fm.heroImageAlt) errors.push("heroImageAlt missing")
  if (!fm.pubDate) errors.push("pubDate missing")
  if (!Array.isArray(fm.tags)) errors.push("tags must be array")
  if (!Array.isArray(fm.authors) || fm.authors.length === 0) errors.push("authors missing")
  return errors
}

// ---------- Plan builder ----------------------------------------------------

async function buildPlan(args, dump) {
  const plan = {
    posts: [],
    authors: [],
    unmappedCategories: new Set(),
    unmappedTags: new Set(),
    collisions: [],
    source: "playwright",
  }

  const browser = await launchBrowser(args)
  try {
    // Phase 1: per-post detail extraction (parallel, bounded).
    const queue = [...dump.posts]
    const inflight = new Set()
    const max = args.concurrency

    async function takeNext() {
      while (inflight.size >= max || queue.length === 0) {
        if (inflight.size === 0 && queue.length === 0) return null
        await Promise.race(inflight)
      }
      const item = queue.shift()
      if (!item) return null
      const p = processOne(item).finally(() => inflight.delete(p))
      inflight.add(p)
      return p
    }

    async function processOne(postStub) {
      let page
      try {
        page = await newPage(browser, process.env.WIX_SITE_URL, args)
        const verbose = args.verbose
        if (verbose) log(`[scrape] ${postStub.url}`)
        const extracted = await extractFromPage(page, postStub.url)
        return { ok: true, postStub, extracted }
      } catch (e) {
        return {
          ok: false,
          postStub,
          error: e instanceof Error ? e.message : String(e),
        }
      } finally {
        if (page) await page.context().close().catch(() => {})
      }
    }

    const workers = []
    while (true) {
      const p = await takeNext()
      if (!p) break
      workers.push(p)
    }
    const results = await Promise.all(workers)

    // Phase 2: per-post build (frontmatter + body + image handling).
    for (const r of results) {
      if (!r.ok) {
        warn(`[fail ${r.postStub.url}] ${r.error}`)
        continue
      }
      const { postStub, extracted } = r

      const tagLabels = (extracted.tagLinks ?? [])
        .map((t) => t.replace(/^[#\s]+/, "").trim())
        .filter(Boolean)
      const mappedCategory = mapWixCategoryToSlug(postStub.suggestedCategory)
      const tagSlugs = tagLabels.map(mapWixTagToSlug).filter(Boolean)
      for (const t of tagSlugs) plan.unmappedTags.add(t)

      const built = buildPostFrontmatter(extracted, mappedCategory, tagSlugs)
      const inlineSources = collectInlineImageSources(extracted.bodyHtml ?? "")
      const heroSrcLocal = await maybeDownloadHero(built, extracted, args)
      if (heroSrcLocal) built.frontmatter.heroImage = heroSrcLocal

      // Body image handling: each <img src> becomes a hero-N pattern only if
      // we want to preserve them. For simplicity we BODY-image by
      // downloading each inline source and rewriting the HTML src.
      const bodyImageRefs = []
      if (inlineSources.length > 0) {
        const srcMap = new Map()
        for (let i = 0; i < inlineSources.length; i++) {
          const abs = absoluteUrl(inlineSources[i], extracted.url)
          if (!abs) continue
          try {
            const dest = path.join(
              UPLOADS_DIR,
              `${built.slug}-body-${i}${imageExtFromUrl(abs)}`,
            )
            await downloadImage(abs, dest)
            const local = `/uploads/migrated/${path.basename(dest)}`
            srcMap.set(inlineSources[i], local)
            bodyImageRefs.push({ src: abs, local })
          } catch (e) {
            verboseLog(args, `[img-fail] ${abs}: ${e.message}`)
          }
        }
        extracted.bodyHtml = rewriteImageSources(extracted.bodyHtml, srcMap)
      }

      let body = ""
      try {
        body = await htmlToMdx(extracted.bodyHtml ?? "", args)
      } catch (e) {
        warn(`[mdx-fail ${built.slug}] ${e.message}`)
      }

      plan.posts.push({
        title: built.frontmatter.title,
        slug: built.slug,
        targetDir: POSTS_DIR,
        source: built,
        body,
        category: mappedCategory,
        tags: tagSlugs,
        author: extracted.authorName ?? null,
        images: [
          heroSrcLocal ? { kind: "hero", local: heroSrcLocal } : null,
          ...bodyImageRefs.map((r) => ({ kind: "body", local: r.local })),
        ].filter(Boolean),
        sourceUrl: extracted.url,
      })
    }
  } finally {
    await closeBrowser(browser)
  }

  // Apply the same collision-disambiguation + report surface logic as the
  // API script.
  const slugCounts = new Map()
  for (const p of plan.posts) {
    slugCounts.set(p.slug, (slugCounts.get(p.slug) ?? 0) + 1)
  }
  for (const [slug, count] of slugCounts) {
    if (count > 1) {
      const titles = plan.posts.filter((p) => p.slug === slug).map((p) => p.title)
      plan.collisions.push({ slug, count, titles })
    }
  }
  plan.unmappedCategories = [...plan.unmappedCategories]
  plan.unmappedTags = [...plan.unmappedTags]
  return plan
}

async function maybeDownloadHero(built, extracted, args) {
  if (!extracted.coverUrl) return null
  try {
    const dest = imageDestFor(built.slug, extracted.coverUrl)
    if (await pathExists(dest)) {
      // Idempotent: reuse previously downloaded image.
      return `/uploads/migrated/${path.basename(dest)}`
    }
    await downloadImage(extracted.coverUrl, dest)
    return `/uploads/migrated/${path.basename(dest)}`
  } catch (e) {
    verboseLog(args, `[hero-fail ${built.slug}] ${e.message}`)
    return null
  }
}

// ---------- Plan / live runners --------------------------------------------

async function dumpRun(args) {
  await ensureDir(MIGRATION_DIR)
  const discovered = await discoverPostUrls(args)
  const data = {
    fetchedAt: new Date().toISOString(),
    source: discovered.source,
    listUrl: discovered.listUrl,
    posts: discovered.postUrls.map((url) => {
      const slug = url.split("/").filter(Boolean).pop() ?? "untitled"
      const suggestedCategory = "" // post-level category unknown until detail scrape
      return { url, slug, suggestedCategory }
    }),
    categories: [],
    tags: [],
    authors: [],
  }
  await writeFile(DUMP_PATH, JSON.stringify(data, null, 2))
  log(
    `[dump] saved ${data.posts.length} post URLs from ${discovered.source} → ${path.relative(
      PROJECT_ROOT,
      DUMP_PATH,
    )}`,
  )
  return data
}

async function planRun(args) {
  await ensureDir(MIGRATION_DIR)
  let dump = await readJsonOrNull(DUMP_PATH)
  if (!dump || args.freshDump) {
    dump = await dumpRun(args)
  } else if (dump.source !== "playwright") {
    warn(
      `[plan] existing dump.json came from "${dump.source ?? "api"}"; refetching with --fresh`,
    )
    dump = await dumpRun({ ...args, freshDump: true })
  }
  const plan = await buildPlan(args, dump)
  await writeFile(PLAN_PATH, JSON.stringify(plan, null, 2))
  await writeReport(plan, dump)
  log(`[plan] saved plan → ${path.relative(PROJECT_ROOT, PLAN_PATH)}`)
  log(`[plan] saved report → ${path.relative(PROJECT_ROOT, REPORT_PATH)}`)
  warn("! review the report and the plan JSON before running with --live --confirm")
  return plan
}

async function writeReport(plan, dump) {
  const lines = []
  lines.push(`# Wix → Blog migration report (playwright)`)
  lines.push("")
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Discovery source: ${dump.source}`)
  lines.push(`List URL: ${dump.listUrl}`)
  lines.push("")
  lines.push(`Mapped posts: ${plan.posts.length}`)
  lines.push(`Mapped authors: ${plan.authors.length}`)
  if (plan.unmappedTags.length > 0) {
    lines.push("")
    lines.push(`Tag labels not in the local taxonomy enum:`)
    for (const slug of plan.unmappedTags) lines.push(`- \`${slug}\``)
  }
  if (plan.collisions.length > 0) {
    lines.push("")
    lines.push(`Slug collisions (post titles mapping to the same kebab):`)
    for (const c of plan.collisions) {
      lines.push(`- \`${c.slug}\` × ${c.count}: ${c.titles.join(" | ")}`)
    }
  }
  if (plan.posts.length > 0) {
    lines.push("")
    lines.push(`First 20 post titles:`)
    for (const post of plan.posts.slice(0, 20)) {
      lines.push(`- \`${post.slug}.mdx\` [${post.category}] — ${post.title}`)
    }
  }
  lines.push("")
  lines.push(`Pages (About, Services, Values, etc.) are not exported by the public Wix blog. Re-create those singletons in Pages CMS.`)
  await writeFile(REPORT_PATH, lines.join("\n") + "\n")
}

async function liveRun(args) {
  if (!args.confirm) {
    throw new Error(
      "--live requires --confirm. Re-run with --live --confirm once you've reviewed the plan.",
    )
  }
  const plan = await readJsonOrNull(PLAN_PATH)
  if (!plan) {
    throw new Error(`No plan at ${path.relative(PROJECT_ROOT, PLAN_PATH)}. Run --plan first.`)
  }
  await ensureDir(POSTS_DIR)
  await ensureDir(UPLOADS_DIR)

  let written = 0
  let skipped = 0
  let failed = 0

  // Slug-collision disambiguator.
  const cursor = new Map()
  for (const c of plan.collisions ?? []) cursor.set(c.slug, 1)

  for (const post of plan.posts) {
    let slug = post.slug
    if (cursor.has(slug)) {
      const n = cursor.get(slug) + 1
      const disambiguated = `${slug}-${n}`
      cursor.set(slug, n)
      verboseLog(args, `[disambiguate] ${slug} → ${disambiguated}`)
      slug = disambiguated
    }
    const filePath = path.join(post.targetDir, `${slug}.mdx`)
    if ((await pathExists(filePath)) && !args.force) {
      verboseLog(args, `[skip] ${filePath}`)
      skipped += 1
      continue
    }

    try {
      const fm = { ...post.source.frontmatter }
      const issues = validatePostFrontmatter(fm)
      if (issues.length > 0) {
        warn(`[skip ${slug}] frontmatter invalid: ${issues.join("; ")}`)
        failed += 1
        continue
      }
      const out = emitFrontmatter(fm) + "\n" + post.body
      await writeFile(filePath, out)
      verboseLog(args, `[wrote] ${filePath}`)
      written += 1
    } catch (e) {
      warn(`[fail ${slug}] ${e instanceof Error ? e.message : String(e)}`)
      failed += 1
    }
  }

  log(`[live] wrote ${written} file(s), skipped ${skipped}, failed ${failed}`)
  if (failed > 0) {
    warn(`! review the failing items above before committing`)
  }
}

// ---------- Entry -----------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv)
  try {
    switch (args.mode) {
      case "dump":
        await dumpRun(args)
        break
      case "plan":
        await planRun(args)
        break
      case "live":
        await liveRun(args)
        break
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`[error] ${message}`)
    if (args.verbose && error instanceof Error && error.stack) {
      log(error.stack)
    }
    process.exitCode = 1
  }
}

await main()
