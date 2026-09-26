# Nicholas Jansen van Rensburg

A minimal portfolio about two ongoing projects: **SportsOpp**, a multi-sport athlete-discovery platform, and **WakaTime**, an NFC alarm app. Each project has its own case study and dated timeline.

## Run locally

```sh
npm install
npm run dev
```

Astro serves the site at `http://localhost:4321`. Build the static site with `npm run build`.

## Project histories

The case-study content lives in [src/data/projects.ts](src/data/projects.ts). Before changing a project's timeline, check its project changelog and context notes in the corresponding project knowledge folder. Keep the site timeline as a concise, dated summary; the project folders remain the source of truth.

## Contact

- [Email](mailto:nicholas241cut@gmail.com)
- [GitHub](https://github.com/nicholasjvr)

---

<sub>**Dev note — embeds & fullscreen:** every iframe embed (project demos, games) gets a
mobile-friendly fullscreen mode via a shared convention: add `data-fs-root` /
`data-fs-toggle` / `data-fs-frames` markup and call `initFullscreen()` from
[`src/lib/fullscreen.ts`](src/lib/fullscreen.ts) — full recipe in that module's header.
No per-component fullscreen code.</sub>
