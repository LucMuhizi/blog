#!/usr/bin/env node
/**
 * migrate-from-wix.mjs
 *
 * One-shot migration from the legacy Wix site into this Blog / Astro
 * content-collection structure. Designed to be safe by default: without
 * `--live` it only fetches data and produces a reviewable plan.
 *
 * Workflow
 *   1. Set WIX_API_KEY (and optionally WIX_SITE_ID) in a local .env.local
 *      file. Run with `node --env-file=.env.local scripts/migrate-from-wix.mjs`
 *      or export the variables before invoking the script.
 *   2. `node scripts/migrate-from-wix.mjs --plan` fetches Wix content, builds
 *      a plan, and writes scripts/.migration/{dump.json,plan.json,report.md}.
 *   3. Open the report. Adjust taxonomy mapping in this file if any category
 *      labels from Wix should land somewhere different.
 *   4. `node scripts/migrate-from-wix.mjs --live --confirm` reads the plan
 *      and writes MDX files into src/content/{posts,authors,…}/en/ plus
 *      images into public/uploads/migrated/. Existing files are skipped
 *      (use --force to overwrite).
 *
 * The script never publishes to git, never sends the API key anywhere
 * except www.wixapis.com, and never deletes existing content.
 */

import { mkdir, writeFile, readFile, access, constants as fsConstants } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

// PROJECT_ROOT is the parent of this script's directory. Use fileURLToPath
// rather than `new URL(import.meta.url).pathname` because the latter prefixes
// drive letters with a slash on Windows, which path.dirname then mangles into
// a `C:\C:\…` double-drive path.
// PROJECT_ROOT = path.resolve(dirname(fileURLToPath(import.meta.url)), "..")
//               = path.resolve(<dir of scripts/>, "..") = <repo root>
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, "..")
const POSTS_DIR = path.join(PROJECT_ROOT, "src/content/posts/en")
const AUTHORS_DIR = path.join(PROJECT_ROOT, "src/content/authors/en")
const UPLOADS_DIR = path.join(PROJECT_ROOT, "public/uploads/migrated")
const MIGRATION_DIR = path.join(PROJECT_ROOT, "scripts/.migration")
const DUMP_PATH = path.join(MIGRATION_DIR, "dump.json")
const PLAN_PATH = path.join(MIGRATION_DIR, "plan.json")
const REPORT_PATH = path.join(MIGRATION_DIR, "report.md")

const WIX_API_BASE = "https://www.wixapis.com"
// Wix moved their post collection from /posts/v3 (deprecated) to /blog/v3
// around 2024. /blog/v3/{posts,categories,tags} exist; /blog/v3/authors is
// not exposed — authors are usually embedded in the post payload or reachable
// through the Wix Members API.
const POSTS_BASE = `${WIX_API_BASE}/blog/v3`
const WIX_PUBLIC_BASE = "https://static.wixstatic.com"
const DEFAULT_LOCALE = "en"

// Keep in sync with src/config/taxonomy.ts. Used to surface unmapped tags in
// the report. Unknown tags are still written (the schema accepts any string)
// but they will not appear in the taxonomy dropdown.
const KNOWN_CATEGORY_SLUGS = new Set([
  "articles",
  "research",
  "policy",
  "speaking",
  "notes",
  "projects",
])
const KNOWN_TAG_SLUGS = new Set([
  "strategy",
  "risk",
  "market",
  "reflect",
  "media",
  "roam",
  "allocation",
  "innovation",
  "model",
  "management",
  "governance",
  "development",
  "policy",
  "education",
  "health",
  "technology",
  "africa",
  "uganda",
  "consultancy",
  "research",
  "leadership",
])

// ---------- CLI --------------------------------------------------------------

