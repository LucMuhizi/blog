---
version: "alpha"
name: "Nite Tanzarn · IntellectNest"
description: "A warm editorial Astro design system for Nite Tanzarn / IntellectNest. Two-tone surface system (warm light + warm dark), serif headlines, sand/gold accent, hairline borders, image-led editorial cards, compact archives, Astro view transitions, Pagefind search, and long-form typography."
colors:
  background: "#FAF6EE"
  foreground: "#16484A"
  card: "#F0E8D6"
  cardForeground: "#16484A"
  popover: "#F0E8D6"
  popoverForeground: "#16484A"
  primary: "#16484A"
  primaryForeground: "#FAF6EE"
  secondary: "#EAE0CC"
  secondaryForeground: "#16484A"
  muted: "#EFEAE0"
  mutedForeground: "#6B5F4A"
  accent: "#9A7E3F"
  accentForeground: "#FAF6EE"
  destructive: "#A8483B"
  border: "#16484A1A"
  input: "#16484A1A"
  ring: "#9A7E3F"
  darkBackground: "#100E0A"
  darkForeground: "#F4ECD8"
  darkCard: "#1A1714"
  darkCardForeground: "#F4ECD8"
  darkPopover: "#1A1714"
  darkPopoverForeground: "#F4ECD8"
  darkPrimary: "#F4ECD8"
  darkPrimaryForeground: "#100E0A"
  darkSecondary: "#242018"
  darkSecondaryForeground: "#F4ECD8"
  darkMuted: "#1F1B14"
  darkMutedForeground: "#A89E84"
  darkAccent: "#C9B99A"
  darkAccentForeground: "#100E0A"
  darkBorder: "#F4ECD81A"
  darkInput: "#F4ECD81A"
  darkRing: "#C9B99A"
  hairline: "#16484A1A"
  darkHairline: "#F4ECD81A"
  gold: "#C9B99A"
  darkGold: "#E0CFA6"
typography:
  sans:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.55"
    letterSpacing: "0px"
  serif:
    fontFamily: 'ui-serif, "Iowan Old Style", Georgia, "Apple Garamond", Cambria, "Times New Roman", Times, serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.6"
    letterSpacing: "0px"
  heading:
    fontFamily: 'ui-serif, "Iowan Old Style", Georgia, "Apple Garamond", Cambria, "Times New Roman", Times, serif'
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: "1.18"
    letterSpacing: "-0.01em"
  heroTitle:
    fontFamily: 'ui-serif, "Iowan Old Style", Georgia, "Apple Garamond", Cambria, "Times New Roman", Times, serif'
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: "1.06"
    letterSpacing: "-0.02em"
  sectionTitle:
    fontFamily: 'ui-serif, "Iowan Old Style", Georgia, "Apple Garamond", Cambria, "Times New Roman", Times, serif'
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: "1.12"
    letterSpacing: "-0.015em"
  articleBody:
    fontFamily: 'ui-serif, "Iowan Old Style", Georgia, "Apple Garamond", Cambria, "Times New Roman", Times, serif'
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: "1.75"
    letterSpacing: "0px"
  nav:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25"
    letterSpacing: "0px"
  eyebrow:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 600
    lineHeight: "1.25"
    letterSpacing: "0.18em"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: "1.25"
    letterSpacing: "0.025em"
  small:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1.5"
    letterSpacing: "0px"
  stat:
    fontFamily: 'ui-serif, "Iowan Old Style", Georgia, "Apple Garamond", Cambria, "Times New Roman", Times, serif'
    fontSize: "3.25rem"
    fontWeight: 600
    lineHeight: "1.0"
    letterSpacing: "-0.02em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  card: "10px"
  hero: "12px"
  pill: "999px"
  zero: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  xxl: "64px"
  page-x: "20px"
  page-x-sm: "28px"
  page-x-md: "40px"
  section-y: "64px"
  section-y-sm: "40px"
hairlines:
  width: "0.5px"
  rule: "1px"
