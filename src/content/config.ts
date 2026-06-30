import { defineCollection, z } from 'astro:content';

// The project schema : a typed frontmatter contract every case study must
// satisfy. Adding a project = dropping a new .mdx file that fills this in.
// A bad value fails `astro build`, which is the point (see plan: schema check).
const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    status: z.enum(['live', 'wip', 'archived']),
    featured: z.boolean().default(false),
    order: z.number().default(100),
    timeframe: z.string(),
    role: z.string(),

    // The case-study spine: why it exists, and what it proves.
    objective: z.string(),
    outcome: z.string(),

    // Skill keys into src/data/skills.ts; techStack is free-text display chips.
    skills: z.array(z.string()).default([]),
    techStack: z.array(z.string()).default([]),

    repo: z.string().url().optional(),
    liveUrl: z.string().url().optional(),

    cover: z.string(),
    gallery: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string(),
          caption: z.string().optional(),
        })
      )
      .default([]),

    metrics: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .default([]),

    highlights: z
      .array(z.object({ title: z.string(), body: z.string() }))
      .default([]),

    // Per-project accent palette (see src/data/project-themes.ts).
    accentTheme: z
      .enum(['default', 'tradebot', 'meeting-memory', 'cinhaus', 'wakatime', 'sportsopp', 'truckloader'])
      .default('default'),

    // Pluggable demo slot : the forward-compat seam for "berserk mode".
    // v1 ships 'screenshots'; flip to 'iframe' | 'replay' later without
    // touching the page layout ([slug].astro switches on demo.kind).
    demo: z
      .object({
        kind: z.enum(['screenshots', 'video', 'iframe', 'replay']),
        src: z.string().optional(),
        // For kind: 'iframe' with more than one embeddable page, list them here
        // and the demo renders a tabbed live preview. Falls back to `src` when
        // a single page is enough.
        sources: z
          .array(z.object({ src: z.string(), label: z.string() }))
          .optional(),
      })
      .default({ kind: 'screenshots' }),
  }),
});

export const collections = { projects };
