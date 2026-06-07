// Shared site metadata — keep copy in sync across layout, hero, footer, and README.
//
// Interim: GitHub Pages at nicholasjvr.github.io/nicholasjvr (see astro.config.mjs base).
// When nicholasjvr.co.za is live: update domain/url, remove base in astro.config.mjs,
// restore public/CNAME from public/CNAME.example.
export const SITE = {
  domain: 'nicholasjvr.github.io/nicholasjvr',
  url: 'https://nicholasjvr.github.io/nicholasjvr/',
  name: 'Nicholas',
  title: 'Nicholas — Portfolio',
  description:
    'Portfolio of Nicholas — software & ML builder. Case studies in applied machine learning, real-time dashboards, and AI companions.',
  tagline: 'Software & ML builder — data-to-decision systems, end to end.',
  email: 'nicholas241cut@gmail.com',
} as const;
