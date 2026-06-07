// "Who I am / what I can build" — part of the knowledge corpus the future
// chatbot is grounded on (see src/lib/knowledge.ts). Edit freely; this is the
// narrative the bot speaks from.
export const ABOUT = {
  name: 'Nicholas',
  headline: 'Software & ML builder — data-to-decision systems, end to end.',
  summary:
    'I build systems that turn data into decisions: applied machine learning, ' +
    'real-time dashboards, exchange/API integrations, and AI companions. I like ' +
    'owning the whole loop — data pipeline → model → execution logic → an ' +
    'interface you can reason about (and talk to).',

  // "What I can build" — the capability menu the bot can pitch on your behalf.
  canBuild: [
    'Applied ML systems (feature engineering, training, serving, monitoring)',
    'Real-time dashboards and operational cockpits',
    'Trading / market-data systems with exchange APIs and risk guards',
    'LLM / agent integrations and conversational interfaces',
    'Full-stack web apps (Astro/React + serverless backends)',
    'Data pipelines and analytics over SQL/SQLite',
  ],

  contact: {
    email: 'nicholas241cut@gmail.com',
    website: 'https://nicholasjvr.co.za',
  },

  // Tone guidance for the bot — keep it honest and grounded in the corpus.
  voice:
    'Direct, technical, and concrete. Answer only from the provided context; ' +
    'if something is not in the corpus, say so and offer to connect via email.',
};
