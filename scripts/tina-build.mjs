#!/usr/bin/env node
// Build wrapper for `tinacms build`.
//
// TinaCMS requires `TINA_CLIENT_ID` and `TINA_TOKEN` at build time
// because the CLI embeds them into the generated admin client bundle
// (so the editor knows which Tina Cloud project to authenticate
// against). It also calls Tina Cloud's API to validate the project
// state — that call is the part that 403s in a stuck project state
// (e.g. "Branch 'main' is not on TinaCloud" before the first
// successful `tinacms dev` run has registered the branch).
//
// We pass `--skip-cloud-checks --skip-indexing --skip-search-index` to
// bypass those API calls. The env vars are still read and embedded in
// the client bundle, so the generated admin still authenticates
// against the correct Tina Cloud project at runtime. Skipping the
// checks only avoids the pre-build validation, not the runtime
// auth/data flow.
//
// Cases:
//
//   1. Production build (Cloudflare Pages / CI): the env vars are
//      set on the project. We run `tinacms build` (with
//      `--skip-cloud-checks`) to generate the static admin bundle
//      into `public/admin/` and continue. Cloud-side validation runs
//      at request time, not at build time.
//
//   2. Local build without Tina Cloud wired up: the env vars are not
//      set. There is no point building an admin bundle that cannot
//      connect to Tina Cloud, so we skip the Tina build and let the
//      rest of the pipeline (`astro check && astro build`) proceed.
//      The site still ships — only the `/admin/` route is missing.
//      Set the env vars in a local `.env` (gitignored) to get the
//      admin UI in dev.

import { spawnSync } from "node:child_process";

const hasClientId = Boolean(process.env.TINA_CLIENT_ID);
const hasToken = Boolean(process.env.TINA_TOKEN);

if (!hasClientId || !hasToken) {
  console.warn(
    "[tina-build] TINA_CLIENT_ID and/or TINA_TOKEN are not set.\n" +
      "[tina-build] Skipping the Tina admin build; the /admin/ bundle\n" +
      "[tina-build] will not be generated for this build. The site\n" +
      "[tina-build] itself still ships. Set the env vars in .env\n" +
      "[tina-build] (gitignored) — see tina/README.md."
  );
  process.exit(0);
}

// Use `pnpm exec` rather than `npx` so the local `@tinacms/cli`
// (installed under pnpm's symlink layout) is found reliably. Plain
// `npx` doesn't always resolve pnpm's `.bin` shims from a child Node
// process, which previously caused this wrapper to exit 1 with no
// output.
const result = spawnSync(
  "pnpm",
  [
    "exec",
    "tinacms",
    "build",
    "--skip-cloud-checks",
    "--skip-indexing",
    "--skip-search-index",
  ],
  { stdio: "inherit", env: process.env, shell: process.platform === "win32" }
);

if (result.error) {
  console.error(
    `[tina-build] Failed to spawn tinacms build: ${result.error.message}\n` +
      `[tina-build] Is pnpm on PATH?`
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
