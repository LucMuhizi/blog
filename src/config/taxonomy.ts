type LocalizedText = { en: string }

export type TaxonomyItem = {
  slug: string
  order: number
  labelByLocale: LocalizedText
  descriptionByLocale: LocalizedText
}

const localized = (text: LocalizedText): LocalizedText => text

const localizedSingle = (value: string): LocalizedText => localized({ en: value })

export const TAXONOMY = {
  categories: [
    {
      slug: "articles",
      order: 0,
      labelByLocale: localizedSingle("Articles"),
      descriptionByLocale: localizedSingle(
        "Long-form analysis and opinion essays on Agency, Authority, and Architecture."
      ),
    },
    {
      slug: "research",
      order: 1,
      labelByLocale: localizedSingle("Research"),
      descriptionByLocale: localizedSingle(
        "Original research, field reports, and quantitative work."
      ),
    },
    {
      slug: "policy",
      order: 2,
      labelByLocale: localizedSingle("Policy"),
      descriptionByLocale: localizedSingle(
        "Policy briefs, frameworks, and recommendations."
      ),
    },
    {
      slug: "speaking",
      order: 3,
      labelByLocale: localizedSingle("Speaking & Media"),
      descriptionByLocale: localizedSingle(
        "Talks, interviews, panels, podcasts, and press mentions."
      ),
    },
    {
      slug: "notes",
      order: 4,
      labelByLocale: localizedSingle("Notes"),
      descriptionByLocale: localizedSingle(
        "Brief notes and reflections."
      ),
    },
    {
      slug: "projects",
      order: 5,
      labelByLocale: localizedSingle("Projects"),
      descriptionByLocale: localizedSingle(
        "Consultancy and research projects. See the Projects collection."
      ),
    },
  ],
  tags: [
    {
      slug: "strategy",
      order: 1,
      labelByLocale: localizedSingle("Strategy"),
      descriptionByLocale: localizedSingle("Strategic thinking."),
    },
    {
      slug: "risk",
      order: 2,
      labelByLocale: localizedSingle("Risk"),
      descriptionByLocale: localizedSingle("Risk and resilience."),
    },
    {
      slug: "market",
      order: 3,
      labelByLocale: localizedSingle("Market"),
      descriptionByLocale: localizedSingle("Market observations."),
    },
    {
      slug: "reflect",
      order: 4,
      labelByLocale: localizedSingle("Reflect"),
      descriptionByLocale: localizedSingle("Reflective notes."),
    },
    {
      slug: "media",
      order: 5,
      labelByLocale: localizedSingle("Media"),
      descriptionByLocale: localizedSingle("Media and publishing."),
    },
    {
      slug: "roam",
      order: 6,
      labelByLocale: localizedSingle("Roam"),
      descriptionByLocale: localizedSingle("Travel and movement."),
    },
    {
      slug: "allocation",
      order: 7,
      labelByLocale: localizedSingle("Allocation"),
      descriptionByLocale: localizedSingle("Capital allocation."),
    },
    {
      slug: "innovation",
      order: 8,
      labelByLocale: localizedSingle("Innovation"),
      descriptionByLocale: localizedSingle("Innovation and products."),
    },
    {
      slug: "model",
      order: 9,
      labelByLocale: localizedSingle("Model"),
      descriptionByLocale: localizedSingle("Models and frameworks."),
    },
    {
      slug: "management",
      order: 10,
      labelByLocale: localizedSingle("Management"),
      descriptionByLocale: localizedSingle("Management and operations."),
    },
    {
      slug: "governance",
      order: 11,
      labelByLocale: localizedSingle("Governance"),
      descriptionByLocale: localizedSingle(
        "Governance structures, processes, and reform."
      ),
    },
    {
      slug: "development",
      order: 12,
      labelByLocale: localizedSingle("Development"),
      descriptionByLocale: localizedSingle(
        "International and domestic development."
      ),
    },
    {
      slug: "policy",
      order: 13,
      labelByLocale: localizedSingle("Policy"),
      descriptionByLocale: localizedSingle(
        "Policy documents, briefs, and frameworks."
      ),
    },
    {
      slug: "education",
      order: 14,
      labelByLocale: localizedSingle("Education"),
      descriptionByLocale: localizedSingle("Education systems and equity."),
    },
    {
      slug: "health",
      order: 15,
      labelByLocale: localizedSingle("Health"),
      descriptionByLocale: localizedSingle("Public health systems and access."),
    },
    {
      slug: "technology",
      order: 16,
      labelByLocale: localizedSingle("Technology"),
      descriptionByLocale: localizedSingle(
        "Technology design and digital equity."
      ),
    },
    {
      slug: "africa",
      order: 17,
      labelByLocale: localizedSingle("Africa"),
      descriptionByLocale: localizedSingle(
        "Africa-focused analysis and reporting."
      ),
    },
    {
      slug: "uganda",
      order: 18,
      labelByLocale: localizedSingle("Uganda"),
      descriptionByLocale: localizedSingle(
        "Uganda-focused analysis and reporting."
      ),
    },
    {
      slug: "consultancy",
      order: 19,
      labelByLocale: localizedSingle("Consultancy"),
      descriptionByLocale: localizedSingle(
        "Independent consultancy engagements."
      ),
    },
    {
      slug: "research",
      order: 20,
      labelByLocale: localizedSingle("Research"),
      descriptionByLocale: localizedSingle(
        "Original research, methodology, and findings."
      ),
    },
    {
      slug: "leadership",
      order: 21,
      labelByLocale: localizedSingle("Leadership"),
      descriptionByLocale: localizedSingle(
        "Leadership and institutional change."
      ),
    },
  ],
} as const

