// Central skills taxonomy : the single source of truth for skill chips, the
// home-page skill matrix, and the projects filter. Projects reference skills by
// `key` (see src/content/config.ts), so labels/categories stay consistent and
// the site can reverse-map "where have I used X?".

export type SkillCategory =
  | 'Languages'
  | 'ML / Data'
  | 'Backend / APIs'
  | 'Frontend / UI'
  | 'Infra / DevOps'
  | 'AI / Agents';

export const CATEGORY_ORDER: SkillCategory[] = [
  'Languages',
  'ML / Data',
  'Backend / APIs',
  'Frontend / UI',
  'AI / Agents',
  'Infra / DevOps',
];

export interface Skill {
  key: string;
  label: string;
  category: SkillCategory;
}

// Add to this list as you add projects; reference the `key` from frontmatter.
export const SKILLS = {
  python: { key: 'python', label: 'Python', category: 'Languages' },
  typescript: { key: 'typescript', label: 'TypeScript', category: 'Languages' },
  sql: { key: 'sql', label: 'SQL', category: 'Languages' },

  ml: { key: 'ml', label: 'Machine Learning', category: 'ML / Data' },
  sklearn: { key: 'sklearn', label: 'scikit-learn', category: 'ML / Data' },
  'feature-eng': {
    key: 'feature-eng',
    label: 'Feature Engineering',
    category: 'ML / Data',
  },
  'time-series': {
    key: 'time-series',
    label: 'Time-Series Analysis',
    category: 'ML / Data',
  },
  'data-viz': { key: 'data-viz', label: 'Data Visualisation', category: 'ML / Data' },

  sqlite: { key: 'sqlite', label: 'SQLite', category: 'Backend / APIs' },
  'rest-api': { key: 'rest-api', label: 'REST API Integration', category: 'Backend / APIs' },
  'exchange-api': {
    key: 'exchange-api',
    label: 'Exchange APIs (Luno)',
    category: 'Backend / APIs',
  },
  'realtime': { key: 'realtime', label: 'Real-Time Systems', category: 'Backend / APIs' },

  astro: { key: 'astro', label: 'Astro', category: 'Frontend / UI' },
  nextjs: { key: 'nextjs', label: 'Next.js', category: 'Frontend / UI' },
  react: { key: 'react', label: 'React', category: 'Frontend / UI' },
  tailwind: { key: 'tailwind', label: 'Tailwind CSS', category: 'Frontend / UI' },
  dashboards: { key: 'dashboards', label: 'Dashboard UX', category: 'Frontend / UI' },
  'react-native': {
    key: 'react-native',
    label: 'React Native',
    category: 'Frontend / UI',
  },
  flutter: { key: 'flutter', label: 'Flutter', category: 'Frontend / UI' },
  threejs: { key: 'threejs', label: 'Three.js / WebGL', category: 'Frontend / UI' },
  nfc: { key: 'nfc', label: 'NFC / Mobile Hardware', category: 'Frontend / UI' },

  firebase: { key: 'firebase', label: 'Firebase', category: 'Backend / APIs' },
  oauth: { key: 'oauth', label: 'OAuth Integrations', category: 'Backend / APIs' },
  prisma: { key: 'prisma', label: 'Prisma ORM', category: 'Backend / APIs' },
  azure: { key: 'azure', label: 'Microsoft Azure', category: 'Infra / DevOps' },

  'llm-agents': { key: 'llm-agents', label: 'LLM / Agent Integration', category: 'AI / Agents' },
  'risk-logic': { key: 'risk-logic', label: 'Risk-Management Logic', category: 'AI / Agents' },

  git: { key: 'git', label: 'Git / GitHub', category: 'Infra / DevOps' },
  vercel: { key: 'vercel', label: 'Vercel', category: 'Infra / DevOps' },
} as const satisfies Record<string, Skill>;

export type SkillKey = keyof typeof SKILLS;

/** Resolve a frontmatter skill key to a Skill, tolerating unknown keys. */
export function getSkill(key: string): Skill {
  return (
    (SKILLS as Record<string, Skill>)[key] ?? {
      key,
      label: key,
      category: 'Languages',
    }
  );
}
