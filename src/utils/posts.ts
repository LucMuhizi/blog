import { getCollection, type CollectionEntry } from "astro:content"

import { normalizeCategorySlug, normalizeTagSlug } from "@/config/taxonomy"
import { normalizeContentSlug } from "@/utils/content-slug"

export type PostEntry = CollectionEntry<"post">

const publishedPostsPromise = getCollection("post", (entry) => !entry.data.draft)

export function sortPostsByDate(posts: readonly PostEntry[]): PostEntry[] {
  return [...posts].sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime())
}

export function postSlug(entry: PostEntry): string {
  return normalizeContentSlug(entry.id)
}

export function postPath(entry: PostEntry): string {
  return `/posts/${postSlug(entry)}/`
}

export function postUrl(entry: PostEntry): string {
  return postPath(entry)
}

export function postCategorySlug(entry: PostEntry): string {
  return normalizeCategorySlug(entry.data.category)
}

export function postTagSlugs(entry: PostEntry): string[] {
  return [...new Set(entry.data.tags.map((tag) => normalizeTagSlug(tag)))]
}

export async function getPublishedPosts(): Promise<PostEntry[]> {
  return sortPostsByDate(await publishedPostsPromise)
}

export async function getPosts(): Promise<PostEntry[]> {
  return getPublishedPosts()
}

export async function getPostsByCategory(slug: string): Promise<PostEntry[]> {
  return (await getPublishedPosts()).filter((post) => postCategorySlug(post) === slug)
}

export async function getPostsByTag(slug: string): Promise<PostEntry[]> {
  return (await getPublishedPosts()).filter((post) => postTagSlugs(post).includes(slug))
}
