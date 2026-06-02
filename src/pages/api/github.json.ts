import type { APIRoute } from 'astro';
import { getGitHubData } from '../../lib/github';

// Static endpoint: prerendered to /api/github.json at build time. Gives a real
// URL for the live GitHub snapshot (handy for a future client-side refresh)
// without needing a server adapter. Refreshes on every deploy.
export const GET: APIRoute = async () => {
  const data = await getGitHubData();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};
