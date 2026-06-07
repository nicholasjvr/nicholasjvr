import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";

// Interim GitHub Pages (repo nicholasjvr/nicholasjvr → /nicholasjvr/ path).
// When nicholasjvr.co.za is live: set site to https://nicholasjvr.co.za, remove base,
// restore public/CNAME from public/CNAME.example.
const SITE = "https://nicholasjvr.github.io";
const BASE = "/nicholasjvr";

// https://astro.build/config
export default defineConfig({
  site: SITE,
  base: BASE,
  // Static-first: builds anywhere (Vercel / Netlify / GH Pages). GitHub data is
  // fetched at build time (see src/lib/github.ts) so each deploy stays fresh.
  output: "static",
  // sitemap re-added in v1.1 once configured to skip the JSON endpoint route.
  integrations: [tailwind(), mdx()],
});
