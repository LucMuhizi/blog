import { SITE_CONFIG } from "@/config/site"
import { getCategory, getTag } from "@/config/taxonomy"
import {
  postCategorySlug,
  postTagSlugs,
  postUrl,
  type PostEntry,
} from "@/utils/posts"

function canonicalPostUrl(post: PostEntry): string {
  return `${SITE_CONFIG.url}${postUrl(post)}`
}

function siteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  const looksLikeAsset = /\.[a-z0-9]+$/i.test(normalized)
  if (looksLikeAsset) return `${SITE_CONFIG.url}${normalized}`
  return `${SITE_CONFIG.url}${normalized.endsWith("/") ? normalized : `${normalized}/`}`
}

export function renderLlmsTxt(posts: readonly PostEntry[]): string {
  const latestPosts = posts.slice(0, 12)

  return [
    `# ${SITE_CONFIG.name}`,
    "",
    `> ${SITE_CONFIG.description}. A concise index for site structure, recent content, and official entry points.`,
    "",
    `- Repository: ${SITE_CONFIG.repository}`,
    "- Default locale: English (en)",
    "",
    "## Core",
    "",
    `- [Home](${siteUrl("/")})`,
    `- [About](${siteUrl("/about/")})`,
    `- [Our Values](${siteUrl("/values/")})`,
    `- [Consultancy](${siteUrl("/services/")})`,
    `- [Contact](${siteUrl("/contact/")})`,
    `- [Annotations](${siteUrl("/annotations/")})`,
    `- [All posts](${siteUrl("/posts/")})`,
    `- [Search](${siteUrl("/search/")})`,
    `- [llms-full.txt](${siteUrl("llms-full.txt")}): Full post index with categories, tags, and publication dates.`,
    "",
    "## Content endpoints",
    "",
    `- [RSS](${siteUrl("rss.xml")})`,
    `- [Sitemap](${siteUrl("sitemap-index.xml")})`,
    `- [Robots](${siteUrl("robots.txt")})`,
    "",
    "## Recent posts",
    "",
    ...latestPosts.map(
      (post) =>
        `- [${post.data.title}](${canonicalPostUrl(post)}): ${post.data.description}`
    ),
    "",
  ].join("\n")
}

export function renderLlmsFullTxt(posts: readonly PostEntry[]): string {
  const lines = [
    `# ${SITE_CONFIG.name} llms-full.txt`,
    "",
    `Site: ${SITE_CONFIG.url}`,
    `Generated from ${posts.length} published posts.`,
    `Repository: ${SITE_CONFIG.repository}`,
    "",
    "## Core references",
    `- [Home](${siteUrl("/")})`,
    `- [About](${siteUrl("/about/")})`,
    `- [Our Values](${siteUrl("/values/")})`,
    `- [Consultancy](${siteUrl("/services/")})`,
    `- [Contact](${siteUrl("/contact/")})`,
    `- [Annotations](${siteUrl("/annotations/")})`,
    `- [All posts](${siteUrl("/posts/")})`,
    `- [Search](${siteUrl("/search/")})`,
    `- [llms.txt](${siteUrl("llms.txt")}): Concise index summary`,
    "",
    "## All posts",
    "",
  ]

  if (posts.length === 0) {
    lines.push("### English", "", "_No posts published yet._", "")
  } else {
    lines.push("### English", "")
    for (const post of posts) {
      const categorySlug = postCategorySlug(post)
      const category = getCategory(categorySlug)
      const tags = postTagSlugs(post)
        .map((tag) => getTag(tag)?.labelByLocale.en ?? tag)
        .join(", ")
      lines.push(
        `- [${post.data.title}](${canonicalPostUrl(post)})`,
        `  - Description: ${post.data.description}`,
        `  - Category: ${category?.labelByLocale.en ?? categorySlug}`,
        `  - Tags: ${tags || "None"}`,
        `  - Published: ${post.data.pubDate.toISOString().slice(0, 10)}`
      )
    }
    lines.push("")
  }

  lines.push("## Optional")
  lines.push(`- [Sitemap](${siteUrl("sitemap-index.xml")})`)

  return lines.join("\n")
}
