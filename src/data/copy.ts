// Single source of homepage copy. Keep the GitHub profile README in sync with
// these strings (see README.md sections: Hero, About, Projects, Stack, Contact).

export const HERO = {
  name: 'Nicholas van Rensburg',
  role: 'Side Projects Portfolio',
  line: 'Things I build outside of work — apps, tools, automations, and experiments.',
  signatureBefore: 'Mostly for fun.',
  signatureAccent: 'Occasionally useful.',
  ctaPrimary: { label: 'View Projects', href: '#projects' },
  ctaSecondary: { label: 'GitHub', href: 'github' },
} as const;

export const PROJECTS_SECTION = {
  eyebrow: 'Side projects',
  title: "Things I've shipped on my own time.",
} as const;

export const WHAT_I_DO = {
  eyebrow: 'About this site',
  title: 'A personal build log — not a pitch deck.',
  body: 'These are projects I work on after hours: trading tools, automation hacks, SaaS experiments, and whatever problem catches my interest next. Each one has a write-up with the objective, approach, and outcome.',
  pillars: ['Built to learn.', 'Shipped for real.', 'Documented here.'],
} as const;

export const TECH_STACK = {
  eyebrow: 'Stack',
  title: 'What I build with.',
  core: {
    label: 'Core Stack',
    primary: 'JavaScript',
    items: ['Node.js', 'React', 'Next.js', 'TypeScript', 'SQL', 'Zoho'],
  },
  additional: {
    label: 'Additional Tools',
    items: ['Python', 'Azure', 'Firebase', 'Prisma', 'Machine Learning'],
  },
} as const;

export const CONTACT_CTA = {
  title: 'Elsewhere',
  body: 'Source code, issues, and more context live on GitHub. This site is just the highlight reel.',
  cta: { label: 'View on GitHub' },
} as const;
