# Development Guide

This repository contains a small Astro portfolio focused on two projects: SportsOpp and WakaTime.

## Run and build

```sh
npm install
npm run dev
npm run build
```

The development server runs at `http://localhost:4321`. Astro writes the static site to `dist/`.

## Structure

- `src/pages/index.astro` is the portfolio home page.
- `src/pages/projects/[slug].astro` renders the static case-study pages.
- `src/data/projects.ts` holds project summaries, technology lists, and dated timeline entries.
- `src/layouts/BaseLayout.astro` provides shared page metadata and navigation.
- `src/styles/global.css` contains the site styles and responsive layouts.
- `public/projects/` is reserved for project media.

## Updating project histories

The project knowledge folders are the source of truth for updates. Before adding or amending a public timeline entry, review the relevant project's changelog and context notes. Summarize verified milestones in `src/data/projects.ts`; do not copy the private working notes or add undated claims to the portfolio.

## Hosting

`astro.config.mjs` sets the canonical site URL for the CinHaus-hosted portfolio. Keep that value aligned with the production domain.
