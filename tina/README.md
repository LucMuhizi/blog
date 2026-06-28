# TinaCMS

TinaCMS is the editor for this site. The non-technical author signs in at
[Tina Cloud](https://app.tina.io) with an email — no GitHub account
required — and writes posts in a WYSIWYG editor. On save, Tina commits
an MDX file to this repository through the
[Tina GitHub App](https://github.com/apps/tina-cloud-app), and
Cloudflare Pages rebuilds the site automatically.

The schema lives in `tina/config.ts` and currently models the `post`
collection. The other Astro collections (`page`, `project`, `speaking`,
`author`) are not yet wired into Tina — see
[Adding more collections](#adding-more-collections) below.

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
   build embeds them into the static admin bundle at `/admin/`.
5. **Invite the non-technical editor** from the Tina Cloud dashboard
   (Project → Members → Invite). They get an email; no GitHub account
   is required.

## Editor day-to-day (the author)

1. Sign in at <https://app.tina.io>.
2. Open the project → **Posts** → **Create New** (or open an existing one).
3. Fill in the frontmatter (title, summary, dates, cover image) and
   write the body in the rich-text editor.
4. Click **Save**. Tina commits a new MDX file under
   `src/content/posts/en/` and Cloudflare Pages rebuilds the site
   (typically under a minute).

The "View on site" button in the editor opens the post at its
public URL.

> **Heads up on existing posts:** the migrated Medium posts use
> `*italic*` and Medium tracking pixels that Tina's rich-text editor
> will re-serialize on first save. This is a one-time, cosmetic change
> per post. New posts written in Tina are unaffected.

## Adding more collections

The `post` block in `tina/config.ts` is the template. To model another
Astro collection (say, `page`), copy the block and adapt:

- **`path`** — the on-disk directory, e.g. `src/content/pages/en`.
- **`format`** — `mdx` for `.mdx` files, `md` for `.md` files.
- **`fields`** — match the Zod schema in `src/content.config.ts`. The
  field `type` values are: `string`, `text`, `datetime`, `boolean`,
  `number`, `image`, `rich-text`, `object`, `list`.
- **`ui.router`** — the public URL pattern for the "view on site"
  button (e.g. `({ document }) => \`/${document._sys.filename}/\``).

The Astro content collection loader in `src/content.config.ts` does
**not** need to change — it already reads from these directories.
Tina writes the MDX frontmatter, and Astro's `glob()` loader picks it up
on the next build.

## Local development

`pnpm dev` runs `tinacms dev -c "astro dev"`, which starts:

- Tina's GraphQL backend on `:40001` (powers the admin UI)
- Astro's dev server on `:4321`
- The admin UI itself on <http://localhost:40001/admin/>

The `TINA_CLIENT_ID` and `TINA_TOKEN` env vars must be set in a local
`.env` for the admin UI to load existing content from the Tina Cloud
backend. Without them, Astro will still start, but the admin will not.

For a quick local-only iteration without Tina Cloud, you can also run
`astro dev` directly (the dev script defaults don't expose the admin).

## Troubleshooting

- **"Missing TINA_CLIENT_ID"** at build time — on Cloudflare Pages
  this means the production environment variables aren't set yet
  (see step 4 above). Locally, `pnpm build` will now skip the admin
  bundle with a warning instead of failing, so the site still ships
  without `/admin/`. Set the env vars in a local `.env` to get
  `/admin/` in local builds.
- **Editor loads but the document list is empty** — usually a stale
  Cloudflare cache on `/_graphql`. Hard-reload the editor
  (`Cmd/Ctrl + Shift + R`) and clear site data for the
  `app.tina.io` origin.
- **Build fails on `tinacms build`** — usually a TypeScript error in
  `tina/config.ts`. Run `npx tina-cli build` locally to see the
  error.
- **Saved a post but the site didn't update** — check the Cloudflare
  Pages deployment log; a `tinacms commit` followed by a Cloudflare
  build takes 30-90 s end to end.
