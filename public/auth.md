# auth.md - Blog Agent Authentication

Blog publishes public editorial pages and machine-readable discovery files.
All content is freely accessible — no authentication, no payment, no
registration.

## Current Access Model

- Public pages do not require account authentication.
- No paid API endpoints are offered. The `/api` and `/api/v1` paths that
  appear in older discovery files (api-catalog, oauth-authorization-server,
  openid-configuration, openapi.json) are **not implemented** in the current
  deployment. Requests to those paths return HTTP 404 from the static
  asset bundle.
- No pre-registration is required for public content discovery.
- The optional x402 payment gateway is **disabled** by default. The
  Cloudflare Worker configuration ships with `X402_ENABLED=false`, so
  every request — including those matching the legacy protected patterns
  in `wrangler.jsonc` — is served directly from the static asset bundle
  with no `payment-required` challenge.

## Agent Registration

Blog accepts anonymous agent discovery for all public content. No human
account, dashboard account, or pre-registration is required.

Agents that require a registration document can use this file as the
registration entrypoint.

- Registration endpoint: `https://blog.zbz.ai/auth.md`
- `register_uri`: `https://blog.zbz.ai/auth.md`

`agent_auth` metadata:

```json
{
  "skill": "https://blog.zbz.ai/auth.md",
  "register_uri": "https://blog.zbz.ai/auth.md",
  "claim_uri": "https://blog.zbz.ai/llms.txt",
  "revocation_uri": "https://blog.zbz.ai/auth.md#revocation-uri",
  "identity_types_supported": ["anonymous"],
  "anonymous": {
    "credential_types_supported": []
  },
  "events_supported": []
}
```

Supported identity types:

- `anonymous`

Supported credential types:

- (none — all public content is freely accessible)

Credential claim URI:

- `https://blog.zbz.ai/llms.txt` — the canonical public content index

Revocation URI:

- Not applicable. Blog does not issue persistent bearer credentials.
- `revocation_uri`: `https://blog.zbz.ai/auth.md#revocation-uri`

Registration method:

- `POST /agent/auth`: Not available. Blog does not create user accounts
  or issue persistent API keys.
- All public content is accessible without any registration step.

## Content Discovery Endpoints

| Path | Purpose |
|---|---|
| `/.well-known/agent-card.json` | Canonical agent-facing capability card |
| `/llms.txt` | Curated public post index for LLMs |
| `/llms-full.txt` | Complete public post index for LLMs |
| `/rss.xml` | RSS feed |
| `/sitemap-index.xml` | Crawlable HTML URL index |
| `/openapi.json` | Static OpenAPI description (currently empty — no API) |
| `/api` · `/api/v1` | Not implemented — return HTTP 404 |

How agents discover content:

1. Fetch `/.well-known/agent-card.json` for the canonical capability card.
2. Fetch `/llms.txt` for the curated post index.
3. Fetch `/sitemap-index.xml` for the full list of crawlable HTML URLs.
4. Fetch the desired page directly. All pages return HTTP 200 with no
   authentication required.

## Markdown on Demand

Agents that prefer Markdown over HTML can request any page with
`Accept: text/markdown`. The response is a YAML frontmatter block followed
by a Markdown rendering of the page content. The `Content-Type` response
header is `text/markdown; charset=utf-8` and the `x-markdown-tokens`
header reports the approximate token count.

## OAuth and OIDC Discovery

Blog publishes static OAuth/OIDC discovery metadata so agents can
distinguish OAuth discovery from payment discovery. The current public
deployment does not issue bearer tokens for content access.

Well-known metadata links:

- OAuth Protected Resource Metadata: `https://blog.zbz.ai/.well-known/oauth-protected-resource`
- OAuth Authorization Server Metadata: `https://blog.zbz.ai/.well-known/oauth-authorization-server`
- OpenID Connect Discovery: `https://blog.zbz.ai/.well-known/openid-configuration`

Note: the OAuth/OIDC endpoints are published for discovery compatibility
only. The current deployment does not issue tokens, and the `x402.pay`
scope referenced in those discovery files is not active.
