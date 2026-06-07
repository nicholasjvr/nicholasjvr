/** Prefix a root-relative path with Astro's deploy base (e.g. /nicholasjvr/). */
export function withBase(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const normalized = path.replace(/^\//, '');
  return `${base}${normalized}`;
}
