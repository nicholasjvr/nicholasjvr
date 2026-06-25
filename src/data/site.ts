// Shared site metadata. Keep copy in sync across layout, hero, footer, and README.
//
// Interim: GitHub Pages at nicholasjvr.github.io/nicholasjvr (see astro.config.mjs base).
// When nicholasjvr.co.za is live: update domain/url, remove base in astro.config.mjs,
// restore public/CNAME from public/CNAME.example.
export const SITE = {
  domain: 'nicholasjvr.github.io/nicholasjvr',
  url: 'https://nicholasjvr.github.io/nicholasjvr/',
  name: 'Nicholas van Rensburg',
  title: 'Nicholas van Rensburg · Side Projects',
  description:
    'A personal portfolio of side projects, experiments, and things built outside of work.',
  tagline: 'Side projects and experiments, documented.',
  role: 'Side Projects Portfolio',
  email: 'nicholas241cut@gmail.com',
} as const;
