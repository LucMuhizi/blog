import { canonicalUrl } from "@/utils/routes"
import type { PostEntry } from "@/utils/posts"
import { postPath } from "@/utils/posts"

type PostLike = Pick<PostEntry, "id" | "data" | "collection">

export function postLocaleAlternates(post: PostLike) {
  const entry = post as PostEntry
  const url = canonicalUrl(postPath(entry))

  return {
    "en-US": url,
    "x-default": url,
  }
}
