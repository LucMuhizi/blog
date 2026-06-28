import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"
import { z } from "astro/zod"

const seoPayloadOptional = z
  .object({
    seoTitle: z.string().max(60).optional(),
    seoDescription: z.string().max(160).optional(),
    canonical: z
      .string()
      .refine((value) => /^https?:\/\//.test(value), {
        message: "Canonical URL must be absolute.",
      })
      .optional(),
  })
  .optional()

const generateId = ({ entry }: { entry: string }) =>
  entry.replace(/\.(md|mdx|markdown)$/i, "")

const remoteImageDimensions = (
  data: {
    heroImage?: string
    heroImageWidth?: number
    heroImageHeight?: number
  },
  ctx: {
    addIssue: (issue: {
      code: "custom"
      message: string
      path: string[]
    }) => void
  }
) => {
  if (!data.heroImage?.startsWith("https://")) return
  if (!data.heroImageWidth || !data.heroImageHeight) {
    ctx.addIssue({
      code: "custom",
      message: "Remote heroImage requires heroImageWidth and heroImageHeight.",
      path: ["heroImage"],
    })
  }
}

const post = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx,markdown}",
    base: "./src/content/posts",
    generateId,
  }),
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      category: z.string(),
      tags: z.array(z.string()).default([]),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      authors: z.array(z.string()).min(1).default(["default"]),
      heroImage: z.string(),
      heroImageAlt: z.string(),
      heroImageWidth: z.number().int().positive().optional(),
      heroImageHeight: z.number().int().positive().optional(),
      heroBlurDataURL: z.string().optional(),
      canonical: z.string().regex(/^https?:\/\/.+/i).optional(),
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
      pdfDownload: z.string().regex(/^https?:\/\/.+/i).optional(),
      readingTime: z.number().int().positive().max(120).optional(),
      viewCount: z.number().int().nonnegative().optional(),
      draft: z.boolean().default(true),
      featured: z.boolean().default(false),
      seo: seoPayloadOptional,
    })
    .superRefine(remoteImageDimensions),
})

const page = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx,markdown}",
    base: "./src/content/pages",
    generateId,
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    noindex: z.boolean().default(false),
    draft: z.boolean().default(false),
    seo: seoPayloadOptional,
  }),
})

const project = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx,markdown}",
    base: "./src/content/projects",
    generateId,
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(200),
    pubDate: z.coerce.date(),
    status: z.enum(["completed", "ongoing", "upcoming"]),
    client: z.string().optional(),
    tags: z.array(z.string()).default([]),
    projectUrl: z.url().optional(),
    relatedArticles: z.array(z.string()).default([]),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    heroImageWidth: z.number().int().positive().optional(),
    heroImageHeight: z.number().int().positive().optional(),
    heroBlurDataURL: z.string().optional(),
    canonical: z.string().regex(/^https?:\/\/.+/i).optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(true),
    seo: seoPayloadOptional,
  }),
})

const speaking = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx,markdown}",
    base: "./src/content/speaking",
    generateId,
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(200),
    eventDate: z.coerce.date(),
    pubDate: z.coerce.date(),
    eventType: z.enum([
      "keynote",
      "panel",
      "interview",
      "podcast",
      "press",
      "webinar",
      "workshop",
    ]),
    organisation: z.string().optional(),
    location: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    heroImageWidth: z.number().int().positive().optional(),
    heroImageHeight: z.number().int().positive().optional(),
    heroBlurDataURL: z.string().optional(),
    recordingUrl: z.url().optional(),
    slidesUrl: z.url().optional(),
    tags: z.array(z.string()).default([]),
    canonical: z.string().regex(/^https?:\/\/.+/i).optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(true),
    seo: seoPayloadOptional,
  }),
})

// Single-author brand profile. The headlineStats array drives the
// `CredibilityStrip` on the editorial hero and any "About" surfaces.
const DEFAULT_HEADLINE_STATS = [
  { value: "30+", label: "Years of practice" },
  { value: "40+", label: "Countries engaged" },
  { value: "120+", label: "Essays & reports" },
  { value: "18", label: "UN agencies advised" },
]

const author = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx,markdown}",
    base: "./src/content/authors",
    generateId,
  }),
  schema: z.object({
    name: z.string(),
    bio: z.string().default(""),
    slug: z.string().default("default"),
    role: z.string().optional(),
    tagline: z.string().optional(),
    location: z.string().optional(),
    avatar: z.string().optional(),
    avatarWidth: z.number().int().positive().optional(),
    avatarHeight: z.number().int().positive().optional(),
    githubUsername: z.string().optional(),
    headlineStats: z
      .array(
        z.object({
          value: z.string().min(1).max(16),
          label: z.string().min(1).max(40),
        })
      )
      .default(DEFAULT_HEADLINE_STATS),
    socials: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().refine((value) => {
            if (value.startsWith("/")) return true
            return z.url().safeParse(value).success
          }, "Social URL must be absolute or root-relative."),
        })
      )
      .default([]),
    organisations: z
      .array(
        z.object({
          name: z.string().min(1).max(60),
          url: z.string().refine((value) => {
            if (value.startsWith("/")) return true
            return z.url().safeParse(value).success
          }, "Organisation URL must be absolute or root-relative.").optional(),
        })
      )
      .default([]),
    draft: z.boolean().default(false),
  }),
})

export const collections = { post, page, project, speaking, author }
