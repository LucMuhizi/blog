import { getCollection, type CollectionEntry } from "astro:content"

import { normalizeContentSlug } from "@/utils/content-slug"

export async function getPage(slug: string): Promise<CollectionEntry<"page"> | undefined> {
  return (await getCollection("page", (entry) => !entry.data.draft)).find((page) => normalizeContentSlug(page.id) === slug)
}

export async function getAuthor(slug = "default"): Promise<CollectionEntry<"author"> | undefined> {
  return (await getCollection("author", (entry) => !entry.data.draft)).find((author) => author.data.slug === slug)
}
