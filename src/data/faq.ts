// Curated FAQ : part of the knowledge corpus (src/lib/knowledge.ts) and also
// renderable as an on-page FAQ section later. Keep answers short and factual;
// the chatbot will quote/paraphrase these.
export interface FaqItem {
  q: string;
  a: string;
  tags?: string[];
}

export const FAQ: FaqItem[] = [
  {
    q: 'What is the TradeBot Companion?',
    a: 'A local crypto trading cockpit that runs two strategies (a volatility bot and an ML trader) against a paper account on Luno (ZAR), with a real-time dashboard and an AI companion that answers questions over live trade data.',
    tags: ['tradebot', 'projects'],
  },
  {
    q: 'What ML does the TradeBot use?',
    a: 'A scikit-learn RandomForestClassifier (100 trees, depth 12) trained on 15 engineered time-series features (moving averages, volatility, ATR, multi-window returns), with accuracy/precision/recall tracking and feature-importance analysis.',
    tags: ['tradebot', 'ml'],
  },
  {
    q: 'What does Nicholas do?',
    a: 'Fullstack JavaScript developer. He builds software, systems, automations, and products: SaaS platforms, Zoho ecosystems, internal business tools, dashboards, integrations, and automation systems.',
    tags: ['identity', 'about'],
  },
  {
    q: 'What can Nicholas build for me?',
    a: 'Fullstack SaaS products (Node.js, React, Next.js, TypeScript), Zoho ecosystems (Creator, CRM, custom widgets), internal business tools and dashboards, API integrations, and automation platforms. AI-enhanced workflows where they add real value.',
    tags: ['hire', 'services'],
  },
  {
    q: 'How do I get in touch?',
    a: 'Email nicholas241cut@gmail.com, or open an issue / DM on GitHub (@nicholasjvr).',
    tags: ['contact'],
  },
];
