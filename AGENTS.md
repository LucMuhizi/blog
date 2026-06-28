# Nite Tanzarn / IntellectNest Agent Guide

## Purpose

This file tells coding agents how to work in this repository. Keep engineering
workflow, commands, repository structure, deployment, and contribution rules
here. Keep visual tokens and UI appearance rules in `DESIGN.md`.

Nite Tanzarn / IntellectNest is a single-author personal expertise brand and
the Astro 7 site that hosts it. The site is **single-locale English** and the
public surface uses unprefixed routes (`/about/`, `/posts/`, `/services/`,
…); `/` is the canonical home. The repository must remain usable without
private services, databases, Cloudflare credentials, analytics IDs, ad IDs,
payment credentials, or wallet addresses.

The visual identity is a **warm editorial design system**:

- Two-tone surface: warm cream with deep teal ink by day; deep warm background
  with cream foreground and a **sand/gold accent (`#C9B99A`)** at night.
  Tokens live in `src/styles/global.css`; sRGB approximations and rules live
  in `DESIGN.md`. Both palettes are hue-shifted OKLCH — no flat greys.
- **0.5px hairline borders** are the structural primitive. Every card, chip,
  divider, and stat figure uses `border: 0.5px solid var(--hairline)`.
  Glass blur and 1px solid borders are retired from the live UI.
- **Serif headlines and serif article body**, sans for UI chrome. Headlines
  use the system serif stack (`ui-serif, "Iowan Old Style", Georgia,
  "Apple Garamond", Cambria, "Times New Roman", Times, serif`). Article prose
  sits at `1.0625rem / 1.75` line-height. Eyebrow metadata is `0.7rem` with
  `0.18em` letter-spacing. No web font is loaded.
- **The credibility strip** (`CredibilityStrip.astro`) reads the
  `headlineStats` array from `src/content/authors/en/default.md` and renders
  four stat figures (e.g. `30+ Years of practice`, `40+ Countries engaged`).
  The array is the single source of truth for the brand's at-a-glance numbers
  and renders on the editorial hero and the about page.

## Stack

- Astro 7 with `output: "static"`, `trailingSlash: "always"`, and
  `compressHTML: true` to preserve the existing HTML whitespace behavior.
- Tailwind CSS v4 through `@tailwindcss/vite` and CSS-first runtime tokens.
- MDX content collections backed by `astro:content` glob loaders.
- `@astrojs/markdown-satteri` as the Markdown and MDX processor.
- Custom Pagefind integration in `src/integrations/pagefind.ts`.
- `astro-icon` with a Lucide allowlist configured in `astro.config.mjs`.
- `astro-seo` for standard SEO metadata.
- Astro `ClientRouter` for view transitions.
- `@astrojs/partytown` for optional Google Tag Manager.
- Optional Google AdSense through `src/components/widgets/Adsense.astro`.
- Optional x402 metadata through `src/components/widgets/X402.astro`.
- Optional x402 Cloudflare gateway through `src/x402/cloudflare-worker.ts`.
- Astro image optimization through `OptimizedPicture.astro`.
- Optional Cloudflare Workers Static Assets deployment.

## Required Commands

- Install dependencies: `pnpm install`
- Start development server: `pnpm dev`
- Start managed background development server: `pnpm dev:background`
- Check managed development server: `pnpm dev:status`
- Read managed background development server logs: `pnpm dev:logs`
- Stop managed background development server: `pnpm dev:stop`
- Start development server with JSON logs: `pnpm dev:json`
- Typecheck and build: `pnpm build`
- Verify Astro 7 upgrade contract: `pnpm test:upgrade`
- Preview built site: `pnpm preview`
- Deploy prebuilt static assets to Cloudflare Workers: `pnpm deploy`

Use pnpm for Node.js work. Do not add npm, yarn, or bun lockfiles.

## Development Workflow

- Use Nite Tanzarn / IntellectNest repository documents, GitHub Issues, and
  GitHub Projects as the only development planning and tracking tools.
- Do not use Feishu, Lark, Meegle, Feishu Project, Feishu Wiki, or other
  external project-management systems unless a future user request explicitly
  reintroduces them.
- Treat `AGENTS.md`, `DESIGN.md`, `README.md`, `readme-zh.md`, and files under
  `docs/` as the project documentation source.
- Before coding, read `AGENTS.md` and `DESIGN.md`. If either file is missing,
  add a minimal version before continuing.
- Use Spec-Driven Development for non-trivial changes: define the issue,
  acceptance criteria, implementation notes, and verification commands before
  or alongside the code change.
- Use GitHub Issues as the source of truth for tasks, bugs, and feature
  requests. Each meaningful code change should reference or create an issue.