export const PRIMARY_CATEGORY_SLUGS = [
  "articles",
  "research",
  "policy",
  "speaking",
  "notes",
  "projects",
] as const

export const TAGS_BY_CATEGORY: Record<string, readonly string[]> = {
  articles: ["reflect", "strategy", "model"],
  research: ["strategy", "model", "innovation"],
  policy: ["strategy", "model", "management"],
  speaking: ["media", "strategy", "model"],
  notes: ["reflect", "roam", "model"],
  projects: ["innovation", "model", "management"],
}

export function getCategory(slug: string): TaxonomyItem | undefined {
  return TAXONOMY.categories.find((item) => item.slug === slug)
}

export function getTag(slug: string): TaxonomyItem | undefined {
  return TAXONOMY.tags.find((item) => item.slug === slug)
}

const normalizeKey = (value: string): string =>
  value.trim().toLowerCase().replace(/[\s_]+/g, "-")

const categoryAliases: Record<string, string> = {}

const tagAliases: Record<string, string> = {}

function buildTaxonomyLookup(
  items: readonly TaxonomyItem[],
  aliases: Record<string, string>
): Map<string, string> {
  const lookup = new Map<string, string>()

  for (const item of items) {
    lookup.set(normalizeKey(item.slug), item.slug)
    lookup.set(normalizeKey(item.labelByLocale.en), item.slug)
  }

  for (const [alias, slug] of Object.entries(aliases)) {
    lookup.set(normalizeKey(alias), slug)
  }

  return lookup
}

const categoryLookup = buildTaxonomyLookup(TAXONOMY.categories, categoryAliases)
const tagLookup = buildTaxonomyLookup(TAXONOMY.tags, tagAliases)

export function normalizeCategorySlug(value: string): string {
  return categoryLookup.get(normalizeKey(value)) ?? normalizeKey(value)
}

export function normalizeTagSlug(value: string): string {
  return tagLookup.get(normalizeKey(value)) ?? normalizeKey(value)
}

export function getPrimaryCategories(): TaxonomyItem[] {
  return PRIMARY_CATEGORY_SLUGS.map((slug) => getCategory(slug)).filter(
    (item): item is TaxonomyItem => Boolean(item)
  )
}

export function getTagsForCategory(slug: string): TaxonomyItem[] {
  const tagSlugs = TAGS_BY_CATEGORY[slug] ?? []
  return tagSlugs
    .map((tagSlug) => getTag(tagSlug))
    .filter((item): item is TaxonomyItem => Boolean(item))
}