function printHelp() {
  console.log(`Usage: node scripts/migrate-from-wix.mjs [options]

Options:
  --dump         Only fetch from Wix API and save scripts/.migration/dump.json.
  --plan         Fetch + build a plan (default if neither flag is given).
  --live         Write MDX files using the existing plan.
  --force        (with --live) Overwrite MDX files that already exist.
  --confirm      (with --live) Required to actually write files.
  --fresh        Refetch dump from Wix APIs even if a dump already exists.
  --verbose      Print every API call and mapping decision.
  -h, --help     Show this message.

Environment (read via process.env, e.g. set in .env.local and pass
--env-file=.env.local to Node 22+):

  WIX_API_KEY    Wix Headless API key with read access to Blog.
                 Generate in your Wix Headless project dashboard.
  WIX_SITE_ID    (Optional) Filters posts to a single site if your account
                 has more than one. Format: the site id shown in the
                 Dashboard URL.
`)
}

function parseArgs(argv) {
  const args = {
    mode: "plan",
    force: false,
    confirm: false,
    freshDump: false,
    verbose: false,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    switch (a) {
      case "--dump": args.mode = "dump"; break
      case "--plan": args.mode = "plan"; break
      case "--live": args.mode = "live"; break
      case "--force": args.force = true; break
      case "--confirm": args.confirm = true; break
      case "--fresh": args.freshDump = true; break
      case "--verbose": args.verbose = true; break
      case "--help":
      case "-h":
        printHelp()
        process.exit(0)
      default:
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
  // Non-Latin scripts (CJK, Arabic, Cyrillic, Hebrew, etc.) drop out of the
  // strip pipeline above. Fall back to a length-bounded hex digest of the
  // raw title so two different titles never collide on the empty slug.
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
  if (CATEGORY_ALIAS_MAP.has(normalized)) {
    return CATEGORY_ALIAS_MAP.get(normalized)
  }
  if (KNOWN_CATEGORY_SLUGS.has(normalized)) {
    return normalized
  }
  return normalized
}

function mapWixTagToSlug(wixLabel) {
  if (!wixLabel) return null
  const slug = slugify(wixLabel)
  return slug || null
}

// ---------- Wix API client ---------------------------------------------------

function assertApiKey() {
  const key = process.env.WIX_API_KEY
  if (!key || typeof key !== "string" || key.trim() === "") {
    throw new Error(
      "Missing WIX_API_KEY. Set it in .env.local or export it, then re-run the script.",
    )
  }
  return key.trim()
}

async function wixFetch(args, path, query = {}, init = {}) {
  assertApiKey()
  const url = new URL(`${POSTS_BASE}${path}`)
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v))
    }
  }
  verboseLog(args, `→ GET ${url.toString()}`)
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: process.env.WIX_API_KEY,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    const err = new Error(
      `Wix API ${res.status} ${res.statusText} for ${path}: ${text.slice(0, 240)}`,
    )
    err.status = res.status
    throw err
  }
  return res.json()
}

async function fetchAllOf(args, collectionKey) {
  const siteId = process.env.WIX_SITE_ID
  const items = []
  let offset = 0
  const limit = 100
  while (true) {
    const query = {
      "paging.limit": limit,
      "paging.offset": offset,
    }
    if (siteId) query.siteId = siteId
    const j = await wixFetch(args, `/${collectionKey}`, query)
    const batch = j[collectionKey] ?? j.posts ?? []
    verboseLog(args, `  ← batch ${batch.length} (total ${items.length + batch.length})`)
    items.push(...batch)
    const hasNext = j.paging?.hasNext ?? j.metaData?.hasNext ?? false
    if (!hasNext) break
    offset += limit
  }
  return items
}

// ---------- Image URL resolution --------------------------------------------

function resolveWixImageUri(wixImageUri) {
  if (!wixImageUri || typeof wixImageUri !== "string") return null
  if (wixImageUri.startsWith("https://") || wixImageUri.startsWith("http://")) {
    return wixImageUri
  }
  if (wixImageUri.startsWith("wix:image://v1/")) {
    const rest = wixImageUri.slice("wix:image://v1/".length)
    return `${WIX_PUBLIC_BASE}/media/${rest}`
  }
  return null
}

// ---------- Wix Rich Text → MDX ---------------------------------------------

function escapeMd(s) {
  return (s ?? "")
    .replace(/\r\n/g, "\n")
    // Escape only the inline-markdown sequences that would otherwise break layout
    .replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, "\\\\$1")
}