components:
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.sans}"
  page-dark:
    backgroundColor: "{colors.darkBackground}"
    textColor: "{colors.darkForeground}"
    typography: "{typography.sans}"
  editorial-hero:
    backgroundColor: "{colors.darkBackground}"
    textColor: "{colors.darkForeground}"
    accentRule: "{colors.darkGold}"
  credibility-card:
    backgroundColor: "{colors.darkCard}"
    textColor: "{colors.darkForeground}"
    borderColor: "{colors.darkHairline}"
    rounded: "{rounded.lg}"
  stat-figure:
    font: "{typography.stat}"
    colorDark: "{colors.gold}"
    colorLight: "{colors.primary}"
  service-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
  profile-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.cardForeground}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.md}"
  editorial-card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
  article-hero-panel:
    backgroundColor: "{colors.darkCard}"
    textColor: "{colors.darkForeground}"
    borderColor: "{colors.darkHairline}"
    rounded: "{rounded.zero}"
  text-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.cardForeground}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
  nav-link:
    textColor: "{colors.foreground}"
    typography: "{typography.nav}"
  primary-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primaryForeground}"
    typography: "{typography.nav}"
    rounded: "{rounded.md}"
    padding: "12px 18px"
  secondary-button:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.foreground}"
    typography: "{typography.nav}"
    rounded: "{rounded.md}"
    padding: "12px 18px"
  accent-button-dark:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.darkBackground}"
    typography: "{typography.nav}"
    rounded: "{rounded.md}"
    padding: "12px 18px"
  chip:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.pill}"
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primaryForeground}"
    borderColor: "{colors.primary}"
  search-input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  meta-pill:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.pill}"
  glass-meta-pill:
    backgroundColor: "{colors.darkCard}"
    textColor: "{colors.darkForeground}"
    borderColor: "{colors.darkHairline}"
    rounded: "{rounded.pill}"
  destructive-button:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "12px"
  pull-quote:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.accent}"
    rounded: "{rounded.zero}"
---

## Overview

Nite Tanzarn / IntellectNest is a single-author personal expertise brand. The interface is editorial, warm, and authoritative — closer to *The Economist* or *Foreign Affairs* than a generic blog. The live visual system lives in `src/styles/global.css`; this file records the same system as tokens and design rules so later UI work keeps the theme intact.

The interface pairs a warm cream surface with a deep teal ink in light mode, and a deep warm background with the same cream foreground + a sand/gold accent in dark mode. Both modes use the same serif type stack, hairline 0.5px borders, rectangular editorial cards (no glass blur), and a single accent rule (the gold) used sparingly above and below section titles.

## Theme Model

Runtime theming lives in `src/styles/global.css`. Tailwind v4 token namespaces map to semantic CSS variables; `:root` provides the warm light palette and `.dark` provides the warm dark palette. The `.dark` class is still toggled by `ThemeSwitcher.astro` and respected by Tailwind's `dark:` variant.

`DESIGN.md` stores sRGB approximations of the runtime tokens. `src/styles/design-theme.css` is a Tailwind-compatible token reference generated from this file. The generated file does not replace the runtime dark-mode variables by itself.

## Color System

The palette is a two-tone warm editorial palette.

### Warm light (default)

- `background` = warm cream `#FAF6EE` for the main reading surface.
- `foreground` = deep teal-green `#16484A` for body text and titles.
- `card` / `popover` = `#F0E8D6` for grouped surfaces.
- `primary` = the same teal-green ink; `primaryForeground` = the cream foreground for inverted buttons.
- `secondary` / `muted` = softer cream-beiges for chips and hover states.
- `accent` = restrained brown-gold `#9A7E3F` for rules, secondary buttons in dark sections, and the gold rule under section titles.
- `border` / `input` = `oklch(L C H / 0.10)` hairline.
- `destructive` = `#A8483B` (an ochre red).

### Warm dark

- `darkBackground` = `#100E0A` (warm near-black).
- `darkForeground` = `#F4ECD8` (cream).
- `darkCard` / `darkPopover` = `#1A1714` for grouped surfaces.
- `darkPrimary` = the cream foreground, `darkPrimaryForeground` = the warm background (for inverted buttons).
- `darkAccent` = `#C9B99A` (sand/gold — exactly the targeted accent).
- `darkBorder` / `darkInput` = `oklch(L C H / 0.10)` on the cream. The cream's chroma is warm, so the hairline reads slightly golden.

The sand/gold accent is the visual signature. It appears in dark mode as `darkAccent` (`#C9B99A`) and as the editorial-hero underline rule. In light mode it is restraint rather than ornament: section title underlines, occasional callout rules, and the secondary button border.

## Typography

The project splits type by role:

- **Display + body article** uses a system serif stack: `ui-serif, "Iowan Old Style", Georgia, "Apple Garamond", Cambria, "Times New Roman", Times, serif`. This is the editorial voice — headlines and inside-article text. No web font load.
- **UI** (nav, chips, eyebrows, buttons, archive rows) uses the existing system sans stack.
- **Stat figures** use the serif stack at `3.25rem` with `-0.02em` letter-spacing — the four credibility numbers are headline-class.

