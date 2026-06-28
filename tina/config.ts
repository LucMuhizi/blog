import { defineConfig } from "tinacms";

// Branch Tina commits to. Read from the host platform's env if present,
// otherwise default to `main` (matches this repo's production branch).
const branch =
  process.env.GITHUB_BRANCH ??
  process.env.VERCEL_GIT_COMMIT_REF ??
  process.env.HEAD ??
  "main";

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
    // Currently modeling the `post` collection only. The other Astro
    // collections (page, project, speaking, author) follow the same
    // pattern — see tina/README.md for the template.
    collections: [
      {
        name: "post",
        label: "Posts",
        path: "src/content/posts/en",
        format: "mdx",
        ui: {
          // "View on site" button target in the editor.
          router: ({ document }) => `/posts/${document._sys.filename}/`,
          // New-file naming. Existing files keep their on-disk names.
          filename: {
            slugify: (values) => {
              const title =
                (values?.title as string | undefined)?.trim() || "untitled";
              return title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 80);
            },
          },
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
          {
            type: "datetime",
            name: "pubDate",
            label: "Publication date",
            required: true,
            ui: { dateFormat: "YYYY-MM-DD" },
          },
          {
            type: "datetime",
            name: "updatedDate",
            label: "Last updated",
            description:
              "Fill in only if the article was substantially revised after first publication.",
            ui: { dateFormat: "YYYY-MM-DD" },
          },
          {
            type: "image",
            name: "heroImage",
            label: "Cover image",
            required: true,
            description: "Recommended size 1200×630 px.",
          },
          {
            type: "string",
            name: "heroImageAlt",
            label: "Cover image alt text",
            required: true,
            description: "Describe the image for screen readers and SEO.",
          },
          {
            type: "number",
            name: "heroImageWidth",
            label: "Cover image width",
            description: "Required for remote (URL) cover images.",
          },
          {
            type: "number",
            name: "heroImageHeight",
            label: "Cover image height",
            description: "Required for remote (URL) cover images.",
          },
          {
            type: "string",
            name: "category",
            label: "Category",
            required: true,
            options: [
              "articles",
              "research",
              "policy",
              "projects",
              "speaking",
              "notes",
            ],
          },
          {
            type: "string",
            name: "tags",
            label: "Tags",
            list: true,
            options: [
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
              "strategy",
              "leadership",
              "innovation",
              "reflect",
            ],
            ui: { component: "tags" },
          },
          {
            type: "string",
            name: "authors",
            label: "Author",
            list: true,
            options: ["default"],
            description:
              "Select the author. Defaults to the brand profile when left empty.",
          },
          {
            type: "string",
            name: "seoTitle",
            label: "SEO title",
            description: "Custom <title> tag. Max 60 characters.",
          },
          {
            type: "string",
            name: "seoDescription",
            label: "SEO description",
            description: "Custom meta description. Max 160 characters.",
            ui: { component: "textarea" },
          },
          {
            type: "string",
            name: "canonical",
            label: "Canonical URL",
            description:
              "Set only if this content was originally published elsewhere (e.g. Medium).",
          },
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
            description: "Approximate reading time. Leave blank to auto-calculate.",
          },
          {
            type: "boolean",
            name: "draft",
            label: "Draft (hidden from site)",
            description:
              "Turn off to publish. While on, the article is invisible to visitors.",
          },
          {
            type: "boolean",
            name: "featured",
            label: "Featured on homepage",
            description:
              "Pins this article to the Featured Research section on the homepage.",
          },
          {
            type: "rich-text",
            name: "body",
            label: "Content",
            isBody: true,
          },
        ],
      },
    ],
  },
});
