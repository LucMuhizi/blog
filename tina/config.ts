import { defineConfig, type TinaField } from "tinacms";

// Branch Tina commits to. Read from the host platform's env if present,
// otherwise default to `main` (matches this repo's production branch).
const branch =
  process.env.GITHUB_BRANCH ??
  process.env.VERCEL_GIT_COMMIT_REF ??
  process.env.HEAD ??
  "main";

// Shared UI configuration --------------------------------------------------------

// Title→filename slugifier. Matches the existing post convention so a brand
// edit doesn't collide with the on-disk filenames used today.
const slugifyTitle = (values: Record<string, unknown>): string => {
  const title = (values?.title as string | undefined)?.trim() || "untitled";
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
};

// These tag/category lists mirror the canonical taxonomy in
// src/config/taxonomy.ts. They are duplicated here on purpose so the Tina
// editor can validate writes against the same set of allowed slugs the Astro
// side accepts. When you add a tag, do so in BOTH files.
const CATEGORY_OPTIONS = [
  "articles",
  "research",
  "policy",
  "projects",
  "speaking",
  "notes",
];

const TAG_OPTIONS = [
  "strategy",
  "risk",
  "market",
  "reflect",
  "media",
  "roam",
  "allocation",
  "innovation",
  "model",
  "management",
  "governance",
  "development",
  "policy",
  "education",
  "health",
  "technology",
  "africa",
  "uganda",
  "consultancy",
  "research",
  "leadership",
];

// Reused UI declarations --------------------------------------------------------

// SEO fields are emitted top-level on disk. The matching Astro schema
// (`seoPayloadOptional` in src/content.config.ts) accepts the same
// three values nested under `seo:` — the on-disk convention today,
// and the only form this editor writes, is the top-level one. Keep
// it that way when editing existing files so commits round-trip.
const seoTitleField: TinaField = {
  type: "string",
  name: "seoTitle",
  label: "SEO title",
  description: "Custom <title> tag. Max 60 characters.",
};

const seoDescriptionField: TinaField = {
  type: "string",
  name: "seoDescription",
  label: "SEO description",
  description: "Custom meta description. Max 160 characters.",
  ui: { component: "textarea" },
};

const canonicalField: TinaField = {
  type: "string",
  name: "canonical",
  label: "Canonical URL",
  description:
    "Set only if this content was originally published elsewhere (e.g. Medium). Absolute URL.",
};

const heroImageField: TinaField = {
  type: "image",
  name: "heroImage",
  label: "Cover image",
  description: "Recommended size 1200×630 px.",
};

const heroImageAltField: TinaField = {
  type: "string",
  name: "heroImageAlt",
  label: "Cover image alt text",
  description: "Describe the image for screen readers and SEO.",
};

const heroImageWidthField: TinaField = {
  type: "number",
  name: "heroImageWidth",
  label: "Cover image width",
  description: "Required for remote (URL) cover images.",
};

const heroImageHeightField: TinaField = {
  type: "number",
  name: "heroImageHeight",
  label: "Cover image height",
  description: "Required for remote (URL) cover images.",
};

const heroBlurDataURLField: TinaField = {
  type: "string",
  name: "heroBlurDataURL",
  label: "Hero blur placeholder",
  description:
    "Optional base64 data URL used as a low-quality placeholder while the cover image loads. Leave blank to use Astro's automatic image processing.",
};

const heroImageGroup: TinaField[] = [
  heroImageField,
  heroImageAltField,
  heroImageWidthField,
  heroImageHeightField,
  heroBlurDataURLField,
];

const pubDateField: TinaField = {
  type: "datetime",
  name: "pubDate",
  label: "Publication date",
  required: true,
  ui: { dateFormat: "YYYY-MM-DD" },
};

const updatedDateField: TinaField = {
  type: "datetime",
  name: "updatedDate",
  label: "Last updated",
  description:
    "Fill in only if the article was substantially revised after first publication.",
  ui: { dateFormat: "YYYY-MM-DD" },
};

