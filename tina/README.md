# TinaCMS

TinaCMS is the editor for this site. The non-technical author signs in at
[Tina Cloud](https://app.tina.io) with an email — no GitHub account
required — and writes content in a WYSIWYG editor. On save, Tina commits
an MDX or Markdown file to this repository through the
[Tina GitHub App](https://github.com/apps/tina-cloud-app), and Cloudflare
Pages rebuilds the site automatically.

The schema lives in `tina/config.ts` and currently models **all five Astro
content collections** — see [Collections in Tina](#collections-in-tina)
below for what each one is for and which Astro detail page it serves.

## One-time setup (the developer)

1. **Create a Tina Cloud account** at <https://app.tina.io>.
2. **Create a new project** and connect this GitHub repository. Install
   the Tina GitHub App with write access to the `main` branch.
3. From the Tina Cloud dashboard, copy the following into a local
   `.env` file at the repo root (already gitignored):

   ```bash
   TINA_CLIENT_ID=...
   TINA_TOKEN=...
   ```

4. **Add the same two variables** as **environment variables** in the
   Cloudflare Pages project for this site (production environment). The
   existing Cloudflare env vars shown in the dashboard
   (`TINA_CLIENT_ID`, `TINA_TOKEN`, plus the older `tinaSite`/`tinaToken`
   /`tinaClient`) all flow into the same build — only the two uppercase
   ones are read by `tina/config.ts`. The build embeds them into the
   static admin bundle at `/admin/`.
5. **Invite the non-technical editor** from the Tina Cloud dashboard
   (Project → Members → Invite). They get an email; no GitHub account
   is required.

## Editor day-to-day (the author)

1. Sign in at <https://app.tina.io>.
2. Open the project → choose a collection from the sidebar.
3. Fill in the frontmatter and write the body in the rich-text editor.
4. Click **Save**. Tina commits a new file under the matching
   `src/content/<collection>/en/` directory and Cloudflare Pages
   rebuilds the site (typically under a minute).

The "View on site" button in the editor opens the entry at its
public URL on the production site.

> **Heads up on existing posts:** the migrated Medium posts use
> `*italic*` and Medium tracking pixels that Tina's rich-text editor
> will re-serialize on first save. This is a one-time, cosmetic change
> per post. New posts written in Tina are unaffected.
>
> **Heads up on `cdata-*` tags:** the migrated Medium posts also carry
> legacy `cdata-*` tag slugs (e.g. `cdata-nite-tanzarn`). These are
> not in the Tina editor's options list — re-saving the post in Tina
> will replace them with the canonical taxonomy. The Astro schema still
> accepts the old strings (it treats `tags` as `z.array(z.string())`),
> so legacy tags remain readable on disk until first save.

## Collections in Tina

| Collection | Path on disk | Astro detail page | Notes |
|---|---|---|---|
| `post` | `src/content/posts/en/*.mdx` | `/posts/<slug>/` | Long-form articles and essays. |
| `page` | `src/content/pages/en/*.{md,mdx}` | `/<slug>/` | Static site pages (about, contact, services, …). |
| `project` | `src/content/projects/en/*.mdx` | `/projects/<slug>/` | **No Astro detail page yet** — the "View on site" button will 404. |
| `speaking` | `src/content/speaking/en/*.mdx` | `/speaking/<slug>/` | **No Astro detail page yet** — the "View on site" button will 404. |
| `author` | `src/content/authors/en/*.md` | `/authors/<slug>/` | **No Astro detail page yet** — the "View on site" button will 404. |

If you want a usable "View on site" link for the last three rows, add
the matching dynamic route (`src/pages/projects/[slug].astro`,
`src/pages/speaking/[slug].astro`, `src/pages/authors/[slug].astro`)
before wiring entries through the editor.

The brand profile lives in `src/content/authors/en/default.md`. The
`headlineStats` array drives the credibility strip rendered on the
editorial hero and the about page by `CredibilityStrip.astro`.

The `post.authors` field is currently locked to `["default"]` in
`tina/config.ts`. To introduce a co-author, add an entry to that
options list **and** a sibling MD file under
`src/content/authors/en/` **together** — otherwise the new author is
unreferenceable from posts.

The category and tag option lists in `tina/config.ts` mirror the
canonical taxonomy in `src/config/taxonomy.ts`. When you add a slug,
do so in **both** files so the editor's dropdown matches what the
rest of the site accepts.

## Adding yet more collections

To wire a new collection (e.g. a future `event` collection), copy one
of the existing blocks in `tina/config.ts` and adapt:

- **`path`** — the on-disk directory, e.g. `src/content/events/en`.
- **`format`** — `mdx` for `.mdx` files, `md` for `.md` files.
- **`fields`** — match the Zod schema you add to
  `src/content.config.ts`. Field `type` values include `string`,
  `text`, `datetime`, `boolean`, `number`, `image`, `rich-text`,
  `object`, `list`.
- **`ui.router`** — the public URL pattern for the "view on site"
  button (e.g. `({ document }) => \`/events/\${document._sys.filename}/\``).
- **Astro detail page** — unless you also add
  `src/pages/<collection>/[slug].astro`, the "view on site" button
  will 404. Add the detail page before wiring the collection if
  submissions are expected before it exists.

The Astro content collection loader in `src/content.config.ts` does
**not** need special knowledge of the new collection — `glob()` reads
from whatever directory you point it at. Tina writes the file, Astro
picks it up on the next build.

## Local development

`pnpm dev` runs `tinacms dev -c "astro dev"`, which starts:

- Tina's GraphQL backend on `:40001` (powers the admin UI)
- Astro's dev server on `:4321`
- The admin UI itself on <http://localhost:40001/admin/>

The `TINA_CLIENT_ID` and `TINA_TOKEN` env vars must be set in a local
`.env` for the admin UI to load existing content from the Tina Cloud
backend. Without them, Astro will still start, but the admin will not.

For a quick local-only iteration without Tina Cloud, you can also run
`astro dev` directly (`pnpm dev:background` or `pnpm start`) — those
don't expose the admin.

## Troubleshooting

- **"Missing TINA_CLIENT_ID"** at build time — on Cloudflare Pages
  this means the production environment variables aren't set yet
  (see step 4 above). Locally, `pnpm build` will now skip the admin
  bundle with a warning instead of failing, so the site still ships
  without `/admin/`. Set the env vars in a local `.env` (gitignored)
  to get the `/admin/` route in local builds.
- **Editor loads but the document list is empty** — usually a stale
  Cloudflare cache on `/_graphql`. Hard-reload the editor
  (`Cmd/Ctrl + Shift + R`) and clear site data for the
  `app.tina.io` origin.
- **Tina's pre-flight check fails on a fresh project** — the Tina CLI
  validates the branch against Tina Cloud at build time, which can
  403 before the first `tinacms dev` run has registered the branch.
  `scripts/tina-build.mjs` already passes `--skip-cloud-checks` to
  avoid this; the editor still authenticates against the right
  project at runtime.
- **Build fails on `tinacms build`** — usually a TypeScript error in
  `tina/config.ts`. Run `pnpm exec tinacms build` locally to see the
  error.
- **Stale `tina/__generated__/` types** — these are written on every
  `tinacms dev`/`tinacms build` run. Delete the directory (it's
  gitignored) and rerun if the editor complains about a mismatched
  type even after `pnpm install`.
- **Stale `tina/tina-lock.json`** — Tina regenerates this lock on
  build. If `tina/config.ts` changes in a way the lock doesn't
  recognise, delete `tina/tina-lock.json` and rerun — Tina will
  write a fresh one against the current schema.
- **Saved a post but the site didn't update** — check the Cloudflare
  Pages deployment log; a `tinacms commit` followed by a Cloudflare
  build takes 30–90 s end to end.
