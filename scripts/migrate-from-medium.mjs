#!/usr/bin/env node
/**
 * migrate-from-medium.mjs
 *
 * Pulls posts from a public Medium profile's RSS feed (default: @nite.tanzarn)
 * and emits the SAME artefact shape as scripts/migrate-from-wix-playwright.mjs:
 *   - scripts/.migration/medium-dump.json
 *   - scripts/.migration/medium-plan.json
 *   - scripts/.migration/medium-report.md
 *   - public/uploads/medium/<slug>-hero.<ext>
 *   - src/content/posts/en/<slug>.mdx  (only with --live --confirm)
 *
 * Why RSS instead of Playwright? Medium's post body is a JS-rendered SPA. The
 * RSS feed <content:encoded> payload contains the FULL HTML body (server-
 * rendered). Pair that with og:image fetched from each post URL <head> (also
 * server-rendered) and we get everything we need for MDX without a browser.
 *
 * Modes (mirrors scripts/migrate-from-wix-playwright.mjs):
 *   --plan (default)    Emit artefacts only. No MDX written.
 *   --live --confirm    Read plan.json and write MDX files.
 *   --force             (with --live) Overwrite MDX files that already exist.
 *   --fresh             Refetch even if dump.json exists.
 *   --verbose           Log every step.
 *   --concurrency N     Parallel og:image + body fetches (default 4).
 *   -h, --help          Show this message.
 *
 * Environment (auto-loaded from .env.local if invoked with
 * `node --env-file-if-exists=.env.local`):
 *   MEDIUM_PROFILE      Username (leading @ accepted, default @nite.tanzarn).
 *   MEDIUM_FEED_HOST    Default https://medium.com.
 *   MEDIUM_USER_AGENT   Override User-Agent.
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

// ---------- Configuration ---------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, "..")
const POSTS_DIR = path.join(PROJECT_ROOT, "src/content/posts/en")
const UPLOADS_DIR = path.join(PROJECT_ROOT, "public/uploads/medium")
const MIGRATION_DIR = path.join(PROJECT_ROOT, "scripts/.migration")
const DUMP_PATH = path.join(MIGRATION_DIR, "medium-dump.json")
const PLAN_PATH = path.join(MIGRATION_DIR, "medium-plan.json")
const REPORT_PATH = path.join(MIGRATION_DIR, "medium-report.md")

const DEFAULT_PROFILE = "@nite.tanzarn"
const DEFAULT_FEED_HOST = "https://medium.com"
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
const DEFAULT_CONCURRENCY = 4
const FEED_TIMEOUT_MS = 15000
const POST_TIMEOUT_MS = 15000

// ---------- Optional dependency guards (turndown) ----------------------------

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

// ---------- CLI -------------------------------------------------------------

function printHelp() {
  console.log(`Usage: node scripts/migrate-from-medium.mjs [options]

Options:
  --plan           RSS + per-post fetch + dump/plan/report (default).
  --live           Read existing plan.json and write MDX files.
  --force          (with --live) Overwrite MDX files that already exist.
  --confirm        Required to actually write files with --live.
  --fresh          Refetch from RSS even if dump.json exists.
  --verbose        Log every fetch and conversion decision.
  --concurrency N  Parallel post-detail fetches (default ${DEFAULT_CONCURRENCY}).
  -h, --help       Show this message.

Environment (process.env; auto-loaded from .env.local if Node 22
--env-file-if-exists=.env.local is used):

  MEDIUM_PROFILE    Username (default ${DEFAULT_PROFILE}; leading @ optional).
  MEDIUM_FEED_HOST  Default ${DEFAULT_FEED_HOST}.
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

// ---------- Slugify + taxonomy mapping --------------------------------------
// Mirrors scripts/migrate-from-wix-playwright.mjs.

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
  ["articles", "articles"],
  ["essay", "articles"],
  ["essays", "articles"],
  ["article", "articles"],
  ["post", "articles"],
  ["posts", "articles"],
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
])

function mapCategory(alias) {
  if (!alias) return "articles"
  const normalized = slugify(alias)
  return CATEGORY_ALIAS_MAP.get(normalized) ?? "articles"
}

// ---------- Medium URL handling ---------------------------------------------

// URL pattern: https://medium.com/@user/<slug>-<hash>[?source=...]
// Strip query/hash → drop the @user/ prefix → strip trailing -<hex> hash.
function cleanMediumSlug(url) {
  if (!url) return ""
  const cleaned = url.split("?")[0].split("#")[0].replace(/\/+$/, "")
  const segments = cleaned.split("/").filter(Boolean)
  // Drop empty + the @user segment (where applicable).
  const filtered = segments.filter((s) => !s.startsWith("@"))
  const raw = filtered[filtered.length - 1] ?? ""
  // Medium appends a 12-char lowercase hex hash like `-7b264f6f8a59`.
  return raw.replace(/[-_][a-f0-9]{8,16}$/i, "").replace(/[-_]\d{10,}$/i, "")
}

// ---------- Plain-text fetch (no Playwright) -------------------------------

async function fetchText(url, timeoutMs) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": process.env.MEDIUM_USER_AGENT || DEFAULT_USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      redirect: "follow",
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return await res.text()
  } finally {
    clearTimeout(id)
  }
}

// ---------- Lightweight RSS parser ------------------------------------------
// Strict-enough regex parser for Medium's RSS feed. Avoids adding an XML lib.

function extractCDATA(str, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // <name><![CDATA[ ... ]]></name>
  const cdata = new RegExp(
    `<${escaped}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escaped}>`,
    "i",
  )
  const m1 = cdata.exec(str)
  if (m1) return m1[1].trim()
  // <name>...</name>
  const plain = new RegExp(`<${escaped}>([\\s\\S]*?)<\\/${escaped}>`, "i")
  const m2 = plain.exec(str)
  return m2 ? m2[1].trim() : ""
}

function parseRss(xml) {
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi
  const items = []
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    const chunk = m[1]
    items.push({
      title: extractCDATA(chunk, "title"),
      link: extractCDATA(chunk, "link"),
      guid: extractCDATA(chunk, "guid"),
      pubDate: extractCDATA(chunk, "pubDate"),
      description: extractCDATA(chunk, "description"),
      contentEncoded: extractCDATA(chunk, "content:encoded"),
      creator: extractCDATA(chunk, "dc:creator"),
      categories: [...chunk.matchAll(/<category>([\s\S]*?)<\/category>/gi)]
        .map((x) => x[1].trim())
        .filter(Boolean),
    })
  }
  return items
}

function profileFromRss(xml) {
  const m = /<channel\b[^>]*>([\s\S]*?)<\/channel>/i.exec(xml)
  if (!m) return null
  const link = extractCDATA(m[1], "link")
  // link is like https://medium.com/@nite.tanzarn
  const at = link.match(/@([^/]+)\/?$/)
  return at ? `@${at[1]}` : null
}

// ---------- Per-post enrichment ---------------------------------------------

function pubDateToIso(rfc822) {
  const d = new Date(rfc822)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

async function fetchPostHead(url) {
  // Server-rendered <head> from a public post URL: og:* + twitter:* + JSON-LD.
  // We don't follow inline JS; we just read the meta tags.
  try {
    const html = await fetchText(url, POST_TIMEOUT_MS)
    const meta = {}
    const re = /<meta\b[^>]*>/gi
    let m
    while ((m = re.exec(html)) !== null) {
      const tag = m[0]
      const property =
        /property=["']([^"']+)["']/i.exec(tag)?.[1] ??
        /name=["']([^"']+)["']/i.exec(tag)?.[1]
      const content = /content=["']([^"']*)["']/i.exec(tag)?.[1]
      if (property && content) meta[property] = content
    }
    return {
      heroImage: meta["og:image"] || meta["twitter:image"] || null,
      description:
        meta["og:description"] || meta["twitter:description"] || null,
      title: meta["og:title"] || null,
      rawHtml: html,
    }
  } catch (e) {
    return { heroImage: null, description: null, title: null, error: e.message }
  }
}

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

  // Medium embeds (YouTube, Twitter/X, GitHub Gists, etc.) render as
  // <iframe> elements. Convert them to plaintext links so we don't silently
  // lose content.
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

  // Strip Medium tracking/doubleclick classes from <img> output.
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

// ---------- Body extraction -------------------------------------------------
// Medium sends the full body inside <content:encoded> on the RSS feed, but we
// also pick it up from the public post <article> tag as a fallback.

function extractBodyHtml(item, postHead) {
  // 1. Prefer RSS content:encoded (always present on Medium feeds).
  if (item.contentEncoded && item.contentEncoded.trim()) {
    return item.contentEncoded
  }
  // 2. Fall back to description (truncated teaser — only used as last resort).
  if (item.description && item.description.trim()) {
    return item.description
  }
  // 3. As a last resort, pull the <article> out of the per-post HTML head.
  if (postHead?.rawHtml) {
    const m = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(postHead.rawHtml)
    if (m) return m[1]
  }
  return ""
}

// ---------- Frontmatter ----------------------------------------------------

function buildPostFrontmatter({
  title,
  description,
  slug,
  pubDate,
  pubDateRaw,
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
  if (!pubDate && pubDateRaw) {
    warn(
      `[bad-date] ${slug || "<no-slug>"}: pubDateRaw=${JSON.stringify(pubDateRaw)} — falling back to today`,
    )
  }
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
  if (typeof val === "number") return `${key}: Number.isFinite(val) ? val : 0`
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

// ---------- Phase runners ---------------------------------------------------

async function dumpRun(args) {
  await ensureDir(MIGRATION_DIR)
  const profile = normaliseProfile(
    process.env.MEDIUM_PROFILE || DEFAULT_PROFILE,
  )
  const feedHost = (process.env.MEDIUM_FEED_HOST || DEFAULT_FEED_HOST).replace(
    /\/+$/,
    "",
  )
  const feedUrl = `${feedHost}/feed/${profile}`
  verboseLog(args, `[feed] GET ${feedUrl}`)
  const xml = await fetchText(feedUrl, FEED_TIMEOUT_MS)
  const items = parseRss(xml)
  const channelProfile = profileFromRss(xml) || profile

  const data = {
    fetchedAt: new Date().toISOString(),
    source: "medium-rss",
    feedUrl,
    profile: channelProfile,
    posts: items.map((it) => ({
      url: it.link,
      guid: it.guid,
      title: (it.title || "").trim(),
      slug: cleanMediumSlug(it.link),
      pubDate: it.pubDate,
      description: it.description,
      contentEncoded: it.contentEncoded,
      creator: it.creator,
      categories: it.categories,
    })),
  }
  await writeFile(DUMP_PATH, JSON.stringify(data, null, 2))
  log(
    `[dump] saved ${data.posts.length} post URLs from RSS → ${path.relative(
      PROJECT_ROOT,
      DUMP_PATH,
    )}`,
  )
  return data
}

function normaliseProfile(value) {
  const trimmed = value.trim().replace(/^@?/, "")
  if (!trimmed) return DEFAULT_PROFILE
  return `@${trimmed}`
}

// Parallel runner that fans out per-post enrichment.
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

async function planRun(args) {
  await ensureDir(MIGRATION_DIR)
  let dump = await readJsonOrNull(DUMP_PATH)
  if (!dump || args.freshDump) {
    dump = await dumpRun(args)
  } else if (dump.source !== "medium-rss") {
    warn(
      `[plan] existing medium-dump.json came from "${dump.source ?? "?"}"; refetching --fresh`,
    )
    dump = await dumpRun({ ...args, freshDump: true })
  }

  const plan = {
    posts: [],
    unmappedCategories: new Set(),
    unmappedTags: new Set(),
    collisions: [],
    source: "medium-rss",
  }

  // Pre-disambiguate slugs based on title collisions BEFORE downloading
  // heroes. This guarantees that each post has a unique destination
  // filename for both the MDX and the hero image, so a late collision
  // pass in liveRun can't accidentally re-point an MDX at the wrong hero.
  const titleCounts = new Map()
  for (const post of dump.posts) {
    const base = slugify(post.title || post.slug || "untitled")
    if (!base) continue
    titleCounts.set(base, (titleCounts.get(base) ?? 0) + 1)
  }
  const disambigCursor = new Map()
  for (const post of dump.posts) {
    const base = slugify(post.title || post.slug || "untitled")
    if (!base) {
      post.slug = ""
      continue
    }
    const total = titleCounts.get(base) ?? 0
    if (total > 1) {
      const next = (disambigCursor.get(base) ?? 0) + 1
      disambigCursor.set(base, next)
      post.slug = next === 1 ? base : `${base}-${next}`
      warn(`[slug-collision] ${base} → ${post.slug} (${post.url})`)
    } else {
      post.slug = base
    }
  }

  // Per-post enrichment: og:image + body via Turndown. Each worker is
  // try/caught so a single failed post is recorded instead of crashing
  // the queue.
  const enriched = await runQueue(dump.posts, args.concurrency, async (post) => {
    verboseLog(args, `[post] ${post.url}`)
    try {
      const head = await fetchPostHead(post.url)
      const heroLocal = await maybeDownloadHero(
        post.slug || cleanMediumSlug(post.url),
        head.heroImage,
        args,
      )
      const bodyHtml = extractBodyHtml(post, head)
      let body = ""
      if (bodyHtml) {
        try {
          body = await htmlToMdx(bodyHtml, args)
        } catch (e) {
          warn(`[mdx-fail ${post.slug}] ${e.message}`)
        }
      }
      return { ok: true, post, head, heroLocal, body }
    } catch (e) {
      warn(
        `[post-fail ${post.url}] ${e instanceof Error ? e.message : String(e)}`,
      )
      return {
        ok: false,
        post,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  })

  for (const r of enriched) {
    if (!r.ok) continue
    const { post, head, heroLocal, body } = r
    const baseSlug = slugify(post.title || post.slug || "untitled")
    if (!baseSlug) continue

    // Medium RSS <category> nodes aren't always present; preserve what we
    // have and let editors finalise taxonomy in Pages CMS.
    const tagSlugs = (post.categories ?? [])
      .map((t) => slugify(t))
      .filter(Boolean)
    for (const tag of tagSlugs) plan.unmappedTags.add(tag)
    plan.unmappedCategories.add("articles") // default; surfaces the override reminder

    const descriptionSource =
      head.description ||
      stripHtml(post.description || "").trim()
    const mappedCategory = "articles" // see DESIGN.md — editor-driven

    const frontmatter = buildPostFrontmatter({
      title: post.title,
      description: descriptionSource,
      slug: baseSlug || post.slug,
      pubDate: pubDateToIso(post.pubDate),
      pubDateRaw: post.pubDate,
      tags: tagSlugs,
      mappedCategory,
      heroLocal,
    })

    plan.posts.push({
      title: frontmatter.title,
      // baseSlug == post.slug here because we pre-disambiguated above.
      slug: baseSlug || post.slug,
      targetDir: POSTS_DIR,
      frontmatter,
      body,
      category: mappedCategory,
      tags: tagSlugs,
      sourceUrl: post.url,
      images: heroLocal ? [{ kind: "hero", local: heroLocal }] : [],
      pubDateRaw: post.pubDate,
    })
  }

  // Slug collisions.
  const slugCounts = new Map()
  for (const p of plan.posts) {
    slugCounts.set(p.slug, (slugCounts.get(p.slug) ?? 0) + 1)
  }
  for (const [slug, count] of slugCounts) {
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
  await writeReport(plan, dump)
  log(`[plan] saved plan → ${path.relative(PROJECT_ROOT, PLAN_PATH)}`)
  log(`[plan] saved report → ${path.relative(PROJECT_ROOT, REPORT_PATH)}`)
  warn("! review the report and the plan JSON before running with --live --confirm")
  return plan
}

function stripHtml(input) {
  return (input ?? "").replace(/<[^>]*>/g, " ")
}

async function writeReport(plan, dump) {
  const lines = []
  lines.push(`# Medium → Blog migration report`)
  lines.push("")
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Discovery source: ${dump.source}`)
  lines.push(`Feed URL: ${dump.feedUrl}`)
  lines.push(`Profile: \`${dump.profile}\``)
  lines.push("")
  lines.push(`Mapped posts: ${plan.posts.length}`)
  lines.push(`Default category: \`articles\` (editor overrides taxonomy in Pages CMS)`)
  if (plan.unmappedTags.length > 0) {
    lines.push("")
    lines.push(`Tag labels detected from Medium feed (not auto-mapped):`)
    for (const slug of plan.unmappedTags) lines.push(`- \`${slug}\``)
  }
  if (plan.collisions.length > 0) {
    lines.push("")
    lines.push(`Slug collisions (titles mapping to the same kebab):`)
    for (const c of plan.collisions) {
      lines.push(`- \`${c.slug}\` × ${c.count}: ${c.titles.join(" | ")}`)
    }
  }
  if (plan.posts.length > 0) {
    lines.push("")
    lines.push(`First 20 post titles:`)
    for (const post of plan.posts.slice(0, 20)) {
      lines.push(
        `- \`${post.slug}.mdx\` — ${post.title} (${post.frontmatter.pubDate})`,
      )
    }
  }
  lines.push("")
  lines.push(`Hero images downloaded to \`public/uploads/medium/\`. All migrated drafts default to \`draft: true\`; flip to \`draft: false\` in Pages CMS when you're ready to publish.`)
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
    throw new Error(
      `No plan at ${path.relative(PROJECT_ROOT, PLAN_PATH)}. Run --plan first.`,
    )
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
    if (args.verbose && error instanceof Error && error.stack) log(error.stack)
    process.exitCode = 1
  }
}

await main()
