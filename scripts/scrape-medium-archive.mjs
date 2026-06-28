#!/usr/bin/env node
/**
 * scrape-medium-archive.mjs
 *
 * Public-archive scraping fallback for scripts/migrate-from-medium.mjs. Use
 * this when the Medium RSS feed returns fewer items than the profile
 * actually has — Medium caps RSS at the most recent ~10–20 posts and the
 * /@user/archive page is a JS-rendered infinite-scroll SPA that a plain
 * fetch can't see (returns HTTP 403).
 *
 * This script:
 *   1. Launches Chromium via Playwright and navigates to
 *      https://medium.com/@<profile>/archive
 *   2. Scrolls to the bottom in segments, harvesting every post URL that
 *      the SPA renders.
 *   3. Stops scrolling once two consecutive scrolls add no new URLs.
 *   4. Diffs the harvested URLs against the existing MDX files in
 *      src/content/posts/en/ (by cleaned Medium slug).
 *   5. For each NEW URL: visits the post page, extracts the body, hero
 *      image, and meta tags, runs Turndown, downloads the hero, and
 *      emits plan.json + report.md.
 *   6. With --live --confirm, writes the actual MDX files.
 *
 * Outputs (the medium-archive- prefix avoids colliding with the RSS script):
 *   - scripts/.migration/medium-archive-dump.json
 *   - scripts/.migration/medium-archive-plan.json
 *   - scripts/.migration/medium-archive-report.md
 *   - public/uploads/medium/<slug>-hero.<ext>
 *   - src/content/posts/en/<slug>.mdx  (only with --live --confirm)
 *
 * Modes (mirrors scripts/migrate-from-medium.mjs):
 *   --plan (default)    Scrape + diff + per-post extract + artefacts.
 *   --live --confirm    Read plan.json and write MDX files.
 *   --force             (with --live) Overwrite MDX files that already exist.
 *   --fresh             Re-scrape the archive even if dump.json exists.
 *   --verbose           Log every fetch and conversion decision.
 *   --headed            Run Playwright with a visible browser (debug only).
 *   --concurrency N     Parallel post-detail pages (default 4).
 *   --max-scrolls N     Max archive scroll iterations (default 30).
 *   --max-new N         Cap on NEW posts to process (default 0 = unlimited).
 *                       Use this to do a "preview 5" before committing.
 *   -h, --help          Show this message.
 *
 * Environment (.env.local auto-loaded if invoked with --env-file-if-exists):
 *   MEDIUM_PROFILE      Username (default @nite.tanzarn; leading @ optional).
 *   MEDIUM_USER_AGENT   Override the User-Agent string.
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
  readdir,
  access,
} from "node:fs/promises"
import { constants as fsConstants } from "node:fs"
import { fileURLToPath } from "node:url"

// ---------- Configuration ---------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, "..")
const POSTS_DIR = path.join(PROJECT_ROOT, "src/content/posts/en")
const UPLOADS_DIR = path.join(PROJECT_ROOT, "public/uploads/medium")
const MIGRATION_DIR = path.join(PROJECT_ROOT, "scripts/.migration")
const DUMP_PATH = path.join(MIGRATION_DIR, "medium-archive-dump.json")
const PLAN_PATH = path.join(MIGRATION_DIR, "medium-archive-plan.json")
const REPORT_PATH = path.join(MIGRATION_DIR, "medium-archive-report.md")

const DEFAULT_PROFILE = "@nite.tanzarn"
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
const DEFAULT_CONCURRENCY = 4
const DEFAULT_MAX_SCROLLS = 30
const POST_PAGE_TIMEOUT_MS = 20000
const SCROLL_PAUSE_MS = 1500
const SCROLL_DELTA_PX = 1200
const STATIC_SCROLL_LIMIT = 3

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
      "playwright is not installed. Run `pnpm add -D playwright` first. If it's already installed but the chromium browser binary is missing, also run `npx playwright install chromium` (~300 MB).",
    )
  }
}

// ---------- CLI -------------------------------------------------------------

function printHelp() {
  console.log(`Usage: node scripts/scrape-medium-archive.mjs [options]

Options:
  --plan           Scrape archive + diff + write artefacts (default).
  --live           Read existing plan.json and write MDX files.
  --force          (with --live) Overwrite MDX files that already exist.
  --confirm        Required to actually write files with --live.
  --fresh          Re-scrape the archive even if dump.json exists.
  --verbose        Log every fetch and conversion decision.
  --headed         Run Playwright with a visible browser window.
  --concurrency N  Parallel post-detail pages (default ${DEFAULT_CONCURRENCY}).
  --max-scrolls N  Max archive scroll iterations (default ${DEFAULT_MAX_SCROLLS}).
  --max-new N      Cap on new posts to process (0 = unlimited).
  -h, --help       Show this message.

Environment (process.env; auto-loaded from .env.local if Node 22
--env-file-if-exists=.env.local is used):

  MEDIUM_PROFILE    Username (default ${DEFAULT_PROFILE}; leading @ optional).
  MEDIUM_USER_AGENT Override User-Agent.
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
    maxScrolls: DEFAULT_MAX_SCROLLS,
    maxNew: 0,
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
        if (a === "--max-scrolls" && argv[i + 1]) {
          const n = Number(argv[++i])
          if (Number.isFinite(n) && n > 0) args.maxScrolls = n
          else throw new Error("--max-scrolls expects a positive integer")
          break
        }
        if (a === "--max-new" && argv[i + 1]) {
          const n = Number(argv[++i])
          if (Number.isFinite(n) && n >= 0) args.maxNew = n
          else throw new Error("--max-new expects a non-negative integer")
          break
        }
        if (a.startsWith("--")) throw new Error(`Unknown flag: ${a}`)
    }
  }
  return args
}

// ---------- Logging + file helpers ------------------------------------------

function log(line) {
  console.log(line)
}
function warn(line) {
  console.warn(`! ${line}`)
}
function verboseLog(args, line) {
  if (args.verbose) log(line)
}

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

// ---------- Profile + URL utilities -----------------------------------------

function normaliseProfile(value) {
  const trimmed = value.trim().replace(/^@?/, "")
  if (!trimmed) return DEFAULT_PROFILE
  return `@${trimmed}`
}

// URL pattern: https://medium.com/@user/<slug>-<hash>[?source=...]
// Strip query/hash → drop the @user/ prefix → strip trailing -<hex> hash.
function cleanMediumSlug(url) {
  if (!url) return ""
  const cleaned = url.split("?")[0].split("#")[0].replace(/\/+$/, "")
  const segments = cleaned.split("/").filter(Boolean)
  // Drop the @user segment (where applicable).
  const filtered = segments.filter((s) => !s.startsWith("@"))
  const raw = filtered[filtered.length - 1] ?? ""
  // Medium appends a 12-char lowercase hex hash like `-7b264f6f8a59`.
  return raw.replace(/[-_][a-f0-9]{8,16}$/i, "").replace(/[-_]\d{10,}$/i, "")
}

// ---------- Slugify + taxonomy mapping --------------------------------------

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

// ---------- Diff: existing local MDX slugs ----------------------------------

async function collectExistingSlugs() {
  // Slugs we already own. We index FOUR signals per file to make the
  // diff robust to legacy imports that renamed the file (e.g. an MDX named
  // `20260511-the-time-tax.mdx` whose source URL slug was
  // `the-time-tax-hours-already-taken`):
  //   1. Filename stem (with and without YYYY-MM-DD- prefix).
  //   2. Frontmatter `slug:` override (rare; current migrators don't write it).
  //   3. Frontmatter `title:` slugified — handles the trimmed-slug case.
  //   4. First H1 (`# …`) from the body, slugified — last-resort fallback.
  // Any of these matching the URL's cleaned slug means the post is imported.
  const filenames = await readdir(POSTS_DIR).catch(() => [])
  const slugs = new Set()
  for (const f of filenames) {
    if (!f.endsWith(".mdx")) continue
    const stem = f.replace(/\.mdx$/, "")
    const cleaned = stem.replace(/^\d{4}-\d{2}-\d{2}-/, "")
    slugs.add(slugify(cleaned))
    slugs.add(slugify(stem))
  }
  for (const f of filenames) {
    if (!f.endsWith(".mdx")) continue
    const full = path.join(POSTS_DIR, f)
    try {
      const text = await readFile(full, "utf8")
      const fmMatch = /^---\n([\s\S]*?)\n---/m.exec(text)
      if (fmMatch) {
        const slugMatch = /^slug:\s*['"]?([^'"\n]+)['"]?\s*$/m.exec(fmMatch[1])
        if (slugMatch) slugs.add(slugify(slugMatch[1]))
        const titleMatch = /^title:\s*['"]?([^'"\n]+)['"]?\s*$/m.exec(fmMatch[1])
        if (titleMatch) slugs.add(slugify(titleMatch[1]))
        // Match any commented-out "old filename" hint the migrator may have
        // left behind — best-effort.
        const oldMatch = /#\s*medium:\s*([a-z0-9-]+)/i.exec(fmMatch[1])
        if (oldMatch) slugs.add(slugify(oldMatch[1]))
      }
      // First H1 from the body as a last-resort fallback.
      const h1Match = /^#\s+(.+)$/m.exec(text)
      if (h1Match) slugs.add(slugify(h1Match[1]))
    } catch {
      /* skip unreadable files */
    }
  }
  return slugs
}