function mdString(s) {
  // YAML 1.2 + the underlying md processors happily accept JSON-style
  // double-quoted strings. JSON.stringify gives us the escaping for free.
  return JSON.stringify(s)
}

function rteText(node) {
  const raw = node.text ?? ""
  if (Array.isArray(node.decoration)) {
    // Open outer-most first, close inner-most first
    const opening = []
    const closing = []
    for (const d of node.decoration) {
      if (d === "BOLD") { opening.push("**"); closing.unshift("**") }
      else if (d === "ITALIC") { opening.push("*"); closing.unshift("*") }
      else if (d === "UNDERLINE") { opening.push("<u>"); closing.unshift("</u>") }
    }
    return opening.join("") + escapeMd(raw) + closing.join("")
  }
  return escapeMd(raw)
}

function rteInline(nodes, ctx) {
  let out = ""
  for (const n of nodes ?? []) {
    out += rteToMdx(n, ctx, /* inline */ true)
  }
  return out
}

function rteBlock(nodes, ctx) {
  let out = ""
  for (const n of nodes ?? []) {
    out += rteToMdx(n, ctx, /* inline */ false)
  }
  return out
}

function rteToMdx(node, ctx, inline) {
  if (!node) return ""
  switch (node.type) {
    case "TEXT":
      return rteText(node)

    case "PARAGRAPH":
      return rteBlock(node.nodes, ctx).trimEnd() + "\n\n"

    case "HEADING": {
      const level = Math.min(5, Math.max(2, node.level ?? 2))
      return `${"#".repeat(level)} ${rteInline(node.nodes, ctx).trim()}\n\n`
    }

    case "BULLETED_LIST":
      return rteChildrenList(node.nodes, ctx, /* ordered */ false)

    case "ORDERED_LIST":
      return rteChildrenList(node.nodes, ctx, /* ordered */ true)

    case "LIST_ITEM": {
      const inner = rteBlock(node.nodes, ctx).trim().replace(/\n/g, "\n  ")
      if (inline) return inner
      return `- ${inner}\n`
    }

    case "LINK": {
      const url = node.url ?? ""
      const label = rteInline(node.nodes, ctx)
      return `[${label}](${url})`
    }

    case "IMAGE": {
      const img = node.image ?? {}
      const wixSrc = img.src?.url ?? ""
      const resolved = resolveWixImageUri(wixSrc)
      const url = resolved ?? wixSrc
      const alt = escapeMd(img.altText ?? "")
      if (!url) return ""
      ctx.imageRefs.push({ wixSrc, resolvedUrl: url, alt })
      return `![${alt}](${url})\n\n`
    }

    case "VIDEO": {
      const url = node.video?.url ?? ""
      if (!url) return ""
      ctx.videoRefs.push(url)
      return `[Watch video](${url})\n\n`
    }

    case "DIVIDER":
      return `---\n\n`

    case "QUOTE": {
      const inner = rteBlock(node.nodes, ctx).trim()
      return inner.split(/\n\n+/).map((p) => `> ${p.replace(/\n/g, "\n> ")}`).join("\n\n") + "\n\n"
    }

    case "CODE_BLOCK":
      return "```" + (node.language ?? "") + "\n" + (node.text ?? "") + "\n```\n\n"

    default:
      // Unknown node type — recurse into children, but log so the report can
      // flag content we couldn't render faithfully.
      if (ctx.args?.verbose) {
        verboseLog(
          ctx.args,
          `  ! unhandled RTE node type "${node.type}" in ${ctx.tag ?? "body"}`,
        )
      }
      return rteBlock(node.nodes ?? [], ctx)
  }
}

function rteChildrenList(items, ctx, { ordered }) {
  let out = ""
  let i = 1
  for (const item of items ?? []) {
    if (ordered) {
      const inner = rteBlock(item.nodes, ctx).trim()
      out += `${i++}. ${inner}\n`
    } else {
      const inner = rteBlock(item.nodes, ctx).trim()
      out += `- ${inner}\n`
    }
  }
  return out + "\n"
}

function wixRteToMdx(content, args) {
  const ctx = { imageRefs: [], videoRefs: [], args }
  const mdx = rteBlock(content?.nodes ?? [], ctx).trimEnd() + "\n"
  return { mdx, imageRefs: ctx.imageRefs, videoRefs: ctx.videoRefs }
}

