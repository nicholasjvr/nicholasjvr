import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

// Update this once the site has a real domain.
const SITE = 'https://nicholasjvr.dev';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  // Static-first: builds anywhere (Vercel / Netlify / GH Pages). GitHub data is
  // fetched at build time (see src/lib/github.ts) so each deploy stays fresh.
  output: 'static',
  // sitemap re-added in v1.1 once configured to skip the JSON endpoint route.
  integrations: [tailwind(), mdx()],
});