Eyebrow text is `0.7rem` with `0.18em` letter-spacing — small, all-caps, restrained.

Article prose uses `1.0625rem` (17px) with `1.75rem` line-height. Headings are tight: `1.06–1.18` line-height, slight negative letter-spacing for display sizes.

Do not load external fonts. Do not use viewport-scaled font sizes. Do not use negative letter-spacing outside the editorial display usages.

## Layout

The standard page frame is `max-w-6xl`. Sections use `64px` vertical spacing on desktop and `40px` on mobile. Article prose centers at `max-w-3xl`; the `EditorialHero` extends the surface to `max-w-6xl` and uses the dark theme for visual variety.

Card grids use 2-column on `lg`, 1-column on `md` and below. The articles listing uses a featured-first layout (one full-width card on top, then a 2-column grid below). The credibility strip uses 4-column on `md` and below, 4-column with hairline dividers on `lg+`.

Archive and taxonomy pages stay compact via `PostArchiveList`.

## Cards

Editorial cards are rectangular (no rounded-xl) with 0.5px hairline borders. They use cream-beige `card` surfaces, never glass blur. The `EditorialHero` is the only surface that uses the warm dark treatment as a full background; everything else respects the active theme.

Post cover cards (`PostCardCover`, `PostCardText`) keep the image-led structure but drop the glass-blur panel. The title now sits on a cream surface directly under the image with a hairline rule between. Hover: subtle 2px translate-up over the page background; the image does not scale-zoom.

Service cards and the profile card are minimal text-only surfaces with no image, no rounded-xl corners, and a hairline accent rule above the title.

## Shapes

- Buttons and chips: 6px–8px radius.
- Cards: 8px–10px radius. The `EditorialHero` and `articleHero` use 0px radius because editorial.
- Pills: 999px (full pill).
- Decks of cards do not nest cards.

## Hairlines and Rules

Visual structure is built from hairlines:

- All cards, inputs, dividers, and chips use `border: 0.5px solid var(--border)`.
- Section titles can carry a 1px gold rule above the title (the "eyebrow rule").
- The credibility strip uses 0.5px vertical hairline dividers between stat figures at `lg+`.
- The `EditorialHero` uses 1px vertical hairlines between sub-sections rather than card boundaries.

These hairlines are intentionally thinner than a 1px border so the surface feels printed on paper, not built in CSS.

## Component Guidance

- **Header and nav**: 0.5px hairline bottom border on the active theme surface. The header background matches the page surface (no glass). Serif logo + wordmark. Compact height.
- **EditorialHero**: dark warm surface, 1px gold rule above the eyebrow and below the headline. Right rail hosts the credibility strip in a hairline-bordered card on `lg+`. Below `md` the credibility strip drops into the body of the hero.
- **CredibilityStrip**: 4-figure row. Each figure is `3.25rem` serif; label is eyebrow-style all-caps. At `lg+`, vertical 0.5px dividers separate figures.
- **Post cards**: image-first with editorial framing. Title and meta sit on a cream surface directly under the image with a hairline rule above. No glass blur.
- **Article page**: hairline-bordered article-header panel with breadcrumbs, eyebrow (category), headline, byline, reading time, view count, PDF download, and breadcrumb. Reading progress bar across the top (full width, 1px). Sticky table-of-contents in a sidebar rail at `lg+`.
- **PullQuote**: 1px gold-left rule spanning the article max-width; serif large text directly insertable in MDX with `<PullQuote>`.
- **Archive list**: dense rows, tabular dates, truncated titles where needed, no oversized cards. The archive-row hover uses a subtle 0.5px-hairline-edged bg using theme `--muted`.
- **Taxonomy pages**: compact `<CategoryChips>` and `<PostGrid>` with hairline borders.
- **Search**: Pagefind controls follow background, foreground, border, ring, and radius tokens.
- **Widgets**: GTM, AdSense, and x402 remain visually silent unless enabled.
- **Icons**: use `src/components/ui/Icon.astro` and the Lucide allowlist in `astro.config.mjs`.

The prose wrapper class is `content-prose`. Treat it as a stable CSS API.

## Visual Constraints

- Keep UI text inside its container at mobile, tablet, and desktop sizes.
- EditorialHero is the only place where the inverse theme is used as a full background.
- Cards use 0.5px hairlines, never 1px solid borders, and never glass blur.
- Use the gold accent sparingly: section title underlines, the editorial-hero rule, and accent-button dark variants only.
- Avoid decorative background blobs and nested floating cards.
- Avoid visible UI text that explains implementation details.
