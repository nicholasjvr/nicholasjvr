# nicholasjvr — portfolio

A data-driven portfolio that showcases each project as a **case study**
(objective → approach → skills used → outcome) and stays **in lockstep with my
GitHub profile**. Built with Astro + Tailwind, static-first.

## Tech stack

### Core

| Layer | What |
| --- | --- |
| **Framework** | [Astro 4](https://astro.build) — static output (`output: 'static'`) |
| **Language** | TypeScript (strict, `@/*` path alias) |
| **Package manager** | npm |
| **Build output** | Pre-rendered HTML/CSS/JS in `dist/` |

### UI & styling

| Layer | What |
| --- | --- |
| **CSS** | [Tailwind CSS 3](https://tailwindcss.com) via `@astrojs/tailwind` |
| **Design tokens** | CSS custom properties in `src/styles/global.css` (light default; `[data-theme="neon"]` stubbed for a future dark theme) |
| **Typography** | [Inter](https://fonts.google.com/specimen/Inter) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (Google Fonts) |
| **Components** | `.astro` components only — no React/Vue/Svelte on this site |
| **Client JS** | Vanilla `<script>` islands (scroll reveal, gallery lightbox, projects skill filter) |

### Content & data model

| Layer | What |
| --- | --- |
| **Case studies** | MDX files in `src/content/projects/` via `@astrojs/mdx` |
| **Schema** | Astro Content Collections + [Zod](https://zod.dev) (`src/content/config.ts`) — invalid frontmatter fails the build |
| **Skills taxonomy** | Central registry in `src/data/skills.ts` (projects reference skills by `key`) |
| **Static data** | `src/data/about.ts`, `faq.ts`, `featured-repos.ts` |
| **Knowledge corpus** | `src/lib/knowledge.ts` — aggregates curated context for a future portfolio chatbot |

### GitHub integration

| Layer | What |
| --- | --- |
| **API** | GitHub REST API (`/users`, `/repos`) — fetched **at build time** only |
| **Curated repos** | Allowlist in `src/data/featured-repos.ts` (not env-driven) |
| **Auth** | Optional `GITHUB_TOKEN` (fine-grained PAT, build-time / CI secret — never shipped to the browser) |
| **Resilience** | Falls back to `public/github-cache.json` if the live fetch fails |
| **JSON endpoint** | `/api/github.json` — prerendered static snapshot, refreshes on each deploy |

### SEO & metadata

- Canonical URLs via `site` in `astro.config.mjs`
- Open Graph + Twitter card tags in `BaseLayout.astro`
- Placeholder assets: `public/og-image.svg`, `public/favicon.svg`
- `@astrojs/sitemap` is listed in `package.json` but not yet wired in config (planned v1.1)

### Environment variables

Copy `.env.example` → `.env` for local builds; set the same keys as CI/hosting secrets.

| Variable | Required | Purpose |
| --- | --- | --- |
| `PUBLIC_GITHUB_USERNAME` | No (defaults to `nicholasjvr`) | Which GitHub profile to feature |
| `GITHUB_TOKEN` | No | Raises rate limits; required only if a featured repo is **private** |

### Deployment

Static-first — deploy `dist/` to any static host (**Vercel**, **Netlify**, **GitHub Pages**, etc.). No server adapter or runtime required today. GitHub data refreshes automatically on every build/deploy.

## Quick start

```bash
npm install
cp .env.example .env   # optional: add a GITHUB_TOKEN for live, rate-limit-free data
npm run dev            # http://localhost:4321
npm run build          # static output in dist/
```

## How it's organised

Projects are **content entries**, not hardcoded pages. To add a project, drop a
new `.mdx` file into `src/content/projects/` that satisfies the schema in
`src/content/config.ts`. It automatically gets a card on the home/projects grids
and its own case-study page at `/projects/<slug>`.

```
src/
  content/config.ts        ← project schema (the frontmatter contract)
  content/projects/*.mdx   ← one file per project (case study)
  data/skills.ts           ← central skills taxonomy (reference by `key`)
  lib/github.ts            ← live GitHub fetch + cache fallback
  components/              ← Card, SkillMatrix, Gallery, GitHubPanel, ProjectDemo…
  pages/                   ← index, projects/index, projects/[slug], api/github.json
```

### The demo slot (a.k.a. "berserk mode")

Each project has a `demo.kind` field: `screenshots` (today) → `video` → `iframe`
→ `replay`. The detail page switches on it (`components/ProjectDemo.astro`), so
making the TradeBot interactive later is an **additive component, not a rewrite**.

## TODO before going live

- [ ] **Screenshots:** replace the placeholder SVGs in
      `public/projects/tradebot/` with real exports, then (optionally) update the
      `src:` paths in `src/content/projects/tradebot.mdx` to `.png`.
- [ ] **GitHub:** confirm `PUBLIC_GITHUB_USERNAME`; curate which repos show in
      `src/data/featured-repos.ts`. Add a `GITHUB_TOKEN` only if a featured repo
      is **private** — use a **fine-grained PAT scoped to just those repos,
      read-only Metadata** (not a classic `repo`-scope token). Build-time only.
- [ ] **Hero copy / contact:** tweak `components/Hero.astro` and the email in
      `components/Footer.astro` / `pages/index.astro`.
- [ ] Replace `public/og-image.svg` and `public/favicon.svg` with branded assets.
- [ ] Set the real domain in `astro.config.mjs` (`SITE`).

## Themes

The light/professional look is built on CSS custom-property tokens in
`src/styles/global.css`. A dark/neon "TradeBot universe" theme is stubbed under
`[data-theme="neon"]` — switch it on by setting `data-theme` on `<html>`.