const draftField: TinaField = {
  type: "boolean",
  name: "draft",
  label: "Draft (hidden from site)",
  description:
    "Turn off to publish. While on, the entry is invisible to visitors.",
};

const featuredField: TinaField = {
  type: "boolean",
  name: "featured",
  label: "Featured",
  description: "Pins the entry to featured surfaces.",
};

const tagsField: (opts: string[]) => TinaField = (opts) => ({
  type: "string",
  name: "tags",
  label: "Tags",
  list: true,
  options: opts,
  ui: { component: "tags" },
});

const bodyField: TinaField = {
  type: "rich-text",
  name: "body",
  label: "Content",
  isBody: true,
};

// Configuration -----------------------------------------------------------------

export default defineConfig({
  branch,

  // Set these in Cloudflare Pages (or `.env` for local dev) after
  // creating the project at https://app.tina.io.
  clientId: process.env.TINA_CLIENT_ID ?? null,
  token: process.env.TINA_TOKEN ?? null,

  // The Tina CLI writes the static admin SPA into `public/admin/`, which
  // Astro serves at `/admin/`. The `publicFolder` is the directory the
  // CLI treats as the static root.
  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },

  // Media uploads land in `public/uploads/` and are referenced as
  // `/uploads/...` in frontmatter. Astro serves `public/` as static
  // assets at the site root, so the URL path is reachable.
  // Note: Tina-uploaded images are served as-is (no Astro image
  // optimization). Migrate an image to `src/assets/` manually if you
  // need `OptimizedPicture` processing on it.
  media: {
    tina: {
      mediaRoot: "uploads",
      publicFolder: "public",
    },
  },

  schema: {
    collections: [
      // ── Posts ────────────────────────────────────────────────────────
      // Already-wired collection. Kept here for clarity and so future
      // edits to the shared field definitions stay in sync.
      {
        name: "post",
        label: "Posts",
        path: "src/content/posts/en",
        format: "mdx",
        ui: {
          router: ({ document }) => `/posts/${document._sys.filename}/`,
          filename: { slugify: slugifyTitle },
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
            description:
              "The article headline. Keep under 80 characters for best SEO.",
          },
          {
            type: "string",
            name: "description",
            label: "Summary",
            required: true,
            description:
              "Shown on article cards and in search results. 120–160 characters.",
            ui: { component: "textarea" },
          },
          pubDateField,
          updatedDateField,
          ...heroImageGroup,
          {
            type: "string",
            name: "category",
            label: "Category",
            required: true,
            options: CATEGORY_OPTIONS,
          },
          tagsField(TAG_OPTIONS),
          {
            type: "string",
            name: "authors",
            label: "Author",
            list: true,
            options: ["default"],
            description:
              "Locked to the brand profile for now. The brand runs as a single-author platform; add a new entry to the option list only when introducing a co-author and at the same time authoring a corresponding file under src/content/authors/en/.",
          },
          seoTitleField,
          seoDescriptionField,
          canonicalField,
          {
            type: "string",
            name: "pdfDownload",
            label: "PDF download URL",
            description:
              "Paste the Cloudflare R2 public URL of the PDF version of this article.",
          },
          {
            type: "number",
            name: "readingTime",
            label: "Reading time (minutes)",
            description:
              "Approximate reading time. Leave blank to auto-calculate.",
          },
          {
            type: "number",
            name: "viewCount",
            label: "View count",
            description:
              "Must be a whole number ≥ 0 (no decimals, no negatives). Optional editorial seed value — leave blank for live posts so a server-side tracker can fill it in; pin a number for evergreen essays that should always claim a readership.",
          },
          draftField,
          featuredField,
          bodyField,
        ],
      },

      // ── Pages ────────────────────────────────────────────────────────
      // Long-form static pages (about, contact, services, values, ...)
      // served at /<slug>/. Pages already exist on disk in
      // src/content/pages/en/ (about.mdx, contact.md, services.mdx,
      // values.mdx, annotations.mdx). New pages the author creates
      // through Tina land beside them with the same slugifier.
      {
        name: "page",
        label: "Pages",
        path: "src/content/pages/en",
        format: "mdx",
        ui: {
          router: ({ document }) => `/${document._sys.filename}/`,
          filename: { slugify: slugifyTitle },
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "description",
            label: "Summary",
            required: true,
            description:
              "Used in head meta and any listing surfaces that include this page.",
            ui: { component: "textarea" },
          },
          seoTitleField,
          seoDescriptionField,
          canonicalField,
          {
            type: "boolean",
            name: "noindex",
            label: "Hide from search engines (noindex)",
            description:
              "Turn on for internal pages you don't want indexed.",
          },
          draftField,
          bodyField,
        ],
      },

      // ── Projects ─────────────────────────────────────────────────────
      // Consultancy / research projects. Live in src/content/projects/en/.
      // The router points at /projects/<slug>/, which has no Astro
      // detail page yet — "View on site" will 404 until
      // src/pages/projects/[slug].astro is added.
      {
        name: "project",
        label: "Projects",
        path: "src/content/projects/en",
        format: "mdx",
        ui: {
          router: ({ document }) => `/projects/${document._sys.filename}/`,
          filename: { slugify: slugifyTitle },
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "description",
            label: "Summary",
            required: true,
            description: "Up to 200 characters.",
            ui: { component: "textarea" },
          },
          pubDateField,
          {
            type: "string",
            name: "status",
            label: "Status",
            required: true,
            options: ["completed", "ongoing", "upcoming"],
            description: "Project lifecycle state.",
          },
          {
            type: "string",
            name: "client",
            label: "Client",
            description: "Commissioning organisation or partner. Optional.",
          },
          tagsField(TAG_OPTIONS),
          {
            type: "string",
            name: "projectUrl",
            label: "Project URL",
            description:
              "Absolute URL to a published project page or microsite, if any.",
          },
          {
            type: "string",
            name: "relatedArticles",
            label: "Related articles",
            list: true,
            description:
              "Filenames (without .mdx) of related posts in src/content/posts/en.",
          },
          ...heroImageGroup,
          canonicalField,
          seoTitleField,
          seoDescriptionField,
          featuredField,
          draftField,
          bodyField,
        ],
      },

      // ── Speaking & media ────────────────────────────────────────────
      // Talks, interviews, podcasts, press mentions, workshops, webinars,
      // panels. Live in src/content/speaking/en/.
      // The router points at /speaking/<slug>/, which has no Astro
      // detail page yet — "View on site" will 404 until
      // src/pages/speaking/[slug].astro is added.
      {
        name: "speaking",
        label: "Speaking & media",
        path: "src/content/speaking/en",
        format: "mdx",
        ui: {
          router: ({ document }) => `/speaking/${document._sys.filename}/`,
          filename: { slugify: slugifyTitle },
        },
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "description",
            label: "Summary",
            required: true,
            description: "Up to 200 characters.",
            ui: { component: "textarea" },
          },
          {
            type: "datetime",
            name: "eventDate",
            label: "Event date",
            required: true,
            ui: { dateFormat: "YYYY-MM-DD" },
          },
          pubDateField,
          {
            type: "string",
            name: "eventType",
            label: "Event type",
            required: true,
            options: [
              "keynote",
              "panel",
              "interview",
              "podcast",
              "press",
              "webinar",
              "workshop",
            ],
          },
          {
            type: "string",
            name: "organisation",
            label: "Organisation",
            description: "Hosting body or publication.",
          },
          {
            type: "string",
            name: "location",
            label: "Location",
            description: "City, country, or 'virtual'.",
          },
          ...heroImageGroup,
          {
            type: "string",
            name: "recordingUrl",
            label: "Recording URL",
            description: "Link to the published recording, if any.",
          },
          {
            type: "string",
            name: "slidesUrl",
            label: "Slides URL",
            description: "Link to the published slide deck, if any.",
          },
          tagsField(TAG_OPTIONS),
          canonicalField,
          seoTitleField,
          seoDescriptionField,
          featuredField,
          draftField,
          bodyField,
        ],
      },

      // ── Author profile ──────────────────────────────────────────────
      // Single-author brand surface. The brand profile lives in
      // src/content/authors/en/default.md. The headlineStats array
      // drives the credibility strip on the editorial hero and the about
      // page. Keep this collection at format: "md" to match existing
      // files; switch to "mdx" only if you need components inside.
      // The router points at /authors/<slug>/, which has no Astro
      // detail page yet — "View on site" will 404 until
      // src/pages/authors/[slug].astro is added.
      // Note: `post.authors` is currently locked to ["default"] in
      // the post collection above. Adding new author files here
      // without also expanding the post's options list will leave the
      // new author unreferenceable from posts; pick one and update
      // both ends together.
      {
        name: "author",
        label: "Author profile",
        path: "src/content/authors/en",
        format: "md",
        ui: {
          router: ({ document }) => `/authors/${document._sys.filename}/`,
          filename: { slugify: slugifyTitle },
        },
        fields: [
          {
            type: "string",
            name: "name",
            label: "Name",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "slug",
            label: "Slug",
            description:
              "Identity slug used to reference this author from posts. Defaults to 'default' for the brand profile.",
          },
          {
            type: "string",
            name: "role",
            label: "Role",
            description:
              "One-line role (e.g. 'Independent International Consultant').",
          },
          {
            type: "string",
            name: "tagline",
            label: "Tagline",
            description: "Positioning line shown on the editorial hero.",
          },
          {
            type: "string",
            name: "location",
            label: "Location",
          },
          {
            type: "string",
            name: "bio",
            label: "Bio",
            description: "Short bio paragraph (plain text).",
            ui: { component: "textarea" },
          },
          {
            type: "image",
            name: "avatar",
            label: "Avatar",
          },
          {
            type: "number",
            name: "avatarWidth",
            label: "Avatar width",
          },
          {
            type: "number",
            name: "avatarHeight",
            label: "Avatar height",
          },
          {
            type: "string",
            name: "githubUsername",
            label: "GitHub username",
          },
          {
            type: "object",
            name: "headlineStats",
            label: "Credibility strip stats",
            list: true,
            description:
              "Four at-a-glance stats for the editorial hero and about page. Keep four entries for the strip to render evenly.",
            fields: [
              {
                type: "string",
                name: "value",
                label: "Value",
                required: true,
                description: "Big-number headline. Keep under 16 chars.",
              },
              {
                type: "string",
                name: "label",
                label: "Label",
                required: true,
                description: "Eyebrow-style caption. Keep under 40 chars.",
              },
            ],
          },
          {
            type: "object",
            name: "socials",
            label: "Social links",
            list: true,
            fields: [
              {
                type: "string",
                name: "label",
                label: "Label",
                required: true,
              },
              {
                type: "string",
                name: "url",
                label: "URL",
                required: true,
                description:
                  "Use a full URL (https://…), a mailto: link, or a path that starts with /. The site won't build otherwise.",
              },
            ],
          },
          {
            type: "object",
            name: "organisations",
            label: "Organisations",
            list: true,
            fields: [
              {
                type: "string",
                name: "name",
                label: "Name",
                required: true,
              },
              {
                type: "string",
                name: "url",
                label: "URL",
                description:
                  "Optional. Must be an absolute URL or a root-relative path that starts with / if provided.",
              },
            ],
          },
          draftField,
          bodyField,
        ],
      },
    ],
  },
});
