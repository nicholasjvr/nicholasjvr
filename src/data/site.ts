// Shared site metadata. Keep copy in sync across layout, hero, footer, and README.
//
// Interim: GitHub Pages at nicholasjvr.github.io/nicholasjvr (see astro.config.mjs base).
// When nicholasjvr.co.za is live: update domain/url, remove base in astro.config.mjs,
// restore public/CNAME from public/CNAME.example.
export const SITE = {
  domain: 'nicholasjvr.github.io/nicholasjvr',
  url: 'https://nicholasjvr.github.io/nicholasjvr/',
  name: 'Nicholas van Rensburg',
  title: 'Nicholas van Rensburg · Fullstack JavaScript Developer',
  description:
    'Fullstack JavaScript developer. I build software, systems, automations, and products that are uniquely yours.',
  tagline: "If it sounds remotely possible, I'll probably build it.",
  role: 'Fullstack JavaScript Developer',
  email: 'nicholas241cut@gmail.com',
} as const;
