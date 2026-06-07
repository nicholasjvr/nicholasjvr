// THE knowledge corpus : the single source the future chatbot is grounded on.
//
// It aggregates *curated* context only: project case studies + FAQ + about.
// The bot reads this string, never raw GitHub repos, so "the app only has
// context access" is a structural guarantee, not a permission to police.
//
// Future chatbot wiring (when you add it):
//   1. Switch to a serverless endpoint: `output: 'hybrid'` + @astrojs/vercel,
//      then create src/pages/api/chat.ts with `export const prerender = false`.
//   2. Call buildKnowledgeCorpus() once and pass it as the system prompt /
//      cached context (GitHub Models, Anthropic, etc.). For a handful of
//      projects this fits in-context : no vector DB needed yet.
//   3. Use prompt caching on the corpus block so every chat turn is cheap.

import { getCollection } from 'astro:content';
import { FAQ } from '../data/faq';
import { ABOUT } from '../data/about';

/** Assemble all curated context into one markdown string for grounding. */
export async function buildKnowledgeCorpus(): Promise<string> {
  const projects = (await getCollection('projects')).sort(
    (a, b) => a.data.order - b.data.order
  );

  const projectBlocks = projects.map((p) => {
    const d = p.data;
    const skills = d.skills.join(', ');
    const stack = d.techStack.join(', ');
    const highlights = d.highlights
      .map((h) => `  - ${h.title}: ${h.body}`)
      .join('\n');
    return [
      `### Project: ${d.title} (${d.status})`,
      `Tagline: ${d.tagline}`,
      `Timeframe: ${d.timeframe} · Role: ${d.role}`,
      `Objective: ${d.objective}`,
      `Outcome: ${d.outcome}`,
      `Skills: ${skills}`,
      `Tech stack: ${stack}`,
      d.repo ? `Repo: ${d.repo}` : '',
      highlights ? `Highlights:\n${highlights}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  });

  const faqBlock = FAQ.map((f) => `- Q: ${f.q}\n  A: ${f.a}`).join('\n');

  return [
    `# About ${ABOUT.name}`,
    ABOUT.headline,
    ABOUT.summary,
    `What I can build:\n${ABOUT.canBuild.map((c) => `- ${c}`).join('\n')}`,
    `Contact: ${ABOUT.contact.email}`,
    '',
    '# Projects',
    ...projectBlocks,
    '',
    '# FAQ',
    faqBlock,
  ].join('\n\n');
}

/** System-prompt preamble pairing the voice guidance with the corpus. */
export async function buildSystemPrompt(): Promise<string> {
  const corpus = await buildKnowledgeCorpus();
  return [
    `You are the portfolio assistant for ${ABOUT.name}.`,
    ABOUT.voice,
    'Use ONLY the context below. If a question is outside it, say so plainly.',
    '\n---\n',
    corpus,
  ].join('\n');
}
