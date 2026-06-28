# Nite Tanzarn / IntellectNest 中文说明

[English README](README.md)

Nite Tanzarn / IntellectNest 是一个单人作者个人专业品牌：独立国际咨询、研究与建议工作，致力于推进结构性公平（structural equity）。平台基于 Astro 7 构建，采用「**暖色编辑型设计系统**」，静态优先。

站点默认无数据库、无私有服务、无统计账号、无广告账号、无钱包、无 Cloudflare 凭据即可运行；普通静态托管即可上线。可选集成（Pagefind 全文搜索、RSS、站点地图、Astro 视图过渡、Cloudflare Workers Static Assets、可选 Google Tag Manager、可选 Google AdSense、可选 x402 元数据）在不改变静态产物的前提下叠加进来。

## 评分

| Lighthouse | Agent Readiness |
| --- | --- |
| [![Blog Lighthouse 评分](public/lighthouse-score---https---blog-zbz-ai.svg)](https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fblog.zbz.ai%2F) | [![Blog Agent Readiness 评分](public/agent-readiness-https---blog-zbz-ai.avif)](https://isitagentready.com/blog.zbz.ai) |

## 设计系统

视觉识别是一套**暖色编辑型调色板**，提供两种主题：

- **暖色亮色** — 米色背景（`oklch(0.97 0.012 80)` ≈ `#FAF6EE`）、墨绿墨色（`oklch(0.32 0.045 200)` ≈ `#16484A`）、克制的棕金点缀（`oklch(0.55 0.060 75)` ≈ `#9A7E3F`）。
- **暖色暗色** — 暖黑色背景（`oklch(0.16 0.012 70)` ≈ `#100E0A`）、奶油色前景（`oklch(0.94 0.018 80)` ≈ `#F4ECD8`）、**沙金点缀（`#C9B99A`）** —— 这是视觉签名。

两种主题共有：

- **0.5px 细线边框。** 卡片、chip、分割线、归档行、信用栏都使用 `border: 0.5px solid var(--hairline)`。玻璃模糊和 1px 实线边框已从正式 UI 中退役。
- **衬线大字标题 + 衬线正文。** 标题使用系统衬线字体堆栈（`ui-serif, "Iowan Old Style", Georgia, "Apple Garamond", Cambria, "Times New Roman", Times, serif`）；正文 1.0625rem / 1.75 行高。无衬线保留给导航、chip、eyebrow、按钮和归档行。不加载任何 Web Font。
- **信用栏（CredibilityStrip）**。四条数字一行（如 `30+ Years of practice`、`40+ Countries engaged`、`120+ Essays & reports`、`18 UN agencies advised`），数据来源是 `src/content/authors/en/default.md` 中的 `headlineStats` frontmatter。它出现在首页编辑型 hero 和 `/about/` 页面。
- **卡片原语。** 矩形（8–10px 圆角、0.5px 细线边框）的文章卡片、服务卡片、个人介绍卡片。编辑型 hero 与文章头部面板刻意采用 0 圆角 —— 印刷感而非 CSS 质感。

`DESIGN.md` 是设计与规则的源头；`src/styles/global.css` 是运行时主题实现。

## 特性

- 🧱 静态优先的 Astro 7 架构，无强制依赖 CMS、数据库或私有运行时服务。
- 🎨 暖色编辑型设计系统：色相位移的 OKLCH 暖色亮 / 暗双主题，0.5px 细线边框，衬线大字，沙金点缀。
- 📝 Markdown 和 MDX 内容集合，覆盖文章、页面、作者、分类、标签，由 Astro 的 Satteri 管线处理。
- 🧭 内置 RSS、站点地图、robots.txt、SEO 元数据、JSON-LD 和面向智能体的发现文件。
- 🔎 基于 Pagefind 的静态全文搜索。
- 🖼️ Astro 图片优化，支持响应式布局和现代 AVIF/WebP 输出。
- ✨ Astro 视图过渡 + 客户端 island，包括阅读进度条、分类筛选 chip、移动导航和主题切换器。
- ⚙️ Astro 7 托管后台开发服务器和 JSON 日志命令，便于智能体工作流使用。
- 💻 基于 Expressive Code 的代码高亮，支持明暗主题。
- 📣 可选 Google AdSense 和 Google Tag Manager，GTM 通过 Partytown 加载。
- 💸 可选 x402 付费拦截（静态元数据 + Cloudflare Worker 网关）。**默认关闭，按需开启。**
- 🤖 Agent-Native 发布界面，包含 `llms.txt`、`llms-full.txt`、`openapi.json`、`auth.md`、`robots.txt` 和站点地图。
- 🏷️ 单作者品牌：每篇文章和项目都署名 **Nite Tanzarn**。作者 schema 的
  `headlineStats` 数组驱动一眼概览栏，是品牌数字的唯一事实来源。

## 验证示例

- 生产站点曾在 PageSpeed Insights 实验室测试中达到 Lighthouse 四项 100 分：
  [PageSpeed Insights](https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fblog.zbz.ai%2F)。
- 面向智能体的发布界面按
  [Is Your Site Agent-Ready?](https://isitagentready.com/blog.zbz.ai)
  的可发现性、内容访问、bot 访问、协议发现和商务检查设计。

## 环境要求

- Node.js 24 或更新版本
- pnpm

## 开始

```bash
pnpm install
pnpm dev
```

Astro 会输出本地访问地址。根入口直接提供首页：

```text
http://localhost:4321/
```

## 常用命令

```bash
pnpm dev      # 本地开发
pnpm dev:background # 启动 Astro 托管后台开发服务器
pnpm dev:status     # 查看后台开发服务器状态
pnpm dev:logs       # 查看后台开发服务器日志
pnpm dev:stop       # 停止后台开发服务器
pnpm dev:json       # 以 JSON 日志启动开发服务器
pnpm build    # 运行 astro check 并构建静态产物
pnpm test:upgrade # 验证 Astro 7 升级契约
pnpm preview  # 本地预览构建产物
pnpm deploy   # 构建后通过 Wrangler 部署 dist
```

升级到 Astro 7 后，配置继续保留 `compressHTML: true`，保证现有主题延续
Astro 6 风格的 HTML 空白行为。Astro 7 的 Rust 编译器、队列渲染、Advanced
Routing 和 Satteri Markdown 管线均使用正式默认能力，不再配置 Astro 6
的 `rustCompiler`、`queuedRendering` 实验开关。

## 项目结构

```text
astro.config.mjs                       # Astro、i18n（单语言）、图片、sitemap 和集成配置
src/config/                            # 站点、分类标签、分页和资源配置
src/content/                           # 作者、页面和文章内容
src/pages/                             # 单语言路由和生成端点
src/layouts/main.astro                 # 共享壳、SEO、组件、页头和页脚
src/components/cards/                  # EditorialHero、CredibilityStrip、ProfileCard、ServiceCard、PostCardCover、PostCardText
src/components/features/               # OptimizedPicture、PagefindSearch、ReadingProgressBar、PullQuote
src/components/islands/                # MobileNav、ThemeSwitcher
src/components/lists/                  # PostArchiveList、PostGrid、CategoryChips、taxonomy 网格
src/components/layout/                 # PageHeader、PageSection、ProseContent
src/components/navigation/             # Pagination、TableOfContents
src/components/ui/                     # Header、Footer、Icon、NotFoundContent
src/content.config.ts                  # Zod schema（post、page、project、speaking、author 含 headlineStats）
src/styles/global.css                  # 运行时 Tailwind v4 主题 + 编辑组件 CSS
src/styles/design-theme.css            # 从 DESIGN.md 生成的令牌参考
DESIGN.md                              # 视觉令牌和 UI 规则
```

## 路由

站点为**单英文语言**。公开路由没有语言前缀，`/` 即规范首页。Astro 的
`trailingSlash: "always"` 配置不变，并以 locale 元数据保持一致。

```text
/
/about/
/contact/
/services/
/posts/
/posts/<slug>/
/search/
/rss.xml
```

## 写内容

内容位于 `src/content`，平台仍是单英文语言，因此文件嵌套在 `en/` 子目录下：

```text
src/content/
  authors/en/default.md
  pages/en/about.mdx
  posts/en/20260521-the-tax-you-cannot-escape.mdx
```

唯一的作者档案 `default.md` 驱动信用栏：

```yaml
---
slug: default
name: "Nite Tanzarn"
role: "Independent International Consultant"
tagline: "Advancing Agency, Authority, and Architecture for structural equity."
location: "Mbuya, Kampala, Uganda"
headlineStats:
  - { value: "30+", label: "Years of practice" }
  - { value: "40+", label: "Countries engaged" }
  - { value: "120+", label: "Essays & reports" }
  - { value: "18", label: "UN agencies advised" }
bio: "Independent International Consultant, advocate for women's rights, gender equality researcher, and devoted parent."
socials:
  - { label: "Email", url: "mailto:info@nitetanzarn.com" }
draft: false
---
```

`headlineStats` 是品牌「一眼概览」数字的**唯一事实来源**，首页
编辑型 hero 和 `/about/` 页的 at-a-glance 区块都从这里读取。

文章 frontmatter：

```yaml
---
title: "The tax you cannot escape"
description: "Consumption, survival, and the taxation of everyday life."
category: "policy"
tags: ["reflect"]
pubDate: 2026-05-21
authors: ["default"]
heroImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f"
heroImageAlt: "Cover for The Tax You Cannot Escape"
heroImageWidth: 1600
heroImageHeight: 1067
readingTime: 5
viewCount: 1240
pdfDownload: "https://example.com/the-tax-you-cannot-escape.pdf"
draft: false
featured: true
---
```

可选 SEO 字段：

```yaml
seoTitle: "Custom title"
seoDescription: "Custom meta description."
canonical: "https://example.com/original/"
heroBlurDataURL: "data:image/..."
```

远程 `heroImage` 必须同时填写 `heroImageWidth` 和 `heroImageHeight`。远程图片域名限制为 Unsplash 和可选的 `PUBLIC_ASSET_BASE_URL` 域名。更换图床时，需要在 `src/config/site.ts` 中同步放行新的 HTTPS 图片域名：

```js
assets: {
  publicBaseUrl: publicAssetBaseUrl,
  remotePatterns: [
    ...(publicAssetHost
      ? [{ protocol: "https", hostname: publicAssetHost }]
      : []),
    { protocol: "https", hostname: "*.unsplash.com" },
    { protocol: "https", hostname: "*.zbz.ai" },
  ],
}
```

根据内容图片实际使用的域名增删这些条目。

## 配置

多数用户只需要修改 `src/config/site.ts`：

```text
src/config/site.ts       # 站点名、域名、描述、仓库、社交链接、服务、首页、资源、统计、广告、x402
src/config/taxonomy.ts   # 分类、标签、多语言名称、slug 工具
src/config/pagination.ts # 分页数量
src/config/assets.ts     # 远程图片域名检查和 URL 工具
src/i18n/en.json         # 界面语言文案（目前只有英文）
```

`SITE_CONFIG.services` 数组是第二处用户配置面。它驱动首页「Engagements
and frameworks」行与独立 `/services/` 页面。根据实际承接的服务修改
默认四条（Research & Fieldwork、Policy Advisory、Training & Convening、
Consultancy）。

环境变量是可选的部署覆盖项，适合不同环境使用不同域名或第三方服务：

```bash
PUBLIC_SITE_URL=https://example.com
PUBLIC_ASSET_BASE_URL=https://assets.example.com
```

可选集成默认关闭：

```bash
PUBLIC_GTM_ENABLED=true
PUBLIC_GTM_ID=GTM-XXXXXXX

PUBLIC_ADSENSE_ENABLED=true
PUBLIC_ADSENSE_CLIENT_ID=ca-pub-0000000000000000

PUBLIC_X402_ENABLED=true
PUBLIC_X402_PAY_TO=YourWalletAddress
PUBLIC_X402_NETWORK=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
PUBLIC_X402_PRICE=$0.08
PUBLIC_X402_DESCRIPTION=Voluntary x402 payment support for Blog content.
PUBLIC_X402_FACILITATOR_URL=https://x402.org/facilitator
PUBLIC_X402_CHARGE_MODE=all
PUBLIC_X402_BOT_SCORE_THRESHOLD=30
```

`PUBLIC_X402_CHARGE_MODE` 支持 `all` 和 `bot-only`。x402 组件只发布元数据，不执行 HTTP 402 支付拦截。

## 可选 x402 网关

> **本站 x402 默认关闭**，所有公开内容对匿名读者均免费开放。x402 支付
> 中间件仅在显式设置下方运行时变量后才会激活，按需启用即可。

默认构建仍是静态站，普通静态托管照常可用。真正执行 x402 收费需要运行时适配器，在返回静态资源之前先返回 `402 Payment Required`。

仓库内置了可选的 Cloudflare Workers 适配器：

```text
src/x402/cloudflare-worker.ts
```

适配器随仓库一起发布，但默认处于未激活状态。启用前需要将运行时标志改为 `"true"`：

```bash
X402_ENABLED=false
```

在 Cloudflare Workers Static Assets 上启用时，在 Wrangler 或 Cloudflare 后台设置运行时变量：

```bash
X402_ENABLED=true
X402_PAY_TO=YourWalletAddress
X402_NETWORK=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
X402_PRICE=$0.08
X402_FACILITATOR_URL=https://x402.org/facilitator
X402_BOT_ONLY=true
X402_BOT_SCORE_THRESHOLD=30
```

`X402_PAY_TO` 设为运行时 Secret，其他值设为运行时变量。`x402.org`
facilitator 当前公布的 Solana 支持网络是
`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`。更换 facilitator 时，
`X402_NETWORK` 必须使用该 facilitator 的 `/supported` 接口返回的网络值。

Cloudflare 部署时，`/api`、`/api/v1` 和文章页会进入适配器。启用网关后，API 探测路由始终要求支付；文章页在 `X402_BOT_ONLY=true` 时只对 bot 收费。不支持运行时适配器的平台仍可发布静态站和可选 x402 元数据，但不能执行支付拦截。

生产部署验证命令：

```bash
curl -i https://your-domain.example/api
curl -i https://your-domain.example/api/v1
```

网关启用后，两条请求都返回 `402 Payment Required`，并带有
`payment-required` 响应头。本站点生产环境已在
`https://blog.zbz.ai/api` 和
`https://blog.zbz.ai/api/v1` 验证通过。

## Agent API 发现

平台发布静态 API 发现文件，供智能体自动读取：

- `/.well-known/api-catalog` 发布 RFC 9727 API Catalog，包含 `/api` 和
  `/api/v1` 的 linkset 条目。
- `/openapi.json` 描述（当前关闭的）受 x402 保护的 API 探测端点。
- `/auth.md` 说明智能体访问契约：免费、无需身份验证、无需注册、不要求
  支付。
- `/.well-known/oauth-authorization-server`、
  `/.well-known/openid-configuration` 和
  `/.well-known/oauth-protected-resource` 为需要 OAuth/OIDC 文档的智能体
  发布发现元数据。

x402 默认关闭，所以当前公开访问路径对匿名读者完全免费。静态 OAuth/OIDC
文件仅作为发现元数据；本仓库默认不签发 bearer token，也不管理用户账号。
如需启用付费 API 拦截，按 `## 可选 x402 网关` 一节设置运行时变量即可。

通过 Worker 适配器部署时，带有 `Accept: text/markdown` 的请求会收到 Markdown 表示，响应包含 `Content-Type: text/markdown` 和 `x-markdown-tokens`。浏览器请求继续返回正常 HTML。

## 设计

`DESIGN.md` 记录暖色编辑调色板、细线边框系统、衬线 / 无衬线分配以及编辑组件规则。运行时主题在 `src/styles/global.css`。新增或修改 UI 必须先读 `DESIGN.md`，并使用现有 CSS 变量（`var(--foreground)`、`var(--surface-flat)`、`var(--hairline)`、`var(--gold)`、`var(--card-foreground)` 等），不要写死十六进制颜色。新增图标时，需要同步更新 `astro.config.mjs` 和 `src/components/ui/Icon.astro`（图标名字面量也是 TypeScript 类型联合的成员）。

## 开发流程

开发只使用仓库文档、GitHub Issues 和 GitHub Projects。飞书、Lark、Meegle、飞书项目和飞书知识库不再作为 Nite Tanzarn / IntellectNest 的开发工具。

- 文档来源：`AGENTS.md`、`DESIGN.md`、本文件（`readme-zh.md`）、
  `README.md` 和 `docs/`。
- GitHub Issues 是 bug、功能和任务的唯一事实来源。
- GitHub Projects 用于状态、优先级、顺序和交付跟踪。
- 非简单修改采用 Spec-Driven Development：在编码前或编码同时写清
  issue、验收标准、实现说明和验证命令。
- 有意义的 commit、pull request 或最终交接说明引用对应 issue。

## 搜索和 SEO

Pagefind 由 `src/integrations/pagefind.ts` 在构建阶段生成。当前索引范围包含 about 页面和文章详情页。`src/layouts/main.astro` 使用 `astro-seo` 输出标准 SEO 元数据，项目自有 JSON-LD 生成保留在 `src/utils/structured-data.ts`。

## 部署

构建产物位于 `dist`。

```bash
pnpm build
```

可以发布到任意静态托管平台，包括 Cloudflare Pages、Vercel、Netlify、GitHub Pages 或普通 Web 服务器。项目还保留了可选的 Workers Static Assets 部署方式：

```bash
pnpm deploy
```

## 反馈

疑问、建议和 bug 反馈请提交到
[GitHub Issues](https://github.com/LucMuhizi/blog/issues)。

## 许可证

MIT。详见 [LICENSE](LICENSE)。
