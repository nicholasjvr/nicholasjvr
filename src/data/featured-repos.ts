// Curated allowlist of the repos to feature on the site, in display order.
// Format: "owner/name". This is what makes the GitHub panel show *only* the
// repos you choose — independent of any token.
//
// - Leave the array empty to auto-show your top repos by stars instead.
// - Private repos here require a fine-grained PAT (GITHUB_TOKEN) scoped to just
//   these repositories with read-only Metadata. The token is used at build time
//   only and never reaches the browser.
export const FEATURED_REPOS: string[] = [
  'nicholasjvr/tradebot',
  'nicholasjvr/meeting_memory_nextjs',
];