- Use GitHub Projects for status, priority, sequencing, and delivery tracking.
- Keep issue comments and pull request descriptions concise, with the changed
  behavior, deployment impact, and verification commands.
- If GitHub access is unavailable, continue local work when safe and record the
  exact GitHub blockage in the final handoff. Do not replace GitHub tracking
  with Feishu or other project tools.

## Repository Map

- `astro.config.mjs`: Astro static output, single-locale i18n, image domains,
  integrations, sitemap, Tailwind, Pagefind, and Lucide icon allowlist.
- `src/pages/`: single-locale routes — `/`, `/about/`, `/contact/`,
  `/services/`, `/posts/`, `/posts/<slug>/`, `/search/`, RSS, robots, llms
  endpoints, 404.
- `src/layouts/main.astro`: shared HTML shell, `astro-seo`, JSON-LD,
  ClientRouter, header/footer, GTM, and AdSense widgets.
- `src/components/cards/`: editorial cards
  (`EditorialHero`, `CredibilityStrip`, `ProfileCard`, `ServiceCard`,
  `PostCardCover`, `PostCardText`).
- `src/components/features/`: `OptimizedPicture`, `PagefindSearch`,
  `ReadingProgressBar`, `PullQuote`, `DynamicGlass` (legacy).
- `src/components/islands/`: `MobileNav`, `ThemeSwitcher` (theme class on
  `<html>` still uses `.dark` so Tailwind v4 `dark:` variants work).
- `src/components/lists/`: `PostArchiveList`, `HomeFeatureGrid` (legacy,
  unused on the new pages), `PostCardGrid`, `PostTextCardGrid`,
  `PostGrid` (featured-first listing grid), `CategoryChips` (client-side
  filter island), `TaxonomyLinkGrid`, `TaxonomyPillNav`.
- `src/components/ui/`: `Footer`, `Header`, `Icon`, `NotFoundContent`.
- `src/components/layout/`: `PageHeader`, `PageSection`, `ProseContent`.
- `src/components/navigation/`: `Pagination`, `TableOfContents`.
- `src/content/`: localized authors, pages, and posts.
- `src/content.config.ts`: Zod content collection schemas and remote hero image
  validation. The `author` schema owns the `headlineStats` array that drives
  the credibility strip on the editorial hero and the about page.
- `src/config/`: site, taxonomy, pagination, and asset configuration.
- `src/i18n/`: visible UI strings. Currently `en.json` is the only locale.
- `src/integrations/pagefind.ts`: build-time Pagefind indexing and dev server
  serving for `/pagefind/`.
- `src/styles/global.css`: live Tailwind v4 runtime theme — warm light +
  warm dark OKLCH tokens, prose, cards, archive, taxonomy, search, reading
  progress, pull quote, and responsive UI CSS.
- `src/styles/design-theme.css`: generated Tailwind v4 token reference from
  `DESIGN.md`; do not edit by hand unless the token export workflow changes.
- `DESIGN.md`: visual design source for tokens and UI appearance.

## Architecture Rules

- Keep the primary site static-first. A plain `pnpm build` must produce a
  usable static site in `dist`.
- Use Astro 7 stable defaults for the Rust compiler, Satteri Markdown
  pipeline, queued rendering, and advanced routing. Do not reintroduce
  removed Astro 6 experimental flags such as `rustCompiler` or
  `queuedRendering`.
- The site is **single-locale English**. Public routes keep no `/en/` prefix;
  `/` is the canonical home. Preserve Astro `trailingSlash: "always"` and the
  Lucide icon `mail`, `arrow-right`, `arrow-up-right`, `at-sign`, `download`
  allowlist entries the editorial hero and article page depend on.
- **Do not reintroduce locales** as separate routes. The `i18n` block in
  `astro.config.mjs` is configured for one locale (`en`) with locale-prefix
  routing disabled. If you need a translation, treat it as content
  (markdown inside MDX frontmatter, or a separate MDX file) rather than a
  second locale. Preserve `locale: "en"` only where schema fields still
  document it as an internal code.
- Do not make Cloudflare mandatory. The Cloudflare path uploads static assets
  from `dist`; ordinary static hosting must continue to work.
- Do not add database-backed features by default.
- Treat `src/config/site.ts` as the main user configuration file. Public
  environment variables are optional deployment overrides. The four
  `SITE_CONFIG.services` entries drive the homepage Services row and the
  `/services/` page.
- Keep translated UI strings in `src/i18n/*.json`; avoid single-language
  hard-coded visible UI text.
- Keep Google Tag Manager, Google AdSense, and x402 optional.
- Keep `src/components/widgets/X402.astro` available as opt-in metadata. Do
  not add HTTP 402 enforcement outside optional deployment adapters unless
  explicitly requested.
