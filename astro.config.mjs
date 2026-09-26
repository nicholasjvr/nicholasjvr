import { defineConfig } from "astro/config";

// Developer profile on CinHaus: nicholas.cinhaus.co.za (GitHub Pages custom domain).
// public/CNAME must match; GoDaddy CNAME nicholas → nicholasjvr.github.io.
const SITE = "https://nicholas.cinhaus.co.za";

// https://astro.build/config
export default defineConfig({
  site: SITE,
  // Static-first: builds anywhere (Vercel / Netlify / GH Pages). GitHub data is
  // fetched at build time (see src/lib/github.ts) so each deploy stays fresh.
  output: "static",
});
