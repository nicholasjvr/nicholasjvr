# nicholasjvr — portfolio

A data-driven portfolio that showcases each project as a **case study**
(objective → approach → skills used → outcome) and stays **in lockstep with my
GitHub profile**. Built with Astro + Tailwind, static-first.

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