- Keep the Cloudflare x402 gateway optional and disabled by default. Ordinary
  static hosting must continue to work from `dist` without runtime services.
- Pagefind indexes generated static HTML through
  `src/integrations/pagefind.ts`. Preserve the current searchable surface
  unless the task explicitly changes search scope.
- Keep generated surfaces static: RSS, sitemap, robots, llms text files,
  Pagefind output, and Markdown-derived pages must not depend on runtime
  services.

## Content Rules

- Posts live in `src/content/posts/en/`.
- Pages live in `src/content/pages/en/`.
- Authors live in `src/content/authors/en/`.
- The site exposes English content only. The `en/` subdirectory is an
  artifact of the prior multi-locale setup; the schema no longer enforces a
  `locale` field, but the on-disk layout (and the Pages CMS configuration in
  `.pages.yml`) continues to nest content under `en/`. New content must
  follow the same nested layout for Pages CMS round-trips to keep working.
- Translating content into other languages is out of scope; the platform
  ships English only.
- Post frontmatter uses `title`, `description`, `category`, `tags`,
  `pubDate`, `authors`, `heroImage`, `heroImageAlt`, optional `updatedDate`,
  optional `pdfDownload` (regex absolute URL), optional `readingTime`
  (positive integer ≤ 120), optional `viewCount`, optional SEO fields
  (`seoTitle`, `seoDescription`, `canonical`, nested `seo`), `draft`, and
  `featured`.
- The single author profile (`default.md`) owns the brand surface. It exposes
  `name`, `role`, `tagline`, `location`, optional `avatar` (with
  `avatarWidth` / `avatarHeight`), `bio`, the `headlineStats` array (`{ value,
  label }`), `socials`, and `draft`. The home editorial hero, the about page,
  and the profile card all read this file.
- Remote `heroImage` values must include `heroImageWidth` and
  `heroImageHeight`.
- Remote images are limited to the configured asset host and Unsplash hosts.
- Remote `OptimizedPicture` usage in content must include explicit `width`
  and `height` unless it intentionally uses Astro `inferSize`.
- Keep category and tag slugs canonical through `src/config/taxonomy.ts`.

## UI and Design Workflow

- Read `DESIGN.md` before changing colors, typography, spacing, radii, cards,
  navigation, article prose, search styling, or component appearance.
- Treat the warm light + warm dark palette and the 0.5px hairline border
  system as **non-negotiable**. New components must use CSS variables
  (`var(--foreground)`, `var(--surface-flat)`, `var(--hairline)`, `var(--gold)`,
  `var(--card-foreground)`, …) rather than hard-coded color values.
- The serif stack is the Editorial voice: headlines, article prose, and
  credential figures (`3.25rem` at `-0.02em`). Sans is for nav, chips,
  eyebrows, buttons, and archive rows. Mixing these two rules out of place
  (e.g. sans article body or serif modal chrome) is a regression.
- New components should compose with the existing card primitives rather
  than introduce new card shapes. Cards are rectangular with `0.5px solid
  var(--hairline)` borders and `8–10px` radii. The editorial hero and the
  article header are intentionally 0-radius.
- Use the existing `Icon` component and configured Lucide icon allowlist. Add
  new icons to **both** `astro.config.mjs` and `src/components/ui/Icon.astro`
  (the `IconName` type union and the allowlist must agree).
- Keep layouts responsive across mobile, tablet, and desktop.
- Preserve the image-led editorial card language, the compact archive rows
  on `/posts/`, the readable article page with sticky ToC sidebar at `lg+`,
  the reading-progress bar on `/posts/<slug>/`, and Pagefind search styling.
- Scripts that initialize page UI must work with Astro ClientRouter. Use
  `astro:page-load` for initialization and clean up listeners on
  `astro:before-swap` where needed. Each client island registers a
  `window.__<purpose>Cleanup` hook that the next page transition invokes.
- New client islands must respect `prefers-reduced-motion`. The reading
  progress bar and PullQuote scroll behaviour fall back gracefully when the
  user has reduced-motion enabled.

## Open-Source Contribution Rules

- Keep defaults safe for forked projects and first-time users.
- Do not commit tokens, local credentials, private database IDs, analytics
  IDs, wallet addresses, or production secrets.
- Document new public environment variables in `.env.example`, `README.md`,
  and `readme-zh.md`.
- Prefer small, focused changes with clear deployment impact.
- Do not leave generated output stale when its source file changes in the
  same task.
- Preserve the MIT license and package metadata unless explicitly asked.

## Pull Request Guidance

- Summarize user-facing behavior and deployment implications.
- Include verification commands that were run.
- For dependency updates, merge only after conflicts are resolved and checks
  pass.
- For Cloudflare changes, state whether ordinary static hosting is affected.
