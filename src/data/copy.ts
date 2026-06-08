// Single source of homepage copy. Keep the GitHub profile README in sync with
// these strings (see README.md sections: Hero, What I Do, How I Work, Selected work,
// Currently, Stack, Contact).

export const HERO = {
  name: 'Nicholas van Rensburg',
  role: 'Fullstack JavaScript Developer',
  line: 'I build software, systems, automations, and products that are uniquely yours.',
  signature: "If it sounds remotely possible, I'll probably build it.",
  ctaPrimary: { label: 'View Projects', href: '#projects' },
  ctaSecondary: { label: 'Get In Touch', href: '#contact' },
} as const;

export const PROJECTS_SECTION = {
  eyebrow: 'Selected work',
  title: 'Three products. Real outcomes.',
} as const;

export const WHAT_I_DO = {
  eyebrow: 'What I Do',
  title: 'I turn ideas into working software, shaped around how you actually operate.',
  body: 'From Zoho ecosystems and internal business tools to fullstack SaaS platforms, dashboards, integrations, and automation systems. Custom where it matters. Built to evolve with you.',
  pillars: ['Tailored to your context.', 'Shipped with intent.', 'Designed to feel like yours.'],
} as const;

export const HOW_I_WORK = {
  eyebrow: 'for those concerned',
  title: 'yes, i use non-sentient artificial inteligence',
  agents: [
    { name: 'Cursor', short: 'Cursor', url: 'https://cursor.com' },
    { name: 'Windsurf', short: 'Windsurf', url: 'https://windsurf.com' },
    { name: 'Cline', short: 'Cline', url: 'https://cline.bot' },
    { name: 'Continue', short: 'Continue', url: 'https://continue.dev' },
    { name: 'Kilo Code', short: 'Kilo', url: 'https://kilocode.ai' },
    { name: 'GitHub Copilot', short: 'Copilot', url: 'https://github.com/features/copilot' },
    { name: 'Amazon Q Developer', short: 'Amazon Q', url: 'https://aws.amazon.com/q/developer/' },
    { name: 'Gemini Code Assist', short: 'Gemini', url: 'https://cloud.google.com/products/gemini/code-assist' },
  ],
  disclaimer: 'The lineup above is subject to change the moment something better drops. Not a bug.',
  fastLine: "These tools make me fast. Good. That's the whole point.",
} as const;

export const NEURO_LINK = {
  eyebrow: 'the bigger picture',
  title: 'not just using them. learning to train them.',
  body: "These agents are my daily tools, but the real interest runs deeper: training, fine-tuning, and orchestrating complex models myself. Every node is a system I plug into, and a step toward shaping intelligence instead of just consuming it.",
  coreLabel: 'TRAINING CORE',
  coreSubLabel: 'fine-tune // orchestrate // ship',
} as const;

export const CURRENTLY = {
  eyebrow: 'Currently',
  items: [
    'Building business systems and SaaS products tailored to real workflows',
    'Working daily with Cursor and IDE-native AI agents',
    'Learning scalable architecture as the tooling evolves',
    'Making Zoho do things it was never designed to do',
  ],
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
  title: 'Have something worth building?',
  body: 'Tell me what you have in mind. If it sounds remotely possible, I\'ll probably build it.',
  cta: { label: 'Get In Touch' },
} as const;