// ---------- Image download --------------------------------------------------

const SUPPORTED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"])

function imageExtFromUrl(url) {
  try {
    const pathPart = new URL(url).pathname.split("?")[0]
    const ext = pathPart.slice(pathPart.lastIndexOf(".")).toLowerCase()
    return SUPPORTED_EXT.has(ext) ? ext : ".jpg"
  } catch {
    return ".jpg"
  }
}

function imageDestFor(postSlug, srcUrl) {
  const safeSlug = slugify(postSlug).slice(0, 60) || "post"
  const ext = imageExtFromUrl(srcUrl)
  return path.join(UPLOADS_DIR, `${safeSlug}-hero${ext}`)
}

async function downloadImage(url, destPath) {
  const res = await fetch(url, { headers: { Accept: "image/*" } })
  if (!res.ok) throw new Error(`Image ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await ensureDir(path.dirname(destPath))
  await writeFile(destPath, buf)
  return destPath
}

// ---------- Frontmatter assembly --------------------------------------------

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

function buildPostFrontmatter(wixPost, mappedCategory, tagSlugs) {
  const title = (wixPost.title ?? "Untitled").toString()
  const slug = slugify(title) || "untitled"
  const pub = pickDate(
    wixPost.firstPublishedDate,
    wixPost.lastPublishedDate,
    wixPost.dateCreated,
  )
  const upd = pickDate(wixPost.lastPublishedDate)
  const coverSrc = wixPost.coverImage?.url ?? null
  const coverAltRaw = wixPost.coverImage?.altText ?? title
  const coverAlt = coverAltRaw.toString().trim() || title
  const coverW = Number(wixPost.coverImage?.width) || null
  const coverH = Number(wixPost.coverImage?.height) || null
  const excerpt = (wixPost.excerpt ?? coverAlt ?? "").toString().trim()
  const description = excerpt.length > 0 ? excerpt.slice(0, 160) : title.slice(0, 160)
  const isDraft = (wixPost.status ?? "PUBLISHED") !== "PUBLISHED"

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
      // Hero image path is filled in once the image downloads succeed.
      heroImage: "/uploads/migrated/PLACEHOLDER.jpg",
      heroImageAlt: coverAlt,
      ...(coverW ? { heroImageWidth: coverW } : {}),
      ...(coverH ? { heroImageHeight: coverH } : {}),
      locale: DEFAULT_LOCALE,
      draft: isDraft,
      featured: false,
    },
    slug,
    sourceCoverWixUrl: coverSrc,
  }
}

function buildAuthorFrontmatter(author) {
  const name = (author.name ?? "Unnamed").toString()
  const slug = slugify(name) || "default"
  const bio = (author.bio ?? "").toString().slice(0, 280)
  const avatarWixUrl = author.coverImage?.url ?? null
  return {
    frontmatter: {
      name,
      bio,
      avatarWixUrl,
      slug,
    },
    slug,
  }
}

// ---------- Frontmatter YAML emitter ---------------------------------------

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

// ---------- Validation ------------------------------------------------------

function validatePostFrontmatter(fm) {
  const errors = []
  if (!fm.title) errors.push("title missing")
  if (!fm.description) errors.push("description missing")
  if (!KNOWN_CATEGORY_SLUGS.has(fm.category)) {
    errors.push(`category "${fm.category}" not in taxonomy enum`)
  }
  if (!fm.heroImage?.startsWith("/uploads/")) errors.push("heroImage must be a local /uploads/ path")
  if (!fm.heroImageAlt) errors.push("heroImageAlt missing")
  if (!fm.pubDate) errors.push("pubDate missing")
  if (!Array.isArray(fm.tags)) errors.push("tags must be array")
  if (!Array.isArray(fm.authors) || fm.authors.length === 0) errors.push("authors missing")
  return errors
}

// ---------- Plan builder ----------------------------------------------------

async function buildPlan(dump, args = {}) {
  const plan = {
    posts: [],
    authors: [],
    unmappedCategories: new Map(),
    unmappedTags: new Set(),
    imageDownloads: [],
    skipped: [],
  }
  const categoriesById = new Map(
    (dump.categories ?? []).map((c) => [c.id, c.label ?? c.name ?? ""]),
  )
  const tagsById = new Map(
    (dump.tags ?? []).map((t) => [t.id, t.label ?? t.name ?? ""]),
  )
  const authorById = new Map(
    (dump.authors ?? []).map((a) => [a.id, { id: a.id, name: a.name, bio: a.bio, coverImage: a.coverImage }]),
  )

  for (const wixPost of dump.posts ?? []) {
    // Categories
    const wixCategories = (wixPost.categoryIds ?? [])
      .map((cid) => categoriesById.get(cid))
      .filter(Boolean)
    let mappedCategory = "articles"
    if (wixCategories.length > 0) {
      mappedCategory = mapWixCategoryToSlug(wixCategories[0])
      if (!KNOWN_CATEGORY_SLUGS.has(mappedCategory)) {
        plan.unmappedCategories.set(mappedCategory, wixCategories.join(", "))
      }
    }

    const wixTagLabels = (wixPost.tagIds ?? [])
      .map((tid) => tagsById.get(tid))
      .filter(Boolean)
    const tagSlugs = []
    for (const label of wixTagLabels) {
      const slug = mapWixTagToSlug(label)
      if (!slug) continue
      tagSlugs.push(slug)
      if (!KNOWN_TAG_SLUGS.has(slug)) plan.unmappedTags.add(slug)
    }

    // Author
    const wixAuthor = (wixPost.authorId && authorById.get(wixPost.authorId)) || null
    const authorSlug = wixAuthor ? slugify(wixAuthor.name) || "default" : null

    const built = buildPostFrontmatter(wixPost, mappedCategory, tagSlugs)
    const rteArgs = { verbose: args.verbose }
    const { mdx, imageRefs } = wixRteToMdx(wixPost.content ?? { nodes: [] }, rteArgs)

    // Hero image: cover takes priority over body images.
    const allRefs = []
    if (built.sourceCoverWixUrl) {
      allRefs.push({
        wixSrc: built.sourceCoverWixUrl,
        kind: "hero",
        pageSlug: built.slug,
      })
    }
    for (const ref of imageRefs) {
      allRefs.push({
        wixSrc: ref.wixSrc,
        kind: "body",
        pageSlug: built.slug,
      })
    }

    plan.posts.push({
      title: built.frontmatter.title,
      slug: built.slug,
      targetDir: POSTS_DIR,
      source: built,
      body: mdx,
      tags: tagSlugs,
      category: mappedCategory,
      authorSlug,
      images: allRefs,
      draft: built.frontmatter.draft,
    })
  }

  for (const author of dump.authors ?? []) {
    const built = buildAuthorFrontmatter(author)
    plan.authors.push({
      slug: built.slug,
      targetDir: AUTHORS_DIR,
      source: built,
    })
  }

  plan.unmappedCategories = [...plan.unmappedCategories.entries()]
  plan.unmappedTags = [...plan.unmappedTags]

  // Slug collisions: two Wix posts whose titles slugify to the same kebab.
  // Surface them so the editor can rename or the script can disambiguate.
  const slugCounts = new Map()
  for (const post of plan.posts) {
    slugCounts.set(post.slug, (slugCounts.get(post.slug) ?? 0) + 1)
  }
  const collisions = []
  for (const [slug, count] of slugCounts) {
    if (count > 1) {
      const titles = plan.posts.filter((p) => p.slug === slug).map((p) => p.title)
      collisions.push({ slug, count, titles })
    }
  }
  plan.collisions = collisions

  if (args.verbose && collisions.length > 0) {
    for (const c of collisions) {
      verboseLog(
        args,
        `[collision] slug "${c.slug}" appears ${c.count} times: ${c.titles.join(" | ")}`,
      )
    }
  }

  return plan
}

// ---------- Dump runner -----------------------------------------------------

function extractStatusCode(errorOrMessage) {
  if (
    errorOrMessage &&
    typeof errorOrMessage === "object" &&
    "status" in errorOrMessage &&
    typeof errorOrMessage.status === "number"
  ) {
    return errorOrMessage.status
  }
  const message =
    typeof errorOrMessage === "string"
      ? errorOrMessage
      : (errorOrMessage?.message ?? "")
  const m = /Wix API (\d{3})/.exec(message)
  return m ? Number(m[1]) : null
}

function compactWixError(message) {
  // Wix 403 returns a short JSON body — lift it out so it survives into the
  // log without dragging an HTML Angular SPA shell with it.
  const text = message ?? ""
  if (text.includes("ResourceNotFoundError")) return "404 RESOURCE_NOT_FOUND"
  const json = /\{[^{}\[\]]*\}/.exec(text)
  if (json) return json[0].slice(0, 160)
  return text.split(":").slice(0, 3).join(":").trim().slice(0, 200)
}

async function dumpRun(args) {
  assertApiKey()
  await ensureDir(MIGRATION_DIR)
  const data = {
    fetchedAt: new Date().toISOString(),
    posts: [],
    categories: [],
    tags: [],
    authors: [],
  }
  let allFailed = true
  for (const collection of ["posts", "categories", "tags", "authors"]) {
    try {
      data[collection] = await fetchAllOf(args, collection)
      if (data[collection].length > 0) allFailed = false
    } catch (error) {
      const code = extractStatusCode(error)
      const msg = error instanceof Error ? error.message : String(error)
      warn(
        `[dump] ${collection} failed (HTTP ${code ?? "?"}): ${compactWixError(msg)}`,
      )
    }
  }
  await writeFile(DUMP_PATH, JSON.stringify(data, null, 2))
  log(
    `[dump] saved ${data.posts.length} posts, ${data.categories.length} categories, ${data.tags.length} tags, ${data.authors.length} authors → ${path.relative(PROJECT_ROOT, DUMP_PATH)}`,
  )
  if (allFailed) {
    warn(
      "[dump] every collection returned 0 rows. The API key probably lacks the Wix Blog scope, or the Blog app isn't connected to the Headless project.",
    )
  }
  return data
}

// ---------- Plan runner -----------------------------------------------------

async function planRun(args) {
  assertApiKey()
  await ensureDir(MIGRATION_DIR)
  let dump = await readJsonOrNull(DUMP_PATH)
  if (!dump || args.freshDump) {
    dump = await dumpRun(args)
  }
  const plan = await buildPlan(dump, args)
  await writeFile(PLAN_PATH, JSON.stringify(plan, null, 2))
  await writeReport(plan, dump)
  log(`[plan] saved plan → ${path.relative(PROJECT_ROOT, PLAN_PATH)}`)
  log(`[plan] saved report → ${path.relative(PROJECT_ROOT, REPORT_PATH)}`)
  warn("! review the report and the plan JSON before running with --live --confirm")
  return plan
}

async function writeReport(plan, dump) {
  const lines = []
  lines.push(`# Wix → Blog migration report`)
  lines.push("")
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push("")
  lines.push(`Source counts:`)
  lines.push(`- Posts: ${(dump.posts ?? []).length}`)
  lines.push(`- Categories: ${(dump.categories ?? []).length}`)
  lines.push(`- Tags: ${(dump.tags ?? []).length}`)
  lines.push(`- Authors: ${(dump.authors ?? []).length}`)
  lines.push("")
  lines.push(`Mapped posts: ${plan.posts.length}`)
  lines.push(`Mapped authors: ${plan.authors.length}`)
  lines.push("")
  if (plan.unmappedCategories.length > 0) {
    lines.push(`Categories not in the taxonomy enum:`)
    for (const [slug, original] of plan.unmappedCategories) {
      lines.push(`- \`${slug}\` (from Wix: ${original})`)
    }
    lines.push("")
    lines.push(`> Add these to \`src/config/taxonomy.ts\` if you want them in the dropdown.`)
    lines.push("> Otherwise they remain as raw frontmatter category strings and the card page will not link them.")
    lines.push("")
  }
  if (plan.unmappedTags.length > 0) {
    lines.push(`Tags not in the taxonomy enum:`)
    for (const slug of plan.unmappedTags) {
      lines.push(`- \`${slug}\``)
    }
    lines.push("")
  }
  if (plan.collisions && plan.collisions.length > 0) {
    lines.push(`Slug collisions (post titles that map to the same kebab):`)
    for (const c of plan.collisions) {
      lines.push(`- \`${c.slug}\` × ${c.count}: ${c.titles.join(" | ")}`)
    }
    lines.push("")
    lines.push(`> The script will append \`-2\`, \`-3\`, … to the kebab for collisions. Rename the posts in Wix before re-running if you want cleaner URLs.`)
    lines.push("")
  }
  lines.push(`Pages (About, Services, Values, etc.) are not migrated by this script — the Wix Posts API does not expose static pages. Re-create those singletons in Pages CMS or paste the old content into \`src/content/pages/en/\` directly.`)
  lines.push("")
  if (plan.posts.length > 0) {
    lines.push(`First 20 post titles:`)
    for (const post of plan.posts.slice(0, 20)) {
      const draftLabel = post.draft ? "draft" : "live"
      const cat = post.category
      lines.push(`- \`${post.slug}.mdx\` [${cat}, ${draftLabel}] — ${post.title}`)
    }
  }
  await writeFile(REPORT_PATH, lines.join("\n") + "\n")
}

// ---------- Live runner -----------------------------------------------------

async function liveRun(args) {
  if (!args.confirm) {
    throw new Error("--live requires --confirm. Re-run with --live --confirm once you've reviewed the plan.")
  }
  await ensureDir(MIGRATION_DIR)
  let plan = await readJsonOrNull(PLAN_PATH)
  if (!plan) {
    throw new Error(`No plan at ${path.relative(PROJECT_ROOT, PLAN_PATH)}. Run --plan first.`)
  }
  if (args.freshDump) {
    warn("--fresh ignored in --live mode; refetch only happens during --plan or --dump.")
  }

  await ensureDir(POSTS_DIR)
  await ensureDir(AUTHORS_DIR)
  await ensureDir(UPLOADS_DIR)

  let written = 0
  let skipped = 0
  let failed = 0

  // Build a slug → occurrence cursor map so collision groups get -2, -3, …
  const collisionCounters = new Map()
  for (const c of plan.collisions ?? []) {
    collisionCounters.set(c.slug, 1)
  }

  // Posts
  for (const post of plan.posts ?? []) {
    let slug = post.slug
    if (collisionCounters.has(slug)) {
      const n = collisionCounters.get(slug) + 1
      const disambiguated = `${slug}-${n}`
      collisionCounters.set(slug, n)
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
      // Download hero image. A failure here bubbles out to the catch below,
      // which skips the post entirely (we never write a broken heroImage).
      let heroLocalPath = null
      const hero = post.images?.find((i) => i.kind === "hero")
      if (hero?.wixSrc) {
        const resolved = resolveWixImageUri(hero.wixSrc)
        const dest = imageDestFor(slug, resolved ?? hero.wixSrc)
        if (resolved) {
          await downloadImage(resolved, dest)
          heroLocalPath = `/uploads/migrated/${path.basename(dest)}`
        }
      }

      const fm = { ...post.source.frontmatter }
      fm.heroImage = heroLocalPath ?? fm.heroImage
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      warn(`[fail ${slug}] ${message}`)
      failed += 1
    }
  }

  // Authors
  for (const author of plan.authors ?? []) {
    const filePath = path.join(author.targetDir, `${author.slug}.mdx`)
    if ((await pathExists(filePath)) && !args.force) {
      verboseLog(args, `[skip] ${filePath}`)
      skipped += 1
      continue
    }
    const fm = {
      name: author.source.frontmatter.name,
      bio: author.source.frontmatter.bio,
      locale: DEFAULT_LOCALE,
      slug: author.source.frontmatter.slug,
      draft: false,
    }
    const out = emitFrontmatter(fm) + "\n"
    try {
      await writeFile(filePath, out)
      verboseLog(args, `[wrote] ${filePath}`)
      written += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      warn(`[fail author ${author.slug}] ${message}`)
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

  // Validate Mode
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
    process.exit(1)
  }
}

await main()
