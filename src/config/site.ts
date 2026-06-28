import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

// src/config/site-overrides.json is the file the Pages CMS Site Settings
// section writes to. Read it at build/dev time so a missing or syntactically
// invalid JSON quietly resolves to defaults rather than crashing the whole
// SITE_CONFIG export.
function loadOverrides(): SiteOverrides {
  try {
    const here = fileURLToPath(import.meta.url)
    const overridesFile = path.join(path.dirname(here), "site-overrides.json")
    if (!fs.existsSync(overridesFile)) return {}
    const text = fs.readFileSync(overridesFile, "utf8")
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as SiteOverrides
    }
    console.warn(
      "[site] site-overrides.json is not a JSON object; using defaults only."
    )
    return {}
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(
      `[site] Falling back to defaults; could not parse site-overrides.json: ${message}`
    )
    return {}
  }
}

export type HomepageLayout = "cover" | "archive" | "text"
export type RemoteImagePattern = {
  protocol: "https"
  hostname: string
}
export type X402ChargeMode = "all" | "bot-only"
export type ServiceItem = {
  title: string
  summary: string
  href: string
  detail?: string
}

type SiteOverrides = {
  heroHeadline?: string
  heroSubheadline?: string
  heroCtaLabel?: string
  heroCtaUrl?: string
  services?: ServiceItem[]
  social?: {
    twitter?: string
    linkedin?: string
    medium?: string
    github?: string
  }
  newsletterHeadline?: string
  newsletterDescription?: string
  newsletterFormUrl?: string
}

const siteOverrides = loadOverrides()

function readPublicEnv(name: string): string | undefined {
  const importMetaEnv = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env
  const nodeEnv = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> }
    }
  ).process?.env

  return importMetaEnv?.[name] ?? nodeEnv?.[name]
}

function normalizeGoogleTagManagerId(value: string | undefined): string {
  const id = (value ?? "").trim()
  return /^GTM-[A-Z0-9]+$/i.test(id) ? id.toUpperCase() : ""
}

function normalizeGoogleAdsenseClientId(value: string | undefined): string {
  const id = (value ?? "").trim()
  return /^ca-pub-\d+$/i.test(id) ? id : ""
}

function normalizePublicString(value: string | undefined): string {
  return (value ?? "").trim()
}

function hostnameFromUrl(value: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.hostname : undefined
  } catch {
    return undefined
  }
}

function normalizeX402ChargeMode(value: string | undefined): X402ChargeMode {
  const mode = normalizePublicString(value).toLowerCase()
  return mode === "bot-only" || mode === "bots" ? "bot-only" : "all"
}

function normalizeBotScoreThreshold(value: string | undefined): number {
  const threshold = Number.parseInt(normalizePublicString(value), 10)
  if (!Number.isFinite(threshold)) return 30
  return Math.min(99, Math.max(1, threshold))
}

function nonEmptyOverride(value: string | undefined): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ""
}

const googleTagManagerId = normalizeGoogleTagManagerId(readPublicEnv("PUBLIC_GTM_ID"))
const googleAdsenseClientId = normalizeGoogleAdsenseClientId(
  readPublicEnv("PUBLIC_ADSENSE_CLIENT_ID")
)
const publicAssetBaseUrl = normalizePublicString(
  readPublicEnv("PUBLIC_ASSET_BASE_URL")
).replace(/\/$/, "")
const publicAssetHost = hostnameFromUrl(publicAssetBaseUrl)
const x402PayTo = normalizePublicString(readPublicEnv("PUBLIC_X402_PAY_TO"))
const x402Network = normalizePublicString(
  readPublicEnv("PUBLIC_X402_NETWORK") ?? "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
)
const x402Price = normalizePublicString(
  readPublicEnv("PUBLIC_X402_PRICE") ?? "$0.01"
)
const x402Description = normalizePublicString(
  readPublicEnv("PUBLIC_X402_DESCRIPTION") ??
    "Voluntary x402 payment support for Blog content."
)
const x402FacilitatorUrl = normalizePublicString(
  readPublicEnv("PUBLIC_X402_FACILITATOR_URL")
)
const x402ChargeMode = normalizeX402ChargeMode(readPublicEnv("PUBLIC_X402_CHARGE_MODE"))
const x402BotScoreThreshold = normalizeBotScoreThreshold(
  readPublicEnv("PUBLIC_X402_BOT_SCORE_THRESHOLD")
)
const socialXUrl = "https://x.com/nitetanzarn"
const socialXHandle = `@${
  new URL(socialXUrl).pathname.split("/").filter(Boolean)[0] ?? "nitetanzarn"
}`

const DEFAULT_HERO = {
  headline: "Advancing Agency, Authority, and Architecture",
  subheadline:
    "An intellectual infrastructure for research, policy, and governance innovation. Grounded in rigour, with future-oriented thinking.",
  ctaLabel: "Read the latest",
  ctaUrl: "/posts/",
}

