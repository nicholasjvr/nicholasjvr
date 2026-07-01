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
    q: 'What is this site?',
    a: 'A personal portfolio of side projects Nicholas has built outside of work - trading tools, SaaS experiments, automations, and other experiments. Each project has a case study write-up.',
    tags: ['identity', 'about'],
  },
  {
    q: 'Is Nicholas available for hire?',
    a: 'This site is a showcase of personal side projects, not a services pitch. For code and context, GitHub (@nicholasjvr) is the best place to look.',
    tags: ['about'],
  },
  {
    q: 'Where can I find the source code?',
    a: 'GitHub: github.com/nicholasjvr. Individual project repos are linked from each case study where applicable.',
    tags: ['contact', 'projects'],
  },
];
