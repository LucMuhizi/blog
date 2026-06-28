# Nite Tanzarn / IntellectNest

[中文说明](readme-zh.md)

Nite Tanzarn / IntellectNest is a single-author personal expertise brand —
independent international consulting, research, and advisory work advancing
structural equity. The platform is built on Astro 7 with a static-first,
**warm editorial design system**.

The site ships without a database, private service, analytics account, ad
account, wallet, or Cloudflare credentials. Static hosting is the default.
Optional integrations (Pagefind full-text search, RSS, sitemap, Astro view
transitions, Cloudflare Workers Static Assets, optional Google Tag Manager,
optional Google AdSense, optional x402 metadata) layer on top of the static
build without changing its character.

## Scores

| Lighthouse | Agent Readiness |
| --- | --- |
| [![Blog Lighthouse score](public/lighthouse-score---https---blog-zbz-ai.svg)](https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fblog.zbz.ai%2F) | [![Blog Agent Readiness score](public/agent-readiness-https---blog-zbz-ai.avif)](https://isitagentready.com/blog.zbz.ai) |

## Design system

The visual identity is a **warm editorial palette** in two modes:

- **Warm light** — cream background (`oklch(0.97 0.012 80)` ≈ `#FAF6EE`),
  deep teal ink (`oklch(0.32 0.045 200)` ≈ `#16484A`), restrained brown-gold
  accent (`oklch(0.55 0.060 75)` ≈ `#9A7E3F`).
- **Warm dark** — deep warm background (`oklch(0.16 0.012 70)` ≈ `#100E0A`),
  cream foreground (`oklch(0.94 0.018 80)` ≈ `#F4ECD8`), **sand/gold accent
  (`#C9B99A`)** as the editorial signature.

Across both modes:

- **0.5px hairline borders.** Cards, chips, dividers, archive rows, and the
  credibility strip all use `border: 0.5px solid var(--hairline)`. Glass
  blur and 1px solid borders are retired from the live UI.
- **Serif headlines and serif article body.** Headlines use the system serif
  stack (`ui-serif, "Iowan Old Style", Georgia, "Apple Garamond", Cambria,
  "Times New Roman", Times, serif`). Article prose sits at `1.0625rem` with
  `1.75` line-height. Sans is reserved for nav, chips, eyebrows, buttons,
  and archive rows. No web font is loaded.
- **Credibility strip.** A 4-figure row (e.g. `30+ Years of practice`,
  `40+ Countries engaged`, `120+ Essays & reports`, `18 UN agencies
  advised`) reads its values from `src/content/authors/en/default.md`'s
  `headlineStats` frontmatter. It anchors the editorial hero on the home
  page and reappears on `/about/`.
- **Card primitives.** Rectangular (8–10px radii, 0.5px hairline borders)
  article cards, service cards, and the profile card. The editorial hero
  and the article header panel are intentionally 0-radius — printed on
  paper, not built in CSS.

`DESIGN.md` is the source of truth for tokens and rules.
`src/styles/global.css` is the live runtime theme.

## Features

- 🧱 Static-first Astro 7 architecture with no required CMS, database, or
  private runtime service.
- 🎨 Warm editorial design system: OKLCH dual themes with hue-shifted
  warm light and warm dark, 0.5px hairline borders, serif headlines,
  sand/gold accent.
- 📝 Markdown and MDX content collections for posts, pages, authors,
  categories, and tags, processed through Astro's Satteri pipeline.
- 🧭 Built-in RSS, sitemap, robots.txt, SEO metadata, JSON-LD, and
  agent-facing discovery files.
- 🔎 Pagefind-powered static full-text search.
- 🖼️ Astro image optimization with responsive layouts and modern AVIF/WebP
  output.
- ✨ Astro view transitions with client-side islands for the reading
  progress bar, category filter chips, mobile nav, and theme switcher.
- ⚙️ Astro 7 managed background dev server and JSON log commands for
  agent workflows.
- 💻 Expressive code blocks with light and dark syntax themes.
- 📣 Optional Google AdSense and Google Tag Manager integration, with GTM
  loaded through Partytown.
- 💸 Optional x402 payment enforcement through static metadata and a
  Cloudflare Worker gateway. **Disabled by default; opt-in only.**
- 🤖 Agent-native publishing surface with `llms.txt`, `llms-full.txt`,
  `openapi.json`, `auth.md`, `robots.txt`, and `sitemap-index.xml`.
- 🏷️ Single-author brand: every essay and project credits **Nite Tanzarn**.
  The author schema's `headlineStats` array powers the at-a-glance
  credibility strip and is the single source of truth for the brand's
  numbers.

## Verification Examples

- The production site has reached 100 scores across the four PageSpeed
  Insights Lighthouse categories in lab testing:
  [PageSpeed Insights](https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fblog.zbz.ai%2F).
- The agent-facing surface is designed for
  [Is Your Site Agent-Ready?](https://isitagentready.com/blog.zbz.ai)
  checks across discoverability, content access, bot access, protocol
  discovery, and commerce.

## Requirements

- Node.js 24 or newer
- pnpm

## Start

```bash
pnpm install
pnpm dev
```

Astro prints the local URL. The root entry serves the home page directly:

```text
http://localhost:4321/
```

## Commands

```bash
pnpm dev      # Start local development
pnpm dev:background # Start Astro's managed background dev server
pnpm dev:status     # Check background dev server status
pnpm dev:logs       # Read background dev server logs
pnpm dev:stop       # Stop the background dev server
pnpm dev:json       # Start dev server with JSON logs
pnpm build    # Run astro check and build static output
pnpm test:upgrade # Verify the Astro 7 upgrade contract
pnpm preview  # Preview the built site locally
pnpm deploy   # Build, then deploy dist with Wrangler
```

The configuration keeps `compressHTML: true` after the Astro 7 upgrade so
the existing theme keeps Astro 6 style HTML whitespace behavior. Astro 7's
Rust compiler, queued rendering, advanced routing, and Satteri Markdown
pipeline are used as stable defaults without the removed Astro 6
experimental flags.

## Project Structure

```text
astro.config.mjs                       # Astro, i18n (single locale), image, sitemap, integration config
src/config/                            # Site, taxonomy, pagination, and asset config
src/content/                           # Authors, pages, and posts
src/pages/                             # Single-locale routes and generated endpoints
src/layouts/main.astro                 # Shared shell, SEO, widgets, header, and footer
src/components/cards/                  # EditorialHero, CredibilityStrip, ProfileCard, ServiceCard, PostCardCover, PostCardText
src/components/features/               # OptimizedPicture, PagefindSearch, ReadingProgressBar, PullQuote
src/components/islands/                # MobileNav, ThemeSwitcher
src/components/lists/                  # PostArchiveList, PostGrid, CategoryChips, taxonomy grids
src/components/layout/                 # PageHeader, PageSection, ProseContent
src/components/navigation/             # Pagination, TableOfContents
src/components/ui/                     # Header, Footer, Icon, NotFoundContent
src/content.config.ts                  # Zod schemas (post, page, project, speaking, author with headlineStats)
src/styles/global.css                  # Runtime Tailwind v4 theme + editorial component CSS
src/styles/design-theme.css            # Token reference generated from DESIGN.md
DESIGN.md                              # Visual tokens and UI rules
```

## Routes

The site is **single-locale English**. Public routes keep no language
prefix; `/` is the canonical home. Astro `trailingSlash: "always"` is
preserved through locale metadata.

```text
/
/about/
/contact/
/services/
/posts/
/posts/<slug>/
/search/
/rss.xml
```

## Write Content

Content lives in `src/content`, nested under `en/` while the platform stays
single-locale English:

```text
src/content/
  authors/en/default.md
  pages/en/about.mdx
  posts/en/20260521-the-tax-you-cannot-escape.mdx
```

The single author profile (`default.md`) drives the credibility surfaces:

```yaml
---
slug: default
name: "Nite Tanzarn"
role: "Independent International Consultant"
tagline: "Advancing Agency, Authority, and Architecture for structural equity."
location: "Mbuya, Kampala, Uganda"
headlineStats:
  - { value: "30+", label: "Years of practice" }
  - { value: "40+", label: "Countries engaged" }
  - { value: "120+", label: "Essays & reports" }
  - { value: "18", label: "UN agencies advised" }
bio: "Independent International Consultant, advocate for women's rights, gender equality researcher, and devoted parent."
socials:
  - { label: "Email", url: "mailto:info@nitetanzarn.com" }
draft: false
---
```

`headlineStats` is the **single source of truth** for the brand's
at-a-glance numbers. The editorial hero on `/` and the at-a-glance section
on `/about/` read this array.

Post frontmatter:

```yaml
---
title: "The tax you cannot escape"
description: "Consumption, survival, and the taxation of everyday life."
category: "policy"
tags: ["reflect"]
pubDate: 2026-05-21
authors: ["default"]
heroImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f"
heroImageAlt: "Cover for The Tax You Cannot Escape"
heroImageWidth: 1600
heroImageHeight: 1067
readingTime: 5
viewCount: 1240
pdfDownload: "https://example.com/the-tax-you-cannot-escape.pdf"
draft: false
featured: true
---
```

Optional SEO fields:

```yaml
seoTitle: "Custom title"
seoDescription: "Custom meta description."
canonical: "https://example.com/original/"
heroBlurDataURL: "data:image/..."
```

Remote `heroImage` values must include `heroImageWidth` and
`heroImageHeight`. Remote image hosts are limited to Unsplash and the
optional `PUBLIC_ASSET_BASE_URL` host. When replacing the image host,
keep Astro image optimization in sync by allowing the new HTTPS host in
`src/config/site.ts`:

```js
assets: {
  publicBaseUrl: publicAssetBaseUrl,
  remotePatterns: [
    ...(publicAssetHost
      ? [{ protocol: "https", hostname: publicAssetHost }]
      : []),
    { protocol: "https", hostname: "*.unsplash.com" },
    { protocol: "https", hostname: "*.zbz.ai" },
  ],
}
```

Add or replace entries to match the hosts used by your content images.

## Configure

Most users only need `src/config/site.ts`:

```text
src/config/site.ts       # Site name, URL, description, repository, social links, services, homepage, assets, analytics, ads, x402
src/config/taxonomy.ts   # Categories, tags, localized labels, slug helpers
src/config/pagination.ts # Page sizes
src/config/assets.ts     # Remote image host checks and URL helpers
src/i18n/en.json         # Interface text (English-only at the moment)
```

The `SITE_CONFIG.services` array is the second user-facing configuration
surface. It drives the homepage Services row and the standalone
`/services/` page. Update the four default entries (Research & Fieldwork,
Policy Advisory, Training & Convening, Consultancy) to reflect the
engagements offered.

Environment variables are optional deployment overrides for values that
often change by environment:

```bash
PUBLIC_SITE_URL=https://example.com
PUBLIC_ASSET_BASE_URL=https://assets.example.com
```

Optional integrations are disabled by default:

```bash
PUBLIC_GTM_ENABLED=true
PUBLIC_GTM_ID=GTM-XXXXXXX

PUBLIC_ADSENSE_ENABLED=true
PUBLIC_ADSENSE_CLIENT_ID=ca-pub-0000000000000000

PUBLIC_X402_ENABLED=true
PUBLIC_X402_PAY_TO=YourWalletAddress
PUBLIC_X402_NETWORK=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
PUBLIC_X402_PRICE=$0.08
PUBLIC_X402_DESCRIPTION=Voluntary x402 payment support for Blog content.
PUBLIC_X402_FACILITATOR_URL=https://x402.org/facilitator
PUBLIC_X402_CHARGE_MODE=all
PUBLIC_X402_BOT_SCORE_THRESHOLD=30
```

`PUBLIC_X402_CHARGE_MODE` accepts `all` or `bot-only`. The x402 widget
only publishes metadata; it does not enforce HTTP 402 payment.

## Optional x402 Gateway

> **x402 is disabled by default on this site.** All public content is
> freely accessible to anonymous readers. The x402 payment middleware
> only activates when the runtime variables below are set; it is opt-in
> only.

The default build remains static and works on ordinary static hosting.
Real x402 enforcement needs a runtime adapter that can return
`402 Payment Required` before serving static assets.

The repository includes an optional Cloudflare Workers adapter at
`src/x402/cloudflare-worker.ts`. The adapter ships with the repository
but stays inactive until you flip the runtime flag to `"true"`:

```bash
X402_ENABLED=false
```

To enable it on Cloudflare Workers Static Assets, set runtime variables
in Wrangler or the Cloudflare dashboard:

```bash
X402_ENABLED=true
X402_PAY_TO=YourWalletAddress
X402_NETWORK=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
X402_PRICE=$0.08
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_BOT_ONLY=true
X402_BOT_SCORE_THRESHOLD=30
```

`X402_PAY_TO` should be set as a runtime secret. The other values can be
runtime variables. The `x402.org` facilitator currently advertises Solana
support for `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`; if a different
facilitator is used, set `X402_NETWORK` to one of the networks returned
by its `/supported` endpoint.

`/api`, `/api/v1`, and the article routes are routed through the adapter
on Cloudflare. The API probe routes always require payment when the
gateway is enabled; article routes charge bots when `X402_BOT_ONLY=true`.
Platforms without a runtime adapter can still publish the static site
and optional x402 metadata, but they cannot enforce payment.

Verify a production deployment with:

```bash
curl -i https://your-domain.example/api
curl -i https://your-domain.example/api/v1
```

Both requests should return `402 Payment Required` with a
`payment-required` header when the gateway is enabled. For this site's
production, this has been verified on `https://blog.zbz.ai/api` and
`https://blog.zbz.ai/api/v1`.

## Agent API Discovery

The platform publishes static API discovery files for agents:

- `/.well-known/api-catalog` exposes an RFC 9727 API catalog with
  linkset entries for `/api` and `/api/v1`.
- `/openapi.json` describes the (currently-disabled) x402 protected API
  probes.
- `/auth.md` explains the agent access contract: free, no authentication,
  no registration, no payment required.
- `/.well-known/oauth-authorization-server`,
  `/.well-known/openid-configuration`, and
  `/.well-known/oauth-protected-resource` publish discovery metadata for
  agents that expect OAuth/OIDC documents.

x402 is disabled by default, so the current public access path is free
for anonymous readers. The static OAuth/OIDC documents are discovery
metadata only; this repository does not issue bearer tokens or manage
user accounts by default. Set the runtime variables in
`## Optional x402 Gateway` to opt into paid API enforcement.

When deployed through the Worker adapter, requests with
`Accept: text/markdown` receive a Markdown representation with
`Content-Type: text/markdown` and `x-markdown-tokens`. Browser requests
keep the normal HTML response.

## Design

`DESIGN.md` records the warm editorial palette, the hairline border
system, the serif/sans split, and the editorial component rules. The
live runtime theme is implemented in `src/styles/global.css`. New UI
work must read `DESIGN.md` first and use the existing CSS variables
(`var(--foreground)`, `var(--surface-flat)`, `var(--hairline)`,
`var(--gold)`, `var(--card-foreground)`, …) rather than hard-coded
hex values. Adding a new icon means updating both
`astro.config.mjs` and `src/components/ui/Icon.astro` (the icon name
literal is a TypeScript type union).

## Development Workflow

Development uses repository documentation, GitHub Issues, and GitHub
Projects. Feishu, Lark, Meegle, Feishu Project, and Feishu Wiki are not
part of the Nite Tanzarn / IntellectNest workflow.

- Use `AGENTS.md`, `DESIGN.md`, this README, `readme-zh.md`, and
  `docs/` as the project documentation source.
- Use GitHub Issues as the source of truth for bugs, features, and
  tasks.
- Use GitHub Projects for status, priority, sequencing, and delivery
  tracking.
- Use Spec-Driven Development for non-trivial changes: capture the
  issue, acceptance criteria, implementation notes, and verification
  commands before or alongside the code.
- Reference the relevant issue in meaningful commits, pull requests, or
  final handoffs.

## Search and SEO

Pagefind is generated at build time by
`src/integrations/pagefind.ts`. The current index covers the about page
and post detail pages. `src/layouts/main.astro` uses `astro-seo` for
standard SEO metadata and keeps project-owned JSON-LD generation in
`src/utils/structured-data.ts`.

## Deploy

The build output is `dist`.

```bash
pnpm build
```

The site can be published to any static host, including Cloudflare
Pages, Vercel, Netlify, GitHub Pages, or a plain web server. The
repository also includes optional Workers Static Assets deployment:

```bash
pnpm deploy
```

## Feedback

Questions, ideas, and bug reports go to
[GitHub Issues](https://github.com/LucMuhizi/blog/issues).