const DEFAULT_SERVICES: ServiceItem[] = [
  {
    title: "Research & Fieldwork",
    summary:
      "Original empirical work, field reports, and quantitative analysis grounded in structural inquiry.",
    href: "/services/",
    detail: "Briefs, frameworks, white papers",
  },
  {
    title: "Policy Advisory",
    summary:
      "Briefs, frameworks, and recommendations for governments, multilaterals, and civil society.",
    href: "/services/",
    detail: "Coalition, advisory, review",
  },
  {
    title: "Training & Convening",
    summary:
      "Capacity-building for institutions, coalitions, and emerging leaders in structural equity.",
    href: "/services/",
    detail: "Workshops, curricula, fellowships",
  },
  {
    title: "Consultancy",
    summary:
      "Independent engagements with organisations committed to structural change.",
    href: "/services/",
    detail: "Scoping, design, follow-through",
  },
]

const overrideSocial = siteOverrides.social ?? {}
const overrideServices = siteOverrides.services

const hero = {
  headline: nonEmptyOverride(siteOverrides.heroHeadline) || DEFAULT_HERO.headline,
  subheadline:
    nonEmptyOverride(siteOverrides.heroSubheadline) || DEFAULT_HERO.subheadline,
  ctaLabel: nonEmptyOverride(siteOverrides.heroCtaLabel) || DEFAULT_HERO.ctaLabel,
  ctaUrl: nonEmptyOverride(siteOverrides.heroCtaUrl) || DEFAULT_HERO.ctaUrl,
}

const social = {
  x: socialXUrl,
  xHandle: socialXHandle,
  twitter: nonEmptyOverride(overrideSocial.twitter) || socialXUrl,
  linkedin: nonEmptyOverride(overrideSocial.linkedin),
  medium: nonEmptyOverride(overrideSocial.medium),
  github: nonEmptyOverride(overrideSocial.github),
}

const newsletter = {
  headline:
    nonEmptyOverride(siteOverrides.newsletterHeadline) ||
    "Get the next essay in your inbox",
  description:
    nonEmptyOverride(siteOverrides.newsletterDescription) ||
    "A short reflective essay each month on policy, structural equity, and the systems that shape daily life.",
  formUrl: nonEmptyOverride(siteOverrides.newsletterFormUrl),
  inputPlaceholder: "Your email address",
  submitLabel: "Subscribe",
  socialProof: "Free monthly digest. Unsubscribe anytime.",
}

export const SITE_CONFIG = {
  brand: "Nite Tanzarn",
  brandTagline: "NITE TANZARN IntellectNest",
  name: "Nite Tanzarn",
  url: (
    readPublicEnv("PUBLIC_SITE_URL") ?? "https://nitetanzarn.com"
  ).replace(/\/$/, ""),
  description:
    "Advancing Agency, Authority, and Architecture to dismantle structural inequality and design systems for equity.",
  positioning:
    "An intellectual infrastructure for research, policy transformation, institutional retrofit, and governance innovation. Grounded in rigour and future-oriented thinking.",
  repository: "https://github.com/LucMuhizi/blog",
  contact: {
    email: "info@nitetanzarn.com",
    phone: "123-456-7890",
    address: "Mbuya, Kampala, Uganda",
  },
  social,
  hero,
  services: overrideServices && overrideServices.length > 0 ? overrideServices : DEFAULT_SERVICES,
  newsletter,
  defaultOgImage: "/open-graph.webp",
  assets: {
    publicBaseUrl: publicAssetBaseUrl,
    remotePatterns: [
      ...(publicAssetHost
        ? [{ protocol: "https", hostname: publicAssetHost } as const]
        : []),
      { protocol: "https", hostname: "*.unsplash.com" },
    ] satisfies RemoteImagePattern[],
    unsplashImageHost: "images.unsplash.com",
  },
  homepage: {
    layout: "cover" as HomepageLayout,
  },
  analytics: {
    googleTagManager: {
      enabled: readPublicEnv("PUBLIC_GTM_ENABLED") === "true",
      containerId: googleTagManagerId,
    },
    googleAdsense: {
      enabled: readPublicEnv("PUBLIC_ADSENSE_ENABLED") === "true",
      clientId: googleAdsenseClientId,
    },
  },
  payments: {
    x402: {
      enabled: readPublicEnv("PUBLIC_X402_ENABLED") === "true",
      payTo: x402PayTo,
      network: x402Network,
      price: x402Price,
      description: x402Description,
      facilitatorUrl: x402FacilitatorUrl,
      chargeMode: x402ChargeMode,
      botScoreThreshold: x402BotScoreThreshold,
    },
  },
}
