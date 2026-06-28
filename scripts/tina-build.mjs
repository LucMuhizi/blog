#!/usr/bin/env node
// Build wrapper for `tinacms build`.
//
// TinaCMS validates `TINA_CLIENT_ID` and `TINA_TOKEN` at build time and
// refuses to build if either is missing. There are two cases:
//
//   1. Production build (Cloudflare Pages / CI): the env vars are set
//      on the project. We run `tinacms build` to generate the static
//      admin bundle into `public/admin/` and continue.
//
//   2. Local build without Tina Cloud wired up: the env vars are not
//      set. There is no point building an admin bundle that cannot
//      connect to Tina Cloud, so we skip the Tina build and let the
//      rest of the pipeline (`astro check && astro build`) proceed.
//      The site still ships — only the `/admin/` route is missing.
//      Set the env vars in a local `.env` (gitignored) or run
//      `pnpm dev` to get the admin UI in dev.

import { spawnSync } from "node:child_process";

const hasClientId = Boolean(process.env.TINA_CLIENT_ID);
const hasToken = Boolean(process.env.TINA_TOKEN);

if (!hasClientId || !hasToken) {
  console.warn(
    "[tina-build] TINA_CLIENT_ID and/or TINA_TOKEN are not set.\n" +
      "[tina-build] Skipping the Tina admin build; the /admin/ bundle\n" +
      "[tina-build] will not be generated for this build. The site\n" +
      "[tina-build] itself still ships.\n" +
      "[tina-build] To build the admin bundle locally, set the env\n" +
      "[tina-build] vars in .env (gitignored) — see tina/README.md.\n" +
      "[tina-build] Cloudflare Pages production builds include /admin/\n" +
      "[tina-build] automatically because the env vars are set there."
  );
  process.exit(0);
}

const result = spawnSync("npx", ["tinacms", "build"], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
