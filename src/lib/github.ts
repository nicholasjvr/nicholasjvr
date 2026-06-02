// GitHub data fetch with graceful fallback.
//
// Called at build time from GitHubPanel.astro (and the static /api/github.json
// endpoint). With a GITHUB_TOKEN set you get live, rate-limit-free data; without
// one it still tries the public API, and if anything fails it falls back to the
// cached snapshot in public/github-cache.json so the build never breaks.

import cache from '../../public/github-cache.json';
import { FEATURED_REPOS } from '../data/featured-repos';

export interface GitHubRepo {
  name: string;
  description: string | null;
  url: string;
  stars: number;
  forks: number;
  language: string | null;
  pushedAt: string;
  topics: string[];
}

export interface GitHubProfile {
  username: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  profileUrl: string;
  publicRepos: number;
  followers: number;
}

export interface GitHubData {
  profile: GitHubProfile;
  repos: GitHubRepo[];
  topLanguages: { name: string; count: number }[];
  fetchedAt: string;
  source: 'live' | 'cache';
}

const USERNAME =
  import.meta.env.PUBLIC_GITHUB_USERNAME || 'nicholasjvr';
const TOKEN = import.meta.env.GITHUB_TOKEN;

function headers(): HeadersInit {
  const h: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'nicholasjvr-portfolio',
  };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

function mapRepo(r: any): GitHubRepo {
  return {
    name: r.name,
    description: r.description,
    url: r.html_url,
    stars: r.stargazers_count,
    forks: r.forks_count,
    language: r.language,
    pushedAt: r.pushed_at,
    topics: r.topics ?? [],
  };
}

/** Fetch exactly the repos in the allowlist, preserving order, skipping any
 *  that can't be read (404/403 — e.g. private without a scoped token). */
async function fetchFeaturedRepos(names: string[]): Promise<GitHubRepo[]> {
  const results = await Promise.all(
    names.map(async (full) => {
      const res = await fetch(`https://api.github.com/repos/${full}`, {
        headers: headers(),
      });
      if (!res.ok) {
        console.warn(`[github] skipping ${full} (${res.status})`);
        return null;
      }
      return mapRepo(await res.json());
    })
  );
  return results.filter((r): r is GitHubRepo => r !== null);
}

/** Fallback when the allowlist is empty: top non-fork repos by stars. */
async function fetchTopRepos(): Promise<GitHubRepo[]> {
  const res = await fetch(
    `https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=pushed`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`GitHub repos API ${res.status}`);
  const raw = (await res.json()) as any[];
  return raw
    .filter((r) => !r.fork && !r.archived)
    .map(mapRepo)
    .sort((a, b) => b.stars - a.stars || b.pushedAt.localeCompare(a.pushedAt))
    .slice(0, 6);
}

function topLanguages(repos: GitHubRepo[]): GitHubData['topLanguages'] {
  const counts = new Map<string, number>();
  for (const r of repos) {
    if (r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

/**
 * Returns GitHub data, preferring a live fetch and falling back to the cached
 * snapshot on any error. Safe to call in build-time frontmatter.
 */
export async function getGitHubData(): Promise<GitHubData> {
  try {
    const profileRes = await fetch(`https://api.github.com/users/${USERNAME}`, {
      headers: headers(),
    });
    if (!profileRes.ok) throw new Error(`GitHub profile API ${profileRes.status}`);
    const p = await profileRes.json();

    const profile: GitHubProfile = {
      username: p.login,
      name: p.name,
      avatarUrl: p.avatar_url,
      bio: p.bio,
      profileUrl: p.html_url,
      publicRepos: p.public_repos,
      followers: p.followers,
    };

    // Curated allowlist drives the panel; fall back to top-by-stars if empty.
    const repos =
      FEATURED_REPOS.length > 0
        ? await fetchFeaturedRepos(FEATURED_REPOS)
        : await fetchTopRepos();

    return {
      profile,
      repos,
      topLanguages: topLanguages(repos),
      fetchedAt: new Date().toISOString(),
      source: 'live',
    };
  } catch (err) {
    console.warn(
      `[github] live fetch failed, using cached snapshot: ${(err as Error).message}`
    );
    return { ...(cache as Omit<GitHubData, 'source'>), source: 'cache' };
  }
}