// ---------- Browser bootstrap ------------------------------------------------

async function launchBrowser(args) {
  const { chromium } = await loadPlaywright()
  return chromium.launch({
    headless: !args.headed,
    args: args.headed
      ? []
      : [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-blink-features=AutomationControlled",
        ],
  })
}

async function newArchivePage(browser, args) {
  const context = await browser.newContext({
    userAgent: process.env.MEDIUM_USER_AGENT || DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  })
  // Evade the most obvious headless detection: mask navigator.webdriver.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false })
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

// ---------- Phase 1: archive scroll & URL harvest ---------------------------
//
// Strategy:
//   - Goto /@user/archive, wait for the first batch of post links.
//   - Repeatedly scroll the page by SCROLL_DELTA_PX and wait
//     SCROLL_PAUSE_MS. Each iteration reads the DOM for new post URLs.
//   - Stop after STATIC_SCROLL_LIMIT consecutive iterations added no new
//     URLs (the SPA has loaded everything it will), or args.maxScrolls
//     iterations, whichever comes first.
//   - URL acceptance: <a href> matching https://medium.com/@<user>/<slug>-...
//     and pointing to a single post (not the archive, not /me/, not /m/).
//
// Medium renders the archive with anchor tags whose href points to the
// canonical post URL. We dedupe with a Set.

const POST_HREF_RE = /\/@[a-zA-Z0-9._-]+\/[a-zA-Z0-9][a-zA-Z0-9_-]*-[a-f0-9]{8,16}(?:[?#].*)?$/i
// Also accept /@user/<slug> with no trailing hash (older posts).
const POST_HREF_LOOSE_RE = /\/@[a-zA-Z0-9._-]+\/[a-zA-Z0-9][a-zA-Z0-9_-]{2,}(?:[?#].*)?$/

const REJECT_PATH_RE =
  /^\/(me|about|plans|m\/|search|tag|topic|@[\w.-]+\/?(?:archive|about|published|recommended|list|response-of-writing-on|articles-by|recommends|highlights|responses|reads|list|profile|stats|followers|following|publications)|@[\w.-]+\/archive[?#].*)$/i

function isPostHref(href) {
  if (!href) return false
  if (href.startsWith("javascript:") || href.startsWith("mailto:")) return false
  try {
    const u = new URL(href, "https://medium.com")
    if (u.hostname !== "medium.com" && u.hostname !== "www.medium.com") {
      return false
    }
    const p = u.pathname
    if (REJECT_PATH_RE.test(p)) return false
    if (!p.includes("/@")) return false
    if (POST_HREF_RE.test(p)) return true
    // Allow the loose form for very old or short posts.
    if (POST_HREF_LOOSE_RE.test(p) && p.split("/").filter(Boolean).length === 2) {
      return true
    }
    return false
  } catch {
    return false
  }
}

async function harvestArchiveUrls(args) {
  const profile = normaliseProfile(
    process.env.MEDIUM_PROFILE || DEFAULT_PROFILE,
  )
  const archiveUrl = `https://medium.com/${profile}/archive`

  const browser = await launchBrowser(args)
  try {
    const page = await newArchivePage(browser, args)
    verboseLog(args, `[archive] GET ${archiveUrl}`)
    const response = await page.goto(archiveUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    })
    // Detect a paywall / interstitial BEFORE we waste a scroll loop on it.
    if (response && (response.status() === 429 || response.status() >= 500)) {
      throw new Error(
        `archive page returned HTTP ${response.status()} — Medium may be rate-limiting this client. Re-run after a short delay, or try a different network.`,
      )
    }

    // Wait for the first batch of post links to appear. Medium may show
    // a sign-in wall first; bail out clearly if so.
    try {
      await page.waitForSelector('a[href*="/@"][href*="-"]', {
        state: "attached",
        timeout: 15000,
      })
    } catch {
      const bodyText = (await page.evaluate(() => document.body?.innerText || ""))
        .slice(0, 400)
        .replace(/\s+/g, " ")
      throw new Error(
        `archive page did not render post links within 15s. ` +
          `This usually means Medium showed a sign-in / paywall wall. ` +
          `Body preview: ${bodyText}`,
      )
    }

    const seen = new Set()
    let staticStreak = 0
    let lastScrollY = -1

    for (let i = 0; i < args.maxScrolls; i++) {
      const found = await page.evaluate(() => {
        const out = new Set()
        for (const a of document.querySelectorAll("a[href]")) {
          out.add(a.getAttribute("href") || "")
        }
        return [...out]
      })
      let added = 0
      for (const href of found) {
        if (!isPostHref(href)) continue
        const abs = new URL(href, archiveUrl).toString().split("?")[0]
        if (!seen.has(abs)) {
          seen.add(abs)
          added += 1
        }
      }
      // Scroll first, then decide whether the page is exhausted. The previous
      // version double-counted "no new URLs" and "scrollY pinned" in the same
      // iteration, which caused premature exit on a single bad iteration.
      const scrollY = await page.evaluate((delta) => {
        window.scrollBy(0, delta)
        return window.scrollY
      }, SCROLL_DELTA_PX)

      // One increment per iteration, regardless of how many signals agree.
      const noNewUrls = added === 0
      const scrollPinned = scrollY === lastScrollY && lastScrollY !== -1
      if (noNewUrls || scrollPinned) {
        staticStreak += 1
        verboseLog(
          args,
          `[scroll ${i + 1}/${args.maxScrolls}] dom=${found.length} new=${added} total=${seen.size} streak=${staticStreak}${noNewUrls ? " (noNew)" : ""}${scrollPinned ? " (pinned)" : ""}`,
        )
        if (staticStreak >= STATIC_SCROLL_LIMIT) {
          verboseLog(
            args,
            `[scroll] stopping — ${STATIC_SCROLL_LIMIT} consecutive static iterations`,
          )
          break
        }
      } else {
        verboseLog(
          args,
          `[scroll ${i + 1}/${args.maxScrolls}] dom=${found.length} new=${added} total=${seen.size} streak=0`,
        )
        staticStreak = 0
      }
      lastScrollY = scrollY
      await page.waitForTimeout(SCROLL_PAUSE_MS)
    }

    return {
      archiveUrl,
      profile,
      discovered: [...seen].sort(),
    }
  } finally {
    await closeBrowser(browser)
  }
}

// ---------- Phase 2: per-post extraction ------------------------------------

async function extractFromPostPage(page, sourceUrl) {
  const response = await page.goto(sourceUrl, {
    waitUntil: "domcontentloaded",
    timeout: POST_PAGE_TIMEOUT_MS,
  })
  if (response && (response.status() === 429 || response.status() >= 500)) {
    throw new Error(
      `post page returned HTTP ${response.status()} — Medium may be rate-limiting this client. Re-run after a short delay.`,
    )
  }
  // Wait for the article to render. If it doesn't within 8s, treat the
  // post as paywalled / deleted and skip.
  try {
    await page.waitForSelector("article", {
      state: "attached",
      timeout: 8000,
    })
  } catch {
    throw new Error("no <article> tag rendered — likely paywalled or deleted")
  }

  const meta = await page.evaluate(() => {
    const out = {}
    for (const m of document.querySelectorAll("meta")) {
      const k = m.getAttribute("property") || m.getAttribute("name")
      const v = m.getAttribute("content")
      if (k && v) out[k] = v
    }
    return out
  })

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
    return found.find(
      (x) => x && (x["@type"] === "BlogPosting" || x["@type"] === "Article"),
    ) || null
  })

  const articleHtml = await page.evaluate(() => {
    const a = document.querySelector("article")
    return a ? a.innerHTML : ""
  })

  // Try a pubDate from JSON-LD first, then meta tags, then the visible
  // <time> element.
  const ldDate = jsonLd?.datePublished
  const metaDate =
    meta["article:published_time"] ||
    meta["published_time"] ||
    meta["og:article:published_time"]
  const timeDate = await page.evaluate(() => {
    const t = document.querySelector("time[datetime]")
    return t?.getAttribute("datetime") || ""
  })

  const docTitle = await page.title()

  return {
    title:
      jsonLd?.headline ||
      meta["og:title"] ||
      docTitle ||
      cleanMediumSlug(sourceUrl),
    description:
      jsonLd?.description ||
      meta["og:description"] ||
      meta["description"] ||
      "",
    pubDate: ldDate || metaDate || timeDate || null,
    heroImage:
      (Array.isArray(jsonLd?.image)
        ? jsonLd.image[0]?.url
        : typeof jsonLd?.image === "string"
          ? jsonLd.image
          : jsonLd?.image?.url) ||
      meta["og:image"] ||
      meta["twitter:image"] ||
      null,
    articleHtml,
    sourceUrl,
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

async function downloadImage(url, destPath) {
  const res = await fetch(url, { headers: { Accept: "image/*" } })
  if (!res.ok) throw new Error(`Image ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await ensureDir(path.dirname(destPath))
  await writeFile(destPath, buf)
  return destPath
}

async function maybeDownloadHero(postSlug, heroUrl, args) {
  if (!heroUrl) return null
  try {
    const safe = slugify(postSlug).slice(0, 60) || "post"
    const ext = imageExtFromUrl(heroUrl)
    const dest = path.join(UPLOADS_DIR, `${safe}-hero${ext}`)
    if (await pathExists(dest)) {
      return `/uploads/medium/${path.basename(dest)}`
    }
    await downloadImage(heroUrl, dest)
    return `/uploads/medium/${path.basename(dest)}`
  } catch (e) {
    verboseLog(args, `[hero-fail ${postSlug}] ${e.message}`)
    return null
  }
}

// ---------- HTML → MDX via Turndown ----------------------------------------

async function htmlToMdx(html, args) {
  const TurndownService = await loadTurndown()
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    linkStyle: "inlined",
  })

  td.addRule("iframeEmbed", {
    filter: "iframe",
    replacement: (_, node) => {
      const src = node.getAttribute("src") || ""
      if (!src) return ""
      const title = (node.getAttribute("title") || "").trim()
      const safeTitle = title.replace(/[\[\]]/g, " ")
      return `[Embed: ${src}](${src})${safeTitle ? ` — "${safeTitle}"` : ""}\n\n`
    },
  })

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

// ---------- Frontmatter builder --------------------------------------------

function pubDateToIso(raw) {
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function buildPostFrontmatter({
  title,
  description,
  pubDate,
  tags,
  mappedCategory,
  heroLocal,
}) {
  const coverAlt = (title ?? "Untitled").toString().trim()
  const desc =
    (description ?? "")
      .toString()
      .trim()
      .slice(0, 160) || coverAlt.slice(0, 160)
  return {
    title: (title ?? "Untitled").toString(),
    description: desc,
    category: mappedCategory,
    tags,
    pubDate: pubDate ?? new Date().toISOString().slice(0, 10),
    authors: ["default"],
    heroImage: heroLocal || "/uploads/medium/PLACEHOLDER.jpg",
    heroImageAlt: coverAlt,
    locale: "en",
    draft: true,
    featured: false,
  }
}

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

function validatePostFrontmatter(fm) {
  const errors = []
  if (!fm.title) errors.push("title missing")
  if (!fm.description) errors.push("description missing")
  if (!fm.heroImage?.startsWith("/uploads/")) {
    errors.push("heroImage must be a local /uploads/ path")
  }
  if (!fm.heroImageAlt) errors.push("heroImageAlt missing")
  if (!fm.pubDate) errors.push("pubDate missing")
  if (!Array.isArray(fm.tags)) errors.push("tags must be array")
  if (!Array.isArray(fm.authors) || fm.authors.length === 0) {
    errors.push("authors missing")
  }
  return errors
}

// ---------- Bounded parallel worker ----------------------------------------

async function runQueue(items, concurrency, worker) {
  const queue = [...items]
  const inflight = new Set()
  const results = []
  async function tick() {
    while (inflight.size < concurrency && queue.length > 0) {
      const item = queue.shift()
      const p = worker(item)
        .then((r) => {
          results.push(r)
        })
        .finally(() => inflight.delete(p))
      inflight.add(p)
    }
    if (inflight.size > 0) await Promise.race(inflight)
  }
  while (queue.length > 0 || inflight.size > 0) {
    await tick()
    if (queue.length === 0 && inflight.size === 0) break
  }
  return results
}

// ---------- Phase 1+2 runner: scrape + diff + dump --------------------------

async function dumpRun(args) {
  await ensureDir(MIGRATION_DIR)
  const harvested = await harvestArchiveUrls(args)
  const existingSlugs = await collectExistingSlugs()

  // Diff. `cleanMediumSlug` strips the trailing hash so "the-tax-7b264f6f8a59"
  // matches a local file named "the-tax.mdx".
  const diff = harvested.discovered.map((url) => {
    const cleaned = cleanMediumSlug(url)
    const slug = slugify(cleaned)
    const known = existingSlugs.has(slug) || existingSlugs.has(cleaned)
    return { url, cleanedSlug: cleaned, localSlug: slug, alreadyImported: known }
  })
  const newPosts = diff.filter((d) => !d.alreadyImported)
  const knownPosts = diff.filter((d) => d.alreadyImported)

  const dump = {
    fetchedAt: new Date().toISOString(),
    source: "medium-archive",
    archiveUrl: harvested.archiveUrl,
    profile: harvested.profile,
    discoveredCount: harvested.discovered.length,
    alreadyImportedCount: knownPosts.length,
    newCount: newPosts.length,
    existingSlugs: [...existingSlugs].sort(),
    discovered: diff,
  }
  await writeFile(DUMP_PATH, JSON.stringify(dump, null, 2))
  log(
    `[dump] discovered ${dump.discoveredCount} post URLs; ` +
      `${dump.alreadyImportedCount} already imported; ` +
      `${dump.newCount} NEW → ${path.relative(PROJECT_ROOT, DUMP_PATH)}`,
  )
  return dump
}

// ---------- Phase 3: per-post enrichment + plan ----------------------------

async function planRun(args) {
  await ensureDir(MIGRATION_DIR)
  let dump = await readJsonOrNull(DUMP_PATH)
  if (!dump || args.freshDump) {
    dump = await dumpRun(args)
  } else if (dump.source !== "medium-archive") {
    warn(
      `[plan] existing medium-archive-dump.json came from "${dump.source ?? "?"}"; refetching --fresh`,
    )
    dump = await dumpRun({ ...args, freshDump: true })
  }

  // Resolve which posts to enrich. The --max-new cap applies here. Also
  // skip URLs that are already planned in medium-archive-plan.json from a
  // previous --plan run (they will be written by --live; re-planning them
  // would re-download the same heroes and re-do the turndown pass for no
  // reason). The diff is URL-based, so re-runs are idempotent.
  // Note: --fresh forces a full re-scrape, so the dedup is bypassed to
  // honour the user's explicit "do it again" intent.
  const previousPlan = args.freshDump ? null : await readJsonOrNull(PLAN_PATH)
  const alreadyPlannedUrls = new Set(
    previousPlan?.posts?.map((p) => p.sourceUrl).filter(Boolean) ?? [],
  )

  const candidatePosts = dump.discovered.filter(
    (d) => !d.alreadyImported && !alreadyPlannedUrls.has(d.url),
  )
  const deferredPosts = dump.discovered
    .filter((d) => !d.alreadyImported)
    .filter((d) => alreadyPlannedUrls.has(d.url))
  const newPosts = candidatePosts.slice(0, args.maxNew > 0 ? args.maxNew : Infinity)

  if (deferredPosts.length > 0) {
    log(
      `[plan] skipping ${deferredPosts.length} URL${deferredPosts.length === 1 ? "" : "s"} already present in ${path.relative(PROJECT_ROOT, PLAN_PATH)} (re-run --live --confirm to write them; pass --fresh to force re-enrichment).`,
    )
  }

  if (newPosts.length === 0) {
    log("[plan] no new posts to process — archive is fully imported.")
    const emptyPlan = {
      posts: [],
      unmappedCategories: [],
      unmappedTags: [],
      collisions: [],
      source: "medium-archive",
      summary: {
        discoveredCount: dump.discoveredCount,
        alreadyImportedCount: dump.alreadyImportedCount,
        newCount: 0,
        enrichedCount: 0,
        failedCount: 0,
        deferredCount: deferredPosts.length,
      },
    }
    await writeFile(PLAN_PATH, JSON.stringify(emptyPlan, null, 2))
    await writeReport(emptyPlan, dump, args)
    return emptyPlan
  }

  log(
    `[plan] enriching ${newPosts.length} new post${newPosts.length === 1 ? "" : "s"} via Playwright…`,
  )

  const browser = await launchBrowser(args)
  const plan = {
    posts: [],
    unmappedCategories: new Set(),
    unmappedTags: new Set(),
    collisions: [],
    source: "medium-archive",
    summary: {
      discoveredCount: dump.discoveredCount,
      alreadyImportedCount: dump.alreadyImportedCount,
      newCount: candidatePosts.length,
      enrichedCount: 0,
      failedCount: 0,
      deferredCount: deferredPosts.length,
    },
  }

  // Pre-disambiguate slugs in case two archive URLs collapse to the same
  // cleaned slug (rare but possible for two posts with the same title).
  const slugCounts = new Map()
  for (const p of newPosts) {
    slugCounts.set(p.localSlug, (slugCounts.get(p.localSlug) ?? 0) + 1)
  }
  const disambigCursor = new Map()
  for (const p of newPosts) {
    if ((slugCounts.get(p.localSlug) ?? 0) > 1) {
      const n = (disambigCursor.get(p.localSlug) ?? 0) + 1
      disambigCursor.set(p.localSlug, n)
      const adjusted = n === 1 ? p.localSlug : `${p.localSlug}-${n}`
      warn(`[slug-collision] ${p.localSlug} → ${adjusted} (${p.url})`)
      p.localSlug = adjusted
    }
  }

  try {
    const enriched = await runQueue(newPosts, args.concurrency, async (post) => {
      verboseLog(args, `[post] ${post.url}`)
      let page
      try {
        page = await newArchivePage(browser, args)
        const extracted = await extractFromPostPage(page, post.url)
        const heroLocal = await maybeDownloadHero(
          post.localSlug,
          extracted.heroImage,
          args,
        )
        const body = extracted.articleHtml
          ? await htmlToMdx(extracted.articleHtml, args)
          : ""
        return { ok: true, post, extracted, heroLocal, body }
      } catch (e) {
        warn(
          `[post-fail ${post.url}] ${e instanceof Error ? e.message : String(e)}`,
        )
        return {
          ok: false,
          post,
          error: e instanceof Error ? e.message : String(e),
        }
      } finally {
        if (page) await page.context().close().catch(() => {})
      }
    })

    for (const r of enriched) {
      if (!r.ok) {
        plan.summary.failedCount += 1
        continue
      }
      const { post, extracted, heroLocal, body } = r
      const tags = [] // archive page doesn't expose categories inline
      const mappedCategory = "articles" // see DESIGN.md — editor-driven
      plan.unmappedCategories.add("articles")

      const frontmatter = buildPostFrontmatter({
        title: extracted.title,
        description: extracted.description,
        pubDate: pubDateToIso(extracted.pubDate),
        tags,
        mappedCategory,
        heroLocal,
      })

      plan.posts.push({
        title: frontmatter.title,
        slug: post.localSlug,
        targetDir: POSTS_DIR,
        frontmatter,
        body,
        category: mappedCategory,
        tags,
        sourceUrl: post.url,
        images: heroLocal ? [{ kind: "hero", local: heroLocal }] : [],
      })
      plan.summary.enrichedCount += 1
    }
  } finally {
    await closeBrowser(browser)
  }

  // Collision report (should be empty after pre-disambiguation, but check).
  const planSlugCounts = new Map()
  for (const p of plan.posts) {
    planSlugCounts.set(p.slug, (planSlugCounts.get(p.slug) ?? 0) + 1)
  }
  for (const [slug, count] of planSlugCounts) {
    if (count > 1) {
      plan.collisions.push({
        slug,
        count,
        titles: plan.posts.filter((p) => p.slug === slug).map((p) => p.title),
      })
    }
  }
  plan.unmappedCategories = [...plan.unmappedCategories]
  plan.unmappedTags = [...plan.unmappedTags]

  await writeFile(PLAN_PATH, JSON.stringify(plan, null, 2))
  await writeReport(plan, dump, args)
  log(`[plan] saved plan → ${path.relative(PROJECT_ROOT, PLAN_PATH)}`)
  log(`[plan] saved report → ${path.relative(PROJECT_ROOT, REPORT_PATH)}`)
  warn("! review the report before running --live --confirm.")
  return plan
}

// ---------- Report writer ---------------------------------------------------

async function writeReport(plan, dump, args) {
  const lines = []
  lines.push(`# Medium archive → Blog migration report (playwright)`)
  lines.push("")
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Archive URL: \`${dump.archiveUrl}\``)
  lines.push(`Profile: \`${dump.profile}\``)
  lines.push("")
  lines.push(`## Discovery`)
  lines.push("")
  lines.push(`- URLs harvested from archive: **${dump.discoveredCount}**`)
  lines.push(`- Already imported (skipped): **${dump.alreadyImportedCount}**`)
  lines.push(`- NEW posts: **${dump.newCount}**`)
  if (plan.summary) {
    lines.push(`- Enriched successfully: **${plan.summary.enrichedCount}**`)
    lines.push(`- Failed during enrichment: **${plan.summary.failedCount}**`)
    if (args?.maxNew > 0 && plan.summary.newCount > plan.summary.enrichedCount) {
      const deferred = plan.summary.newCount - plan.summary.enrichedCount
      lines.push(
        `- Deferred by \`--max-new ${args.maxNew}\` cap: **${deferred}** (re-run without the flag to process them)`,
      )
    }
  }
  lines.push("")
  if (plan.collisions.length > 0) {
    lines.push(`## Slug collisions`)
    lines.push("")
    for (const c of plan.collisions) {
      lines.push(`- \`${c.slug}\` × ${c.count}: ${c.titles.join(" | ")}`)
    }
    lines.push("")
  }
  if (plan.posts.length > 0) {
    lines.push(`## New post titles`)
    lines.push("")
    for (const post of plan.posts) {
      lines.push(
        `- \`${post.slug}.mdx\` — ${post.title} (${post.frontmatter.pubDate})`,
      )
    }
    lines.push("")
  }
  if (plan.posts.length === 0) {
    lines.push(`**Nothing new to import.** The Medium archive is fully synced.`)
    lines.push("")
  }
  lines.push(`Hero images downloaded to \`public/uploads/medium/\`. All migrated drafts default to \`draft: true\`; flip to \`draft: false\` in Pages CMS when you're ready to publish.`)
  await writeFile(REPORT_PATH, lines.join("\n") + "\n")
}

// ---------- Phase 4: live MDX writer ----------------------------------------

async function liveRun(args) {
  if (!args.confirm) {
    throw new Error(
      "--live requires --confirm. Re-run with --live --confirm once you've reviewed the plan.",
    )
  }
  const plan = await readJsonOrNull(PLAN_PATH)
  if (!plan) {
    throw new Error(
      `No plan at ${path.relative(PROJECT_ROOT, PLAN_PATH)}. Run --plan first.`,
    )
  }
  await ensureDir(POSTS_DIR)
  await ensureDir(UPLOADS_DIR)

  let written = 0
  let skipped = 0
  let failed = 0

  // Slug-collision disambiguator (in case plan was written before pre-disambiguation).
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
      const fm = { ...post.frontmatter }
      const issues = validatePostFrontmatter(fm)
      if (issues.length > 0) {
        warn(`[skip ${slug}] frontmatter invalid: ${issues.join("; ")}`)
        failed += 1
        continue
      }
      const out = emitFrontmatter(fm) + "\n" + (post.body ?? "")
      await writeFile(filePath, out)
      verboseLog(args, `[wrote] ${filePath}`)
      written += 1
    } catch (e) {
      warn(`[fail ${slug}] ${e instanceof Error ? e.message : String(e)}`)
      failed += 1
    }
  }

  log(`[live] wrote ${written} file(s), skipped ${skipped}, failed ${failed}`)
  if (failed > 0) warn(`! review the failing items above before committing`)
}

// ---------- Entry -----------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv)
  try {
    switch (args.mode) {
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
